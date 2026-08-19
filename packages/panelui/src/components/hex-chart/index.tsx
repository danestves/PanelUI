/**
 * HexChart — a whole broken into parts, counted out in cells.
 *
 * ```tsx
 * <HexChart data={attribution}>
 *   <HexChart.Header title="Attributed revenue" value="$6,750" />
 *   <HexChart.Cells />
 *   <HexChart.Legend />
 * </HexChart>
 * ```
 *
 * ## What it is, against the pie beside it
 *
 * Both divide one total. The difference is what the reader has to do to read a
 * share off it. A pie asks them to compare angles, which is the hardest
 * quantity there is to judge by eye; this asks them to compare *counts*, and a
 * count is something anyone can check by looking. A series holding a tenth of
 * the cells looks like a tenth and can be confirmed as one, which is why this
 * is the better shape for a split someone is going to quote.
 *
 * What it gives up is precision at the small end. Every cell is a whole unit,
 * so a series worth half a cell either rounds up to a full one or vanishes. It
 * is a chart for shares of a few percent and up, not for a long tail.
 *
 * ## The field
 *
 * The cells are pointy-top hexagons on an offset grid, so each row nests half a
 * cell into the one above it. The unfilled cells are drawn too, in the muted
 * token: the field is the denominator made visible, and a honeycomb floating on
 * nothing gives the eye no total to read the coloured part against.
 *
 * `shape` decides how the filled cells are arranged. `grid` is reading order,
 * which is the arrangement a reader can actually count off. `blob` grows the
 * series out from the middle of the field instead — the smallest in the centre,
 * each larger one wrapped around it — which counts for nothing but shows the
 * shape of the split at a glance. The blob's edge is ragged by design, and
 * ragged the *same way* every time: the nudge that roughens it is a hash of
 * each cell's own coordinates rather than a random number, so a re-render is
 * not an animation and the same data screenshots twice.
 *
 * Cell counts are apportioned by largest remainder, so they add up to the
 * budget exactly. A honeycomb whose parts came to one less than the whole would
 * have a cell in it that nothing in the data accounts for.
 *
 * ## Drawing and animating
 *
 * Two hundred cells is two hundred nodes if each one is drawn on its own, which
 * is more than this needs to spend. Every cell belonging to a series is
 * concatenated into a *single* path instead, so the whole chart is one node per
 * series plus one for the unfilled field — six or seven, whatever the cell
 * count.
 *
 * That is also why the reveal is a clip rather than a per-cell stagger: the
 * cells are no longer separate things to stagger. An ellipse grows from the
 * centre of the field, in the field's own proportions, so the honeycomb is
 * uncovered in the order the blob grew in — which is the same effect a stagger
 * would have given, for one animated value instead of two hundred. A `grid`
 * wipes across instead, because that is the order its cells were filled in.
 *
 * Touch, not hover: a series is selected by pressing one of its cells, and
 * pressing it again clears the selection. There is no equivalent of a pointer
 * resting somewhere without committing, so a chart that only revealed its
 * numbers on hover would never reveal them at all.
 *
 * Colours come from the `--color-chart-*` tokens, so a chart follows the active
 * theme and is put on brand by overriding those five. Nothing here hardcodes a
 * hex.
 */
import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Pressable,
  View,
  type LayoutChangeEvent,
  type ViewProps,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Text } from '../../primitives/text';
import {
  compactNumber,
  hexAt,
  hexCenter,
  hexFillOrder,
  hexMetrics,
  hexPath,
  hexRadiusFor,
  hexRowsFor,
  shareCounts,
  useSeriesColor,
  type ChartPoint,
  type HexMetrics,
  type HexShape,
} from '../../utils/chart';
import { cn } from '../../utils/cn';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** Where a child is drawn: inside the SVG, over it, above it, or under it. */
type Slot = 'svg' | 'overlay' | 'header' | 'footer';

/** Whether the chart is showing data or waiting for it. */
export type HexChartStatus = 'loading' | 'ready';

export type { HexShape };

/** One series. Its share is worked out from the others, so there is no maximum. */
export interface HexDatum {
  /** Name for the legend, the readout and the accessibility label. */
  label: string;
  /** How much of the whole this series is. Negatives are treated as zero. */
  value: number;
  /** Explicit colour, overriding the `--color-chart-*` token. */
  color?: string;
}

/** Everything the layout works out once, and every part then reads. */
interface HexPlan {
  /** One concatenated path per series, index-aligned with the data. */
  paths: string[];
  /** Every cell no series took, as one path. */
  field: string;
  /** Cells per series, index-aligned with the data. */
  counts: number[];
  /**
   * Where a label for each series goes: the middle of its cells across, and
   * the top of them down. A label centred on the cells would cover the ones it
   * is naming, so it is hung above them instead.
   */
  labelAnchors: ChartPoint[];
  /** Which series owns each cell, by `row * columns + column`. `-1` is unfilled. */
  owners: number[];
}

const EMPTY_PLAN: HexPlan = {
  paths: [],
  field: '',
  counts: [],
  labelAnchors: [],
  owners: [],
};

interface HexChartContextValue {
  data: HexDatum[];
  /** Everything the values add up to. Zero when there is nothing to show. */
  total: number;
  width: number;
  height: number;
  metrics: HexMetrics;
  columns: number;
  rows: number;
  /** Where the field starts inside the box, after it is centred in it. */
  left: number;
  top: number;
  plan: HexPlan;
  colors: string[];
  status: HexChartStatus;
  clipId: string;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

const HexChartContext = createContext<HexChartContextValue | null>(null);

function useChart(component: string): HexChartContextValue {
  const context = useContext(HexChartContext);
  if (!context) {
    throw new Error(`${component} must be used within a <HexChart>`);
  }
  return context;
}

/** The selected series and its share, for something rendered inside the chart. */
export function useHexChart() {
  const { data, plan, total, activeIndex } = useChart('useHexChart');
  const series = activeIndex >= 0 ? (data[activeIndex] ?? null) : null;
  return {
    activeIndex,
    activeSeries: series,
    /** Its share of the whole, 0 to 1. */
    activeFraction: series && total > 0 ? Math.max(0, series.value) / total : 0,
    /** How many cells it was given, which is what the reader can count. */
    activeCells: activeIndex >= 0 ? (plan.counts[activeIndex] ?? 0) : 0,
  };
}

export interface HexChartProps extends ViewProps {
  className?: string;
  /** One entry per series. */
  data: HexDatum[];
  /**
   * Cells across the field. The cell size follows from it and the measured
   * width, so this is the one knob for how fine the honeycomb is.
   *
   * More cells resolve a smaller share — twenty-one across a phone is around
   * two hundred and fifty in the field, so roughly a half a percent each — at
   * the cost of every cell getting smaller and harder to press.
   */
  columns?: number;
  /** Width over height of the field. */
  aspectRatio?: number;
  /**
   * How much of the field the series fill, 0 to 1.
   *
   * Only meaningful with `shape="blob"`, where the unfilled cells are the
   * margin the blob is read against; a `grid` fills every cell, because a
   * waffle with a ragged last row is a waffle that has stopped being countable.
   */
  density?: number;
  /** How the filled cells are arranged. */
  shape?: HexShape;
  /**
   * The gap between cells, as a share of the cell radius. Given as a share so
   * the field keeps its proportions at whatever size it is measured at.
   */
  cellGap?: number;
  /** Milliseconds for the honeycomb to fill in. */
  animationDuration?: number;
  /** `loading` draws the field with nothing divided up yet. */
  status?: HexChartStatus;
  /** Selected series. Leave unset to let the chart track it. */
  activeIndex?: number;
  /** Fires with the selected series, or `-1` when the selection is cleared. */
  onActiveIndexChange?: (index: number) => void;
  children?: ReactNode;
}

/** Imperative handle: re-run the fill, for a "replay" control. */
export interface HexChartHandle {
  replay: () => void;
}

/**
 * How far past the field the reveal has to reach to cover its corners.
 *
 * An ellipse with semi-axes `a`, `b` contains the box `2w × 2h` only when
 * `(w/a)² + (h/b)² ≤ 1`; growing both axes in the box's own proportions makes
 * that `2/k² ≤ 1`. Stopping at the edges instead would leave the four corner
 * cells of a `grid` uncovered for good.
 */
const CORNER_REACH = Math.SQRT2;

const HexChartRoot = forwardRef<HexChartHandle, HexChartProps>(function HexChartRoot(
  {
    className,
    data,
    columns = 21,
    aspectRatio = 1.6,
    density = 0.55,
    shape = 'blob',
    cellGap = 0.14,
    animationDuration = 620,
    status = 'ready',
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
  const clipId = `panelui-hex-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const controlled = activeIndexProp !== undefined;
  const activeIndex = controlled ? activeIndexProp : internalActive;

  const setActiveIndex = useMemo(
    () => (index: number) => {
      if (!controlled) setInternalActive(index);
      onActiveIndexChange?.(index);
    },
    [controlled, onActiveIndexChange]
  );

  const width = measured;
  const height = aspectRatio > 0 ? width / aspectRatio : 0;

  const total = useMemo(
    () => data.reduce((sum, series) => sum + Math.max(0, series.value), 0),
    [data]
  );

  const columnCount = Math.max(1, Math.round(columns));
  const metrics = useMemo(
    () => hexMetrics(hexRadiusFor(width, columnCount)),
    [width, columnCount]
  );
  const rows = useMemo(() => hexRowsFor(height, metrics), [height, metrics]);

  // The field rarely comes out exactly the size of the box — the rows are a
  // whole number and the height is not — so what is left over is split either
  // side of it rather than left at the bottom.
  const fieldWidth = metrics.stepX * (columnCount + 0.5);
  const fieldHeight = (rows - 1) * metrics.stepY + metrics.height;
  const left = (width - fieldWidth) / 2;
  const top = (height - fieldHeight) / 2;

  const loading = status === 'loading';

  const plan = useMemo<HexPlan>(() => {
    if (metrics.radius <= 0 || rows <= 0 || !data.length) return EMPTY_PLAN;

    const cells = hexFillOrder(columnCount, rows, shape);
    const capacity = columnCount * rows;
    // Loading has no split to show yet, so nothing is taken and the whole field
    // is left for the skeleton to draw.
    const budget = loading
      ? 0
      : shape === 'grid'
        ? capacity
        : Math.max(0, Math.min(capacity, Math.round(capacity * density)));

    const counts = shareCounts(
      data.map((series) => series.value),
      budget
    );

    /*
     * Smallest first for a blob, so the series that is hardest to find gets the
     * middle — where it is most findable — and each larger one wraps around it.
     * Data order for a grid, where reading order is the entire point of the
     * arrangement and reordering it would break the count.
     */
    const sequence = data.map((_, index) => index);
    if (shape === 'blob') {
      sequence.sort((a, b) => counts[a]! - counts[b]! || a - b);
    }

    const radius = metrics.radius * (1 - Math.max(0, Math.min(cellGap, 0.5)));
    const owners = new Array<number>(capacity).fill(-1);
    const paths = data.map(() => '');
    const sums = data.map(() => ({ x: 0, highest: Infinity }));

    let cursor = 0;
    for (const series of sequence) {
      for (let n = 0; n < counts[series]!; n += 1) {
        const cell = cells[cursor];
        cursor += 1;
        if (!cell) break;
        owners[cell.row * columnCount + cell.column] = series;
        const centre = hexCenter(cell.column, cell.row, metrics, left, top);
        paths[series] += hexPath(centre.x, centre.y, radius);
        sums[series]!.x += centre.x;
        sums[series]!.highest = Math.min(sums[series]!.highest, centre.y);
      }
    }

    let field = '';
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        if (owners[row * columnCount + column]! >= 0) continue;
        const centre = hexCenter(column, row, metrics, left, top);
        field += hexPath(centre.x, centre.y, radius);
      }
    }

    const labelAnchors = sums.map((sum, index) => {
      const count = counts[index] ?? 0;
      if (count <= 0) return { x: left + fieldWidth / 2, y: top };
      // The top edge of the series' highest cell, not its centre — the anchor
      // is what the label is hung *from*, and half a cell of overlap is still
      // overlap.
      return { x: sum.x / count, y: sum.highest - metrics.radius };
    });

    return { paths, field, counts, labelAnchors, owners };
  }, [
    data,
    metrics,
    rows,
    columnCount,
    shape,
    density,
    cellGap,
    left,
    top,
    fieldWidth,
    fieldHeight,
    loading,
  ]);

  const playReveal = useMemo(
    () => () => {
      if (reducedMotion) {
        reveal.value = 1;
        return;
      }
      reveal.value = 0;
      reveal.value = withTiming(1, {
        duration: animationDuration,
        easing: Easing.out(Easing.cubic),
      });
    },
    [reducedMotion, animationDuration, reveal]
  );

  const revealed = useRef(false);

  useEffect(() => {
    if (loading) {
      revealed.current = false;
      reveal.value = 0;
      return;
    }
    if (revealed.current || width <= 0 || !data.length) return;
    revealed.current = true;
    playReveal();
  }, [loading, width, data.length, playReveal, reveal]);

  useImperativeHandle(ref, () => ({ replay: playReveal }), [playReveal]);

  // Resolved here rather than inside the cells, so the legend, the header and
  // the tooltip can name a series' colour without drawing one.
  const c1 = useSeriesColor(undefined, 1);
  const c2 = useSeriesColor(undefined, 2);
  const c3 = useSeriesColor(undefined, 3);
  const c4 = useSeriesColor(undefined, 4);
  const c5 = useSeriesColor(undefined, 5);
  const palette = useMemo(() => [c1, c2, c3, c4, c5], [c1, c2, c3, c4, c5]);
  const colors = useMemo(
    () => data.map((series, index) => series.color ?? palette[index % palette.length]!),
    [data, palette]
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== measured) setMeasured(next);
    props.onLayout?.(event);
  };

  const ellipseProps = useAnimatedProps(() => ({
    rx: (fieldWidth / 2) * CORNER_REACH * reveal.value,
    ry: (fieldHeight / 2) * CORNER_REACH * reveal.value,
  }));

  const rectProps = useAnimatedProps(() => ({ width: width * reveal.value }));

  const context = useMemo<HexChartContextValue>(
    () => ({
      data,
      total,
      width,
      height,
      metrics,
      columns: columnCount,
      rows,
      left,
      top,
      plan,
      colors,
      status,
      clipId,
      activeIndex,
      setActiveIndex,
    }),
    [
      data,
      total,
      width,
      height,
      metrics,
      columnCount,
      rows,
      left,
      top,
      plan,
      colors,
      status,
      clipId,
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
    slots[slot in slots ? slot : 'overlay'].push(
      <ChildSlot key={index}>{child}</ChildSlot>
    );
  });

  return (
    <HexChartContext.Provider value={context}>
      {/*
       * Two views, because the header is not part of the field. The aspect
       * ratio and the layout measurement belong to the drawing area alone —
       * measured on the outer view they would take in the header too, and the
       * honeycomb would be laid out inside a box taller than the one it is
       * drawn in.
       */}
      <View {...props} style={props.style} className={cn('w-full', className)}>
        {slots.header}
        <View onLayout={onLayout} style={{ aspectRatio }} className="w-full">
          {width > 0 && height > 0 ? (
            <>
              <Svg width={width} height={height}>
                <Defs>
                  {/*
                   * The reveal's own geometry is declared statically as well as
                   * animated, and it has to be. Animated props on an element
                   * inside `Defs` do not reach the native clip on every
                   * platform — Android is the one that does not — and with the
                   * size coming only from the animation there is no size at all
                   * where they do not: an empty clip, and a honeycomb whose
                   * series never appear while its field draws normally.
                   *
                   * Declared, the worst case is the reveal not playing and the
                   * split being there from the first frame, which is a chart
                   * that is merely less pleasing rather than a chart that is
                   * missing its answer.
                   */}
                  <ClipPath id={clipId}>
                    {shape === 'blob' ? (
                      <AnimatedEllipse
                        cx={left + fieldWidth / 2}
                        cy={top + fieldHeight / 2}
                        rx={(fieldWidth / 2) * CORNER_REACH}
                        ry={(fieldHeight / 2) * CORNER_REACH}
                        animatedProps={ellipseProps}
                      />
                    ) : (
                      <AnimatedRect
                        x={0}
                        y={0}
                        width={width}
                        height={height}
                        animatedProps={rectProps}
                      />
                    )}
                  </ClipPath>
                </Defs>
                {slots.svg}
              </Svg>
              {/*
               * Anything with text or a touch on it goes over the SVG rather
               * than inside it: SVG text ignores the platform's text scaling
               * and the theme's font, and a press cannot be wired to an SVG
               * node with a role attached.
               */}
              <View
                pointerEvents="box-none"
                style={{ position: 'absolute', width, height }}
              >
                {slots.overlay}
              </View>
            </>
          ) : null}
        </View>
        {slots.footer}
      </View>
    </HexChartContext.Provider>
  );
});
HexChartRoot.displayName = 'HexChart';

function ChildSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export interface HexChartCellsProps {
  /** Colour of the cells no series took. Defaults to the muted token. */
  emptyColor?: string;
  /** Opacity of the series that are not selected, once one is. */
  dimOpacity?: number;
}

/**
 * The honeycomb: the unfilled field, and one path per series over it.
 *
 * One part rather than one per series. Every cell shares a radius, a gap and a
 * grid by definition — a chart where one series' cells could be given a size of
 * their own would be a chart drawing a lie, since the whole claim of the shape
 * is that one cell means the same thing wherever it appears.
 *
 * The field is drawn outside the reveal's clip and the series inside it, so the
 * total is there from the first frame and what fills in against it is the
 * split. Uncovering both together would animate the denominator, which is not
 * something that changed.
 */
function HexChartCells({ emptyColor, dimOpacity = 0.25 }: HexChartCellsProps) {
  const { data, plan, total, colors, status, clipId, activeIndex } =
    useChart('HexChart.Cells');
  const token = useCSSVariable('--color-muted');
  const empty = emptyColor ?? (typeof token === 'string' ? token : 'rgba(128,128,128,0.08)');

  if (status === 'loading') return null;

  return (
    <G>
      {plan.field ? <Path d={plan.field} fill={empty} /> : null}
      <G clipPath={`url(#${clipId})`}>
        {plan.paths.map((d, index) => {
          const series = data[index];
          if (!d || !series) return null;
          const percent = total > 0 ? Math.round((Math.max(0, series.value) / total) * 100) : 0;
          return (
            <Path
              key={series.label}
              d={d}
              fill={colors[index]}
              fillOpacity={activeIndex >= 0 && activeIndex !== index ? dimOpacity : 1}
              // An SVG node takes a label but not a role, so the series are
              // named without being announced as buttons. `HexChart.Legend` is
              // the properly wired way through the same selection, and the
              // easier target of the two.
              accessibilityLabel={`${series.label}, ${percent} percent`}
            />
          );
        })}
      </G>
    </G>
  );
}
HexChartCells.displayName = 'HexChart.Cells';
HexChartCells.slot = 'svg' as const;

export interface HexChartSkeletonProps {
  color?: string;
}

/**
 * The loading state: the field, with nothing divided up yet.
 *
 * Deliberately undivided. Placeholder shares would be a made-up split, and a
 * reader has no way to tell an invented one from a real one until it changes
 * under them — which is worse than showing nothing, because it is showing
 * something wrong.
 */
function HexChartSkeleton({ color }: HexChartSkeletonProps) {
  const { plan, status } = useChart('HexChart.Skeleton');
  const token = useCSSVariable('--color-skeleton');
  const fill = color ?? (typeof token === 'string' ? token : 'rgba(128,128,128,0.2)');

  if (status !== 'loading' || !plan.field) return null;

  return <Path d={plan.field} fill={fill} />;
}
HexChartSkeleton.displayName = 'HexChart.Skeleton';
HexChartSkeleton.slot = 'svg' as const;

export interface HexChartTooltipProps {
  /** Format the selected series' value. Defaults to a compact number. */
  formatValue?: (value: number, series: HexDatum) => string;
  /** Show the count of cells beside the share. */
  showCells?: boolean;
  className?: string;
}

/** Clearance between the label and the cells it is naming. */
const LABEL_GAP = 6;

/**
 * The press target over the honeycomb, and the label that names what was
 * pressed.
 *
 * The label hangs *above* the selected series rather than on it: it is centred
 * across that series' cells and sits clear of the highest one, so the cells
 * being read are never underneath the thing reading them. Two other places it
 * could go are both worse — under the finger is the one part of the chart
 * nobody can see, and on the middle of the series covers the mass the reader
 * just asked about.
 *
 * A series reaching the top of the field pushes the label back inside it, which
 * is the one case it does overlap. That series is the largest one, and its
 * topmost cells are the part of it a reader is least likely to be counting.
 *
 * A press on an unfilled cell clears the selection, the same as pressing the
 * selected series again. Everything outside the honeycomb is "none of them",
 * and making that gesture do nothing would leave a chart you can select in but
 * not out of.
 */
function HexChartTooltip({ formatValue, showCells = false, className }: HexChartTooltipProps) {
  const {
    data,
    plan,
    total,
    colors,
    metrics,
    columns,
    rows,
    left,
    top,
    width,
    height,
    status,
    activeIndex,
    setActiveIndex,
  } = useChart('HexChart.Tooltip');

  const series = activeIndex >= 0 ? (data[activeIndex] ?? null) : null;
  const format = formatValue ?? ((value: number) => compactNumber(value));

  const onPress = (x: number, y: number) => {
    // The shared hit test, called straight from the press handler: it is marked
    // as a worklet for the charts that scrub on the UI thread, and a worklet is
    // an ordinary function everywhere else. A press is one event, and the whole
    // point of resolving it is to hand an index back to React anyway.
    const cell = hexAt(x, y, metrics, left, top, columns, rows);
    const owner = cell ? (plan.owners[cell.row * columns + cell.column] ?? -1) : -1;
    setActiveIndex(owner === activeIndex ? -1 : owner);
  };

  if (status === 'loading' || width <= 0) return null;

  const anchor = series ? plan.labelAnchors[activeIndex] : null;
  const percent = series && total > 0 ? Math.round((Math.max(0, series.value) / total) * 100) : 0;

  return (
    <>
      <Pressable
        accessibilityLabel="Select a series"
        onPress={(event) =>
          onPress(event.nativeEvent.locationX, event.nativeEvent.locationY)
        }
        style={{ position: 'absolute', left: 0, top: 0, width, height }}
      />
      {series && anchor ? (
        // Keyed on the selection so the label remounts, and measures itself
        // again, whenever what it has to say changes length.
        <HexChartLabel
          key={activeIndex}
          anchor={anchor}
          width={width}
          height={height}
          color={colors[activeIndex]}
          value={format(series.value, series)}
          detail={
            showCells
              ? `${percent}% · ${plan.counts[activeIndex] ?? 0} cells`
              : `${percent}%`
          }
          className={className}
        />
      ) : null}
    </>
  );
}
HexChartTooltip.displayName = 'HexChart.Tooltip';
HexChartTooltip.slot = 'overlay' as const;

/**
 * The label itself, sized by its contents and placed once it knows its size.
 *
 * A fixed box would be simpler to place, and it is what a crosshair label on a
 * time series gets away with — there the text is one formatted number and its
 * width is known within a few points. Here it is a value, a percentage and
 * sometimes a cell count, and a currency total in the millions is half again as
 * wide as a compact one. A box that does not fit its text does not clip it in
 * React Native, it lets it run out of the corner, so the width has to come from
 * the text rather than the other way round.
 *
 * Which means one frame where the size is not known yet. That frame is spent at
 * zero opacity rather than in the wrong place — the same trade the walkthrough
 * card makes, and for the same reason: a label that arrives correct is better
 * than one that arrives early and jumps.
 */
function HexChartLabel({
  anchor,
  width,
  height,
  color,
  value,
  detail,
  className,
}: {
  anchor: ChartPoint;
  width: number;
  height: number;
  color: string | undefined;
  value: string;
  detail: string;
  className?: string;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const placed = size
    ? {
        // Centred across the series and hung above it, then clamped inside the
        // field so one whose cells sit against an edge does not get a label
        // hanging off it.
        left: Math.max(0, Math.min(width - size.width, anchor.x - size.width / 2)),
        top: Math.max(0, Math.min(height - size.height, anchor.y - LABEL_GAP - size.height)),
      }
    : { left: 0, top: 0 };

  return (
    <View
      pointerEvents="none"
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        setSize((current) =>
          current && Math.abs(current.width - w) < 1 && Math.abs(current.height - h) < 1
            ? current
            : { width: w, height: h }
        );
      }}
      style={{
        position: 'absolute',
        ...placed,
        opacity: size ? 1 : 0,
        // Never wider than the field, so a very long value wraps or ellipsises
        // inside the label instead of widening it off the edge.
        maxWidth: width,
      }}
      className={cn(
        'flex-row items-center gap-1.5 rounded-lg border border-border bg-overlay px-2 py-1 shadow-md',
        className
      )}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text size="xs" weight="medium" numberOfLines={1} className="shrink">
        {value}
      </Text>
      <Text size="xs" muted numberOfLines={1} className="shrink">
        {detail}
      </Text>
    </View>
  );
}

export interface HexChartLegendProps extends ViewProps {
  className?: string;
  /** Show each series' share of the whole beside its name. */
  showValue?: boolean;
}

/**
 * A swatch, a name and a share per series, under the chart and across the width
 * of it. Pressable in the same way the cells are — the legend is usually the
 * easier target of the two, and a series worth a couple of percent is a handful
 * of cells that may not be adjacent.
 *
 * It wraps rather than stacking, so five or six entries take two lines instead
 * of six. A key is a lookup table, and a lookup table read down a column of one
 * word each is a column the eye has to walk.
 */
function HexChartLegend({ className, showValue = true, ...props }: HexChartLegendProps) {
  const { data, total, colors, activeIndex, setActiveIndex } = useChart('HexChart.Legend');

  if (!data.length) return null;

  return (
    <View
      {...props}
      className={cn(
        'w-full flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-3',
        className
      )}
    >
      {data.map((series, index) => {
        const percent = total > 0 ? Math.round((Math.max(0, series.value) / total) * 100) : 0;
        const dimmed = activeIndex >= 0 && activeIndex !== index;
        return (
          <Pressable
            key={series.label}
            accessibilityRole="button"
            accessibilityLabel={`${series.label}, ${percent} percent`}
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
              {series.label}
            </Text>
            {showValue ? (
              <Text size="xs" weight="medium">
                {percent}%
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
HexChartLegend.displayName = 'HexChart.Legend';
HexChartLegend.slot = 'footer' as const;

export interface HexChartHeaderProps extends ViewProps {
  className?: string;
  /** Small line above the value — what the chart is of. */
  title?: string;
  /** The readout. The largest thing on the card, and the first thing read. */
  value?: string;
  /** One muted line under the value — a period, a comparison, a caveat. */
  caption?: string;
  /** Prettier names for the series, keyed by their `label`. */
  labels?: Record<string, string>;
  /**
   * Draw a swatch and a name per series along the trailing edge.
   *
   * For two or three short names. Past that use `HexChart.Legend`, which runs
   * under the chart across the full width: a key of five long names crammed
   * into the trailing corner of a header wraps to a column and leaves the title
   * beside it a few points wide.
   */
  legend?: boolean;
  /** Trailing slot — a control, a badge, a range picker. Wins over `legend`. */
  children?: ReactNode;
}

/**
 * The strip above the honeycomb: what the chart is of, what it reads, and what
 * the colours mean.
 *
 * It belongs to the chart rather than to the card around it because it is about
 * the *series* — the number changes as one is selected, and the legend is the
 * list the chart itself is holding. The card's header is a caption on the tray
 * the chart sits in; this is the chart introducing itself.
 *
 * The value is not derived here even though there is a total to derive it from,
 * because the formatting is not the chart's to guess: a total of 6750 is a
 * count, a currency or a percentage depending on what was counted, and only the
 * caller knows which.
 */
function HexChartHeader({
  className,
  title,
  value,
  caption,
  labels,
  legend = false,
  children,
  ...props
}: HexChartHeaderProps) {
  const { data, colors } = useChart('HexChart.Header');
  const trailing =
    children ??
    (legend && data.length ? (
      <View className="flex-row flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {data.map((series, index) => (
          <View key={series.label} className="flex-row items-center gap-1.5">
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors[index],
              }}
            />
            <Text size="xs" muted numberOfLines={1}>
              {labels?.[series.label] ?? series.label}
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
      {/*
       * Shrinkable, unlike a view's default in React Native — and capped, which
       * shrinking alone does not achieve. The title column is `flex-1`, so its
       * basis is zero and it lives on what is left over: a wrapping key with
       * nothing stopping it takes the whole row and leaves the title a few
       * points wide, which renders it one letter to a line.
       */}
      {trailing ? <View className="max-w-[55%] shrink pt-1">{trailing}</View> : null}
    </View>
  );
}
HexChartHeader.displayName = 'HexChart.Header';
HexChartHeader.slot = 'header' as const;

export const HexChart = Object.assign(HexChartRoot, {
  Header: HexChartHeader,
  Cells: HexChartCells,
  Tooltip: HexChartTooltip,
  Legend: HexChartLegend,
  Skeleton: HexChartSkeleton,
});
