/**
 * BarChart — categories compared by length, drawn and animated on the UI thread.
 *
 * Composed the same way `LineChart` is: the grid, each series, the axes and the
 * readout are separate children, so a chart that wants no grid simply does not
 * have one.
 *
 * ```tsx
 * <BarChart data={revenue} xDataKey="month">
 *   <BarChart.Grid />
 *   <BarChart.Bar dataKey="revenue" />
 *   <BarChart.XAxis />
 *   <BarChart.Tooltip />
 * </BarChart>
 * ```
 *
 * ## What is different from a line
 *
 * **The baseline is zero, and not negotiable.** A line's job is to show change,
 * so it may crop its axis to the range the data actually occupies. A bar's job
 * is to compare *lengths*, and a bar cropped at the bottom is a length that
 * lies — twice as tall no longer means twice as much. So the domain always
 * reaches zero unless `yDomain` says otherwise, and saying otherwise is opting
 * into a chart that misreads.
 *
 * **Bands, not points.** A line has a point at each x; a bar owns a slice of
 * width around it. `barGap` is the fraction of that slice left empty, so bars
 * stay proportional at any width instead of needing a pixel gap that is wrong
 * on half of them.
 *
 * **Every series is one path.** A `Bar` draws all its rectangles as subpaths of
 * a single animated path, split in two so the band under the finger keeps full
 * ink while the rest fade. Fifty bars is two animated props a frame rather
 * than fifty, and the corners are drawn as a path because a bar is rounded on
 * the end it grows towards and square on the end it grows from — which `rx`
 * cannot express, since it rounds all four corners or none.
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
import { StyleSheet, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { G, Line as SvgLine, Path } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Text } from '../../primitives/text';
import {
  barPath,
  columnValues,
  compactNumber,
  useSeriesColor,
  type Plot,
  type SeriesColorIndex,
} from '../../utils/chart';
import { cn } from '../../utils/cn';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Room left around the plot for the axis labels. */
const PADDING = { top: 12, right: 10, bottom: 22, left: 10 };

/**
 * Sideways, the category names run down the left instead of along the bottom,
 * so the room has to come off that side rather than off the bottom. Reserved
 * rather than overlaid: a name drawn on top of the bars is unreadable against
 * them and makes the bars unreadable too.
 */
const PADDING_SIDEWAYS = { top: 6, right: 10, bottom: 6, left: 68 };

/** Width the readout is laid out at, so it can be clamped inside the plot. */
const LABEL_WIDTH = 132;

/** Left gutter reserved when a `YAxis` is present, for its labels to sit in. */
const Y_AXIS_WIDTH = 40;

type Layer = 'svg' | 'overlay' | 'header';

export type BarChartStatus = 'loading' | 'ready';
export type BarChartOrientation = 'vertical' | 'horizontal';
export type BarChartDatum = Record<string, string | number | null | undefined>;

interface BarChartContextValue {
  data: BarChartDatum[];
  xDataKey: string;
  plot: Plot;
  status: BarChartStatus;
  orientation: BarChartOrientation;
  stacked: boolean;
  barGap: number;
  barWidth: number | undefined;
  stackGap: number;
  cornerRadius: number;
  minBarLength: number;
  fadedOpacity: number;
  series: [string, string][];
  registerSeries: (key: string, color: string) => void;
  unregisterSeries: (key: string) => void;
  domainMin: SharedValue<number>;
  domainMax: SharedValue<number>;
  /** The settled domain, for the parts that draw text rather than geometry. */
  extent: [number, number];
  /** 0 to 1 as the bars grow in. Shared, so they arrive as one chart. */
  reveal: SharedValue<number>;
  activeIndex: SharedValue<number>;
  activeIndexJS: number;
  setActiveIndexJS: (index: number) => void;
}

const BarChartContext = createContext<BarChartContextValue | null>(null);

function useChart(component: string): BarChartContextValue {
  const context = useContext(BarChartContext);
  if (!context) {
    throw new Error(`${component} must be used within a <BarChart>`);
  }
  return context;
}

/**
 * The band under the finger, for something rendered *inside* the chart. A
 * readout in the card's header is outside this provider — use
 * `onActiveIndexChange` for that.
 */
export function useBarChart() {
  const { data, activeIndexJS, xDataKey } = useChart('useBarChart');
  return {
    activeIndex: activeIndexJS,
    activePoint: activeIndexJS >= 0 ? (data[activeIndexJS] ?? null) : null,
    xDataKey,
  };
}

export interface BarChartProps extends ViewProps {
  className?: string;
  /** The rows. Each one is a band along the category axis. */
  data: BarChartDatum[];
  /** Key holding the category label. Used by the axis and the readout. */
  xDataKey?: string;
  /**
   * `loading` draws a row of flat placeholder bars and grows them into the real
   * ones when it turns `ready`. One component throughout, rather than a spinner
   * swapped for a chart — swapping loses the transition.
   */
  status?: BarChartStatus;
  /** Width ÷ height. `2` is the wide card shape. */
  aspectRatio?: number;
  /** Milliseconds for the bars to grow in on mount. */
  animationDuration?: number;
  /** Milliseconds for the value axis to settle after the data changes. */
  domainDuration?: number;
  /**
   * Fix the value axis instead of deriving it. Note that the derived domain
   * always includes zero, and a domain that does not is a bar chart whose
   * lengths cannot be compared — pass this only when you mean it.
   */
  yDomain?: [number, number];
  /** `vertical` grows the bars upward; `horizontal` grows them rightward. */
  orientation?: BarChartOrientation;
  /** Stack the series on each other instead of standing them side by side. */
  stacked?: boolean;
  /**
   * Fraction of each band left empty, `0` to `1`. A fraction rather than a
   * pixel gap so the proportions hold at any width.
   */
  barGap?: number;
  /** Fixed bar thickness in points. Derived from the band when omitted. */
  barWidth?: number;
  /** Points between the segments of a stack. */
  stackGap?: number;
  /** Corner radius on the growing end of a bar. */
  cornerRadius?: number;
  /**
   * Smallest length a non-zero bar is drawn at, in points. A value that rounds
   * to nothing still happened, and a bar of zero height says it did not.
   */
  minBarLength?: number;
  /** Opacity of the bars that are not under the finger. */
  fadedOpacity?: number;
  /**
   * The band under the finger as it moves, and `-1`/`null` when it lifts.
   * Fires when the index changes, not per frame.
   */
  onActiveIndexChange?: (index: number, datum: BarChartDatum | null) => void;
  /** Drop the axis padding, for a bar sparkline with no axis or readout. */
  compact?: boolean;
  children?: ReactNode;
}

/** Imperative handle: re-run the grow-in, for a "replay" control. */
export interface BarChartHandle {
  replay: () => void;
}

function partition(children: ReactNode) {
  const svg: ReactNode[] = [];
  const overlay: ReactNode[] = [];
  const header: ReactNode[] = [];
  Children.forEach(children, (child, index) => {
    if (!isValidElement(child)) return;
    const layer = (child.type as { layer?: Layer }).layer ?? 'svg';
    const slot = <ChildSlot key={index}>{child}</ChildSlot>;
    (layer === 'header' ? header : layer === 'overlay' ? overlay : svg).push(slot);
  });
  return { svg, overlay, header };
}

function ChildSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

const BarChartRoot = forwardRef<BarChartHandle, BarChartProps>(function BarChartRoot(
  {
    className,
    data,
    xDataKey = 'name',
    status = 'ready',
    aspectRatio = 2,
    animationDuration = 1100,
    domainDuration = 500,
    yDomain,
    orientation = 'vertical',
    stacked = false,
    barGap = 0.2,
    barWidth,
    stackGap = 0,
    cornerRadius = 4,
    minBarLength = 0,
    fadedOpacity = 0.3,
    onActiveIndexChange,
    compact = false,
    children,
    ...props
  },
  ref
) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [series, setSeries] = useState<[string, string][]>([]);
  const [activeIndexJS, setActiveIndexJS] = useState(-1);

  const reveal = useSharedValue(0);
  const domainMin = useSharedValue(0);
  const domainMax = useSharedValue(0);
  const activeIndex = useSharedValue(-1);
  const reducedMotion = useReducedMotion();

  const registerSeries = useMemo(
    () => (key: string, color: string) =>
      setSeries((current) => {
        const existing = current.find(([k]) => k === key);
        if (existing?.[1] === color) return current;
        return [...current.filter(([k]) => k !== key), [key, color]];
      }),
    []
  );

  const unregisterSeries = useMemo(
    () => (key: string) => setSeries((current) => current.filter(([k]) => k !== key)),
    []
  );

  /*
   * Whether an axis is asking for room. It has to be known before the plot is
   * laid out, and only the root sees the children early enough to ask — the
   * axis itself renders into a box that has already been decided.
   */
  const hasYAxis = useMemo(() => {
    let found = false;
    Children.forEach(children, (child) => {
      if (isValidElement(child) && (child.type as { axis?: string }).axis === 'y') {
        found = true;
      }
    });
    return found;
  }, [children]);

  const pad = compact
    ? { top: 2, right: 1, bottom: 2, left: 1 }
    : orientation === 'horizontal'
      ? PADDING_SIDEWAYS
      : { ...PADDING, left: hasYAxis ? Y_AXIS_WIDTH : PADDING.left };
  const plot: Plot = {
    left: pad.left,
    top: pad.top,
    width: Math.max(size.width - pad.left - pad.right, 0),
    height: Math.max(size.height - pad.top - pad.bottom, 0),
  };

  const seriesKeys = series.map(([key]) => key).join('|');
  const extent = useMemo<[number, number]>(() => {
    if (yDomain) return yDomain;
    const keys = seriesKeys ? seriesKeys.split('|') : [];
    let min = 0;
    let max = 0;

    for (const row of data) {
      // Stacked, the tall thing is the total; grouped, it is the tallest bar.
      // Reading the same number for both would crop a stack at its largest
      // segment and clip everything above it.
      let positive = 0;
      let negative = 0;
      for (const key of keys) {
        const value = row[key];
        if (typeof value !== 'number' || Number.isNaN(value)) continue;
        if (stacked) {
          if (value >= 0) positive += value;
          else negative += value;
        } else {
          if (value > positive) positive = value;
          if (value < negative) negative = value;
        }
      }
      if (positive > max) max = positive;
      if (negative < min) min = negative;
    }

    if (min === 0 && max === 0) return [0, 1];
    // Headroom above the tallest bar only. The zero end is left exactly where
    // it is: padding it would lift the bars off their own baseline.
    return [min === 0 ? 0 : min * 1.1, max === 0 ? 0 : max * 1.1];
  }, [data, yDomain, seriesKeys, stacked]);

  const loading = status === 'loading';

  useEffect(() => {
    if (loading) return;
    const [min, max] = extent;
    const first = domainMin.value === 0 && domainMax.value === 0;
    if (first || reducedMotion) {
      domainMin.value = min;
      domainMax.value = max;
      return;
    }
    domainMin.value = withTiming(min, { duration: domainDuration });
    domainMax.value = withTiming(max, { duration: domainDuration });
  }, [extent, loading, reducedMotion, domainDuration, domainMin, domainMax]);

  const revealed = useRef(false);
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

  useEffect(() => {
    if (revealed.current || loading || plot.width <= 0 || !data.length) return;
    revealed.current = true;
    playReveal();
  }, [loading, plot.width, data.length, playReveal]);

  useImperativeHandle(ref, () => ({ replay: playReveal }), [playReveal]);

  const handleActiveIndex = useMemo(
    () => (index: number) => {
      setActiveIndexJS(index);
      onActiveIndexChange?.(index, index >= 0 ? (data[index] ?? null) : null);
    },
    [onActiveIndexChange, data]
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
        ? current
        : { width, height }
    );
    props.onLayout?.(event);
  };

  const context = useMemo<BarChartContextValue>(
    () => ({
      data,
      xDataKey,
      plot,
      status,
      orientation,
      stacked,
      barGap,
      barWidth,
      stackGap,
      cornerRadius,
      minBarLength,
      fadedOpacity,
      series,
      registerSeries,
      unregisterSeries,
      domainMin,
      domainMax,
      extent,
      reveal,
      activeIndex,
      activeIndexJS,
      setActiveIndexJS: handleActiveIndex,
    }),
    // `plot` is rebuilt every render from `size`, so it is compared by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      data,
      xDataKey,
      plot.width,
      plot.height,
      plot.left,
      plot.top,
      status,
      orientation,
      stacked,
      barGap,
      barWidth,
      stackGap,
      cornerRadius,
      minBarLength,
      fadedOpacity,
      series,
      registerSeries,
      unregisterSeries,
      domainMin,
      domainMax,
      extent,
      reveal,
      activeIndex,
      activeIndexJS,
      handleActiveIndex,
    ]
  );

  const { svg, overlay, header } = partition(children);

  /*
   * Two views, because the header is not part of the plot. `aspectRatio` and
   * the layout measurement belong to the drawing area alone — measured on the
   * outer view they would take in the header too, and the plot would lose as
   * much height as the readout took while still claiming the shape asked for.
   */
  return (
    <BarChartContext.Provider value={context}>
      <View {...props} style={props.style} className={cn('w-full', className)}>
        {header}
        <View onLayout={onLayout} style={{ aspectRatio }} className="w-full">
          {plot.width > 0 ? (
            <>
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                {svg}
              </Svg>
              {overlay}
            </>
          ) : null}
        </View>
      </View>
    </BarChartContext.Provider>
  );
});
BarChartRoot.displayName = 'BarChart';

/* -------------------------------------------------------------------------- */
/* SVG layer                                                                  */
/* -------------------------------------------------------------------------- */

export interface BarChartGridProps {
  /** How many lines to draw across the value axis. */
  rows?: number;
  color?: string;
  dashArray?: string;
  opacity?: number;
}

/**
 * Lines across the value axis, so a bar can be read against a number rather
 * than only against the bar beside it.
 */
function BarChartGrid({ rows = 4, color, dashArray = '4,6', opacity = 1 }: BarChartGridProps) {
  const { plot, orientation } = useChart('BarChart.Grid');
  const token = useCSSVariable('--color-border');
  const stroke = color ?? (typeof token === 'string' ? token : 'rgba(0,0,0,0.1)');

  const lines = Array.from({ length: rows + 1 }, (_unused, index) => index / rows);

  return (
    <G opacity={opacity}>
      {lines.map((fraction) =>
        orientation === 'vertical' ? (
          <SvgLine
            key={fraction}
            x1={plot.left}
            x2={plot.left + plot.width}
            y1={plot.top + plot.height * fraction}
            y2={plot.top + plot.height * fraction}
            stroke={stroke}
            strokeDasharray={dashArray}
            strokeWidth={1}
          />
        ) : (
          <SvgLine
            key={fraction}
            x1={plot.left + plot.width * fraction}
            x2={plot.left + plot.width * fraction}
            y1={plot.top}
            y2={plot.top + plot.height}
            stroke={stroke}
            strokeDasharray={dashArray}
            strokeWidth={1}
          />
        )
      )}
    </G>
  );
}
BarChartGrid.displayName = 'BarChart.Grid';
BarChartGrid.layer = 'svg' as Layer;

export interface BarChartBarProps {
  /** Column in the data holding this series' values. */
  dataKey: string;
  /** Explicit colour. Defaults to the `--color-chart-*` token for `colorIndex`. */
  color?: string;
  /** Which of the five chart tokens to take. */
  colorIndex?: SeriesColorIndex;
  /** Corner radius, overriding the chart's. */
  cornerRadius?: number;
}

/**
 * One series of bars.
 *
 * Drawn as two paths rather than one rectangle per band: the band under the
 * finger, and everything else. That is the fewest animated props that can
 * still dim the rest — one path could not, since a path has one opacity, and
 * a view per bar would be one animated prop per bar for the same picture.
 */
function BarChartBar({ dataKey, color, colorIndex = 1, cornerRadius }: BarChartBarProps) {
  const {
    data,
    plot,
    status,
    orientation,
    stacked,
    barGap,
    barWidth,
    stackGap,
    cornerRadius: chartRadius,
    minBarLength,
    fadedOpacity,
    series,
    registerSeries,
    unregisterSeries,
    domainMin,
    domainMax,
    reveal,
    activeIndex,
  } = useChart('BarChart.Bar');

  const fill = useSeriesColor(color, colorIndex);
  const radius = cornerRadius ?? chartRadius;

  useEffect(() => {
    registerSeries(dataKey, fill);
    return () => unregisterSeries(dataKey);
  }, [dataKey, fill, registerSeries, unregisterSeries]);

  const values = useMemo(() => columnValues(data, dataKey), [data, dataKey]);

  /*
   * What each bar in this series sits on. Grouped, that is nothing — every bar
   * starts at zero. Stacked, it is the running total of the series registered
   * *before* this one, which is why registration order is the stacking order.
   */
  const baselines = useMemo(() => {
    if (!stacked) return null;
    const below = series.slice(0, series.findIndex(([key]) => key === dataKey));
    if (!below.length) return null;
    return data.map((row) => {
      let total = 0;
      for (const [key] of below) {
        const value = row[key];
        if (typeof value === 'number' && !Number.isNaN(value)) total += value;
      }
      return total;
    });
  }, [stacked, series, dataKey, data]);

  const seriesIndex = Math.max(
    0,
    series.findIndex(([key]) => key === dataKey)
  );
  const seriesCount = Math.max(1, series.length);
  const loading = status === 'loading';
  const total = data.length;
  const horizontal = orientation === 'horizontal';

  /*
   * Both paths come out of one builder, filtered by whether the band is the
   * active one. Two passes over the data a frame is still cheaper than the
   * bookkeeping needed to build both at once, and it keeps the geometry in
   * exactly one place.
   */
  const build = (wantActive: boolean) => () => {
    'worklet';
    if (!total || plot.width <= 0) {
      return { d: '', opacity: 1 };
    }

    // The category axis runs across the plot when the bars grow up, and down
    // it when they grow right. `along` is that axis; `across` is the value one.
    const along = horizontal ? plot.height : plot.width;
    const across = horizontal ? plot.width : plot.height;
    const alongStart = horizontal ? plot.top : plot.left;
    const acrossStart = horizontal ? plot.left : plot.top;

    const band = along / total;
    // The slot a single bar gets: the band, less the gap, divided between the
    // series when they stand side by side.
    const usable = band * (1 - barGap);
    const slot = stacked ? usable : usable / seriesCount;
    const thickness = Math.min(barWidth ?? slot, slot);

    const min = domainMin.value;
    const max = domainMax.value;
    const range = max - min || 1;
    const grow = reveal.value;
    const active = activeIndex.value;

    /*
     * Where a value sits along the value axis. Vertical counts down from the
     * top, horizontal counts up from the left — the same scale read in
     * opposite directions, which is the only thing orientation changes.
     */
    const project = (value: number) => {
      'worklet';
      const fraction = (value - min) / range;
      return horizontal
        ? acrossStart + fraction * across
        : acrossStart + across - fraction * across;
    };

    let d = '';

    for (let i = 0; i < total; i++) {
      if ((i === active) !== wantActive) continue;

      const value = values[i];
      if (value === null || value === undefined) continue;

      const base = baselines?.[i] ?? 0;
      /*
       * Staggered by band, but every bar still finishes inside the one
       * duration: the window each gets is what is left after the stagger, so
       * a chart of fifty bands does not take fifty times as long to arrive.
       */
      const start = total > 1 ? (i / total) * 0.45 : 0;
      const eased = Math.max(0, Math.min(1, (grow - start) / 0.55));
      const shown = loading ? 0 : value * eased;

      const zero = project(base);
      const tip = project(base + shown);
      const shrink = stacked && stackGap > 0 ? stackGap : 0;
      let length = Math.abs(tip - zero) - shrink;
      // A value that rounds to nothing still happened, and a bar of zero
      // length says it did not.
      if (minBarLength > 0 && shown !== 0 && length < minBarLength) {
        length = minBarLength;
      }
      if (length <= 0) continue;

      const offset =
        (stacked ? 0 : seriesIndex * slot) + (band - usable) / 2 + (slot - thickness) / 2;
      const lead = alongStart + i * band + offset;
      const positive = shown >= 0;

      d += horizontal
        ? barPath(
            positive ? zero : zero - length,
            lead,
            length,
            thickness,
            radius,
            positive ? 'right' : 'left'
          )
        : barPath(
            lead,
            positive ? zero - length : zero,
            thickness,
            length,
            radius,
            positive ? 'up' : 'down'
          );
    }

    // Dimming only happens while something *is* active; with nothing under the
    // finger every bar is at full ink, which is the resting state.
    const dim = !wantActive && active >= 0 ? fadedOpacity : 1;
    return { d, opacity: dim };
  };

  const restProps = useAnimatedProps(build(false));
  const activeProps = useAnimatedProps(build(true));

  return (
    <G>
      <AnimatedPath animatedProps={restProps} fill={fill} />
      <AnimatedPath animatedProps={activeProps} fill={fill} />
    </G>
  );
}
BarChartBar.displayName = 'BarChart.Bar';
BarChartBar.layer = 'svg' as Layer;

/* -------------------------------------------------------------------------- */
/* Overlay layer                                                              */
/* -------------------------------------------------------------------------- */

export interface BarChartXAxisProps {
  /** How many labels to show. The rest are dropped, evenly. */
  ticks?: number;
  /** Turn a row into its label. Defaults to the value at `xDataKey`. */
  format?: (datum: BarChartDatum, index: number) => string;
  className?: string;
}

/**
 * The category labels, one under each band it has room for. Real text rather
 * than SVG text, so they follow the theme's font and the platform's text
 * scaling — SVG text does neither.
 */
function BarChartXAxis({ ticks = 6, format, className }: BarChartXAxisProps) {
  const { data, xDataKey, plot, orientation } = useChart('BarChart.XAxis');

  const labels = useMemo(() => {
    if (!data.length) return [];
    const count = Math.min(ticks, data.length);
    const step = count > 1 ? (data.length - 1) / (count - 1) : 0;
    return Array.from({ length: count }, (_unused, index) => {
      const dataIndex = Math.round(index * step);
      const datum = data[dataIndex];
      if (!datum) return null;
      return {
        key: dataIndex,
        text: format ? format(datum, dataIndex) : String(datum[xDataKey] ?? ''),
      };
    }).filter((label): label is { key: number; text: string } => label !== null);
  }, [data, ticks, format, xDataKey]);

  if (orientation === 'horizontal') return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: plot.left,
        right: PADDING.right,
        bottom: 0,
        height: PADDING.bottom,
      }}
      className={cn('flex-row items-center justify-between', className)}
    >
      {labels.map((label) => (
        <Text key={label.key} size="xs" muted numberOfLines={1}>
          {label.text}
        </Text>
      ))}
    </View>
  );
}
BarChartXAxis.displayName = 'BarChart.XAxis';
BarChartXAxis.layer = 'overlay' as Layer;

export interface BarChartYAxisProps {
  /** How many labels to show along the value axis. */
  ticks?: number;
  /** Format a value for its label. Defaults to a compact number. */
  format?: (value: number) => string;
  className?: string;
}

/** Value labels down the side, aligned to the grid lines. */
function BarChartYAxis({ ticks = 4, format, className }: BarChartYAxisProps) {
  const { plot, data, xDataKey, orientation, extent } = useChart('BarChart.YAxis');

  /*
   * Read off the settled domain rather than the shared values the paths use.
   * A label is text, and text is JS — following the tween would re-render on
   * every frame of it to redraw a number nobody can read while it moves.
   */
  const horizontal = orientation === 'horizontal';

  const labels = useMemo(() => {
    if (horizontal) {
      // Sideways, the side of the chart is the category axis.
      return data.map((row, index) => ({
        key: index,
        text: String(row[xDataKey] ?? ''),
      }));
    }
    const [min, max] = extent;
    if (min === 0 && max === 0) return [];
    return Array.from({ length: ticks + 1 }, (_unused, index) => {
      const value = max - ((max - min) * index) / ticks;
      return { key: index, text: format ? format(value) : compactNumber(value) };
    });
  }, [extent, ticks, format, horizontal, data, xDataKey]);

  /*
   * Sideways the labels sit in the gutter the plot already left for them, one
   * band each — `flex-1` per row rather than spacing them edge to edge, so
   * every name lands beside its own bar instead of only the first and last
   * doing so. Upright there are no bands to line up with, so the ticks space
   * themselves against the grid.
   */
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: plot.top,
        height: plot.height,
        width: horizontal ? Math.max(plot.left - 8, 0) : undefined,
      }}
      className={cn(horizontal ? 'items-end' : 'justify-between', className)}
    >
      {labels.map((label) => (
        <View
          key={label.key}
          className={horizontal ? 'flex-1 justify-center' : undefined}
        >
          <Text size="xs" muted numberOfLines={1}>
            {label.text}
          </Text>
        </View>
      ))}
    </View>
  );
}
BarChartYAxis.displayName = 'BarChart.YAxis';
BarChartYAxis.layer = 'overlay' as Layer;
// Read by the root, which has to leave room for the labels before it
// lays the plot out — an axis drawn over the plot is unreadable, and
// makes what it is drawn over unreadable too.
BarChartYAxis.axis = 'y' as const;

export interface BarChartTooltipProps {
  /** Format one series' value. Defaults to a compact number. */
  formatValue?: (value: number, key: string) => string;
  /** Format the readout's heading from the row. Defaults to the value at xDataKey. */
  formatX?: (datum: BarChartDatum) => string;
  className?: string;
}

/**
 * The readout, and the gesture that drives it.
 *
 * There is no crosshair. A line needs one because a point on a line has no
 * width of its own to point at; a bar is already the thing being pointed at,
 * so highlighting it and dimming the rest says the same thing without drawing
 * a line through the chart.
 *
 * The hit area is the whole plot. A readout you have to land on the bar to
 * summon is a readout nobody finds — and the thinner the bars, the truer that
 * gets.
 */
function BarChartTooltip({ formatValue, formatX, className }: BarChartTooltipProps) {
  const {
    data,
    xDataKey,
    plot,
    series,
    orientation,
    activeIndex,
    activeIndexJS,
    setActiveIndexJS,
    status,
  } = useChart('BarChart.Tooltip');

  const total = data.length;
  const horizontal = orientation === 'horizontal';
  const left = plot.left;
  const top = plot.top;
  const width = plot.width;
  const height = plot.height;

  /*
   * Declared inside the memo, next to its callers: a worklet may only call
   * another worklet, and the rule is enforced by crashing rather than warning.
   */
  const pan = useMemo(() => {
    const resolve = (x: number, y: number) => {
      'worklet';
      if (!total) return;
      const span = horizontal ? height : width;
      const offset = (horizontal ? y - top : x - left) / (span || 1);
      // Bands, not points: the finger is inside whichever slice it lands on,
      // which is a floor rather than a round to the nearest centre.
      const next = Math.max(0, Math.min(total - 1, Math.floor(offset * total)));
      if (next === activeIndex.value) return;
      activeIndex.value = next;
      runOnJS(setActiveIndexJS)(next);
    };

    return Gesture.Pan()
      .minDistance(0)
      .onBegin((event) => {
        'worklet';
        resolve(event.x, event.y);
      })
      .onUpdate((event) => {
        'worklet';
        resolve(event.x, event.y);
      })
      .onFinalize(() => {
        'worklet';
        activeIndex.value = -1;
        runOnJS(setActiveIndexJS)(-1);
      });
  }, [total, left, top, width, height, horizontal, activeIndex, setActiveIndexJS]);

  // The readout centres over its band and is clamped inside the plot, so it
  // never runs off the edge at the first or last one.
  const labelStyle = useAnimatedStyle(() => {
    const index = activeIndex.value;
    if (index < 0 || !total) return { opacity: 0 };
    const band = (horizontal ? plot.height : plot.width) / total;
    const centre = (horizontal ? plot.top : plot.left) + band * (index + 0.5);
    const half = LABEL_WIDTH / 2;
    const clamped = Math.min(
      plot.left + plot.width - half,
      Math.max(plot.left + half, horizontal ? plot.left + plot.width / 2 : centre)
    );
    return { opacity: 1, transform: [{ translateX: clamped - half }] };
  });

  const active = activeIndexJS >= 0 ? data[activeIndexJS] : null;
  const fmtValue = formatValue ?? ((value: number) => compactNumber(value));
  const fmtX = formatX ?? ((datum: BarChartDatum) => String(datum[xDataKey] ?? ''));

  if (status === 'loading') return null;

  return (
    <GestureDetector gesture={pan}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: 0, top: 0, width: LABEL_WIDTH },
            labelStyle,
          ]}
        >
          {active ? (
            <View
              className={cn(
                'rounded-xl border border-border bg-popover px-2.5 py-1.5 shadow-lg',
                className
              )}
            >
              <Text size="xs" muted numberOfLines={1}>
                {fmtX(active)}
              </Text>
              {series.map(([key, color]) => {
                const value = active[key];
                if (typeof value !== 'number') return null;
                return (
                  <View key={key} className="flex-row items-center gap-1.5">
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: color,
                      }}
                    />
                    <Text size="xs" weight="medium">
                      {fmtValue(value, key)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
BarChartTooltip.displayName = 'BarChart.Tooltip';
BarChartTooltip.layer = 'overlay' as Layer;

export interface BarChartLegendProps extends ViewProps {
  className?: string;
  /** Prettier names for the series keys. */
  labels?: Record<string, string>;
}

/** One series' colour and name. Shared by the legend and the header. */
function SeriesSwatch({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ backgroundColor: color }} className="h-2 w-2 rounded-full" />
      <Text size="xs" muted>
        {label}
      </Text>
    </View>
  );
}

/** A swatch and a name per series, in the order the series were declared. */
function BarChartLegend({ className, labels, ...props }: BarChartLegendProps) {
  const { series } = useChart('BarChart.Legend');
  if (!series.length) return null;

  return (
    <View
      {...props}
      style={[{ pointerEvents: 'none' }, props.style]}
      className={cn('absolute right-2 top-1 flex-row gap-3', className)}
    >
      {series.map(([key, color]) => (
        <SeriesSwatch key={key} color={color} label={labels?.[key] ?? key} />
      ))}
    </View>
  );
}
BarChartLegend.displayName = 'BarChart.Legend';
BarChartLegend.layer = 'overlay' as Layer;

/* -------------------------------------------------------------------------- */
/* Header layer                                                               */
/* -------------------------------------------------------------------------- */

export interface BarChartHeaderProps extends ViewProps {
  className?: string;
  /** Small line above the value — what the chart is of. */
  title?: string;
  /** The readout. The largest thing on the card, and the first thing read. */
  value?: string;
  /** One muted line under the value — a period, a comparison, a total. */
  caption?: string;
  /** Prettier names for the series keys, as the legend takes. */
  labels?: Record<string, string>;
  /**
   * Draw a swatch and a name per series along the trailing edge. Prefer this to
   * `BarChart.Legend` on a chart that has a header: the legend floats over the
   * plot, where it competes with the bars for the same corner.
   */
  legend?: boolean;
  /** Trailing slot — a control, a badge, a range picker. Wins over `legend`. */
  children?: ReactNode;
}

/**
 * The strip above the plot: what the chart is of, what it currently reads, and
 * what the colours mean.
 *
 * It belongs to the chart rather than to the card around it because it is about
 * the *plot* — the number changes as a finger moves along the bars, and the
 * legend is the series list the chart itself is holding. The card's header is a
 * caption on the tray the chart sits in; this is the chart introducing itself.
 *
 * The value is not derived here. A readout that follows the finger belongs to
 * whoever owns the data — take it from `onActiveIndexChange` and pass the
 * formatted string down, so one header can show a total when nothing is pressed
 * and a band's value when something is.
 */
function BarChartHeader({
  className,
  title,
  value,
  caption,
  labels,
  legend = false,
  children,
  ...props
}: BarChartHeaderProps) {
  const { series } = useChart('BarChart.Header');
  const trailing =
    children ??
    (legend && series.length ? (
      <View className="flex-row flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {series.map(([key, color]) => (
          <SeriesSwatch key={key} color={color} label={labels?.[key] ?? key} />
        ))}
      </View>
    ) : null);

  return (
    <View
      {...props}
      className={cn('flex-row items-start justify-between gap-3 pb-2', className)}
    >
      <View className="shrink gap-0.5">
        {title ? (
          <Text size="xs" muted>
            {title}
          </Text>
        ) : null}
        {value ? (
          <Text size="2xl" weight="bold">
            {value}
          </Text>
        ) : null}
        {caption ? (
          <Text size="sm" muted>
            {caption}
          </Text>
        ) : null}
      </View>
      {trailing ? <View className="shrink-0 pt-1">{trailing}</View> : null}
    </View>
  );
}
BarChartHeader.displayName = 'BarChart.Header';
BarChartHeader.layer = 'header' as Layer;

export const BarChart = Object.assign(BarChartRoot, {
  Header: BarChartHeader,
  Grid: BarChartGrid,
  Bar: BarChartBar,
  XAxis: BarChartXAxis,
  YAxis: BarChartYAxis,
  Tooltip: BarChartTooltip,
  Legend: BarChartLegend,
});
