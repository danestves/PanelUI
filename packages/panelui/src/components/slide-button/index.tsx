/**
 * SlideButton — drag across to confirm, with the distance drawn on the button.
 *
 * ```tsx
 * <SlideButton onComplete={ship}>
 *   <SlideButton.Label>Slide to ship</SlideButton.Label>
 * </SlideButton>
 * ```
 *
 * For an action worth a moment's deliberation, where a hold is the wrong
 * shape. A hold asks for time and shows a clock; a slide asks for a movement
 * and shows a distance — so the reader can go as fast as they like, and still
 * cannot arrive by tapping. Pair it with [ProgressButton](../progress-button)
 * rather than choosing between them: the hold suits an action that should feel
 * expensive, the slide one that should feel deliberate.
 *
 * ## The far end is the promise
 *
 * Nothing fires until the thumb clears `threshold`, which defaults to nine
 * tenths of the rail. Released short, it springs home and the fill goes with
 * it. Released short but travelling, it is honoured — a flick that had
 * plainly committed is not worth refusing on a technicality, and the velocity
 * is projected forward to decide.
 *
 * ## How it is drawn
 *
 * A track, a fill that follows the thumb, and a label that fades as the thumb
 * reaches it. The label fades rather than sliding out of the way because the
 * thumb is about to be where the label is, and two things moving toward each
 * other at different speeds reads as a collision.
 *
 * The thumb is translated and the fill's width animated, both on the UI thread
 * off one shared value, so a drag never re-renders React.
 *
 * ## Sliding without a finger
 *
 * A drag is not available to a screen reader, so the rail is also a button:
 * it takes an `activate` accessibility action and completes on it. This is not
 * a lesser path bolted on — a confirmation control that can only be reached by
 * dragging is a confirmation control some people cannot use.
 */
import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { tv, type VariantProps } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { useDirectionSign } from '../../hooks/use-direction';
import { CheckIcon, ChevronRightIcon, IconColorProvider } from '../../icons';
import { Text, textChildren } from '../../primitives/text';
import { impactKnock, selectionTick } from '../../utils/haptics';
import {
  DEFAULT_AUTO_RESET_DELAY,
  OVERSHOOT_FRICTION,
  VELOCITY_LOOKAHEAD,
  resolveThreshold,
} from './slide-button-track';

/** How the thumb settles when it is let go, in either direction. */
const SPRING = { damping: 22, stiffness: 220, mass: 0.7 } as const;

/** How long the completed drawing takes to leave again on a reset. */
const DONE_EXIT = 140;

/** How long the reduced-motion snap takes, in place of a spring. */
const REDUCED_SNAP = 160;

/**
 * Which token the thumb's glyph is drawn in, per variant.
 *
 * The thumb carries the variant's solid fill, so its contents take that fill's
 * foreground rather than the button's — which is what keeps the contrast right
 * in both themes without a hardcoded colour.
 */
const THUMB_TINT = {
  primary: '--color-primary-foreground',
  secondary: '--color-background',
  destructive: '--color-destructive-solid-foreground',
  success: '--color-success-solid-foreground',
} as const;

const slideButtonVariants = tv({
  slots: {
    /*
     * A pill, and the same secondary ground ProgressButton rests on, so the
     * two read as one pair of controls rather than two unrelated ones. The
     * radius is also the shape of the fill's leading edge as it comes out of
     * the corner.
     */
    root: 'relative flex-row items-center overflow-hidden rounded-full border border-transparent bg-secondary',
    /** The travelled part of the rail, behind the thumb. */
    fill: 'absolute bottom-0 top-0',
    /** The label, centred in the rail rather than in the space beside it. */
    label: 'text-center font-medium',
    /** The draggable disc. */
    thumb: 'absolute items-center justify-center rounded-full',
    /** What the thumb holds — a chevron at rest, a tick once it has arrived. */
    thumbContent: 'items-center justify-center',
  },
  variants: {
    variant: {
      primary: { label: 'text-primary', fill: 'bg-primary/20', thumb: 'bg-primary' },
      secondary: {
        label: 'text-secondary-foreground',
        fill: 'bg-foreground/15',
        thumb: 'bg-foreground',
      },
      destructive: {
        label: 'text-destructive',
        fill: 'bg-destructive/20',
        thumb: 'bg-destructive',
      },
      success: { label: 'text-success', fill: 'bg-success/20', thumb: 'bg-success' },
    },
    size: {
      // Matched to ProgressButton's boxes so the two line up in a column, and
      // `min-h-*` for the same reason: the label's glyphs grow with the system
      // text size and the box has to grow with them.
      sm: { root: 'min-h-11 p-1', label: 'text-[14px]' },
      md: { root: 'min-h-[52px] p-1', label: 'text-[16px]' },
      lg: { root: 'min-h-14 p-1', label: 'text-[18px]' },
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

type SlideButtonVariantProps = VariantProps<typeof slideButtonVariants>;

/** How a slide button looks. */
export type SlideButtonVariant = NonNullable<SlideButtonVariantProps['variant']>;
/** How big a slide button is. */
export type SlideButtonSize = NonNullable<SlideButtonVariantProps['size']>;

/** The thumb's diameter, per size. It is a square, so this is both dimensions. */
const THUMB_SIZE = { sm: 36, md: 44, lg: 48 } as const;

/** The rail's own padding — the gap the thumb sits inside. */
const RAIL_INSET = 4;

interface SlideButtonContextValue {
  /** `0` to `1` across the rail. */
  progress: SharedValue<number>;
  /** Points the thumb can cover: the rail, less the thumb and both insets. */
  travel: SharedValue<number>;
  /** `0` to `1` across the arrival of the completed drawing. */
  done: SharedValue<number>;
  /** Whether the slide has been completed. */
  completed: boolean;
  slots: ReturnType<typeof slideButtonVariants>;
  variant: SlideButtonVariant;
  size: SlideButtonSize;
}

const SlideButtonContext = createContext<SlideButtonContextValue | null>(null);

function useSlideButtonContext(component: string): SlideButtonContextValue {
  const context = useContext(SlideButtonContext);
  if (!context) {
    throw new Error(`${component} must be used within a <SlideButton>`);
  }
  return context;
}

/** The slide's progress and whether it has completed, for a custom part. */
export function useSlideButton(): { progress: SharedValue<number>; completed: boolean } {
  const { progress, completed } = useSlideButtonContext('useSlideButton');
  return { progress, completed };
}

export interface SlideButtonProps
  extends Omit<ViewProps, 'children'>,
    Omit<SlideButtonVariantProps, 'disabled'> {
  /** Extra classes for the rail — the box the button occupies in your layout. */
  className?: string;
  /**
   * The fraction of the rail the thumb has to cover for the slide to count.
   * Defaults to `0.9`, clamped to between `0.1` and `1`.
   */
  threshold?: number;
  /** Fires once the thumb has been taken past the threshold and released. */
  onComplete?: () => void;
  /** Fires whenever the completed state changes, including on a reset. */
  onCompletedChange?: (completed: boolean) => void;
  /** Controlled completion. Leave unset to let the button own it. */
  completed?: boolean;
  /** Return to the unslid state after `autoResetDelay`. */
  autoReset?: boolean;
  /** Milliseconds to stay completed before resetting. Defaults to `1000`. */
  autoResetDelay?: number;
  /** Dim the button and refuse the drag outright. */
  disabled?: boolean;
  /**
   * A tick as the thumb arms and a knock when it commits. Off by default,
   * because a control used several times in a row is one a reader may not want
   * buzzing every time.
   */
  haptics?: boolean;
  /**
   * What a screen reader is told the button does, in the imperative — it is
   * announced as the action of a button rather than as an instruction to drag,
   * since dragging is not available there. Defaults to `'Confirm'`.
   */
  accessibilityActionLabel?: string;
  children?: ReactNode;
}

function SlideButtonRoot(
  {
    className,
    variant = 'primary',
    size = 'md',
    fullWidth,
    threshold: thresholdProp,
    onComplete,
    onCompletedChange,
    completed: completedProp,
    autoReset = false,
    autoResetDelay = DEFAULT_AUTO_RESET_DELAY,
    disabled = false,
    haptics = false,
    accessibilityActionLabel = 'Confirm',
    accessibilityState,
    children,
    ...props
  }: SlideButtonProps,
  ref: React.Ref<View>
) {
  const reducedMotion = useReducedMotion();
  const sign = useDirectionSign();

  const progress = useSharedValue(0);
  const done = useSharedValue(0);
  const armed = useSharedValue(false);
  const origin = useSharedValue(0);

  /*
   * The rail's measurements live in shared values, not in the render's
   * closure.
   *
   * A gesture built over plain numbers is a new gesture the first time the rail
   * is measured and again every time anything else changes — and re-attaching a
   * handler mid-drag is how a live touch gets dropped. Built over shared values
   * it is constructed once and reads the current numbers when it runs.
   */
  const travel = useSharedValue(0);
  const threshold = useSharedValue(resolveThreshold(thresholdProp));
  const active = useSharedValue(false);

  const [internalCompleted, setInternalCompleted] = useState(false);
  const controlled = completedProp !== undefined;
  const completed = controlled ? completedProp : internalCompleted;

  const thumbSize = THUMB_SIZE[size];

  useEffect(() => {
    threshold.value = resolveThreshold(thresholdProp);
  }, [threshold, thresholdProp]);

  useEffect(() => {
    active.value = !disabled && !completed;
  }, [active, completed, disabled]);

  /*
   * Read from the gesture through `runOnJS`, so they have to be current
   * without the gesture being rebuilt to see them.
   */
  const completedRef = useRef(completed);
  completedRef.current = completed;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onCompletedChangeRef = useRef(onCompletedChange);
  onCompletedChangeRef.current = onCompletedChange;
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setInternalCompleted(true);
    onCompletedChangeRef.current?.(true);
    onCompleteRef.current?.();
    if (hapticsRef.current) impactKnock();
  }, []);

  const tick = useCallback(() => {
    if (hapticsRef.current) selectionTick();
  }, []);

  const reset = useCallback(() => {
    completedRef.current = false;
    setInternalCompleted(false);
    onCompletedChangeRef.current?.(false);
  }, []);

  /** The screen-reader path: no drag, so the whole travel is granted at once. */
  const activate = useCallback(() => {
    if (disabled || completedRef.current) return;
    progress.value = reducedMotion
      ? withTiming(1, { duration: REDUCED_SNAP })
      : withSpring(1, SPRING);
    finish();
  }, [disabled, finish, progress, reducedMotion]);

  /*
   * Built once. The arithmetic is written out here rather than called from
   * `slide-button-track`: a pan handler is the one place in the library that
   * cannot afford a surprise, and a worklet reaching across a module boundary
   * for a helper that reaches across again is a chain with more ways to fail
   * than the three lines are long. The module holds the definition and the
   * tests hold this to it.
   */
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        /*
         * A drag has to travel before it takes the touch, or a slide button
         * inside a scroller steals every vertical flick that starts on it.
         */
        .activeOffsetX([-12, 12])
        .failOffsetY([-14, 14])
        .onBegin(() => {
          'worklet';
          origin.value = progress.value * travel.value;
          armed.value = false;
        })
        .onUpdate((event) => {
          'worklet';
          if (!active.value || travel.value <= 0) return;

          // Every raw pixel goes through `sign`: in a right-to-left subtree the
          // rail runs the other way, and the gesture reports screen space.
          const moved = origin.value + event.translationX * sign;
          const span = travel.value;

          // The finger is followed exactly inside the rail, and let go of
          // gradually past either end — a thumb that lags reads as a slow app,
          // and one that stops dead reads as a broken control.
          let at = moved;
          if (moved < 0) at = moved / OVERSHOOT_FRICTION;
          else if (moved > span) at = span + (moved - span) / OVERSHOOT_FRICTION;

          const next = Math.min(1, Math.max(0, at / span));
          progress.value = next;

          const reached = next >= threshold.value;
          if (reached !== armed.value) {
            armed.value = reached;
            // Once per crossing, not once per frame — the arming is the event
            // worth feeling, and a tick every frame is a rattle.
            if (reached) runOnJS(tick)();
          }
        })
        .onEnd((event) => {
          'worklet';
          armed.value = false;
          if (!active.value || travel.value <= 0) return;

          // Where it got to, plus where its speed was about to carry it.
          const carried = (event.velocityX * sign * VELOCITY_LOOKAHEAD) / travel.value;
          const committed = progress.value + carried >= threshold.value;

          // The velocity is handed to the spring rather than merely consulted,
          // so the thumb keeps the speed it already had instead of restarting
          // from rest.
          const velocity = event.velocityX * sign;
          progress.value = withSpring(committed ? 1 : 0, { ...SPRING, velocity });
          if (committed) runOnJS(finish)();
        }),
    [active, armed, finish, origin, progress, sign, threshold, tick, travel]
  );

  /*
   * A controlled completion arrives without a drag behind it, and so does a
   * reset — so the thumb is put where the state says it should be rather than
   * left wherever the finger left it.
   */
  useEffect(() => {
    progress.value = reducedMotion
      ? withTiming(completed ? 1 : 0, { duration: REDUCED_SNAP })
      : withSpring(completed ? 1 : 0, SPRING);
  }, [completed, progress, reducedMotion]);

  useEffect(() => {
    done.value = completed
      ? reducedMotion
        ? withTiming(1, { duration: REDUCED_SNAP })
        : withSpring(1, SPRING)
      : withTiming(0, { duration: DONE_EXIT });
  }, [completed, done, reducedMotion]);

  useEffect(() => {
    if (!autoReset || !completed) return;
    const timer = setTimeout(reset, autoResetDelay);
    return () => clearTimeout(timer);
  }, [autoReset, autoResetDelay, completed, reset]);

  useEffect(
    () => () => {
      cancelAnimation(progress);
      cancelAnimation(done);
    },
    [done, progress]
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      travel.value = Math.max(
        0,
        event.nativeEvent.layout.width - thumbSize - RAIL_INSET * 2
      );
    },
    [thumbSize, travel]
  );

  const slots = slideButtonVariants({ variant, size, fullWidth, disabled });

  const context = useMemo<SlideButtonContextValue>(
    () => ({ progress, travel, done, completed, slots, variant, size }),
    [progress, travel, done, completed, slots, variant, size]
  );

  /*
   * A caller who wrote no thumb still gets one. The thumb is the control — a
   * slide button without it is a label in a box — so it is appended rather
   * than left to the caller to remember.
   */
  const hasThumb = Children.toArray(children).some(
    (child) => isValidElement(child) && child.type === SlideButtonThumb
  );

  return (
    <SlideButtonContext.Provider value={context}>
      <View
        ref={ref}
        accessible
        accessibilityRole="button"
        accessibilityHint="Slide to confirm"
        accessibilityState={{ ...accessibilityState, disabled, checked: completed }}
        // A drag cannot be performed by a screen reader, so the same outcome is
        // offered as an action it can perform.
        accessibilityActions={[{ name: 'activate', label: accessibilityActionLabel }]}
        onAccessibilityAction={activate}
        onLayout={onLayout}
        // After the spread, so a caller's own `onLayout` or accessibility state
        // cannot take the measurement the control runs on.
        {...props}
        className={slots.root({ className })}
      >
        <SlideButtonFill />
        {textChildren(children, (text) => (
          <SlideButtonLabel>{text}</SlideButtonLabel>
        ))}
        {hasThumb ? null : <SlideButtonThumb />}

        {/*
          * The touch surface, and nothing else.
          *
          * The gesture's view carries no styling, no measurement and no
          * accessibility of its own — those all belong to the rail above, and
          * a detector whose child is also doing four other jobs is a detector
          * whose child can be re-created for four other reasons. It sits last
          * so it is over everything, which is what makes the whole rail
          * draggable rather than only the parts with nothing on them.
          */}
        <GestureDetector gesture={gesture}>
          <Animated.View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      </View>
    </SlideButtonContext.Provider>
  );
}

/** The travelled part of the rail. Drawn by the root; not a public part. */
function SlideButtonFill() {
  const { progress, travel, slots, size } = useSlideButtonContext('SlideButton.Fill');
  const sign = useDirectionSign();
  const thumbSize = THUMB_SIZE[size];

  // A width in points rather than a percentage: the fill ends under the middle
  // of the thumb, which is a distance the rail knows and a fraction of the rail
  // is not.
  const style = useAnimatedStyle(() => ({
    width: RAIL_INSET + thumbSize / 2 + progress.value * travel.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      className={slots.fill()}
      style={[{ [sign === 1 ? 'left' : 'right']: 0 }, style]}
    />
  );
}

export interface SlideButtonLabelProps extends ViewProps {
  /** Extra classes for the label's text. */
  className?: string;
  children?: ReactNode;
}

/**
 * What the button says.
 *
 * It fades as the thumb approaches rather than sliding aside: the thumb is
 * about to occupy the space the label is in, and two things moving toward each
 * other at different speeds reads as a collision rather than as one making
 * room for the other.
 */
function SlideButtonLabel({ className, style, children, ...props }: SlideButtonLabelProps) {
  const { progress, slots } = useSlideButtonContext('SlideButton.Label');
  const fade = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, progress.value * 1.6),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      className="flex-1 items-center justify-center"
      style={[fade, style]}
      {...props}
    >
      <Text className={slots.label({ className })}>{children}</Text>
    </Animated.View>
  );
}

export interface SlideButtonThumbProps extends ViewProps {
  /** Extra classes for the thumb — its fill and shape. Its size comes from `size`. */
  className?: string;
  /** Replaces the chevron. The tick that lands on completion is unaffected. */
  children?: ReactNode;
}

/**
 * The disc the finger moves.
 *
 * Translated rather than laid out at a position, so a drag costs no layout
 * pass. It sits absolutely at the rail's leading inset and travels from there.
 */
function SlideButtonThumb({ className, style, children, ...props }: SlideButtonThumbProps) {
  const { progress, travel, done, completed, slots, variant, size } =
    useSlideButtonContext('SlideButton.Thumb');
  const sign = useDirectionSign();
  const thumbSize = THUMB_SIZE[size];

  const tint = useCSSVariable(THUMB_TINT[variant]);
  const glyphColor = typeof tint === 'string' ? tint : undefined;

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * travel.value * sign }],
  }));

  const chevronStyle = useAnimatedStyle(() => ({ opacity: 1 - done.value }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: done.value,
    transform: [{ scale: 0.7 + done.value * 0.3 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      className={slots.thumb({ className })}
      style={[
        {
          width: thumbSize,
          height: thumbSize,
          [sign === 1 ? 'left' : 'right']: RAIL_INSET,
        },
        slide,
        style,
      ]}
      {...props}
    >
      <IconColorProvider color={glyphColor}>
        <Animated.View className={slots.thumbContent()} style={chevronStyle}>
          {children ?? <ChevronRightIcon size={20} />}
        </Animated.View>
        {/* Lifted over the chevron rather than swapped with it, so the two
            cross through each other instead of one popping out and the other
            in on the same frame. */}
        <Animated.View
          className={slots.thumbContent()}
          style={[StyleSheet.absoluteFill, checkStyle]}
          accessibilityElementsHidden={!completed}
          importantForAccessibility={completed ? 'auto' : 'no-hide-descendants'}
        >
          <CheckIcon size={20} />
        </Animated.View>
      </IconColorProvider>
    </Animated.View>
  );
}

SlideButtonLabel.displayName = 'SlideButton.Label';
SlideButtonThumb.displayName = 'SlideButton.Thumb';

const SlideButtonWithRef = forwardRef(SlideButtonRoot);
SlideButtonWithRef.displayName = 'SlideButton';

export const SlideButton = Object.assign(SlideButtonWithRef, {
  Label: SlideButtonLabel,
  Thumb: SlideButtonThumb,
});
