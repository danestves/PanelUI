/**
 * Sortable — a list whose rows can be dragged into a different order.
 *
 * The one list interaction nothing else in the library covers. `Swipe` acts on
 * a row, `Tree` opens one, `Table` sorts every row at once by a column — none
 * of them let a person say *this one goes above that one*, which is how a
 * playlist, a task list, a set of form fields or a run of dashboard tiles is
 * actually arranged.
 *
 * ```tsx
 * const [tasks, setTasks] = useState(TASKS);
 *
 * <Sortable
 *   value={tasks.map((task) => task.id)}
 *   onReorder={(_, { from, to }) => setTasks((t) => reorderItems(t, from, to))}
 *   gap={8}
 * >
 *   {tasks.map((task) => (
 *     <Sortable.Item key={task.id} id={task.id}>
 *       <Item variant="outline">
 *         <Item.Content>
 *           <Item.Title>{task.title}</Item.Title>
 *         </Item.Content>
 *         <Sortable.Handle />
 *       </Item>
 *     </Sortable.Item>
 *   ))}
 * </Sortable>
 * ```
 *
 * ## Nothing is ever moved in the tree
 *
 * The rows stay exactly where they were laid out and are pushed around with
 * transforms. A row's offset is the difference between where its slot sits in
 * the order being dragged and where it sits in the order that was rendered —
 * one subtraction, on the UI thread, per row per frame. Reordering the
 * children instead would mean React reconciling the whole list on every slot
 * the finger crosses, which is the one thing a drag cannot afford.
 *
 * It also means the component never owns the order. It reports where a row was
 * dropped and the list is the caller's to rearrange, because the caller is the
 * only one who knows what the ids stand for — a `value` that disagreed with
 * the children would put rows in places their content had not moved to.
 *
 * ## Heights are measured, not assumed
 *
 * Every row reports its own height, so a list of rows of different sizes lands
 * in the right slots. A fixed row height would be one number to get wrong in
 * every list that has a two-line row in it, and the measurement costs one
 * layout pass on mount.
 *
 * ## Where the drop is reported
 *
 * `onReorder` fires when the row has finished settling, not when the finger
 * lifts. Between those two moments the row is animating into a slot that the
 * layout does not know about yet; re-rendering the list in the middle of that
 * would relayout every row underneath it and the settling row would jump. By
 * the time the callback runs the rows are already where the new order puts
 * them, so the re-render that follows changes nothing on screen.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  measure,
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useScrollViewOffset,
  useSharedValue,
  withSpring,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';
import { GripVerticalIcon, IconColorProvider } from '../../icons';
import { cn } from '../../utils/cn';
import { impactKnock, selectionTick } from '../../utils/haptics';

/**
 * Settles a row into its slot. Stiffer and less bouncy than the library's
 * overlay springs: a row that overshoots its slot reads as having landed in
 * the wrong one and then corrected itself.
 */
const SPRING = { damping: 26, stiffness: 260, mass: 0.7 } as const;

/** How much a lifted row grows. Enough to read as picked up, not as zoomed. */
const LIFT_SCALE = 1.03;

/** How far the finger must travel on a handle before the drag takes over. */
const HANDLE_SLOP = 4;

/** What starts a drag. */
export type SortableActivation = 'handle' | 'longPress';

/** Where a row ended up, alongside the order it produced. */
export interface SortableReorderDetails {
  /** The row that was dragged. */
  id: string;
  /** Its index before the drag. */
  from: number;
  /** Its index after it. */
  to: number;
}

/**
 * The same move applied to a list of your own.
 *
 * `onReorder` hands back the new order of the ids, but a list is rarely a list
 * of ids — it is a list of the things they name. This does the move on that
 * list, and returns a new array rather than sorting in place, because the one
 * that mutated would be the one React had already decided was unchanged.
 *
 * ```tsx
 * onReorder={(_, { from, to }) => setTasks((tasks) => reorderItems(tasks, from, to))}
 * ```
 *
 * Indices outside the list are returned unchanged rather than throwing: a
 * reorder is not worth crashing a screen over, and a list that did not move is
 * the honest result of a move that had nowhere to go.
 */
export function reorderItems<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to) return [...items];
  if (from < 0 || from >= items.length) return [...items];
  if (to < 0 || to >= items.length) return [...items];

  const next = [...items];
  const moved = next.splice(from, 1);
  next.splice(to, 0, ...moved);
  return next;
}

/* -------------------------------------------------------------------------- */
/* Slot maths                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * How far down the list a row's slot begins, given an order and the measured
 * heights — the sum of everything above it plus one gap per row above it.
 *
 * A worklet, and deliberately a loop rather than a cached prefix sum: the
 * lists this component is for are the ones a person is willing to drag through
 * by hand, and a cache would be another thing to invalidate every time a row
 * changed height.
 */
function slotOffset(
  order: readonly string[],
  id: string,
  heights: Record<string, number>,
  gap: number
): number {
  'worklet';
  let offset = 0;
  for (let i = 0; i < order.length; i += 1) {
    const at = order[i];
    if (at === id) return offset;
    offset += (at === undefined ? 0 : (heights[at] ?? 0)) + gap;
  }
  return offset;
}

/** The middle of the slot at `index`, in the same coordinates. */
function slotCenter(
  order: readonly string[],
  index: number,
  heights: Record<string, number>,
  gap: number
): number {
  'worklet';
  let offset = 0;
  for (let i = 0; i < index; i += 1) {
    const at = order[i];
    offset += (at === undefined ? 0 : (heights[at] ?? 0)) + gap;
  }
  const self = order[index];
  return offset + (self === undefined ? 0 : (heights[self] ?? 0)) / 2;
}

/**
 * Where the dragged row belongs now, given where its middle has reached.
 *
 * It walks outwards from the row's current slot and stops at the first
 * neighbour it has *not* passed the middle of, rather than scanning the whole
 * list for the nearest slot. The difference shows up with rows of unequal
 * height: scanning can hand back a slot two places away that happens to be
 * closer, which reads as the row skipping one.
 */
function targetIndex(
  order: readonly string[],
  current: number,
  center: number,
  heights: Record<string, number>,
  gap: number
): number {
  'worklet';
  if (center < slotCenter(order, current, heights, gap)) {
    let target = current;
    for (let i = current - 1; i >= 0; i -= 1) {
      if (center >= slotCenter(order, i, heights, gap)) break;
      target = i;
    }
    return target;
  }

  let target = current;
  for (let i = current + 1; i < order.length; i += 1) {
    if (center <= slotCenter(order, i, heights, gap)) break;
    target = i;
  }
  return target;
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

interface SortableContextValue {
  /** The order being dragged. Diverges from `rendered` mid-drag, never after. */
  order: SharedValue<string[]>;
  /** The order the children were laid out in — what the transforms subtract. */
  rendered: SharedValue<string[]>;
  /** Measured row heights, keyed by id. */
  heights: SharedValue<Record<string, number>>;
  /** The row under the finger, or `null`. Also the settling row, until it lands. */
  activeId: SharedValue<string | null>;
  /** The active row's offset from where it was laid out. */
  translate: SharedValue<number>;
  /** The finger's position on the screen, for the scroller to read. */
  fingerY: SharedValue<number>;
  /** The enclosing scroller's offset, or a constant 0 when there is none. */
  scrollOffset: SharedValue<number>;
  /** What that offset was when the drag began. */
  scrollAtStart: SharedValue<number>;
  gap: number;
  disabled: boolean;
  activation: SortableActivation;
  longPressDelay: number;
  haptics: boolean;
  reducedMotion: boolean;
  /** JS-side mirror of `activeId`, written twice a drag rather than per frame. */
  activeItem: string | null;
  /** Index of each id in the rendered order. */
  indexOf: (id: string) => number;
  measured: (id: string, height: number) => void;
  begin: (id: string) => void;
  settled: (id: string) => void;
  /** Move a row by whole slots — the path that is not a gesture. */
  step: (id: string, delta: number) => void;
  setAutoscroll: (active: boolean) => void;
}

const SortableRootContext = createContext<SortableContextValue | null>(null);

function useSortableRoot(part: string): SortableContextValue {
  const context = useContext(SortableRootContext);
  if (!context) throw new Error(`${part} must be used inside <Sortable>.`);
  return context;
}

interface SortableItemContextValue {
  id: string;
  index: number;
  isActive: boolean;
  disabled: boolean;
  /** The pan, when it belongs to a handle rather than to the whole row. */
  handleGesture: GestureType | null;
}

const SortableItemContext = createContext<SortableItemContextValue | null>(null);

/**
 * What the row being rendered knows about itself.
 *
 * For a handle of your own, or for a row that looks different while it is
 * being carried — dimmed neighbours, a border, a shadow. `isActive` is a plain
 * boolean and changes twice in a drag rather than sixty times a second: it is
 * set when the row is lifted and cleared when it lands, and nothing between
 * those two moments touches React at all.
 */
export function useSortableItem(): {
  id: string;
  index: number;
  isActive: boolean;
  disabled: boolean;
} {
  const context = useContext(SortableItemContext);
  if (!context) throw new Error('useSortableItem must be used inside <Sortable.Item>.');
  const { id, index, isActive, disabled } = context;
  return { id, index, isActive, disabled };
}

/* -------------------------------------------------------------------------- */
/* Root                                                                       */
/* -------------------------------------------------------------------------- */

export interface SortableProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /**
   * The ids of the rows, in the order they are rendered below. It is the
   * caller's array rather than the component's, because only the caller knows
   * what an id stands for — an order held here that disagreed with the
   * children would put rows in places their content had not moved to.
   */
  value: string[];
  /**
   * The rows, one `Sortable.Item` per id in `value` and in the same order.
   * They may be wrapped in anything; each row registers itself.
   */
  children?: ReactNode;
  /**
   * Told the new order once the dropped row has settled, and where it came
   * from and went. Rearrange your own list from `details` — `reorderItems`
   * does exactly this move.
   */
  onReorder?: (order: string[], details: SortableReorderDetails) => void;
  /**
   * Space between rows, in points. A prop rather than a `gap` class because
   * the drag has to know it: the slot a row lands in is measured, and a gap
   * the component cannot read is a gap it drops rows into the middle of.
   */
  gap?: number;
  /**
   * What lifts a row. `handle` is the default and the safer one — the rest of
   * the row stays free to be pressed, and a list of rows with buttons on them
   * still works. `longPress` gives the whole row to the drag.
   */
  activation?: SortableActivation;
  /** How long `longPress` activation waits, in milliseconds. */
  longPressDelay?: number;
  /**
   * Knock when a row is lifted, tick as it passes each slot. On by default:
   * a drag with no feedback under the finger is the interaction people give up
   * on halfway through, unsure whether anything is happening.
   */
  haptics?: boolean;
  /** Turn every row's drag off and leave the list static. */
  disabled?: boolean;
  /**
   * The scroller the list sits in, from `useAnimatedRef`. Given one, a drag
   * carried to the top or bottom edge scrolls it, so a list longer than the
   * screen can be reordered end to end. Without it a drag stops at the edge,
   * which is correct for a list that fits.
   */
  scrollRef?: AnimatedRef<Animated.ScrollView>;
  /** Points from the scroller's edge at which the scrolling begins. */
  autoscrollThreshold?: number;
  /** Points per frame at the very edge, tapering to nothing at the threshold. */
  autoscrollSpeed?: number;
  /** Told which row was lifted, the moment it is. */
  onDragStart?: (id: string) => void;
  /** Told when it lands, whether or not the order changed. */
  onDragEnd?: (id: string) => void;
}

/**
 * The list, and everything the rows share.
 *
 * It renders one plain `View` in a column and nothing else. The rows are the
 * caller's, laid out by flexbox in the order they were written; the component
 * only ever adds a transform to them.
 */
function SortableRoot({
  className,
  value,
  children,
  onReorder,
  gap = 0,
  activation = 'handle',
  longPressDelay = 220,
  haptics = true,
  disabled = false,
  scrollRef,
  autoscrollThreshold = 72,
  autoscrollSpeed = 8,
  onDragStart,
  onDragEnd,
  ...props
}: SortableProps) {
  const order = useSharedValue<string[]>(value);
  const rendered = useSharedValue<string[]>(value);
  const heights = useSharedValue<Record<string, number>>({});
  const activeId = useSharedValue<string | null>(null);
  const translate = useSharedValue(0);
  const fingerY = useSharedValue(0);

  const [activeItem, setActiveItem] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  /*
   * A joined key rather than the array: `value` is almost always a fresh
   * `.map()` on every render, so depending on it directly would reset the
   * order on every keystroke elsewhere on the screen. A null separator
   * cannot appear in an id that came from anywhere real.
   */
  const key = value.join('\u0000');

  /*
   * The caller has applied the drop, so the rendered order is the new one and
   * the transforms that were holding rows in their new slots are no longer
   * needed — the layout puts them there now. Both orders are reset together,
   * which is what makes the re-render after a drop invisible.
   */
  useEffect(() => {
    order.value = value;
    rendered.value = value;
    translate.value = 0;
    // `value` is covered by `key`; depending on the array itself would fire
    // this on every render of the screen around it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, order, rendered, translate]);

  const indices = useMemo(() => {
    const map = new Map<string, number>();
    value.forEach((id, index) => map.set(id, index));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const indexOf = useCallback((id: string) => indices.get(id) ?? -1, [indices]);

  const measured = useCallback(
    (id: string, height: number) => {
      if (heights.value[id] === height) return;
      heights.value = { ...heights.value, [id]: height };
    },
    [heights]
  );

  /* ---------------------------------------------------------------------- */
  /* Autoscroll                                                             */
  /* ---------------------------------------------------------------------- */

  /*
   * A ref of its own so `useScrollViewOffset` always has one to hold. It is
   * never attached to anything, and the hook is happy with a ref that resolves
   * to nothing — which is exactly the case where there is no scrolling to do.
   */
  const fallbackRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef ?? fallbackRef);

  /**
   * Where the scroller stood when the drag began. The row follows the finger,
   * and the finger is measured against the screen — so every point the list
   * scrolls underneath it has to be added back, or a row would slide out from
   * under the finger the moment the list started moving.
   */
  const scrollAtStart = useSharedValue(0);

  /*
   * A frame callback rather than something driven by the pan, because the
   * finger held still at the edge is exactly when the scrolling has to keep
   * happening — and a pan that is not moving sends no updates.
   */
  const autoscroll = useFrameCallback(() => {
    'worklet';
    if (!scrollRef || activeId.value === null) return;

    const view = measure(scrollRef);
    if (!view) return;

    const top = view.pageY + autoscrollThreshold;
    const bottom = view.pageY + view.height - autoscrollThreshold;
    const y = fingerY.value;

    let intensity = 0;
    if (y < top) intensity = (y - top) / autoscrollThreshold;
    else if (y > bottom) intensity = (y - bottom) / autoscrollThreshold;
    if (intensity === 0) return;

    const clamped = Math.max(-1, Math.min(1, intensity));
    scrollTo(scrollRef, 0, scrollOffset.value + clamped * autoscrollSpeed, false);
  }, false);

  /*
   * `setActive` is a JS-thread call, so the gesture reaches it through
   * `runOnJS` rather than flipping a flag the callback would have to poll.
   */
  const setAutoscroll = useCallback(
    (active: boolean) => {
      if (!scrollRef) return;
      autoscroll.setActive(active);
    },
    [autoscroll, scrollRef]
  );

  /* ---------------------------------------------------------------------- */
  /* Lifting and landing                                                     */
  /* ---------------------------------------------------------------------- */

  const begin = useCallback(
    (id: string) => {
      setActiveItem(id);
      setAutoscroll(true);
      if (haptics) impactKnock();
      onDragStart?.(id);
    },
    [haptics, onDragStart, setAutoscroll]
  );

  /**
   * The row has landed. Only now is the drop reported: until the spring
   * finished, the row was in a slot the layout knew nothing about, and a
   * re-render in the middle of that would have relaid out every row under it
   * while one of them was still moving.
   */
  const settled = useCallback(
    (id: string) => {
      setActiveItem(null);
      setAutoscroll(false);
      onDragEnd?.(id);

      const next = order.value;
      const from = rendered.value.indexOf(id);
      const to = next.indexOf(id);
      if (from === to || from < 0 || to < 0) return;

      onReorder?.([...next], { id, from, to });
    },
    [onDragEnd, onReorder, order, rendered, setAutoscroll]
  );

  /**
   * A move of whole slots, with no gesture behind it — the path a screen
   * reader takes, and the one a keyboard would take if a phone had one. It
   * reports the drop straight away: nothing is mid-flight, so there is no
   * settling to wait for.
   */
  const step = useCallback(
    (id: string, delta: number) => {
      const current = rendered.value.indexOf(id);
      if (current < 0) return;

      const to = current + delta;
      if (to < 0 || to >= rendered.value.length) return;

      const next = reorderItems(rendered.value, current, to);
      order.value = next;
      if (haptics) selectionTick();
      onReorder?.(next, { id, from: current, to });
    },
    [haptics, onReorder, order, rendered]
  );

  const context = useMemo<SortableContextValue>(
    () => ({
      order,
      rendered,
      heights,
      activeId,
      translate,
      fingerY,
      scrollOffset,
      scrollAtStart,
      gap,
      disabled,
      activation,
      longPressDelay,
      haptics,
      reducedMotion,
      activeItem,
      indexOf,
      measured,
      begin,
      settled,
      step,
      setAutoscroll,
    }),
    [
      order,
      rendered,
      heights,
      activeId,
      translate,
      fingerY,
      scrollOffset,
      scrollAtStart,
      gap,
      disabled,
      activation,
      longPressDelay,
      haptics,
      reducedMotion,
      activeItem,
      indexOf,
      measured,
      begin,
      settled,
      step,
      setAutoscroll,
    ]
  );

  return (
    <SortableRootContext.Provider value={context}>
      <View
        accessibilityRole="list"
        className={cn('w-full', className)}
        style={gap > 0 ? { gap } : undefined}
        {...props}
      >
        {children}
      </View>
    </SortableRootContext.Provider>
  );
}
SortableRoot.displayName = 'Sortable';

/* -------------------------------------------------------------------------- */
/* Item                                                                       */
/* -------------------------------------------------------------------------- */

export interface SortableItemProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /**
   * What this row is, and the id that appears in `value` and in the order
   * handed back. Stable across renders — an id derived from the index changes
   * the moment the list is reordered, and the rows lose track of themselves.
   */
  id: string;
  children?: ReactNode;
  /**
   * Stop this row being picked up. The others still move past it, because a
   * row that cannot be dragged is not the same as a row that cannot be
   * displaced — a pinned row is a different feature, and pretending this one
   * is it would mean silently refusing drops that look like they worked.
   */
  disabled?: boolean;
  /** Extra classes for the row while it is being carried. */
  activeClassName?: string;
}

/**
 * One row.
 *
 * It measures itself, carries its own transform, and holds the pan — which is
 * either wrapped around the whole row or handed to a `Sortable.Handle` inside
 * it, depending on what lifts a row in this list.
 */
function SortableItem({
  className,
  activeClassName,
  id,
  children,
  disabled = false,
  ...props
}: SortableItemProps) {
  const root = useSortableRoot('Sortable.Item');
  const {
    order,
    rendered,
    heights,
    activeId,
    translate,
    fingerY,
    scrollOffset,
    scrollAtStart,
    gap,
    activation,
    longPressDelay,
    haptics,
    reducedMotion,
    activeItem,
    indexOf,
    measured,
    begin,
    settled,
    step,
  } = root;

  /** A row is undraggable if either it or the whole list says so. */
  const locked = root.disabled || disabled;
  const index = indexOf(id);
  const isActive = activeItem === id;

  const tick = useCallback(() => selectionTick(), []);

  /*
   * Read off a ref inside the worklets rather than captured by them: `begin`
   * and `settled` change identity whenever the caller's callbacks do, and a
   * gesture rebuilt mid-drag is a gesture that drops the drag.
   */
  const handlers = useRef({ begin, settled, tick });
  handlers.current = { begin, settled, tick };

  const notifyBegin = useCallback((rowId: string) => {
    handlers.current.begin(rowId);
  }, []);
  const notifySettled = useCallback((rowId: string) => {
    handlers.current.settled(rowId);
  }, []);
  const notifyTick = useCallback(() => {
    handlers.current.tick();
  }, []);

  const pan = useMemo(() => {
    const gesture = Gesture.Pan()
      .enabled(!locked)
      .onStart((event) => {
        activeId.value = id;
        translate.value = 0;
        order.value = [...rendered.value];
        fingerY.value = event.absoluteY;
        /*
         * Taken here rather than on the JS side: `notifyBegin` lands a frame
         * or more later, and by then a fast flick may already have moved the
         * scroller — which would be read as the finger having moved.
         */
        scrollAtStart.value = scrollOffset.value;
        runOnJS(notifyBegin)(id);
      })
      .onUpdate((event) => {
        if (activeId.value !== id) return;

        /*
         * The pan reports the finger against the screen, so every point the
         * list has scrolled underneath it since the lift has to be added
         * back — otherwise a row slides out from under the finger the moment
         * a drag at the edge starts scrolling.
         */
        translate.value =
          event.translationY + (scrollOffset.value - scrollAtStart.value);
        fingerY.value = event.absoluteY;

        const list = order.value;
        const map = heights.value;
        const current = list.indexOf(id);
        if (current < 0) return;

        const top = slotOffset(rendered.value, id, map, gap) + translate.value;
        const center = top + (map[id] ?? 0) / 2;
        const to = targetIndex(list, current, center, map, gap);
        if (to === current) return;

        const next = [...list];
        next.splice(current, 1);
        next.splice(to, 0, id);
        order.value = next;

        if (haptics) runOnJS(notifyTick)();
      })
      .onFinalize(() => {
        if (activeId.value !== id) return;

        /*
         * The row springs to where its new slot sits *in the old layout* —
         * the layout has not changed yet and will not until the drop is
         * reported, which is what the callback below does once the row has
         * stopped moving.
         */
        const landing =
          slotOffset(order.value, id, heights.value, gap) -
          slotOffset(rendered.value, id, heights.value, gap);

        const land = (finished?: boolean) => {
          'worklet';
          if (!finished) return;
          activeId.value = null;
          runOnJS(notifySettled)(id);
        };

        if (reducedMotion) {
          translate.value = landing;
          land(true);
          return;
        }

        translate.value = withSpring(landing, SPRING, land);
      });

    if (activation === 'longPress') return gesture.activateAfterLongPress(longPressDelay);

    /*
     * On a handle the drag starts on movement rather than on a hold, but not
     * on the first pixel: a list inside a scroller has to be able to scroll
     * from a finger that happened to land on a grip.
     */
    return gesture.activeOffsetY([-HANDLE_SLOP, HANDLE_SLOP]);
  }, [
    activation,
    activeId,
    locked,
    fingerY,
    gap,
    haptics,
    heights,
    id,
    longPressDelay,
    notifyBegin,
    notifySettled,
    notifyTick,
    order,
    reducedMotion,
    rendered,
    scrollAtStart,
    scrollOffset,
    translate,
  ]);

  const style = useAnimatedStyle(() => {
    const carried = activeId.value === id;

    if (carried) {
      return {
        transform: [
          { translateY: translate.value },
          { scale: reducedMotion ? 1 : withSpring(LIFT_SCALE, SPRING) },
        ],
        zIndex: 1,
        elevation: 1,
      };
    }

    const map = heights.value;
    const offset =
      slotOffset(order.value, id, map, gap) - slotOffset(rendered.value, id, map, gap);

    return {
      transform: [
        { translateY: reducedMotion ? offset : withSpring(offset, SPRING) },
        // Springs back rather than snapping: this branch takes over the frame
        // the dropped row lands, and a step straight from the lifted scale to
        // 1 reads as the row flinching at the end of the drop.
        { scale: reducedMotion ? 1 : withSpring(1, SPRING) },
      ],
      zIndex: 0,
      elevation: 0,
    };
  });

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => measured(id, event.nativeEvent.layout.height),
    [id, measured]
  );

  const itemContext = useMemo<SortableItemContextValue>(
    () => ({
      id,
      index,
      isActive,
      disabled: locked,
      handleGesture: activation === 'handle' ? pan : null,
    }),
    [id, index, isActive, locked, activation, pan]
  );

  /**
   * A drag is invisible to a screen reader — there is nothing to announce and
   * no way to discover it from the row. Moving by whole slots is published as
   * an accessibility action instead, which is the only path to reordering for
   * someone who is not dragging anything.
   */
  const a11y = locked
    ? undefined
    : [
        { name: 'moveUp', label: 'Move up' },
        { name: 'moveDown', label: 'Move down' },
      ];

  const row = (
    <Animated.View
      onLayout={onLayout}
      accessibilityActions={a11y}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'moveUp') step(id, -1);
        if (event.nativeEvent.actionName === 'moveDown') step(id, 1);
      }}
      style={style}
      className={cn('w-full', className, isActive && activeClassName)}
      {...props}
    >
      {children}
    </Animated.View>
  );

  return (
    <SortableItemContext.Provider value={itemContext}>
      {activation === 'longPress' ? (
        <GestureDetector gesture={pan}>{row}</GestureDetector>
      ) : (
        row
      )}
    </SortableItemContext.Provider>
  );
}
SortableItem.displayName = 'Sortable.Item';

/* -------------------------------------------------------------------------- */
/* Handle                                                                     */
/* -------------------------------------------------------------------------- */

export interface SortableHandleProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** Replaces the grip glyph. Anything at all — the drag is on the box. */
  children?: ReactNode;
  /** What a screen reader calls the grip. */
  accessibilityLabel?: string;
}

/**
 * The part of a row that lifts it.
 *
 * A grip exists so the rest of the row does not have to be given up to the
 * drag: a row with a button, a checkbox or a link on it needs those to stay
 * pressable, and a long press on the whole row takes all of them. It is sized
 * to be hit rather than to be seen, which is why the box around the glyph is
 * larger than the glyph.
 *
 * Inert in a list that lifts on a long press — the whole row already carries
 * the gesture there, and a second one inside it would fight the first.
 */
function SortableHandle({
  className,
  children,
  accessibilityLabel = 'Drag to reorder',
  ...props
}: SortableHandleProps) {
  const { activation, disabled: rootDisabled } = useSortableRoot('Sortable.Handle');
  const item = useContext(SortableItemContext);

  /*
   * The grip is furniture rather than content, so it takes the muted
   * foreground — read from the theme rather than written down, because a hex
   * here stops being right the moment the theme inverts.
   */
  const muted = useCSSVariable('--color-muted-foreground');
  const tint = typeof muted === 'string' ? muted : undefined;

  const glyph = (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: rootDisabled || item?.disabled }}
      className={cn(
        'items-center justify-center px-2 py-1.5',
        (rootDisabled || item?.disabled) && 'opacity-40',
        className
      )}
      {...props}
    >
      <IconColorProvider color={tint}>
        {children ?? <GripVerticalIcon size={18} />}
      </IconColorProvider>
    </View>
  );

  if (activation !== 'handle' || !item?.handleGesture) return glyph;

  return <GestureDetector gesture={item.handleGesture}>{glyph}</GestureDetector>;
}
SortableHandle.displayName = 'Sortable.Handle';

export const Sortable = Object.assign(SortableRoot, {
  Item: SortableItem,
  Handle: SortableHandle,
});
