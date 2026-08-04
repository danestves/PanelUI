/**
 * KpiChart — one number, and what it is doing.
 *
 * A metric card is not a chart with a caption. The number is the message and
 * the chart is the footnote, so the parts here are sized and ordered around
 * that: a title that stays quiet, a value that does not, a trend that says
 * which way and by how much, and a sparkline that is allowed to be small
 * because nobody is reading values off it.
 *
 * ```tsx
 * <KpiChart>
 *   <KpiChart.Header>
 *     <KpiChart.Title>Active users</KpiChart.Title>
 *   </KpiChart.Header>
 *   <KpiChart.Content>
 *     <KpiChart.Value>12,480</KpiChart.Value>
 *     <KpiChart.Trend value={12.4} />
 *   </KpiChart.Content>
 *   <KpiChart.Chart data={week} dataKey="v" />
 * </KpiChart>
 * ```
 *
 * The trend is given a number rather than a written string, so the component
 * decides the direction and the colour rather than the call site remembering
 * to keep a minus sign and a red in step. Where a rise is the bad news —
 * churn, latency, cost — say so with `goodDirection="down"` and the colour
 * follows the meaning instead of the sign.
 */
import { createContext, forwardRef, useContext, useMemo, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react-native';
import { tv, type VariantProps } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { type SeriesColorIndex } from '../../utils/chart';
import { LineChart, type LineChartDatum } from '../line-chart';
import { Progress } from '../progress';
import { Surface } from '../surface';

/** Height of the sparkline when nothing else is said. */
const CHART_HEIGHT = 56;
/** …and how wide it is when it sits beside the value rather than under it. */
const INLINE_CHART_WIDTH = 108;

/** The arrow in a trend badge. Small — it is a direction, not an icon. */
const TREND_ICON = 12;
const TREND_STROKE = 2.5;

const kpiVariants = tv({
  slots: {
    root: 'w-full gap-3',
    header: 'flex-row items-center gap-2',
    icon: 'h-8 w-8 items-center justify-center rounded-xl',
    title: 'flex-1 text-sm font-medium text-muted-foreground',
    content: 'flex-row items-end justify-between gap-3',
    value: 'text-3xl font-bold text-foreground',
    trend: 'flex-row items-center gap-1 self-center rounded-full px-2 py-0.5',
    trendLabel: 'text-xs font-medium',
    footer: 'flex-row items-center gap-2',
    separator: 'h-px w-full bg-border',
    group: 'w-full',
    groupSeparator: 'bg-border',
  },
  variants: {
    /**
     * Which way the number moved, *after* the metric's own polarity has been
     * applied — so `good` is green whether it went up or down.
     */
    tone: {
      good: {
        trend: 'bg-success-subtle',
        trendLabel: 'text-success-foreground',
        icon: 'bg-success-subtle',
      },
      bad: {
        trend: 'bg-destructive-subtle',
        trendLabel: 'text-destructive-foreground',
        icon: 'bg-destructive-subtle',
      },
      flat: {
        trend: 'bg-muted',
        trendLabel: 'text-muted-foreground',
        icon: 'bg-muted',
      },
      neutral: {
        trend: 'bg-muted',
        trendLabel: 'text-muted-foreground',
        icon: 'bg-secondary',
      },
    },
    /** Where the chart sits relative to the number. */
    layout: {
      /** Under everything, full width. The chart is a footnote. */
      below: {},
      /** Beside the value, in a fixed column. For a dense row of cards. */
      inline: { content: 'items-center' },
    },
  },
  defaultVariants: {
    tone: 'neutral',
    layout: 'below',
  },
});

type KpiVariantProps = VariantProps<typeof kpiVariants>;

/** How a trend is coloured once the metric's polarity has been applied. */
export type KpiTone = NonNullable<KpiVariantProps['tone']>;

/** Which direction of movement is the good news for this metric. */
export type KpiGoodDirection = 'up' | 'down' | 'none';

interface KpiChartContextValue {
  colorIndex: SeriesColorIndex;
  goodDirection: KpiGoodDirection;
}

const KpiChartContext = createContext<KpiChartContextValue | null>(null);

function useKpiChart(part: string): KpiChartContextValue {
  const context = useContext(KpiChartContext);
  if (!context) throw new Error(`${part} must be used inside <KpiChart>.`);
  return context;
}

/* ------------------------------------------------------------------ *
 * Root.
 * ------------------------------------------------------------------ */

export interface KpiChartProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /**
   * Which `--color-chart-*` token the sparkline and the icon take. Set on the
   * card rather than on the chart so a row of cards can be given five
   * different series colours without repeating the choice on every part.
   */
  colorIndex?: SeriesColorIndex;
  /**
   * Which way is the good news. `up` for revenue and signups, `down` for churn
   * and latency, `none` for a number that is neither — a headcount, a version.
   * Defaults to `up`.
   */
  goodDirection?: KpiGoodDirection;
  /** Draw the card on a surface. Turn off to place it in a shell of your own. */
  surface?: boolean;
  children: ReactNode;
}

const KpiChartRoot = forwardRef<View, KpiChartProps>(function KpiChartRoot(
  { className, colorIndex = 1, goodDirection = 'up', surface = true, children, ...props },
  ref
) {
  const { root } = kpiVariants();
  const context = useMemo(() => ({ colorIndex, goodDirection }), [colorIndex, goodDirection]);

  const body = (
    <View ref={surface ? undefined : ref} className={root({ className })} {...props}>
      {children}
    </View>
  );

  return (
    <KpiChartContext.Provider value={context}>
      {surface ? (
        <Surface ref={ref} variant="secondary" padding="lg" className="w-full">
          {body}
        </Surface>
      ) : (
        body
      )}
    </KpiChartContext.Provider>
  );
});

/* ------------------------------------------------------------------ *
 * Header, and the things that live in it.
 * ------------------------------------------------------------------ */

export interface KpiChartHeaderProps extends ViewProps {
  className?: string;
  children: ReactNode;
}

/** The top row: an icon, the metric's name, and anything acting on it. */
function KpiChartHeader({ className, children, ...props }: KpiChartHeaderProps) {
  const { header } = kpiVariants();
  return (
    <View className={header({ className })} {...props}>
      {children}
    </View>
  );
}

export interface KpiChartIconProps extends ViewProps {
  className?: string;
  /** Overrides the tint the card's `colorIndex` would give it. */
  tone?: KpiTone;
  children: ReactNode;
}

/**
 * A tinted square for a glyph.
 *
 * It takes the element rather than drawing one, because a metric's icon comes
 * from whatever set the app already uses — and an icon from outside this
 * library will not read an ambient colour, so pass it one.
 */
function KpiChartIcon({ className, tone = 'neutral', children, ...props }: KpiChartIconProps) {
  const { icon } = kpiVariants({ tone });
  return (
    <View className={icon({ className })} {...props}>
      {children}
    </View>
  );
}

export interface KpiChartTitleProps {
  className?: string;
  children: ReactNode;
}

/** The metric's name. Quiet on purpose — the value is the thing being read. */
function KpiChartTitle({ className, children }: KpiChartTitleProps) {
  const { title } = kpiVariants();
  return (
    <Text className={title({ className })} numberOfLines={1}>
      {children}
    </Text>
  );
}

export interface KpiChartActionsProps extends ViewProps {
  className?: string;
  children: ReactNode;
}

/** The trailing end of the header — a menu trigger, a filter, a link. */
function KpiChartActions({ className, children, ...props }: KpiChartActionsProps) {
  return (
    <View className={cn('flex-row items-center gap-1', className)} {...props}>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * The number, and what it is doing.
 * ------------------------------------------------------------------ */

export interface KpiChartContentProps extends ViewProps {
  className?: string;
  /** `inline` puts the chart beside the value instead of under everything. */
  layout?: NonNullable<KpiVariantProps['layout']>;
  children: ReactNode;
}

/** The row the value and the trend share. */
function KpiChartContent({
  className,
  layout = 'below',
  children,
  ...props
}: KpiChartContentProps) {
  const { content } = kpiVariants({ layout });
  return (
    <View className={content({ className })} {...props}>
      {children}
    </View>
  );
}

export interface KpiChartValueProps {
  className?: string;
  children: ReactNode;
}

/**
 * The number.
 *
 * Formatted by the caller, not here: thousands separators, currency symbols
 * and units are locale decisions, and a component that guessed them would be
 * wrong in a way that is hard to notice and impossible to override.
 */
function KpiChartValue({ className, children }: KpiChartValueProps) {
  const { value } = kpiVariants();
  return (
    <Text className={value({ className })} numberOfLines={1}>
      {children}
    </Text>
  );
}

export interface KpiChartTrendProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /**
   * How much it moved, as a percentage. The sign carries the direction, so
   * `-4.2` is a fall of 4.2%; there is no separate direction prop to keep in
   * step with it.
   */
  value: number;
  /**
   * Writes the number yourself. Receives the raw value, sign and all. The
   * default prints one decimal place with an explicit `+` or `−`.
   */
  format?: (value: number) => string;
  /** Overrides the card's own `goodDirection` for this one figure. */
  goodDirection?: KpiGoodDirection;
  /** Anything after the number — "vs last week", a period name. */
  children?: ReactNode;
  /** Below which a movement counts as no movement. Defaults to `0`. */
  threshold?: number;
}

/**
 * The change, as a badge.
 *
 * Colour comes from what the movement *means*, not from its sign: a fall in
 * churn is good news and is drawn as good news. That is the whole reason this
 * takes a number rather than a string — a caller writing "−4.2%" into a green
 * label has to remember to change the colour when the metric changes, and
 * nobody does.
 */
function KpiChartTrend({
  className,
  value,
  format,
  goodDirection,
  threshold = 0,
  children,
  ...props
}: KpiChartTrendProps) {
  const context = useKpiChart('KpiChart.Trend');
  const polarity = goodDirection ?? context.goodDirection;

  const flat = Math.abs(value) <= threshold;
  const rising = value > 0;
  const tone: KpiTone = flat
    ? 'flat'
    : polarity === 'none'
      ? 'neutral'
      : (rising && polarity === 'up') || (!rising && polarity === 'down')
        ? 'good'
        : 'bad';

  const { trend, trendLabel } = kpiVariants({ tone });

  // The badge's own label colour, resolved so the arrow beside it matches. An
  // icon from outside this library does not inherit a text colour.
  const goodTint = useCSSVariable('--color-success-foreground');
  const badTint = useCSSVariable('--color-destructive-foreground');
  const mutedTint = useCSSVariable('--color-muted-foreground');
  const raw = tone === 'good' ? goodTint : tone === 'bad' ? badTint : mutedTint;
  const tint = typeof raw === 'string' ? raw : '#737373';

  const Arrow = flat ? Minus : rising ? ArrowUp : ArrowDown;

  const label = format
    ? format(value)
    : // A true minus sign rather than a hyphen: at this size a hyphen reads as
      // a dash between two words, and the sign is half the meaning.
      `${rising ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}%`;

  return (
    <View
      className={trend({ className })}
      accessible
      accessibilityLabel={`${flat ? 'No change' : rising ? 'Up' : 'Down'} ${Math.abs(
        value
      ).toFixed(1)} percent`}
      {...props}
    >
      <Arrow size={TREND_ICON} strokeWidth={TREND_STROKE} color={tint} />
      <Text className={trendLabel()}>{label}</Text>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * The chart, and the bar.
 * ------------------------------------------------------------------ */

export interface KpiChartSparklineProps {
  className?: string;
  /** The rows. One point each, in order. */
  data: LineChartDatum[];
  /** Key holding the y values. */
  dataKey: string;
  /** Overrides the card's `colorIndex`. */
  colorIndex?: SeriesColorIndex;
  /** Fill under the line. On by default — the shape reads faster with one. */
  filled?: boolean;
  /** Height in points. Ignored when `inline` is set. */
  height?: number;
  /** Draw it in a fixed narrow column, for a chart sitting beside the value. */
  inline?: boolean;
  strokeWidth?: number;
}

/**
 * The sparkline.
 *
 * A line chart with the axis padding dropped, which is what `compact` on the
 * chart itself means — there is no grid, no axis and no crosshair here, so
 * every point of padding is a point the shape is not using. Nobody reads a
 * value off one of these; they read whether it is going up.
 */
function KpiChartSparkline({
  className,
  data,
  dataKey,
  colorIndex,
  filled = true,
  height = CHART_HEIGHT,
  inline = false,
  strokeWidth = 2,
}: KpiChartSparklineProps) {
  const context = useKpiChart('KpiChart.Chart');
  const index = colorIndex ?? context.colorIndex;

  return (
    <View
      className={cn(inline ? '' : 'w-full', className)}
      style={inline ? { width: INLINE_CHART_WIDTH, height } : { height }}
    >
      <LineChart data={data} compact aspectRatio={inline ? 2 : 4}>
        {filled ? <LineChart.Area dataKey={dataKey} colorIndex={index} /> : null}
        <LineChart.Line dataKey={dataKey} colorIndex={index} strokeWidth={strokeWidth} />
      </LineChart>
    </View>
  );
}

export interface KpiChartProgressProps {
  className?: string;
  /** Where it has got to. */
  value: number;
  /** The value at which the bar reads as full. Defaults to `100`. */
  maxValue?: number;
  /** A caption above the bar. */
  label?: string;
  /** Print the percentage on the right of the caption row. */
  showValueLabel?: boolean;
}

/** Progress towards a target, for a metric that has one. */
function KpiChartProgressBar({
  className,
  value,
  maxValue = 100,
  label,
  showValueLabel,
}: KpiChartProgressProps) {
  return (
    <Progress
      className={className}
      value={value}
      maxValue={maxValue}
      label={label}
      showValueLabel={showValueLabel}
      size="sm"
    />
  );
}

/* ------------------------------------------------------------------ *
 * Footer and separator.
 * ------------------------------------------------------------------ */

export interface KpiChartFooterProps extends ViewProps {
  className?: string;
  children: ReactNode;
}

/** The bottom strip — a comparison period, a caveat, a link. */
function KpiChartFooter({ className, children, ...props }: KpiChartFooterProps) {
  const { footer } = kpiVariants();
  return (
    <View className={footer({ className })} {...props}>
      {children}
    </View>
  );
}

export interface KpiChartSeparatorProps extends ViewProps {
  className?: string;
}

/** A hairline across the card. */
function KpiChartSeparator({ className, ...props }: KpiChartSeparatorProps) {
  const { separator } = kpiVariants();
  return <View className={separator({ className })} {...props} />;
}

/* ------------------------------------------------------------------ *
 * Group.
 * ------------------------------------------------------------------ */

export type KpiChartGroupOrientation = 'horizontal' | 'vertical';

export interface KpiChartGroupProps extends ViewProps {
  className?: string;
  /** `horizontal` splits the row between the cards; `vertical` stacks them. */
  orientation?: KpiChartGroupOrientation;
  /**
   * Draw a hairline between the cards rather than spacing them apart. Several
   * metrics separated by a rule read as one panel; several spaced apart read
   * as several panels that happen to be adjacent.
   */
  separated?: boolean;
  children: ReactNode;
}

/**
 * Several metrics, laid out as one panel.
 *
 * The separators are inserted between the children rather than written by the
 * caller, because "between" is the one thing a list of siblings cannot express
 * — a trailing rule after the last card is the mistake this exists to prevent.
 */
const KpiChartGroup = forwardRef<View, KpiChartGroupProps>(function KpiChartGroup(
  { className, orientation = 'horizontal', separated = true, children, ...props },
  ref
) {
  const { group, groupSeparator } = kpiVariants();
  const horizontal = orientation === 'horizontal';

  const items = Array.isArray(children) ? children.flat() : [children];
  const visible = items.filter(Boolean);

  return (
    <View
      ref={ref}
      className={cn(
        group(),
        horizontal ? 'flex-row items-stretch' : 'flex-col',
        separated ? '' : horizontal ? 'gap-3' : 'gap-3',
        className
      )}
      {...props}
    >
      {visible.map((child, index) => (
        <View
          key={index}
          className={cn(
            horizontal ? 'flex-1' : 'w-full',
            // The padding is on the children rather than the rule, so the rule
            // reaches the full height or width of the panel.
            separated && horizontal && index > 0 && 'ps-4',
            separated && horizontal && index < visible.length - 1 && 'pe-4',
            separated && !horizontal && index > 0 && 'pt-4',
            separated && !horizontal && index < visible.length - 1 && 'pb-4'
          )}
        >
          {separated && index > 0 ? (
            <View
              className={cn(
                groupSeparator(),
                horizontal ? 'absolute bottom-0 start-0 top-0 w-px' : 'h-px w-full'
              )}
              // A rule between panels is decoration; announcing it puts an
              // unlabelled stop between two metrics.
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
          {child}
        </View>
      ))}
    </View>
  );
});

KpiChartRoot.displayName = 'KpiChart';
KpiChartHeader.displayName = 'KpiChart.Header';
KpiChartIcon.displayName = 'KpiChart.Icon';
KpiChartTitle.displayName = 'KpiChart.Title';
KpiChartActions.displayName = 'KpiChart.Actions';
KpiChartContent.displayName = 'KpiChart.Content';
KpiChartValue.displayName = 'KpiChart.Value';
KpiChartTrend.displayName = 'KpiChart.Trend';
KpiChartSparkline.displayName = 'KpiChart.Chart';
KpiChartProgressBar.displayName = 'KpiChart.Progress';
KpiChartFooter.displayName = 'KpiChart.Footer';
KpiChartSeparator.displayName = 'KpiChart.Separator';
KpiChartGroup.displayName = 'KpiChart.Group';

export const KpiChart = Object.assign(KpiChartRoot, {
  Header: KpiChartHeader,
  Icon: KpiChartIcon,
  Title: KpiChartTitle,
  Actions: KpiChartActions,
  Content: KpiChartContent,
  Value: KpiChartValue,
  Trend: KpiChartTrend,
  Chart: KpiChartSparkline,
  Progress: KpiChartProgressBar,
  Footer: KpiChartFooter,
  Separator: KpiChartSeparator,
  Group: KpiChartGroup,
});
