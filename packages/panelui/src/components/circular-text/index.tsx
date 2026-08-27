import { useEffect, useMemo } from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { tv } from 'tailwind-variants';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import {
  DEFAULT_CIRCULAR_TEXT_DURATION,
  DEFAULT_CIRCULAR_TEXT_RADIUS,
  DEFAULT_CIRCULAR_TEXT_SPREAD,
  circularTextGlyphs,
  normalizeDuration,
  normalizeRadius,
  normalizeSpread,
} from './circular-text-geometry';

const circularTextVariants = tv({
  base: 'items-center justify-center',
});

const glyphVariants = tv({
  // Every character gets a box the full size of the ring, centred on the same
  // point, so rotating one swings its character around the circle without any
  // per-character arithmetic reaching the transform.
  base: 'absolute inset-0 items-center',
});

export interface CircularTextProps extends Omit<ViewProps, 'children'> {
  /**
   * The text to set around the circle. A string, not elements: each character
   * is placed and turned on its own, so there is nothing for markup inside it
   * to apply to.
   */
  children: string;
  /**
   * Points from the centre of the ring to the outside of the text.
   *
   * It is also half the component's width and height — the ring is a square
   * that measures `radius * 2` on both axes, and the characters hang inside
   * its edge. Nothing is laid out around it, so give the space it needs.
   */
  radius?: number;
  /**
   * Milliseconds for one full turn. Slow by default: it is decoration, and a
   * ring that turns at the speed of a spinner reads as something loading.
   */
  spinDuration?: number;
  /** Turn anticlockwise. */
  reverse?: boolean;
  /**
   * Hold the ring where it is.
   *
   * It stops in place rather than returning to the top, and resumes from
   * there, so a ring paused mid-word is still on that word when it starts
   * again.
   */
  paused?: boolean;
  /**
   * Degrees of the circle the text is spread across. The whole way round by
   * default.
   *
   * A full turn has no last gap, since the end of the string is adjacent to
   * its start. Anything less is an arc with two ends, and the text reaches
   * both of them.
   */
  spread?: number;
  /** Degrees clockwise from the top that the first character sits at. */
  startAngle?: number;
  /** Classes for the ring's own box. */
  className?: string;
  /** Classes for the characters — size, weight, colour, tracking. */
  textClassName?: string;
}

/**
 * Text set around a circle, turning.
 *
 * For a badge, a seal, a mark around a logo: decoration whose job is to be a
 * shape first and a sentence second. The characters are placed one at a time
 * and each is turned to sit square on the curve, so the ring closes and the
 * text at the bottom is upside down — which is what makes it read as a
 * circle rather than as a sentence bent into one.
 *
 * The centre is left empty and nothing is laid out inside it. Put a logo
 * there by stacking the two, rather than by passing it as a child.
 *
 * The turn runs entirely on the UI thread, and under the platform's
 * reduce-motion setting the ring is drawn once and held still. Not a slower
 * turn — none. The shape carries the whole meaning; the rotation is the part
 * that setting exists to remove.
 */
export function CircularText({
  children,
  radius = DEFAULT_CIRCULAR_TEXT_RADIUS,
  spinDuration = DEFAULT_CIRCULAR_TEXT_DURATION,
  reverse = false,
  paused = false,
  spread = DEFAULT_CIRCULAR_TEXT_SPREAD,
  startAngle = 0,
  className,
  textClassName,
  style,
  ...props
}: CircularTextProps) {
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  const size = normalizeRadius(radius) * 2;
  const duration = normalizeDuration(spinDuration);
  const arc = normalizeSpread(spread);

  const glyphs = useMemo(
    () => circularTextGlyphs(children, arc, startAngle),
    [children, arc, startAngle]
  );

  // A duration of zero is a timing that never advances, so it is a held ring
  // rather than an infinitely fast one.
  const turning = !paused && !reducedMotion && duration > 0 && glyphs.length > 0;

  useEffect(() => {
    if (!turning) {
      // Leaves the value where it reached. Zeroing here would send a ring
      // paused mid-word back to the top, and the pause would read as a reset.
      cancelAnimation(rotation);
      return undefined;
    }

    /*
     * From wherever it already is, one turn, forever.
     *
     * The repeat restarts each cycle at the value it began on, and the state
     * at `from + 360` is the state at `from`, so the seam between cycles is
     * arithmetic rather than something to see. Taking the remainder first
     * keeps the number from growing without bound over a long session.
     */
    const from = rotation.value % 360;
    const to = reverse ? from - 360 : from + 360;
    rotation.value = from;
    rotation.value = withRepeat(
      withTiming(to, { duration, easing: Easing.linear }),
      -1,
      false
    );

    return () => cancelAnimation(rotation);
  }, [rotation, turning, duration, reverse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={children}
      className={cn(circularTextVariants(), className)}
      style={[{ width: size, height: size }, style]}
      {...props}
    >
      {/* Hidden from assistive technology as a group: the label above already
          says what it reads, and a ring announced character by character is a
          string spelled out one letter at a time. */}
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[{ width: size, height: size }, ringStyle]}
      >
        {glyphs.map((glyph) => (
          <View
            key={`${glyph.character}-${glyph.index}`}
            className={glyphVariants()}
            style={{ transform: [{ rotate: `${glyph.angle}deg` }] }}
          >
            <Text className={textClassName}>{glyph.character}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

CircularText.displayName = 'CircularText';
