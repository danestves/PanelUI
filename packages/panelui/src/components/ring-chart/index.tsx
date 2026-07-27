/**
 * RingChart — progress towards several targets, as concentric arcs.
 *
 * ```tsx
 * <RingChart data={goals}>
 *   <RingChart.Ring index={0} />
 *   <RingChart.Ring index={1} />
 *   <RingChart.Center />
 *   <RingChart.Legend />
 * </RingChart>
 * ```
 *
 * ## What it is not
 *
 * It is not a pie or a donut, and the difference matters. A pie divides one
 * whole between its slices, so its parts are only meaningful against each
 * other and the angles must add to a full turn. A ring here is a value against
 * *its own* target — three rings can all be at ninety percent of three
 * unrelated numbers, and that is the reading. Nothing is normalised across
 * rings, and nothing has to add up.
 *
 * That is also why each ring gets a track. An arc drawn on nothing shows how
 * far something went; an arc drawn on a full circle shows how far it went *of
 * what it was aiming at*, which is the entire question.
 *
 * ## Drawing
 *
 * Each ring is two arcs — a full-circle track and the progress over it — with
 * only the progress animated, through `strokeDasharray`. Sweeping the arc by
 * rebuilding its path would work, but a dash offset is two numbers moving on
 * an unchanged path, and it keeps the rounded cap pinned to the moving end for
 * free.
 *
 * Touch, not hover: a ring is selected by pressing it, and pressing the same
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
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { Text } from '../../primitives/text';
import { compactNumber, useSeriesColor, type SeriesColorIndex } from '../../utils/chart';
import { cn } from '../../utils/cn';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** One ring per datum, and the datum is the whole of its contract. */
export interface RingDatum {
  /** Name for the legend and the centre readout. */
  label: string;
  /** Where this ring has got to. */
  value: number;
  /** What it is aiming at. The ring is full when `value` reaches it. */
  maxValue: number;
  /** Explicit colour, overriding the `--color-chart-*` token. */
  color?: string;
}

interface RingChartContextValue {
  data: RingDatum[];
  size: number;
  strokeWidth: number;
  ringGap: number;
  colors: string[];
  /** 0 to 1 as the arcs sweep in. */
  reveal: SharedValue<number>;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  radiusOf: (index: number) => number;
}

const RingChartContext = createContext<RingChartContextValue | null>(null);

function useChart(component: string): RingChartContextValue {
  const context = useContext(RingChartContext);
  if (!context) {
    throw new Error(`${component} must be used within a <RingChart>`);
  }
  return context;
}

/** The selected ring, for something rendered inside the chart. */
export function useRingChart() {
  const { data, activeIndex } = useChart('useRingChart');
  return {
    activeIndex,
    activeRing: activeIndex >= 0 ? (data[activeIndex] ?? null) : null,
  };
}

export interface RingChartProps extends ViewProps {
  className?: string;
  /** One entry per ring, outermost first. */
  data: RingDatum[];
  /** Fixed diameter in points. Measured from the container when omitted. */
  size?: number;
  /** Thickness of each ring. */
  strokeWidth?: number;
  /** Gap between one ring and the next. */
  ringGap?: number;
  /** Milliseconds for the arcs to sweep in. */
  animationDuration?: number;
  /** Selected ring. Leave unset to let the chart track it. */
  activeIndex?: number;
  /** Fires with the selected ring, or `-1` when the selection is cleared. */
  onActiveIndexChange?: (index: number) => void;
  children?: ReactNode;
}

/** Imperative handle: re-run the sweep, for a "replay" control. */
export interface RingChartHandle {
  replay: () => void;
}

const RingChartRoot = forwardRef<RingChartHandle, RingChartProps>(function RingChartRoot(
  {
    className,
    data,
    size,
    strokeWidth = 12,
    ringGap = 6,
    animationDuration = 1100,
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

  /*
   * Outermost ring first, so `data[0]` is the one the eye lands on. Each ring
   * inside it steps in by its own thickness plus the gap.
   */
  const radiusOf = useMemo(
    () => (index: number) =>
      Math.max(box / 2 - strokeWidth / 2 - index * (strokeWidth + ringGap), strokeWidth / 2),
    [box, strokeWidth, ringGap]
  );

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

  const revealed = useRef(false);
  useEffect(() => {
    if (revealed.current || box <= 0 || !data.length) return;
    revealed.current = true;
    playReveal();
  }, [box, data.length, playReveal]);

  useImperativeHandle(ref, () => ({ replay: playReveal }), [playReveal]);

  // Resolved here rather than inside each ring, so the legend and the centre
  // readout can name a ring's colour without rendering one.
  const c1 = useSeriesColor(undefined, 1);
  const c2 = useSeriesColor(undefined, 2);
  const c3 = useSeriesColor(undefined, 3);
  const c4 = useSeriesColor(undefined, 4);
  const c5 = useSeriesColor(undefined, 5);
  const palette = useMemo(() => [c1, c2, c3, c4, c5], [c1, c2, c3, c4, c5]);
  const colors = useMemo(
    () => data.map((ring, index) => ring.color ?? palette[index % palette.length]!),
    [data, palette]
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const next = Math.round(Math.min(width, height));
    if (next !== measured) setMeasured(next);
    props.onLayout?.(event);
  };

  const context = useMemo<RingChartContextValue>(
    () => ({
      data,
      size: box,
      strokeWidth,
      ringGap,
      colors,
      reveal,
      activeIndex,
      setActiveIndex,
      radiusOf,
    }),
    [data, box, strokeWidth, ringGap, colors, reveal, activeIndex, setActiveIndex, radiusOf]
  );

  const rings: ReactNode[] = [];
  const overlay: ReactNode[] = [];
  Children.forEach(children, (child, index) => {
    if (!isValidElement(child)) return;
    const slot = (child.type as { slot?: 'ring' | 'overlay' }).slot ?? 'overlay';
    (slot === 'ring' ? rings : overlay).push(
      <ChildSlot key={index}>{child}</ChildSlot>
    );
  });

  return (
    <RingChartContext.Provider value={context}>
      <View
        {...props}
        onLayout={onLayout}
        style={[size ? { width: size, height: size } : { aspectRatio: 1 }, props.style]}
        className={cn('w-full items-center justify-center', className)}
      >
        {box > 0 ? (
          <>
            <Svg width={box} height={box}>
              {rings}
            </Svg>
            {/*
             * The centre and the legend sit over the SVG rather than inside
             * it: both are text, and SVG text ignores the platform's text
             * scaling and the theme's font.
             */}
            <View
              pointerEvents="box-none"
              style={{ position: 'absolute', width: box, height: box }}
              className="items-center justify-center"
            >
              {overlay}
            </View>
          </>
        ) : null}
      </View>
    </RingChartContext.Provider>
  );
});
RingChartRoot.displayName = 'RingChart';

function ChildSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export interface RingChartRingProps {
  /** Which entry in `data` this ring draws. */
  index: number;
  /** Explicit colour, overriding the datum's and the token. */
  color?: string;
  /** Which of the five chart tokens to take, when the datum names no colour. */
  colorIndex?: SeriesColorIndex;
  /** Rounded ends, or square ones. */
  lineCap?: 'round' | 'butt';
  /** Opacity of the track behind the arc. */
  trackOpacity?: number;
}

/**
 * One ring: a full-circle track, and the arc showing how far along it the
 * value has got.
 *
 * The arc is swept with `strokeDasharray` rather than by rebuilding its path.
 * Both work, but a dash offset moves two numbers on a path that never changes
 * — and it keeps the rounded cap pinned to the moving end without any extra
 * geometry.
 */
function RingChartRing({
  index,
  color,
  colorIndex,
  lineCap = 'round',
  trackOpacity = 0.15,
}: RingChartRingProps) {
  const { data, size, strokeWidth, colors, reveal, activeIndex, setActiveIndex, radiusOf } =
    useChart('RingChart.Ring');

  const datum = data[index];
  const tokenColor = useSeriesColor(undefined, colorIndex ?? 1);
  const stroke = color ?? datum?.color ?? (colorIndex ? tokenColor : colors[index]) ?? tokenColor;

  const radius = radiusOf(index);
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;

  const fraction = datum && datum.maxValue > 0 ? datum.value / datum.maxValue : 0;
  // A value past its target fills the ring and stops. Going round twice would
  // draw 110% as 10%, which is the wrong answer told confidently.
  const clamped = Math.max(0, Math.min(1, fraction));

  /*
   * Staggered outward-in, so the rings arrive as a sequence rather than all at
   * once. The window each gets is what is left after the stagger, so a chart
   * of five rings still finishes inside the one duration.
   */
  const count = Math.max(1, data.length);
  const start = (index / count) * 0.4;

  const props = useAnimatedProps(() => {
    const progress = Math.max(0, Math.min(1, (reveal.value - start) / 0.6));
    const drawn = circumference * clamped * progress;
    return {
      strokeDasharray: [drawn, circumference],
    };
  });

  const dimmed = activeIndex >= 0 && activeIndex !== index;

  if (!datum || radius <= 0) return null;

  return (
    <G opacity={dimmed ? 0.35 : 1}>
      <Circle
        cx={centre}
        cy={centre}
        r={radius}
        stroke={stroke}
        strokeOpacity={trackOpacity}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <AnimatedCircle
        animatedProps={props}
        cx={centre}
        cy={centre}
        r={radius}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={lineCap}
        fill="none"
        // Rotated so the arc starts at twelve o'clock. An arc starting at
        // three reads as a gauge that has already been running.
        transform={`rotate(-90 ${centre} ${centre})`}
      />
      {/*
       * The touch target is the ring itself, drawn as a transparent stroke
       * over it and made wider than the ring — a twelve-point band is below
       * the size a finger can reliably hit.
       */}
      <Circle
        cx={centre}
        cy={centre}
        r={radius}
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth, 28)}
        fill="none"
        onPress={() => setActiveIndex(activeIndex === index ? -1 : index)}
      />
    </G>
  );
}
RingChartRing.displayName = 'RingChart.Ring';
RingChartRing.slot = 'ring' as const;

export interface RingChartCenterProps {
  /**
   * Heading shown when no ring is selected. Defaults to the outermost ring's
   * own name, which is what the centre shows when nothing has been picked.
   */
  defaultLabel?: string;
  /** Format the number under the label. Defaults to a compact number. */
  formatValue?: (value: number, ring: RingDatum | null) => string;
  /**
   * Draw the middle yourself. Given the selected ring, or `null` when nothing
   * is selected.
   */
  children?: (ring: RingDatum | null) => ReactNode;
  className?: string;
}

/**
 * The readout in the hole.
 *
 * With nothing selected it shows the outermost ring — the one the eye lands on
 * first. Not a total: the rings measure different things against different
 * targets, so their values do not add up and their percentages do not average,
 * and a total here would be a confident number about nothing. Selecting a ring
 * swaps it for that ring's own figures.
 */
function RingChartCenter({
  defaultLabel,
  formatValue,
  children,
  className,
}: RingChartCenterProps) {
  const { data, activeIndex, strokeWidth, radiusOf } = useChart('RingChart.Center');

  /*
   * With nothing selected the centre shows the outermost ring — the one the
   * eye lands on — rather than an aggregate. There is no aggregate to show:
   * the rings measure different things against different targets, so their
   * values do not add up and their percentages do not average. A total here
   * would be a confident number about nothing.
   */
  const ring = (activeIndex >= 0 ? data[activeIndex] : data[0]) ?? null;
  const selected = activeIndex >= 0;
  const format = formatValue ?? ((amount: number) => compactNumber(amount));

  /*
   * The hole is what is left inside the innermost ring, measured off the same
   * function that places the rings so the two cannot disagree. Text wider than
   * it would sit on the arcs rather than inside them.
   */
  const inner = Math.max(radiusOf(Math.max(data.length - 1, 0)) - strokeWidth / 2, 0);
  // A square inside a circle, not across it: the corners of a box as wide as
  // the diameter fall outside the hole.
  const hole = inner * Math.SQRT2;

  return (
    <View
      pointerEvents="none"
      style={{ maxWidth: hole }}
      className={cn('items-center', className)}
    >
      {children ? (
        children(selected ? ring : null)
      ) : ring ? (
        <>
          <Text size="xs" muted numberOfLines={1}>
            {selected ? ring.label : (defaultLabel ?? ring.label)}
          </Text>
          {/* Below about ninety points there is no room for two lines and a
              headline, so the number gets the space and the rest is dropped. */}
          <Text size={hole < 90 ? 'lg' : 'xl'} weight="semibold" numberOfLines={1}>
            {format(ring.value, ring)}
          </Text>
          {hole >= 90 ? (
            <Text size="xs" muted numberOfLines={1}>
              {`of ${format(ring.maxValue, ring)}`}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
RingChartCenter.displayName = 'RingChart.Center';
RingChartCenter.slot = 'overlay' as const;

export interface RingChartLegendProps extends ViewProps {
  className?: string;
  /** Show each ring's percentage of its own target beside its name. */
  showValue?: boolean;
}

/**
 * A swatch and a name per ring, pressable in the same way the rings are — the
 * legend is usually the easier target of the two, and on a small chart it is
 * the only comfortable one.
 */
function RingChartLegend({ className, showValue = true, ...props }: RingChartLegendProps) {
  const { data, colors, activeIndex, setActiveIndex } = useChart('RingChart.Legend');

  if (!data.length) return null;

  return (
    <View
      {...props}
      pointerEvents="box-none"
      className={cn('absolute -bottom-2 w-full gap-1', className)}
    >
      {data.map((ring, index) => {
        const percent =
          ring.maxValue > 0 ? Math.round((ring.value / ring.maxValue) * 100) : 0;
        const dimmed = activeIndex >= 0 && activeIndex !== index;
        return (
          <Pressable
            key={ring.label}
            accessibilityRole="button"
            accessibilityLabel={`${ring.label}, ${percent} percent`}
            onPress={() => setActiveIndex(activeIndex === index ? -1 : index)}
            style={{ opacity: dimmed ? 0.4 : 1 }}
            className="flex-row items-center gap-1.5"
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors[index],
              }}
            />
            <Text size="xs" muted numberOfLines={1} className="flex-1">
              {ring.label}
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
RingChartLegend.displayName = 'RingChart.Legend';
RingChartLegend.slot = 'overlay' as const;

export const RingChart = Object.assign(RingChartRoot, {
  Ring: RingChartRing,
  Center: RingChartCenter,
  Legend: RingChartLegend,
});
