import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Pressable, useWindowDimensions, View, type ViewProps } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tv } from 'tailwind-variants';
import { getNativeUI } from '../../native';
import { XIcon } from '../../icons';
import { Portal } from '../../primitives/portal';
import { Scrim } from '../../primitives/scrim';
import { cn } from '../../utils/cn';

const SPRING = { damping: 22, stiffness: 280, mass: 0.7 } as const;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

const sheetVariants = tv({
  base: 'border border-border bg-popover px-5 pt-2 shadow-lg',
  variants: {
    detached: {
      // Docked: the sheet is continuous with the bottom of the screen, so the
      // bottom edge is not a real edge and drawing a line along it would be a
      // rule through the middle of nothing.
      false: 'rounded-t-3xl border-b-0',
      // Floating: all four edges are real, so all four are drawn and all four
      // corners are rounded.
      true: 'mx-4 mb-6 rounded-3xl',
    },
  },
  defaultVariants: {
    detached: false,
  },
});

interface BottomSheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const BottomSheetContext = createContext<BottomSheetContextValue | null>(null);

function useBottomSheet(component: string): BottomSheetContextValue {
  const context = useContext(BottomSheetContext);
  if (!context) {
    throw new Error(`${component} must be used within a <BottomSheet>`);
  }
  return context;
}

export interface BottomSheetProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  /**
   * Present the platform's own sheet instead of this one, so it gets the
   * system's detents, scroll interaction and dismiss gesture. Requires the
   * optional `@expo/ui` package; without it this prop does nothing.
   *
   * **Theme tokens do not apply to the sheet chrome** — the platform draws the
   * container, so `BottomSheet.Content`'s `className` and its drag handle are
   * ignored. The content inside is still yours.
   */
  native?: boolean;
  /**
   * Heights the native sheet can rest at. Omit to size to the content.
   * `{ fraction }` and `{ height }` are iOS-only; Android snaps them to the
   * nearest of `half` / `full`.
   */
  snapPoints?: ('half' | 'full' | { fraction: number } | { height: number })[];
}

/**
 * Roughly how tall the platform will make the sheet at a given detent, as a
 * fraction of the screen. Approximate on purpose — it is used as a floor for
 * the content, not as the sheet's real height, which the platform owns.
 */
const DETENT_FRACTION = { half: 0.5, full: 0.9 } as const;

/**
 * The height the content should at least fill for a given set of detents.
 *
 * Without this the hosted content sizes to itself and the platform centres
 * that smaller box inside the taller sheet, which is why a short sheet shows
 * its content floating in the middle. Filling the detent leaves nothing to
 * centre, so the content sits where it was written: at the top.
 */
function detentFloor(
  snapPoints: BottomSheetProps['snapPoints'],
  screenHeight: number
): number | undefined {
  if (!snapPoints?.length) return undefined;

  // The sheet opens at its first detent, so that is the one to fill.
  const first = snapPoints[0];
  if (first === 'half' || first === 'full') {
    return screenHeight * DETENT_FRACTION[first];
  }
  if (typeof first === 'object' && 'fraction' in first) {
    return screenHeight * first.fraction;
  }
  if (typeof first === 'object' && 'height' in first) return first.height;
  return undefined;
}

/**
 * Set by the root so Content knows the platform is drawing the sheet, and with
 * which detents. Null means the styled sheet renders.
 */
const NativeSheetContext = createContext<{
  nativeUI: NonNullable<ReturnType<typeof getNativeUI>>;
  snapPoints: BottomSheetProps['snapPoints'];
} | null>(null);

function BottomSheetRoot({
  children,
  open,
  onOpenChange,
  defaultOpen = false,
  native,
  snapPoints,
}: BottomSheetProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const context = useMemo(
    () => ({ open: resolvedOpen, setOpen }),
    [resolvedOpen, setOpen]
  );

  const nativeUI = native ? getNativeUI() : null;
  const nativeSheet = useMemo(
    () => (nativeUI ? { nativeUI, snapPoints } : null),
    [nativeUI, snapPoints]
  );

  return (
    <BottomSheetContext.Provider value={context}>
      <NativeSheetContext.Provider value={nativeSheet}>
        {children}
      </NativeSheetContext.Provider>
    </BottomSheetContext.Provider>
  );
}

interface BottomSheetTriggerProps {
  children: ReactElement<{ onPress?: (...args: unknown[]) => void }>;
}

function BottomSheetTrigger({ children }: BottomSheetTriggerProps) {
  const { setOpen } = useBottomSheet('BottomSheet.Trigger');
  if (!isValidElement(children)) return children;

  return cloneElement(children, {
    onPress: (...args: unknown[]) => {
      children.props.onPress?.(...args);
      setOpen(true);
    },
  });
}

export interface BottomSheetContentProps extends ViewProps {
  className?: string;
  /** Tap on the backdrop closes the sheet. Default true. */
  dismissible?: boolean;
  /**
   * Show a close button in the top-right corner. On by default for the styled
   * sheet; ignored by the native sheet, which has its own dismiss affordances.
   */
  showClose?: boolean;
  /**
   * Float the sheet clear of the screen edges instead of docking it to the
   * bottom, so it reads as a card laid over the app rather than a drawer
   * pulled out of it. All four corners round and the bottom border comes back,
   * since a floating sheet has four real edges where a docked one has three.
   * Ignored by the native sheet, which the platform positions itself.
   */
  detached?: boolean;
  /**
   * Frost the screen behind the sheet instead of dimming it, so what is behind
   * stays legible as shape and colour while losing its detail. Needs the
   * optional `expo-blur`; without it this dims, rather than failing.
   */
  blur?: boolean;
  children?: ReactNode;
}

function BottomSheetContent({
  className,
  dismissible = true,
  showClose = true,
  detached = false,
  blur = false,
  children,
  ...props
}: BottomSheetContentProps) {
  const context = useBottomSheet('BottomSheet.Content');
  const { open, setOpen } = context;
  const nativeSheet = useContext(NativeSheetContext);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const closeTint = useCSSVariable('--color-muted-foreground');

  const close = useCallback(() => setOpen(false), [setOpen]);

  /*
   * The offset survives a close — the early return below sits after every
   * hook, so this component keeps its state while the sheet is hidden. A
   * swipe-dismiss leaves it parked a screen height down, and without this the
   * next open would draw the sheet below the fold behind a full backdrop:
   * a dimmed screen with nothing on it and no reachable close button.
   */
  useEffect(() => {
    if (open) translateY.value = 0;
  }, [open, translateY]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        /*
         * A drag has to travel before it takes the touch. This detector wraps
         * the whole sheet, close button included, and an unqualified Pan
         * activates on a few pixels of drift — cancelling the press the button
         * is in the middle of, so a tap with any finger travel does nothing.
         */
        .activeOffsetY([-12, 12])
        .onChange((event) => {
          // Rubber-band when dragging upward, follow the finger downward.
          const next = translateY.value + event.changeY;
          translateY.value = next > 0 ? next : next / 3;
        })
        .onEnd((event) => {
          if (
            translateY.value > DISMISS_DISTANCE ||
            event.velocityY > DISMISS_VELOCITY
          ) {
            translateY.value = withTiming(screenHeight, { duration: 200 }, () => {
              runOnJS(close)();
            });
          } else {
            translateY.value = withSpring(0, SPRING);
          }
        }),
    // Rebuilt only when one of these changes. Built inline it would be a new
    // gesture on every render — and the sheet re-renders while it is being
    // used, each time re-attaching the handler and dropping the live touch.
    [close, screenHeight, translateY]
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (nativeSheet) {
    const { Host, BottomSheet: NativeBottomSheet, RNHostView } = nativeSheet.nativeUI;
    // The platform owns presentation, so this stays mounted and toggles
    // isPresented rather than unmounting on close.
    //
    // RNHostView is not optional: our content is React Native, and the native
    // sheet cannot measure RN views directly. Without it the sheet sizes to
    // nothing and the content spills outside its container.
    return (
      <Host matchContents style={{ position: 'absolute' }}>
        <NativeBottomSheet
          isPresented={open}
          onDismiss={dismissible ? close : () => {}}
          snapPoints={nativeSheet.snapPoints}
        >
          <RNHostView matchContents>
            <BottomSheetContext.Provider value={context}>
              <View
                {...props}
                className={cn(
                  // The platform draws the container, but it hands us a bare
                  // box — padding and safe-area are still ours. The top
                  // padding has to clear the platform's grabber, which sits
                  // inside the sheet rather than above the content.
                  'justify-start gap-2 px-5 pb-2 pt-5',
                  className
                )}
                style={{
                  // An explicit width, not `w-full`. Inside the native host
                  // there is no parent width for a percentage to resolve
                  // against, so `100%` measures against nothing and the
                  // content lays out wider than the sheet it sits in.
                  width: screenWidth,
                  minHeight: detentFloor(nativeSheet.snapPoints, screenHeight),
                  paddingBottom: Math.max(insets.bottom, 16),
                }}
              >
                {children}
              </View>
            </BottomSheetContext.Provider>
          </RNHostView>
        </NativeBottomSheet>
      </Host>
    );
  }

  if (!open) return null;

  return (
    <Portal>
      {/* Portal content mounts under PortalHost, outside this provider's
          subtree — re-provide the context so nested consumers keep working. */}
      <BottomSheetContext.Provider value={context}>
        <View className="absolute inset-0 justify-end">
        <View className="absolute inset-0">
          {/* Scrim draws the backdrop and its own fade; the Pressable over it
              is what closes the sheet, since the scrim takes no touches. */}
          <Scrim blur={blur} />
          <Pressable
            accessibilityLabel="Close sheet"
            className="flex-1"
            onPress={dismissible ? close : undefined}
          />
        </View>
        <GestureDetector gesture={pan}>
          <Animated.View
            entering={SlideInDown.springify().damping(22).stiffness(240).mass(0.8)}
            exiting={SlideOutDown.duration(200)}
            accessibilityViewIsModal
            className={sheetVariants({ detached, className })}
            {...props}
            // After the spread, and with the caller's own style folded in
            // rather than replacing the array: spread last, a caller passing
            // `style` for a height would silently drop the drag transform and
            // the safe-area padding with it.
            style={[
              sheetStyle,
              // A detached sheet's own bottom margin already clears the home
              // indicator, so it takes plain padding rather than stacking the
              // inset on top of the gap.
              { paddingBottom: detached ? 16 : Math.max(insets.bottom, 16) },
              props.style,
            ]}
          >
            <View className="mb-3 self-center">
              <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </View>
            {showClose ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={close}
                hitSlop={8}
                className="absolute right-4 top-3 h-8 w-8 items-center justify-center rounded-full bg-muted active:opacity-70"
              >
                <XIcon size={16} color={typeof closeTint === 'string' ? closeTint : undefined} />
              </Pressable>
            ) : null}
            {children}
          </Animated.View>
        </GestureDetector>
        </View>
      </BottomSheetContext.Provider>
    </Portal>
  );
}

export const BottomSheet = Object.assign(BottomSheetRoot, {
  Trigger: BottomSheetTrigger,
  Content: BottomSheetContent,
});
