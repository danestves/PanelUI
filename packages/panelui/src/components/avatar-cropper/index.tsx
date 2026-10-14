/**
 * AvatarCropper — frame a photo under a circle, and get that circle back as an
 * image.
 *
 * ```tsx
 * const cropper = useRef<AvatarCropperHandle>(null);
 *
 * <AvatarCropper ref={cropper} source={photo} className="flex-1">
 *   <AvatarCropper.Canvas />
 *   <View className="flex-row justify-between p-4">
 *     <AvatarCropper.Reset />
 *     <AvatarCropper.Rotate />
 *   </View>
 * </AvatarCropper>
 *
 * const { uri } = await cropper.current!.crop({ size: 512 });
 * ```
 *
 * ## The mask stays put; the photo moves
 *
 * The mask sits in the middle of the canvas and never moves. Dragging, pinching
 * and turning all move the photo underneath it, which is what makes the result
 * predictable: the image you get back is exactly what is inside the outline
 * when you press Done. The photo is never allowed to leave part of the mask
 * empty — let go past an edge, or zoom out too far, and it springs back to the
 * nearest position that covers it. At an angle that takes extra zoom for a
 * square mask, whose corners reach further than a circle does, so the minimum
 * zoom follows the angle.
 *
 * ## One surface, three gestures at once
 *
 * Pan, pinch and rotation are recognised together, so a two-finger gesture can
 * move, zoom and turn in one motion the way a photo on a table would. Zoom and
 * turn happen about the point between the fingers, which keeps whatever is
 * under them under them.
 *
 * ## The export is the same arithmetic, in pixels
 *
 * `crop()` turns the source by the photo's angle, cuts the square the mask
 * covers and scales it to the size asked for, through the optional
 * `expo-image-manipulator`. The source is redrawn upright first: a camera photo
 * often stores its orientation as a flag rather than in its pixels, and the
 * turn and the cut both work on the raw pixels. `getCrop()` returns the same
 * rectangle without any dependency, for an app that crops on its server.
 */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import {
  Image,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type ViewProps,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { RotateSquareIcon } from '../../icons';
import { cn } from '../../utils/cn';
import { Button, type ButtonProps } from '../button';
import {
  IDENTITY,
  baseSize,
  maskPath,
  nextQuarterTurn,
  normalizeDegrees,
  present,
  rotateAbout,
  settle,
  sourceCrop,
  zoomAbout,
  type CropFrame,
  type CropShape,
  type CropState,
  type Size,
  type SourceCrop,
} from './avatar-cropper-math';

export type { CropShape as AvatarCropperShape, SourceCrop as AvatarCrop };

/** Where the photo settles after a gesture. Firm, so it lands without drifting. */
const SETTLE_SPRING = { damping: 34, stiffness: 320, mass: 1 } as const;

/** A quarter turn from the button. Long enough to read as a turn, not a jump. */
const TURN_DURATION = 260;

/** How far an accessibility zoom step goes. */
const ZOOM_STEP = 1.25;

/** How far a raw gesture may run past a bound before the rubber band stops it. */
const OVERSHOOT = 2;

// ---------------------------------------------------------------------------
// Optional dependencies
// ---------------------------------------------------------------------------

interface ManipulatorContext {
  resize(size: { width?: number; height?: number }): ManipulatorContext;
  rotate(degrees: number): ManipulatorContext;
  crop(rect: { originX: number; originY: number; width: number; height: number }): ManipulatorContext;
  renderAsync(): Promise<{
    saveAsync(options: { format?: string; compress?: number }): Promise<AvatarCropResult>;
  }>;
}

interface ManipulatorModule {
  ImageManipulator?: { manipulate(uri: string): ManipulatorContext };
}

interface PickerAsset {
  uri: string;
  width: number;
  height: number;
}

interface PickerModule {
  requestCameraPermissionsAsync(): Promise<{ granted: boolean }>;
  launchCameraAsync(options: unknown): Promise<{ canceled: boolean; assets?: PickerAsset[] | null }>;
  launchImageLibraryAsync(
    options: unknown
  ): Promise<{ canceled: boolean; assets?: PickerAsset[] | null }>;
}

/**
 * `expo-image-manipulator`, or null when it is not installed. Each `require`
 * sits directly in its `try` block, which is what lets Metro bundle an app
 * that does not have the package.
 */
function loadManipulator(): ManipulatorModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-manipulator') as ManipulatorModule;
  } catch {
    return null;
  }
}

/** `expo-image-picker`, or null when it is not installed. */
function loadPicker(): PickerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-picker') as PickerModule;
  } catch {
    return null;
  }
}

/** True when `crop()` can write an image, because `expo-image-manipulator` is installed. */
export const hasAvatarCropperExport = loadManipulator()?.ImageManipulator != null;

/** A photo to crop, as the picker returns it. */
export interface AvatarCropperSource {
  /** A local file or `data:` URI. */
  uri: string;
  /** Width in pixels, upright. Measured from the image when left out. */
  width?: number;
  /** Height in pixels, upright. Measured from the image when left out. */
  height?: number;
}

export interface PickAvatarImageOptions {
  /** Where the photo comes from. Default `'library'`. */
  from?: 'library' | 'camera';
  /** JPEG quality of the picked photo, 0–1. Default 1, since the crop compresses it again. */
  quality?: number;
}

/**
 * Let the user choose a photo or take one, ready to pass to `AvatarCropper`.
 *
 * Resolves `null` when the user cancels. Taking a photo asks for camera
 * permission first and throws when it is refused, so the app can explain why
 * nothing happened. Choosing from the library needs no permission. The
 * picker's own editing is left off, because the cropper is the editor.
 *
 * Needs the optional `expo-image-picker`, and throws if it is not installed.
 * In a development build the camera also needs the permission strings from
 * that package's config plugin.
 */
export async function pickAvatarImage({
  from = 'library',
  quality = 1,
}: PickAvatarImageOptions = {}): Promise<Required<AvatarCropperSource> | null> {
  const picker = loadPicker();
  if (!picker) {
    throw new Error(
      'pickAvatarImage needs expo-image-picker. Install it with: npx expo install expo-image-picker'
    );
  }
  const options = { mediaTypes: ['images'], allowsEditing: false, quality, exif: false };
  let result: Awaited<ReturnType<PickerModule['launchImageLibraryAsync']>>;
  if (from === 'camera') {
    const permission = await picker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('pickAvatarImage: camera permission was refused.');
    result = await picker.launchCameraAsync(options);
  } else {
    result = await picker.launchImageLibraryAsync(options);
  }
  const asset = result.canceled ? undefined : result.assets?.[0];
  return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export interface AvatarCropResult {
  /** The cropped image, written to the app's cache directory. */
  uri: string;
  width: number;
  height: number;
}

export interface AvatarCropOptions {
  /**
   * Side of the image to write, in pixels. Default 1024. A crop with fewer
   * pixels than this is written at its own size rather than scaled up.
   */
  size?: number;
  /** Default `'jpeg'`. Use `'png'` to keep transparency out of the question entirely. */
  format?: 'jpeg' | 'png' | 'webp';
  /** Quality, 0–1, for JPEG and WebP. Default 0.9. */
  compress?: number;
}

export interface AvatarCropperHandle {
  /**
   * Write what the mask covers to a new square image. The image is square for
   * every shape; draw it in a round `Avatar` to show it as a circle.
   *
   * Needs the optional `expo-image-manipulator`, and throws if it is not
   * installed — use `getCrop()` then.
   */
  crop(options?: AvatarCropOptions): Promise<AvatarCropResult>;
  /**
   * The rectangle the mask covers, in the source's pixels, after turning the
   * source by `rotation` degrees clockwise. Null until the photo has been
   * measured and laid out.
   */
  getCrop(): SourceCrop | null;
  /** Turn a quarter clockwise, or a quarter back with `-1`. */
  rotate(direction?: 1 | -1): void;
  /** Back to the photo centred, unzoomed and upright. */
  reset(): void;
}

export interface AvatarCropperProps extends ViewProps {
  /** The photo. Changing it starts the crop again from the centre. */
  source: AvatarCropperSource;
  /**
   * The outline the photo is framed in. Default `'circle'`, which is how
   * `Avatar` draws it. The image written out is square for every shape.
   */
  shape?: CropShape;
  /** How far the photo can be zoomed past filling the mask. Default 5. */
  maxZoom?: number;
  /** Space between the mask and the canvas's shorter side, in points. Default 24. */
  inset?: number;
  className?: string;
  /** `AvatarCropper.Canvas` and any controls. Left out, the canvas alone. */
  children?: ReactNode;
}

interface CropperContextValue {
  shape: CropShape;
  maxZoom: number;
  inset: number;
  source: AvatarCropperSource;
  /** The source's upright size, once known. */
  sourceSize: Size | null;
  frame: CropFrame | null;
  setCanvas(size: Size): void;
  canvas: Size | null;
  x: SharedValue<number>;
  y: SharedValue<number>;
  scale: SharedValue<number>;
  rotation: SharedValue<number>;
  settleNow(): void;
  rotate(direction?: 1 | -1): void;
  reset(): void;
  zoomBy(factor: number): void;
  /** A spoken summary of the crop, refreshed when a gesture settles. */
  summary: string;
}

const CropperContext = createContext<CropperContextValue | null>(null);

function useCropper(part: string): CropperContextValue {
  const context = useContext(CropperContext);
  if (!context) throw new Error(`${part} must be rendered inside <AvatarCropper>.`);
  return context;
}

function describe(state: CropState): string {
  const zoom = `${Math.round(state.scale * 100)}% zoom`;
  const angle = Math.round(normalizeDegrees(state.rotation));
  return angle === 0 ? zoom : `${zoom}, turned ${angle} degrees`;
}

function AvatarCropperRoot(
  {
    source,
    shape = 'circle',
    maxZoom = 5,
    inset = 24,
    className,
    children,
    ...props
  }: AvatarCropperProps,
  ref: Ref<AvatarCropperHandle>
) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const [canvas, setCanvasState] = useState<Size | null>(null);
  const [measured, setMeasured] = useState<Size | null>(null);
  const [summary, setSummary] = useState(describe(IDENTITY));

  const { uri, width, height } = source;
  const sourceSize =
    width && height && width > 0 && height > 0 ? { width, height } : measured;

  // The picker reports the size; anything else is measured once per photo.
  useEffect(() => {
    setMeasured(null);
    if (width && height) return;
    let live = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (live) setMeasured({ width: w, height: h });
      },
      () => {}
    );
    return () => {
      live = false;
    };
  }, [uri, width, height]);

  // A new photo starts again from the centre.
  useEffect(() => {
    x.value = 0;
    y.value = 0;
    scale.value = 1;
    rotation.value = 0;
    setSummary(describe(IDENTITY));
  }, [uri, x, y, scale, rotation]);

  const mask = canvas ? Math.max(0, Math.min(canvas.width, canvas.height) - inset * 2) : 0;
  const frame = useMemo<CropFrame | null>(
    () => (sourceSize && mask > 0 ? { mask, image: baseSize(sourceSize, mask) } : null),
    [sourceSize?.width, sourceSize?.height, mask] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setCanvas = useCallback((size: Size) => {
    setCanvasState((current) =>
      current && current.width === size.width && current.height === size.height ? current : size
    );
  }, []);

  const read = useCallback(
    (): CropState => ({ x: x.value, y: y.value, scale: scale.value, rotation: rotation.value }),
    [x, y, scale, rotation]
  );

  /** Animate to a state, settled against the bounds first. */
  const animateTo = useCallback(
    (target: CropState, timed: boolean) => {
      if (!frame) return;
      const next = settle(target, shape, frame, maxZoom);
      const run = (value: number) =>
        timed ? withTiming(value, { duration: TURN_DURATION }) : withSpring(value, SETTLE_SPRING);
      x.value = run(next.x);
      y.value = run(next.y);
      scale.value = run(next.scale);
      rotation.value = run(next.rotation);
      setSummary(describe(next));
    },
    [frame, shape, maxZoom, x, y, scale, rotation]
  );

  const settleNow = useCallback(() => animateTo(read(), false), [animateTo, read]);

  const rotate = useCallback(
    (direction: 1 | -1 = 1) => {
      const current = read();
      const target = nextQuarterTurn(current.rotation, direction);
      // Turn about the mask, so what is in it stays in it.
      animateTo(rotateAbout(current, target - current.rotation, 0, 0), true);
    },
    [animateTo, read]
  );

  const reset = useCallback(() => {
    // Unwind to the nearest whole turn rather than spinning back through
    // every quarter turn taken to get here.
    const turns = Math.round(rotation.value / 360) * 360;
    animateTo({ ...IDENTITY, rotation: turns }, true);
  }, [animateTo, rotation]);

  const zoomBy = useCallback(
    (factor: number) => animateTo(zoomAbout(read(), factor, 0, 0), false),
    [animateTo, read]
  );

  const getCrop = useCallback((): SourceCrop | null => {
    if (!frame || !sourceSize) return null;
    return sourceCrop(settle(read(), shape, frame, maxZoom), frame, sourceSize);
  }, [frame, sourceSize, read, shape, maxZoom]);

  useImperativeHandle(
    ref,
    (): AvatarCropperHandle => ({
      getCrop,
      rotate,
      reset,
      async crop({ size = 1024, format = 'jpeg', compress = 0.9 } = {}) {
        const manipulator = loadManipulator()?.ImageManipulator;
        if (!manipulator) {
          throw new Error(
            'AvatarCropper.crop needs expo-image-manipulator. Install it with: ' +
              'npx expo install expo-image-manipulator — or use getCrop() to crop elsewhere.'
          );
        }
        const rect = getCrop();
        if (!rect || !sourceSize) {
          throw new Error('AvatarCropper.crop: the photo has not been measured and laid out yet.');
        }
        // Redraw upright first. The turn and the cut both read raw pixels,
        // and a camera photo often keeps its orientation in a flag instead.
        const context = manipulator.manipulate(uri).resize({ width: sourceSize.width });
        if (rect.rotation !== 0) context.rotate(rect.rotation);
        context.crop({
          originX: rect.originX,
          originY: rect.originY,
          width: rect.width,
          height: rect.height,
        });
        if (size < rect.width) context.resize({ width: size, height: size });
        const rendered = await context.renderAsync();
        return rendered.saveAsync({ format, compress });
      },
    }),
    [getCrop, rotate, reset, sourceSize, uri]
  );

  const value: CropperContextValue = {
    shape,
    maxZoom,
    inset,
    source,
    sourceSize,
    frame,
    canvas,
    setCanvas,
    x,
    y,
    scale,
    rotation,
    settleNow,
    rotate,
    reset,
    zoomBy,
    summary,
  };

  return (
    <CropperContext.Provider value={value}>
      <View className={cn('flex-1', className)} {...props}>
        {children ?? <AvatarCropperCanvas />}
      </View>
    </CropperContext.Provider>
  );
}

const AvatarCropperForwarded = forwardRef<AvatarCropperHandle, AvatarCropperProps>(
  AvatarCropperRoot
);
AvatarCropperForwarded.displayName = 'AvatarCropper';

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export interface AvatarCropperCanvasProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** What a screen reader calls the canvas. Default "Photo crop". */
  accessibilityLabel?: string;
}

/**
 * The photo under its mask, and the surface every gesture lands on. It fills
 * the space it is given, and the mask is drawn as large as the shorter side
 * allows, less the root's `inset`.
 */
function AvatarCropperCanvas({
  className,
  accessibilityLabel = 'Photo crop',
  onLayout,
  ...props
}: AvatarCropperCanvasProps) {
  const {
    shape,
    maxZoom,
    source,
    frame,
    canvas,
    setCanvas,
    x,
    y,
    scale,
    rotation,
    settleNow,
    rotate,
    zoomBy,
    summary,
  } = useCropper('AvatarCropper.Canvas');

  const scrimToken = useCSSVariable('--color-background');
  const ringToken = useCSSVariable('--color-foreground');
  const scrim = typeof scrimToken === 'string' ? scrimToken : '#0a0a0a';
  const ring = typeof ringToken === 'string' ? ringToken : '#fafafa';

  // How many of the three gestures are under way. The photo settles once the
  // last of them lets go, not each time one does.
  const active = useSharedValue(0);
  const W = canvas?.width ?? 0;
  const H = canvas?.height ?? 0;
  const image = frame?.image ?? { width: 0, height: 0 };
  const mask = frame?.mask ?? 0;

  const shown = useDerivedValue((): CropState => {
    const raw = { x: x.value, y: y.value, scale: scale.value, rotation: rotation.value };
    return frame ? present(raw, shape, frame, maxZoom) : raw;
  });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shown.value.x },
      { translateY: shown.value.y },
      { rotate: `${shown.value.rotation}deg` },
      { scale: shown.value.scale },
    ],
  }));

  const gesture = useMemo(() => {
    const begin = () => {
      'worklet';
      if (active.value === 0) {
        cancelAnimation(x);
        cancelAnimation(y);
        cancelAnimation(scale);
        cancelAnimation(rotation);
      }
      active.value += 1;
    };
    const end = () => {
      'worklet';
      active.value = Math.max(0, active.value - 1);
      if (active.value === 0) runOnJS(settleNow)();
    };
    /** Keep a raw value from running away while it is rubber-banded. */
    const bound = (state: CropState) => {
      'worklet';
      if (!frame) return state;
      const lowest = 1 / OVERSHOOT / 2;
      const next = { ...state, scale: Math.min(Math.max(state.scale, lowest), maxZoom * OVERSHOOT) };
      const limit = Math.max(image.width, image.height) * next.scale;
      next.x = Math.min(Math.max(next.x, -limit), limit);
      next.y = Math.min(Math.max(next.y, -limit), limit);
      return next;
    };
    const write = (state: CropState) => {
      'worklet';
      const next = bound(state);
      x.value = next.x;
      y.value = next.y;
      scale.value = next.scale;
      rotation.value = next.rotation;
    };
    const current = (): CropState => {
      'worklet';
      return { x: x.value, y: y.value, scale: scale.value, rotation: rotation.value };
    };

    const pan = Gesture.Pan()
      .averageTouches(true)
      .onBegin(() => {
        'worklet';
        begin();
      })
      .onChange((event) => {
        'worklet';
        const state = current();
        write({ ...state, x: state.x + event.changeX, y: state.y + event.changeY });
      })
      .onFinalize(() => {
        'worklet';
        end();
      });

    const pinch = Gesture.Pinch()
      .onBegin(() => {
        'worklet';
        begin();
      })
      .onChange((event) => {
        'worklet';
        write(zoomAbout(current(), event.scaleChange, event.focalX - W / 2, event.focalY - H / 2));
      })
      .onFinalize(() => {
        'worklet';
        end();
      });

    const turn = Gesture.Rotation()
      .onBegin(() => {
        'worklet';
        begin();
      })
      .onChange((event) => {
        'worklet';
        write(
          rotateAbout(
            current(),
            (event.rotationChange * 180) / Math.PI,
            event.anchorX - W / 2,
            event.anchorY - H / 2
          )
        );
      })
      .onFinalize(() => {
        'worklet';
        end();
      });

    return Gesture.Simultaneous(pan, pinch, turn);
  }, [active, x, y, scale, rotation, settleNow, frame, image.width, image.height, maxZoom, W, H]);

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      switch (event.nativeEvent.actionName) {
        case 'increment':
          zoomBy(ZOOM_STEP);
          break;
        case 'decrement':
          zoomBy(1 / ZOOM_STEP);
          break;
        case 'rotate':
          rotate(1);
          break;
      }
    },
    [zoomBy, rotate]
  );

  const handleLayout = useCallback(
    (event: Parameters<NonNullable<ViewProps['onLayout']>>[0]) => {
      const { width, height } = (event as LayoutChangeEvent).nativeEvent.layout;
      setCanvas({ width, height });
      onLayout?.(event);
    },
    [setCanvas, onLayout]
  );

  const outline = W > 0 && mask > 0 ? maskPath(shape, W / 2, H / 2, mask) : '';

  return (
    <GestureDetector gesture={gesture}>
      <View
        className={cn('flex-1 overflow-hidden bg-background', className)}
        onLayout={handleLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Drag to move the photo, pinch to zoom, and twist to turn it."
        accessibilityValue={{ text: summary }}
        accessibilityActions={[
          { name: 'increment', label: 'Zoom in' },
          { name: 'decrement', label: 'Zoom out' },
          { name: 'rotate', label: 'Rotate' },
        ]}
        onAccessibilityAction={onAccessibilityAction}
        {...props}
      >
        {frame && W > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: (W - image.width) / 2,
                top: (H - image.height) / 2,
                width: image.width,
                height: image.height,
              },
              imageStyle,
            ]}
          >
            <Image
              source={{ uri: source.uri }}
              style={{ width: image.width, height: image.height }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        ) : null}
        {outline ? (
          <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
            <Path
              d={`M0 0H${W}V${H}H0Z${outline}`}
              fill={scrim}
              fillOpacity={0.78}
              fillRule="evenodd"
            />
            <Path d={outline} fill="none" stroke={ring} strokeOpacity={0.9} strokeWidth={1.5} />
          </Svg>
        ) : null}
      </View>
    </GestureDetector>
  );
}
AvatarCropperCanvas.displayName = 'AvatarCropper.Canvas';

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export interface AvatarCropperRotateProps extends Omit<ButtonProps, 'onPress'> {
  /** Which way a press turns the photo. Default `'clockwise'`. */
  direction?: 'clockwise' | 'counterclockwise';
}

/** A quarter turn per press, about the middle of the mask. */
function AvatarCropperRotate({
  direction = 'clockwise',
  variant = 'secondary',
  size = 'icon',
  children,
  accessibilityLabel,
  ...props
}: AvatarCropperRotateProps) {
  const { rotate } = useCropper('AvatarCropper.Rotate');
  const clockwise = direction === 'clockwise';
  return (
    <Button
      variant={variant}
      size={size}
      accessibilityLabel={
        accessibilityLabel ?? (clockwise ? 'Rotate clockwise' : 'Rotate counterclockwise')
      }
      onPress={() => rotate(clockwise ? 1 : -1)}
      {...props}
    >
      {children ?? (
        <View style={clockwise ? undefined : { transform: [{ scaleX: -1 }] }}>
          <RotateSquareIcon size={20} />
        </View>
      )}
    </Button>
  );
}
AvatarCropperRotate.displayName = 'AvatarCropper.Rotate';

export type AvatarCropperResetProps = Omit<ButtonProps, 'onPress'>;

/** Back to the photo centred, unzoomed and upright. Labelled "Reset" unless given children. */
function AvatarCropperReset({
  variant = 'ghost',
  size = 'sm',
  children = 'Reset',
  ...props
}: AvatarCropperResetProps) {
  const { reset } = useCropper('AvatarCropper.Reset');
  return (
    <Button variant={variant} size={size} onPress={reset} {...props}>
      {children}
    </Button>
  );
}
AvatarCropperReset.displayName = 'AvatarCropper.Reset';

export const AvatarCropper = Object.assign(AvatarCropperForwarded, {
  Canvas: AvatarCropperCanvas,
  Rotate: AvatarCropperRotate,
  Reset: AvatarCropperReset,
});
