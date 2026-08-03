/**
 * Card — a content surface, and the layer that decorates it.
 *
 * ```tsx
 * <Card>
 *   <Card.Header>
 *     <Card.Title>Living room sofa</Card.Title>
 *     <Card.Description>Three seats, oat linen</Card.Description>
 *   </Card.Header>
 *   <Card.Footer>
 *     <Button fullWidth>Buy now</Button>
 *   </Card.Footer>
 * </Card>
 * ```
 *
 * All the padding lives on the slots and none of it on the root, which is why
 * a card whose media reaches its own corners needs nothing but
 * `overflow-hidden`.
 */
import { forwardRef, useEffect, useMemo } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { cn } from '../../utils/cn';
import { Text, type TextProps } from '../../primitives/text';

export interface CardProps extends ViewProps {
  className?: string;
}

const CardRoot = forwardRef<View, CardProps>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn('rounded-2xl border border-border bg-card shadow-sm', className)}
    {...props}
  />
));
CardRoot.displayName = 'Card';

const CardHeader = forwardRef<View, CardProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('gap-1.5 p-6', className)} {...props} />
));
CardHeader.displayName = 'Card.Header';

const CardTitle = forwardRef<React.ElementRef<typeof Text>, TextProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      size="lg"
      weight="semibold"
      className={cn('leading-none text-card-foreground', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'Card.Title';

const CardDescription = forwardRef<React.ElementRef<typeof Text>, TextProps>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} size="sm" muted className={className} {...props} />
  )
);
CardDescription.displayName = 'Card.Description';

const CardContent = forwardRef<View, CardProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'Card.Content';

const CardFooter = forwardRef<View, CardProps>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn('flex-row items-center gap-2 p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'Card.Footer';

/* -------------------------------------------------------------------------- */
/* Card.Wash                                                                  */
/* -------------------------------------------------------------------------- */

/** How many stops the gradient is drawn with. Enough for the curve to read as a curve. */
const WASH_STOPS = 8;
/**
 * How sharply the wash dissolves upward. Above 1 it stays out of the way of
 * the top of the card and gathers at the bottom edge, which is the difference
 * between a wash and a tinted card.
 */
const WASH_CURVE = 2.4;
/** Cells across one grain tile. The pattern is what repeats; this is its resolution. */
const GRAIN_CELLS = 8;
/** How long one breath takes at `speed={1}`. */
const GRAIN_PERIOD = 2600;

function isToken(value: string | undefined): value is string {
  return typeof value === 'string' && value.startsWith('--');
}

/**
 * Gradients need a transparent stop of the *same* colour — `transparent` is
 * black at zero alpha on Android, which shows as a grey smear.
 */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex.slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if (Number.isNaN(r + g + b)) return color;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const channels = color.match(/rgba?\(([^)]+)\)/)?.[1];
  if (channels) {
    const [r, g, b] = channels.split(',').map((part) => part.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}

/**
 * A deterministic value in 0–1 from two cell coordinates and a seed.
 *
 * Deterministic because the alternative is `Math.random()` in render: the grain
 * would be a different drawing on every re-render of the card, which reads as
 * the layer flickering rather than breathing.
 */
function cellAlpha(x: number, y: number, seed: number): number {
  const n = Math.sin((x + 1) * 127.1 + (y + 1) * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * One tile of grain, defined once and repeated by the renderer.
 *
 * A grid of views at this cell size would be thousands of them across a card.
 * An SVG pattern is `GRAIN_CELLS²` rectangles however large the card gets,
 * because the tiling is the renderer's job rather than the tree's.
 */
function GrainLayer({
  seed,
  size,
  opacity,
}: {
  seed: number;
  size: number;
  opacity: number;
}) {
  const id = `wash-grain-${seed}`;
  const tile = size * GRAIN_CELLS;

  const cells = useMemo(() => {
    const out: { key: string; x: number; y: number; alpha: number }[] = [];
    for (let y = 0; y < GRAIN_CELLS; y += 1) {
      for (let x = 0; x < GRAIN_CELLS; x += 1) {
        out.push({
          key: `${x}-${y}`,
          x: x * size,
          y: y * size,
          alpha: cellAlpha(x, y, seed),
        });
      }
    }
    return out;
  }, [seed, size]);

  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern
          id={id}
          x={0}
          y={0}
          width={tile}
          height={tile}
          patternUnits="userSpaceOnUse"
        >
          {cells.map((cell) => (
            <Rect
              key={cell.key}
              x={cell.x}
              y={cell.y}
              width={size}
              height={size}
              fill="#ffffff"
              fillOpacity={cell.alpha}
            />
          ))}
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </Svg>
  );
}

export interface CardWashProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /**
   * The colour the wash rises in. A theme token name such as
   * `--color-primary`, or any colour string. Defaults to `--color-primary`.
   */
  tint?: string;
  /** How opaque the wash gets at the bottom edge, 0–1. */
  intensity?: number;
  /** How much grain sits over the wash, 0–1. Zero draws the gradient alone. */
  noise?: number;
  /** The size of one grain cell, in points. Larger is chunkier and cheaper. */
  grainSize?: number;
  /**
   * Multiplier on how fast the grain breathes. `0` freezes it on one frame,
   * which is also what a reduced-motion setting does.
   */
  speed?: number;
}

/**
 * A decorative layer for the back of a card: colour rising from the bottom
 * edge, dithered with grain that breathes.
 *
 * It fills its parent absolutely and takes no touches, so it goes first inside
 * a `Card` and everything else is drawn over it. The card needs
 * `overflow-hidden` — the layer reaches the root's edges, and the root is the
 * thing with the corner radius.
 *
 * ```tsx
 * <Card className="overflow-hidden">
 *   <Card.Wash tint="--color-primary" />
 *   <Card.Header>…</Card.Header>
 * </Card>
 * ```
 *
 * ## Why the grain is two layers rather than one
 *
 * A single tile of noise is a still photograph of grain: repeat it and every
 * cell in the card holds the same value forever. Two tiles seeded differently
 * and cross-faded against each other means each point on the card travels
 * between two values on its own phase, which is what reads as a field that is
 * alive rather than a texture that was applied.
 */
const CardWash = forwardRef<View, CardWashProps>(
  (
    {
      className,
      tint = '--color-primary',
      intensity = 0.2,
      noise = 0.35,
      grainSize = 3,
      speed = 1,
      style,
      ...props
    },
    ref
  ) => {
    const token = useCSSVariable(isToken(tint) ? tint : '--color-primary');
    const resolved = typeof token === 'string' ? token : undefined;
    const color = (isToken(tint) ? resolved : tint) ?? resolved ?? '#0a0a0a';

    const reduced = useReducedMotion();
    const still = reduced || speed <= 0;

    const breath = useSharedValue(0);

    useEffect(() => {
      if (still) {
        breath.value = 0;
        return;
      }
      breath.value = 0;
      breath.value = withRepeat(
        withTiming(1, {
          duration: GRAIN_PERIOD / speed,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
      return () => cancelAnimation(breath);
    }, [breath, speed, still]);

    // The two tiles are opposite ends of the same breath, so the total grain
    // over any point stays roughly constant while its distribution moves.
    const first = useAnimatedStyle(() => ({ opacity: 1 - breath.value * 0.85 }));
    const second = useAnimatedStyle(() => ({ opacity: breath.value * 0.85 }));

    /*
     * Alpha follows a power curve rather than a straight line. Linearly the
     * colour is already half-strength across the middle of the card and reads
     * as a tinted panel; on the curve it is nothing until the lower third and
     * then arrives, which is what makes it a wash rising from an edge.
     */
    const { colors, locations } = useMemo(() => {
      const out: string[] = [];
      const at: number[] = [];
      for (let i = 0; i < WASH_STOPS; i += 1) {
        const t = i / (WASH_STOPS - 1);
        out.push(withAlpha(color, Math.pow(t, WASH_CURVE) * intensity));
        at.push(t);
      }
      return {
        colors: out as unknown as readonly [string, string, ...string[]],
        locations: at as unknown as readonly [number, number, ...number[]],
      };
    }, [color, intensity]);

    return (
      <View
        ref={ref}
        // Decorative and non-interactive: it is the back of the card, and a
        // screen reader announcing "image" over every card would be noise.
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className={cn('absolute inset-0 overflow-hidden', className)}
        style={style}
        {...props}
      >
        {/*
         * Every stop is the tint at a different alpha, never `transparent`:
         * that is black at zero alpha on Android, and a wash faded to it
         * arrives through a grey smear on the way.
         */}
        <LinearGradient
          colors={colors}
          locations={locations}
          style={StyleSheet.absoluteFill}
        />

        {noise > 0 ? (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, still ? undefined : first]}>
              <GrainLayer seed={1} size={grainSize} opacity={noise} />
            </Animated.View>
            {still ? null : (
              <Animated.View style={[StyleSheet.absoluteFill, second]}>
                <GrainLayer seed={2} size={grainSize} opacity={noise} />
              </Animated.View>
            )}
          </>
        ) : null}
      </View>
    );
  }
);
CardWash.displayName = 'Card.Wash';

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Content: CardContent,
  Footer: CardFooter,
  Wash: CardWash,
});
