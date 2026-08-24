/**
 * TextGlass — a word that writes itself on, one stroke at a time.
 *
 * ```tsx
 * <TextGlass word="hello" />
 * ```
 *
 * ## What is actually animated
 *
 * Each stroke is a dash pattern whose lit part grows from nothing to the whole
 * line: `strokeDasharray` moves, the path itself never changes. Two numbers a
 * frame rather than a rebuilt path, and the round cap stays pinned to the end
 * of the lit part for free — which is the pen nib, and the reason the line
 * reads as being laid down rather than uncovered.
 *
 * The whole word runs off one shared clock, and every stroke works out its own
 * slice of it. Nothing crosses back to React while it draws.
 *
 * ## Why the strokes are not evenly timed
 *
 * A stroke's share of the clock is proportional to how long its line is, so the
 * pen moves at one speed across the whole word. Splitting the time evenly
 * instead would race the pen through a dot and crawl it through an `l`, which
 * reads as a machine rather than a hand. `duration` scales the whole timeline
 * and the proportions hold.
 *
 * ## Reduced motion
 *
 * The finished word, drawn, immediately. A wordmark that never arrives is a
 * missing logo, so there is nothing to degrade to except its last frame.
 */
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { cn } from '../../utils/cn';
import { measurePath } from './text-glass-path';
import { TEXT_GLASS_WORDS, writeWord, type TextGlassWord } from './text-glass-glyphs';

export type { TextGlassWord } from './text-glass-glyphs';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * What one pen lift costs, in the same units as a stroke's length. The gap
 * between two strokes is time in which nothing is drawn, so it has to be
 * spent in the same currency as the drawing to keep the pen's speed even.
 */
const LIFT = 90;

/** How much of its own draw a stroke spends fading in. */
const FADE = 0.35;

/** Room left around the word for the stroke's own width and its round caps. */
const MARGIN = 1.1;

/** One stroke of a word, and the slice of the timeline it is drawn in. */
interface Stroke {
  d: string;
  length: number;
  start: number;
  end: number;
}

/** A path to draw, for a caller writing something the built-in words do not. */
export interface TextGlassStroke {
  /** The path data. Drawn in the order given, which is the order of writing. */
  d: string;
  /**
   * How long the line is, in the path's own units. Measured when it is left
   * out — pass it only for a path containing an arc, which is not measurable.
   */
  length?: number;
}

export interface TextGlassProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** Which built-in word to write. Ignored when `paths` is given. */
  word?: TextGlassWord;
  /**
   * Write something of your own instead of a built-in word. Needs `viewBox`,
   * since nothing else says what coordinates the paths are in.
   */
  paths?: TextGlassStroke[];
  /** The coordinate system `paths` are drawn in. Built-in words bring theirs. */
  viewBox?: string;
  /** How tall the word is, in points. Its width follows from the viewBox. */
  height?: number;
  /** Milliseconds for the whole word, pen lifts included. */
  duration?: number;
  /** Milliseconds of stillness before the first stroke. */
  delay?: number;
  /** Write it again, from nothing, forever. */
  loop?: boolean;
  /** False holds the word fully drawn instead of writing it. */
  enabled?: boolean;
  /** Ink colour. Defaults to the theme's foreground. */
  color?: string;
  /** Width of the line, in viewBox units. */
  strokeWidth?: number;
  /** Called once the last stroke lands. Not called on each pass of a loop. */
  onDone?: () => void;
}

/**
 * Lay the strokes out on a 0-to-1 timeline, each getting time in proportion to
 * its own length and a lift between one and the next.
 */
function schedule(lengths: number[]): { start: number; end: number }[] {
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const span = total + LIFT * Math.max(0, lengths.length - 1);
  if (span <= 0) return lengths.map(() => ({ start: 0, end: 1 }));

  let travelled = 0;
  return lengths.map((length) => {
    const start = travelled / span;
    travelled += length;
    const end = travelled / span;
    travelled += LIFT;
    return { start, end };
  });
}

function TextGlassStrokeView({
  stroke,
  progress,
  color,
  strokeWidth,
  still,
}: {
  stroke: Stroke;
  progress: { value: number };
  color: string;
  strokeWidth: number;
  still: boolean;
}) {
  const { d, length, start, end } = stroke;

  const animated = useAnimatedProps(() => {
    const span = end - start;
    const raw = span > 0 ? (progress.value - start) / span : 1;
    const drawn = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    return {
      // The lit part grows; the gap after it stays the whole line, so nothing
      // of the pattern repeats back into view at the end.
      strokeDasharray: [length * drawn, length],
      // Fading over the first part of the draw keeps the leading edge from
      // appearing as a hard dot out of nothing.
      strokeOpacity: drawn >= FADE ? 1 : drawn / FADE,
    };
  });

  if (still) {
    return (
      <Path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  return (
    <AnimatedPath
      animatedProps={animated}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function TextGlass({
  className,
  word = 'hello',
  paths,
  viewBox,
  height = 80,
  duration,
  delay = 0,
  loop = false,
  enabled = true,
  color,
  strokeWidth = 15,
  onDone,
  accessibilityLabel,
  style,
  ...props
}: TextGlassProps): ReactNode {
  const inkToken = useCSSVariable('--color-foreground');
  const ink = color ?? (typeof inkToken === 'string' ? inkToken : '#0a0a0a');

  const reducedMotion = useReducedMotion();
  const still = reducedMotion || !enabled;

  const { strokes, box, span } = useMemo(() => {
    const source: TextGlassStroke[] = paths?.length
      ? paths
      : writeWord(TEXT_GLASS_WORDS[word]).map((d) => ({ d }));

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const lengths: number[] = [];
    for (const path of source) {
      const measured = measurePath(path.d);
      lengths.push(path.length ?? measured.length);
      if (measured.length > 0 || measured.maxX > measured.minX) {
        minX = Math.min(minX, measured.minX);
        minY = Math.min(minY, measured.minY);
        maxX = Math.max(maxX, measured.maxX);
        maxY = Math.max(maxY, measured.maxY);
      }
    }

    const windows = schedule(lengths);
    const drawn: Stroke[] = source.map((path, index) => ({
      d: path.d,
      length: lengths[index]!,
      start: windows[index]!.start,
      end: windows[index]!.end,
    }));

    const pad = strokeWidth * MARGIN;
    const measuredBox =
      minX === Infinity
        ? '0 0 1 1'
        : `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;

    return {
      strokes: drawn,
      box: viewBox ?? measuredBox,
      // A longer word takes longer to write, unless a duration is asked for.
      span: duration ?? Math.round(900 + lengths.reduce((sum, l) => sum + l, 0) * 1.2),
    };
  }, [paths, word, viewBox, duration, strokeWidth]);

  const progress = useSharedValue(still ? 1 : 0);
  const done = useRef(false);

  const report = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onDone?.();
  }, [onDone]);

  useEffect(() => {
    done.current = false;
    if (still) {
      progress.value = 1;
      return undefined;
    }
    progress.value = 0;
    const write = withTiming(1, { duration: span, easing: Easing.inOut(Easing.quad) });
    progress.value = withDelay(delay, loop ? withRepeat(write, -1, false) : write);
    return () => cancelAnimation(progress);
  }, [still, span, delay, loop, progress, strokes]);

  useAnimatedReaction(
    () => progress.value >= 1,
    (finished, was) => {
      if (finished && !was) runOnJS(report)();
    },
    [report]
  );

  const [, , boxWidth, boxHeight] = box.split(/\s+/).map(Number);
  const ratio = boxWidth && boxHeight ? boxWidth / boxHeight : 1;
  const width = Math.round(height * ratio);

  return (
    <View
      {...props}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? (paths?.length ? undefined : TEXT_GLASS_WORDS[word])}
      className={cn('items-start justify-center', className)}
      style={[{ width, height }, style]}
    >
      <Svg width={width} height={height} viewBox={box}>
        {strokes.map((stroke, index) => (
          <TextGlassStrokeView
            key={index}
            stroke={stroke}
            progress={progress}
            color={ink}
            strokeWidth={strokeWidth}
            still={still}
          />
        ))}
      </Svg>
    </View>
  );
}

TextGlass.displayName = 'TextGlass';
