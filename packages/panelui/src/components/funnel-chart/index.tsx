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
 * One ribbon down the middle, not a stack of blocks. Each stage is a band
 * symmetrical about the centre line, as wide as its value at one end and as
 * wide as the next stage's at the other, and the sides are drawn as curves that
 * reach past each other — so consecutive bands meet flush and the whole run
 * reads as a single narrowing channel. The slope between two stages is the drop
 * between them.
 *
 * Each band is drawn several times over, concentrically: a wide faint ring on
 * the outside through to a tight near-solid core. It is a halo, and it does two
 * jobs. It gives the ribbon an edge that falls off rather than stopping dead,
 * which is what stops five stacked shapes reading as five separate charts; and
 * it leaves a band of low-opacity fill on either side of the core that text can
 * sit on and still be read.
 *
 * The stages arrive one after another rather than together, each growing out of
 * the centre line. A funnel is a sequence, and a sequence that assembles in its
 * own order tells the reader which way to read it before they have read a word.
 *
 * ## Reading it
 *
 * The numbers are laid out around the ribbon rather than crowded into one line
 * beside it: the count on one side, the name on the other, and the conversion
 * in a pill in the middle of the band itself. Three readings, three places, none
 * of them competing for the same space — which is what keeps the names whole at
 * the width a phone actually has, and what keeps the pill legible whatever the
 * ribbon is doing underneath it.
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
import { useDirection } from '../../hooks/use-direction';
import { Text } from '../../primitives/text';
import { compactNumber, ribbonPath, useSeriesColor } from '../../utils/chart';
import { cn } from '../../utils/cn';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Milliseconds for a stage to dim as another is selected. */
const SELECT_DURATION = 180;

/** How far the hue has faded by the bottom of the run. */
const FADE = 0.35;

/** Stages' worth of room kept for a loading chart that has no data yet. */
const SKELETON_STAGES = 4;

/** Rings drawn per stage, unless the caller asks for another number. */
const DEFAULT_LAYERS = 3;

/** How far in the innermost ring is drawn from the outermost. */
const RING_INSET = 0.35;

/** Opacity of the outermost ring, and of the innermost. */
const RING_FAINTEST = 0.18;
const RING_STRONGEST = 0.83;

/** How much further the rings spread when their stage is selected. */
const SELECT_SPREAD = 0.12;

/** Milliseconds between one stage starting to grow and the next. */
const STAGGER = 90;

/**
 * How far the sides' control points reach along a band, as a fraction of it.
 *
 * Past a half they overshoot each other, which is what flattens the ends of the
 * join and puts the whole slope in the middle — the difference between a run
 * that looks poured and one that looks folded.
 */
const CURVE = 0.55;

/**
 * How much of the cross axis is kept for the text on each side of the ribbon.
 * The ribbon gets everything else, and sits centred in it.
 *
 * The two are not equal going down the screen, because what they hold is not
 * equal: a count is "41.8k" and a name is "Checkout started". Splitting the
 * room evenly would be sizing both to the longer one — which is a truncated
 * name at one edge and a band of nothing at the other, and a ribbon squeezed
 * between them for no reason. Across the card the readings go above and below
 * instead, where both are one line and the split is even.
 */
const SHAPE = {
  vertical: { lead: 0.18, trail: 0.32 },
  horizontal: { lead: 0.15, trail: 0.15 },
} as const;

/** Length of one stage along a vertical run, in points. */
const DEFAULT_STAGE = 56;

/** Where a child is drawn: inside the SVG, over it, above it, or under it. */
type Slot = 'svg' | 'overlay' | 'header' | 'footer';

/** Whether the chart is showing data or waiting for it. */
export type FunnelChartStatus = 'loading' | 'ready';

/** Which way the run goes. */
export type FunnelOrientation = 'vertical' | 'horizontal';

/** Whether the sides of a band are drawn as curves or as straight diagonals. */
export type FunnelEdges = 'curved' | 'straight';

/** One step of the process. */
export interface FunnelDatum {
  /** Name of the step, for the label, the legend and the accessibility label. */
  label: string;
  /** How many were left at it. Negatives are treated as zero. */
  value: number;
  /** Explicit colour, drawn at full strength instead of the faded hue. */
  color?: string;
}

/** One stage's band: where it sits along the run and how wide it is at each end. */
interface Band {
  /** Where it starts along the run, in points. */
  offset: number;
  /** How long it is along the run, in points. */
  length: number;
  /** Half-extent across the run at its start, in points. */
  head: number;
  /** Half-extent across at its end — the next stage's, or its own if last. */
  tail: number;
}

interface FunnelChartContextValue {
  data: FunnelDatum[];
  /** The run's length along the axis the stages follow, in points. */
  main: number;
  /** The run's size across that axis, in points. */
  cross: number;
  vertical: boolean;
  /** Room kept for the count, and for the name, in points. */
  leadBand: number;
  trailBand: number;
  /** The ribbon's centre line across the run, in points. */
  middle: number;
  bands: Band[];
  /** Each stage's share of the *first* stage, 0 to 1. */
  shares: number[];
  /** Each stage's share of the one above it, 0 to 1. The first is 1. */
  steps: number[];
  colors: string[];
  /** How far the hue has faded at each stage. `1` where a colour was given. */
  strengths: number[];
  layers: number;
  curve: number;
  /** `0` to `1` across the whole staggered entrance. */
  reveal: SharedValue<number>;
  /** Where in that each stage's own growth begins and ends. */
  windows: { from: number; to: number }[];
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
  /** The steps, in the order they happen. Never reordered. */
  data: FunnelDatum[];
  /**
   * Which way the run goes. `vertical` puts the stages down the screen with the
   * count and the name either side of the ribbon, which is the arrangement a
   * phone has room for. `horizontal` runs them across with the count above and
   * the name below, for a wide card.
   */
  orientation?: FunnelOrientation;
  /**
   * How long one stage is along the run, in points.
   *
   * A vertical run is as long as its stages make it, so this sets its height
   * and defaults to a comfortable row. A horizontal one is already as long as
   * the card is wide, so its stages divide that between them and this is only
   * worth setting to make a run stop short of the edge.
   */
  stageSize?: number;
  /**
   * How far across the run is drawn, in points. `horizontal` only — a vertical
   * run is as wide as it is given and as long as its stages make it.
   */
  crossSize?: number;
  /** Space between one stage and the next, in points. */
  gap?: number;
  /**
   * Concentric rings drawn per stage, faint and wide on the outside through to
   * a near-solid core. `1` draws the band once, flat.
   */
  layers?: number;
  /** Whether the sides of a band are curves or straight diagonals. */
  edges?: FunnelEdges;
  /**
   * The narrowest a non-zero stage is drawn, as a share of the widest.
   *
   * A stage worth a fifth of a percent of the top is a hairline: it reads as
   * missing rather than as small, and "missing" is a different claim. The floor
   * is only applied to stages that have something in them — a genuine zero is
   * drawn as nothing, because there it is the truth.
   */
  minWidth?: number;
  /** The funnel's hue. Defaults to the first chart token. */
  color?: string;
  /** Milliseconds for one stage to grow. */
  animationDuration?: number;
  /** Milliseconds between one stage starting and the next. `0` for all at once. */
  staggerDelay?: number;
  /** `loading` draws one plain muted ribbon until the data arrives. */
  status?: FunnelChartStatus;
  /** Selected stage. Leave unset to let the chart track it. */
  activeIndex?: number;
  /** Fires with the selected stage, or `-1` when the selection is cleared. */
  onActiveIndexChange?: (index: number) => void;
  children?: ReactNode;
}

/** Imperative handle: re-run the entrance, for a "replay" control. */
export interface FunnelChartHandle {
  replay: () => void;
}

const FunnelChartRoot = forwardRef<FunnelChartHandle, FunnelChartProps>(
  function FunnelChartRoot(
    {
      className,
      data,
      orientation = 'vertical',
      stageSize,
      crossSize = 180,
      gap = 4,
      layers = DEFAULT_LAYERS,
      edges = 'curved',
      minWidth = 0.1,
      color,
      animationDuration = 700,
      staggerDelay = STAGGER,
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
    const direction = useDirection();

    const vertical = orientation === 'vertical';
    const shape = vertical ? SHAPE.vertical : SHAPE.horizontal;

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
     * zero length has nowhere to draw the waiting ribbon. So an empty loading
     * chart is given a plausible number of stages' worth of room — which is
     * also what stops the card from jumping the moment the data lands.
     */
    const stages = count || (status === 'loading' ? SKELETON_STAGES : 0);
    const spacing = Math.max(gap, 0);

    /*
     * Down the screen the run makes its own length out of its stages and is
     * given its width; across the card it is the other way about — the length
     * is the card's, and the stages divide it. Which is why the size of a stage
     * is a default in one direction and a derived number in the other: a
     * horizontal run sized in points would stop somewhere short of the edge and
     * leave the rest of the card blank.
     */
    const size =
      stageSize ??
      (vertical
        ? DEFAULT_STAGE
        : stages > 0
          ? Math.max(0, (measured - (stages - 1) * spacing) / stages)
          : 0);
    const along = stages ? stages * size + (stages - 1) * spacing : 0;

    const main = vertical ? along : measured;
    const cross = vertical ? measured : crossSize;
    const width = vertical ? measured : main;
    const height = vertical ? main : cross;

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

    /*
     * A horizontal run reads leading-edge first like the text beside it, and
     * SVG has no leading edge — so under a right-to-left layout the bands are
     * placed from the other end. A vertical run needs none of this: it goes
     * down the screen either way, and it is symmetrical about its own middle.
     */
    const mirrored = !vertical && direction === 'rtl';

    /*
     * The ribbon takes everything the two text bands leave, and its centre line
     * is the middle of *that* rather than the middle of the card. So the widest
     * stage reaches exactly to the text on both sides: no band of nothing at
     * one edge, and no shape creeping under the words at the other.
     */
    const leadBand = cross * shape.lead;
    const trailBand = cross * shape.trail;
    const reach = Math.max(0, (cross - leadBand - trailBand) / 2);
    const middle = leadBand + reach;

    const bands = useMemo<Band[]>(() => {
      if (!count || main <= 0 || reach <= 0) return [];
      const floor = Math.max(0, Math.min(minWidth, 1));
      const extents = data.map((stage) => {
        const value = Math.max(0, stage.value);
        if (value <= 0 || peak <= 0) return 0;
        // The floor is a floor, not a rescale: a stage already above it keeps
        // its true extent, so the extents of the stages that matter still read
        // against each other exactly.
        return reach * Math.max(value / peak, floor);
      });

      return extents.map((extent, index) => {
        const offset = index * (size + spacing);
        const next = extents[index + 1] ?? extent;
        return {
          offset: mirrored ? main - offset - size : offset,
          length: size,
          head: mirrored ? next : extent,
          tail: mirrored ? extent : next,
        };
      });
    }, [count, main, reach, data, peak, minWidth, size, spacing, mirrored]);

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

    /*
     * One clock for the whole entrance, with each stage given the slice of it
     * that it grows in. A shared value per stage would be the same animation
     * played `n` times and `n` more things for a replay to have to find.
     */
    const stagger = Math.max(0, staggerDelay);
    const total = animationDuration + Math.max(count - 1, 0) * stagger;
    const windows = useMemo(
      () =>
        data.map((_, index) => {
          const from = index * stagger;
          return {
            from: total > 0 ? from / total : 0,
            to: total > 0 ? (from + animationDuration) / total : 1,
          };
        }),
      [data, stagger, animationDuration, total]
    );

    const playReveal = useMemo(
      () => () => {
        if (reducedMotion) {
          reveal.value = 1;
          return;
        }
        reveal.value = 0;
        // Linear, because the shaping is per stage: each one eases inside its
        // own window, and easing the clock as well would ease it twice.
        reveal.value = withTiming(1, { duration: total, easing: Easing.linear });
      },
      [reducedMotion, total, reveal]
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
    // run's — which are different sizes the moment there is a header.
    const onLayout = (event: LayoutChangeEvent) => {
      const next = Math.round(event.nativeEvent.layout.width);
      if (next !== measured) setMeasured(next);
    };

    const context = useMemo<FunnelChartContextValue>(
      () => ({
        data,
        main,
        cross,
        vertical,
        leadBand,
        trailBand,
        middle,
        bands,
        shares,
        steps,
        colors,
        strengths,
        layers: Math.max(1, Math.round(layers)),
        curve: edges === 'curved' ? CURVE : 0,
        reveal,
        windows,
        status,
        activeIndex,
        setActiveIndex,
      }),
      [
        data,
        main,
        cross,
        vertical,
        leadBand,
        trailBand,
        middle,
        bands,
        shares,
        steps,
        colors,
        strengths,
        layers,
        edges,
        reveal,
        windows,
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
                <Svg width={width} height={height}>
                  {slots.svg}
                </Svg>
                {/*
                 * Labels sit over the SVG rather than inside it: they are text,
                 * and SVG text ignores the platform's text scaling and the
                 * theme's font.
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
 * One part rather than one per datum. A stage's near edge is the previous
 * stage's far edge, so they cannot be configured apart without the ribbon
 * coming apart with them — a funnel whose third stage could be given its own
 * width would be a funnel drawing a shape that is not in the data.
 */
function FunnelChartStages({ dimOpacity = 0.3 }: FunnelChartStagesProps) {
  const {
    data,
    bands,
    colors,
    strengths,
    middle,
    vertical,
    layers,
    curve,
    reveal,
    windows,
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
        const window = windows[index];
        if (!datum || !window || (band.head <= 0 && band.tail <= 0)) return null;
        return (
          <Stage
            key={datum.label}
            band={band}
            middle={middle}
            vertical={vertical}
            curve={curve}
            layers={layers}
            fill={colors[index] ?? colors[0]!}
            strength={strengths[index] ?? 1}
            reveal={reveal}
            window={window}
            selected={activeIndex === index}
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
 * One stage, drawn as a stack of concentric rings.
 *
 * Every ring is rebuilt on the UI thread each frame it is moving. They grow out
 * of the centre line rather than being scaled from nothing, because a scale
 * would take the curve's control points with it and the sides would flex on the
 * way in; growing the extents leaves the shape's geometry alone and only ever
 * changes how far across it reaches.
 */
function Stage({
  band,
  middle,
  vertical,
  curve,
  layers,
  fill,
  strength,
  reveal,
  window,
  selected,
  dimmed,
  dimOpacity,
  label,
  value,
  percent,
  onPress,
}: {
  band: Band;
  middle: number;
  vertical: boolean;
  curve: number;
  layers: number;
  fill: string;
  strength: number;
  reveal: SharedValue<number>;
  window: { from: number; to: number };
  selected: boolean;
  dimmed: boolean;
  dimOpacity: number;
  label: string;
  value: number;
  percent: number;
  onPress: () => void;
}) {
  const dim = useDerivedValue<number>(() =>
    withTiming(dimmed ? 1 : 0, { duration: SELECT_DURATION })
  );
  const spread = useDerivedValue<number>(() =>
    withTiming(selected ? 1 : 0, { duration: SELECT_DURATION })
  );

  return (
    <G
      onPress={onPress}
      // An SVG node takes a label but not a role, so the stages are reachable
      // and named without being announced as buttons. `FunnelChart.Labels` and
      // `FunnelChart.Legend` are the properly wired way through the same
      // selection, and the larger targets.
      accessibilityLabel={`${label}, ${value}, ${percent} percent of the first stage`}
    >
      {Array.from({ length: layers }, (_, ring) => (
        <Ring
          key={ring}
          band={band}
          middle={middle}
          vertical={vertical}
          curve={curve}
          fill={fill}
          // The outermost ring is the widest and the faintest, the innermost the
          // tightest and the strongest, so the fill falls off towards the edge
          // instead of ending at one.
          scale={1 - (ring / layers) * RING_INSET}
          opacity={
            strength *
            (RING_FAINTEST +
              (ring / Math.max(layers - 1, 1)) * (RING_STRONGEST - RING_FAINTEST))
          }
          // Selecting a stage pushes the core out further than the halo, which
          // reads as the band swelling rather than as the whole thing resizing.
          spreadBy={(ring / Math.max(layers - 1, 1)) * SELECT_SPREAD}
          reveal={reveal}
          window={window}
          spread={spread}
          dim={dim}
          dimOpacity={dimOpacity}
        />
      ))}
    </G>
  );
}

function Ring({
  band,
  middle,
  vertical,
  curve,
  fill,
  scale,
  opacity,
  spreadBy,
  reveal,
  window,
  spread,
  dim,
  dimOpacity,
}: {
  band: Band;
  middle: number;
  vertical: boolean;
  curve: number;
  fill: string;
  scale: number;
  opacity: number;
  spreadBy: number;
  reveal: SharedValue<number>;
  window: { from: number; to: number };
  spread: SharedValue<number>;
  dim: SharedValue<number>;
  dimOpacity: number;
}) {
  const { offset, length, head, tail } = band;
  const { from, to } = window;

  const animatedProps = useAnimatedProps(() => {
    const range = to - from;
    const raw = range > 0 ? (reveal.value - from) / range : 1;
    const progress = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    // Ease out cubic: fast to most of the way, then settling. Written out
    // rather than called, because an easing from the animation library is not
    // a worklet and this runs on the UI thread.
    const eased = 1 - (1 - progress) * (1 - progress) * (1 - progress);
    const reach = scale * eased * (1 + spread.value * spreadBy);

    return {
      d: ribbonPath(
        offset,
        length,
        head * reach,
        tail * reach,
        middle,
        curve,
        vertical
      ),
      fillOpacity: opacity * (1 - dim.value * (1 - dimOpacity)),
    };
  });

  return <AnimatedPath animatedProps={animatedProps} fill={fill} />;
}

export interface FunnelChartSkeletonProps {
  color?: string;
}

/**
 * The loading state: one plain ribbon over the whole run, undivided.
 *
 * Deliberately undivided. Placeholder stages would be an invented drop-off, and
 * a reader has no way to tell an invented one from a real one until it changes
 * under them — which is worse than showing nothing, because it is showing
 * something wrong.
 */
function FunnelChartSkeleton({ color }: FunnelChartSkeletonProps) {
  const { main, cross, middle, leadBand, trailBand, vertical, curve, status } =
    useChart('FunnelChart.Skeleton');
  const token = useCSSVariable('--color-skeleton');
  const fill = color ?? (typeof token === 'string' ? token : 'rgba(128,128,128,0.2)');

  if (status !== 'loading' || main <= 0 || cross <= 0) return null;

  const extent = Math.max(0, (cross - leadBand - trailBand) / 2);

  return (
    <Path
      d={ribbonPath(0, main, extent, extent * 0.4, middle, curve, vertical)}
      fill={fill}
    />
  );
}
FunnelChartSkeleton.displayName = 'FunnelChart.Skeleton';
FunnelChartSkeleton.slot = 'svg' as const;

/** Which ratio a stage's pill reports. */
export type FunnelShare = 'previous' | 'top' | 'none';

export interface FunnelChartLabelsProps {
  className?: string;
  /** Format the count. Defaults to a compact number. */
  formatValue?: (value: number, stage: FunnelDatum) => string;
  /** Format the conversion in the pill. Defaults to a whole percent. */
  formatShare?: (share: number, stage: FunnelDatum) => string;
  /**
   * Which conversion the pill reports. `top` is the share of the first stage,
   * which every stage has and which reads down the run as one falling series.
   * `previous` is the drop from the stage above — the step-by-step reading,
   * where the first stage has nothing above it and so carries no pill.
   */
  share?: FunnelShare;
  /** Show the count beside the ribbon. */
  showValue?: boolean;
  /** Show the stage's name beside the ribbon. */
  showLabel?: boolean;
}

/**
 * The readings, arranged around the ribbon: the count on the near side, the
 * name on the far side, and the conversion in a pill in the middle of the band.
 *
 * Three places rather than one line, and that is the whole point of it. Put a
 * name, a count and a percentage together on one row and the row is as wide as
 * all three — so on the width a phone actually has, the name is the one that
 * gives way and the reader is left with "Checkout st…" against a number. Split
 * across the band, each reading has a column to itself and a stage name fits
 * whole at a size worth reading.
 *
 * The pill is a filled chip rather than bare text because it is the one reading
 * that sits *on* the ribbon, where the fill behind it is the same token family
 * as the text would be. Punched out of its own background, it reads whatever
 * the band is doing underneath.
 *
 * The rows are pressable rather than the shape alone: a two-percent stage is a
 * sliver, and the band it lives in is a target.
 */
function FunnelChartLabels({
  className,
  formatValue,
  formatShare,
  share = 'top',
  showValue = true,
  showLabel = true,
}: FunnelChartLabelsProps) {
  const {
    data,
    bands,
    shares,
    steps,
    vertical,
    leadBand,
    trailBand,
    status,
    activeIndex,
    setActiveIndex,
  } = useChart('FunnelChart.Labels');

  if (status === 'loading' || !bands.length) return null;

  const format = formatValue ?? ((value: number) => compactNumber(value));
  const formatPercent =
    formatShare ?? ((ratio: number) => `${Math.round(ratio * 100)}%`);

  return (
    <>
      {bands.map((band, index) => {
        const datum = data[index];
        if (!datum) return null;

        const ratio = share === 'top' ? shares[index] : steps[index];
        const pill =
          share === 'none' || (share === 'previous' && index === 0)
            ? null
            : formatPercent(ratio ?? 0, datum);
        const dimmed = activeIndex >= 0 && activeIndex !== index;
        const value = format(datum.value, datum);

        return (
          <Pressable
            key={datum.label}
            accessibilityRole="button"
            accessibilityState={{ selected: activeIndex === index }}
            accessibilityLabel={`${datum.label}, ${value}${pill ? `, ${pill}` : ''}`}
            onPress={() => setActiveIndex(activeIndex === index ? -1 : index)}
            style={
              vertical
                ? {
                    position: 'absolute',
                    top: band.offset,
                    height: band.length,
                    start: 0,
                    end: 0,
                    opacity: dimmed ? 0.5 : 1,
                  }
                : {
                    position: 'absolute',
                    start: band.offset,
                    width: band.length,
                    top: 0,
                    bottom: 0,
                    opacity: dimmed ? 0.5 : 1,
                  }
            }
            className={cn(
              vertical ? 'flex-row items-center' : 'items-center',
              className
            )}
          >
            {/*
             * The two outer bands are sized to the same share of the run that
             * the ribbon leaves them, so the text ends exactly where the shape
             * has stopped rather than at a padding somebody guessed.
             */}
            <View
              style={vertical ? { width: leadBand } : { height: leadBand }}
              className={
                vertical ? 'items-end justify-center pe-2' : 'justify-end pb-1'
              }
            >
              {showValue ? (
                <Text size="sm" weight="semibold" numberOfLines={1}>
                  {value}
                </Text>
              ) : null}
            </View>
            <View className="flex-1 items-center justify-center">
              {pill ? (
                <View className="rounded-full border border-border bg-background px-2 py-0.5">
                  <Text size="xs" weight="bold" numberOfLines={1}>
                    {pill}
                  </Text>
                </View>
              ) : null}
            </View>
            <View
              style={vertical ? { width: trailBand } : { height: trailBand }}
              className={
                vertical ? 'items-start justify-center ps-2' : 'justify-start pt-1'
              }
            >
              {showLabel ? (
                <Text size="xs" muted weight="medium" numberOfLines={1}>
                  {datum.label}
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

/** How the key under the run is arranged. */
export type FunnelLegendLayout = 'list' | 'inline';

export interface FunnelChartLegendProps extends ViewProps {
  className?: string;
  /**
   * `list` gives every stage a row of its own, with the names down one column
   * and the numbers down another. `inline` runs them together across the width
   * and wraps, which is the denser arrangement where the names are short.
   */
  layout?: FunnelLegendLayout;
  /** Show each stage's reading beside its name. */
  showValue?: boolean;
  /** Format the value in a `list` key. Defaults to a compact number. */
  formatValue?: (value: number, stage: FunnelDatum) => string;
}

/**
 * A swatch, a name and a reading per stage, under the run. Pressable in the
 * same way the stages are.
 *
 * For a funnel drawn without `Labels` — a compact one on a dashboard card,
 * where the run is a shape and the reading is underneath it.
 *
 * A row each, by default. The stages of a funnel are a sequence, and a wrapped
 * centred line loses that: the reader gets a ragged block of names in which the
 * order is only implied by the order they happen to be read in, and a long
 * stage name breaks it across lines that no longer line up with anything. Down
 * a column the order is the order, and the numbers stack into a column of their
 * own that can be compared at a glance.
 */
function FunnelChartLegend({
  className,
  layout = 'list',
  showValue = true,
  formatValue,
  ...props
}: FunnelChartLegendProps) {
  const { data, shares, colors, strengths, activeIndex, setActiveIndex } =
    useChart('FunnelChart.Legend');

  if (!data.length) return null;

  const list = layout === 'list';
  const format = formatValue ?? ((value: number) => compactNumber(value));

  return (
    <View
      {...props}
      className={cn(
        'w-full pt-3',
        list
          ? 'gap-1.5'
          : 'flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1.5',
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
            className={cn(
              'flex-row items-center gap-1.5',
              list ? 'w-full' : 'max-w-full'
            )}
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
            <Text
              size="xs"
              muted
              numberOfLines={1}
              className={list ? 'flex-1' : 'shrink'}
            >
              {stage.label}
            </Text>
            {showValue ? (
              <>
                {/*
                 * The value only earns its place in a list, where it lands in a
                 * column with the others. Inline it would be a second number
                 * loose in a wrapping line, and the share is the one worth
                 * having there.
                 */}
                {list ? (
                  <Text size="xs" weight="medium" numberOfLines={1}>
                    {format(stage.value, stage)}
                  </Text>
                ) : null}
                <Text
                  size="xs"
                  muted={list}
                  weight={list ? 'normal' : 'medium'}
                  numberOfLines={1}
                  className={list ? 'w-10 text-right' : undefined}
                >
                  {percent}%
                </Text>
              </>
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
