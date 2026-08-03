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

/**
 * How sharply the wash dissolves upward. The exponent is the whole look: at 1
 * the colour is already at half strength across the middle of the card and
 * reads as a tinted panel, and it takes about a cube before the top is
 * genuinely untouched and the colour arrives in the bottom third.
 */
const WASH_CURVE = 3;
/**
 * Stops the curve is sampled at. Ten is enough that the straight lines the
 * renderer draws between them are not a shape anyone can see, and the fade
 * stays continuous — stepping it would put a horizontal seam at every step.
 */
const WASH_STOPS = 10;
/** How long one breath takes at `speed={1}`. */
const WASH_PERIOD = 4200;
/**
 * How far the wash swells and settles over one breath, as a fraction of
 * `intensity`. Small on purpose: the movement should be noticed only by not
 * being there, and anything larger reads as a light being switched.
 */
const WASH_BREATH = 0.22;

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

export interface CardWashProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /**
   * The colour the wash rises in. A theme token name such as
   * `--color-primary`, or any colour string. Defaults to `--color-primary`.
   */
  tint?: string;
  /**
   * How opaque the wash gets at the bottom edge, 0–1. It is meant to be small:
   * past about 0.25 the card reads as tinted rather than washed, which is a
   * different thing and usually not the one you wanted.
   */
  intensity?: number;
  /**
   * Multiplier on how slowly the wash breathes. `0` holds it still, which is
   * also what a reduced-motion setting does.
   */
  speed?: number;
}

/**
 * A decorative layer for the back of a card: the tint rising from its bottom
 * edge and fading out before it reaches the top.
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
 * ## Why the rise is a curve and not a fade
 *
 * On a straight ramp the colour is already at half strength across the middle
 * of the card, and what you see is a panel with a tint on it. On a curve there
 * is nothing at all across the top two thirds and then the colour arrives —
 * which is the difference between a card that has been coloured in and a card
 * something is rising into.
 */
const CardWash = forwardRef<View, CardWashProps>(
  (
    {
      className,
      tint = '--color-primary',
      intensity = 0.16,
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
          duration: WASH_PERIOD / speed,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
      return () => cancelAnimation(breath);
    }, [breath, speed, still]);

    /*
     * The breath is the layer's opacity rather than its colours: rebuilding
     * ten `rgba()` strings per frame would be a JavaScript-thread animation of
     * the kind this library does not do, and a view's opacity is a property
     * the compositor already knows how to move.
     */
    const breathing = useAnimatedStyle(() => ({
      opacity: 1 - WASH_BREATH + breath.value * WASH_BREATH,
    }));

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
      <Animated.View
        ref={ref}
        // Decorative and non-interactive: it is the back of the card, and a
        // screen reader announcing "image" over every card would be noise.
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className={cn('absolute inset-0 overflow-hidden', className)}
        style={[still ? undefined : breathing, style]}
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
      </Animated.View>
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
