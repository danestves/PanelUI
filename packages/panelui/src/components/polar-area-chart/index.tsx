/**
 * PolarAreaChart — several parts, compared on one measure.
 *
 * ```tsx
 * <PolarAreaChart data={scores}>
 *   <PolarAreaChart.Header title="Scores" />
 *   <PolarAreaChart.Grid />
 *   <PolarAreaChart.Wedges />
 *   <PolarAreaChart.Labels />
 *   <PolarAreaChart.Legend />
 * </PolarAreaChart>
 * ```
 *
 * ## What it is, against the pie beside it
 *
 * A pie divides one total: the angles are the quantity and they must come to a
 * full turn, so a slice only means anything next to the others. Here every
 * wedge takes the same angle and the *radius* is the quantity, which means the
 * values do not have to add up to anything. Six unrelated readings on one scale
 * are a polar area chart; six parts of one budget are a pie.
 *
 * What it buys over a bar chart is the shape. Bars are easier to read one at a
 * time, and a reader who has to rank the middle three should be given bars. A
 * dial is for the silhouette — which direction the weight sits in, whether one
 * reading runs away from the rest — read at a glance and without a legend walk.
 *
 * ## Radius, and what it overstates
 *
 * `scale` decides what the radius means, and the two answers are not the same
 * chart:
 *
 * - `radius` (the default) puts the value straight on the radius, so a reading
 *   can be counted off the rings. The cost is that a wedge worth twice another
 *   covers four times the area, and area is what the eye adds up first.
 * - `area` puts it on the square root instead, so the ink is proportional to
 *   the value and nothing is overstated. The cost is the rings: they still mark
 *   equal steps, but they are no longer equally spaced.
 *
 * The grid is drawn through the same conversion either way, so a ring is always
 * where its value falls rather than where an even split would put it.
 *
 * Touch, not hover: a wedge is selected by pressing it, and pressing the same
 * one again clears the selection.
 */
import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Text } from '../../primitives/text';
import {
  compactNumber,
  inkOn,
  polarPoint,
  seriesColorAt,
  useSeriesColor,
  wedgePath,
} from '../../utils/chart';
import { cn } from '../../utils/cn';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** How far along its own radius a wedge's label sits. */
const LABEL_AT = 0.62;

/** The side of the invisible box a label is centred in. */
const LABEL_BOX = 64;

/** Below this radius in points a wedge is left unlabelled. */
const DEFAULT_MIN_LABEL_RADIUS = 34;

const TOOLTIP_WIDTH = 132;
const TOOLTIP_HEIGHT = 30;

/** Where a child is drawn: inside the SVG, over it, above it, or under it. */
type Slot = 'svg' | 'overlay' | 'header' | 'footer';

/** Whether the chart is showing data or waiting for it. */
export type PolarAreaChartStatus = 'loading' | 'ready';

/** What a wedge's radius stands for. */
export type PolarAreaScale = 'radius' | 'area';

/** One wedge. Its angle is fixed, so only the value decides how far it reaches. */
export interface PolarAreaDatum {
  /** Name for the legend, the readout and the accessibility label. */
  label: string;
  /** How far the wedge reaches, against `maxValue`. Negatives are treated as zero. */
  value: number;
  /** Explicit colour, overriding the `--color-chart-*` token. */
  color?: string;
}

/** A wedge's place on the dial, in turns clockwise from twelve o'clock. */
interface WedgeGeometry {
  from: number;
  to: number;
  /** Halfway along it, which is where its label sits. */
  mid: number;
  /** How far out it reaches, in points. */
  radius: number;
  /** Its value against the maximum, 0 to 1. */
  fraction: number;
}

interface PolarAreaChartContextValue {
  data: PolarAreaDatum[];
  size: number;
  /** Outer radius in points — the outermost ring, standing for `maxValue`. */
  radius: number;
  /** The value the outermost ring stands for. */
  maxValue: number;
  scale: PolarAreaScale;
  colors: string[];
  wedges: WedgeGeometry[];
  /** A value's distance from the centre, in points, under the current scale. */
  radiusOf: (value: number) => number;
  /** 0 to 1 as the wedges grow out of the centre. */
  reveal: SharedValue<number>;
  status: PolarAreaChartStatus;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

const PolarAreaChartContext = createContext<PolarAreaChartContextValue | null>(null);

function useChart(component: string): PolarAreaChartContextValue {
  const context = useContext(PolarAreaChartContext);
  if (!context) {
    throw new Error(`${component} must be used within a <PolarAreaChart>`);
  }
  return context;
}

/** The selected wedge and its reading, for something rendered inside the chart. */
export function usePolarAreaChart() {
  const { data, wedges, activeIndex } = useChart('usePolarAreaChart');
  return {
    activeIndex,
    activeWedge: activeIndex >= 0 ? (data[activeIndex] ?? null) : null,
    /** The selected wedge's value against the maximum, 0 to 1. */
    activeFraction: activeIndex >= 0 ? (wedges[activeIndex]?.fraction ?? 0) : 0,
  };
}

/**
 * The steps a scale is read in, as multiples of a power of ten.
 *
 * Finer than the usual 1/2/5 ladder on purpose. Here the maximum is a *radius*
 * as well as a number: rounding 140 up to 200 leaves the largest wedge stopping
 * at seven tenths of the dial with the outer third of it empty on every chart
 * whose readings happen to start with a one.
 */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/**
 * The first round number at or above `value`.
 *
 * The outermost ring is the number every other reading is judged against, so it
 * is worth it landing on 150 rather than on 147.
 */
function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  return (NICE_STEPS.find((step) => scaled <= step) ?? 10) * magnitude;
}

export interface PolarAreaChartProps extends ViewProps {
  className?: string;
  /** One entry per wedge, drawn in the order they are listed. */
  data: PolarAreaDatum[];
  /** Diameter in points. Left out, the chart fills its column as a square. */
  size?: number;
  /**
   * The value the outermost ring stands for. Defaults to the largest value
   * rounded up to a round number.
   *
   * Fix it to compare two dials against each other — the same reading has to be
   * the same distance out on both, and a maximum derived per chart makes the
   * largest wedge of each one reach the edge whatever it is worth.
   */
  maxValue?: number;
  /** Whether the radius or the area carries the value. */
  scale?: PolarAreaScale;
  /** Where the first wedge starts, in degrees clockwise from twelve o'clock. */
  startAngle?: number;
  /** Gap between wedges, in degrees. */
  padAngle?: number;
  /** `loading` draws the dial undivided, with nothing split up yet. */
  status?: PolarAreaChartStatus;
  /** Milliseconds for the wedges to grow out of the centre. */
  animationDuration?: number;
  /** The selected wedge, to drive the selection from outside. */
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  children?: ReactNode;
}

export interface PolarAreaChartHandle {
  /** Play the growth again. */
  replay: () => void;
}

const PolarAreaChartRoot = forwardRef<PolarAreaChartHandle, PolarAreaChartProps>(
  function PolarAreaChartRoot(
    {
      className,
      data,
      size,
      maxValue: maxValueProp,
      scale = 'radius',
      startAngle = 0,
      padAngle = 0,
      status = 'ready',
      animationDuration = 800,
      activeIndex: activeIndexProp,
      onActiveIndexChange,
      children,
      ...props
    },
    ref
  ) {
    const [measured, setMeasured] = useState(0);
    const [internalActive, setInternalActive] = useState(-1);
    const reveal = useSharedValue(0);
    const reducedMotion = useReducedMotion();

    const controlled = activeIndexProp !== undefined;
    const activeIndex = controlled ? activeIndexProp : internalActive;

    const setActiveIndex = useMemo(
      () => (index: number) => {
        if (!controlled) setInternalActive(index);
        onActiveIndexChange?.(index);
      },
      [controlled, onActiveIndexChange]
    );

    const box = size ?? measured;
    const radius = Math.max(box / 2, 0);

    const maxValue = useMemo(() => {
      if (maxValueProp !== undefined) return Math.max(maxValueProp, 0) || 1;
      return niceMax(data.reduce((top, datum) => Math.max(top, datum.value), 0));
    }, [data, maxValueProp]);

    /*
     * One conversion, shared by the wedges, the rings and the readout. Two
     * copies of it would be two chances for a ring to sit somewhere its own
     * value does not.
     */
    const radiusOf = useMemo(
      () => (value: number) => {
        const fraction = Math.min(Math.max(value, 0) / maxValue, 1);
        return radius * (scale === 'area' ? Math.sqrt(fraction) : fraction);
      },
      [maxValue, radius, scale]
    );

    const origin = startAngle / 360;

    const wedges = useMemo<WedgeGeometry[]>(() => {
      const count = data.length;
      if (!count || radius <= 0) return [];

      const each = 1 / count;
      // Never more than half a wedge from each side, or the two gaps meet in
      // the middle and the wedge inverts.
      const pad = Math.min(padAngle / 360, each / 2);

      return data.map((datum, index) => {
        const from = origin + each * index + pad / 2;
        const to = origin + each * (index + 1) - pad / 2;
        return {
          from,
          to,
          mid: (from + to) / 2,
          radius: radiusOf(datum.value),
          fraction: Math.min(Math.max(datum.value, 0) / maxValue, 1),
        };
      });
    }, [data, radius, origin, padAngle, radiusOf, maxValue]);

    const playReveal = useMemo(
      () => () => {
        if (reducedMotion) {
          reveal.value = 1;
          return;
        }
        reveal.value = 0;
        reveal.value = withTiming(1, {
          duration: animationDuration,
          easing: Easing.bezier(0.85, 0, 0.15, 1),
        });
      },
      [reducedMotion, animationDuration, reveal]
    );

    const loading = status === 'loading';
    const revealed = useRef(false);

    useEffect(() => {
      if (loading) {
        revealed.current = false;
        reveal.value = 0;
        return;
      }
      if (revealed.current || box <= 0 || !wedges.length) return;
      revealed.current = true;
      playReveal();
    }, [loading, box, wedges.length, playReveal, reveal]);

    useImperativeHandle(ref, () => ({ replay: playReveal }), [playReveal]);

    // Resolved here rather than inside the wedges, so the legend, the header
    // and the readout can name a wedge's colour without drawing one.
    const c1 = useSeriesColor(undefined, 1);
    const c2 = useSeriesColor(undefined, 2);
    const c3 = useSeriesColor(undefined, 3);
    const c4 = useSeriesColor(undefined, 4);
    const c5 = useSeriesColor(undefined, 5);
    const palette = useMemo(() => [c1, c2, c3, c4, c5], [c1, c2, c3, c4, c5]);
    const colors = useMemo(
      () => data.map((datum, index) => datum.color ?? seriesColorAt(palette, index)),
      [data, palette]
    );

    const onLayout = (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      const next = Math.round(Math.min(width, height));
      if (next !== measured) setMeasured(next);
      props.onLayout?.(event);
    };

    const context = useMemo<PolarAreaChartContextValue>(
      () => ({
        data,
        size: box,
        radius,
        maxValue,
        scale,
        colors,
        wedges,
        radiusOf,
        reveal,
        status,
        activeIndex,
        setActiveIndex,
      }),
      [
        data,
        box,
        radius,
        maxValue,
        scale,
        colors,
        wedges,
        radiusOf,
        reveal,
        status,
        activeIndex,
        setActiveIndex,
      ]
    );

    const slots: Record<Slot, ReactNode[]> = {
      svg: [],
      overlay: [],
      header: [],
      footer: [],
    };
    Children.forEach(children, (child, index) => {
      if (!isValidElement(child)) return;
      const slot = (child.type as { slot?: Slot }).slot ?? 'overlay';
      slots[slot in slots ? slot : 'overlay'].push(<ChildSlot key={index}>{child}</ChildSlot>);
    });

    return (
      <PolarAreaChartContext.Provider value={context}>
        {/*
         * Two views, because the header is not part of the dial. The square and
         * the layout measurement belong to the drawing area alone — measured on
         * the outer view they would take in the header too, and the dial would
         * be laid out inside a box taller than the one it is drawn in.
         */}
        <View {...props} style={props.style} className={cn('w-full', className)}>
          {slots.header}
          <View
            onLayout={onLayout}
            style={size ? { width: size, height: size } : { aspectRatio: 1 }}
            className={cn('items-center justify-center', size ? 'self-center' : 'w-full')}
          >
            {box > 0 ? (
              <>
                <Svg width={box} height={box}>
                  {slots.svg}
                </Svg>
                {/*
                 * Over the SVG rather than inside it: these are text, and SVG
                 * text ignores the platform's text scaling and the theme's font.
                 */}
                <View
                  pointerEvents="box-none"
                  style={{ position: 'absolute', width: box, height: box }}
                >
                  {slots.overlay}
                </View>
              </>
            ) : null}
          </View>
          {slots.footer}
        </View>
      </PolarAreaChartContext.Provider>
    );
  }
);
PolarAreaChartRoot.displayName = 'PolarAreaChart';

function ChildSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export interface PolarAreaChartWedgesProps {
  /** Rounds the four turns of each wedge, in points. */
  cornerRadius?: number;
  /** Opacity of the wedges that are not selected, once one is. */
  dimOpacity?: number;
}

/**
 * Every wedge, drawn in the order the data lists them.
 *
 * One part rather than one per datum: the wedges share a dial, a maximum and a
 * scale by definition, and a chart where one of them could be given a different
 * maximum would be a chart drawing a lie.
 */
function PolarAreaChartWedges({
  cornerRadius = 0,
  dimOpacity = 0.35,
}: PolarAreaChartWedgesProps) {
  const { data, wedges, colors, size, reveal, status, activeIndex, setActiveIndex } =
    useChart('PolarAreaChart.Wedges');

  if (status === 'loading' || !wedges.length) return null;

  return (
    <G>
      {wedges.map((wedge, index) => {
        const datum = data[index];
        if (!datum || wedge.radius <= 0 || wedge.to <= wedge.from) return null;
        return (
          <Wedge
            key={`${datum.label}-${index}`}
            wedge={wedge}
            fill={colors[index] ?? colors[0]!}
            centre={size / 2}
            cornerRadius={cornerRadius}
            reveal={reveal}
            dimmed={activeIndex >= 0 && activeIndex !== index}
            dimOpacity={dimOpacity}
            label={datum.label}
            value={datum.value}
            onPress={() => setActiveIndex(activeIndex === index ? -1 : index)}
          />
        );
      })}
    </G>
  );
}
PolarAreaChartWedges.displayName = 'PolarAreaChart.Wedges';
PolarAreaChartWedges.slot = 'svg' as const;

/**
 * One wedge, rebuilt on the UI thread every frame it is growing.
 *
 * It grows outward rather than sweeping round, because the radius is the
 * quantity here: a wedge half drawn is a smaller reading, which is the thing
 * the chart is animating towards. A sweep would animate the one dimension that
 * carries nothing.
 */
function Wedge({
  wedge,
  fill,
  centre,
  cornerRadius,
  reveal,
  dimmed,
  dimOpacity,
  label,
  value,
  onPress,
}: {
  wedge: WedgeGeometry;
  fill: string;
  centre: number;
  cornerRadius: number;
  reveal: SharedValue<number>;
  dimmed: boolean;
  dimOpacity: number;
  label: string;
  value: number;
  onPress: () => void;
}) {
  const { from, to, radius } = wedge;

  const animatedProps = useAnimatedProps(() => ({
    d: wedgePath(centre, centre, radius * reveal.value, 0, from, to, cornerRadius),
  }));

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill={fill}
      fillOpacity={dimmed ? dimOpacity : 1}
      onPress={onPress}
      // An SVG node takes a label but not a role, so the wedges are reachable
      // and named without being announced as buttons. `PolarAreaChart.Legend`
      // is the properly wired way through the same selection.
      accessibilityLabel={`${label}, ${compactNumber(value)}`}
    />
  );
}

export interface PolarAreaChartGridProps {
  /** How many rings, including the outermost. */
  rings?: number;
  /** Overrides the themed hairline colour. */
  color?: string;
  /** Draw a line from the centre out along each wedge's edge. */
  spokes?: boolean;
}

/**
 * The scale, drawn as rings.
 *
 * Each ring stands for an even step of the value and is placed where that value
 * falls, which under `scale="area"` is not an even step of the radius. Spacing
 * them evenly instead would be quicker and would put every ring in the wrong
 * place on half the charts.
 */
function PolarAreaChartGrid({ rings = 4, color, spokes = false }: PolarAreaChartGridProps) {
  const { size, radius, maxValue, radiusOf, wedges } = useChart('PolarAreaChart.Grid');
  const token = useCSSVariable('--color-border');
  const stroke = color ?? (typeof token === 'string' ? token : 'rgba(128,128,128,0.2)');

  if (radius <= 0 || rings < 1) return null;

  const centre = size / 2;

  return (
    <G>
      {Array.from({ length: rings }, (_, index) => {
        const r = radiusOf(((index + 1) / rings) * maxValue);
        if (r <= 0) return null;
        return (
          <Circle
            key={index}
            cx={centre}
            cy={centre}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
          />
        );
      })}
      {spokes
        ? wedges.map((wedge, index) => {
            const point = polarPoint(centre, centre, radius, wedge.from);
            return (
              <Line
                key={index}
                x1={centre}
                y1={centre}
                x2={point.x}
                y2={point.y}
                stroke={stroke}
                strokeWidth={1}
              />
            );
          })
        : null}
    </G>
  );
}
PolarAreaChartGrid.displayName = 'PolarAreaChart.Grid';
PolarAreaChartGrid.slot = 'svg' as const;

export interface PolarAreaChartLabelsProps {
  /** Format the value. Defaults to a compact number. */
  formatValue?: (value: number, datum: PolarAreaDatum) => string;
  /** Wedges reaching less far than this, in points, are left unlabelled. */
  minRadius?: number;
  className?: string;
}

/**
 * The reading on each wedge that has room for it.
 *
 * A wedge shorter than `minRadius` is left blank — the label would sit outside
 * the wedge it belongs to, next to a neighbour it does not describe. Those are
 * read through `Tooltip` and the legend instead.
 *
 * Each label takes its colour from the wedge under it. A wedge is a theme
 * colour and a theme is free to set that anywhere on the scale, so a fixed
 * white label disappears on the pale ones.
 */
function PolarAreaChartLabels({
  formatValue,
  minRadius = DEFAULT_MIN_LABEL_RADIUS,
  className,
}: PolarAreaChartLabelsProps) {
  const { data, wedges, colors, size, status } = useChart('PolarAreaChart.Labels');
  const backdrop = useCSSVariable('--color-background');

  if (status === 'loading' || !wedges.length) return null;

  const format = formatValue ?? ((value: number) => compactNumber(value));
  const behind = typeof backdrop === 'string' ? backdrop : undefined;
  const centre = size / 2;

  return (
    <>
      {wedges.map((wedge, index) => {
        const datum = data[index];
        if (!datum || wedge.radius < minRadius) return null;

        const point = polarPoint(centre, centre, wedge.radius * LABEL_AT, wedge.mid);
        const ink = inkOn(colors[index] ?? colors[0]!, behind, 1);

        return (
          <View
            key={`${datum.label}-${index}`}
            // Not a target: the wedge underneath is one, and a box this size
            // over the middle of a dial would take the presses meant for its
            // neighbours as well as its own.
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: point.x - LABEL_BOX / 2,
              top: point.y - LABEL_BOX / 2,
              width: LABEL_BOX,
              height: LABEL_BOX,
            }}
            className={cn('items-center justify-center', className)}
          >
            <Text size="xs" weight="semibold" numberOfLines={1} style={{ color: ink.color }}>
              {format(datum.value, datum)}
            </Text>
          </View>
        );
      })}
    </>
  );
}
PolarAreaChartLabels.displayName = 'PolarAreaChart.Labels';
PolarAreaChartLabels.slot = 'overlay' as const;

export interface PolarAreaChartTooltipProps {
  /** Format the value. Defaults to a compact number. */
  formatValue?: (value: number, datum: PolarAreaDatum) => string;
  className?: string;
}

/**
 * The readout for the selected wedge, floating over the dial.
 *
 * This is how the short wedges are named. They are the ones with no room for a
 * label, so without it the chart answers questions about its largest readings
 * only — which is the half the reader could already see.
 */
function PolarAreaChartTooltip({ formatValue, className }: PolarAreaChartTooltipProps) {
  const { data, wedges, size, activeIndex, status } = useChart('PolarAreaChart.Tooltip');

  if (status === 'loading' || activeIndex < 0) return null;

  const datum = data[activeIndex];
  const wedge = wedges[activeIndex];
  if (!datum || !wedge) return null;

  const format = formatValue ?? ((value: number) => compactNumber(value));
  const centre = size / 2;
  const point = polarPoint(centre, centre, wedge.radius * LABEL_AT, wedge.mid);

  // Over the wedge, then pushed back inside the square — a readout half off the
  // edge is one the reader has to guess the rest of.
  const left = Math.max(0, Math.min(size - TOOLTIP_WIDTH, point.x - TOOLTIP_WIDTH / 2));
  const top = Math.max(0, Math.min(size - TOOLTIP_HEIGHT, point.y - TOOLTIP_HEIGHT / 2));

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left, top, width: TOOLTIP_WIDTH }}
      className={cn(
        'items-center rounded-lg border border-border bg-popover px-2 py-1 shadow-sm',
        className
      )}
    >
      <Text size="xs" weight="medium" numberOfLines={1}>
        {datum.label}
      </Text>
      <Text size="xs" muted numberOfLines={1}>
        {format(datum.value, datum)}
      </Text>
    </View>
  );
}
PolarAreaChartTooltip.displayName = 'PolarAreaChart.Tooltip';
PolarAreaChartTooltip.slot = 'overlay' as const;

export interface PolarAreaChartLegendProps extends ViewProps {
  className?: string;
  /** Show each wedge's reading beside its name. */
  showValue?: boolean;
  /** Format the value. Defaults to a compact number. */
  formatValue?: (value: number, datum: PolarAreaDatum) => string;
}

/**
 * A swatch, a name and a reading per wedge, under the dial and across the width
 * of it. Pressable in the same way the wedges are, and the easier target of the
 * two for anything short.
 *
 * The reading rather than a share, unlike the pie next door: these values need
 * not add up to anything, so a percentage of their sum would be a number about
 * nothing.
 */
function PolarAreaChartLegend({
  className,
  showValue = true,
  formatValue,
  ...props
}: PolarAreaChartLegendProps) {
  const { data, colors, activeIndex, setActiveIndex } = useChart('PolarAreaChart.Legend');

  if (!data.length) return null;

  const format = formatValue ?? ((value: number) => compactNumber(value));

  return (
    <View
      {...props}
      className={cn(
        'w-full flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-3',
        className
      )}
    >
      {data.map((datum, index) => {
        const dimmed = activeIndex >= 0 && activeIndex !== index;
        return (
          <Pressable
            key={`${datum.label}-${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected: activeIndex === index }}
            accessibilityLabel={`${datum.label}, ${format(datum.value, datum)}`}
            onPress={() => setActiveIndex(activeIndex === index ? -1 : index)}
            style={{ opacity: dimmed ? 0.4 : 1 }}
            className="max-w-full flex-row items-center gap-1.5"
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors[index],
              }}
            />
            <Text size="xs" muted numberOfLines={1} className="shrink">
              {datum.label}
            </Text>
            {showValue ? (
              <Text size="xs" weight="medium">
                {format(datum.value, datum)}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
PolarAreaChartLegend.displayName = 'PolarAreaChart.Legend';
PolarAreaChartLegend.slot = 'footer' as const;

export interface PolarAreaChartSkeletonProps {
  color?: string;
}

/**
 * The loading state: the dial as one plain disc, with nothing divided up yet.
 *
 * Deliberately undivided. Placeholder wedges would be a made-up set of
 * readings, and a reader has no way to tell an invented one from a real one
 * until it changes under them.
 */
function PolarAreaChartSkeleton({ color }: PolarAreaChartSkeletonProps) {
  const { size, radius, status } = useChart('PolarAreaChart.Skeleton');
  const token = useCSSVariable('--color-skeleton');
  const fill = color ?? (typeof token === 'string' ? token : 'rgba(128,128,128,0.2)');

  if (status !== 'loading' || radius <= 0) return null;

  return <Circle cx={size / 2} cy={size / 2} r={radius * 0.62} fill={fill} />;
}
PolarAreaChartSkeleton.displayName = 'PolarAreaChart.Skeleton';
PolarAreaChartSkeleton.slot = 'svg' as const;

export interface PolarAreaChartHeaderProps extends ViewProps {
  className?: string;
  /** Small line above the value — what the chart is of. */
  title?: string;
  /** The readout. The largest thing on the card, and the first thing read. */
  value?: string;
  /** One muted line under the value — a period, a comparison, a caveat. */
  caption?: string;
  /** Prettier names for the wedges, keyed by their `label`. */
  labels?: Record<string, string>;
  /**
   * Draw a swatch and a name per wedge along the trailing edge.
   *
   * For two or three short names. Past that use `PolarAreaChart.Legend`, which
   * runs under the dial across the full width.
   */
  legend?: boolean;
  /** Trailing slot — a control, a badge, a range picker. Wins over `legend`. */
  children?: ReactNode;
}

/**
 * The strip above the dial: what the chart is of, what it reads, and what the
 * colours mean.
 *
 * The value is not derived here even though there are values to derive one
 * from, because the formatting is not the chart's to guess: 18420 is a count, a
 * currency or a duration depending on what was measured.
 */
function PolarAreaChartHeader({
  className,
  title,
  value,
  caption,
  labels,
  legend = false,
  children,
  ...props
}: PolarAreaChartHeaderProps) {
  const { data, colors } = useChart('PolarAreaChart.Header');
  const trailing =
    children ??
    (legend && data.length ? (
      <View className="flex-row flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {data.map((datum, index) => (
          <View key={`${datum.label}-${index}`} className="flex-row items-center gap-1.5">
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors[index],
              }}
            />
            <Text size="xs" muted numberOfLines={1}>
              {labels?.[datum.label] ?? datum.label}
            </Text>
          </View>
        ))}
      </View>
    ) : null);

  return (
    <View
      {...props}
      className={cn('flex-row items-start justify-between gap-3 pb-3', className)}
    >
      <View className="flex-1 gap-0.5">
        {title ? (
          <Text size="xs" muted>
            {title}
          </Text>
        ) : null}
        {value ? (
          <Text size="xl" weight="bold">
            {value}
          </Text>
        ) : null}
        {caption ? (
          <Text size="xs" muted>
            {caption}
          </Text>
        ) : null}
      </View>
      {trailing ? <View className="max-w-[55%] shrink pt-1">{trailing}</View> : null}
    </View>
  );
}
PolarAreaChartHeader.displayName = 'PolarAreaChart.Header';
PolarAreaChartHeader.slot = 'header' as const;

export const PolarAreaChart = Object.assign(PolarAreaChartRoot, {
  Header: PolarAreaChartHeader,
  Grid: PolarAreaChartGrid,
  Wedges: PolarAreaChartWedges,
  Labels: PolarAreaChartLabels,
  Tooltip: PolarAreaChartTooltip,
  Legend: PolarAreaChartLegend,
  Skeleton: PolarAreaChartSkeleton,
});
