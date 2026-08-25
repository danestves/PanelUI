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
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
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

/** How far the generation has got. */
export type ImageGenerationStatus =
  | 'queued'
  | 'generating'
  | 'refining'
  | 'complete'
  | 'error';

/**
 * Columns in the dot field.
 *
 * Fixed rather than derived from the width, because each column is a component
 * with a hook in it and React needs the count to be the same on every render.
 * The spacing adapts instead, so the field fills whatever box it is given.
 */
const COLUMNS = 22;

/** How many columns the travelling band covers, half to each side of its centre. */
const BAND = 5;

/** The field's opacity where the band is not, and where it is. */
const DOT_REST = 0.18;
const DOT_LIT = 1;

/** One pass of the band across the field. */
const SWEEP_DURATION = 2600;

/** Where the band sits when the animation is stopped. */
const STILL_HEAD = COLUMNS * 0.38;

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

/**
 * A dot's share of the light, from its own coordinates.
 *
 * Deterministic, so it does not change between renders and never has to be
 * stored. The two frequencies are irrational to each other, which is what
 * keeps the pattern from repeating across a field this size and reading as a
 * weave.
 */
function dotWeight(column: number, row: number): number {
  const noise = Math.sin(column * 12.9898 + row * 78.233) * 43758.5453;
  return 0.45 + (noise - Math.floor(noise)) * 0.55;
}

interface DotColumnProps {
  index: number;
  rows: number;
  gap: number;
  dot: number;
  head: SharedValue<number>;
  color: string;
}

/**
 * One column of the field.
 *
 * The whole column takes the band's brightness at its position, and each dot
 * inside scales that by its own fixed weight. One animated style per column is
 * the entire cost of the field.
 */
function DotColumn({ index, rows, gap, dot, head, color }: DotColumnProps) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(index - head.value);
    const lit = Math.max(0, 1 - distance / BAND);
    // Squared, so the band has a soft centre and a definite edge rather than
    // a linear ramp, which at this size reads as a grey wash.
    return { opacity: DOT_REST + lit * lit * (DOT_LIT - DOT_REST) };
  });

  const dots = useMemo(
    () =>
      Array.from({ length: rows }, (_, row) => (
        <View
          key={row}
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: color,
            opacity: dotWeight(index, row),
            marginTop: row === 0 ? 0 : gap - dot,
          }}
        />
      )),
    [color, dot, gap, index, rows]
  );

  return <Animated.View style={style}>{dots}</Animated.View>;
}

export interface ImageGenerationFieldProps extends ViewProps {
  className?: string;
  /** Stops the band and draws one still frame of the field. */
  paused?: boolean;
}

/**
 * The dot field on its own, for a placeholder that is not an image.
 *
 * It fills its parent, so give it a box.
 */
function ImageGenerationField({ className, paused = false, ...props }: ImageGenerationFieldProps) {
  const reducedMotion = useReducedMotion();
  const sign = useDirectionSign();
  const head = useSharedValue(STILL_HEAD);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const tint = useCSSVariable('--color-muted-foreground');
  const color = typeof tint === 'string' ? tint : '#737373';

  const still = paused || reducedMotion;

  useEffect(() => {
    if (still) {
      cancelAnimation(head);
      head.value = STILL_HEAD;
      return;
    }

    // The band starts and ends clear of the field so it ramps in and out at
    // the edges rather than appearing at full strength against them.
    const from = sign === 1 ? -BAND : COLUMNS + BAND;
    const to = sign === 1 ? COLUMNS + BAND : -BAND;
    head.value = from;
    head.value = withRepeat(
      withTiming(to, { duration: SWEEP_DURATION, easing: Easing.linear }),
      -1
    );

    return () => cancelAnimation(head);
  }, [head, sign, still]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const gap = size.width > 0 ? size.width / COLUMNS : 0;
  const dot = Math.max(1.5, Math.min(3, gap * 0.3));
  const rows = gap > 0 ? Math.max(1, Math.floor(size.height / gap)) : 0;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      onLayout={onLayout}
      className={cn('flex-row items-start justify-between overflow-hidden px-2 py-2', className)}
      {...props}
    >
      {rows > 0
        ? Array.from({ length: COLUMNS }, (_, index) => (
            <DotColumn
              key={index}
              index={index}
              rows={rows}
              gap={gap}
              dot={dot}
              head={head}
              color={color}
            />
          ))
        : null}
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

        {/* Kept mounted at zero rather than unmounted: it is a grid of views,
            and tearing it down mid-fade is a stutter at exactly the moment the
            image is arriving. */}
        <Animated.View className="absolute inset-0" style={fieldStyle} pointerEvents="none">
          <ImageGenerationField paused={!working} />
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
