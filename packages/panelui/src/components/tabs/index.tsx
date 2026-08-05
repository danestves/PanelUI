/**
 * Tabs — segmented navigation between panels.
 *
 * The active tab is marked by one indicator that slides between measured
 * trigger positions rather than by a style on each trigger. That is what makes
 * the movement continuous: there is a single thing travelling, so a switch two
 * tabs away reads as one gesture instead of two states swapping.
 *
 * ```tsx
 * <Tabs defaultValue="account">
 *   <Tabs.List>
 *     <Tabs.Trigger value="account">Account</Tabs.Trigger>
 *     <Tabs.Trigger value="team" badge={<Badge>3</Badge>}>Team</Tabs.Trigger>
 *   </Tabs.List>
 *   <Tabs.Content value="account">…</Tabs.Content>
 * </Tabs>
 * ```
 *
 * **Swiping.** Only the visible panel is mounted, so a drag has nothing behind
 * it to reveal. The panel still tracks the finger one to one and dims as it
 * goes, and the panel arriving comes back up through the same fade — the
 * movement carries the change and the dissolve covers the gap. On release the
 * arriving panel picks up a whole panel's width from wherever the outgoing one
 * was let go, so the two views draw one continuous movement between them. The
 * displacement lives on the root for exactly that reason: a value belonging to
 * either panel would be destroyed at the handover.
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
import {
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type ViewProps,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { tv } from 'tailwind-variants';
import { useDirectionSign } from '../../hooks/use-direction';
import { Text, textChildren } from '../../primitives/text';
import { cn } from '../../utils/cn';

const SPRING = { damping: 24, stiffness: 300, mass: 0.7 } as const;

/**
 * How far sideways a finger must travel before the panel takes the gesture
 * from whatever is scrolling above it, and how far up or down before it gives
 * up on it. The window between them is what lets a swipe start inside a
 * vertically scrolling panel without either gesture stealing the other.
 */
const SWIPE_ACTIVATE_X = 12;
const SWIPE_FAIL_Y = 8;

/** A swipe past this share of the panel's width changes tab on release. */
const SWIPE_DISTANCE_RATIO = 0.25;
/** …or past this speed, however short it was. */
const SWIPE_VELOCITY = 500;

/**
 * How much of the finger's travel the panel follows at the ends of the row,
 * where there is nowhere for it to go. Everywhere else it follows all of it.
 */
const SWIPE_RESISTANCE_AT_END = 0.16;

/**
 * How far the panel fades as it is dragged, at a full panel's width.
 *
 * Tracking the finger one to one leaves the space behind the panel empty,
 * because the panels are separate views and only the visible one is mounted.
 * Dimming as it goes is what keeps that from reading as a hole punched in the
 * card: a panel on its way out is on its way out, and the one arriving comes
 * back up through the same fade. The two together read as a dissolve carried
 * by the movement, rather than as a gap between two slides.
 */
const SWIPE_FADE = 0.75;

/**
 * How far off its resting place a panel arriving by a *press* starts, as a
 * share of the panel's width.
 *
 * A press has no finger travel to continue from, so it is given a throw of its
 * own. A swipe does not use this: the panel it hands over to picks up exactly
 * where the outgoing one was let go — see `setValue`.
 */
const SWIPE_ENTER = 0.3;

/** The arriving panel is springier than the one being dragged back into place. */
const ENTER_SPRING = { damping: 22, stiffness: 240, mass: 0.6 } as const;

export type TabsVariant = 'segmented' | 'underline' | 'pill';

const tabsVariants = tv({
  slots: {
    list: 'flex-row',
    indicator: 'absolute left-0',
    trigger: 'items-center justify-center',
    label: '',
  },
  variants: {
    variant: {
      // A raised chip travelling inside a recessed track.
      segmented: {
        list: 'rounded-lg bg-muted p-1',
        indicator: 'bottom-1 top-1 rounded-md bg-popover shadow-sm',
        trigger: 'rounded-md py-1.5',
      },
      // No track at all — the indicator is a rule under the active tab, and
      // the row sits on a hairline so inactive tabs still have a baseline.
      underline: {
        list: 'gap-1 border-b border-border',
        indicator: '-bottom-px h-0.5 rounded-full bg-foreground',
        trigger: 'py-2.5',
      },
      // Filled chip on the page rather than in a track; the active label
      // inverts against it.
      pill: {
        list: 'gap-1',
        indicator: 'bottom-0 top-0 rounded-full bg-primary',
        trigger: 'rounded-full py-2',
      },
    },
    active: {
      true: { label: 'text-foreground' },
      false: { label: 'text-muted-foreground' },
    },
    disabled: {
      true: { trigger: 'opacity-[0.44]' },
    },
    /** Intrinsic width in a scroller, equal shares when the row is fixed. */
    scrollable: {
      true: { trigger: 'px-4' },
      false: { trigger: 'flex-1' },
    },
  },
  compoundVariants: [
    { variant: 'pill', active: true, class: { label: 'text-primary-foreground' } },
  ],
  defaultVariants: {
    variant: 'segmented',
    scrollable: false,
  },
});

interface TabLayout {
  x: number;
  width: number;
}

/**
 * What a swipe hands over to the tab it commits to: where the finger left the
 * outgoing panel, and how fast it was still going. Absent when the tab was
 * changed by pressing a trigger, which has neither.
 */
interface SwipeHandover {
  /** Points per second at the moment of release, in the panel's own axis. */
  velocity: number;
}

interface TabsContextValue {
  value: string;
  setValue: (value: string, handover?: SwipeHandover) => void;
  registerLayout: (value: string, layout: TabLayout) => void;
  layouts: Record<string, TabLayout>;
  /**
   * Every tab in the order it was declared, which is the order a swipe moves
   * through them. Kept separately from `layouts` because that is a map keyed
   * by value and its order is whatever the layout pass happened to produce —
   * and because under RTL the leftmost trigger is the last one, so a position
   * cannot stand in for a place in the sequence either.
   */
  tabs: string[];
  registerTab: (value: string) => void;
  unregisterTab: (value: string) => void;
  variant: TabsVariant;
  scrollable: boolean;
  setScrollable: (scrollable: boolean) => void;
  keepMounted: boolean;
  swipeable: boolean;
  /**
   * How far the visible panel is displaced from its resting place, in points.
   *
   * It lives on the root rather than on a panel because the outgoing and
   * incoming panels are different views, and a value that belonged to either
   * of them would be destroyed at the moment of the handover. Shared, the
   * displacement survives it: the panel being let go and the panel arriving
   * are one continuous movement, drawn by two views in turn.
   */
  swipeOffset: SharedValue<number>;
  /** The visible panel's measured width, which the throw above is a share of. */
  panelWidth: SharedValue<number>;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Tabs>`);
  }
  return context;
}

export interface TabsProps extends ViewProps {
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue: string;
  /**
   * `segmented` is a chip travelling inside a recessed track, `underline` is a
   * rule under the active tab, `pill` is a filled chip on the page.
   */
  variant?: TabsVariant;
  /**
   * Keep inactive panels mounted and hidden instead of unmounting them, so a
   * scroll position or a half-filled form survives a switch away and back.
   * Costs the render of every panel up front.
   */
  keepMounted?: boolean;
  /**
   * Move between tabs by dragging sideways on the panel, as well as by
   * pressing the triggers.
   *
   * Off by default, because a panel is allowed to contain something that
   * already wants a horizontal drag — a carousel, a slider, a row that swipes
   * open — and the two cannot both have it. Turn it on for panels of ordinary
   * scrolling content, where it is the gesture people try first.
   */
  swipeable?: boolean;
  children: ReactNode;
}

function TabsRoot({
  className,
  value,
  onValueChange,
  defaultValue,
  variant = 'segmented',
  keepMounted = false,
  swipeable = false,
  children,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [layouts, setLayouts] = useState<Record<string, TabLayout>>({});
  const [tabs, setTabs] = useState<string[]>([]);
  const swipeOffset = useSharedValue(0);
  const panelWidth = useSharedValue(0);
  const sign = useDirectionSign();
  // Published by the List rather than the root, because it is the List that
  // decides whether it scrolls — but the Triggers below it need to know.
  const [scrollable, setScrollable] = useState(false);
  const isControlled = value !== undefined;
  const resolvedValue = isControlled ? value : internalValue;

  const setValue = useCallback(
    (next: string, handover?: SwipeHandover) => {
      /*
       * The arriving panel starts on the side it is arriving from, and travels
       * in. Done here rather than in the panel because only the root knows
       * both the tab being left and the tab being gone to — a panel knows
       * which one it is, not which one it replaced — and because a tab changed
       * by pressing a trigger deserves the same movement as one changed by
       * swiping to it. Without it the two read as different features.
       */
      if (swipeable) {
        const from = tabs.indexOf(resolvedValue);
        const to = tabs.indexOf(next);
        if (from !== -1 && to !== -1 && from !== to) {
          const direction = to > from ? 1 : -1;

          if (handover) {
            /*
             * A swipe hands over mid-movement, so the arriving panel starts a
             * whole panel's width from wherever the outgoing one was let go —
             * which is where it *would* have been all along, had both been
             * mounted. Adding to the displacement rather than replacing it is
             * the entire difference between one continuous movement and a jump
             * at the moment the finger lifts.
             */
            swipeOffset.value += direction * sign * panelWidth.value;
            swipeOffset.value = withSpring(0, {
              ...ENTER_SPRING,
              // Carried across too, so a flick keeps its speed instead of
              // stopping dead and starting again from rest.
              velocity: handover.velocity,
            });
          } else {
            swipeOffset.value = direction * sign * panelWidth.value * SWIPE_ENTER;
            swipeOffset.value = withSpring(0, ENTER_SPRING);
          }
        }
      }

      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [
      isControlled,
      onValueChange,
      swipeable,
      tabs,
      resolvedValue,
      sign,
      swipeOffset,
      panelWidth,
    ]
  );

  const registerLayout = useCallback((tab: string, layout: TabLayout) => {
    setLayouts((current) => {
      const existing = current[tab];
      if (existing && existing.x === layout.x && existing.width === layout.width) {
        return current;
      }
      return { ...current, [tab]: layout };
    });
  }, []);

  /*
   * Triggers add themselves on mount, so the order is React's child order —
   * the order they are written in, which is the order they are read in.
   */
  const registerTab = useCallback((tab: string) => {
    setTabs((current) => (current.includes(tab) ? current : [...current, tab]));
  }, []);

  const unregisterTab = useCallback((tab: string) => {
    setTabs((current) => current.filter((entry) => entry !== tab));
  }, []);

  const context = useMemo(
    () => ({
      value: resolvedValue,
      setValue,
      registerLayout,
      layouts,
      tabs,
      registerTab,
      unregisterTab,
      variant,
      scrollable,
      setScrollable,
      keepMounted,
      swipeable,
      swipeOffset,
      panelWidth,
    }),
    [
      resolvedValue,
      setValue,
      registerLayout,
      layouts,
      tabs,
      registerTab,
      unregisterTab,
      variant,
      scrollable,
      keepMounted,
      swipeable,
      swipeOffset,
      panelWidth,
    ]
  );

  return (
    <TabsContext.Provider value={context}>
      <View className={cn('gap-3', className)} {...props}>
        {textChildren(children)}
      </View>
    </TabsContext.Provider>
  );
}

function TabsIndicator() {
  const { value, layouts, variant } = useTabs('Tabs.List');
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const initialized = useSharedValue(0);

  const layout = layouts[value];
  const { indicator } = tabsVariants({ variant });

  // In an effect, not the render body: touching a shared value during render
  // is a Reanimated strict-mode violation, and the write can be lost or
  // duplicated when React re-renders.
  useEffect(() => {
    if (!layout) return;

    if (initialized.value === 0) {
      // First measurement snaps into place; there is nothing to animate from.
      x.value = layout.x;
      width.value = layout.width;
      initialized.value = 1;
    } else {
      x.value = withSpring(layout.x, SPRING);
      width.value = withSpring(layout.width, SPRING);
    }
  }, [layout?.x, layout?.width, x, width, initialized, layout]);

  const style = useAnimatedStyle(() => ({
    opacity: initialized.value,
    transform: [{ translateX: x.value }],
    width: width.value,
  }));

  return <Animated.View style={style} className={indicator()} />;
}

export interface TabsListProps extends ViewProps {
  className?: string;
  /**
   * Lay the triggers out at their natural widths inside a horizontal scroller
   * instead of splitting the row between them. For more tabs than fit — which
   * a fixed row answers by crushing every label.
   */
  scrollable?: boolean;
  children: ReactNode;
}

function TabsList({ className, scrollable = false, children, ...props }: TabsListProps) {
  const { variant, setScrollable, value, layouts } = useTabs('Tabs.List');
  const { list } = tabsVariants({ variant });
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    setScrollable(scrollable);
  }, [scrollable, setScrollable]);

  // Bring the active tab into view when it changes from elsewhere — a
  // controlled switch, or a swipe on the panel below.
  const activeLayout = layouts[value];
  useEffect(() => {
    if (!scrollable || !activeLayout) return;
    scroller.current?.scrollTo({
      // Land the tab a little in from the edge rather than flush against it,
      // so it does not read as the last one in the row.
      x: Math.max(activeLayout.x - 24, 0),
      animated: true,
    });
  }, [scrollable, activeLayout?.x, activeLayout]);

  const row = (
    <View accessibilityRole="tablist" className={cn(list(), className)} {...props}>
      <TabsIndicator />
      {textChildren(children)}
    </View>
  );

  if (!scrollable) return row;

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      // The row measures itself, and the indicator is positioned against it,
      // so the scroller must not stretch it to the viewport width.
      contentContainerStyle={{ flexGrow: 0 }}
    >
      {row}
    </ScrollView>
  );
}

export interface TabsTriggerProps {
  className?: string;
  value: string;
  /** Rendered before the label. */
  icon?: ReactNode;
  /** Rendered after the label — a count, a dot, a status. */
  badge?: ReactNode;
  /** Unselectable, dimmed, and announced as disabled. */
  disabled?: boolean;
  children: ReactNode;
}

function TabsTrigger({
  className,
  value,
  icon,
  badge,
  disabled = false,
  children,
}: TabsTriggerProps) {
  const context = useTabs('Tabs.Trigger');
  const active = context.value === value;
  const slots = tabsVariants({
    variant: context.variant,
    active,
    disabled,
    scrollable: context.scrollable,
  });

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      context.registerLayout(value, { x, width });
    },
    [context, value]
  );

  // Separate from the layout registration above, and earlier than it: a swipe
  // needs to know the sequence, which is known at mount, not the positions,
  // which are not known until the row has been laid out.
  const { registerTab, unregisterTab } = context;
  useEffect(() => {
    registerTab(value);
    return () => unregisterTab(value);
  }, [value, registerTab, unregisterTab]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={() => context.setValue(value)}
      onLayout={handleLayout}
      className={cn(slots.trigger(), (icon || badge) && 'flex-row gap-1.5', className)}
    >
      {icon}
      {textChildren(children, (text) => (
        <Text size="sm" weight="medium" className={slots.label()}>
          {text}
        </Text>
      ))}
      {badge}
    </Pressable>
  );
}

export interface TabsContentProps extends ViewProps {
  className?: string;
  value: string;
  children: ReactNode;
}

function TabsContent({ className, value, children, style, ...props }: TabsContentProps) {
  const context = useTabs('Tabs.Content');
  const active = context.value === value;
  const {
    tabs,
    setValue,
    swipeable,
    swipeOffset: offset,
    panelWidth: width,
  } = context;
  const sign = useDirectionSign();
  // Read on the UI thread while the finger is down, so the resistance at the
  // ends is known without a round trip to JavaScript.
  const index = useSharedValue(0);
  const count = useSharedValue(0);

  const position = tabs.indexOf(value);
  useEffect(() => {
    index.value = position;
    count.value = tabs.length;
  }, [position, tabs.length, index, count]);

  const step = useCallback(
    (delta: number, velocity: number) => {
      const from = tabs.indexOf(value);
      const next = tabs[from + delta];
      if (next) setValue(next, { velocity });
    },
    [tabs, value, setValue]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Sideways past the threshold takes the gesture; any real vertical
        // travel hands it back, so a panel that scrolls still scrolls.
        .activeOffsetX([-SWIPE_ACTIVATE_X, SWIPE_ACTIVATE_X])
        .failOffsetY([-SWIPE_FAIL_Y, SWIPE_FAIL_Y])
        .onUpdate((event) => {
          // Positive is "towards the previous tab" in reading order, which is
          // rightwards under LTR and leftwards under RTL.
          const travel = event.translationX * sign;
          const atEnd =
            (travel > 0 && index.value === 0) ||
            (travel < 0 && index.value >= count.value - 1);
          /*
           * One to one, except at the ends. The panel is under the finger for
           * the whole of the drag, which is what lets the handover on release
           * continue the movement rather than restart it — and a panel that
           * moved a third as far as the finger never felt attached to it in
           * the first place.
           */
          offset.value = atEnd
            ? event.translationX * SWIPE_RESISTANCE_AT_END
            : event.translationX;
        })
        .onEnd((event) => {
          const travel = event.translationX * sign;
          const speed = event.velocityX * sign;
          const far = Math.abs(travel) > width.value * SWIPE_DISTANCE_RATIO;
          const fast = Math.abs(speed) > SWIPE_VELOCITY;
          const atEnd =
            (travel > 0 && index.value === 0) ||
            (travel < 0 && index.value >= count.value - 1);

          if ((far || fast) && !atEnd) {
            // Distance and speed can disagree — a flick back the way it came
            // reads as a cancel — so the direction comes from whichever of the
            // two crossed its threshold, speed first.
            //
            // No spring back to zero here: `setValue` on the root carries the
            // displacement across to the arriving panel, and springing to rest
            // first would undo it a frame before it happens.
            runOnJS(step)(
              fast ? (speed < 0 ? 1 : -1) : travel < 0 ? 1 : -1,
              event.velocityX
            );
            return;
          }

          // Nothing changed hands, so this panel simply comes back — with the
          // speed it was let go at, so a cancelled flick decelerates rather
          // than stopping and being pulled.
          offset.value = withSpring(0, { ...SPRING, velocity: event.velocityX });
        })
        .onFinalize((_event, success) => {
          // A cancelled gesture never reaches `onEnd`, and would otherwise
          // leave the panel wherever the finger abandoned it.
          if (!success) offset.value = withSpring(0, SPRING);
        }),
    [sign, step, offset, width, index, count]
  );

  const followStyle = useAnimatedStyle(() => {
    const span = width.value || 1;
    const travelled = Math.min(1, Math.abs(offset.value) / span);
    return {
      transform: [{ translateX: offset.value }],
      opacity: 1 - SWIPE_FADE * travelled,
    };
  });

  if (!active && !context.keepMounted) return null;

  /*
   * Hidden rather than unmounted under `keepMounted`, and hidden thoroughly:
   * `display: none` takes it out of layout, and the accessibility props take
   * it out of the reading order too. A screen reader walking through three
   * panels of a tab set it cannot see is worse than no tabs at all.
   */
  const panel = (
    <Animated.View
      /*
       * Only worth animating when the panel is genuinely arriving. A kept
       * panel is already there; fading it in every time it is revealed would
       * undo the point of keeping it.
       *
       * And never alongside the swipe: an entering layout animation owns the
       * view's style for the length of it and will overwrite an animated style
       * touching the same view, so the fade would eat the slide. When panels
       * move, the movement is the entrance.
       */
      entering={context.keepMounted || swipeable ? undefined : FadeIn.duration(150)}
      onLayout={(event: LayoutChangeEvent) => {
        // The thresholds are a share of the panel, not of the screen: a tab
        // set inside a card is narrower than the window, and a quarter of the
        // window would be most of the way across it.
        //
        // Zero is ignored. Every panel reports into the same value, and a
        // kept-mounted one is `display: none` — it measures as nothing, and
        // letting it say so would leave the visible panel with no width.
        const measured = event.nativeEvent.layout.width;
        if (measured > 0) width.value = measured;
      }}
      style={[!active && { display: 'none' }, swipeable && followStyle, style]}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      className={className}
      {...props}
    >
      {textChildren(children)}
    </Animated.View>
  );

  // Only the visible panel carries the gesture. A kept-mounted panel is
  // `display: none` and takes no touches anyway, but attaching a detector to
  // each of them would put several competing recognisers in the same tree.
  if (!swipeable || !active) return panel;

  return <GestureDetector gesture={pan}>{panel}</GestureDetector>;
}

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});
