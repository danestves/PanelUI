/**
 * SplitView — two stacked panes whose seam settles on one of a few named
 * heights rather than wherever the finger stopped.
 *
 * ```tsx
 * <SplitView className="h-96" snapPoints={[0.25, 0.6]} minHeight={80}>
 *   <SplitView.Top>{map}</SplitView.Top>
 *   <SplitView.DragArea>
 *     <SplitView.Handle />
 *   </SplitView.DragArea>
 *   <SplitView.Bottom>{list}</SplitView.Bottom>
 * </SplitView>
 * ```
 *
 * The snapping is the difference between this and a free-resize split. A layout
 * with a few right answers — a map over a list, a preview over an editor — is
 * better served by a control that lands on one of them than by one that lets
 * the reader stop three points short of it and live with the result.
 *
 * Snap points are ratios of the room the two panes share, so they mean the same
 * thing on any screen and a rotation costs no re-measuring. That room is the
 * container minus the drag area, which takes real layout height: half means
 * half of what is actually divisible rather than half of a number the seam then
 * eats into.
 *
 * The split view has no height of its own — give it one, or put it in something
 * that has one, or it collapses and takes its panes with it.
 *
 * Dragging runs on the UI thread. `onSnap` fires once the pane has settled
 * rather than on every frame, because a layout that round-trips through React
 * sixty times a second is the one thing that makes this feel slow.
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { tv } from 'tailwind-variants';
import { selectionTick } from '../../utils/haptics';
import {
  DEFAULT_MIN_HEIGHT,
  clamp,
  nearestSnapIndex,
  normalizeSnapIndex,
  resolveLength,
  resolveSnapPoints,
} from './split-view-math';

/** Settles the pane onto a snap point without overshooting past its limits. */
const SPRING = {
  damping: 25,
  stiffness: 300,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
} as const;

/** How much the grip grows while it is being dragged. */
const GRIP_SPRING = { damping: 18, stiffness: 300, mass: 0.8 } as const;

const splitViewVariants = tv({
  slots: {
    root: 'w-full flex-col overflow-hidden',
    top: 'w-full overflow-hidden',
    bottom: 'w-full flex-1 overflow-hidden',
    dragArea: 'w-full items-center justify-center py-2',
    handle: 'h-1 w-10 rounded-full bg-muted-foreground/30',
  },
});

interface SplitViewContextValue {
  /** The top pane's height in points. Written by drags, read by both panes. */
  topHeight: SharedValue<number>;
  /** True while a finger is on the seam. */
  dragging: SharedValue<boolean>;
  /** Snap heights in points, in order. Empty until the container is measured. */
  points: number[];
  minPx: number;
  maxPx: number;
  room: number;
  measured: boolean;
  disabled: boolean;
  snapIndex: number;
  animate: boolean;
  snapTo: (index: number) => void;
  measureDragArea: (height: number) => void;
  dragAreaHeight: number;
}

const SplitViewContext = createContext<SplitViewContextValue | null>(null);

function useSplitViewContext(component: string): SplitViewContextValue {
  const context = useContext(SplitViewContext);
  if (!context) throw new Error(`${component} must be used within a <SplitView>`);
  return context;
}

/**
 * Reads the live layout from inside a split view, and moves the seam.
 *
 * `topHeight` is a shared value on the UI thread — read it in a worklet, not in
 * render, where it is only ever the number the last commit happened to see.
 */
export function useSplitView() {
  return useSplitViewContext('useSplitView');
}

export interface SplitViewProps extends ViewProps {
  className?: string;
  /**
   * Heights the seam settles on. A number at or below `1` is a fraction of the
   * room the panes share; anything larger is points. Defaults to
   * `[0.2, 0.5, 0.8]`.
   */
  snapPoints?: readonly number[];
  /** Smallest the top pane may get, as a fraction or in points. Defaults to `100`. */
  minHeight?: number;
  /**
   * Largest the top pane may get, as a fraction or in points. A negative number
   * is measured back from the bottom — `-80` leaves eighty points for the other
   * pane. Defaults to all the room there is.
   */
  maxHeight?: number;
  /** Which snap point the seam starts at when uncontrolled. Defaults to `1`. */
  defaultSnapIndex?: number;
  /** Controlled snap index. Pair it with `onSnapIndexChange`. */
  snapIndex?: number;
  /** Called with the index the seam settled on. */
  onSnapIndexChange?: (index: number) => void;
  /** Called once the pane has settled, with the index and its height in points. */
  onSnap?: (index: number, topHeight: number) => void;
  /** Freezes the seam. The panes keep the heights they have. */
  disabled?: boolean;
  /** Springs to the starting snap point on mount instead of opening at it. */
  animateOnMount?: boolean;
  children?: ReactNode;
}

function SplitViewRoot({
  className,
  snapPoints,
  minHeight,
  maxHeight,
  defaultSnapIndex = 1,
  snapIndex: snapIndexProp,
  onSnapIndexChange,
  onSnap,
  disabled = false,
  animateOnMount = false,
  children,
  onLayout,
  ...props
}: SplitViewProps) {
  const { root } = splitViewVariants();
  const reducedMotion = useReducedMotion();
  const animate = !reducedMotion;

  const [container, setContainer] = useState(0);
  const [dragAreaHeight, setDragAreaHeight] = useState(0);

  const topHeight = useSharedValue(0);
  const dragging = useSharedValue(false);
  const settled = useRef(false);

  const room = Math.max(container - dragAreaHeight, 0);
  const minPx = clamp(resolveLength(minHeight, room, DEFAULT_MIN_HEIGHT), 0, room);
  const maxPx = clamp(resolveLength(maxHeight, room, room), minPx, room);

  const pointsKey = JSON.stringify([snapPoints ?? null, room, minPx, maxPx]);
  const points = useMemo(
    () => (room > 0 ? resolveSnapPoints(snapPoints, room, minPx, maxPx) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pointsKey]
  );

  const controlled = snapIndexProp !== undefined;
  const [internalIndex, setInternalIndex] = useState(() =>
    normalizeSnapIndex(defaultSnapIndex, 1)
  );
  const snapIndex = normalizeSnapIndex(
    controlled ? snapIndexProp : internalIndex,
    points.length || 1
  );

  const onSnapRef = useRef(onSnap);
  onSnapRef.current = onSnap;

  /** Reports a settled pane once, from the spring's own completion. */
  const report = useCallback((index: number, height: number) => {
    onSnapRef.current?.(index, height);
  }, []);

  /*
   * Moving the seam is one function whether a drag, a press or a screen reader
   * asked for it — the alternative is three places that each have to remember
   * to spring, to report, and to leave a controlled caller's index alone.
   */
  const moveTo = useCallback(
    (index: number, options?: { animated?: boolean }) => {
      const target = points[index];
      if (target === undefined) return;

      if (!controlled) setInternalIndex(index);
      onSnapIndexChange?.(index);

      const finish = () => report(index, target);
      if (options?.animated === false || !animate) {
        topHeight.value = target;
        finish();
        return;
      }
      topHeight.value = withSpring(target, SPRING, (finished) => {
        'worklet';
        if (finished) runOnJS(finish)();
      });
    },
    [animate, controlled, onSnapIndexChange, points, report, topHeight]
  );

  const snapTo = useCallback((index: number) => moveTo(index), [moveTo]);

  /*
   * The first frame with a measurement is the only one that may place the pane
   * without animating: there is nothing on screen yet to animate from, and a
   * spring out of zero reads as the layout arriving broken and correcting
   * itself. `animateOnMount` is for when that arrival is the point.
   */
  useEffect(() => {
    const target = points[snapIndex];
    if (target === undefined) return;

    if (!settled.current) {
      settled.current = true;
      if (!animateOnMount) {
        topHeight.value = target;
        report(snapIndex, target);
        return;
      }
    }

    if (dragging.value) return;
    if (!animate) {
      topHeight.value = target;
      report(snapIndex, target);
      return;
    }
    topHeight.value = withSpring(target, SPRING);
    // Only when the resolved layout moves — a re-render that changes nothing
    // must not restart a spring the reader is watching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, snapIndex, animate, animateOnMount]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setContainer(event.nativeEvent.layout.height);
      onLayout?.(event);
    },
    [onLayout]
  );

  const measureDragArea = useCallback((height: number) => {
    setDragAreaHeight((current) => (Math.abs(current - height) < 0.5 ? current : height));
  }, []);

  const context = useMemo<SplitViewContextValue>(
    () => ({
      topHeight,
      dragging,
      points,
      minPx,
      maxPx,
      room,
      measured: room > 0,
      disabled,
      snapIndex,
      animate,
      snapTo,
      measureDragArea,
      dragAreaHeight,
    }),
    [
      topHeight,
      dragging,
      points,
      minPx,
      maxPx,
      room,
      disabled,
      snapIndex,
      animate,
      snapTo,
      measureDragArea,
      dragAreaHeight,
    ]
  );

  return (
    <SplitViewContext.Provider value={context}>
      <View className={root({ className })} onLayout={handleLayout} {...props}>
        {children}
      </View>
    </SplitViewContext.Provider>
  );
}

export interface SplitViewPaneProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/**
 * The upper pane.
 *
 * It clips what is inside it, so a pane dragged short hides its content rather
 * than pushing it through the seam. Content that outgrows it is the caller's to
 * scroll — put a `ScrollView` in here and it behaves like any other scroller in
 * a box whose height changes.
 */
function SplitViewTop({ className, children, style, ...props }: SplitViewPaneProps) {
  const context = useSplitViewContext('SplitView.Top');
  const { top } = splitViewVariants();

  const animatedStyle = useAnimatedStyle(() => ({
    height: context.topHeight.value,
  }));

  /*
   * Before the container is measured there is no height to give, and a pane
   * sized from a container of zero is a pane nobody can see. A flex basis of
   * zero and a grow of one carries the first frame instead, so the pane is
   * already the shape it will be when the measurement lands.
   */
  const unmeasured = { flexGrow: 1, flexBasis: 0, flexShrink: 1 };

  return (
    <Animated.View
      className={top({ className })}
      style={[context.measured ? null : unmeasured, style, animatedStyle]}
      {...props}
    >
      {children}
    </Animated.View>
  );
}

/**
 * The lower pane. It takes exactly the room the upper one gave up, with no
 * second measurement — which is what keeps the two adding to the container on
 * every frame of a drag rather than only at rest.
 */
function SplitViewBottom({ className, children, ...props }: SplitViewPaneProps) {
  useSplitViewContext('SplitView.Bottom');
  const { bottom } = splitViewVariants();

  return (
    <View className={bottom({ className })} {...props}>
      {children}
    </View>
  );
}

export interface SplitViewDragAreaProps extends ViewProps {
  className?: string;
  /** What a screen reader calls the seam. Defaults to "Resize panes". */
  accessibilityLabel?: string;
  children?: ReactNode;
}

/**
 * The seam, and the target for the drag.
 *
 * It takes real layout height rather than floating over the panes, because that
 * height is what the snap points are fractions of: a finger-sized target that
 * did not take room would make `0.5` mean half of a number the seam then ate
 * into. Give it padding to make the target larger — the room it takes is
 * measured, so the arithmetic follows.
 */
function SplitViewDragArea({
  className,
  accessibilityLabel = 'Resize panes',
  children,
  onLayout,
  ...props
}: SplitViewDragAreaProps) {
  const context = useSplitViewContext('SplitView.DragArea');
  const { dragArea } = splitViewVariants();
  const { topHeight, dragging, points, minPx, maxPx, room, disabled, snapTo } = context;

  const start = useSharedValue(0);
  const landed = useSharedValue(-1);

  const settle = useCallback((index: number) => snapTo(index), [snapTo]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled && points.length > 0)
        // The seam only answers to the axis it moves on, so a split view inside
        // a scroller leaves the scroll alone.
        .activeOffsetY([-8, 8])
        .failOffsetX([-16, 16])
        .onBegin(() => {
          start.value = topHeight.value;
          dragging.value = true;
          landed.value = -1;
        })
        .onUpdate((event) => {
          if (room <= 0) return;
          topHeight.value = clamp(start.value + event.translationY, minPx, maxPx);

          // The moment worth feeling: passing the point the pane would settle
          // at if the finger let go now. It is the only feedback that says a
          // drag has a destination rather than a position.
          const next = nearestSnapIndex(topHeight.value, points, 0, room);
          if (next !== landed.value) {
            landed.value = next;
            runOnJS(selectionTick)();
          }
        })
        .onFinalize((event) => {
          dragging.value = false;
          if (room <= 0) return;
          const index = nearestSnapIndex(
            topHeight.value,
            points,
            event.velocityY ?? 0,
            room
          );
          runOnJS(settle)(index);
        }),
    [disabled, dragging, landed, maxPx, minPx, points, room, settle, start, topHeight]
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      context.measureDragArea(event.nativeEvent.layout.height);
      onLayout?.(event);
    },
    [context, onLayout]
  );

  /*
   * A step moves to the next snap point rather than by a distance, because the
   * snap points are the positions this control has. Announcing a percentage
   * somebody cannot stop at would be describing a different control.
   */
  const step = useCallback(
    (direction: 1 | -1) => {
      const next = clamp(context.snapIndex + direction, 0, points.length - 1);
      if (next !== context.snapIndex) snapTo(next);
    },
    [context.snapIndex, points.length, snapTo]
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        accessibilityValue={{
          min: 0,
          max: Math.max(points.length - 1, 0),
          now: context.snapIndex,
        }}
        accessibilityActions={
          disabled ? undefined : [{ name: 'increment' }, { name: 'decrement' }]
        }
        onAccessibilityAction={
          disabled
            ? undefined
            : (event) => {
                if (event.nativeEvent.actionName === 'increment') step(1);
                else if (event.nativeEvent.actionName === 'decrement') step(-1);
              }
        }
        className={dragArea({ className })}
        onLayout={handleLayout}
        {...props}
      >
        {children}
      </View>
    </GestureDetector>
  );
}

export interface SplitViewHandleProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/**
 * The grip inside the drag area. It grows a little while the seam is moving,
 * which is the only thing on screen saying the gesture was received before the
 * panes have moved far enough to say it themselves.
 */
function SplitViewHandle({ className, children, style, ...props }: SplitViewHandleProps) {
  const context = useSplitViewContext('SplitView.Handle');
  const { handle } = splitViewVariants();
  const { animate } = context;

  const animatedStyle = useAnimatedStyle(() => {
    if (!animate) return { transform: [{ scaleX: 1 }] };
    return {
      transform: [
        { scaleX: withSpring(context.dragging.value ? 1.15 : 1, GRIP_SPRING) },
      ],
    };
  });

  if (children) {
    return (
      <Animated.View style={[style, animatedStyle]} {...props}>
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      className={handle({ className })}
      style={[style, animatedStyle]}
      {...props}
    />
  );
}

SplitViewRoot.displayName = 'SplitView';
SplitViewTop.displayName = 'SplitView.Top';
SplitViewBottom.displayName = 'SplitView.Bottom';
SplitViewDragArea.displayName = 'SplitView.DragArea';
SplitViewHandle.displayName = 'SplitView.Handle';

export const SplitView = Object.assign(SplitViewRoot, {
  Top: SplitViewTop,
  Bottom: SplitViewBottom,
  DragArea: SplitViewDragArea,
  Handle: SplitViewHandle,
});

export {
  DEFAULT_MIN_HEIGHT,
  DEFAULT_SNAP_POINTS,
  nearestSnapIndex,
  normalizeSnapIndex,
  resolveLength,
  resolveSnapPoints,
} from './split-view-math';
