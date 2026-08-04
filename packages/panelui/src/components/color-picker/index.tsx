/**
 * ColorPicker — a colour chosen by dragging, not by typing.
 *
 * The controls are the colour model made visible: a square where saturation
 * runs across and brightness runs up, under a hue picked on its own scale.
 * That is why the component stores hue, saturation, value and alpha rather
 * than the string it hands back — a fully black colour is `#000` whatever hue
 * and saturation produced it, so a picker that stored the output would lose
 * the thumb the moment you dragged into a corner and could not put it back.
 *
 * Nothing about a drag crosses to JavaScript. The four channels are shared
 * values; the hue behind the square, both thumb fills and the preview swatch
 * are `backgroundColor`s computed from them on the UI thread, and the
 * translucency ramp on the alpha track is a gradient used as a mask over a
 * solid fill rather than a gradient whose colours have to be re-declared from
 * React on every frame. The picked colour bridges back on change and again on
 * release, the same as any other input here.
 *
 * ```tsx
 * <ColorPicker defaultValue="#22c55e" onValueCommit={setBrand}>
 *   <ColorPicker.Area />
 *   <ColorPicker.Hue />
 *   <ColorPicker.Preview showValue />
 * </ColorPicker>
 * ```
 *
 * Composition is the API: a picker is whichever of the parts you put in it, so
 * a control with no alpha is one that has no `ColorPicker.Alpha`, not one with
 * a prop turned off.
 *
 * Works controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`).
 */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { tv, type VariantProps } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { useDirectionSign } from '../../hooks/use-direction';
import { Text } from '../../primitives/text';
import {
  formatColor,
  hsvToCss,
  hsvToHex,
  parseColor,
  type ColorFormat,
  type HsvaColor,
} from '../../utils/color';
import { selectionTick } from '../../utils/haptics';

/** Settles a thumb that was moved by something other than a finger. */
const TIMING = { duration: 140 } as const;

/**
 * The hue scale, drawn once as a gradient rather than sampled per pixel. Six
 * stops plus the wrap back to red — fewer would bend the ramp, more would not
 * change it, because hue is piecewise linear in RGB and these are the corners.
 */
const HUE_STOPS: readonly [string, string, ...string[]] = [
  '#ff0000',
  '#ffff00',
  '#00ff00',
  '#00ffff',
  '#0000ff',
  '#ff00ff',
  '#ff0000',
];

/** The same ramp for a right-to-left picker, where hue runs the other way. */
const HUE_STOPS_FLIPPED = [...HUE_STOPS].reverse() as unknown as readonly [
  string,
  string,
  ...string[],
];

/** How far one screen-reader increment moves a channel. */
const NUDGE = 0.05;
/** How far one screen-reader increment moves the hue, in degrees. */
const HUE_NUDGE = 10;

const colorPickerVariants = tv({
  slots: {
    root: 'w-full gap-3',
    area: 'overflow-hidden rounded-xl border border-border',
    // Both thumbs are a white ring around a fill of the colour under them, so
    // the ring reads against the dark end of the square as well as the light.
    thumb: 'absolute start-0 top-0 rounded-full border-[3px] border-white shadow-md',
    thumbFill: 'flex-1 rounded-full',
    track: 'w-full overflow-hidden rounded-full border border-border',
    swatches: 'flex-row flex-wrap items-center gap-2',
    swatch: 'items-center justify-center rounded-full',
    swatchRing: 'absolute rounded-full border-2 border-foreground',
    preview: 'flex-row items-center gap-3',
    previewSwatch: 'overflow-hidden rounded-full border border-border',
    previewValue: 'text-sm font-medium text-foreground',
  },
  variants: {
    size: {
      sm: {},
      md: {},
      lg: {},
    },
    disabled: {
      true: { root: 'opacity-50' },
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

type ColorPickerVariantProps = VariantProps<typeof colorPickerVariants>;
export type ColorPickerSize = NonNullable<ColorPickerVariantProps['size']>;

/** Height of the saturation/brightness square, per size. */
const AREA_HEIGHT: Record<ColorPickerSize, number> = { sm: 140, md: 180, lg: 220 };
/** Height of a channel track, per size. */
const TRACK_HEIGHT: Record<ColorPickerSize, number> = { sm: 14, md: 18, lg: 22 };
/** Thumb diameter on a channel track — wider than the track, so it reads as a knob. */
const TRACK_THUMB: Record<ColorPickerSize, number> = { sm: 22, md: 26, lg: 30 };
/** Thumb diameter on the square. */
const AREA_THUMB: Record<ColorPickerSize, number> = { sm: 20, md: 24, lg: 28 };
/** Preset swatch diameter. */
const SWATCH: Record<ColorPickerSize, number> = { sm: 26, md: 30, lg: 34 };
/** The swatch beside the value in `Preview`. */
const PREVIEW_SWATCH: Record<ColorPickerSize, number> = { sm: 28, md: 36, lg: 44 };

interface ColorPickerContextValue {
  hue: SharedValue<number>;
  saturation: SharedValue<number>;
  brightness: SharedValue<number>;
  opacity: SharedValue<number>;
  /** Called from a worklet with the channels that produced the change. */
  emit: (h: number, s: number, v: number, a: number, commit: boolean) => void;
  format: ColorFormat;
  disabled: boolean;
  haptics: boolean;
  size: ColorPickerSize;
}

const ColorPickerContext = createContext<ColorPickerContextValue | null>(null);

function useColorPicker(part: string) {
  const ctx = useContext(ColorPickerContext);
  if (!ctx) throw new Error(`${part} must be used inside <ColorPicker>.`);
  return ctx;
}

/** Where a picker starts when it is handed a value it cannot read. */
const FALLBACK: HsvaColor = { h: 0, s: 1, v: 1, a: 1 };

export interface ColorPickerProps extends Omit<ColorPickerVariantProps, 'disabled'> {
  className?: string;
  /** Controlled colour. Leave unset and pass `defaultValue` to run uncontrolled. */
  value?: string;
  /** Starting colour when uncontrolled. */
  defaultValue?: string;
  /**
   * Fires on every frame of a drag — cheap updates only. The string is written
   * in `format`.
   */
  onValueChange?: (color: string) => void;
  /** Fires once when a drag ends. The place for expensive side effects. */
  onValueCommit?: (color: string) => void;
  /**
   * How the colour is written on the way out. `hex` gains an `#rrggbbaa` alpha
   * pair, and the other two switch to their `a` forms, only when the colour is
   * actually translucent.
   */
  format?: ColorFormat;
  disabled?: boolean;
  /**
   * A tick when a drag ends and when a preset is picked. Off by default — needs
   * the optional `expo-haptics`, and is silent without it. There is no tick
   * during a drag: a colour has no steps to cross, so a tick could only be a
   * buzz proportional to speed.
   */
  haptics?: boolean;
  /** The parts, in the order they should stack. */
  children: ReactNode;
}

const ColorPickerRoot = forwardRef<View, ColorPickerProps>(
  (
    {
      className,
      value: valueProp,
      defaultValue = '#ff0000',
      onValueChange,
      onValueCommit,
      format = 'hex',
      disabled = false,
      haptics = false,
      size = 'md',
      children,
    },
    ref
  ) => {
    const slots = colorPickerVariants({ size, disabled });

    // Parsed once. After this the channels are the truth and the prop is only
    // consulted when it changes to something we did not ourselves emit.
    const initial = useMemo(
      () => parseColor(valueProp ?? defaultValue) ?? FALLBACK,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    );

    const hue = useSharedValue(initial.h);
    const saturation = useSharedValue(initial.s);
    const brightness = useSharedValue(initial.v);
    const opacity = useSharedValue(initial.a);

    const changeRef = useRef(onValueChange);
    changeRef.current = onValueChange;
    const commitRef = useRef(onValueCommit);
    commitRef.current = onValueCommit;
    const formatRef = useRef(format);
    formatRef.current = format;

    /*
     * The last string this picker produced. A controlled parent hands it
     * straight back, and re-parsing it into the channels mid-drag would fight
     * the finger: the round trip is lossy at the edges of the square, so the
     * thumb would be pulled a pixel back on every frame.
     */
    const lastEmitted = useRef<string | null>(null);

    const emit = useCallback((h: number, s: number, v: number, a: number, commit: boolean) => {
      const next = formatColor({ h, s, v, a }, formatRef.current);
      lastEmitted.current = next;
      changeRef.current?.(next);
      if (commit) commitRef.current?.(next);
    }, []);

    // Keep the channels in step with a controlled value changed elsewhere. Set
    // rather than animated: an external change is not a gesture, and springing
    // the hue from 350° to 10° would run the long way round the wheel.
    useEffect(() => {
      if (valueProp === undefined) return;
      if (valueProp === lastEmitted.current) return;
      const parsed = parseColor(valueProp);
      if (!parsed) return;
      hue.value = parsed.h;
      saturation.value = parsed.s;
      brightness.value = parsed.v;
      opacity.value = parsed.a;
    }, [valueProp, hue, saturation, brightness, opacity]);

    const context = useMemo<ColorPickerContextValue>(
      () => ({
        hue,
        saturation,
        brightness,
        opacity,
        emit,
        format,
        disabled,
        haptics,
        size: size ?? 'md',
      }),
      [hue, saturation, brightness, opacity, emit, format, disabled, haptics, size]
    );

    return (
      <ColorPickerContext.Provider value={context}>
        <View ref={ref} className={slots.root({ className })} collapsable={false}>
          {children}
        </View>
      </ColorPickerContext.Provider>
    );
  }
);

ColorPickerRoot.displayName = 'ColorPicker';

/* ------------------------------------------------------------------ *
 * The checkerboard behind anything translucent.
 * ------------------------------------------------------------------ */

/**
 * The "nothing here" backing. A tiled SVG pattern rather than a grid of views:
 * a 340-point track at eight-point squares is 170 squares, and every one of
 * them would be a view laid out by Yoga on the frame the picker mounts.
 */
function Checkerboard({ square = 7 }: { square?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  // The pattern is themed rather than the usual grey-on-white: a checkerboard
  // is a statement that there is nothing there, and "nothing" is the page.
  const light = String(useCSSVariable('--color-background') ?? '#ffffff');
  const dark = String(useCSSVariable('--color-muted') ?? '#e5e5e5');

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id={id}
          width={square * 2}
          height={square * 2}
          patternUnits="userSpaceOnUse"
        >
          <Rect width={square * 2} height={square * 2} fill={light} />
          <Rect width={square} height={square} fill={dark} />
          <Rect x={square} y={square} width={square} height={square} fill={dark} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ *
 * Area — saturation across, brightness up.
 * ------------------------------------------------------------------ */

export interface ColorPickerAreaProps {
  className?: string;
  /** Height of the square in points. Defaults to the picker's size. */
  height?: number;
  /** Extra classes for the draggable thumb. */
  thumbClassName?: string;
}

const ColorPickerArea = forwardRef<View, ColorPickerAreaProps>(
  ({ className, height, thumbClassName }, ref) => {
    const ctx = useColorPicker('ColorPicker.Area');
    const slots = colorPickerVariants({ size: ctx.size });
    const sign = useDirectionSign();

    const boxHeight = height ?? AREA_HEIGHT[ctx.size];
    const thumbSize = AREA_THUMB[ctx.size];
    const width = useSharedValue(0);

    /*
     * The screen reader's copy of the value. Updated when a drag ends rather
     * than while it runs: a `now` that re-rendered on every frame would be a
     * hundred announcements for one gesture, and nobody is listening to the
     * middle of a drag.
     */
    const [announced, setAnnounced] = useState(() => ({
      s: ctx.saturation.value,
      v: ctx.brightness.value,
    }));

    const settle = useCallback((s: number, v: number) => {
      setAnnounced({ s, v });
    }, []);

    const apply = (x: number, y: number, commit: boolean) => {
      'worklet';
      const w = Math.max(width.value, 1);
      // `x` is measured from the physical left edge either way, so a
      // right-to-left picker counts saturation back from the far side.
      const along = sign === 1 ? x : w - x;
      const s = Math.min(Math.max(along / w, 0), 1);
      const v = 1 - Math.min(Math.max(y / boxHeight, 0), 1);
      ctx.saturation.value = s;
      ctx.brightness.value = v;
      runOnJS(ctx.emit)(ctx.hue.value, s, v, ctx.opacity.value, commit);
      if (commit) {
        runOnJS(settle)(s, v);
        if (ctx.haptics) runOnJS(selectionTick)();
      }
    };

    // Both axes belong to the square, so it takes the gesture on touch-down
    // rather than after a threshold — a pad that needed ten points of travel
    // before it responded would feel broken.
    const pan = Gesture.Pan()
      .enabled(!ctx.disabled)
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((event) => apply(event.x, event.y, false))
      .onUpdate((event) => apply(event.x, event.y, false))
      .onFinalize((event) => apply(event.x, event.y, true));

    const hueStyle = useAnimatedStyle(() => ({
      backgroundColor: hsvToCss(ctx.hue.value, 1, 1, 1),
    }));

    const thumbStyle = useAnimatedStyle(() => {
      // A transform is not laid out, so Yoga does not mirror it — the thumb
      // has to travel the other way itself.
      const along = ctx.saturation.value * width.value - thumbSize / 2;
      return {
        transform: [
          { translateX: along * sign },
          { translateY: (1 - ctx.brightness.value) * boxHeight - thumbSize / 2 },
        ],
      };
    });

    const thumbFillStyle = useAnimatedStyle(() => ({
      backgroundColor: hsvToCss(
        ctx.hue.value,
        ctx.saturation.value,
        ctx.brightness.value,
        1
      ),
    }));

    const nudge = (channel: 'saturation' | 'brightness', dir: 1 | -1) => {
      const next = Math.min(Math.max(ctx[channel].value + dir * NUDGE, 0), 1);
      ctx[channel].value = withTiming(next, TIMING);
      const s = channel === 'saturation' ? next : ctx.saturation.value;
      const v = channel === 'brightness' ? next : ctx.brightness.value;
      settle(s, v);
      ctx.emit(ctx.hue.value, s, v, ctx.opacity.value, true);
    };

    const onAccessibilityAction = (event: AccessibilityActionEvent) => {
      const action = event.nativeEvent.actionName;
      if (action === 'increment') nudge('saturation', 1);
      else if (action === 'decrement') nudge('saturation', -1);
      else if (action === 'brighter') nudge('brightness', 1);
      else if (action === 'darker') nudge('brightness', -1);
    };

    return (
      <GestureDetector gesture={pan}>
        {/* The outer box is not clipped, so the thumb can sit centred on a
            colour at the very edge of the square instead of being pushed
            inside it. Only the gradients below are clipped to the radius. */}
        <View
          ref={ref}
          style={{ height: boxHeight }}
          className="w-full"
          onLayout={(event: LayoutChangeEvent) => {
            width.value = event.nativeEvent.layout.width;
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Saturation and brightness"
          accessibilityState={{ disabled: ctx.disabled }}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(announced.s * 100),
            text: `${Math.round(announced.s * 100)}% saturation, ${Math.round(
              announced.v * 100
            )}% brightness`,
          }}
          accessibilityActions={[
            { name: 'increment' },
            { name: 'decrement' },
            { name: 'brighter', label: 'Brighter' },
            { name: 'darker', label: 'Darker' },
          ]}
          onAccessibilityAction={onAccessibilityAction}
        >
          <View style={StyleSheet.absoluteFill} className={slots.area({ className })}>
            <Animated.View style={[StyleSheet.absoluteFill, hueStyle]} />
            <LinearGradient
              colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
              start={{ x: sign === 1 ? 0 : 1, y: 0.5 }}
              end={{ x: sign === 1 ? 1 : 0, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <Animated.View
            pointerEvents="none"
            style={[thumbStyle, { width: thumbSize, height: thumbSize }]}
            className={slots.thumb({ className: thumbClassName })}
          >
            <Animated.View style={thumbFillStyle} className={slots.thumbFill()} />
          </Animated.View>
        </View>
      </GestureDetector>
    );
  }
);

ColorPickerArea.displayName = 'ColorPicker.Area';

/* ------------------------------------------------------------------ *
 * The two channel tracks share everything but what is drawn in them.
 * ------------------------------------------------------------------ */

interface ChannelTrackProps {
  /** What fills the track — a hue ramp, or a masked translucency ramp. */
  children: ReactNode;
  gesture: ReturnType<typeof Gesture.Race>;
  thumbStyle: ReturnType<typeof useAnimatedStyle>;
  thumbFillStyle: ReturnType<typeof useAnimatedStyle>;
  onLayout: (event: LayoutChangeEvent) => void;
  size: ColorPickerSize;
  className?: string;
  thumbClassName?: string;
  label: string;
  disabled: boolean;
  accessibilityValue: { min: number; max: number; now: number; text: string };
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
  innerRef: React.ForwardedRef<View>;
}

function ChannelTrack({
  children,
  gesture,
  thumbStyle,
  thumbFillStyle,
  onLayout,
  size,
  className,
  thumbClassName,
  label,
  disabled,
  accessibilityValue,
  onAccessibilityAction,
  innerRef,
}: ChannelTrackProps) {
  const slots = colorPickerVariants({ size });
  const trackHeight = TRACK_HEIGHT[size];
  const thumbSize = TRACK_THUMB[size];

  return (
    <GestureDetector gesture={gesture}>
      {/* The row is as tall as the thumb so an overhanging knob has somewhere
          to be drawn whole; the track inside it is the shorter, clipped part. */}
      <View
        ref={innerRef}
        style={{ height: thumbSize }}
        className="w-full justify-center"
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityValue={accessibilityValue}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
      >
        <View style={{ height: trackHeight }} className={slots.track({ className })}>
          {children}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[thumbStyle, { width: thumbSize, height: thumbSize }]}
          className={slots.thumb({ className: thumbClassName })}
        >
          <Animated.View style={thumbFillStyle} className={slots.thumbFill()} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/**
 * Maps a touch anywhere on a track to a fraction of it, accounting for the
 * thumb's own width: the thumb travels between the two edges rather than off
 * them, so the usable run is the track minus one thumb.
 */
function trackFraction(x: number, width: number, thumbSize: number, sign: number) {
  'worklet';
  const along = sign === 1 ? x : width - x;
  const travel = Math.max(width - thumbSize, 1);
  return Math.min(Math.max((along - thumbSize / 2) / travel, 0), 1);
}

/* ------------------------------------------------------------------ *
 * Hue.
 * ------------------------------------------------------------------ */

export interface ColorPickerHueProps {
  className?: string;
  /** Extra classes for the draggable thumb. */
  thumbClassName?: string;
}

const ColorPickerHue = forwardRef<View, ColorPickerHueProps>(
  ({ className, thumbClassName }, ref) => {
    const ctx = useColorPicker('ColorPicker.Hue');
    const sign = useDirectionSign();
    const thumbSize = TRACK_THUMB[ctx.size];
    const width = useSharedValue(0);
    const [announced, setAnnounced] = useState(() => Math.round(ctx.hue.value));

    const settle = useCallback((h: number) => setAnnounced(Math.round(h)), []);

    const apply = (x: number, commit: boolean) => {
      'worklet';
      const h = trackFraction(x, width.value, thumbSize, sign) * 360;
      ctx.hue.value = h;
      runOnJS(ctx.emit)(
        h,
        ctx.saturation.value,
        ctx.brightness.value,
        ctx.opacity.value,
        commit
      );
      if (commit) {
        runOnJS(settle)(h);
        if (ctx.haptics) runOnJS(selectionTick)();
      }
    };

    /*
     * A thin horizontal control inside a scroller: the pan waits for six points
     * of sideways travel so a vertical flick starting on the track still
     * scrolls the page, and the tap handles the case where there was no travel
     * at all.
     */
    const pan = Gesture.Pan()
      .enabled(!ctx.disabled)
      .activeOffsetX([-6, 6])
      .shouldCancelWhenOutside(false)
      .onUpdate((event) => apply(event.x, false))
      .onFinalize((event) => apply(event.x, true));

    const tap = Gesture.Tap()
      .enabled(!ctx.disabled)
      .maxDuration(250)
      .onEnd((event) => apply(event.x, true));

    const gesture = Gesture.Race(pan, tap);

    const thumbStyle = useAnimatedStyle(() => {
      const travel = Math.max(width.value - thumbSize, 0);
      return { transform: [{ translateX: (ctx.hue.value / 360) * travel * sign }] };
    });

    const thumbFillStyle = useAnimatedStyle(() => ({
      backgroundColor: hsvToCss(ctx.hue.value, 1, 1, 1),
    }));

    const nudge = (dir: 1 | -1) => {
      const next = Math.min(Math.max(ctx.hue.value + dir * HUE_NUDGE, 0), 360);
      ctx.hue.value = withTiming(next, TIMING);
      settle(next);
      ctx.emit(next, ctx.saturation.value, ctx.brightness.value, ctx.opacity.value, true);
    };

    return (
      <ChannelTrack
        innerRef={ref}
        gesture={gesture}
        thumbStyle={thumbStyle}
        thumbFillStyle={thumbFillStyle}
        onLayout={(event) => {
          width.value = event.nativeEvent.layout.width;
        }}
        size={ctx.size}
        className={className}
        thumbClassName={thumbClassName}
        label="Hue"
        disabled={ctx.disabled}
        accessibilityValue={{ min: 0, max: 360, now: announced, text: `${announced}°` }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') nudge(1);
          else if (event.nativeEvent.actionName === 'decrement') nudge(-1);
        }}
      >
        <LinearGradient
          colors={sign === 1 ? HUE_STOPS : HUE_STOPS_FLIPPED}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </ChannelTrack>
    );
  }
);

ColorPickerHue.displayName = 'ColorPicker.Hue';

/* ------------------------------------------------------------------ *
 * Alpha.
 * ------------------------------------------------------------------ */

export interface ColorPickerAlphaProps {
  className?: string;
  /** Extra classes for the draggable thumb. */
  thumbClassName?: string;
}

const ColorPickerAlpha = forwardRef<View, ColorPickerAlphaProps>(
  ({ className, thumbClassName }, ref) => {
    const ctx = useColorPicker('ColorPicker.Alpha');
    const sign = useDirectionSign();
    const thumbSize = TRACK_THUMB[ctx.size];
    const width = useSharedValue(0);
    const [announced, setAnnounced] = useState(() => Math.round(ctx.opacity.value * 100));

    const settle = useCallback((a: number) => setAnnounced(Math.round(a * 100)), []);

    const apply = (x: number, commit: boolean) => {
      'worklet';
      const a = trackFraction(x, width.value, thumbSize, sign);
      ctx.opacity.value = a;
      runOnJS(ctx.emit)(
        ctx.hue.value,
        ctx.saturation.value,
        ctx.brightness.value,
        a,
        commit
      );
      if (commit) {
        runOnJS(settle)(a);
        if (ctx.haptics) runOnJS(selectionTick)();
      }
    };

    const pan = Gesture.Pan()
      .enabled(!ctx.disabled)
      .activeOffsetX([-6, 6])
      .shouldCancelWhenOutside(false)
      .onUpdate((event) => apply(event.x, false))
      .onFinalize((event) => apply(event.x, true));

    const tap = Gesture.Tap()
      .enabled(!ctx.disabled)
      .maxDuration(250)
      .onEnd((event) => apply(event.x, true));

    const gesture = Gesture.Race(pan, tap);

    const thumbStyle = useAnimatedStyle(() => {
      const travel = Math.max(width.value - thumbSize, 0);
      return { transform: [{ translateX: ctx.opacity.value * travel * sign }] };
    });

    const solidStyle = useAnimatedStyle(() => ({
      backgroundColor: hsvToCss(
        ctx.hue.value,
        ctx.saturation.value,
        ctx.brightness.value,
        1
      ),
    }));

    const thumbFillStyle = useAnimatedStyle(() => ({
      backgroundColor: hsvToCss(
        ctx.hue.value,
        ctx.saturation.value,
        ctx.brightness.value,
        ctx.opacity.value
      ),
    }));

    const nudge = (dir: 1 | -1) => {
      const next = Math.min(Math.max(ctx.opacity.value + dir * NUDGE, 0), 1);
      ctx.opacity.value = withTiming(next, TIMING);
      settle(next);
      ctx.emit(ctx.hue.value, ctx.saturation.value, ctx.brightness.value, next, true);
    };

    return (
      <ChannelTrack
        innerRef={ref}
        gesture={gesture}
        thumbStyle={thumbStyle}
        thumbFillStyle={thumbFillStyle}
        onLayout={(event) => {
          width.value = event.nativeEvent.layout.width;
        }}
        size={ctx.size}
        className={className}
        thumbClassName={thumbClassName}
        label="Opacity"
        disabled={ctx.disabled}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: announced,
          text: `${announced}%`,
        }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') nudge(1);
          else if (event.nativeEvent.actionName === 'decrement') nudge(-1);
        }}
      >
        <Checkerboard />
        {/*
         * The ramp is a gradient used as a *mask* over a solid fill of the
         * current colour, not a gradient between a transparent and an opaque
         * copy of it. A gradient's colours are props, so the second form would
         * have to be re-declared from React on every frame of a drag on the
         * square above; the mask never changes, and only the fill under it does
         * — which is a `backgroundColor` the UI thread can write itself.
         */}
        <MaskedView
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          maskElement={
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
              start={{ x: sign === 1 ? 0 : 1, y: 0.5 }}
              end={{ x: sign === 1 ? 1 : 0, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          }
        >
          <Animated.View style={[StyleSheet.absoluteFill, solidStyle]} />
        </MaskedView>
      </ChannelTrack>
    );
  }
);

ColorPickerAlpha.displayName = 'ColorPicker.Alpha';

/* ------------------------------------------------------------------ *
 * Preview.
 * ------------------------------------------------------------------ */

export interface ColorPickerPreviewProps {
  className?: string;
  /**
   * Print the colour beside the swatch, in the picker's `format`. The string
   * is built on the UI thread and only crosses to JavaScript when it differs
   * from the last one, so a drag that is not changing the rounded value costs
   * nothing.
   */
  showValue?: boolean;
  /** Extra classes for the swatch. */
  swatchClassName?: string;
  /** Extra classes for the printed value. */
  valueClassName?: string;
  /** Anything to put after the value — a copy button, a label. */
  children?: ReactNode;
}

const ColorPickerPreview = forwardRef<View, ColorPickerPreviewProps>(
  ({ className, showValue = false, swatchClassName, valueClassName, children }, ref) => {
    const ctx = useColorPicker('ColorPicker.Preview');
    const slots = colorPickerVariants({ size: ctx.size });
    const diameter = PREVIEW_SWATCH[ctx.size];

    const [printed, setPrinted] = useState(() =>
      formatColor(
        {
          h: ctx.hue.value,
          s: ctx.saturation.value,
          v: ctx.brightness.value,
          a: ctx.opacity.value,
        },
        ctx.format
      )
    );

    const format = ctx.format;
    useAnimatedReaction(
      () =>
        formatColor(
          {
            h: ctx.hue.value,
            s: ctx.saturation.value,
            v: ctx.brightness.value,
            a: ctx.opacity.value,
          },
          format
        ),
      (current, previous) => {
        if (current !== previous) runOnJS(setPrinted)(current);
      },
      [format]
    );

    const fillStyle = useAnimatedStyle(() => ({
      backgroundColor: hsvToCss(
        ctx.hue.value,
        ctx.saturation.value,
        ctx.brightness.value,
        ctx.opacity.value
      ),
    }));

    return (
      <View ref={ref} className={slots.preview({ className })}>
        <View
          style={{ width: diameter, height: diameter }}
          className={slots.previewSwatch({ className: swatchClassName })}
        >
          <Checkerboard square={5} />
          <Animated.View style={[StyleSheet.absoluteFill, fillStyle]} />
        </View>
        {showValue ? (
          <Text className={slots.previewValue({ className: valueClassName })}>
            {printed}
          </Text>
        ) : null}
        {children}
      </View>
    );
  }
);

ColorPickerPreview.displayName = 'ColorPicker.Preview';

/* ------------------------------------------------------------------ *
 * Swatches.
 * ------------------------------------------------------------------ */

export interface ColorPickerSwatchesProps {
  className?: string;
  /** The presets, in any format `ColorPicker` can read. */
  colors: string[];
  /** Diameter of one swatch in points. Defaults to the picker's size. */
  swatchSize?: number;
  /** Extra classes for one swatch. */
  swatchClassName?: string;
}

const ColorPickerSwatches = forwardRef<View, ColorPickerSwatchesProps>(
  ({ className, colors, swatchSize, swatchClassName }, ref) => {
    const ctx = useColorPicker('ColorPicker.Swatches');
    const slots = colorPickerVariants({ size: ctx.size });
    const diameter = swatchSize ?? SWATCH[ctx.size];

    // Unreadable strings are dropped here rather than rendered as black: a row
    // of presets with a mystery black one in it is worse than a shorter row.
    const parsed = useMemo(
      () =>
        colors
          .map((raw) => ({ raw, color: parseColor(raw) }))
          .filter((entry): entry is { raw: string; color: HsvaColor } => entry.color !== null),
      [colors]
    );

    return (
      <View ref={ref} className={slots.swatches({ className })}>
        {parsed.map((entry, index) => (
          <Swatch
            key={`${entry.raw}-${index}`}
            color={entry.color}
            diameter={diameter}
            className={swatchClassName}
            ctx={ctx}
            slots={slots}
          />
        ))}
      </View>
    );
  }
);

ColorPickerSwatches.displayName = 'ColorPicker.Swatches';

function Swatch({
  color,
  diameter,
  className,
  ctx,
  slots,
}: {
  color: HsvaColor;
  diameter: number;
  className?: string;
  ctx: ColorPickerContextValue;
  slots: ReturnType<typeof colorPickerVariants>;
}) {
  const hex = hsvToHex(color.h, color.s, color.v, color.a);

  /*
   * Selected is an exact match on the written colour rather than a distance
   * between two sets of channels. A near-black has an arbitrary hue and a
   * meaningless saturation, so a per-channel comparison marks two visually
   * identical blacks as different and two different hues of black as the same.
   */
  const ringStyle = useAnimatedStyle(() => {
    const current = hsvToHex(
      ctx.hue.value,
      ctx.saturation.value,
      ctx.brightness.value,
      ctx.opacity.value
    );
    return { opacity: withTiming(current === hex ? 1 : 0, { duration: 120 }) };
  });

  const onPress = () => {
    ctx.hue.value = color.h;
    ctx.saturation.value = color.s;
    ctx.brightness.value = color.v;
    ctx.opacity.value = color.a;
    ctx.emit(color.h, color.s, color.v, color.a, true);
    if (ctx.haptics) selectionTick();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={ctx.disabled}
      accessibilityRole="button"
      accessibilityLabel={hex}
      style={{ width: diameter, height: diameter }}
      className={slots.swatch({ className })}
    >
      <View
        style={{ width: diameter, height: diameter }}
        className="absolute overflow-hidden rounded-full"
      >
        {color.a < 1 ? <Checkerboard square={4} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: hex }]} />
      </View>
      {/* The ring sits outside the fill, so a swatch the same colour as the
          page still reads as selected. */}
      <Animated.View
        pointerEvents="none"
        style={[ringStyle, { width: diameter + 6, height: diameter + 6 }]}
        className={slots.swatchRing()}
      />
    </Pressable>
  );
}

export const ColorPicker = Object.assign(ColorPickerRoot, {
  Area: ColorPickerArea,
  Hue: ColorPickerHue,
  Alpha: ColorPickerAlpha,
  Preview: ColorPickerPreview,
  Swatches: ColorPickerSwatches,
});
