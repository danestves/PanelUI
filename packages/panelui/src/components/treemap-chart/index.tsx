/**
 * TreemapChart — a total, cut into the things it is made of, by area.
 *
 * ```tsx
 * <TreemapChart data={spend}>
 *   <TreemapChart.Header title="Spend" value="£48,200" />
 *   <TreemapChart.Tiles />
 *   <TreemapChart.Labels />
 *   <TreemapChart.Tooltip />
 * </TreemapChart>
 * ```
 *
 * ## What it is for, against the dial next door
 *
 * A pie and a treemap answer the same question — what is this total made of —
 * and they fail at different sizes. A dial can carry five or six slices before
 * the small ones become slivers with nowhere to put a name. A treemap keeps
 * going, because a share is a rectangle rather than an angle: it can be read
 * at a tenth the size, it tiles the box with nothing left over, and it has a
 * flat side to write on.
 *
 * So the rule of thumb is the count. Up to about six parts, a `PieChart` is
 * easier to read and more familiar. Past that, a treemap is the one that still
 * works.
 *
 * The trade-off is precision. People compare angles badly and areas worse, so
 * nobody should be reading values off the tiles — the layout is for *ranking
 * and grouping* at a glance, and the numbers are in the labels.
 *
 * ## The layout
 *
 * Squarified. Tiles are laid in rows across whichever side of the remaining
 * space is shorter, and a row takes another tile only while doing so makes its
 * worst rectangle *less* elongated than it already is. The result is tiles
 * close to square, which matters for two reasons: a square is the shape whose
 * area the eye judges least badly, and it is the only shape with room for a
 * name across it.
 *
 * It follows that the tiles are sorted, largest first, and the order is the
 * chart's rather than the caller's. An unsorted treemap squarifies badly —
 * rows end up mixing one large tile with several small ones, which is exactly
 * the case the row test cannot rescue. Pass `sort={false}` where the given
 * order carries meaning and the shapes may suffer for it.
 *
 * ## Too many parts
 *
 * A treemap of two hundred rows on a phone is a texture, not a chart. `maxTiles`
 * keeps the largest few and gathers the rest into one tile, which is the honest
 * summary of a long tail — the reader can see how much of the total it is worth
 * instead of squinting at forty slivers that were never legible.
 *
 * ## Colour
 *
 * One hue, stepping down the ranking, rather than a colour per tile. The tiles
 * are parts of one total and the area already says which is bigger, so a set of
 * unrelated hues would be claiming a distinction that is not in the data — and
 * a treemap has more parts than there are chart tokens, so they would repeat
 * and two unrelated tiles would come out matching. A tile can still be given
 * its own `color` where it means something, and that one is drawn at full
 * strength against the ramp.
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
  cancelAnimation,
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Text } from '../../primitives/text';
import { compactNumber, useSeriesColor } from '../../utils/chart';
import { cn } from '../../utils/cn';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/** Width ÷ height of the box the tiles fill, when the caller does not say. */
const DEFAULT_ASPECT = 1.4;

/**
 * The aspect ratio the row test aims each tile at.
 *
 * The golden ratio rather than 1. Aiming at a perfect square makes the test
 * close rows early and leaves the leftovers to the last row, which is then the
 * only badly shaped one on the chart. Aiming slightly wide spreads that cost
 * over all of them.
 */
const TARGET_RATIO = (1 + Math.sqrt(5)) / 2;

/** How far the hue has faded by the smallest tile. */
const FADE = 0.45;

/** Milliseconds for a tile to dim as another is selected. */
const SELECT_DURATION = 180;

/** Milliseconds between one tile starting to grow and the next. */
const STAGGER = 26;

/** Below this, on either side, a tile has no room for a name. */
const DEFAULT_MIN_LABEL = 48;

/** Room the readout needs above the tile it names. */
const TOOLTIP_HEIGHT = 30;

/** Width the readout is laid out at, so it can be clamped inside the box. */
const TOOLTIP_WIDTH = 132;

/** Where a child is drawn: inside the SVG, over it, above it, or under it. */
type Slot = 'svg' | 'overlay' | 'header' | 'footer';

/** Whether the chart is showing data or waiting for it. */
export type TreemapChartStatus = 'loading' | 'ready';

/** One part of the total. */
export interface TreemapDatum {
  /** Name of the part, for the label, the readout and the legend. */
  label: string;
  /** Its size. Negatives are treated as zero — an area cannot be less than none. */
  value: number;
  /** Explicit colour, drawn at full strength instead of the ramp. */
  color?: string;
}

/** A tile's box inside the chart, in points. */
export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One laid-out tile: its datum, its share of the total, and where it sits. */
export interface TreemapTile extends TreemapRect {
  label: string;
  value: number;
  /** Its share of the whole chart, `0` to `1`. */
  share: number;
  color: string;
  /** How far along the ramp it is drawn, `0` to `1`. `1` where a colour was given. */
  strength: number;
  /**
   * Its row in `data`, or `-1` for the gathered tile `maxTiles` makes, which
   * stands for several rows and so belongs to none of them.
   */
  sourceIndex: number;
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One row of tiles laid across the top of the remaining box.
 *
 * The row is as deep as its share of the total and as wide as the box, and the
 * tiles inside it divide that width between them.
 */
function diceRow(
  values: number[],
  from: number,
  to: number,
  sum: number,
  out: TreemapRect[],
  x0: number,
  y0: number,
  x1: number,
  y1: number
) {
  const scale = sum ? (x1 - x0) / sum : 0;
  let x = x0;
  for (let i = from; i < to; i += 1) {
    const width = values[i]! * scale;
    out[i] = { x, y: y0, width, height: y1 - y0 };
    x += width;
  }
}

/** The same row, stood on its end down the left of the remaining box. */
function sliceRow(
  values: number[],
  from: number,
  to: number,
  sum: number,
  out: TreemapRect[],
  x0: number,
  y0: number,
  x1: number,
  y1: number
) {
  const scale = sum ? (y1 - y0) / sum : 0;
  let y = y0;
  for (let i = from; i < to; i += 1) {
    const height = values[i]! * scale;
    out[i] = { x: x0, y, width: x1 - x0, height };
    y += height;
  }
}

/**
 * Squarified treemap layout: values in, rectangles out, in the same order.
 *
 * Written out rather than taken from a layout dependency, because it is sixty
 * lines and the alternative is shipping a tree library to call one function of.
 *
 * The shape of it: take the remaining box, and start a row along whichever of
 * its sides is shorter. Add tiles to that row one at a time, and after each,
 * ask what the worst aspect ratio in the row now is. While that number keeps
 * falling the row is getting better and the tile is kept; the first tile that
 * makes it rise is put back, the row is closed and laid out, and the box
 * shrinks by the strip the row took.
 *
 * Rows go along the *shorter* side because a row is divided along its length
 * and is a fixed depth: dividing the long side gives thin tiles, and the whole
 * point of the exercise is not to have any.
 *
 * @param values Tile sizes. Must be non-negative, and should be descending.
 * @param ratio The aspect ratio the row test aims at.
 */
export function squarifyLayout(
  values: number[],
  width: number,
  height: number,
  ratio: number = TARGET_RATIO
): TreemapRect[] {
  const count = values.length;
  const out: TreemapRect[] = new Array(count);
  if (!count || width <= 0 || height <= 0) return [];

  let remaining = 0;
  for (let i = 0; i < count; i += 1) remaining += values[i]!;
  if (remaining <= 0) return [];

  let x0 = 0;
  let y0 = 0;
  const x1 = width;
  const y1 = height;

  let start = 0;
  let end = 0;

  while (start < count) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    if (dx <= 0 || dy <= 0) break;

    /*
     * A run of zeros is stepped over rather than measured: they take no area,
     * and dividing by one would make the row test meaningless for the tiles
     * that follow it. They stay in the row and come out with no width.
     */
    let sum = 0;
    do {
      sum = values[end]!;
      end += 1;
    } while (!sum && end < count);

    let smallest = sum;
    let largest = sum;

    /*
     * `alpha` folds everything that does not change inside the row — the box's
     * shape and what is left of the total — into one factor, so the test below
     * is a couple of multiplications per tile rather than a full aspect-ratio
     * calculation.
     */
    const alpha = Math.max(dy / dx, dx / dy) / (remaining * ratio);
    let beta = sum * sum * alpha;
    let worst = Math.max(largest / beta, beta / smallest);

    for (; end < count; end += 1) {
      const value = values[end]!;
      sum += value;
      if (value < smallest) smallest = value;
      if (value > largest) largest = value;
      beta = sum * sum * alpha;
      const next = Math.max(largest / beta, beta / smallest);
      // The first tile that makes the row worse is put back for the next one.
      if (next > worst) {
        sum -= value;
        break;
      }
      worst = next;
    }

    // Along the shorter side: a tall box gets a row across the top, a wide one
    // gets a column down the side.
    if (dx < dy) {
      const edge = remaining ? y0 + (dy * sum) / remaining : y1;
      diceRow(values, start, end, sum, out, x0, y0, x1, edge);
      y0 = edge;
    } else {
      const edge = remaining ? x0 + (dx * sum) / remaining : x1;
      sliceRow(values, start, end, sum, out, x0, y0, edge, y1);
      x0 = edge;
    }

    remaining -= sum;
    start = end;
  }

  // A box that ran out of room before the tiles did leaves holes in the array.
  for (let i = 0; i < count; i += 1) {
    if (!out[i]) out[i] = { x: x0, y: y0, width: 0, height: 0 };
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Root                                                                       */
/* -------------------------------------------------------------------------- */

interface TreemapChartContextValue {
  tiles: TreemapTile[];
  width: number;
  height: number;
  total: number;
  cornerRadius: number;
  minLabelSize: number;
  /** `0` to `1` across the whole staggered entrance. */
  reveal: SharedValue<number>;
  /** Where in that each tile's own growth begins and ends. */
  windows: { from: number; to: number }[];
  status: TreemapChartStatus;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

const TreemapChartContext = createContext<TreemapChartContextValue | null>(null);

function useChart(component: string): TreemapChartContextValue {
  const context = useContext(TreemapChartContext);
  if (!context) {
    throw new Error(`${component} must be used within a <TreemapChart>`);
  }
  return context;
}

/**
 * The selected tile, for something rendered *inside* the chart. A readout in
 * the card's header is outside this provider — use `onActiveIndexChange` there.
 */
export function useTreemapChart() {
  const { tiles, total, activeIndex } = useChart('useTreemapChart');
  return {
    /** Index into the tiles **as laid out**, which is the sorted order. */
    activeIndex,
    activeTile: activeIndex >= 0 ? (tiles[activeIndex] ?? null) : null,
    tiles,
    total,
  };
}

export interface TreemapChartProps extends ViewProps {
  className?: string;
  /** The parts of the total, in any order. Sorted by the chart unless told not to. */
  data: TreemapDatum[];
  /** Width ÷ height of the box the tiles fill. */
  aspectRatio?: number;
  /** Space between one tile and the next, in points. */
  gap?: number;
  /** Corner radius of a tile, in points. */
  cornerRadius?: number;
  /**
   * Sort the tiles largest first.
   *
   * On by default, and worth leaving on. The row test assumes a descending run
   * — given a large tile next to a small one it has no good row to make, and
   * the chart comes out as slivers. Turn it off only where the given order is
   * itself the message.
   */
  sort?: boolean;
  /**
   * Keep the largest `maxTiles` and gather the rest into one.
   *
   * A phone-width treemap runs out of legible tiles somewhere around twenty.
   * Past that the tail is texture, and one tile that says how much the tail is
   * worth is more use than forty that cannot be read or hit.
   */
  maxTiles?: number;
  /** What the gathered tile is called. */
  otherLabel?: string;
  /** The ramp's hue. Defaults to the first chart token. */
  color?: string;
  /**
   * Smallest side, in points, a tile needs before `Labels` writes on it.
   *
   * A name clipped to two letters is not a shorter name, it is a different
   * word. Tiles under this are left blank and read through the readout.
   */
  minLabelSize?: number;
  /** Milliseconds for one tile to grow. */
  animationDuration?: number;
  /** Milliseconds between one tile starting and the next. `0` for all at once. */
  staggerDelay?: number;
  /** `loading` draws the box undivided until the data arrives. */
  status?: TreemapChartStatus;
  /** Selected tile, indexed as laid out. Leave unset to let the chart track it. */
  activeIndex?: number;
  /** Fires with the selected tile, or `-1` when the selection is cleared. */
  onActiveIndexChange?: (index: number) => void;
  children?: ReactNode;
}

/** Imperative handle: re-run the entrance, for a "replay" control. */
export interface TreemapChartHandle {
  replay: () => void;
}

const TreemapChartRoot = forwardRef<TreemapChartHandle, TreemapChartProps>(
  function TreemapChartRoot(
    {
      className,
      data,
      aspectRatio = DEFAULT_ASPECT,
      gap = 3,
      cornerRadius = 6,
      sort = true,
      maxTiles,
      otherLabel = 'Other',
      color,
      minLabelSize = DEFAULT_MIN_LABEL,
      animationDuration = 520,
      staggerDelay = STAGGER,
      status = 'ready',
      activeIndex: activeIndexProp,
      onActiveIndexChange,
      children,
      ...props
    },
    ref
  ) {
    const [size, setSize] = useState({ width: 0, height: 0 });
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

    /*
     * The parts, cleaned up and put in order, before any of it is measured.
     * Kept apart from the layout below so that resizing the card re-runs the
     * geometry without re-running the sort and the gathering.
     */
    const parts = useMemo(() => {
      const cleaned = data.map((datum, index) => ({
        label: datum.label,
        // An area cannot be negative, and a treemap has no way to draw one.
        value: Math.max(0, datum.value) || 0,
        color: datum.color,
        sourceIndex: index,
      }));

      const ordered = sort ? [...cleaned].sort((a, b) => b.value - a.value) : cleaned;

      const limit = maxTiles && maxTiles > 0 ? Math.floor(maxTiles) : 0;
      if (!limit || ordered.length <= limit) return ordered;

      /*
       * The tail is gathered rather than dropped. Dropping it would rescale
       * everything that is left, so every remaining tile would silently claim a
       * larger share of the total than it has.
       */
      const kept = ordered.slice(0, Math.max(1, limit - 1));
      const rest = ordered.slice(Math.max(1, limit - 1));
      const tail = rest.reduce((sum, part) => sum + part.value, 0);
      if (tail <= 0) return kept;

      return [
        ...kept,
        { label: otherLabel, value: tail, color: undefined, sourceIndex: -1 },
      ];
    }, [data, sort, maxTiles, otherLabel]);

    const total = useMemo(
      () => parts.reduce((sum, part) => sum + part.value, 0),
      [parts]
    );

    const hue = useSeriesColor(color, 1);

    const tiles = useMemo<TreemapTile[]>(() => {
      if (!parts.length || size.width <= 0 || size.height <= 0) return [];

      const rects = squarifyLayout(
        parts.map((part) => part.value),
        size.width,
        size.height
      );
      if (!rects.length) return [];

      const inset = Math.max(0, gap) / 2;
      const last = Math.max(parts.length - 1, 1);

      return parts.map((part, index) => {
        const rect = rects[index] ?? { x: 0, y: 0, width: 0, height: 0 };
        return {
          label: part.label,
          value: part.value,
          share: total > 0 ? part.value / total : 0,
          color: part.color ?? hue,
          // Down the ranking rather than by value: two tiles of nearly equal
          // size should still be told apart, and it is the order that is being
          // shown, not a second copy of the area.
          strength: part.color ? 1 : 1 - (index / last) * FADE,
          sourceIndex: part.sourceIndex,
          x: rect.x + inset,
          y: rect.y + inset,
          width: Math.max(0, rect.width - inset * 2),
          height: Math.max(0, rect.height - inset * 2),
        };
      });
    }, [parts, size.width, size.height, gap, total, hue]);

    /*
     * One clock for the whole entrance, with each tile given the slice of it
     * that it grows in. A shared value per tile would be the same animation
     * played `n` times and `n` more things for a replay to have to find.
     */
    const stagger = Math.max(0, staggerDelay);
    const span = animationDuration + Math.max(tiles.length - 1, 0) * stagger;
    const windows = useMemo(
      () =>
        tiles.map((_unused, index) => {
          const from = index * stagger;
          return {
            from: span > 0 ? from / span : 0,
            to: span > 0 ? (from + animationDuration) / span : 1,
          };
        }),
      [tiles, stagger, animationDuration, span]
    );

    const playReveal = useMemo(
      () => () => {
        if (reducedMotion) {
          reveal.value = 1;
          return;
        }
        reveal.value = 0;
        // Linear, because the shaping is per tile: each one eases inside its
        // own window, and easing the clock as well would ease it twice.
        reveal.value = withTiming(1, { duration: span, easing: Easing.linear });
      },
      [reducedMotion, span, reveal]
    );

    const loading = status === 'loading';
    const revealed = useRef(false);

    useEffect(() => {
      if (loading) {
        revealed.current = false;
        reveal.value = 0;
        return;
      }
      if (revealed.current || !tiles.length) return;
      revealed.current = true;
      playReveal();
    }, [loading, tiles.length, playReveal, reveal]);

    useImperativeHandle(ref, () => ({ replay: playReveal }), [playReveal]);

    // The caller's own `onLayout` is not forwarded from here: it is already on
    // the outer view, and the box it wants is the whole chart's rather than the
    // tiles' — which are different heights the moment there is a header.
    const onLayout = (event: LayoutChangeEvent) => {
      const next = {
        width: Math.round(event.nativeEvent.layout.width),
        height: Math.round(event.nativeEvent.layout.height),
      };
      if (next.width !== size.width || next.height !== size.height) setSize(next);
    };

    const context = useMemo<TreemapChartContextValue>(
      () => ({
        tiles,
        width: size.width,
        height: size.height,
        total,
        cornerRadius,
        minLabelSize,
        reveal,
        windows,
        status,
        activeIndex,
        setActiveIndex,
      }),
      [
        tiles,
        size.width,
        size.height,
        total,
        cornerRadius,
        minLabelSize,
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
      <TreemapChartContext.Provider value={context}>
        <View {...props} style={props.style} className={cn('w-full', className)}>
          {slots.header}
          {/*
           * The box is measured on its own view rather than the outer one, so a
           * header or a legend cannot change how large the tiles think they are.
           */}
          <View onLayout={onLayout} style={{ aspectRatio }} className="w-full">
            {size.width > 0 && size.height > 0 ? (
              <>
                <Svg width={size.width} height={size.height}>
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
                    width: size.width,
                    height: size.height,
                  }}
                >
                  {slots.overlay}
                </View>
              </>
            ) : null}
          </View>
          {slots.footer}
        </View>
      </TreemapChartContext.Provider>
    );
  }
);
TreemapChartRoot.displayName = 'TreemapChart';

function ChildSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* -------------------------------------------------------------------------- */
/* SVG layer                                                                  */
/* -------------------------------------------------------------------------- */

export interface TreemapChartTilesProps {
  /** Opacity of the tiles that are not selected, once one is. */
  dimOpacity?: number;
}

/**
 * Every tile, drawn in the order they were laid out.
 *
 * One part rather than one per datum: a tile's box is decided by every tile
 * before it in the row, so they cannot be configured apart without the layout
 * coming apart with them.
 */
function TreemapChartTiles({ dimOpacity = 0.35 }: TreemapChartTilesProps) {
  const { tiles, cornerRadius, reveal, windows, status, activeIndex, setActiveIndex } =
    useChart('TreemapChart.Tiles');

  if (status === 'loading' || !tiles.length) return null;

  return (
    <G>
      {tiles.map((tile, index) => {
        const window = windows[index];
        if (!window || tile.width <= 0 || tile.height <= 0) return null;
        return (
          <Tile
            key={`${tile.label}-${index}`}
            tile={tile}
            radius={cornerRadius}
            reveal={reveal}
            window={window}
            dimmed={activeIndex >= 0 && activeIndex !== index}
            dimOpacity={dimOpacity}
            onPress={() => setActiveIndex(activeIndex === index ? -1 : index)}
          />
        );
      })}
    </G>
  );
}
TreemapChartTiles.displayName = 'TreemapChart.Tiles';
TreemapChartTiles.slot = 'svg' as const;

/**
 * One tile, growing out of its own centre.
 *
 * Out of the centre rather than up from an edge, because a treemap has no
 * baseline for anything to grow from — every tile is surrounded by others, and
 * a shared direction would read as the whole chart sliding.
 */
function Tile({
  tile,
  radius,
  reveal,
  window,
  dimmed,
  dimOpacity,
  onPress,
}: {
  tile: TreemapTile;
  radius: number;
  reveal: SharedValue<number>;
  window: { from: number; to: number };
  dimmed: boolean;
  dimOpacity: number;
  onPress: () => void;
}) {
  const dim = useDerivedValue<number>(() =>
    withTiming(dimmed ? 1 : 0, { duration: SELECT_DURATION })
  );

  const animatedProps = useAnimatedProps(() => {
    const span = window.to - window.from || 1;
    const raw = (reveal.value - window.from) / span;
    const clamped = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    // Eased here rather than on the clock, so a tile's own growth is shaped
    // while the order the tiles arrive in stays even.
    const grown = 1 - (1 - clamped) * (1 - clamped) * (1 - clamped);

    const width = tile.width * grown;
    const height = tile.height * grown;

    return {
      x: tile.x + (tile.width - width) / 2,
      y: tile.y + (tile.height - height) / 2,
      width,
      height,
      opacity: tile.strength * (1 - dim.value * (1 - dimOpacity)),
    };
  });

  const percent = Math.round(tile.share * 100);

  return (
    <AnimatedRect
      animatedProps={animatedProps}
      fill={tile.color}
      // A tile is rounded only where it has room to be: a sliver with a 6-point
      // radius is a lozenge, and a row of them reads as a scale rather than a
      // set of areas.
      rx={Math.max(0, Math.min(radius, tile.width / 2, tile.height / 2))}
      onPress={onPress}
      // An SVG node takes a label but not a role or a state, so the tiles are
      // reachable and named without being announced as buttons.
      // `TreemapChart.Labels` and `TreemapChart.Legend` are the properly wired
      // way through the same selection, and the larger targets.
      accessibilityLabel={`${tile.label}, ${compactNumber(tile.value)}, ${percent} percent`}
    />
  );
}

export interface TreemapChartSkeletonProps {
  /** Milliseconds for one pass of the sweep. */
  duration?: number;
  color?: string;
}

/**
 * The loading state: the box as one plain rectangle, with a highlight
 * travelling across it.
 *
 * Undivided on purpose. Placeholder tiles would be a made-up split, and a
 * reader has no way to tell an invented one from a real one until it changes
 * under them — which is worse than showing nothing, because it is showing
 * something wrong.
 */
function TreemapChartSkeleton({ duration = 1400, color }: TreemapChartSkeletonProps) {
  const { width, height, cornerRadius, status } = useChart('TreemapChart.Skeleton');
  const token = useCSSVariable('--color-skeleton');
  const base = color ?? (typeof token === 'string' ? token : 'rgba(128,128,128,0.2)');
  const highlight = useSeriesColor(undefined, 1);

  const sweep = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const loading = status === 'loading';

  useEffect(() => {
    if (!loading || reducedMotion) {
      cancelAnimation(sweep);
      sweep.value = 0;
      return;
    }
    sweep.value = 0;
    sweep.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(sweep);
  }, [loading, reducedMotion, duration, sweep]);

  // The band travels by moving the gradient's own endpoints, so the whole
  // effect is two numbers changing on the UI thread.
  const animatedProps = useAnimatedProps(() => ({
    x1: `${(sweep.value * 1.4 - 0.4) * 100}%`,
    x2: `${(sweep.value * 1.4 - 0.4 + 0.4) * 100}%`,
  }));

  if (!loading || width <= 0 || height <= 0) return null;

  const gradientId = 'panelui-treemap-skeleton';

  return (
    <G>
      <Defs>
        <AnimatedLinearGradient id={gradientId} animatedProps={animatedProps} y1="0" y2="0">
          <Stop offset="0" stopColor={base} />
          <Stop offset="0.5" stopColor={highlight} stopOpacity={0.55} />
          <Stop offset="1" stopColor={base} />
        </AnimatedLinearGradient>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={cornerRadius}
        fill={`url(#${gradientId})`}
      />
    </G>
  );
}
TreemapChartSkeleton.displayName = 'TreemapChart.Skeleton';
TreemapChartSkeleton.slot = 'svg' as const;

/* -------------------------------------------------------------------------- */
/* Overlay layer                                                              */
/* -------------------------------------------------------------------------- */

export interface TreemapChartLabelsProps {
  /** Show each tile's value under its name. */
  showValue?: boolean;
  /** Show each tile's share of the total under its name. */
  showShare?: boolean;
  /** Format the value. Defaults to a compact number. */
  formatValue?: (value: number, tile: TreemapTile) => string;
  className?: string;
}

/**
 * The name and reading on each tile that has room for them.
 *
 * Real text over the SVG rather than SVG text, so the labels follow the theme's
 * font and the platform's text scaling — SVG text does neither.
 *
 * A tile smaller than `minLabelSize` on either side is left blank. The
 * alternative is a name clipped to its first two letters, which is not a
 * shorter name but a different word, and a chart of those is a chart nobody can
 * read. Those tiles are read through `Tooltip` instead.
 */
function TreemapChartLabels({
  showValue = true,
  showShare = false,
  formatValue,
  className,
}: TreemapChartLabelsProps) {
  const { tiles, minLabelSize, status, activeIndex, setActiveIndex } =
    useChart('TreemapChart.Labels');

  if (status === 'loading' || !tiles.length) return null;

  const format = formatValue ?? ((value: number) => compactNumber(value));

  return (
    <>
      {tiles.map((tile, index) => {
        if (tile.width < minLabelSize || tile.height < minLabelSize) return null;
        const percent = Math.round(tile.share * 100);
        return (
          <Pressable
            key={`${tile.label}-${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected: activeIndex === index }}
            accessibilityLabel={`${tile.label}, ${format(tile.value, tile)}, ${percent} percent`}
            onPress={() => setActiveIndex(activeIndex === index ? -1 : index)}
            style={{
              position: 'absolute',
              left: tile.x,
              top: tile.y,
              width: tile.width,
              height: tile.height,
            }}
            className={cn('justify-start p-2', className)}
          >
            {/*
             * White rather than the foreground token: the tiles are the chart's
             * own hue at full strength, and text that follows the theme would
             * be dark-on-dark in one mode and unreadable in the other.
             */}
            <Text
              size="xs"
              weight="semibold"
              numberOfLines={1}
              style={{ color: '#fff' }}
            >
              {tile.label}
            </Text>
            {showValue ? (
              <Text size="xs" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.82)' }}>
                {format(tile.value, tile)}
              </Text>
            ) : null}
            {showShare ? (
              <Text size="xs" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.82)' }}>
                {percent}%
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </>
  );
}
TreemapChartLabels.displayName = 'TreemapChart.Labels';
TreemapChartLabels.slot = 'overlay' as const;

export interface TreemapChartTooltipProps {
  /** Format the value. Defaults to a compact number. */
  formatValue?: (value: number, tile: TreemapTile) => string;
  className?: string;
}

/**
 * The readout for the selected tile, floating over the box.
 *
 * This is how the small tiles are read. They are the ones with no room for a
 * label, so without it a treemap answers questions about its largest parts only
 * — which is the half the reader could already see.
 */
function TreemapChartTooltip({ formatValue, className }: TreemapChartTooltipProps) {
  const { tiles, width, height, activeIndex, status } = useChart('TreemapChart.Tooltip');

  if (status === 'loading' || activeIndex < 0) return null;

  const tile = tiles[activeIndex];
  if (!tile) return null;

  const format = formatValue ?? ((value: number) => compactNumber(value));

  // Centred over the tile, then pushed back inside the box — a readout half
  // off the edge is one the reader has to guess the rest of.
  const left = Math.max(
    0,
    Math.min(width - TOOLTIP_WIDTH, tile.x + tile.width / 2 - TOOLTIP_WIDTH / 2)
  );
  // Above the tile where there is room for it, and inside the tile's own top
  // edge where there is not, which is the case for everything in the first row.
  const above = tile.y - TOOLTIP_HEIGHT - 4;
  const top = Math.max(0, Math.min(height - TOOLTIP_HEIGHT, above < 0 ? tile.y + 4 : above));

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
        {tile.label}
      </Text>
      <Text size="xs" muted numberOfLines={1}>
        {format(tile.value, tile)} · {Math.round(tile.share * 100)}%
      </Text>
    </View>
  );
}
TreemapChartTooltip.displayName = 'TreemapChart.Tooltip';
TreemapChartTooltip.slot = 'overlay' as const;

/* -------------------------------------------------------------------------- */
/* Footer layer                                                               */
/* -------------------------------------------------------------------------- */

export interface TreemapChartLegendProps extends ViewProps {
  className?: string;
  /** How many tiles to name before stopping. The rest are left to the chart. */
  limit?: number;
  /** Show each tile's share beside its name. */
  showShare?: boolean;
}

/**
 * A swatch and a name per tile, under the box. Pressable in the same way the
 * tiles are.
 *
 * Inline and wrapping, because the tiles are already in size order and the
 * legend is a lookup rather than a ranking — it is read by searching for a
 * name, not from the top down.
 */
function TreemapChartLegend({
  className,
  limit,
  showShare = true,
  ...props
}: TreemapChartLegendProps) {
  const { tiles, activeIndex, setActiveIndex } = useChart('TreemapChart.Legend');

  if (!tiles.length) return null;

  const shown = limit && limit > 0 ? tiles.slice(0, Math.floor(limit)) : tiles;

  return (
    <View
      {...props}
      className={cn(
        'w-full flex-row flex-wrap items-center gap-x-3 gap-y-1.5 pt-3',
        className
      )}
    >
      {shown.map((tile, index) => {
        const percent = Math.round(tile.share * 100);
        const dimmed = activeIndex >= 0 && activeIndex !== index;
        return (
          <Pressable
            key={`${tile.label}-${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected: activeIndex === index }}
            accessibilityLabel={`${tile.label}, ${percent} percent`}
            onPress={() => setActiveIndex(activeIndex === index ? -1 : index)}
            style={{ opacity: dimmed ? 0.4 : 1 }}
            className="max-w-full flex-row items-center gap-1.5"
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: tile.color,
                opacity: tile.strength,
              }}
            />
            <Text size="xs" muted numberOfLines={1} className="shrink">
              {tile.label}
            </Text>
            {showShare ? (
              <Text size="xs" weight="medium" numberOfLines={1}>
                {percent}%
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
TreemapChartLegend.displayName = 'TreemapChart.Legend';
TreemapChartLegend.slot = 'footer' as const;

/* -------------------------------------------------------------------------- */
/* Header layer                                                               */
/* -------------------------------------------------------------------------- */

export interface TreemapChartHeaderProps extends ViewProps {
  className?: string;
  /** Small line above the value — what the total is of. */
  title?: string;
  /** The readout. The largest thing on the card, and the first thing read. */
  value?: string;
  /** One muted line under the value — a period, a comparison, a caveat. */
  caption?: string;
  /** Trailing slot — a control, a badge, a range picker. */
  children?: ReactNode;
}

/**
 * The strip above the box: what the total is of and what it reads.
 *
 * The value is not derived even though the chart knows the total, because the
 * formatting is not the chart's to guess: 48200 is a count, a currency or a
 * rate depending on what was counted.
 */
function TreemapChartHeader({
  className,
  title,
  value,
  caption,
  children,
  ...props
}: TreemapChartHeaderProps) {
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
TreemapChartHeader.displayName = 'TreemapChart.Header';
TreemapChartHeader.slot = 'header' as const;

export const TreemapChart = Object.assign(TreemapChartRoot, {
  Header: TreemapChartHeader,
  Tiles: TreemapChartTiles,
  Labels: TreemapChartLabels,
  Tooltip: TreemapChartTooltip,
  Legend: TreemapChartLegend,
  Skeleton: TreemapChartSkeleton,
});
