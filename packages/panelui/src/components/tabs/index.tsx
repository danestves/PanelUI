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
  Platform,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type ViewProps,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
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
 *
 * **iOS only, and that is not a compromise.** A transform is a property of the
 * layer the panel is drawn into, so moving it costs nothing per frame however
 * much is inside it. An opacity that changes every frame is not: on Android the
 * panel's view group has no offscreen buffer to fade, so the alpha is pushed
 * down into its children and the whole visible subtree is re-drawn on every
 * frame of the drag. Behind a list that is thirty rows of text and images,
 * which is what a tab panel usually is, that is the difference between a swipe
 * that tracks the finger and one that stutters. iOS fades the layer itself and
 * is unaffected.
 */
const SWIPE_FADE = Platform.OS === 'ios' ? 0.75 : 0;

/**
 * How far off its resting place a panel arriving by a *press* starts, as a
 * share of the panel's width.
 *
 * A press has no finger travel to continue from, so it is given a throw of its
 * own. A swipe does not use this: the panel it hands over to picks up exactly
 * one width from wherever the outgoing one has travelled to — see `setValue`.
 */
const SWIPE_ENTER = 0.3;

/** The arriving panel is springier than the one being dragged back into place. */
const ENTER_SPRING = { damping: 22, stiffness: 240, mass: 0.6 } as const;

/** How far the label's reveal is from its own width, in points — the gap after the icon. */
const LABEL_GAP = 6;

/** Points of room over the measured label, so a rounding error cannot truncate it. */
const LABEL_SLACK = 2;

/** Milliseconds for a tab to open its label, and for the one before it to close. */
const EXPAND_DURATION = 260;

/**
 * A width the ghost label is measured inside.
 *
 * A `Text` measures against the box it is in, and the box it is really in is a
 * pill whose width is the thing being measured. So the copy that gets measured
 * sits in a box wide enough not to be the constraint, and reports the width the
 * label actually wants.
 */
const MEASURE_WIDTH = 400;

export type TabsVariant = 'segmented' | 'underline' | 'pill' | 'expanding';

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
      /*
       * A row of icon pills, one of which is open.
       *
       * Every tab draws its own pill here, so there is no indicator to slide
       * between them — the shape that moves is the open tab itself, widening
       * to let its label out and closing again behind it. An indicator sliding
       * under pills that already have backgrounds would be invisible anyway.
       *
       * The open pill is a step further from the page than the closed ones:
       * lighter in a dark theme, darker in a light one, which is what the
       * tertiary surface token means and why it is used rather than a colour.
       */
      expanding: {
        list: 'gap-1.5',
        trigger: 'rounded-full bg-muted px-3.5 py-2.5',
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
    // A pill is as wide as what is inside it. Equal shares would give every
    // closed tab the width of the open one, which is the layout this variant
    // exists to avoid.
    { variant: 'expanding', class: { trigger: 'flex-none' } },
    { variant: 'expanding', active: true, class: { trigger: 'bg-surface-tertiary' } },
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
   *
   * `expanding` is a row of icon pills where only the selected one is open:
   * it widens to let its label out and closes again behind it. For a short row
   * of destinations that are recognisable by their icons, where the labels
   * would otherwise take the whole width to say things nobody rereads. Give
   * every trigger an `icon` — a closed tab has nothing else.
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
   *
   * **It does not change what is mounted.** Only `keepMounted` decides that,
   * with or without this — a swipe animates between two panels of which one is
   * being unmounted and the other mounted for the first time, exactly as a
   * press does. What it does change is that the mount now happens *while
   * something is moving*, so a panel that is slow to build stops being a pause
   * before it appears and starts being a stutter in the movement. If a swipe
   * feels heavier than a press on the same tab set, the panel is expensive to
   * mount; `keepMounted` is the answer, not turning this off.
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

  /*
   * The two things `setValue` reads that change on every switch, held where
   * reading them does not make it a new function.
   *
   * With them in the dependency list, changing tab produced a new `setValue`,
   * therefore a new context, therefore a new `step`, therefore a new pan
   * gesture — which detaches and re-attaches the native recogniser on the same
   * commit that mounts the arriving panel's contents. The busiest frame of the
   * interaction was doing the one piece of work that had no reason to be there.
   */
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const valueRef = useRef(resolvedValue);
  valueRef.current = resolvedValue;

  const setValue = useCallback(
    (next: string, handover?: SwipeHandover) => {
      const tabs = tabsRef.current;
      const resolvedValue = valueRef.current;

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
             * whole panel's width from wherever the outgoing one has got to —
             * which is where it *would* have been all along, had both been
             * mounted. Read live rather than captured, because the outgoing
             * panel is still travelling while this runs: adding to the current
             * displacement rather than replacing it is the whole difference
             * between one continuous movement and a jump at the moment the
             * arriving panel finishes mounting.
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
    [isControlled, onValueChange, swipeable, sign, swipeOffset, panelWidth]
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
      {/* Nothing to slide: in `expanding` every tab draws its own pill, and the
          open one is the shape that moves. */}
      {variant === 'expanding' ? null : <TabsIndicator />}
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
  /**
   * Rendered before the label. Required by `variant="expanding"`, where it is
   * the only thing a closed tab has left to identify it by.
   */
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

  if (context.variant === 'expanding') {
    return (
      <ExpandingTrigger
        active={active}
        disabled={disabled}
        icon={icon}
        badge={badge}
        labelClassName={slots.label()}
        className={cn(slots.trigger(), className)}
        onLayout={handleLayout}
        onPress={() => context.setValue(value)}
      >
        {children}
      </ExpandingTrigger>
    );
  }

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

/**
 * A tab that is an icon until it is selected, and then an icon and its label.
 *
 * The label is never unmounted, only closed over. Two reasons, and both matter:
 * a screen reader walking a row of unlabelled icons has nothing to read out,
 * and a label that mounts on selection has no width to animate *from*, so the
 * pill would jump to its open size and the text would fade in inside it.
 *
 * So the width is animated instead, which needs a number — and the number is
 * the one thing that cannot be measured in place, because the box the label
 * sits in is the box being resized. A second copy, laid out once in a box wide
 * enough not to constrain it, reports the width and is never seen.
 */
function ExpandingTrigger({
  active,
  disabled,
  icon,
  badge,
  className,
  labelClassName,
  onLayout,
  onPress,
  children,
}: {
  active: boolean;
  disabled: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
  className: string;
  labelClassName: string;
  onLayout: (event: LayoutChangeEvent) => void;
  onPress: () => void;
  children: ReactNode;
}) {
  const [labelWidth, setLabelWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const open = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      open.value = active ? 1 : 0;
      return;
    }
    /*
     * A curve, not a spring.
     *
     * This animates a *width*, so every frame of it is a layout pass — and the
     * row is centred, so every other pill moves with it. A spring overshoots
     * past its target and settles back, which on a box that is clipping text
     * means the last word slides in, out and in again, and the whole row
     * wobbles with it. The curve leaves quickly and arrives slowly, and it
     * arrives once.
     */
    open.value = withTiming(active ? 1 : 0, {
      duration: EXPAND_DURATION,
      easing: Easing.bezier(0.2, 0, 0, 1),
    });
  }, [active, reducedMotion, open]);

  const reveal = useAnimatedStyle(() => ({
    width: (labelWidth + LABEL_GAP) * open.value,
    /*
     * Behind the width, not ahead of it. Text drawn into a box narrower than
     * itself is text with its end cut off, and doing that on purpose for the
     * first half of the animation is the difference between a label arriving
     * and a label being wiped on.
     */
    opacity: interpolate(open.value, [0.35, 0.9], [0, 1], Extrapolation.CLAMP),
  }));

  const label = textChildren(children, (text) => (
    <Text size="sm" weight="medium" numberOfLines={1} className={labelClassName}>
      {text}
    </Text>
  ));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      // The label may be closed to nothing, and a tab announced as an unlabelled
      // icon is a tab nobody can choose.
      accessibilityLabel={typeof children === 'string' ? children : undefined}
      disabled={disabled}
      onPress={onPress}
      onLayout={onLayout}
      className={cn('flex-row items-center', className)}
    >
      {icon}
      <Animated.View style={[{ overflow: 'hidden' }, reveal]}>
        {/*
         * Pinned to the measured width so the text does not reflow as the box
         * around it closes — a label that rewraps on its way out reads as a
         * glitch rather than as a reveal.
         *
         * The gap after the icon is padding on this box, so it has to be added
         * to the width rather than taken out of it. Set to the measured width
         * alone, the padding comes off the inside and the label is handed six
         * points less than it asked for, which a single-line `Text` answers by
         * truncating: "Inbox" arrives as "Inbo…" and stays that way.
         */}
        <View style={{ width: labelWidth + LABEL_GAP, paddingStart: LABEL_GAP }}>
          {label}
        </View>
      </Animated.View>
      {/* Measured once, never seen, and out of the layout so it cannot widen
          the pill it is measuring. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', opacity: 0, width: MEASURE_WIDTH }}
      >
        <View
          style={{ alignSelf: 'flex-start' }}
          onLayout={(event: LayoutChangeEvent) => {
            /*
             * Rounded up and given a couple of points over.
             *
             * The measurement and the box it is put back into are two different
             * layout passes, and a fraction of a point between them is enough
             * for a single-line `Text` to decide it does not fit and truncate —
             * which shows up as a label permanently missing its last letter.
             */
            const measured = Math.ceil(event.nativeEvent.layout.width) + LABEL_SLACK;
            if (measured > LABEL_SLACK && measured !== labelWidth) {
              setLabelWidth(measured);
            }
          }}
        >
          {label}
        </View>
      </View>
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

  /*
   * Same reason as `setValue` on the root: `step` is reached through the pan
   * gesture, and a `step` that changes identity on every switch rebuilds the
   * gesture on every switch. The two facts it needs are read at call time
   * instead, which is when they are wanted anyway.
   */
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const valueRef = useRef(value);
  valueRef.current = value;

  const step = useCallback(
    (delta: number, velocity: number) => {
      const list = tabsRef.current;
      const from = list.indexOf(valueRef.current);
      const next = list[from + delta];
      if (next) setValue(next, { velocity });
    },
    [setValue]
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
            const delta = fast ? (speed < 0 ? 1 : -1) : travel < 0 ? 1 : -1;

            /*
             * The outgoing panel carries on off the edge on the UI thread,
             * immediately, rather than waiting to be told what happened.
             *
             * It used to hold wherever the finger left it until `setValue`
             * landed — which is fine when React commits in a frame, and is a
             * visible freeze when the arriving panel is expensive to mount, a
             * list of any size being the usual case. The panel appeared to
             * stick to the screen for exactly as long as the JS thread was
             * busy, which reads as the swipe having dropped the gesture.
             *
             * `setValue` still places the arriving panel *relative* to this
             * one, reading the offset live at commit time, so continuing the
             * movement here does not desynchronise the handover: the panel
             * that arrives is one width from wherever this one has got to,
             * whenever that turns out to be.
             */
            offset.value = withSpring(-delta * sign * width.value, {
              ...ENTER_SPRING,
              velocity: event.velocityX,
            });

            runOnJS(step)(delta, event.velocityX);
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
    // No `opacity` key at all when there is no fade, rather than a constant 1.
    // Declaring it would still mark the property as animated and hand the view
    // an alpha to composite every frame — the cost this is avoiding.
    if (!SWIPE_FADE) return { transform: [{ translateX: offset.value }] };

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
      /*
       * The follow style goes on the panel that is moving, and only that one.
       * Under `keepMounted` every other panel is `display: none` and cannot be
       * seen to move — but an animated style still subscribes them all to the
       * offset, so a five-tab set ran five mappers per frame to reposition four
       * views nobody was looking at.
       */
      style={[!active && { display: 'none' }, swipeable && active && followStyle, style]}
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
