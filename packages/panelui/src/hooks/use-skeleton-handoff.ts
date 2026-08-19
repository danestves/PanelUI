/**
 * Keeps a chart's placeholder on screen a beat past the data arriving, and
 * dissolves it while the real marks grow in.
 *
 * A skeleton cut at the exact frame `status` flips leaves the plot empty: the
 * placeholder is gone and the reveal has not started, so there is a blank frame
 * between two states that were both supposed to show something. Outliving the
 * status change by the length of the fade is what closes that gap, and it is
 * why the loading state reads as *becoming* the chart rather than as being
 * replaced by it.
 *
 * The fade runs on the UI thread; the unmount is scheduled back once, at the
 * end, so nothing re-renders per frame.
 *
 * ```tsx
 * const { mounted, opacity } = useSkeletonHandoff(status === 'loading');
 * const animatedProps = useAnimatedProps(() => ({ opacity: opacity.value }));
 * if (!mounted) return null;
 * return <AnimatedG animatedProps={animatedProps}>{…}</AnimatedG>;
 * ```
 */
import { useEffect, useState } from 'react';
import {
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Milliseconds for a placeholder to dissolve once the data arrives. */
export const SKELETON_FADE = 220;

export interface UseSkeletonHandoffResult {
  /** True while the placeholder should render — through the fade, not just the wait. */
  mounted: boolean;
  /** The placeholder's opacity, `1` while loading and tweened to `0` after. */
  opacity: SharedValue<number>;
}

export function useSkeletonHandoff(
  loading: boolean,
  duration: number = SKELETON_FADE
): UseSkeletonHandoffResult {
  const opacity = useSharedValue(loading ? 1 : 0);
  // Mounted a beat longer than `loading`, so there is something to fade.
  const [mounted, setMounted] = useState(loading);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (loading) {
      opacity.value = 1;
      setMounted(true);
      return;
    }
    // Reduced motion still wants the placeholder gone; it is the dissolve that
    // is the motion, not the disappearance.
    if (reducedMotion) {
      opacity.value = 0;
      setMounted(false);
      return;
    }
    opacity.value = withTiming(0, { duration }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [loading, reducedMotion, duration, opacity]);

  return { mounted, opacity };
}
