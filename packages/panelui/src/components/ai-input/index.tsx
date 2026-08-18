/**
 * AIInput — the composer a person types a prompt into.
 *
 * ```tsx
 * <AIInput value={value} onValueChange={setValue} onSubmit={send}>
 *   <AIInput.Field placeholder="Chat with the model" />
 *   <AIInput.Toolbar>
 *     <AIInput.Action label="Add" icon={<PlusIcon />} onPress={openSheet} />
 *     <AIInput.Pill label="Sonnet 4.6" detail="High" onPress={openModels} />
 *     <AIInput.Action label="Dictate" icon={<MicIcon />} onPress={record} />
 *     <AIInput.Submit />
 *   </AIInput.Toolbar>
 * </AIInput>
 * ```
 *
 * ## The field grows, and then it stops
 *
 * It opens one line tall and follows what is typed into it up to `maxRows`,
 * after which it holds that height and scrolls its own content. Five rows is
 * the default because a composer that keeps growing eventually pushes its own
 * send button off the bottom of the screen, and the row that carries the
 * actions stays pinned to the bottom of the box either way.
 *
 * ## It does not record anything
 *
 * There is a recording state, and it draws a live meter, but nothing here
 * touches the microphone. The app owns the recorder — the permission prompt,
 * the session, the platform quirks — and passes back a `level` between 0 and 1
 * along with a `status`. Pass a Reanimated shared value and a recorder
 * reporting every 30ms never re-renders anything above this component.
 *
 * That division is what keeps the composer free of an audio dependency.
 *
 * ## Glass is iOS 26 and above
 *
 * The surfaces ask for the system material and get it where it exists. Below
 * iOS 26, on Android, and for anyone with Reduce Transparency switched on,
 * they are drawn as solid token surfaces instead. Both are finished looks; see
 * `Glass` for why nothing is faked on the platforms without it.
 *
 * ## Where the props come from
 *
 * The root takes `ViewProps`. `Field` takes `TextInputProps`, so
 * `keyboardType`, `maxLength`, `autoFocus` and the rest work as they always
 * do. Every part takes `className`.
 */
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  Pressable,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type EntryExitAnimationFunction,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tv } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { useDirection } from '../../hooks/use-direction';
import {
  ArrowUpIcon,
  AudioLinesIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MicIcon,
  XIcon,
} from '../../icons';
import { getNativeUI } from '../../native';
import { AnimatedPressable } from '../../primitives/animated-pressable';
import { Glass } from '../../primitives/glass';
import { KeyboardAvoider } from '../../primitives/keyboard-avoider';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { BottomSheet } from '../bottom-sheet';
import { Soundwave } from '../soundwave';
import { Switch } from '../switch';
import { AI_INPUT_METRICS, growthBounds, type AIInputSize } from './ai-input-growth';

/** What the app is doing, which is what the trailing button offers to do next. */
export type AIInputStatus = 'ready' | 'recording' | 'submitted' | 'streaming';

/** Corner radius per size, in points. The material rounds itself to these. */
const RADIUS = { sm: 22, md: 26, lg: 30 } as const;

/** Circular control diameter per size. */
const CONTROL = { sm: 32, md: 36, lg: 40 } as const;

const EASE = Easing.out(Easing.cubic);
const HEIGHT_DURATION = 240;
const ENTER_DURATION = 220;
const EXIT_DURATION = 140;

/**
 * How far a pushed screen travels in, as a fraction of the sheet's width.
 *
 * A third rather than the whole width: the sheet is not a screen, and a slide
 * the full width of it reads as the app navigating rather than as this surface
 * going one level deeper.
 */
const SLIDE_FRACTION = 0.33;

const aiInputVariants = tv({
  slots: {
    root: 'w-full',
    field: 'w-full bg-transparent px-4 font-normal text-foreground',
    toolbar: 'w-full flex-row items-center gap-2 px-2 pb-2',
    spacer: 'flex-1',
    pill: 'flex-row items-center gap-1.5 px-3',
    recording: 'w-full flex-row items-center gap-3 px-2 pb-2',
    meter: 'flex-1',
  },
  variants: {
    size: {
      sm: { toolbar: 'gap-1.5' },
      md: {},
      lg: { toolbar: 'gap-2.5' },
    },
    disabled: {
      true: { root: 'opacity-60' },
      false: {},
    },
  },
  defaultVariants: { size: 'md', disabled: false },
});

/* -------------------------------------------------------------------------- */
/* Root                                                                       */
/* -------------------------------------------------------------------------- */

interface AIInputContextValue {
  value: string;
  setValue: (value: string) => void;
  status: AIInputStatus;
  size: AIInputSize;
  level?: number | SharedValue<number>;
  disabled: boolean;
  minRows: number;
  maxRows: number;
  focused: boolean;
  setFocused: (focused: boolean) => void;
  submit: () => void;
  stop: () => void;
  recordCancel: () => void;
  recordConfirm: () => void;
  voice: () => void;
}

const AIInputContext = createContext<AIInputContextValue | null>(null);

function useAIInput(component: string): AIInputContextValue {
  const context = useContext(AIInputContext);
  if (!context) throw new Error(`${component} must be used within an <AIInput>`);
  return context;
}

/**
 * The composer's context if there is one, and nothing if there is not.
 *
 * The controls that only want a size and an enabled state work anywhere — a
 * sheet header, a voice-mode toolbar, a row of their own. Those surfaces
 * render through a portal or as their own screen, so a root wrapped around the
 * composer is not above them, and demanding one would make a button throw for
 * being used where it was designed to be used.
 */
function useAIInputOptional(): AIInputContextValue | null {
  return useContext(AIInputContext);
}

export interface AIInputProps extends Omit<ViewProps, 'children'> {
  children?: ReactNode;
  className?: string;
  /** The prompt, when the app owns it. */
  value?: string;
  /** Called on every keystroke. */
  onValueChange?: (value: string) => void;
  /** The prompt to start with, when the composer owns it. */
  defaultValue?: string;
  /**
   * What the app is doing. `ready` offers to send, `streaming` offers to stop,
   * and `recording` swaps the toolbar for the meter and its two decisions.
   */
  status?: AIInputStatus;
  /** Called with the prompt when it is sent. The composer does not clear itself. */
  onSubmit?: (value: string) => void;
  /** Called when the trailing button is pressed while `streaming`. */
  onStop?: () => void;
  /** Called when the voice button is pressed on an empty composer. */
  onVoice?: () => void;
  /** Called when a recording is thrown away. */
  onRecordCancel?: () => void;
  /** Called when a recording is accepted. */
  onRecordConfirm?: () => void;
  /**
   * Input level, 0–1, from the app's own recorder. Pass a shared value to keep
   * metering off the JS thread entirely. Omitted, the meter animates plausible
   * motion so a screen can be built before any audio exists.
   */
  level?: number | SharedValue<number>;
  /** Type scale and control size. */
  size?: AIInputSize;
  /** Nothing can be typed, pressed or sent. */
  disabled?: boolean;
  /** Rows the empty field is tall. */
  minRows?: number;
  /** Rows the field grows to before it holds that height and scrolls. */
  maxRows?: number;
  /** Lift the composer clear of the software keyboard. */
  avoidKeyboard?: boolean;
  /** How far above the bottom edge the composer already sits. */
  keyboardBottomInset?: number;
}

function AIInputRoot({
  children,
  className,
  value: valueProp,
  onValueChange,
  defaultValue = '',
  status = 'ready',
  onSubmit,
  onStop,
  onVoice,
  onRecordCancel,
  onRecordConfirm,
  level,
  size = 'md',
  disabled = false,
  minRows = 1,
  maxRows = 5,
  avoidKeyboard = true,
  keyboardBottomInset = 0,
  ...props
}: AIInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : internalValue;
  const [focused, setFocused] = useState(false);

  const setValue = useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange]
  );

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit?.(value);
  }, [onSubmit, value]);

  const context = useMemo<AIInputContextValue>(
    () => ({
      value,
      setValue,
      status,
      size,
      level,
      disabled,
      minRows,
      maxRows,
      focused,
      setFocused,
      submit,
      stop: () => onStop?.(),
      recordCancel: () => onRecordCancel?.(),
      recordConfirm: () => onRecordConfirm?.(),
      voice: () => onVoice?.(),
    }),
    [
      value,
      setValue,
      status,
      size,
      level,
      disabled,
      minRows,
      maxRows,
      focused,
      submit,
      onStop,
      onRecordCancel,
      onRecordConfirm,
      onVoice,
    ]
  );

  const slots = aiInputVariants({ size, disabled });

  const surface = (
    <Glass
      radius={RADIUS[size]}
      fallbackClassName="border border-border bg-card"
      {...props}
      className={slots.root({ className })}
    >
      {children}
    </Glass>
  );

  /*
   * The keyboard hook stays behind a component boundary rather than an
   * `enabled` flag. Calling it at all has global consequences — without the
   * keyboard controller installed it falls back to Reanimated's
   * useAnimatedKeyboard, which switches Android out of adjustResize for the
   * whole app. A composer that was told not to avoid the keyboard must not do
   * that to every other screen in the app.
   */
  return (
    <AIInputContext.Provider value={context}>
      {avoidKeyboard ? (
        <KeyboardAvoider
          active={focused}
          mode="dock"
          bottomInset={keyboardBottomInset}
          className="w-full"
        >
          {surface}
        </KeyboardAvoider>
      ) : (
        surface
      )}
    </AIInputContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Field                                                                      */
/* -------------------------------------------------------------------------- */

export interface AIInputFieldProps
  extends Omit<TextInputProps, 'value' | 'onChangeText' | 'multiline'> {
  className?: string;
}

function AIInputField({
  className,
  placeholder = 'Ask anything',
  onFocus,
  onBlur,
  style,
  ...props
}: AIInputFieldProps) {
  const context = useAIInput('AIInput.Field');
  const { value, setValue, size, disabled, minRows, maxRows, setFocused } = context;
  const metrics = AI_INPUT_METRICS[size];
  const placeholderColor = useCSSVariable('--color-muted-foreground');
  const bounds = growthBounds(metrics, minRows, maxRows);

  const handleFocus = useCallback<NonNullable<TextInputProps['onFocus']>>(
    (event) => {
      setFocused(true);
      onFocus?.(event);
    },
    [onFocus, setFocused]
  );

  const handleBlur = useCallback<NonNullable<TextInputProps['onBlur']>>(
    (event) => {
      setFocused(false);
      onBlur?.(event);
    },
    [onBlur, setFocused]
  );

  /*
   * Type metrics go through `style` rather than through classes, because the
   * height is computed from them and a line height set in two places is a line
   * height that will disagree with itself.
   */
  const boxStyle = useMemo(
    () => ({
      /*
       * A floor and a ceiling, and no height. The field sizes itself to its
       * own content between them, which the layout engine does without anyone
       * measuring anything — and once it reaches the ceiling, a multiline
       * field scrolls its content instead of growing.
       *
       * Deriving a height from `onContentSizeChange` instead is a loop whose
       * answer differs by platform: one reports the height of the text, the
       * other the height of the box that was just set from it, and on that one
       * the field can never grow past the height it opened at.
       */
      minHeight: bounds.minHeight,
      maxHeight: bounds.maxHeight,
      fontSize: metrics.fontSize,
      lineHeight: metrics.lineHeight,
      paddingTop: metrics.padding,
      paddingBottom: metrics.padding,
      // Android starts the caret in the middle of the box without it.
      textAlignVertical: 'top' as const,
    }),
    [bounds.minHeight, bounds.maxHeight, metrics]
  );

  const slots = aiInputVariants({ size });

  return (
    <TextInput
      {...props}
      multiline
      value={value}
      onChangeText={setValue}
      placeholder={placeholder}
      placeholderTextColor={typeof placeholderColor === 'string' ? placeholderColor : undefined}
      editable={!disabled}
      /*
       * `scrollEnabled` is deliberately left alone.
       *
       * Driving it from the measurement is a loop: switching it on changes
       * what the platform reports as the content size, which changes the
       * answer to whether it should be on, and the field resizes for ever. A
       * multiline field scrolls once its height is fixed anyway, so there is
       * nothing to drive — the clamp below is the whole mechanism.
       */
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={slots.field({ className })}
      style={[boxStyle, style]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar and its controls                                                   */
/* -------------------------------------------------------------------------- */

export interface AIInputToolbarProps extends ViewProps {
  className?: string;
}

function AIInputToolbar({ className, children, ...props }: AIInputToolbarProps) {
  const { size } = useAIInput('AIInput.Toolbar');
  const slots = aiInputVariants({ size });
  return (
    <View {...props} accessibilityRole="toolbar" className={slots.toolbar({ className })}>
      {children}
    </View>
  );
}

/** Pushes everything after it to the trailing end of the toolbar. */
function AIInputSpacer({ className, ...props }: ViewProps) {
  return <View {...props} className={cn('flex-1', className)} />;
}

export interface AIInputActionProps
  extends Omit<ViewProps, 'children'>,
    Pick<ViewProps, 'accessibilityHint'> {
  className?: string;
  /** Names the control. It is a circle with a glyph in it; nothing else says what it does. */
  label: string;
  icon: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Control size. Inherited from the composer when it is inside one. */
  size?: AIInputSize;
}

function AIInputAction({
  className,
  label,
  icon,
  onPress,
  disabled,
  size: sizeProp,
  ...props
}: AIInputActionProps) {
  const context = useAIInputOptional();
  const size = CONTROL[sizeProp ?? context?.size ?? 'md'];
  const isDisabled = disabled ?? context?.disabled ?? false;

  return (
    <Glass
      variant="clear"
      radius={size / 2}
      fallbackClassName="bg-muted"
      {...props}
      className={className}
      style={{ width: size, height: size }}
    >
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onPress}
        // The dim goes on the content rather than on the material. Fading a
        // system material degrades it, and at zero it stops drawing entirely.
        className={cn('h-full w-full items-center justify-center', isDisabled && 'opacity-40')}
      >
        {icon}
      </AnimatedPressable>
    </Glass>
  );
}

export interface AIInputPillProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** The current value — a model name, a mode, a project. */
  label: ReactNode;
  /** A second, quieter value beside it. */
  detail?: ReactNode;
  /** A glyph after the labels, for a pill that opens a list. */
  indicator?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Names the control when the label alone does not say what changing it does. */
  accessibilityLabel?: string;
  /** Control size. Inherited from the composer when it is inside one. */
  size?: AIInputSize;
}

function AIInputPill({
  className,
  label,
  detail,
  indicator,
  onPress,
  disabled,
  accessibilityLabel,
  size: sizeProp,
  ...props
}: AIInputPillProps) {
  const context = useAIInputOptional();
  const size = sizeProp ?? context?.size ?? 'md';
  const height = CONTROL[size];
  const isDisabled = disabled ?? context?.disabled ?? false;
  const slots = aiInputVariants({ size });

  return (
    <Glass
      variant="clear"
      radius={height / 2}
      fallbackClassName="bg-muted"
      {...props}
      className={className}
      style={{ height }}
    >
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onPress}
        className={slots.pill({ className: cn('h-full', isDisabled && 'opacity-40') })}
      >
        {typeof label === 'string' ? (
          <Text size="sm" weight="medium">
            {label}
          </Text>
        ) : (
          label
        )}
        {typeof detail === 'string' ? (
          <Text size="sm" muted>
            {detail}
          </Text>
        ) : (
          detail
        )}
        {indicator}
      </AnimatedPressable>
    </Glass>
  );
}

/**
 * A glyph drawn by the platform where the platform has one.
 *
 * The trailing button's two marks — an arrow and a waveform — are the two
 * every voice assistant on the phone already draws, and the system draws them
 * better than a hand-traced path does: correct optical weight at every size,
 * and the same shape the rest of the OS uses.
 *
 * iOS gets the SF Symbol. Android's toolkit wants a vector asset from a
 * package this library does not depend on, so it gets the drawn icon, as does
 * anyone without the optional toolkit installed. Both are finished; neither is
 * a placeholder for the other.
 *
 * The host is given an explicit square, because a hosted view with no definite
 * size above it on both axes is a crash in native code rather than an
 * exception anything here could catch.
 */
function NativeGlyph({
  symbol,
  size,
  color,
  fallback,
}: {
  symbol: string;
  size: number;
  color?: string;
  fallback: ReactNode;
}) {
  const native = Platform.OS === 'ios' ? getNativeUI() : null;
  if (!native?.Icon || !native?.Host) return <>{fallback}</>;

  /*
   * `matchContents` and no size of its own. Given a fixed box the host lays
   * the symbol out against its own intrinsic size inside it and leaves it
   * wherever that lands — off centre, and differently so per symbol. Sized to
   * its contents it is a glyph-shaped view, which the button's own centring
   * then handles like any other child.
   *
   * The definite size a hosted view needs is the button above it, which is a
   * square this component draws.
   */
  const { Host, Icon } = native;
  return (
    <Host matchContents>
      <Icon name={symbol} size={size} color={color} />
    </Host>
  );
}

export interface AIInputSubmitProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** Names the button in its send state. */
  sendLabel?: string;
  /** Names it in its voice state, which is what an empty composer offers. */
  voiceLabel?: string;
  /** Names it while the model is answering. */
  stopLabel?: string;
}

/**
 * The trailing button, which is three buttons wearing one shape.
 *
 * Empty and ready, it opens voice mode; with something typed, it sends; while
 * the model is answering, it stops. One control rather than three because only
 * one of them is ever the thing to do, and a row of dimmed siblings is a row
 * of things that look broken.
 */
function AIInputSubmit({
  className,
  sendLabel = 'Send',
  voiceLabel = 'Voice mode',
  stopLabel = 'Stop',
  ...props
}: AIInputSubmitProps) {
  const context = useAIInput('AIInput.Submit');
  const { value, status, size, disabled, submit, stop, voice } = context;
  const diameter = CONTROL[size] + 4;
  const streaming = status === 'streaming' || status === 'submitted';
  const hasText = value.trim().length > 0;

  const onSurface = useCSSVariable('--color-primary-foreground');
  const onSolid = useCSSVariable('--color-background');

  const mode = streaming ? 'stop' : hasText ? 'send' : 'voice';
  const label = mode === 'stop' ? stopLabel : mode === 'send' ? sendLabel : voiceLabel;
  const onPress = mode === 'stop' ? stop : mode === 'send' ? submit : voice;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...props}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'items-center justify-center rounded-full',
        mode === 'voice' ? 'bg-foreground' : 'bg-primary',
        disabled && 'opacity-40',
        className
      )}
      style={{ width: diameter, height: diameter }}
    >
      {mode === 'send' ? (
        <NativeGlyph
          symbol="arrow.up"
          size={18}
          color={typeof onSurface === 'string' ? onSurface : undefined}
          fallback={
            <ArrowUpIcon
              size={18}
              color={typeof onSurface === 'string' ? onSurface : undefined}
              filled
            />
          }
        />
      ) : mode === 'stop' ? (
        <NativeGlyph
          symbol="stop.fill"
          size={16}
          color={typeof onSurface === 'string' ? onSurface : undefined}
          fallback={
            <View className="rounded-sm bg-primary-foreground" style={{ width: 11, height: 11 }} />
          }
        />
      ) : (
        <NativeGlyph
          symbol="waveform"
          size={19}
          color={typeof onSolid === 'string' ? onSolid : undefined}
          fallback={
            <AudioLinesIcon
              size={19}
              color={typeof onSolid === 'string' ? onSolid : undefined}
            />
          }
        />
      )}
    </AnimatedPressable>
  );
}

export interface AIInputRecordingProps extends Omit<ViewProps, 'children'> {
  className?: string;
  cancelLabel?: string;
  confirmLabel?: string;
}

/**
 * What the toolbar becomes while a recording is running: throw it away, watch
 * it, or keep it. Render it in place of `AIInput.Toolbar` when `status` is
 * `recording`.
 */
function AIInputRecording({
  className,
  cancelLabel = 'Discard recording',
  confirmLabel = 'Use recording',
  ...props
}: AIInputRecordingProps) {
  const context = useAIInput('AIInput.Recording');
  const { size, level, recordCancel, recordConfirm } = context;
  const control = CONTROL[size];
  const slots = aiInputVariants({ size });
  const onPrimary = useCSSVariable('--color-primary-foreground');

  return (
    <View {...props} className={slots.recording({ className })}>
      <Glass
        variant="clear"
        radius={control / 2}
        fallbackClassName="bg-muted"
        style={{ width: control, height: control }}
      >
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          onPress={recordCancel}
          className="h-full w-full items-center justify-center"
        >
          <XIcon size={16} />
        </AnimatedPressable>
      </Glass>

      <View className={slots.meter()}>
        <Soundwave
          variant="bars"
          mode="scrolling"
          state="listening"
          level={level}
          centered
          barWidth={2.5}
          height={control}
        />
      </View>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={confirmLabel}
        onPress={recordConfirm}
        className="items-center justify-center rounded-full bg-primary"
        style={{ width: control + 4, height: control + 4 }}
      >
        <CheckIcon
          size={18}
          color={typeof onPrimary === 'string' ? onPrimary : undefined}
        />
      </AnimatedPressable>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Sheet                                                                      */
/* -------------------------------------------------------------------------- */

interface AIInputSheetContextValue {
  /** Screen ids, root first. The last one is what is on screen. */
  stack: string[];
  push: (id: string) => void;
  pop: () => void;
  close: () => void;
}

const AIInputSheetContext = createContext<AIInputSheetContextValue | null>(null);

function useAIInputSheet(component: string): AIInputSheetContextValue {
  const context = useContext(AIInputSheetContext);
  if (!context) throw new Error(`${component} must be used within an <AIInput.Sheet>`);
  return context;
}

export interface AIInputSheetScreenProps extends ViewProps {
  className?: string;
  /** Names this screen. `AIInput.Sheet.Row`'s `to` pushes the screen with this id. */
  id: string;
  /** Centred in the header, and the first thing a screen reader reaches. */
  title?: ReactNode;
  /**
   * A control at the trailing end of the header — a second action the screen
   * offers. The leading end is the sheet's, and is a close button on the root
   * screen and a back button on every screen pushed onto it.
   */
  trailing?: ReactNode;
}

function AIInputSheetScreen({ className, id, title, trailing, children, ...props }: AIInputSheetScreenProps) {
  void id;
  void title;
  void trailing;
  return (
    <View {...props} className={cn('gap-3 pb-2', className)}>
      {children}
    </View>
  );
}

type ScreenElement = ReactElement<AIInputSheetScreenProps>;

function screensOf(children: ReactNode): ScreenElement[] {
  return Children.toArray(children).filter(
    (child): child is ScreenElement =>
      isValidElement(child) && child.type === AIInputSheetScreen
  );
}

export interface AIInputSheetProps {
  children?: ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  /** Which screen opens first. Defaults to the first one given. */
  initialScreen?: string;
  /** Called whenever the screen on top changes, pushed or popped. */
  onScreenChange?: (id: string) => void;
  /** Frost the screen behind the sheet instead of dimming it. */
  blur?: boolean;
  /** How tall the sheet opens. `auto` sizes to the screen currently on top. */
  size?: 'auto' | 'half' | 'full';
  /**
   * Float the sheet clear of the screen edges instead of docking it to the
   * bottom. On by default: the surface is a material, and a material reads as
   * laid over the app when there is app visible around all four of its edges.
   * Docked, its bottom edge is the screen's, and there is nothing behind it
   * there to refract.
   */
  detached?: boolean;
}

/**
 * The sheet the composer's controls open, and the screens it goes on to.
 *
 * A row that leads somewhere pushes a screen onto this sheet rather than
 * opening a second one over it. The sheet stays where it is, the header's
 * close button becomes a back button, and the body slides — which is what
 * makes going one level deeper feel like the same surface rather than another
 * one landing on top of it.
 *
 * ```tsx
 * <AIInput.Sheet open={open} onOpenChange={setOpen}>
 *   <AIInput.Sheet.Screen id="root" title="Add to chat">
 *     <AIInput.Sheet.Group>
 *       <AIInput.Sheet.Row label="Add to project" value="None" to="project" />
 *       <AIInput.Sheet.Toggle label="Web search" value={web} onValueChange={setWeb} />
 *     </AIInput.Sheet.Group>
 *   </AIInput.Sheet.Screen>
 *   <AIInput.Sheet.Screen id="project" title="Add to project">…</AIInput.Sheet.Screen>
 * </AIInput.Sheet>
 * ```
 */
function AIInputSheet({
  children,
  className,
  open: openProp,
  onOpenChange,
  defaultOpen = false,
  initialScreen,
  onScreenChange,
  blur = false,
  size = 'auto',
  detached = true,
}: AIInputSheetProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const screens = screensOf(children);
  const rootId = initialScreen ?? screens[0]?.props.id ?? '';
  const [stack, setStack] = useState<string[]>(rootId ? [rootId] : []);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  /*
   * A closed sheet forgets where it was. Reopening onto a screen somebody
   * pushed and then dismissed is a sheet that answers a question nobody asked
   * again. Done on the way out rather than the way in, where the reset would
   * be visible for a frame before the sheet arrived.
   */
  useEffect(() => {
    if (!open && rootId) setStack([rootId]);
  }, [open, rootId]);

  const push = useCallback(
    (id: string) => {
      setStack((current) => (current[current.length - 1] === id ? current : [...current, id]));
      onScreenChange?.(id);
    },
    [onScreenChange]
  );

  const pop = useCallback(() => {
    setStack((current) => {
      if (current.length <= 1) return current;
      const next = current.slice(0, -1);
      const top = next[next.length - 1];
      if (top) onScreenChange?.(top);
      return next;
    });
  }, [onScreenChange]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const context = useMemo<AIInputSheetContextValue>(
    () => ({ stack, push, pop, close }),
    [stack, push, pop, close]
  );

  const activeId = stack[stack.length - 1];
  const active = screens.find((screen) => screen.props.id === activeId) ?? screens[0];
  const depth = stack.length;

  const insets = useSafeAreaInsets();

  // A sheet with no screens has nothing to show and no title to head it with.
  // Below every hook, so the count does not change with the children.
  if (!active) return null;

  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheet.Content
        blur={blur}
        size={size}
        detached={detached}
        showClose={false}
        showGrabber={false}
        className="border-0 bg-transparent px-0 pt-0 shadow-none"
        // The sheet's own bottom padding would sit outside the material and
        // leave a band of backdrop under it. The glass takes the inset instead.
        style={{ paddingBottom: 0 }}
      >
        {/*
         * Inside the content, not around the sheet. `BottomSheet.Content`
         * renders through a portal, so everything below it mounts under the
         * portal host rather than here — a provider wrapped around the sheet
         * is not an ancestor of the header that reads it.
         */}
        <AIInputSheetContext.Provider value={context}>
          <Glass
            // Four rounded corners when it floats, two when it is docked: the
            // bottom edge of a docked sheet is the screen's edge, and rounding
            // a corner there rounds nothing.
            radius={detached ? 24 : { top: 24 }}
            fallbackClassName={cn(
              'border border-border bg-popover',
              !detached && 'border-b-0'
            )}
            className="px-4 pt-2"
            // A floating sheet's own bottom margin already clears the home
            // indicator, so it takes plain padding rather than stacking the
            // inset on top of the gap.
            style={{ paddingBottom: detached ? 16 : Math.max(insets.bottom, 16) }}
          >
            <View className="mb-2 self-center">
              <View className="h-1 w-10 rounded-full bg-muted-foreground/40" />
            </View>
            <AIInputSheetHeader
              depth={depth}
              title={active.props.title}
              trailing={active.props.trailing}
            />
            <AIInputSheetBody activeId={activeId} depth={depth} className={className}>
              {active}
            </AIInputSheetBody>
          </Glass>
        </AIInputSheetContext.Provider>
      </BottomSheet.Content>
    </BottomSheet>
  );
}

function AIInputSheetHeader({
  depth,
  title,
  trailing,
}: {
  depth: number;
  title?: ReactNode;
  trailing?: ReactNode;
}) {
  const { pop, close } = useAIInputSheet('AIInput.Sheet');
  const rtl = useDirection() === 'rtl';
  const nested = depth > 1;
  const Back = rtl ? ChevronRightIcon : ChevronLeftIcon;

  return (
    <View className="h-11 flex-row items-center">
      <Glass
        variant="clear"
        radius={17}
        fallbackClassName="bg-muted"
        style={{ width: 34, height: 34 }}
      >
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={nested ? 'Back' : 'Close'}
          onPress={nested ? pop : close}
          className="h-full w-full items-center justify-center"
        >
          {nested ? <Back size={20} /> : <XIcon size={18} />}
        </AnimatedPressable>
      </Glass>

      {/*
       * Centred against the sheet rather than against what is left over, so the
       * title does not shift when the trailing action appears on one screen and
       * not the next. It takes no touches, so it cannot bury the buttons at
       * either end the way an absolutely positioned full-width title would.
       */}
      <View pointerEvents="none" className="absolute inset-x-0 items-center">
        {typeof title === 'string' ? (
          <Text size="lg" weight="semibold" numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
      </View>

      <View className="flex-1" />
      {trailing}
    </View>
  );
}

function AIInputSheetBody({
  activeId,
  depth,
  className,
  children,
}: {
  activeId?: string;
  depth: number;
  className?: string;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const height = useSharedValue(-1);
  const paneRef = useRef<View>(null);
  const [measured, setMeasured] = useState(false);

  /*
   * Which way the screen slides, worked out from the move rather than from
   * whatever caused it — a row, a back button and a caller pushing directly
   * are the same move to the reader, and only the change in depth says which
   * way it went.
   *
   * Read during render, not in an effect: the arriving screen's animation is
   * fixed when it mounts, and an effect runs after that, which would leave
   * every transition playing the direction of the one before it.
   */
  const previousDepth = useRef(depth);
  const direction: 1 | -1 = depth >= previousDepth.current ? 1 : -1;
  const navigated = useRef(false);

  useEffect(() => {
    if (depth !== previousDepth.current) {
      previousDepth.current = depth;
      navigated.current = true;
    }
  }, [depth]);

  // Move the reader onto the screen that just arrived, rather than leaving
  // focus on the row that is no longer there.
  useEffect(() => {
    if (!navigated.current) return;
    const node = paneRef.current;
    if (!node) return;
    const tag = findNodeHandle(node);
    if (tag != null) AccessibilityInfo.setAccessibilityFocus(tag);
  }, [activeId]);

  /*
   * Until the first screen has been measured the pane stays in the flow, so a
   * sheet sized to its content has a real height on the first pass. Absolute
   * from the start would measure zero — the container's only child would
   * contribute nothing — and the sheet would open around a screen nobody can
   * see.
   */
  const onPaneLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height;
      if (next <= 0) return;
      if (measured) {
        height.value = withTiming(next, { duration: HEIGHT_DURATION, easing: EASE });
        return;
      }
      height.value = next;
      setMeasured(true);
    },
    [measured, height]
  );

  const heightStyle = useAnimatedStyle(() => (height.value < 0 ? {} : { height: height.value }));

  /*
   * Written out rather than taken from the stock builders, which carry an
   * initial opacity and nothing else — the distance is the part worth
   * controlling here, and none of them lets it be set.
   */
  const offset = width > 0 ? width * SLIDE_FRACTION : 60;
  const entering = useCallback<EntryExitAnimationFunction>(() => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateX: direction * offset }] },
      animations: {
        opacity: withTiming(1, { duration: ENTER_DURATION, easing: EASE }),
        transform: [{ translateX: withTiming(0, { duration: ENTER_DURATION, easing: EASE }) }],
      },
    };
  }, [direction, offset]);

  return (
    <Animated.View style={heightStyle} className={cn('w-full overflow-hidden', className)}>
      <Animated.View
        key={activeId ?? '__empty__'}
        entering={measured ? entering : undefined}
        exiting={FadeOut.duration(EXIT_DURATION)}
        className={measured ? 'absolute inset-x-0 top-0' : 'w-full'}
      >
        <View ref={paneRef} onLayout={onPaneLayout} className="w-full pt-2">
          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* Sheet content                                                              */
/* -------------------------------------------------------------------------- */

export interface AIInputSheetGroupProps extends ViewProps {
  className?: string;
  /** A line under the group, for what the rows in it mean. */
  footnote?: ReactNode;
}

/** A card of related rows, with a hairline between each pair. */
function AIInputSheetGroup({ className, footnote, children, ...props }: AIInputSheetGroupProps) {
  const rows = Children.toArray(children);
  return (
    <View className="gap-2">
      <View {...props} className={cn('overflow-hidden rounded-2xl bg-muted/50', className)}>
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 ? <View className="ms-4 h-px bg-border" /> : null}
            {row}
          </View>
        ))}
      </View>
      {typeof footnote === 'string' ? (
        <Text size="sm" muted className="px-2">
          {footnote}
        </Text>
      ) : (
        footnote
      )}
    </View>
  );
}

export interface AIInputSheetRowProps extends Omit<ViewProps, 'children'> {
  className?: string;
  label: ReactNode;
  /** A quieter line under the label. */
  description?: ReactNode;
  /** A glyph at the leading end. */
  icon?: ReactNode;
  /** The current setting, shown at the trailing end. */
  value?: ReactNode;
  /**
   * Push the screen with this id when the row is pressed. A row with one shows
   * a chevron, because a row that leads somewhere should say so before it is
   * pressed.
   */
  to?: string;
  onPress?: () => void;
  disabled?: boolean;
}

function AIInputSheetRow({
  className,
  label,
  description,
  icon,
  value,
  to,
  onPress,
  disabled = false,
  ...props
}: AIInputSheetRowProps) {
  const { push } = useAIInputSheet('AIInput.Sheet.Row');
  const rtl = useDirection() === 'rtl';
  const Chevron = rtl ? ChevronLeftIcon : ChevronRightIcon;

  const handlePress = useCallback(() => {
    onPress?.();
    if (to) push(to);
  }, [onPress, push, to]);

  const body = (
    <>
      {icon}
      <View className="flex-1 gap-0.5">
        {typeof label === 'string' ? <Text size="base">{label}</Text> : label}
        {typeof description === 'string' ? (
          <Text size="sm" muted>
            {description}
          </Text>
        ) : (
          description
        )}
      </View>
      {typeof value === 'string' ? (
        <Text size="base" muted>
          {value}
        </Text>
      ) : (
        value
      )}
      {to ? <Chevron size={18} /> : null}
    </>
  );

  const interactive = Boolean(to || onPress);
  if (!interactive) {
    return (
      <View {...props} className={cn('flex-row items-center gap-3 px-4 py-3.5', className)}>
        {body}
      </View>
    );
  }

  return (
    <AnimatedPressable
      pressScale={1}
      pressOpacity={0.6}
      {...props}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      className={cn('flex-row items-center gap-3 px-4 py-3.5', disabled && 'opacity-40', className)}
    >
      {body}
    </AnimatedPressable>
  );
}

export interface AIInputSheetToggleProps extends Omit<ViewProps, 'children'> {
  className?: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
}

function AIInputSheetToggle({
  className,
  label,
  description,
  icon,
  value,
  onValueChange,
  disabled = false,
  ...props
}: AIInputSheetToggleProps) {
  return (
    <View {...props} className={cn('flex-row items-center gap-3 px-4 py-2.5', className)}>
      {icon}
      <View className="flex-1 gap-0.5">
        {typeof label === 'string' ? <Text size="base">{label}</Text> : label}
        {typeof description === 'string' ? (
          <Text size="sm" muted>
            {description}
          </Text>
        ) : (
          description
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        label={typeof label === 'string' ? label : undefined}
      />
    </View>
  );
}

export interface AIInputSheetChoiceProps extends Omit<ViewProps, 'children'> {
  className?: string;
  label: ReactNode;
  description?: ReactNode;
  /** A pill beside the label — what the choice costs, or what it needs. */
  badge?: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

/** One of a set, with a tick on the one in force. */
function AIInputSheetChoice({
  className,
  label,
  description,
  badge,
  selected = false,
  onPress,
  disabled = false,
  ...props
}: AIInputSheetChoiceProps) {
  const tint = useCSSVariable('--color-primary');

  return (
    <AnimatedPressable
      pressScale={1}
      pressOpacity={0.6}
      {...props}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'flex-row items-start gap-3 px-4 py-3.5',
        disabled && 'opacity-40',
        className
      )}
    >
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          {typeof label === 'string' ? (
            <Text size="lg" weight="medium">
              {label}
            </Text>
          ) : (
            label
          )}
          {badge}
        </View>
        {typeof description === 'string' ? (
          <Text size="sm" muted>
            {description}
          </Text>
        ) : (
          description
        )}
      </View>
      {selected ? (
        <CheckIcon size={20} color={typeof tint === 'string' ? tint : undefined} />
      ) : null}
    </AnimatedPressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Voice mode                                                                 */
/* -------------------------------------------------------------------------- */

export interface AIInputVoiceModeProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** The controls in the bottom row, before the close button. */
  children?: ReactNode;
  /** What the app is doing, which is what the wave behind everything shows. */
  state?: 'idle' | 'listening' | 'thinking' | 'speaking';
  /** Input level, 0–1. A shared value keeps metering off the JS thread. */
  level?: number | SharedValue<number>;
  /** A line above the microphone — a greeting, or what it is waiting for. */
  title?: ReactNode;
  onMicPress?: () => void;
  micLabel?: string;
  onClose?: () => void;
  closeLabel?: string;
  /** Type scale for the controls in the bottom row. */
  size?: AIInputSize;
}

/**
 * The screen a voice conversation happens on: no field, no keyboard, one
 * microphone and a way out.
 *
 * It is a surface rather than an overlay — render it as its own route or
 * inside a modal of your own. It provides the composer's context, so
 * `AIInput.Action` and `AIInput.Pill` work in the bottom row without an
 * `AIInput` around them.
 */
function AIInputVoiceMode({
  className,
  children,
  state = 'listening',
  level,
  title,
  onMicPress,
  micLabel = 'Mute',
  onClose,
  closeLabel = 'End voice mode',
  size = 'md',
  ...props
}: AIInputVoiceModeProps) {
  const insets = useSafeAreaInsets();
  const onSolid = useCSSVariable('--color-background');
  const control = CONTROL[size] + 4;

  const context = useMemo<AIInputContextValue>(
    () => ({
      value: '',
      setValue: () => {},
      status: 'ready',
      size,
      level,
      disabled: false,
      minRows: 1,
      maxRows: 5,
      focused: false,
      setFocused: () => {},
      submit: () => {},
      stop: () => {},
      recordCancel: () => {},
      recordConfirm: () => {},
      voice: () => {},
    }),
    [level, size]
  );

  return (
    <AIInputContext.Provider value={context}>
      <View {...props} className={cn('flex-1 bg-background', className)}>
        {/* Behind everything, and taking no touches: the wash that says the
            screen is listening without putting a control in the way of it. */}
        <Soundwave
          variant="ambient"
          state={state}
          level={level}
          pointerEvents="none"
          className="absolute inset-0"
        />

        <View className="flex-1 items-center justify-center gap-8 px-6">
          {typeof title === 'string' ? (
            <Text size="xl" className="text-center">
              {title}
            </Text>
          ) : (
            title
          )}

          <View className="items-center gap-5">
            <Soundwave variant="pills" state={state} level={level} height={28} />
            <Glass
              variant="clear"
              radius={44}
              fallbackClassName="border border-border bg-muted"
              style={{ width: 88, height: 88 }}
            >
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel={micLabel}
                onPress={onMicPress}
                className="h-full w-full items-center justify-center"
              >
                <MicIcon size={32} />
              </AnimatedPressable>
            </Glass>
          </View>
        </View>

        <View
          className="flex-row items-center gap-3 px-5"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
          {children}
          <View className="flex-1" />
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={onClose}
            className="items-center justify-center rounded-full bg-foreground"
            style={{ width: control, height: control }}
          >
            <XIcon size={18} color={typeof onSolid === 'string' ? onSolid : undefined} />
          </AnimatedPressable>
        </View>
      </View>
    </AIInputContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */

AIInputRoot.displayName = 'AIInput';
AIInputField.displayName = 'AIInput.Field';
AIInputToolbar.displayName = 'AIInput.Toolbar';
AIInputSpacer.displayName = 'AIInput.Spacer';
AIInputAction.displayName = 'AIInput.Action';
AIInputPill.displayName = 'AIInput.Pill';
AIInputSubmit.displayName = 'AIInput.Submit';
AIInputRecording.displayName = 'AIInput.Recording';
AIInputSheetScreen.displayName = 'AIInput.Sheet.Screen';
AIInputSheetGroup.displayName = 'AIInput.Sheet.Group';
AIInputSheetRow.displayName = 'AIInput.Sheet.Row';
AIInputSheetToggle.displayName = 'AIInput.Sheet.Toggle';
AIInputSheetChoice.displayName = 'AIInput.Sheet.Choice';
AIInputSheet.displayName = 'AIInput.Sheet';
AIInputVoiceMode.displayName = 'AIInput.VoiceMode';

const Sheet = Object.assign(AIInputSheet, {
  Screen: AIInputSheetScreen,
  Group: AIInputSheetGroup,
  Row: AIInputSheetRow,
  Toggle: AIInputSheetToggle,
  Choice: AIInputSheetChoice,
});

export const AIInput = Object.assign(AIInputRoot, {
  Field: AIInputField,
  Toolbar: AIInputToolbar,
  Spacer: AIInputSpacer,
  Action: AIInputAction,
  Pill: AIInputPill,
  Submit: AIInputSubmit,
  Recording: AIInputRecording,
  Sheet,
  VoiceMode: AIInputVoiceMode,
});
