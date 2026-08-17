/**
 * Marquee — content that travels across its container and never runs out.
 *
 * For a strip of logos, a ticker of prices, a row of testimonials: anything
 * whose job is to keep moving past a boundary rather than to be scrolled.
 *
 * ```tsx
 * <Marquee spacing={24} speed={40}>
 *   <View className="flex-row gap-6">
 *     {sponsors.map((s) => <Logo key={s.id} src={s.logo} />)}
 *   </View>
 * </Marquee>
 * ```
 *
 * ## How it loops
 *
 * The content is measured once, then laid out end to end enough times to cover
 * the container twice over. One track holds every copy and it is that track,
 * not the copies, that moves — a single animated node for any amount of
 * content. It travels exactly one copy-and-gap and starts over, so the state it
 * ends on is the state it began on and the seam never shows.
 *
 * The travel is a linear timing driven on the UI thread, so it costs nothing
 * per frame in JavaScript and keeps running while the thread is busy.
 *
 * ## Measurement needs room
 *
 * The copy that gets measured sits in a hidden scroller, because that is what
 * lets the content report the width it *wants* rather than the width the
 * container would give it. Content with no intrinsic size of its own — a child
 * stretched to `flex-1`, an image with no dimensions — measures as nothing and
 * the marquee will not start.
 *
 * ## Reading direction and reduced motion
 *
 * A horizontal marquee travels toward the end of the line, so it reverses in a
 * right-to-left subtree. `reverse` flips it again from wherever it landed.
 *
 * With the operating system set to reduce motion the content is rendered once
 * and held still. A ticker that never stops is the exact thing that setting is
 * there to turn off, so this is not a shorter animation — it is none.
 *
 * Screen readers get one copy. The rest are duplicates of content already
 * announced, and hearing a sponsor list four times over is not thoroughness.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewProps,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useDirectionSign } from '../../hooks/use-direction';
import { cn } from '../../utils/cn';
import {
  DEFAULT_MARQUEE_SPEED,
  marqueeCopyCount,
  normalizeMarqueeSpeed,
} from './marquee-math';

export type MarqueeDirection = 'horizontal' | 'vertical';

export interface MarqueeProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** The content to repeat. Measured once, then tiled along the axis. */
  children: ReactNode;
  /**
   * Travel speed in points per second. 40 by default, which is slow enough
   * that a word stays readable as it crosses. The cycle time follows from this
   * and the measured content, so longer content takes proportionally longer
   * rather than moving faster.
   */
  speed?: number;
  /** Gap between the end of one copy and the start of the next. */
  spacing?: number;
  /** Axis the content travels along. */
  direction?: MarqueeDirection;
  /**
   * Send it the other way: toward the start of the line, or upward. Applied
   * after the reading direction, not instead of it.
   */
  reverse?: boolean;
  /** Set false to hold the content where it is. */
  playing?: boolean;
}

export function Marquee({
  className,
  children,
  speed: speedProp = DEFAULT_MARQUEE_SPEED,
  spacing = 0,
  direction = 'horizontal',
  reverse = false,
  playing = true,
  style,
  onLayout,
  ...props
}: MarqueeProps) {
  const horizontal = direction === 'horizontal';
  const reducedMotion = useReducedMotion();
  // Only the horizontal axis has a reading direction to follow; up is up.
  const sign = useDirectionSign();
  const flip = horizontal ? sign : 1;

  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const speed = normalizeMarqueeSpeed(speedProp);

  // The distance from one copy to the same point on the next, and therefore
  // both the layout step and the exact loop length. They are the same number
  // on purpose: taking the gap from anywhere else is how a seam appears.
  const layout = useMemo(
    () => marqueeCopyCount(viewport, content, spacing),
    [viewport, content, spacing]
  );
  const { period } = layout;

  const copies = useMemo(() => {
    // Enough to span the container, plus one trailing into view and one
    // already past it — the two the travel consumes before the loop restarts.
    return Array.from({ length: layout.count }, (_, index) => index);
  }, [layout.count]);

  const offset = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(offset);
    offset.value = 0;
    if (reducedMotion || !playing || period <= 0 || speed <= 0) return undefined;
    offset.value = withRepeat(
      withTiming(period, {
        duration: (period / speed) * 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
    return () => cancelAnimation(offset);
  }, [offset, period, playing, reducedMotion, speed]);

  const trackStyle = useAnimatedStyle(() => {
    const travel = (reverse ? offset.value : -offset.value) * flip;
    return {
      transform: [horizontal ? { translateX: travel } : { translateY: travel }],
    };
  }, [horizontal, reverse, flip]);

  // The container's own measurement is what sizes the loop, so an `onLayout`
  // passed in is called alongside it rather than replacing it.
  const onContainerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport(horizontal ? width : height);
    onLayout?.(event);
  };

  const onContentLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContent(horizontal ? width : height);
  };

  // Nothing to loop, so nothing to clip or clone: render the content plainly
  // and let it sit where it falls.
  if (reducedMotion) {
    return (
      <View
        className={cn('overflow-hidden', className)}
        style={style}
        onLayout={onLayout}
        {...props}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      className={cn('overflow-hidden', className)}
      style={style}
      onLayout={onContainerLayout}
      {...props}
    >
      {/* Measured, never seen. A scroller on this axis is what frees the
          content to report its own size instead of the container's. */}
      <ScrollView
        horizontal={horizontal}
        scrollEnabled={false}
        style={styles.measure}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View onLayout={onContentLayout}>{children}</View>
      </ScrollView>

      <Animated.View style={[StyleSheet.absoluteFill, trackStyle]} pointerEvents="box-none">
        {copies.map((index) => {
          // Index 1 is the copy that starts flush with the container's edge,
          // and it is the one a screen reader is given.
          const spoken = index === 1;
          const at = (index - 1) * period;
          return (
            <View
              key={index}
              style={[styles.copy, horizontal ? { left: at } : { top: at }]}
              pointerEvents="box-none"
              accessibilityElementsHidden={!spoken}
              importantForAccessibility={spoken ? 'auto' : 'no-hide-descendants'}
            >
              {children}
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Laid out so it measures, hidden so it does not draw, and behind everything
     so it can never intercept anything. */
  measure: { opacity: 0, zIndex: -1 },
  copy: { position: 'absolute' },
});
