/**
 * ImageGeneration — the place an image will be, while it is being made.
 *
 * ```tsx
 * <ImageGeneration status={status} prompt="a quiet mountain at sunset">
 *   <Image source={{ uri }} />
 * </ImageGeneration>
 * ```
 *
 * A generated image arrives seconds after it is asked for, and arrives at a
 * size nobody knew in advance. Left to itself that is a screen that reflows
 * under the reader's thumb at the moment they were about to tap something —
 * so this reserves the box first, at the aspect ratio the image will have, and
 * fills it with something to watch.
 *
 * ## The dot field
 *
 * A grid of dots with a soft band of light travelling across it. Each column
 * is one animated view holding its own dots, so a field of five hundred dots
 * costs twenty-two worklets a frame rather than five hundred — the dots inside
 * a column never move independently of it, and at this scale nobody can tell.
 *
 * The per-dot brightness underneath the band is fixed, and comes from the
 * dot's own coordinates. Without it the field reads as clean vertical stripes
 * sweeping past; with it, it reads as the individual dots lighting up.
 *
 * ## What arrives, and when
 *
 * `status` moves the picture through the work rather than switching it: the
 * field fades as the image fades in, and for one step in the middle both are
 * visible at once. That overlap is the point — an image that appears the
 * instant the field vanishes has been swapped in, and one that surfaces
 * through it has been developed.
 *
 * ## Reduced motion
 *
 * The band stops, and the field is drawn at one still frame of itself. A
 * placeholder that shows nothing is indistinguishable from a component that
 * failed to load, so this is a quieter picture rather than an empty one.
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewProps,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { tv } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { useDirectionSign } from '../../hooks/use-direction';
import { AlertTriangleIcon, CheckIcon, RotateCcwIcon } from '../../icons';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import {
  DOT_REST_OPACITY,
  driftAt,
  gridPath,
  lightRadius,
  pulseAt,
  scanAt,
  type DotFieldAnimation,
} from './dot-field';

/** How far the generation has got. */
export type ImageGenerationStatus =
  | 'queued'
  | 'generating'
  | 'refining'
  | 'complete'
  | 'error';

/**
 * The moment a held field is frozen at.
 *
 * Not zero: at zero the light sits dead centre, which reads as a target rather
 * than as something passing through.
 */
const STILL_FRAME = 900;

/** How visible the field is at each step of the work. */
const FIELD_OPACITY: Record<ImageGenerationStatus, number> = {
  queued: 1,
  generating: 1,
  refining: 0.48,
  complete: 0,
  error: 0,
};

/**
 * How visible the image is at each step.
 *
 * `refining` is the overlap: the field is still there at half strength and the
 * image is already coming through it. Both fully on for one step is what makes
 * the picture surface rather than get swapped in.
 */
const MEDIA_OPACITY: Record<ImageGenerationStatus, number> = {
  queued: 0,
  generating: 0,
  refining: 0.62,
  complete: 1,
  error: 0.28,
};

/**
 * How much larger than final the image starts.
 *
 * Small, and it settles rather than zooms. A generated image is not arriving
 * from anywhere; the scale is there to give the last of the fade somewhere to
 * go, so it does not simply stop.
 */
const MEDIA_SCALE: Record<ImageGenerationStatus, number> = {
  queued: 1.02,
  generating: 1.02,
  refining: 1.008,
  complete: 1,
  error: 1,
};

const STATUS_TEXT: Record<ImageGenerationStatus, string> = {
  queued: 'Waiting to generate',
  generating: 'Creating image',
  refining: 'Refining details',
  complete: 'Image ready',
  error: 'Generation failed',
};

const imageGenerationVariants = tv({
  slots: {
    root: 'w-full',
    frame: 'relative w-full overflow-hidden rounded-2xl bg-muted',
    media: 'absolute inset-0',
    resolution:
      'absolute end-2 top-2 rounded-full bg-background/75 px-2 py-0.5 text-[10px] text-muted-foreground',
    status: 'mt-3 flex-row items-center gap-2',
    statusText: 'text-sm font-medium text-foreground',
    prompt: 'mt-0.5 text-xs text-muted-foreground',
    retry: 'mt-3 min-h-12 flex-row items-center gap-2 self-start rounded-full px-3 active:bg-accent',
    retryLabel: 'text-sm font-medium text-foreground',
  },
  variants: {
    size: {
      /** Held to a thumbnail, centred — a result inside a conversation. */
      compact: { root: 'max-w-52 self-center' },
      /** As wide as it is given. */
      fluid: {},
    },
    error: {
      true: { statusText: 'text-destructive' },
    },
  },
  defaultVariants: {
    size: 'compact',
  },
});

const AnimatedRadialGradient = Animated.createAnimatedComponent(RadialGradient);
const AnimatedStop = Animated.createAnimatedComponent(Stop);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export interface ImageGenerationFieldProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** Holds the light still, at one representative frame. */
  paused?: boolean;
  /**
   * How the light behind the dots moves.
   *
   * `drift` wanders around the middle; `pulse` leaves the centre as a ring and
   * fades; `scan` crosses the box as a band. All three cost the same, which is
   * two numbers a frame however big the field is.
   */
  animation?: DotFieldAnimation;
}

/**
 * The dot field on its own, for a placeholder that is not an image.
 *
 * It fills its parent absolutely rather than sizing to its contents, because
 * what it draws has no intrinsic height — laid out normally it measures to
 * nothing and draws a single row of dots along the top.
 *
 * ## How it is cheap
 *
 * One path, drawn once when the box is measured, filled with a gradient. The
 * light is the gradient's own centre, so each dot takes its brightness from
 * where it happens to sit and nothing has to be told which dots are lit.
 * Moving the light is two numbers a frame, whatever the field's size.
 *
 * The two versions before this one both animated the dots themselves — first
 * by rebuilding every arc as a string each frame, then by clipping a shape of
 * light to a path with hundreds of subpaths in it. Both made a screen showing
 * several of these stall on scroll, the second because a complex clip is
 * re-rasterized every time the view is drawn, which scrolling does constantly.
 */
function ImageGenerationField({
  className,
  paused = false,
  animation = 'drift',
  style,
  ...props
}: ImageGenerationFieldProps) {
  const reducedMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const clock = useSharedValue(STILL_FRAME);

  const tint = useCSSVariable('--color-muted-foreground');
  const color = typeof tint === 'string' ? tint : '#737373';

  /*
   * The gradient is named per instance.
   *
   * An SVG id is looked up by name, and several fields on one screen — which is
   * exactly what a page of these is — would otherwise all point at whichever
   * definition mounted last. The symptom is one field drawing and the rest
   * going blank, which reads as a bug in the component rather than as two
   * things sharing a name.
   */
  const paintId = `panelui-ig-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const running = !paused && !reducedMotion;

  /*
   * Built once per size and not touched again. It is the expensive half —
   * hundreds of arcs in a string — and none of it changes as the light moves.
   */
  const grid = useMemo(() => gridPath(size.width, size.height), [size.width, size.height]);
  const radius = lightRadius(size.width, size.height);
  // The pulse has to reach the corners, or the ring stops before the field does.
  const pulseRadius = Math.sqrt(size.width * size.width + size.height * size.height) / 2;

  const frame = useFrameCallback((info) => {
    'worklet';
    // Accumulated rather than read off the total, so pausing and resuming does
    // not jump the light to wherever the clock would have carried it. A dropped
    // frame is clamped: a 300ms hitch played back whole is a lurch.
    clock.value += Math.min(info.timeSincePreviousFrame ?? 16, 48);
  }, false);

  const { setActive } = frame;
  useEffect(() => {
    setActive(running);
    return () => setActive(false);
  }, [running, setActive]);

  /*
   * A still field is not an empty one. Reduced motion and `paused` both leave
   * the light somewhere legible rather than losing it, which is the difference
   * between "not animating" and "failed to load" — the clock starts at a frame
   * with the light off centre rather than at zero.
   */
  const driftProps = useAnimatedProps(() => {
    const [x, y] = driftAt(clock.value, size.width, size.height);
    return { cx: x, cy: y, r: radius };
  });

  // The ring's position, as an offset along a gradient that spans the box.
  // Bright at the offset and resting on both sides of it, so what travels is a
  // band of light rather than a disc that grows and starts over.
  const pulseProps = useAnimatedProps(() => ({ offset: pulseAt(clock.value) }));

  const scanProps = useAnimatedProps(() => {
    // The band starts and ends a full width clear of the box, so it ramps in
    // and out at the edges rather than arriving at full strength against them.
    const head = -size.width + scanAt(clock.value) * size.width * 2;
    return { x1: head, x2: head + size.width };
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((was) => (was.width === width && was.height === height ? was : { width, height }));
  };

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      onLayout={onLayout}
      className={className}
      style={[StyleSheet.absoluteFill, style]}
      {...props}
    >
      {grid ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            {animation === 'scan' ? (
              <AnimatedLinearGradient
                id={paintId}
                animatedProps={scanProps}
                gradientUnits="userSpaceOnUse"
                y1={0}
                y2={0}
              >
                <Stop offset="0" stopColor={color} stopOpacity={DOT_REST_OPACITY} />
                <Stop offset="0.5" stopColor={color} stopOpacity="0.95" />
                <Stop offset="1" stopColor={color} stopOpacity={DOT_REST_OPACITY} />
              </AnimatedLinearGradient>
            ) : animation === 'pulse' ? (
              <RadialGradient
                id={paintId}
                gradientUnits="userSpaceOnUse"
                cx={size.width / 2}
                cy={size.height / 2}
                r={pulseRadius}
              >
                <Stop offset="0" stopColor={color} stopOpacity={DOT_REST_OPACITY} />
                <AnimatedStop
                  animatedProps={pulseProps}
                  stopColor={color}
                  stopOpacity="0.95"
                />
                <Stop offset="1" stopColor={color} stopOpacity={DOT_REST_OPACITY} />
              </RadialGradient>
            ) : (
              <AnimatedRadialGradient
                id={paintId}
                animatedProps={driftProps}
                gradientUnits="userSpaceOnUse"
              >
                {/* Soft at the centre and down to the resting opacity at the
                    rim rather than to nothing, so a dot the light has not
                    reached is still a dot. */}
                <Stop offset="0" stopColor={color} stopOpacity="0.95" />
                <Stop offset="0.55" stopColor={color} stopOpacity="0.5" />
                <Stop offset="1" stopColor={color} stopOpacity={DOT_REST_OPACITY} />
              </AnimatedRadialGradient>
            )}
          </Defs>

          {/* One path, filled with the light itself. Each dot takes its
              brightness from where it sits in the gradient, so nothing has to
              be told which dots are lit and nothing is clipped. */}
          <Path d={grid} fill={`url(#${paintId})`} />
        </Svg>
      ) : null}
    </View>
  );
}

export interface ImageGenerationProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** How far the generation has got. Defaults to `generating`. */
  status?: ImageGenerationStatus;
  /**
   * What the box is, for a screen reader. Defaults to the status text, with
   * the prompt after it where there is one.
   */
  label?: string;
  /** The instruction the image was made from. Shown under the status. */
  prompt?: string;
  /** Shown in the corner of the frame. Pass an empty string to drop it. */
  resolution?: string;
  /**
   * The box's shape, as width over height. Defaults to `1` — square, which is
   * what most models return, and what the frame must be before there is an
   * image to measure.
   */
  aspectRatio?: number;
  /** `compact` caps the width at a thumbnail and centres it; `fluid` fills. */
  size?: 'compact' | 'fluid';
  /**
   * How the light behind the dots moves while there is work outstanding.
   * `drift` wanders, `pulse` leaves the centre as a ring, `scan` crosses as a
   * band. All three cost the same.
   */
  animation?: DotFieldAnimation;
  /** Replaces the sentence under the frame. */
  statusText?: string;
  /** Hides the status line, leaving the frame and the prompt. */
  showStatus?: boolean;
  /** Shown as a button under an `error`. Without it there is no button. */
  onRetry?: () => void;
  /** Extra classes for the frame — its radius, ground and aspect. */
  frameClassName?: string;
  /** Extra classes for the layer the image sits in. */
  mediaClassName?: string;
  /** Extra classes for the status line. */
  statusClassName?: string;
  /** The finished image. Anything that fills its parent — an `Image`, a video. */
  children?: ReactNode;
}

/** The mark beside the status: a turning square while it works, then an answer. */
function StatusMark({ status }: { status: ImageGenerationStatus }) {
  const reducedMotion = useReducedMotion();
  const spin = useSharedValue(0);
  const working = status !== 'complete' && status !== 'error';

  useEffect(() => {
    if (!working || reducedMotion) {
      cancelAnimation(spin);
      spin.value = 0;
      return;
    }
    spin.value = 0;
    spin.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1
    );
    return () => cancelAnimation(spin);
  }, [reducedMotion, spin, working]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const tint = useCSSVariable('--color-muted-foreground');
  const color = typeof tint === 'string' ? tint : '#737373';

  if (status === 'complete') return <CheckIcon size={14} />;
  if (status === 'error') return <AlertTriangleIcon size={14} />;

  // Four dots turning as a block: the same shape as the field it stands for,
  // small enough to sit on a line of text.
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: 14, height: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }, style]}
    >
      {[1, 0.55, 0.55, 1].map((opacity, index) => (
        <View
          key={index}
          style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: color, opacity }}
        />
      ))}
    </Animated.View>
  );
}

function ImageGenerationRoot({
  className,
  status = 'generating',
  label,
  prompt,
  resolution = '1024 × 1024',
  aspectRatio = 1,
  size = 'compact',
  animation = 'drift',
  statusText,
  showStatus = true,
  onRetry,
  frameClassName,
  mediaClassName,
  statusClassName,
  children,
  ...props
}: ImageGenerationProps) {
  const reducedMotion = useReducedMotion();
  const working = status === 'queued' || status === 'generating' || status === 'refining';
  const slots = imageGenerationVariants({ size, error: status === 'error' });
  const sentence = statusText ?? STATUS_TEXT[status];

  const progress = useSharedValue(MEDIA_OPACITY[status]);
  const fieldFade = useSharedValue(FIELD_OPACITY[status]);
  const scale = useSharedValue(MEDIA_SCALE[status]);

  useEffect(() => {
    const duration = reducedMotion ? 0 : 400;
    progress.value = withTiming(MEDIA_OPACITY[status], { duration });
    fieldFade.value = withTiming(FIELD_OPACITY[status], { duration });
    scale.value = withTiming(MEDIA_SCALE[status], { duration });
  }, [fieldFade, progress, reducedMotion, scale, status]);

  useEffect(
    () => () => {
      cancelAnimation(progress);
      cancelAnimation(fieldFade);
      cancelAnimation(scale);
    },
    [fieldFade, progress, scale]
  );

  const mediaStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: scale.value }],
  }));
  const fieldStyle = useAnimatedStyle(() => ({ opacity: fieldFade.value }));

  return (
    <View {...props} className={slots.root({ className })}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label ?? (prompt ? `${sentence}: ${prompt}` : sentence)}
        // `busy` is what tells a screen reader the box is not the answer yet.
        accessibilityState={{ busy: working }}
        style={{ aspectRatio }}
        className={slots.frame({ className: frameClassName })}
      >
        <Animated.View
          className={cn(slots.media(), mediaClassName)}
          style={mediaStyle}
          // Nothing to announce until there is something in it.
          accessibilityElementsHidden={working}
          importantForAccessibility={working ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </Animated.View>

        {/* Kept mounted at zero rather than unmounted, so the image is not
            fading in over a box that is simultaneously being torn down. The
            field stops drawing as soon as there is no work left, so an idle
            one costs nothing but the views. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, fieldStyle]}
          pointerEvents="none"
        >
          <ImageGenerationField paused={!working} animation={animation} />
        </Animated.View>

        {resolution ? <Text className={slots.resolution()}>{resolution}</Text> : null}
      </View>

      {showStatus ? (
        <View
          accessibilityLiveRegion="polite"
          className={slots.status({ className: statusClassName })}
        >
          <StatusMark status={status} />
          <Text className={slots.statusText()}>{sentence}</Text>
        </View>
      ) : null}

      {prompt ? (
        <Text numberOfLines={1} className={slots.prompt()}>
          {prompt}
        </Text>
      ) : null}

      {status === 'error' && onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={onRetry}
          className={slots.retry()}
        >
          <RotateCcwIcon size={16} />
          <Text className={slots.retryLabel()}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

ImageGenerationRoot.displayName = 'ImageGeneration';
ImageGenerationField.displayName = 'ImageGeneration.Field';

export const ImageGeneration = Object.assign(ImageGenerationRoot, {
  Field: ImageGenerationField,
});
