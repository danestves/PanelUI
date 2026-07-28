/**
 * Tooltip — a small label that names the thing under your finger.
 *
 * A popover is a panel you open and deal with; a tooltip is a whisper. It
 * carries a word or two about what a control does, appears without taking the
 * screen, and goes away on its own. That is why it is inverted rather than
 * surface-coloured, why it is not dismissible with a scrim, and why it closes
 * after a beat instead of waiting to be told.
 *
 * On touch there is no hover to open it, so the gesture is a long press by
 * default — the platform's own "tell me more" gesture — with `openOn="press"`
 * for the cases where a tap should reveal it instead.
 *
 * ```tsx
 * <Tooltip label="Copy link">
 *   <Tooltip.Trigger>
 *     <IconButton icon={<LinkIcon />} />
 *   </Tooltip.Trigger>
 *   <Tooltip.Content>
 *     <Tooltip.Arrow />
 *     Copy link
 *   </Tooltip.Content>
 * </Tooltip>
 * ```
 *
 * Placement is a preference, not a promise: the trigger is measured when it is
 * pressed, the label measures itself on its first layout, and the two are
 * reconciled against the safe area — so `placement="top"` means *above, if
 * above fits*, and a trigger near the top edge shows its tooltip below instead.
 */
import {
  cloneElement,
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
  Pressable,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewProps,
} from 'react-native';
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portal } from '../../primitives/portal';
import { Text, type TextProps } from '../../primitives/text';
import { cn } from '../../utils/cn';

/** Gap between the trigger and the label. */
const DEFAULT_OFFSET = 6;
/** Smallest gap allowed between the label and the edge of the safe area. */
const SCREEN_MARGIN = 12;
/** Side of the arrow square before it is rotated 45°. */
const ARROW_SIZE = 10;
/** How long the label stays up before hiding itself, in milliseconds. */
const DEFAULT_DURATION = 1500;

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';
export type TooltipAlign = 'start' | 'center' | 'end';

interface TriggerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TooltipContextValue {
  open: boolean;
  show: () => void;
  hide: () => void;
  trigger: TriggerRect | null;
  setTrigger: (rect: TriggerRect | null) => void;
  /** Resolved placement, published by Content so Arrow knows which way to point. */
  placement: TooltipPlacement;
  setPlacement: (placement: TooltipPlacement) => void;
  /** Trigger centre along the cross axis, relative to the label origin. */
  arrowOffset: number;
  setArrowOffset: (offset: number) => void;
  /** How the trigger opens the tooltip. */
  openOn: TooltipOpenOn;
  /** Accessibility label carried onto the trigger. */
  label?: string;
}

export type TooltipOpenOn = 'longPress' | 'press';

const TooltipContext = createContext<TooltipContextValue | null>(null);

function useTooltip(component: string): TooltipContextValue {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Tooltip>`);
  }
  return context;
}

export interface TooltipProps {
  children: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Initial state when uncontrolled. */
  defaultOpen?: boolean;
  /**
   * Whether a long press or a plain press reveals the label. Long press is the
   * default because it does not steal a tappable control's own press.
   */
  openOn?: TooltipOpenOn;
  /**
   * How long the label stays up before hiding itself, in milliseconds. `0`
   * keeps it up until it is dismissed by a tap outside or the trigger again.
   */
  duration?: number;
  /**
   * The label's text, mirrored onto the trigger as its accessibility label so
   * a screen reader announces what the tooltip says without opening it. Set it
   * whenever the trigger has no text of its own — an icon-only button.
   */
  label?: string;
}

function TooltipRoot({
  children,
  open,
  onOpenChange,
  defaultOpen = false,
  openOn = 'longPress',
  duration = DEFAULT_DURATION,
  label,
}: TooltipProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [trigger, setTrigger] = useState<TriggerRect | null>(null);
  const [placement, setPlacement] = useState<TooltipPlacement>('top');
  const [arrowOffset, setArrowOffset] = useState(0);

  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const show = useCallback(() => setOpen(true), [setOpen]);
  const hide = useCallback(() => setOpen(false), [setOpen]);

  // A tooltip is not a thing you deal with, so it hides itself after a beat.
  // The timer is armed on open and cleared on close, and `duration` of 0 opts
  // out — for a tooltip that stays until the next tap.
  useEffect(() => {
    if (!resolvedOpen || duration <= 0) return;
    const timer = setTimeout(() => setOpen(false), duration);
    return () => clearTimeout(timer);
  }, [resolvedOpen, duration, setOpen]);

  const context = useMemo(
    () => ({
      open: resolvedOpen,
      show,
      hide,
      trigger,
      setTrigger,
      placement,
      setPlacement,
      arrowOffset,
      setArrowOffset,
      openOn,
      label,
    }),
    [resolvedOpen, show, hide, trigger, placement, arrowOffset, openOn, label]
  );

  return <TooltipContext.Provider value={context}>{children}</TooltipContext.Provider>;
}

export interface TooltipTriggerProps {
  children: ReactElement<{
    onPress?: (...args: unknown[]) => void;
    onLongPress?: (...args: unknown[]) => void;
    accessibilityLabel?: string;
    accessibilityHint?: string;
  }>;
}

/**
 * Wraps its child and reveals the label on it — a long press by default, a
 * press when the root asks for one. It is also what gets measured, so the
 * label knows where to sit.
 *
 * The child is wrapped in a view rather than handed a ref: the ref has to
 * survive whatever the child is — a button, a plain Pressable, an icon — and
 * only a wrapper we own is guaranteed to be measurable.
 */
function TooltipTrigger({ children }: TooltipTriggerProps) {
  const { open, show, hide, setTrigger, openOn, label } = useTooltip('Tooltip.Trigger');
  const ref = useRef<View>(null);

  const measureThenShow = () => {
    // Measured on every open rather than on layout: the trigger may have
    // scrolled since it was laid out, and a stale rect anchors the label to
    // where the trigger used to be.
    ref.current?.measureInWindow((x, y, width, height) => {
      setTrigger({ x, y, width, height });
      show();
    });
  };

  const handleLongPress = (...args: unknown[]) => {
    if (isValidElement(children)) children.props.onLongPress?.(...args);
    if (openOn === 'longPress') measureThenShow();
  };

  const handlePress = (...args: unknown[]) => {
    if (isValidElement(children)) children.props.onPress?.(...args);
    if (openOn !== 'press') return;
    if (open) hide();
    else measureThenShow();
  };

  if (!isValidElement(children)) return <>{children}</>;

  return (
    <View ref={ref} collapsable={false}>
      {cloneElement(children, {
        onPress: handlePress,
        onLongPress: handleLongPress,
        // An icon-only trigger has nothing for a screen reader to read; the
        // label fills that in without the sighted user having to open it.
        accessibilityLabel: children.props.accessibilityLabel ?? label,
      })}
    </View>
  );
}

export interface TooltipContentProps extends ViewProps {
  className?: string;
  /** Preferred side of the trigger. Flipped when that side does not fit. */
  placement?: TooltipPlacement;
  /** Where the label sits along the trigger's other axis. */
  align?: TooltipAlign;
  /** Gap between the trigger and the label, in pixels. */
  offset?: number;
  /** Nudge along the alignment axis, in pixels. */
  alignOffset?: number;
  children?: ReactNode;
}

function TooltipContent({
  className,
  placement = 'top',
  align = 'center',
  offset = DEFAULT_OFFSET,
  alignOffset = 0,
  children,
  onLayout: onLayoutProp,
  style,
  ...props
}: TooltipContentProps) {
  const context = useTooltip('Tooltip.Content');
  const { open, hide, trigger, setPlacement, setArrowOffset } = context;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  // Label size changes with its text, so it is re-measured rather than measured
  // once — a tooltip whose text is swapped should not stay the old size.
  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setSize((current) =>
      current && Math.abs(current.width - w) < 1 && Math.abs(current.height - h) < 1
        ? current
        : { width: w, height: h }
    );
    onLayoutProp?.(event);
  };

  const bounds = {
    left: insets.left + SCREEN_MARGIN,
    right: screenWidth - insets.right - SCREEN_MARGIN,
    top: insets.top + SCREEN_MARGIN,
    bottom: screenHeight - insets.bottom - SCREEN_MARGIN,
  };

  const position =
    trigger && size
      ? place({ trigger, size, placement, align, offset, alignOffset, bounds })
      : null;

  // Publish the side actually used and where the trigger centre landed, so the
  // arrow points at the trigger even after a flip or a clamp.
  const resolvedPlacement = position?.placement;
  const resolvedArrow = position?.arrowOffset;
  useEffect(() => {
    if (resolvedPlacement) setPlacement(resolvedPlacement);
    if (resolvedArrow !== undefined) setArrowOffset(resolvedArrow);
  }, [resolvedPlacement, resolvedArrow, setPlacement, setArrowOffset]);

  /*
   * The entrance is driven by hand rather than by an `entering` preset, and the
   * reason is the measuring frame. A layout animation fires on mount — which
   * here is the frame *before* the label knows where it goes, so the whole
   * animation would play at the origin, invisibly, and the label would then
   * snap into place fully formed. Holding the values until a position exists is
   * the only way to have both the animation and the correct position.
   */
  const appear = useSharedValue(0);
  const settle = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const placed = !!position;

  useEffect(() => {
    if (!placed) {
      appear.value = 0;
      settle.value = 0;
      return;
    }
    if (reducedMotion) {
      appear.value = 1;
      settle.value = 1;
      return;
    }
    appear.value = withTiming(1, { duration: 100 });
    settle.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.5 });
  }, [placed, reducedMotion, appear, settle]);

  // Starts slightly small and shifted towards the trigger, so the label
  // appears to unfold from it rather than fade in over it.
  const origin = ENTRY_SHIFT[resolvedPlacement ?? placement];
  const labelStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { translateX: origin.x * (1 - settle.value) },
      { translateY: origin.y * (1 - settle.value) },
      { scale: 0.9 + 0.1 * settle.value },
    ],
  }));

  if (!open || !trigger) return null;

  return (
    <Portal>
      {/* Portal content mounts under PortalHost, outside this provider's
          subtree — re-provide the context so Tooltip.Arrow keeps working. */}
      <TooltipContext.Provider value={context}>
        <View className="absolute inset-0">
          {/* No scrim — a tooltip does not dim the screen. The transparent
              catcher only lets a tap anywhere dismiss the label. */}
          <Pressable
            accessibilityLabel="Dismiss"
            className="absolute inset-0"
            onPress={hide}
          />
          {/*
            Two views, not one: a Reanimated rule forbids a layout animation and
            an animated style driving the same property on one component, or the
            layout animation silently wins. The exit fade and `labelStyle`'s
            opacity both want it — so the outer view owns the position and the
            exit, the inner one the entrance and the label's own surface.
          */}
          <Animated.View
            exiting={FadeOut.duration(100)}
            onLayout={onLayout}
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              // Until it has measured itself the label has no honest position,
              // so it is laid out off-screen rather than at the origin.
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              maxWidth: bounds.right - bounds.left,
            }}
          >
            <Animated.View
              accessibilityRole="text"
              style={[labelStyle, style]}
              className={cn(
                'rounded-lg bg-foreground px-2.5 py-1.5 shadow-md',
                className
              )}
              {...props}
            >
              {typeof children === 'string' ? (
                <TooltipText>{children}</TooltipText>
              ) : (
                children
              )}
            </Animated.View>
          </Animated.View>
        </View>
      </TooltipContext.Provider>
    </Portal>
  );
}

/** The label's default text: small and inverted against the dark surface. */
const TooltipText = ({ className, ...props }: TextProps) => (
  <Text size="sm" weight="medium" className={cn('text-background', className)} {...props} />
);
TooltipText.displayName = 'Tooltip.Text';

export interface TooltipArrowProps extends ViewProps {
  className?: string;
}

/**
 * A small square rotated into a diamond, half-buried under the label so only
 * the point shows. It shares the label's fill and points at the trigger's
 * centre, which Content resolves and publishes — so when `align` shifts the
 * label off-centre, or a clamp slides it back on screen, the arrow stays over
 * the trigger rather than over the label's middle.
 */
function TooltipArrow({ className, style, ...props }: TooltipArrowProps) {
  const { trigger, placement, arrowOffset } = useTooltip('Tooltip.Arrow');
  if (!trigger) return null;

  const vertical = placement === 'top' || placement === 'bottom';
  // The arrow sits on the edge facing the trigger, the opposite edge to the
  // placement: a label placed above the trigger has its arrow on the bottom.
  const edge = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[placement];

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          position: 'absolute',
          [edge]: -ARROW_SIZE / 2,
          width: ARROW_SIZE,
          height: ARROW_SIZE,
          transform: [{ rotate: '45deg' }],
          // Centred on the trigger along the cross axis. `marginLeft/Top` backs
          // it off by half its own size so `arrowOffset` lands on its centre.
          ...(vertical
            ? { left: arrowOffset, marginLeft: -ARROW_SIZE / 2 }
            : { top: arrowOffset, marginTop: -ARROW_SIZE / 2 }),
        },
        style,
      ]}
      className={cn('rounded-[1px] bg-foreground', className)}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Placement                                                                  */
/* -------------------------------------------------------------------------- */

interface PlaceArgs {
  trigger: TriggerRect;
  size: { width: number; height: number };
  placement: TooltipPlacement;
  align: TooltipAlign;
  offset: number;
  alignOffset: number;
  bounds: { left: number; right: number; top: number; bottom: number };
}

/**
 * Resolves the label's window position.
 *
 * Two passes, in this order: the flip picks a *side* and only fires when the
 * preferred one genuinely has less room than its opposite; the clamp then
 * slides the label along the other axis to keep it on screen. Doing the clamp
 * first would let a label be nudged inside the bounds and so look like it fits,
 * hiding the fact that the wrong side was chosen.
 */
function place({ trigger, size, placement, align, offset, alignOffset, bounds }: PlaceArgs) {
  const roomAfter = {
    bottom: bounds.bottom - (trigger.y + trigger.height + offset),
    top: trigger.y - offset - bounds.top,
    right: bounds.right - (trigger.x + trigger.width + offset),
    left: trigger.x - offset - bounds.left,
  };
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;

  const needed = placement === 'top' || placement === 'bottom' ? size.height : size.width;
  const resolved =
    roomAfter[placement] < needed && roomAfter[opposite[placement]] > roomAfter[placement]
      ? opposite[placement]
      : placement;

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, Math.max(min, max)));

  if (resolved === 'top' || resolved === 'bottom') {
    const top =
      resolved === 'bottom'
        ? trigger.y + trigger.height + offset
        : trigger.y - size.height - offset;

    const left =
      align === 'start'
        ? trigger.x + alignOffset
        : align === 'end'
          ? trigger.x + trigger.width - size.width + alignOffset
          : trigger.x + trigger.width / 2 - size.width / 2 + alignOffset;

    const clampedLeft = clamp(left, bounds.left, bounds.right - size.width);
    const triggerCentreX = trigger.x + trigger.width / 2;

    return {
      placement: resolved,
      top: clamp(top, bounds.top, bounds.bottom - size.height),
      left: clampedLeft,
      arrowOffset: clamp(triggerCentreX - clampedLeft, ARROW_SIZE, size.width - ARROW_SIZE),
    };
  }

  const left =
    resolved === 'right' ? trigger.x + trigger.width + offset : trigger.x - size.width - offset;

  const top =
    align === 'start'
      ? trigger.y + alignOffset
      : align === 'end'
        ? trigger.y + trigger.height - size.height + alignOffset
        : trigger.y + trigger.height / 2 - size.height / 2 + alignOffset;

  const clampedTop = clamp(top, bounds.top, bounds.bottom - size.height);
  const triggerCentreY = trigger.y + trigger.height / 2;

  return {
    placement: resolved,
    top: clampedTop,
    left: clamp(left, bounds.left, bounds.right - size.width),
    arrowOffset: clamp(triggerCentreY - clampedTop, ARROW_SIZE, size.height - ARROW_SIZE),
  };
}

/**
 * Where the label starts, relative to where it ends: towards the trigger, on
 * whichever side was resolved, so it appears to grow out of the control.
 */
const ENTRY_SHIFT: Record<TooltipPlacement, { x: number; y: number }> = {
  bottom: { x: 0, y: -6 },
  top: { x: 0, y: 6 },
  right: { x: -6, y: 0 },
  left: { x: 6, y: 0 },
};

export const Tooltip = Object.assign(TooltipRoot, {
  Trigger: TooltipTrigger,
  Content: TooltipContent,
  Arrow: TooltipArrow,
  Text: TooltipText,
});
