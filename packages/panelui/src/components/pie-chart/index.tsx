/**
 * PieChart — one whole, divided between its parts.
 *
 * ```tsx
 * <PieChart data={spend} innerRadius={0.58}>
 *   <PieChart.Header title="This month" value="$18,420" legend />
 *   <PieChart.Slices />
 *   <PieChart.Center />
 * </PieChart>
 * ```
 *
 * ## What it is, against the ring beside it
 *
 * A ring chart draws a value against *its own* target, so three rings can all
 * sit at ninety percent of three unrelated numbers and nothing has to add up.
 * A pie is the opposite claim: every slice is a share of one total, the angles
 * must come to a full turn, and a slice only means anything next to the others.
 * That is why nothing here takes a `maxValue` and why every value is normalised
 * against the sum — the sum *is* the subject.
 *
 * It follows that a pie is the wrong shape for a great many things. Two numbers
 * that do not belong to one whole, a series over time, anything a reader has to
 * compare precisely: all of those are a bar chart, because an angle is the
 * hardest quantity to read off a page and the fifth-largest slice of eleven is
 * not a fact anybody is going to extract. Use it for a handful of parts of one
 * obvious total, and put the number in the middle.
 *
 * ## Drawing
 *
 * Each slice is a filled path rather than a stroked arc, because a slice is a
 * *region* — two arcs and two radial edges — and a stroke is a band of even
 * thickness with no ends of its own. `wedgePath` builds it, and rebuilds it on
 * the UI thread on every frame of the reveal.
 *
 * That is what makes the reveal an unroll rather than a fade: one angle sweeps
 * clockwise from the start and each slice is drawn only as far as it has got
 * to. The pie fills the way it would be drawn by hand, and the slices arrive in
 * the order they are listed rather than all at once.
 *
 * Touch, not hover: a slice is selected by pressing it, and pressing the same
 * one again clears the selection. There is no equivalent of a pointer resting
 * somewhere without committing, so a chart that only revealed its numbers on
 * hover would never reveal them at all.
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
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Text } from '../../primitives/text';
import { compactNumber, useSeriesColor, wedgePath } from '../../utils/chart';
import { cn } from '../../utils/cn';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Milliseconds for a slice to lift out and settle back as it is selected. */
const SELECT_DURATION = 180;

/** Where a child is drawn: inside the SVG, over it, above it, or under it. */
type Slot = 'svg' | 'overlay' | 'header' | 'footer';

/** Whether the chart is showing data or waiting for it. */
export type PieChartStatus = 'loading' | 'ready';

/** One slice. Its share is worked out from the others, so there is no maximum. */
export interface PieDatum {
  /** Name for the legend, the centre readout and the accessibility label. */
  label: string;
  /** How much of the whole this slice is. Negatives are treated as zero. */
  value: number;
  /** Explicit colour, overriding the `--color-chart-*` token. */
  color?: string;
}

/** A slice's place on the dial, in turns clockwise from twelve o'clock. */
interface SliceAngles {
  from: number;
  to: number;
  /** Halfway along it, which is the direction it lifts out in. */
  mid: number;
  /** Its share of the total, 0 to 1. */
  fraction: number;
}

interface PieChartContextValue {
  data: PieDatum[];
  /** Everything the values add up to. Zero when there is nothing to show. */
  total: number;
  size: number;
  /** Outer radius in points, after the room for lifting a slice out is taken. */
  radius: number;
  /** Inner radius in points. Zero for a pie, above it for a donut. */
  hole: number;
  colors: string[];
  slices: SliceAngles[];
  /** Where the dial starts and how far it runs, both in turns. */
  origin: number;
  span: number;
  /** 0 to 1 as the pie unrolls. */
  reveal: SharedValue<number>;
  status: PieChartStatus;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

const PieChartContext = createContext<PieChartContextValue | null>(null);

function useChart(component: string): PieChartContextValue {
  const context = useContext(PieChartContext);
  if (!context) {
    throw new Error(`${component} must be used within a <PieChart>`);
  }
  return context;
}

/** The selected slice and its share, for something rendered inside the chart. */
export function usePieChart() {
  const { data, slices, activeIndex } = useChart('usePieChart');
  return {
    activeIndex,
    activeSlice: activeIndex >= 0 ? (data[activeIndex] ?? null) : null,
    /** The selected slice's share of the whole, 0 to 1. */
    activeFraction: activeIndex >= 0 ? (slices[activeIndex]?.fraction ?? 0) : 0,
  };
}

export interface PieChartProps extends ViewProps {
  className?: string;
  /** One entry per slice, in the order they are drawn clockwise. */
  data: PieDatum[];
  /** Fixed diameter in points. Measured from the container when omitted. */
  size?: number;
  /**
   * The hole, as a share of the radius. `0` is a pie; anything above it is a
   * donut, and `0.55`–`0.65` is the range that leaves room for a readout in the
   * middle without the band getting thin enough to be hard to hit.
   *
   * Given as a share rather than in points so a chart keeps its proportions at
   * whatever size it is measured at.
   */
  innerRadius?: number;
  /** Where the first slice begins, in degrees clockwise from twelve o'clock. */
  startAngle?: number;
  /**
   * Where the last one ends, on the same clock. Leaving a turn's worth between
   * the two gives a closed pie; anything less leaves a gap and reads as a dial.
   */
  endAngle?: number;
  /** Gap between one slice and the next, in degrees. */
  padAngle?: number;
  /**
   * The smallest angle any non-zero slice is drawn at, in degrees.
   *
   * A slice worth a fifth of a percent is a hairline nobody can see and nobody
   * can press, so it reads as missing rather than as small — and "missing" is a
   * different claim from "nearly none". The angle it borrows comes off the
   * others in proportion, so the turn still closes.
   */
  minAngle?: number;
  /** Milliseconds for the pie to unroll. */
  animationDuration?: number;
  /** `loading` draws a plain muted ring until the data arrives. */
  status?: PieChartStatus;
  /** Selected slice. Leave unset to let the chart track it. */
  activeIndex?: number;
  /** Fires with the selected slice, or `-1` when the selection is cleared. */
  onActiveIndexChange?: (index: number) => void;
  children?: ReactNode;
}

/** Imperative handle: re-run the unroll, for a "replay" control. */
export interface PieChartHandle {
  replay: () => void;
}

/** Room kept outside the pie so a selected slice has somewhere to lift into. */
const LIFT = 8;

const PieChartRoot = forwardRef<PieChartHandle, PieChartProps>(function PieChartRoot(
  {
    className,
    data,
    size,
    innerRadius = 0,
    startAngle = 0,
    endAngle = 360,
    padAngle = 0,
    minAngle = 0,
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
  const radius = Math.max(box / 2 - LIFT, 0);
  const hole = radius * Math.max(0, Math.min(innerRadius, 0.95));

  const origin = startAngle / 360;
  // Clamped to one turn, because a pie drawn past 360° laps itself and the
  // slice underneath is simply gone.
  const span = Math.min(Math.max(endAngle - startAngle, 0), 360) / 360;

  const total = useMemo(
    () => data.reduce((sum, slice) => sum + Math.max(0, slice.value), 0),
    [data]
  );

  const slices = useMemo<SliceAngles[]>(() => {
    const count = data.length;
    if (!count || total <= 0 || span <= 0) return [];

    /*
     * The gaps and the floors are taken out of the turn *first*, and what is
     * left is shared by value. Adding them instead would push the last slice
     * past the end of the dial, which on a closed pie means over the first one.
     */
    const pad = Math.min(padAngle / 360, span / (count * 2));
    const gaps = count > 1 || span < 1 ? pad * count : 0;
    const floor = Math.min(minAngle / 360, (span - gaps) / (count * 2));

    const drawn = data.filter((slice) => Math.max(0, slice.value) > 0).length;
    const floors = floor * drawn;
    const free = Math.max(span - gaps - floors, 0);

    const result: SliceAngles[] = [];
    let cursor = origin + pad / 2;

    for (const slice of data) {
      const value = Math.max(0, slice.value);
      const fraction = value / total;
      const sweep = value > 0 ? floor + free * fraction : 0;
      result.push({
        from: cursor,
        to: cursor + sweep,
        mid: cursor + sweep / 2,
        fraction,
      });
      cursor += sweep + pad;
    }

    return result;
  }, [data, total, origin, span, padAngle, minAngle]);

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

  const loading = status === 'loading';
  const revealed = useRef(false);

  useEffect(() => {
    if (loading) {
      revealed.current = false;
      reveal.value = 0;
      return;
    }
    if (revealed.current || box <= 0 || !slices.length) return;
    revealed.current = true;
    playReveal();
  }, [loading, box, slices.length, playReveal, reveal]);

  useImperativeHandle(ref, () => ({ replay: playReveal }), [playReveal]);

  // Resolved here rather than inside the slices, so the legend, the header and
  // the centre readout can name a slice's colour without drawing one.
  const c1 = useSeriesColor(undefined, 1);
  const c2 = useSeriesColor(undefined, 2);
  const c3 = useSeriesColor(undefined, 3);
  const c4 = useSeriesColor(undefined, 4);
  const c5 = useSeriesColor(undefined, 5);
  const palette = useMemo(() => [c1, c2, c3, c4, c5], [c1, c2, c3, c4, c5]);
  const colors = useMemo(
    () => data.map((slice, index) => slice.color ?? palette[index % palette.length]!),
    [data, palette]
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const next = Math.round(Math.min(width, height));
    if (next !== measured) setMeasured(next);
    props.onLayout?.(event);
  };

  const context = useMemo<PieChartContextValue>(
    () => ({
      data,
      total,
      size: box,
      radius,
      hole,
      colors,
      slices,
      origin,
      span,
      reveal,
      status,
      activeIndex,
      setActiveIndex,
    }),
    [
      data,
      total,
      box,
      radius,
      hole,
      colors,
      slices,
      origin,
      span,
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
    slots[slot in slots ? slot : 'overlay'].push(
      <ChildSlot key={index}>{child}</ChildSlot>
    );
  });

  return (
    <PieChartContext.Provider value={context}>
      {/*
       * Two views, because the header is not part of the dial. The square and
       * the layout measurement belong to the drawing area alone — measured on
       * the outer view they would take in the header too, and the pie would be
       * laid out inside a box taller than the one it is drawn in.
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
               * The centre sits over the SVG rather than inside it: it is text,
               * and SVG text ignores the platform's text scaling and the
               * theme's font.
               */}
              <View
                pointerEvents="box-none"
                style={{ position: 'absolute', width: box, height: box }}
                className="items-center justify-center"
              >
                {slots.overlay}
              </View>
            </>
          ) : null}
        </View>
        {/*
         * The key goes *under* the square, in flow, rather than in the corners
         * left over inside it. A ring chart can get away with the corners
         * because three arcs is a long key; a pie is routinely five or six
         * slices with names like "Everything else", and a key of that size laid
         * over the drawing either covers it or is squeezed to one letter a line.
         */}
        {slots.footer}
      </View>
    </PieChartContext.Provider>
  );
});
PieChartRoot.displayName = 'PieChart';

function ChildSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export interface PieChartSlicesProps {
  /** Rounds the four turns of each slice, in points. */
  cornerRadius?: number;
  /** How far a selected slice lifts out of the pie, in points. */
  popOut?: number;
  /** Opacity of the slices that are not selected, once one is. */
  dimOpacity?: number;
}

/**
 * Every slice, drawn in the order the data lists them.
 *
 * One part rather than one per datum, unlike the rings next door. A ring is
 * configured on its own — its own thickness, its own cap, its own segment count
 * — because it is its own measurement. Slices of a pie are not: they share a
 * radius, a hole and a dial by definition, and a chart where one of them could
 * be given a different radius would be a chart drawing a lie.
 */
function PieChartSlices({
  cornerRadius = 0,
  popOut = 6,
  dimOpacity = 0.35,
}: PieChartSlicesProps) {
  const { data, slices, colors, radius, hole, size, reveal, origin, span, status, activeIndex, setActiveIndex } =
    useChart('PieChart.Slices');

  if (status === 'loading' || radius <= 0) return null;

  return (
    <G>
      {slices.map((angles, index) => {
        const datum = data[index];
        if (!datum || angles.to <= angles.from) return null;
        return (
          <Slice
            key={datum.label}
            angles={angles}
            fill={colors[index] ?? colors[0]!}
            centre={size / 2}
            radius={radius}
            hole={hole}
            cornerRadius={cornerRadius}
            popOut={popOut}
            reveal={reveal}
            origin={origin}
            span={span}
            selected={activeIndex === index}
            dimmed={activeIndex >= 0 && activeIndex !== index}
            dimOpacity={dimOpacity}
            label={datum.label}
            percent={Math.round(angles.fraction * 100)}
            onPress={() => setActiveIndex(activeIndex === index ? -1 : index)}
          />
        );
      })}
    </G>
  );
}
PieChartSlices.displayName = 'PieChart.Slices';
PieChartSlices.slot = 'svg' as const;

/**
 * One slice, rebuilt on the UI thread every frame it is moving.
 *
 * Both the unroll and the lift are folded into the path rather than laid on top
 * of it as a transform. The unroll has to be: a slice half drawn is a shorter
 * slice, not a smaller one, and no scale expresses that. The lift could be a
 * translation, but the path is already being rebuilt, so moving the centre it
 * is drawn around costs nothing and keeps the geometry in one place.
 */
function Slice({
  angles,
  fill,
  centre,
  radius,
  hole,
  cornerRadius,
  popOut,
  reveal,
  origin,
  span,
  selected,
  dimmed,
  dimOpacity,
  label,
  percent,
  onPress,
}: {
  angles: SliceAngles;
  fill: string;
  centre: number;
  radius: number;
  hole: number;
  cornerRadius: number;
  popOut: number;
  reveal: SharedValue<number>;
  origin: number;
  span: number;
  selected: boolean;
  dimmed: boolean;
  dimOpacity: number;
  label: string;
  percent: number;
  onPress: () => void;
}) {
  const lift = useDerivedValue(() =>
    withTiming(selected ? 1 : 0, { duration: SELECT_DURATION })
  );

  const { from, to, mid } = angles;
  // The direction the slice lifts in, resolved once: the middle of it, as a
  // unit vector from the centre of the dial.
  const angle = (mid - 0.25) * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  const animatedProps = useAnimatedProps(() => {
    // One hand sweeping clockwise from the start of the dial. A slice is drawn
    // as far as the hand has reached and no further, so the pie fills the way
    // it would be drawn by hand rather than every slice growing at once.
    const hand = origin + span * reveal.value;
    const out = popOut * lift.value;
    return {
      d: wedgePath(
        centre + dx * out,
        centre + dy * out,
        radius,
        hole,
        from,
        Math.min(to, hand),
        cornerRadius
      ),
    };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill={fill}
      fillOpacity={dimmed ? dimOpacity : 1}
      onPress={onPress}
      // An SVG node takes a label but not a role, so the slices are reachable
      // and named without being announced as buttons. `PieChart.Legend` is the
      // properly wired way through the same selection, and the easier target.
      accessibilityLabel={`${label}, ${percent} percent`}
    />
  );
}

export interface PieChartSkeletonProps {
  color?: string;
}

/**
 * The loading state: the dial as one plain band, with nothing divided up yet.
 *
 * Deliberately undivided. Placeholder slices would be a made-up split, and a
 * reader has no way to tell an invented one from a real one until it changes
 * under them — which is worse than showing nothing, because it is showing
 * something wrong.
 */
function PieChartSkeleton({ color }: PieChartSkeletonProps) {
  const { size, radius, hole, origin, span, status } = useChart('PieChart.Skeleton');
  const token = useCSSVariable('--color-skeleton');
  const fill = color ?? (typeof token === 'string' ? token : 'rgba(128,128,128,0.2)');

  if (status !== 'loading' || radius <= 0) return null;

  return (
    <Path
      d={wedgePath(size / 2, size / 2, radius, hole, origin, origin + span, 0)}
      fill={fill}
    />
  );
}
PieChartSkeleton.displayName = 'PieChart.Skeleton';
PieChartSkeleton.slot = 'svg' as const;

export interface PieChartCenterProps {
  /** Heading shown when no slice is selected. */
  defaultLabel?: string;
  /** Format the number under the label. Defaults to a compact number. */
  formatValue?: (value: number, slice: PieDatum | null) => string;
  /**
   * Draw the middle yourself. Given the selected slice, or `null` when nothing
   * is selected.
   */
  children?: (slice: PieDatum | null) => ReactNode;
  className?: string;
}

/**
 * The hole's readout: the total, and the selected slice's own figures once one
 * is picked.
 *
 * Unlike the ring chart's centre, the default here *is* an aggregate, and it is
 * the honest one — the whole point of a pie is that its parts belong to a total,
 * so the total is the number the chart is about. Selecting a slice swaps it for
 * that slice's value and its share.
 */
function PieChartCenter({
  defaultLabel = 'Total',
  formatValue,
  children,
  className,
}: PieChartCenterProps) {
  const { data, slices, total, hole, activeIndex } = useChart('PieChart.Center');

  const slice = activeIndex >= 0 ? (data[activeIndex] ?? null) : null;
  const share = activeIndex >= 0 ? (slices[activeIndex]?.fraction ?? 0) : 0;
  const format = formatValue ?? ((amount: number) => compactNumber(amount));

  // A square inside a circle, not across it: the corners of a box as wide as
  // the diameter fall outside the hole.
  const room = hole * Math.SQRT2;

  if (room <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{ maxWidth: room }}
      className={cn('items-center', className)}
    >
      {children ? (
        children(slice)
      ) : (
        <>
          <Text size="xs" muted numberOfLines={1}>
            {slice ? slice.label : defaultLabel}
          </Text>
          {/* Below about ninety points there is no room for two lines and a
              headline, so the number gets the space and the rest is dropped. */}
          <Text size={room < 90 ? 'lg' : 'xl'} weight="semibold" numberOfLines={1}>
            {format(slice ? slice.value : total, slice)}
          </Text>
          {room >= 90 && slice ? (
            <Text size="xs" muted numberOfLines={1}>
              {`${Math.round(share * 100)}% of ${format(total, null)}`}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
PieChartCenter.displayName = 'PieChart.Center';
PieChartCenter.slot = 'overlay' as const;

export interface PieChartLegendProps extends ViewProps {
  className?: string;
  /** Show each slice's share of the whole beside its name. */
  showValue?: boolean;
}

/**
 * A swatch, a name and a share per slice, under the chart and across the width
 * of it. Pressable in the same way the slices are — the legend is usually the
 * easier target of the two, and a slice worth a couple of percent is not a
 * target at all.
 *
 * It wraps rather than stacking, so five or six entries take two lines instead
 * of six. A key is a lookup table, and a lookup table read down a column of one
 * word each is a column the eye has to walk.
 */
function PieChartLegend({ className, showValue = true, ...props }: PieChartLegendProps) {
  const { data, slices, colors, activeIndex, setActiveIndex } =
    useChart('PieChart.Legend');

  if (!data.length) return null;

  return (
    <View
      {...props}
      className={cn(
        'w-full flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-3',
        className
      )}
    >
      {data.map((slice, index) => {
        const percent = Math.round((slices[index]?.fraction ?? 0) * 100);
        const dimmed = activeIndex >= 0 && activeIndex !== index;
        return (
          <Pressable
            key={slice.label}
            accessibilityRole="button"
            accessibilityLabel={`${slice.label}, ${percent} percent`}
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
              {slice.label}
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
PieChartLegend.displayName = 'PieChart.Legend';
PieChartLegend.slot = 'footer' as const;

export interface PieChartHeaderProps extends ViewProps {
  className?: string;
  /** Small line above the value — what the chart is of. */
  title?: string;
  /** The readout. The largest thing on the card, and the first thing read. */
  value?: string;
  /** One muted line under the value — a period, a comparison, a caveat. */
  caption?: string;
  /** Prettier names for the slices, keyed by their `label`. */
  labels?: Record<string, string>;
  /**
   * Draw a swatch and a name per slice along the trailing edge.
   *
   * For two or three short names. Past that use `PieChart.Legend`, which runs
   * under the chart across the full width: a key of five long names crammed
   * into the trailing corner of a header wraps to a column and leaves the title
   * beside it a few points wide.
   */
  legend?: boolean;
  /** Trailing slot — a control, a badge, a range picker. Wins over `legend`. */
  children?: ReactNode;
}

/**
 * The strip above the pie: what the chart is of, what it reads, and what the
 * colours mean.
 *
 * It belongs to the chart rather than to the card around it because it is about
 * the *slices* — the number changes as one is selected, and the legend is the
 * list the chart itself is holding. The card's header is a caption on the tray
 * the chart sits in; this is the chart introducing itself.
 *
 * The value is not derived here even though there is a total to derive it from,
 * because the formatting is not the chart's to guess: a total of 18420 is a
 * count, a currency or a percentage depending on what was counted, and only the
 * caller knows which.
 */
function PieChartHeader({
  className,
  title,
  value,
  caption,
  labels,
  legend = false,
  children,
  ...props
}: PieChartHeaderProps) {
  const { data, colors } = useChart('PieChart.Header');
  const trailing =
    children ??
    (legend && data.length ? (
      <View className="flex-row flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {data.map((slice, index) => (
          <View key={slice.label} className="flex-row items-center gap-1.5">
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors[index],
              }}
            />
            <Text size="xs" muted numberOfLines={1}>
              {labels?.[slice.label] ?? slice.label}
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
PieChartHeader.displayName = 'PieChart.Header';
PieChartHeader.slot = 'header' as const;

export const PieChart = Object.assign(PieChartRoot, {
  Header: PieChartHeader,
  Slices: PieChartSlices,
  Center: PieChartCenter,
  Legend: PieChartLegend,
  Skeleton: PieChartSkeleton,
});
