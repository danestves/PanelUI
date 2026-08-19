/**
 * ProgressButton — press and hold to confirm, with the wait drawn on the button.
 *
 * ```tsx
 * <ProgressButton onComplete={wipe}>
 *   <ProgressButton.Label>Hold to erase</ProgressButton.Label>
 * </ProgressButton>
 * ```
 *
 * For the action a confirmation dialog exists to slow down. A dialog asks the
 * question somewhere else and takes the answer as a tap — which is two taps,
 * and two taps in a row is a rhythm a hand falls into. A hold cannot be
 * completed by accident and cannot be completed by habit: it has to be
 * sustained, and the fill says for how much longer.
 *
 * ## The fill is the promise
 *
 * Nothing fires until the fill reaches the end. There is no tolerance near the
 * top, because a tolerance means the button sometimes commits after the reader
 * has deliberately let go — which is the one failure a confirmation control
 * cannot have. Released early, the fill drains back, in proportion to how far
 * it got.
 *
 * ## How it is drawn
 *
 * The fill is a clipped copy of the button in inverted colours, growing from
 * the leading edge. That is what keeps the label legible across the boundary:
 * a single label under a translucent wash goes muddy in the middle of the
 * wipe, exactly where the eye is. Two labels, each at full contrast on its own
 * ground, never do.
 *
 * The clip is a view under `overflow: 'hidden'`, and its width is animated.
 * Animating a width is normally a layout pass per frame; this view is
 * absolutely positioned over the button and its copy of the label is pinned to
 * the button's own width, so nothing it contains reflows as it grows.
 *
 * ## Reduced motion
 *
 * The wipe is replaced by a stepped fill that advances in fifths. The hold
 * still has to be legible — a control that asks you to wait and shows nothing
 * is a broken button — so this is a coarser indicator, not the absence of one.
 */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Pressable,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { tv, type VariantProps } from 'tailwind-variants';
import { Text, textChildren } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { impactKnock, selectionTick } from '../../utils/haptics';
import {
  DEFAULT_AUTO_RESET_DELAY,
  DEFAULT_RELEASE_DURATION,
  releaseDuration,
  resolveHoldDuration,
} from './progress-button-hold';

/** How many steps the reduced-motion fill advances in. */
const REDUCED_STEPS = 5;

const progressButtonVariants = tv({
  slots: {
    root: 'relative overflow-hidden rounded-lg border',
    /*
     * The row inside the button. It is separate from `root` because the fill
     * has to sit over the whole button including its padding — a wipe that
     * stops at the text's own box leaves an unfilled margin down each side and
     * reads as a progress bar someone put inside a button.
     */
    content: 'flex-row items-center justify-center gap-2',
    label: 'min-w-0 shrink text-center font-medium',
    /** The inverted copy, drawn on the filled ground. */
    fill: '',
    fillLabel: 'min-w-0 shrink text-center font-medium',
  },
  variants: {
    variant: {
      primary: {
        root: 'border-primary bg-transparent',
        label: 'text-primary',
        fill: 'bg-primary',
        fillLabel: 'text-primary-foreground',
      },
      secondary: {
        root: 'border-transparent bg-secondary',
        label: 'text-secondary-foreground',
        fill: 'bg-foreground',
        fillLabel: 'text-background',
      },
      destructive: {
        root: 'border-destructive bg-transparent',
        label: 'text-destructive',
        fill: 'bg-destructive',
        fillLabel: 'text-destructive-solid-foreground',
      },
      success: {
        root: 'border-success bg-transparent',
        label: 'text-success',
        fill: 'bg-success',
        fillLabel: 'text-success-solid-foreground',
      },
    },
    size: {
      // Matched to Button's boxes, and `min-h-*` for the same reason: the
      // label's glyphs grow with the system text size and the box has to grow
      // with them.
      sm: {
        root: 'min-h-9',
        content: 'min-h-9 gap-1.5 px-2.5 py-2',
        label: 'text-[14px]',
        fillLabel: 'text-[14px]',
      },
      md: {
        root: 'min-h-11',
        content: 'min-h-11 px-4 py-2.5',
        label: 'text-[16px]',
        fillLabel: 'text-[16px]',
      },
      lg: {
        root: 'min-h-12',
        content: 'min-h-12 px-6 py-2.5',
        label: 'text-[18px]',
        fillLabel: 'text-[18px]',
      },
    },
    fullWidth: {
      true: { root: 'w-full' },
    },
    disabled: {
      true: { root: 'opacity-[0.64]' },
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

type ProgressButtonVariantProps = VariantProps<typeof progressButtonVariants>;

/** How a progress button looks. */
export type ProgressButtonVariant = NonNullable<ProgressButtonVariantProps['variant']>;
/** How big a progress button is. */
export type ProgressButtonSize = NonNullable<ProgressButtonVariantProps['size']>;

interface ProgressButtonContextValue {
  /** `0` to `1` across the hold. */
  progress: SharedValue<number>;
  /** Width of the button, so the fill's copy of the label can match it. */
  width: number;
  completed: boolean;
  variant: ProgressButtonVariant;
  size: ProgressButtonSize;
  slots: ReturnType<typeof progressButtonVariants>;
}

const ProgressButtonContext = createContext<ProgressButtonContextValue | null>(null);

function useProgressButtonContext(component: string): ProgressButtonContextValue {
  const context = useContext(ProgressButtonContext);
  if (!context) throw new Error(`${component} must be used within a <ProgressButton>`);
  return context;
}

/** How far through the hold this button is, for something rendered inside it. */
export function useProgressButton() {
  const { progress, completed } = useProgressButtonContext('useProgressButton');
  return { progress, completed };
}

export interface ProgressButtonProps
  extends Omit<PressableProps, 'children' | 'disabled'>,
    Omit<ProgressButtonVariantProps, 'disabled'> {
  className?: string;
  /**
   * Milliseconds the button has to be held. Defaults to `2000`, and is floored
   * at `200` — a hold that completes on touch-down is a button with extra steps.
   */
  holdDuration?: number;
  /** Fires once the hold has been sustained to the end. */
  onComplete?: () => void;
  /** Fires whenever the completed state changes, including on a reset. */
  onCompletedChange?: (completed: boolean) => void;
  /** Controlled completion. Leave unset to let the button own it. */
  completed?: boolean;
  /** Return to the unfilled state after `autoResetDelay`. */
  autoReset?: boolean;
  /** Milliseconds to stay completed before resetting. Defaults to `1000`. */
  autoResetDelay?: number;
  disabled?: boolean;
  /**
   * A tick as the hold takes, and a knock when it completes. Off by default:
   * whether an action is worth feeling is the caller's call, not the control's.
   */
  haptics?: boolean;
  children?: ReactNode;
}

const ProgressButtonRoot = forwardRef<View, ProgressButtonProps>(function ProgressButtonRoot(
  {
    className,
    variant = 'primary',
    size = 'md',
    fullWidth,
    holdDuration,
    onComplete,
    onCompletedChange,
    completed: completedProp,
    autoReset = false,
    autoResetDelay = DEFAULT_AUTO_RESET_DELAY,
    disabled = false,
    haptics = false,
    accessibilityState,
    children,
    ...props
  },
  ref
) {
  const slots = progressButtonVariants({ variant, size, fullWidth, disabled });
  const duration = resolveHoldDuration(holdDuration);
  const reducedMotion = useReducedMotion();

  const progress = useSharedValue(0);
  const [width, setWidth] = useState(0);
  const [internalCompleted, setInternalCompleted] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isControlled = completedProp !== undefined;
  const completed = isControlled ? completedProp : internalCompleted;

  const finish = useCallback(() => {
    if (!isControlled) setInternalCompleted(true);
    onCompletedChange?.(true);
    onComplete?.();
    if (haptics) impactKnock();
  }, [isControlled, onComplete, onCompletedChange, haptics]);

  /*
   * Completion is read off the animation rather than timed alongside it.
   *
   * A `setTimeout` for `holdDuration` and a fill for `holdDuration` are two
   * clocks that agree only while the app is idle: the moment the JS thread is
   * busy the button fires before the fill arrives, or the fill sits full while
   * nothing happens. The reaction fires on the frame the value actually
   * reaches the end, which is the frame the reader saw it get there.
   */
  useAnimatedReaction(
    () => progress.value >= 1,
    (full, was) => {
      if (full && !was) runOnJS(finish)();
    }
  );

  const begin = useCallback(() => {
    if (disabled || completed) return;
    if (haptics) selectionTick();
    cancelAnimation(progress);
    if (reducedMotion) {
      /*
       * Stepped rather than smooth, and still a real indicator. What reduced
       * motion is about is continuous movement, not the button telling you how
       * much longer to wait — take that away and the control asks for a hold
       * with nothing on screen to say why.
       */
      progress.value = withTiming(1, {
        duration,
        easing: Easing.steps(REDUCED_STEPS, true),
      });
      return;
    }
    // Linear. A fill is constant motion, and an eased one misreports the wait:
    // it races the first half and crawls the second, or the reverse.
    progress.value = withTiming(1, { duration, easing: Easing.linear });
  }, [disabled, completed, haptics, progress, reducedMotion, duration]);

  const abandon = useCallback(() => {
    cancelAnimation(progress);
    if (progress.value <= 0) return;
    progress.value = withTiming(0, {
      // Proportional to how far it got. A fixed release makes a hold abandoned
      // after a moment feel sticky, which reads as the button resisting.
      duration: releaseDuration(progress.value, DEFAULT_RELEASE_DURATION),
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const reset = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (!isControlled) setInternalCompleted(false);
    onCompletedChange?.(false);
  }, [progress, isControlled, onCompletedChange]);

  useEffect(() => {
    if (!completed || !autoReset) return;
    resetTimer.current = setTimeout(reset, autoResetDelay);
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = null;
    };
  }, [completed, autoReset, autoResetDelay, reset]);

  // A controlled button told it is no longer complete has to empty its fill,
  // or the next hold starts from a bar that is already full.
  useEffect(() => {
    if (!completed) return;
    progress.value = 1;
  }, [completed, progress]);

  useEffect(
    () => () => {
      cancelAnimation(progress);
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [progress]
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
    props.onLayout?.(event);
  };

  const context = useMemo<ProgressButtonContextValue>(
    () => ({ progress, width, completed, variant, size, slots }),
    [progress, width, completed, variant, size, slots]
  );

  const body = children ?? (
    <>
      <ProgressButtonLabel>Hold to confirm</ProgressButtonLabel>
    </>
  );

  return (
    <ProgressButtonContext.Provider value={context}>
      <Pressable
        ref={ref}
        accessibilityRole="button"
        /*
         * Spoken as what it is. A button whose label says "Hold to confirm"
         * still announces as an ordinary button to anyone who cannot see the
         * fill, and a single activation does nothing — so the hint carries the
         * instruction and the state carries the outcome.
         */
        accessibilityHint="Press and hold to confirm"
        accessibilityState={{
          ...accessibilityState,
          disabled,
          checked: completed,
        }}
        disabled={disabled}
        onPressIn={begin}
        onPressOut={abandon}
        // A few points of drift should not abandon a hold the reader is
        // still making. Fingers move.
        pressRetentionOffset={16}
        {...props}
        onLayout={onLayout}
        className={slots.root({ className })}
      >
        {body}
      </Pressable>
    </ProgressButtonContext.Provider>
  );
});

export interface ProgressButtonLabelProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/**
 * What the button says, drawn twice.
 *
 * The second copy is the one inside the fill, in the inverted colour, pinned to
 * the button's own width and clipped to however far the hold has got. Both are
 * the same text at the same position, so the boundary between them falls in the
 * middle of a glyph rather than between two differently laid-out lines.
 */
function ProgressButtonLabel({ className, children, ...props }: ProgressButtonLabelProps) {
  const { progress, width, slots } = useProgressButtonContext('ProgressButton.Label');

  const fillStyle = useAnimatedStyle(() => ({ width: width * progress.value }));

  return (
    <View {...props} className={slots.content({ className })}>
      {textChildren(children, (text) => (
        <Text className={slots.label()}>{text}</Text>
      ))}

      {/* The wipe. `pointerEvents` off so it never takes the press it is
          drawn on top of, and `width` fixed to the button so the copy inside
          it is laid out exactly where the original is rather than reflowing
          into whatever the clip currently allows. */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
          fillStyle,
        ]}
        className={slots.fill()}
      >
        <View style={{ width }} className={slots.content()}>
          {textChildren(children, (text) => (
            <Text className={slots.fillLabel()}>{text}</Text>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
ProgressButtonLabel.displayName = 'ProgressButton.Label';

ProgressButtonRoot.displayName = 'ProgressButton';

export const ProgressButton = Object.assign(ProgressButtonRoot, {
  Label: ProgressButtonLabel,
});

export {
  DEFAULT_AUTO_RESET_DELAY,
  DEFAULT_HOLD_DURATION,
  DEFAULT_RELEASE_DURATION,
  isComplete,
  releaseDuration,
  resolveHoldDuration,
} from './progress-button-hold';
