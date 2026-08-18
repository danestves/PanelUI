/**
 * Timeline — a vertical sequence of events.
 *
 * One `value` on the root says how far the sequence has got, and every item
 * resolves its own state from its `step` against it — completed below, active
 * at, inactive above. Stating it once is the point: a timeline whose items each
 * carried their own state would let you write two active items, or none.
 *
 * State is resolved in JS and handed down through context into `tv()` variants
 * rather than being read off the element, because React Native has no
 * attribute selectors for a stylesheet to key off. `Steps` resolves its states
 * the same way, so the two read as siblings.
 *
 * ## Two orientations
 *
 * Vertical is the default and the ordinary case. Horizontal lays the items out
 * as columns on a rail that runs off the side of the screen and is swiped
 * through, which is the arrangement a long span of time wants: a decade of
 * entries read top to bottom is a page nobody reaches the end of.
 *
 * The objection to a horizontal timeline is that each item gets a fifth of a
 * phone's width, which will not hold a date and a title. The answer is that it
 * does not have to fit — the rail is wider than the screen, and a column takes
 * the width its contents need. An item with nothing on it collapses to a tick,
 * so a quiet stretch compresses and a busy one keeps its room.
 *
 * ```tsx
 * <Timeline variant="icon" value={2}>
 *   <Timeline.Item step={0} tone="info">
 *     <Timeline.Aside>
 *       <Timeline.Date>09:12</Timeline.Date>
 *       <Timeline.Label>Design</Timeline.Label>
 *     </Timeline.Aside>
 *     <Timeline.Indicator><SendIcon /></Timeline.Indicator>
 *     <Timeline.Content>
 *       <Timeline.Header>
 *         <Timeline.Title>Checkout language approved</Timeline.Title>
 *         <Timeline.Trailing>10:18</Timeline.Trailing>
 *       </Timeline.Header>
 *       <Timeline.Description>…</Timeline.Description>
 *     </Timeline.Content>
 *   </Timeline.Item>
 * </Timeline>
 * ```
 */
import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ScrollView, View, type Text as RNText, type ViewProps } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { tv } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { IconColorProvider } from '../../icons';
import { Text, type TextProps, textChildren } from '../../primitives/text';
import { timelineColumnOffsets, timelineColumnWidth } from './timeline-geometry';

export type TimelineVariant = 'dot' | 'icon' | 'numbered' | 'card' | 'compact';
/** Semantic colour for a single event, independent of progress. */
export type TimelineTone = 'default' | 'info' | 'success' | 'warning' | 'danger';
/** Which way the sequence runs. */
export type TimelineOrientation = 'vertical' | 'horizontal';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const TimelineColumnOffsetContext = createContext<number | null>(null);

/*
 * Horizontal geometry.
 *
 * The rail has to land on exactly the same line in every column, and the
 * simplest way to guarantee that is to make the band above it a fixed height
 * rather than to position the rail against measured content. So the aside is
 * `HORIZONTAL_RAIL_TOP` tall in every column, the rail is drawn once across the
 * whole track at that offset, and each column's tick is pulled up by half its
 * own height to sit centred on it.
 */
const HORIZONTAL_RAIL_TOP = 64;
const HORIZONTAL_TICK_HEIGHT = 10;

/**
 * How wide a column is: what it was given, else what its contents ask for.
 *
 * Read by the item to size itself and by the root to build the snap offsets, so
 * it lives here rather than in either — the two disagreeing would put every
 * snap point half a column out.
 */
function itemWidth(props: TimelineItemProps): number {
  let filled = false;
  Children.forEach(props.children, (child) => {
    if (filled || !isValidElement(child)) return;
    const displayName = (child.type as { displayName?: string })?.displayName;
    if (displayName !== 'Timeline.Content') return;
    const inner = (child.props as { children?: ReactNode }).children;
    if (inner !== undefined && inner !== null && inner !== false) filled = true;
  });

  return timelineColumnWidth(props.width, filled);
}

/** Variants whose node is a filled disc rather than an outlined ring. */
const SOLID_VARIANTS: TimelineVariant[] = ['dot', 'card'];

const timelineVariants = tv({
  slots: {
    root: 'w-full flex-col',
    item: 'w-full flex-row gap-3',
    aside: 'w-20 items-end gap-0.5 pt-0.5',
    rail: 'items-center',
    // Flat discs, no ring — the same restraint Steps uses. Rings on every node
    // were most of what made the timeline read as noisy.
    indicator: 'items-center justify-center rounded-full',
    indicatorLabel: 'text-xs font-medium',
    separator: 'w-0.5 flex-1 rounded-full',
    body: 'flex-1 pb-6',
    panel: '',
    header: 'flex-row items-center gap-2',
    heading: 'flex-1 gap-0.5',
    date: 'text-xs font-medium text-muted-foreground',
    label: 'text-xs font-medium',
    meta: 'text-xs text-muted-foreground',
    title: 'text-sm font-medium text-foreground',
    trailing: 'text-xs text-muted-foreground',
    content: 'pt-1 text-sm text-muted-foreground',
    stats: 'mt-2 flex-row gap-6 rounded-xl border border-border px-3.5 py-2.5',
    statLabel: 'text-xs text-muted-foreground',
    statValue: 'text-sm font-medium text-foreground',
  },
  variants: {
    variant: {
      dot: { indicator: 'h-4 w-4' },
      icon: { indicator: 'h-8 w-8' },
      numbered: { indicator: 'h-7 w-7' },
      card: {
        indicator: 'h-4 w-4',
        // The gap stays on `body` so the connector runs through it; the card
        // chrome lives on an inner panel. Putting the border on `body` made
        // consecutive cards sit flush against each other.
        panel: 'rounded-xl border border-border bg-card p-3.5',
      },
      compact: {
        indicator: 'h-6 w-6',
        body: 'flex-1 pb-3',
        title: 'text-base',
      },
    },
    tone: {
      default: {},
      info: { label: 'text-info-foreground' },
      success: { label: 'text-success-foreground' },
      warning: { label: 'text-warning-foreground' },
      danger: { label: 'text-destructive-foreground' },
    },
    completed: {
      true: { separator: 'bg-primary' },
      false: { separator: 'bg-muted' },
    },
    /*
     * Horizontal turns the item from a row into a column and the rail from a
     * line down the side into a line across the top. The aside is a fixed
     * height because that height *is* where the rail sits — see
     * HORIZONTAL_RAIL_TOP — and it is left-aligned rather than right, since a
     * column reads from its own left edge rather than towards a rail beside it.
     */
    orientation: {
      vertical: {},
      horizontal: {
        item: 'w-auto shrink-0 flex-col gap-0 pr-6',
        aside: 'w-auto items-start justify-end gap-1 pb-2 pt-0',
        rail: 'w-full items-start',
        body: 'w-auto flex-none pb-0 pt-5',
        title: 'text-sm',
      },
    },
  },
  defaultVariants: {
    variant: 'dot',
    tone: 'default',
    completed: false,
    orientation: 'vertical',
  },
});

/*
 * Colour rule, matching the Steps component: progress is solid, event kind is
 * tinted.
 *
 * - untoned pending   → bg-muted        (Steps' inactive)
 * - untoned completed → bg-primary      (Steps' completed)
 * - toned             → bg-{tone}-soft, content in the tone's foreground
 *
 * The `-soft` fills are the same tinted tokens Alert uses, so a toned node sits
 * in the same family as the rest of the library instead of shouting in raw
 * brand colour.
 *
 * Nodes that hold something — an icon or a number — get a hairline so they read
 * as a container. The `dot` and `card` discs stay bare: at 16px an outline is
 * most of what made the original look busy. The border therefore lives on the
 * tone class rather than the shared `indicator` slot, so a solid disc cannot
 * pick one up by accident.
 */
const TONE_NODE: Record<TimelineTone, { solid: string; tinted: string }> = {
  default: { solid: 'bg-primary', tinted: 'border border-border bg-muted' },
  info: { solid: 'bg-info', tinted: 'border border-info/32 bg-info-soft' },
  success: { solid: 'bg-success', tinted: 'border border-success/32 bg-success-soft' },
  warning: { solid: 'bg-warning', tinted: 'border border-warning/32 bg-warning-soft' },
  danger: {
    solid: 'bg-destructive',
    tinted: 'border border-destructive/32 bg-destructive-soft',
  },
};

/**
 * The node an incomplete, untoned step gets — bordered when it holds an icon
 * or a number, bare when it is a status disc.
 */
const PENDING_NODE = {
  solid: 'bg-muted',
  tinted: 'border border-border bg-muted',
} as const;

/**
 * CSS variable a tinted node's contents take their colour from. The
 * `-foreground` tokens are the ones tuned to read in both light and dark,
 * which is what sits on a soft tint.
 */
const TONE_ICON_VAR: Record<TimelineTone, string> = {
  default: '--color-primary',
  info: '--color-info-foreground',
  success: '--color-success-foreground',
  warning: '--color-warning-foreground',
  danger: '--color-destructive-foreground',
};

interface TimelineContextValue {
  activeStep: number;
  variant: TimelineVariant;
  orientation: TimelineOrientation;
  /** Horizontal only: where the track has been scrolled to, on the UI thread. */
  scrollX: SharedValue<number>;
  /** Horizontal only: each column's left edge, indexed by its `step`. */
  offsets: number[];
  /** Horizontal only: false when the reader has asked for less movement. */
  animate: boolean;
}

interface TimelineItemContextValue {
  step: number;
  completed: boolean;
  tone: TimelineTone;
  /** False on the last item, so its rail does not trail into nothing. */
  showSeparator: boolean;
  /**
   * Horizontal only: where this column starts, in points, and how wide it is.
   *
   * Both are worked out by the item, and the parts inside it need the same two
   * numbers to fade against the scroll. Passing them down beats deriving them
   * twice from measurements that would then be free to disagree.
   */
  offset: number;
  columnWidth: number;
}

const TimelineContext = createContext<TimelineContextValue | null>(null);
const TimelineItemContext = createContext<TimelineItemContextValue | null>(null);

function useTimeline(component: string): TimelineContextValue {
  const context = useContext(TimelineContext);
  if (!context) throw new Error(`${component} must be used within a <Timeline>`);
  return context;
}

function useTimelineItem(component: string): TimelineItemContextValue {
  const context = useContext(TimelineItemContext);
  if (!context) throw new Error(`${component} must be used within a <Timeline.Item>`);
  return context;
}

export interface TimelineProps extends ViewProps {
  className?: string;
  /** Steps at or below this index render as completed. */
  value?: number;
  variant?: TimelineVariant;
  /**
   * Which way the sequence runs. `horizontal` lays the items out as columns on
   * a rail wider than the screen, swiped through rather than scrolled down.
   */
  orientation?: TimelineOrientation;
  /**
   * Horizontal only: land a flick on a column rather than between two.
   *
   * On by default, because the thing being moved between is a column — stopping
   * halfway shows two half-columns and no whole one.
   */
  snap?: boolean;
  children?: ReactNode;
}

const TimelineRoot = forwardRef<View, TimelineProps>(
  (
    {
      className,
      value = 0,
      variant = 'dot',
      orientation = 'vertical',
      snap = true,
      children,
      ...props
    },
    ref
  ) => {
    const horizontal = orientation === 'horizontal';
    const { root } = timelineVariants({ variant, orientation });
    const reducedMotion = useReducedMotion();
    const scrollX = useSharedValue(0);
    const border = useCSSVariable('--color-border');

    /*
     * The columns' left edges, from the same width rule the items size
     * themselves by. These are the snap points, and they are what an item reads
     * to know how far it is from the reading edge.
     */
    const columns = useMemo(() => {
      if (!horizontal) return { offsets: [], children };
      const items: ReactElement<TimelineItemProps>[] = [];
      Children.forEach(children, (child) => {
        if (isValidElement(child) && child.type === TimelineItem) {
          items.push(child as ReactElement<TimelineItemProps>);
        }
      });
      const offsets = timelineColumnOffsets(items.map((item) => itemWidth(item.props)));
      let position = 0;
      const rendered = Children.map(children, (child) => {
        if (!isValidElement(child) || child.type !== TimelineItem) return child;
        const offset = offsets[position++] ?? 0;
        return (
          <TimelineColumnOffsetContext.Provider value={offset}>
            {child}
          </TimelineColumnOffsetContext.Provider>
        );
      });
      return { offsets, children: rendered };
    }, [children, horizontal]);
    const { offsets } = columns;

    const context = useMemo(
      () => ({
        activeStep: value,
        variant,
        orientation,
        scrollX,
        offsets,
        animate: !reducedMotion,
      }),
      [value, variant, orientation, scrollX, offsets, reducedMotion]
    );

    const onScroll = useAnimatedScrollHandler((event) => {
      scrollX.value = event.contentOffset.x;
    });

    if (!horizontal) {
      return (
        <TimelineContext.Provider value={context}>
          <View ref={ref} className={root({ className })} {...props}>
            {textChildren(children)}
          </View>
        </TimelineContext.Provider>
      );
    }

    return (
      <TimelineContext.Provider value={context}>
        <View ref={ref} className={root({ className })} {...props}>
          <AnimatedScrollView
            horizontal
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToAlignment="start"
            snapToOffsets={snap ? offsets : undefined}
          >
            {/*
              The track sizes itself to its columns, so the rail stretched
              between its own left and right edges runs the whole length of the
              sequence rather than the width of the screen.
            */}
            <View className="relative flex-row">
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: HORIZONTAL_RAIL_TOP,
                  borderTopWidth: 1,
                  // Dashed borders only render at a radius of zero, which this
                  // has, and the rule is the whole element.
                  borderStyle: 'dashed',
                  borderColor: typeof border === 'string' ? border : undefined,
                }}
              />
              {textChildren(columns.children)}
            </View>
          </AnimatedScrollView>
        </View>
      </TimelineContext.Provider>
    );
  }
);
TimelineRoot.displayName = 'Timeline';

export interface TimelineItemProps extends ViewProps {
  className?: string;
  /** Position in the sequence, zero-based. */
  step: number;
  /** Force the completed state regardless of the timeline's value. */
  completed?: boolean;
  /** Colours the node and label — for event kind rather than progress. */
  tone?: TimelineTone;
  /** Set on the final item so its rail stops at the indicator. */
  last?: boolean;
  /**
   * Horizontal only: how wide this column is, in points.
   *
   * Left out, a column that carries content takes a readable width and one that
   * carries none collapses to a tick — so a quiet stretch of the sequence
   * compresses instead of paying full width for nothing. Set it to override
   * that for a column that needs more or less room than its contents suggest.
   * It must be finite and greater than zero; invalid values use the content default.
   */
  width?: number;
  children?: ReactNode;
}

const TimelineItem = forwardRef<View, TimelineItemProps>(
  (
    {
      className,
      step,
      completed,
      tone = 'default',
      last = false,
      width,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const { activeStep, variant, orientation, scrollX, animate } =
      useTimeline('Timeline.Item');
    const columnOffset = useContext(TimelineColumnOffsetContext);
    const isCompleted = completed ?? step <= activeStep;
    const { item } = timelineVariants({
      variant,
      tone,
      completed: isCompleted,
      orientation,
    });
    const horizontal = orientation === 'horizontal';

    const columnWidth = horizontal
      ? itemWidth({ step, width, children } as TimelineItemProps)
      : undefined;
    const offset = columnOffset ?? 0;

    const context = useMemo(
      () => ({
        step,
        completed: isCompleted,
        tone,
        showSeparator: !last,
        offset,
        columnWidth: columnWidth ?? 0,
      }),
      [step, isCompleted, tone, last, offset, columnWidth]
    );

    /*
     * A column recedes as it leaves the reading edge, so the one being read is
     * the one that looks read.
     *
     * One column's width either side, not two: a window wide enough to hold
     * three columns near full strength is a row where nothing is picked out,
     * and picking one out is the whole job. The neighbours stay legible at the
     * far end of it — a timeline is worth reading for what came before and
     * after — they simply stop competing.
     *
     * The scale and the drop are what turn a fade into a focus. Four points and
     * four percent is under the threshold where anybody would call it movement,
     * and over the one where the column at the edge stops looking flat against
     * the rest.
     */
    const columnStyle = useAnimatedStyle(() => {
      if (!horizontal || !animate) return { opacity: 1, transform: [] };
      const distance = Math.abs(scrollX.value - offset);
      const window = Math.max(columnWidth ?? timelineColumnWidth(undefined, true), 1);
      const away = interpolate(distance, [0, window], [0, 1], 'clamp');
      return {
        opacity: 1 - away * 0.4,
        transform: [{ scale: 1 - away * 0.04 }, { translateY: away * 4 }],
      };
    });

    if (!horizontal) {
      return (
        <TimelineItemContext.Provider value={context}>
          <View ref={ref} className={item({ className })} style={style} {...props}>
            {textChildren(children)}
          </View>
        </TimelineItemContext.Provider>
      );
    }

    return (
      <TimelineItemContext.Provider value={context}>
        <Animated.View
          ref={ref}
          className={item({ className })}
          {...props}
          style={[style, { width: columnWidth }, columnStyle]}
        >
          {textChildren(children)}
        </Animated.View>
      </TimelineItemContext.Provider>
    );
  }
);
TimelineItem.displayName = 'Timeline.Item';

/**
 * Right-aligned meta column to the left of the rail — a time, a category, a
 * person. Place it before `Timeline.Indicator`.
 */
const TimelineAside = forwardRef<View, ViewProps & { className?: string }>(
  ({ className, style, ...props }, ref) => {
    const { variant, orientation } = useTimeline('Timeline.Aside');
    const { aside } = timelineVariants({ variant, orientation });

    return (
      <View
        ref={ref}
        className={aside({ className })}
        /*
         * Horizontal: this band's height is where the rail lands, so it is
         * fixed rather than sized to whatever the column happens to put in it.
         * A column with a longer label would otherwise push its own tick below
         * everybody else's and the rail would stop being a line.
         */
        style={
          orientation === 'horizontal'
            ? [{ height: HORIZONTAL_RAIL_TOP }, style]
            : style
        }
        {...props}
      />
    );
  }
);
TimelineAside.displayName = 'Timeline.Aside';

export interface TimelineIndicatorProps extends ViewProps {
  className?: string;
  /** Replaces the default node contents — an icon, say. */
  children?: ReactNode;
}

/**
 * The node on the rail, with the connector running below it.
 *
 * Children are wrapped in an `IconColorProvider` carrying the colour that
 * reads against this node, so an icon inside follows the theme instead of
 * disappearing when the fill inverts.
 */
const TimelineIndicator = forwardRef<View, TimelineIndicatorProps>(
  ({ className, children, ...props }, ref) => {
    const { variant, orientation } = useTimeline('Timeline.Indicator');
    const { step, completed, tone, showSeparator } =
      useTimelineItem('Timeline.Indicator');
    const { rail, indicator, indicatorLabel, separator } = timelineVariants({
      variant,
      tone,
      completed,
      orientation,
    });

    /*
     * Horizontal: a tick sitting on the rail, not a node with a connector
     * running out of it. The rail is already drawn across the whole track by
     * the root, so what a column owes it is the mark saying where this entry
     * falls — pulled up by half its height to straddle the line rather than
     * hang off it.
     */
    if (orientation === 'horizontal') {
      return (
        <View className={rail()}>
          <View
            ref={ref}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className={indicator({
              className: `w-px rounded-none ${completed ? 'bg-primary' : 'bg-muted-foreground'} ${className ?? ''}`,
            })}
            style={{
              height: HORIZONTAL_TICK_HEIGHT,
              marginTop: -HORIZONTAL_TICK_HEIGHT / 2,
            }}
            {...props}
          />
        </View>
      );
    }

    // dot/card nodes are small discs with nothing inside, so they keep full
    // saturation — a soft tint at 16px would disappear. Nodes that hold an
    // icon or a number take the tinted fill instead.
    const isDisc = SOLID_VARIANTS.includes(variant);
    const toned = tone !== 'default';

    const fill = isDisc ? 'solid' : 'tinted';
    const nodeClass = toned
      ? TONE_NODE[tone][fill]
      : completed
        ? TONE_NODE.default.solid
        : PENDING_NODE[fill];

    // Contents sit on the tint (or on primary once complete), so they take the
    // colour tuned to read against it.
    const tintedContent = useCSSVariable(
      toned ? TONE_ICON_VAR[tone] : '--color-muted-foreground'
    );
    const solidContent = useCSSVariable('--color-primary-foreground');

    const resolved = (value: unknown) =>
      typeof value === 'string' ? value : undefined;

    const contentColor =
      !toned && completed ? resolved(solidContent) : resolved(tintedContent);

    return (
      <View className={rail()}>
        <IconColorProvider color={contentColor}>
          <View ref={ref} className={indicator({ className: `${nodeClass} ${className ?? ''}` })} {...props}>
            {variant === 'numbered' ? (
              <Text className={indicatorLabel()} style={{ color: contentColor }}>
                {step + 1}
              </Text>
            ) : variant === 'icon' || variant === 'compact' ? (
              children
            ) : null}
          </View>
        </IconColorProvider>
        {showSeparator ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className={separator()}
          />
        ) : null}
      </View>
    );
  }
);
TimelineIndicator.displayName = 'Timeline.Indicator';

/**
 * Everything to the right of the rail. Under `variant="card"` the children are
 * wrapped in the card panel, while the spacing between items stays outside it
 * so the connector runs unbroken.
 */
const TimelineContent = forwardRef<View, ViewProps & { className?: string }>(
  ({ className, children, style, ...props }, ref) => {
    const { variant, orientation, scrollX, animate } = useTimeline('Timeline.Content');
    const { completed, tone, offset, columnWidth } =
      useTimelineItem('Timeline.Content');
    const { body, panel } = timelineVariants({ variant, tone, completed, orientation });
    const horizontal = orientation === 'horizontal';

    /*
     * Horizontal: the body recedes further than the column around it.
     *
     * The rail is a continuous thing and has to stay readable across the whole
     * track — the years either side of the one being read are half of what a
     * timeline is for. The prose under them is not: several columns of it at
     * equal weight is a wall, and no amount of fading the column as a whole
     * fixes that without taking the years down with it. So the body takes a
     * second, steeper curve and the dates keep the first one.
     */
    const bodyStyle = useAnimatedStyle(() => {
      if (!horizontal || !animate) return { opacity: 1 };
      const distance = Math.abs(scrollX.value - offset);
      const window = Math.max(columnWidth, 1);
      return { opacity: interpolate(distance, [0, window], [1, 0.3], 'clamp') };
    });

    const inner =
      variant === 'card' ? (
        <View className={panel()}>{textChildren(children)}</View>
      ) : (
        children
      );

    if (!horizontal) {
      return (
        <View ref={ref} className={body({ className })} style={style} {...props}>
          {inner}
        </View>
      );
    }

    return (
      <Animated.View
        ref={ref}
        className={body({ className })}
        {...props}
        style={[style, bodyStyle]}
      >
        {inner}
      </Animated.View>
    );
  }
);
TimelineContent.displayName = 'Timeline.Content';

/** Title row: heading on the left, `Timeline.Trailing` on the right. */
const TimelineHeader = forwardRef<View, ViewProps & { className?: string }>(
  ({ className, ...props }, ref) => {
    const { variant, orientation } = useTimeline('Timeline.Header');
    const { header } = timelineVariants({ variant, orientation });
    return <View ref={ref} className={header({ className })} {...props} />;
  }
);
TimelineHeader.displayName = 'Timeline.Header';

/** Wraps a title and anything stacked under it inside the header row. */
const TimelineHeading = forwardRef<View, ViewProps & { className?: string }>(
  ({ className, ...props }, ref) => {
    const { variant, orientation } = useTimeline('Timeline.Heading');
    const { heading } = timelineVariants({ variant, orientation });
    return <View ref={ref} className={heading({ className })} {...props} />;
  }
);
TimelineHeading.displayName = 'Timeline.Heading';

const TimelineDate = forwardRef<RNText, TextProps>(({ className, ...props }, ref) => {
  const { variant, orientation } = useTimeline('Timeline.Date');
  const { date } = timelineVariants({ variant, orientation });
  return <Text ref={ref} className={date({ className })} {...props} />;
});
TimelineDate.displayName = 'Timeline.Date';

/** Category line in the aside, coloured by the item's tone. */
const TimelineLabel = forwardRef<RNText, TextProps>(({ className, ...props }, ref) => {
  const { variant, orientation } = useTimeline('Timeline.Label');
  const { tone } = useTimelineItem('Timeline.Label');
  const { label } = timelineVariants({ variant, tone, orientation });
  return <Text ref={ref} className={label({ className })} {...props} />;
});
TimelineLabel.displayName = 'Timeline.Label';

/** Muted supporting line — a person's name, a source. */
const TimelineMeta = forwardRef<RNText, TextProps>(({ className, ...props }, ref) => {
  const { variant, orientation } = useTimeline('Timeline.Meta');
  const { meta } = timelineVariants({ variant, orientation });
  return <Text ref={ref} className={meta({ className })} {...props} />;
});
TimelineMeta.displayName = 'Timeline.Meta';

const TimelineTitle = forwardRef<RNText, TextProps>(({ className, ...props }, ref) => {
  const { variant, orientation } = useTimeline('Timeline.Title');
  const { title } = timelineVariants({ variant, orientation });
  return <Text ref={ref} className={title({ className })} {...props} />;
});
TimelineTitle.displayName = 'Timeline.Title';

/** Right-hand slot in the header row — a timestamp, usually. */
const TimelineTrailing = forwardRef<RNText, TextProps>(
  ({ className, ...props }, ref) => {
    const { variant, orientation } = useTimeline('Timeline.Trailing');
    const { trailing } = timelineVariants({ variant, orientation });
    return <Text ref={ref} className={trailing({ className })} {...props} />;
  }
);
TimelineTrailing.displayName = 'Timeline.Trailing';

const TimelineDescription = forwardRef<RNText, TextProps>(
  ({ className, ...props }, ref) => {
    const { variant, orientation } = useTimeline('Timeline.Description');
    const { content } = timelineVariants({ variant, orientation });
    return <Text ref={ref} className={content({ className })} {...props} />;
  }
);
TimelineDescription.displayName = 'Timeline.Description';

/** Bordered strip of label/value pairs under a title. */
const TimelineStats = forwardRef<View, ViewProps & { className?: string }>(
  ({ className, ...props }, ref) => {
    const { variant, orientation } = useTimeline('Timeline.Stats');
    const { stats } = timelineVariants({ variant, orientation });
    return <View ref={ref} className={stats({ className })} {...props} />;
  }
);
TimelineStats.displayName = 'Timeline.Stats';

export interface TimelineStatProps extends ViewProps {
  className?: string;
  label: string;
  value: string;
}

const TimelineStat = forwardRef<View, TimelineStatProps>(
  ({ className, label, value, ...props }, ref) => {
    const { variant, orientation } = useTimeline('Timeline.Stat');
    const { statLabel, statValue } = timelineVariants({ variant, orientation });
    return (
      <View ref={ref} className={className} {...props}>
        <Text className={statLabel()}>{label}</Text>
        <Text className={statValue()}>{value}</Text>
      </View>
    );
  }
);
TimelineStat.displayName = 'Timeline.Stat';

export const Timeline = Object.assign(TimelineRoot, {
  Item: TimelineItem,
  Aside: TimelineAside,
  Indicator: TimelineIndicator,
  Content: TimelineContent,
  Header: TimelineHeader,
  Heading: TimelineHeading,
  Date: TimelineDate,
  Label: TimelineLabel,
  Meta: TimelineMeta,
  Title: TimelineTitle,
  Trailing: TimelineTrailing,
  Description: TimelineDescription,
  Stats: TimelineStats,
  Stat: TimelineStat,
});
