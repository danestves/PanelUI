/**
 * FunnelChart — how many were left at each step, and where the rest went.
 *
 * ```tsx
 * <FunnelChart data={checkout}>
 *   <FunnelChart.Header title="Checkout" value="41,800" />
 *   <FunnelChart.Stages />
 *   <FunnelChart.Labels />
 * </FunnelChart>
 * ```
 *
 * ## What it is, against the bars next door
 *
 * A bar chart compares quantities that need not have anything to do with each
 * other. A funnel makes a much stronger claim: every stage is a *subset of the
 * one above it*, in order, and the reader is being shown where a population
 * drained away. That is why the stages are not sorted, why nothing is
 * normalised to a total, and why the interesting number is not any stage's
 * value but the ratio between two of them.
 *
 * It follows that the order is the caller's and never the chart's. Stages are
 * steps in a process — a signup, a checkout, a support queue — and reordering
 * them by size would destroy the only thing the chart is asserting. A stage
 * larger than the one above it is therefore drawn as given, wider than its
 * parent, because that is a real and visible data problem and hiding it would
 * be the chart lying to save face.
 *
 * ## Drawing
 *
 * Each stage is a trapezoid running from its own width down to the *next*
 * stage's width, so the taper is continuous across the whole run and the slope
 * between two stages is the drop between them. The last one has nothing below
 * it to taper towards, so it is a slab.
 *
 * Width is measured against the largest value rather than the first, which are
 * the same number in every well-formed funnel and differ only in the broken
 * case above — where measuring against the first would push a stage off the
 * side of the chart.
 *
 * The reveal is a hand sweeping down the funnel: each stage is drawn only as
 * far as the hand has reached, and its bottom edge is the width the taper has
 * at exactly that height. So it fills the way it drains, top to bottom, rather
 * than every stage growing at once. It is rebuilt on the UI thread each frame.
 *
 * ## Colour
 *
 * One hue, fading down the run, rather than a colour per stage. A funnel's
 * stages are one quantity at successive moments, not five unrelated series, and
 * five hues would say they were. A stage can still be given its own `color`
 * when it means something — the step where the money is taken, the one being
 * discussed — and that one is drawn at full strength.
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
import { compactNumber, trapezoidPath, useSeriesColor } from '../../utils/chart';
import { cn } from '../../utils/cn';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Milliseconds for a stage to dim as another is selected. */
const SELECT_DURATION = 180;

/** How far the hue has faded by the bottom of the run. */
const FADE = 0.55;

/** Stages' worth of room kept for a loading chart that has no data yet. */
const SKELETON_STAGES = 4;

/** Where a child is drawn: inside the SVG, over it, above it, or under it. */
type Slot = 'svg' | 'overlay' | 'header' | 'footer';

/** Whether the chart is showing data or waiting for it. */
export type FunnelChartStatus = 'loading' | 'ready';

/** Which edge the taper hangs off. */
export type FunnelAlign = 'center' | 'start' | 'end';

/** One step of the process. */
export interface FunnelDatum {
  /** Name of the step, for the label, the legend and the accessibility label. */
  label: string;
  /** How many were left at it. Negatives are treated as zero. */
  value: number;
  /** Explicit colour, drawn at full strength instead of the faded hue. */
  color?: string;
}

/** One stage's row: where it sits and how wide it is at each end. */
interface Band {
  top: number;
  bottom: number;
  height: number;
  /** Width at the top edge, in points. */
  width: number;
  /** Width at the bottom edge — the next stage's, or its own if it is last. */
  nextWidth: number;
}

interface FunnelChartContextValue {
  data: FunnelDatum[];
  /** Measured width of the drawing area, in points. */
  width: number;
  /** Height of the whole run, in points. */
  height: number;
  bands: Band[];
  /** Each stage's share of the *first* stage, 0 to 1. */
  shares: number[];
  /** Each stage's share of the one above it, 0 to 1. The first is 1. */
  steps: number[];
  colors: string[];
  /** How far the hue has faded at each stage. `1` where a colour was given. */
  strengths: number[];
  anchor: number;
  cornerRadius: number;
  reveal: SharedValue<number>;
  status: FunnelChartStatus;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

const FunnelChartContext = createContext<FunnelChartContextValue | null>(null);

function useChart(component: string): FunnelChartContextValue {
  const context = useContext(FunnelChartContext);
  if (!context) {
    throw new Error(`${component} must be used within a <FunnelChart>`);
  }
  return context;
}

/** The selected stage and how it converted, for something drawn inside the chart. */
export function useFunnelChart() {
  const { data, shares, steps, activeIndex } = useChart('useFunnelChart');
  return {
    activeIndex,
    activeStage: activeIndex >= 0 ? (data[activeIndex] ?? null) : null,
    /** Its share of the first stage, 0 to 1. */
    activeShare: activeIndex >= 0 ? (shares[activeIndex] ?? 0) : 0,
    /** Its share of the stage above it, 0 to 1. */
    activeStep: activeIndex >= 0 ? (steps[activeIndex] ?? 0) : 0,
  };
}

export interface FunnelChartProps extends ViewProps {
  className?: string;
  /** The steps, top to bottom, in the order they happen. Never reordered. */
  data: FunnelDatum[];
  /** Height of one stage, in points. The run is as tall as its stages need. */
  stageHeight?: number;
  /** Space between one stage and the next, in points. */
  gap?: number;
  /**
   * Which edge the taper hangs off. `center` narrows from both sides; `start`
   * keeps the leading edge straight and takes it all off the trailing one,
   * which is the shape to use when the labels run down the same side.
   */
  align?: FunnelAlign;
  /**
   * The narrowest a non-zero stage is drawn, as a share of the full width.
   *
   * A stage worth a fifth of a percent of the top is a hairline: it reads as
   * missing rather than as small, and "missing" is a different claim. The floor
   * is only applied to stages that have something in them — a genuine zero is
   * drawn as nothing, because there it is the truth.
   */
  minWidth?: number;
  /** Rounds the corners of every stage, in points. */
  cornerRadius?: number;
  /** The funnel's hue. Defaults to the first chart token. */
  color?: string;
  /** Milliseconds for the funnel to fill, top to bottom. */
  animationDuration?: number;
  /** `loading` draws one plain muted taper until the data arrives. */
  status?: FunnelChartStatus;
  /** Selected stage. Leave unset to let the chart track it. */
  activeIndex?: number;
  /** Fires with the selected stage, or `-1` when the selection is cleared. */
  onActiveIndexChange?: (index: number) => void;
  children?: ReactNode;
}

/** Imperative handle: re-run the fill, for a "replay" control. */
export interface FunnelChartHandle {
  replay: () => void;
}

const ANCHORS: Record<FunnelAlign, number> = { center: 0.5, start: 0, end: 1 };

const FunnelChartRoot = forwardRef<FunnelChartHandle, FunnelChartProps>(
  function FunnelChartRoot(
    {
      className,
      data,
      stageHeight = 52,
      gap = 4,
      align = 'center',
      minWidth = 0.1,
      cornerRadius = 0,
      color,
      animationDuration = 900,
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

    const count = data.length;
    /*
     * A funnel that is still loading usually has no data at all, and a run of
     * zero height has nowhere to draw the waiting taper. So an empty loading
     * chart is given a plausible number of stages' worth of room — which is
     * also what stops the card from jumping the moment the data lands.
     */
    const stages = count || (status === 'loading' ? SKELETON_STAGES : 0);
    const height = stages ? stages * stageHeight + (stages - 1) * Math.max(gap, 0) : 0;

    /** The largest value in the run — see the note about broken funnels above. */
    const peak = useMemo(
      () => data.reduce((most, stage) => Math.max(most, Math.max(0, stage.value)), 0),
      [data]
    );

    const shares = useMemo(() => {
      const first = Math.max(0, data[0]?.value ?? 0);
      return data.map((stage) =>
        first > 0 ? Math.max(0, stage.value) / first : 0
      );
    }, [data]);

    const steps = useMemo(
      () =>
        data.map((stage, index) => {
          if (index === 0) return 1;
          const previous = Math.max(0, data[index - 1]?.value ?? 0);
          return previous > 0 ? Math.max(0, stage.value) / previous : 0;
        }),
      [data]
    );

    const bands = useMemo<Band[]>(() => {
      if (!count || measured <= 0) return [];
      const floor = Math.max(0, Math.min(minWidth, 1));
      const widths = data.map((stage) => {
        const value = Math.max(0, stage.value);
        if (value <= 0 || peak <= 0) return 0;
        // The floor is a floor, not a rescale: a stage already above it keeps
        // its true width, so the widths of the stages that matter still read
        // against each other exactly.
        return measured * Math.max(value / peak, floor);
      });

      return widths.map((width, index) => {
        const top = index * (stageHeight + Math.max(gap, 0));
        return {
          top,
          bottom: top + stageHeight,
          height: stageHeight,
          width,
          nextWidth: widths[index + 1] ?? width,
        };
      });
    }, [count, measured, data, peak, minWidth, stageHeight, gap]);

    const hue = useSeriesColor(color, 1);
    const colors = useMemo(
      () => data.map((stage) => stage.color ?? hue),
      [data, hue]
    );
    const strengths = useMemo(
      () =>
        data.map((stage, index) => {
          if (stage.color) return 1;
          if (count < 2) return 1;
          return 1 - (index / (count - 1)) * FADE;
        }),
      [data, count]
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

    const loading = status === 'loading';
    const revealed = useRef(false);

    useEffect(() => {
      if (loading) {
        revealed.current = false;
        reveal.value = 0;
        return;
      }
      if (revealed.current || !bands.length) return;
      revealed.current = true;
      playReveal();
    }, [loading, bands.length, playReveal, reveal]);

    useImperativeHandle(ref, () => ({ replay: playReveal }), [playReveal]);

    // The caller's own `onLayout` is not forwarded from here: it is already on
    // the outer view, and the box it wants is the whole chart's rather than the
    // run's — which are different heights the moment there is a header.
    const onLayout = (event: LayoutChangeEvent) => {
      const next = Math.round(event.nativeEvent.layout.width);
      if (next !== measured) setMeasured(next);
    };

    const context = useMemo<FunnelChartContextValue>(
      () => ({
        data,
        width: measured,
        height,
        bands,
        shares,
        steps,
        colors,
        strengths,
        anchor: ANCHORS[align] ?? 0.5,
        cornerRadius,
        reveal,
        status,
        activeIndex,
        setActiveIndex,
      }),
      [
        data,
        measured,
        height,
        bands,
        shares,
        steps,
        colors,
        strengths,
        align,
        cornerRadius,
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
      <FunnelChartContext.Provider value={context}>
        <View {...props} style={props.style} className={cn('w-full', className)}>
          {slots.header}
          {/*
           * The run is measured on its own view rather than the outer one, so a
           * header or a legend cannot change how wide the funnel thinks it is.
           */}
          <View onLayout={onLayout} style={{ height }} className="w-full">
            {measured > 0 && height > 0 ? (
              <>
                <Svg width={measured} height={height}>
                  {slots.svg}
                </Svg>
                {/*
                 * Labels sit over the SVG rather than inside it: they are text,
                 * and SVG text ignores the platform's text scaling and the
                 * theme's font.
                 */}
                <View
                  pointerEvents="box-none"
                  style={{
                    position: 'absolute',
                    width: measured,
                    height,
                  }}
                >
                  {slots.overlay}
                </View>
              </>
            ) : null}
          </View>
          {slots.footer}
        </View>
      </FunnelChartContext.Provider>
    );
  }
);
FunnelChartRoot.displayName = 'FunnelChart';

function ChildSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export interface FunnelChartStagesProps {
  /** Opacity of the stages that are not selected, once one is. */
  dimOpacity?: number;
}

/**
 * Every stage, drawn in the order the data lists them.
 *
 * One part rather than one per datum. A stage's width is the next stage's
 * width, so they cannot be configured apart without the taper coming apart with
 * them — a funnel whose third stage could be given its own alignment would be a
 * funnel drawing a shape that is not in the data.
 */
function FunnelChartStages({ dimOpacity = 0.3 }: FunnelChartStagesProps) {
  const {
    data,
    bands,
    colors,
    strengths,
    width,
    height,
    anchor,
    cornerRadius,
    reveal,
    status,
    shares,
    activeIndex,
    setActiveIndex,
  } = useChart('FunnelChart.Stages');

  if (status === 'loading' || !bands.length) return null;

  return (
    <G>
      {bands.map((band, index) => {
        const datum = data[index];
        if (!datum || band.width <= 0) return null;
        return (
          <Stage
            key={datum.label}
            band={band}
            span={width}
            total={height}
            anchor={anchor}
            fill={colors[index] ?? colors[0]!}
            strength={strengths[index] ?? 1}
            cornerRadius={cornerRadius}
            reveal={reveal}
            dimmed={activeIndex >= 0 && activeIndex !== index}
            dimOpacity={dimOpacity}
            label={datum.label}
            value={datum.value}
            percent={Math.round((shares[index] ?? 0) * 100)}
            onPress={() => setActiveIndex(activeIndex === index ? -1 : index)}
          />
        );
      })}
    </G>
  );
}
FunnelChartStages.displayName = 'FunnelChart.Stages';
FunnelChartStages.slot = 'svg' as const;

/**
 * One stage, rebuilt on the UI thread every frame it is moving.
 *
 * The fill is folded into the path rather than laid over it as a clip, because
 * a half-drawn stage is a *shorter* trapezoid whose bottom edge is the width
 * the taper has at that height — not the full shape with its lower part hidden,
 * which would show a bottom edge the funnel never has.
 */
function Stage({
  band,
  span,
  total,
  anchor,
  fill,
  strength,
  cornerRadius,
  reveal,
  dimmed,
  dimOpacity,
  label,
  value,
  percent,
  onPress,
}: {
  band: Band;
  span: number;
  total: number;
  anchor: number;
  fill: string;
  strength: number;
  cornerRadius: number;
  reveal: SharedValue<number>;
  dimmed: boolean;
  dimOpacity: number;
  label: string;
  value: number;
  percent: number;
  onPress: () => void;
}) {
  const dim = useDerivedValue(() =>
    withTiming(dimmed ? 1 : 0, { duration: SELECT_DURATION })
  );

  const { top, bottom, height, width, nextWidth } = band;
  const bottomEdge = height > 0 ? (nextWidth - width) / height : 0;

  const animatedProps = useAnimatedProps(() => {
    // One hand sweeping down the run. A stage is drawn as far as it has got and
    // no further, so the funnel fills the way it drains.
    const drawnBottom = Math.min(bottom, reveal.value * total);
    return {
      d:
        drawnBottom <= top
          ? ''
          : trapezoidPath(
              0,
              top,
              drawnBottom,
              width,
              width + bottomEdge * (drawnBottom - top),
              span,
              anchor,
              cornerRadius
            ),
      fillOpacity: strength * (1 - dim.value * (1 - dimOpacity)),
    };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill={fill}
      onPress={onPress}
      // An SVG node takes a label but not a role, so the stages are reachable
      // and named without being announced as buttons. `FunnelChart.Labels` and
      // `FunnelChart.Legend` are the properly wired way through the same
      // selection, and the larger targets.
      accessibilityLabel={`${label}, ${value}, ${percent} percent of the first stage`}
    />
  );
}

export interface FunnelChartSkeletonProps {
  color?: string;
}

/**
 * The loading state: one plain taper over the whole run, undivided.
 *
 * Deliberately undivided. Placeholder stages would be an invented drop-off, and
 * a reader has no way to tell an invented one from a real one until it changes
 * under them — which is worse than showing nothing, because it is showing
 * something wrong.
 */
function FunnelChartSkeleton({ color }: FunnelChartSkeletonProps) {
  const { width, height, anchor, cornerRadius, status } =
    useChart('FunnelChart.Skeleton');
  const token = useCSSVariable('--color-skeleton');
  const fill = color ?? (typeof token === 'string' ? token : 'rgba(128,128,128,0.2)');

  if (status !== 'loading' || width <= 0 || height <= 0) return null;

  return (
    <Path
      d={trapezoidPath(0, 0, height, width, width * 0.4, width, anchor, cornerRadius)}
      fill={fill}
    />
  );
}
FunnelChartSkeleton.displayName = 'FunnelChart.Skeleton';
FunnelChartSkeleton.slot = 'svg' as const;

/** Which ratio a stage's caption reports. */
export type FunnelShare = 'previous' | 'top' | 'none';

export interface FunnelChartLabelsProps {
  className?: string;
  /** Format the number on the trailing edge. Defaults to a compact number. */
  formatValue?: (value: number, stage: FunnelDatum) => string;
  /**
   * Which conversion the muted figure reports. `previous` is the drop from the
   * stage above — the number a funnel is usually read for. `top` is the share
   * of the first stage, which is what a summary wants. The first stage has no
   * stage above it, so it carries nothing under `previous`.
   */
  share?: FunnelShare;
}

/**
 * A row per stage, laid over the run: its name, its value, and how it
 * converted.
 *
 * The row spans the full width rather than sitting inside the shape, and that
 * is the point of it. A funnel's lower stages are narrow by construction — the
 * ones with the worst drop-off are the narrowest, and they are exactly the ones
 * a reader wants to name. Text fitted inside them would be squeezed out of the
 * chart at the bottom, and text that only appears where it fits is text that
 * disappears from the stages that matter.
 *
 * The rows are pressable for the same reason: a two-percent stage is not a
 * target, and the band it lives in is.
 */
function FunnelChartLabels({
  className,
  formatValue,
  share = 'previous',
}: FunnelChartLabelsProps) {
  const { data, bands, shares, steps, status, activeIndex, setActiveIndex } =
    useChart('FunnelChart.Labels');

  if (status === 'loading' || !bands.length) return null;

  const format = formatValue ?? ((value: number) => compactNumber(value));

  return (
    <>
      {bands.map((band, index) => {
        const datum = data[index];
        if (!datum) return null;

        const ratio = share === 'top' ? shares[index] : steps[index];
        const caption =
          share === 'none' || (share === 'previous' && index === 0)
            ? null
            : `${Math.round((ratio ?? 0) * 100)}%`;
        const dimmed = activeIndex >= 0 && activeIndex !== index;

        return (
          <Pressable
            key={datum.label}
            accessibilityRole="button"
            accessibilityState={{ selected: activeIndex === index }}
            accessibilityLabel={`${datum.label}, ${format(datum.value, datum)}${
              caption ? `, ${caption}` : ''
            }`}
            onPress={() => setActiveIndex(activeIndex === index ? -1 : index)}
            style={{
              position: 'absolute',
              top: band.top,
              height: band.height,
              start: 0,
              end: 0,
              opacity: dimmed ? 0.5 : 1,
            }}
            className={cn(
              'flex-row items-center justify-between gap-3 px-3',
              className
            )}
          >
            <Text size="sm" weight="medium" numberOfLines={1} className="shrink">
              {datum.label}
            </Text>
            <View className="flex-row items-baseline gap-1.5">
              <Text size="sm" weight="semibold" numberOfLines={1}>
                {format(datum.value, datum)}
              </Text>
              {caption ? (
                <Text size="xs" muted numberOfLines={1}>
                  {caption}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </>
  );
}
FunnelChartLabels.displayName = 'FunnelChart.Labels';
FunnelChartLabels.slot = 'overlay' as const;

export interface FunnelChartLegendProps extends ViewProps {
  className?: string;
  /** Show each stage's share of the first one beside its name. */
  showValue?: boolean;
}

/**
 * A swatch, a name and a share per stage, under the run and across the width of
 * it. Pressable in the same way the stages are.
 *
 * For a funnel drawn without `Labels` — a compact one on a dashboard card,
 * where the run is a shape and the reading is underneath it.
 */
function FunnelChartLegend({
  className,
  showValue = true,
  ...props
}: FunnelChartLegendProps) {
  const { data, shares, colors, strengths, activeIndex, setActiveIndex } =
    useChart('FunnelChart.Legend');

  if (!data.length) return null;

  return (
    <View
      {...props}
      className={cn(
        'w-full flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-3',
        className
      )}
    >
      {data.map((stage, index) => {
        const percent = Math.round((shares[index] ?? 0) * 100);
        const dimmed = activeIndex >= 0 && activeIndex !== index;
        return (
          <Pressable
            key={stage.label}
            accessibilityRole="button"
            accessibilityState={{ selected: activeIndex === index }}
            accessibilityLabel={`${stage.label}, ${percent} percent of the first stage`}
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
                opacity: strengths[index] ?? 1,
              }}
            />
            <Text size="xs" muted numberOfLines={1} className="shrink">
              {stage.label}
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
FunnelChartLegend.displayName = 'FunnelChart.Legend';
FunnelChartLegend.slot = 'footer' as const;

export interface FunnelChartHeaderProps extends ViewProps {
  className?: string;
  /** Small line above the value — what the funnel is of. */
  title?: string;
  /** The readout. The largest thing on the card, and the first thing read. */
  value?: string;
  /** One muted line under the value — a period, a comparison, a caveat. */
  caption?: string;
  /** Trailing slot — a control, a badge, a range picker. */
  children?: ReactNode;
}

/**
 * The strip above the run: what the funnel is of and what it reads.
 *
 * It belongs to the chart rather than to the card around it because it is about
 * the *stages* — the number changes as one is selected. The card's header is a
 * caption on the tray the chart sits in; this is the chart introducing itself.
 *
 * The value is not derived even though there is a first stage to derive it
 * from, because the formatting is not the chart's to guess: 41800 is a count,
 * a currency or a rate depending on what was counted.
 */
function FunnelChartHeader({
  className,
  title,
  value,
  caption,
  children,
  ...props
}: FunnelChartHeaderProps) {
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
      {children ? <View className="max-w-[55%] shrink pt-1">{children}</View> : null}
    </View>
  );
}
FunnelChartHeader.displayName = 'FunnelChart.Header';
FunnelChartHeader.slot = 'header' as const;

export const FunnelChart = Object.assign(FunnelChartRoot, {
  Header: FunnelChartHeader,
  Stages: FunnelChartStages,
  Labels: FunnelChartLabels,
  Legend: FunnelChartLegend,
  Skeleton: FunnelChartSkeleton,
});
