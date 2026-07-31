/**
 * Panelside — a navigation panel that moves the app aside instead of covering
 * it.
 *
 * ```tsx
 * <Panelside>
 *   <Panelside.Panel>
 *     <Panelside.Header title="Assistant">
 *       <Panelside.Search value={query} onChangeText={setQuery} />
 *     </Panelside.Header>
 *     <Panelside.Content>
 *       <Panelside.Group>
 *         <Panelside.GroupLabel>Recents</Panelside.GroupLabel>
 *         <Panelside.Item label="Launch thread" />
 *       </Panelside.Group>
 *     </Panelside.Content>
 *     <Panelside.Footer>
 *       <Panelside.Cta label="New chat" onPress={compose} />
 *     </Panelside.Footer>
 *   </Panelside.Panel>
 *
 *   <Panelside.Scene>
 *     <Panelside.Trigger />
 *     <Conversation />
 *   </Panelside.Scene>
 * </Panelside>
 * ```
 *
 * ## Why it is not a Drawer
 *
 * A drawer is an overlay: it mounts through a portal, lands above everything
 * and dims what it hid. That is the wrong shape here, because the whole point
 * of this pattern is that the app *stays legible* — it slides across, shrinks,
 * rounds its corners and waits, so the panel reads as a layer behind the app
 * rather than a sheet on top of it. A portal cannot do that: its content is
 * above the app content by construction, and the app content is somewhere else
 * in the tree entirely, unreachable.
 *
 * So Panelside owns both halves. It renders inline, keeps the panel and the
 * app screen as siblings under one clipping container, and gives them a single
 * `progress` value to move against. `Panelside.Scene` is the wrapper you put
 * around your own screen; without it there is nothing to push, which is why it
 * is explicit rather than inferred.
 *
 * ## The scene maths
 *
 * React Native scales a view about its centre, so a scene scaled to `s` has
 * already pulled its left edge `W * (1 - s) / 2` inward before any translation
 * is applied. Translating by the panel width alone would therefore leave a gap
 * that grows with the scale, and the panel would look mis-measured. Subtracting
 * that inset is what puts the scene's *visible* edge exactly where the panel
 * ends:
 *
 *     scale      = 1 - (1 - s) * p
 *     translateX = p * (width + gap) - W * (1 - scale) / 2
 *
 * Both are driven from one shared value, so a half-finished drag is a real
 * halfway state rather than an interpolation between two snapshots.
 *
 * ## One gesture, both directions
 *
 * A single pan opens and closes. By default it listens across the whole
 * surface, because that is the behaviour this pattern is known for: a sideways
 * drag anywhere on the app brings the panel in, from wherever your thumb
 * already was. What keeps a list usable underneath it is the pair of
 * thresholds — the drag gives itself up on twelve points of vertical travel
 * and only claims the touch at fourteen horizontal, so anything even slightly
 * vertical resolves as a scroll.
 *
 * `swipeFrom="edge"` narrows the closed-state hit area to a strip at the
 * leading screen edge instead. That is for a scene with its own use for a
 * horizontal drag — a carousel, a wide table, a pannable chart — which would
 * otherwise fight the panel and lose.
 *
 * Reanimated's default `ReduceMotion.System` applies throughout: with the
 * accessibility setting on, every spring here resolves instantly to its target
 * rather than travelling.
 */
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
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type ScrollViewProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tv } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { LinearGradient } from 'expo-linear-gradient';
import { EllipsisIcon, IconColorProvider, MenuIcon, SearchIcon } from '../../icons';
import { Button } from '../button';
import { AnimatedPressable } from '../../primitives/animated-pressable';
import { Text, textChildren } from '../../primitives/text';
import { useBackHandler } from '../../hooks/use-back-handler';
import { useDirectionSign } from '../../hooks/use-direction';
import { cn } from '../../utils/cn';

const SPRING = { damping: 24, stiffness: 300, mass: 0.7 } as const;

/**
 * How wide the leading-edge strip that starts a swipe is, in points.
 *
 * Wider than the system's own edge gestures, because this one has to be found
 * without a bezel to feel for: a thumb reaching for the side of a phone lands
 * anywhere in the first 40-odd points, and a strip narrower than that reads as
 * a gesture that does not work rather than one that was missed.
 */
const EDGE_WIDTH = 48;
/** A drag has to clear this before releasing it changes the open state. */
const COMMIT_DISTANCE = 60;
/** A flick this fast commits regardless of how far it got. */
const COMMIT_VELOCITY = 500;
/**
 * How much travel claims the drag, and how much gives it up — different on
 * each axis, and different again depending on where the swipe may start.
 *
 * From the edge strip the horizontal claim is small and the vertical give-up
 * generous: the target is narrow, so the gesture has to win early, and nobody
 * swipes in a straight line from the side of a phone.
 *
 * From anywhere the numbers invert, because now the whole screen is competing.
 * Giving up sooner than it claims is what makes a lazy diagonal resolve as a
 * scroll rather than as the panel: a list keeps every drag that is even
 * slightly vertical, and only a deliberate sideways one opens the panel.
 */
const OFFSETS = {
  edge: { activate: 6, fail: 16 },
  anywhere: { activate: 14, fail: 12 },
} as const;
/** Below this the drag is a tap that wobbled, and velocity is not consulted. */
const MIN_OFFSET = 5;

/** Gap left between the panel's edge and the pushed scene. */
const GAP = 12;
/** How small the scene gets at full travel. */
const SCENE_SCALE = 0.92;
/** The corner radius the scene picks up at full travel. */
const SCENE_RADIUS = 28;
/** How far the scene is dimmed at full travel. */
const SCENE_DIM = 0.45;

/**
 * How far behind the scene the panel starts.
 *
 * The panel is never actually off-screen in push mode — it is simply covered.
 * Moving it a little anyway is what stops the reveal reading as a photograph
 * sliding off a poster: the two layers travel at different rates, so the panel
 * settles into place rather than having been there all along.
 */
const PARALLAX = 0.18;

/**
 * Fraction of the container the panel takes, and the cap it never passes.
 *
 * Wide on purpose. The sliver of app left showing is not a preview of it — it
 * is a handle and a reminder, and the moment it is wide enough to read as a
 * column the screen turns into a two-pane layout that neither pane fits. The
 * cap keeps that true on a tablet, where the fraction alone would produce a
 * navigation list with a field of whitespace beside it.
 */
const WIDTH_FRACTION = 0.8;
const WIDTH_MAX = 360;

/**
 * The same, for a docked panel — and nothing like it, because the job changed.
 *
 * An overlay panel can take most of the width, since the app is behind it and
 * gets it all back on close. A docked panel keeps what it takes: every point
 * of it is a point the app does not have, and 80% of the container leaves a
 * column too narrow to put anything in. A third, capped, is a sidebar.
 */
const DOCK_WIDTH_FRACTION = 0.32;
const DOCK_WIDTH_MAX = 320;

/** How far above the floating footer the list starts dissolving into it. */
const FOOTER_FADE = 28;

/** Progress past which a layer is treated as fully hidden for accessibility. */
const HIDDEN_EPSILON = 0.05;

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

export type PanelsideMode = 'push' | 'overlay';
export type PanelsideSwipeFrom = 'anywhere' | 'edge';

const itemVariants = tv({
  // No width: in a group it stretches on its own, and pinning it to full width
  // would stop it sharing a footer row with anything else. `shrink` because
  // React Native defaults `flexShrink` to 0 — in a footer beside a button, on a
  // panel narrow enough for the two not to fit, nothing would give way and
  // both would simply hang off the edge.
  base: 'shrink flex-row items-center gap-3 rounded-xl px-3 py-2.5',
  variants: {
    active: { true: 'bg-secondary' },
    disabled: { true: 'opacity-40' },
  },
});

const ctaVariants = tv({
  // Taller and wider than a list row's control, and set a step up. It is the
  // one thing in the panel you are meant to reach for without reading, so it
  // should not be the same size as the eight chat titles above it.
  base: 'h-12 shrink flex-row items-center justify-center gap-2 rounded-full px-6',
  variants: {
    variant: {
      primary: 'bg-primary',
      secondary: 'bg-secondary',
    },
  },
  defaultVariants: {
    variant: 'primary',
  },
});

interface PanelsideContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** 0 closed, 1 open. The one value every layer animates against. */
  progress: SharedValue<number>;
  /** Panel width in points. */
  width: number;
  mode: PanelsideMode;
  /** True when the panel is laid out beside the scene rather than behind it. */
  docked: boolean;
  dismissible: boolean;
}

const PanelsideContext = createContext<PanelsideContextValue | null>(null);

function usePanelsideContext(component: string): PanelsideContextValue {
  const context = useContext(PanelsideContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Panelside>`);
  }
  return context;
}

export interface UsePanelsideResult {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /**
   * How far the panel has travelled, 0 to 1, on the UI thread. Read it to move
   * something of your own with the panel — a header that fades, a title that
   * slides — without a re-render per frame.
   */
  progress: SharedValue<number>;
  /** True while the panel is docked open beside the scene. */
  docked: boolean;
}

/**
 * The panel's state, from anywhere inside a `<Panelside>` — including your own
 * screen inside `Panelside.Scene`, which is where a custom open button usually
 * lives.
 */
export function usePanelside(): UsePanelsideResult {
  const { open, setOpen, toggle, progress, docked } = usePanelsideContext('usePanelside');
  return { open, setOpen, toggle, progress, docked };
}

/**
 * What the panel's own parts share: the floating footer's height, so the
 * scroller can leave room for it. The footer overlays the list rather than
 * taking a row of its own, which means nothing else can know how tall it is
 * until it has laid itself out.
 */
interface PanelsideSurfaceValue {
  footerHeight: number;
  setFooterHeight: (height: number) => void;
}

const PanelsideSurfaceContext = createContext<PanelsideSurfaceValue | null>(null);

export interface PanelsideProps {
  children: ReactNode;
  /** Open state, when you want to own it. Pair with `onOpenChange`. */
  open?: boolean;
  /** Called with the next open state, whether a gesture or you caused it. */
  onOpenChange?: (open: boolean) => void;
  /** Open state to start at when you are not controlling it. */
  defaultOpen?: boolean;
  /**
   * How the two layers relate. `push` moves the scene aside and curves it,
   * which is the point of this component. `overlay` slides the panel over a
   * scene that stays put — the same navigation, for a screen whose content
   * cannot afford to move.
   */
  mode?: PanelsideMode;
  /**
   * Panel width in points. Defaults to 80% of the container capped at 360,
   * and to a third of it capped at 320 once docked — an overlay panel gives
   * the width back when it closes and a docked one keeps it, so they are not
   * the same measurement. The caps are what stop a tablet getting a navigation
   * list with a field of whitespace beside it.
   */
  width?: number;
  /**
   * Container width at or above which the panel stops being an overlay and
   * becomes a permanent sidebar: laid out beside the scene, always open, with
   * the gesture and the trigger switched off. A docked panel also narrows to a
   * third of the container, capped at 320 — docked, every point it takes is a
   * point the app does not get back.
   *
   * Off by default, and deliberately not a guess — a large phone in landscape
   * is wider than a small tablet in portrait, so no single number is right for
   * every app. Set it high enough that what is left over is still a screen:
   * around 700 is the first width where both halves have room.
   */
  dock?: number | false;
  /** Swipe to open, and drag the scene to close. Default true. */
  swipeEnabled?: boolean;
  /**
   * Where a swipe may begin. `anywhere` is the default and the behaviour this
   * pattern is known for — a sideways drag across the app opens the panel from
   * wherever your thumb already was.
   *
   * `edge` narrows it to a strip at the leading screen edge, for a scene that
   * has its own use for a horizontal drag: a carousel, a wide table, a chart
   * you can pan. Anything like that under an `anywhere` panel will fight it,
   * and the panel usually wins.
   */
  swipeFrom?: PanelsideSwipeFrom;
  /**
   * How wide the leading-edge strip that starts a swipe is, when `swipeFrom`
   * is `edge`. Default 48 — wider than the system's own edge gestures, because
   * there is no bezel to feel for. Ignored otherwise.
   */
  edgeWidth?: number;
  /**
   * Tapping the pushed scene, or the Android back button, closes the panel.
   * Default true.
   */
  dismissible?: boolean;
  className?: string;
}

function PanelsideRoot({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  mode = 'push',
  width: widthProp,
  dock = false,
  swipeEnabled = true,
  swipeFrom = 'anywhere',
  edgeWidth = EDGE_WIDTH,
  dismissible = true,
  className,
}: PanelsideProps) {
  const { width: windowWidth } = useWindowDimensions();
  const sign = useDirectionSign();

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : uncontrolledOpen;

  /*
   * Measured rather than taken from the window, because Panelside does not
   * have to be the whole screen — it can be one tab of a larger layout, and
   * the push distance is a fraction of whatever it actually got. The window
   * width is only the value to use until the first layout arrives.
   */
  const [containerWidth, setContainerWidth] = useState(windowWidth);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const docked = dock !== false && containerWidth >= dock;
  const width =
    widthProp ??
    (docked
      ? Math.min(containerWidth * DOCK_WIDTH_FRACTION, DOCK_WIDTH_MAX)
      : Math.min(containerWidth * WIDTH_FRACTION, WIDTH_MAX));

  /**
   * How far the drag runs. In push mode the scene clears the gap too.
   *
   * Floored at 1 because it is a divisor: a container measured at zero — one
   * frame during a collapsed layout is enough — would otherwise make progress
   * infinite and park both layers somewhere off the screen for good.
   */
  const extent = Math.max(1, mode === 'push' ? width + GAP : width);

  const translation = useSharedValue(open ? extent : 0);
  const progress = useDerivedValue(() => translation.value / extent, [extent]);

  /*
   * Which end state a spring is already heading for, so the effect below does
   * not restart an animation the gesture just launched with velocity. Without
   * it, committing a flick re-springs from mid-flight at zero velocity, which
   * is visible as a stutter right where the motion should feel fastest.
   */
  const animatingTo = useSharedValue<'open' | 'close' | null>(null);

  const settle = useCallback(
    (next: boolean, velocity?: number) => {
      'worklet';
      const target = next ? extent : 0;
      if (translation.value === target) return;
      if (animatingTo.value === (next ? 'open' : 'close')) return;

      /*
       * A velocity pointing away from the target would fight the spring, and
       * the spring wins — so the only thing it contributes is a hitch at the
       * start. Drop it and let the spring do the whole trip.
       */
      const aligned =
        velocity !== undefined &&
        ((target > translation.value && velocity > 0) ||
          (target < translation.value && velocity < 0));

      animatingTo.value = next ? 'open' : 'close';
      translation.value = withSpring(
        target,
        { ...SPRING, velocity: aligned ? velocity : 0 },
        () => {
          animatingTo.value = null;
        }
      );
    },
    [animatingTo, extent, translation]
  );

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange]
  );

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useBackHandler(open && dismissible && !docked, close);

  /*
   * A docked panel is open by definition, and it must not animate there — on
   * a rotation into a docked layout the panel is already beside the scene, so
   * a spring would slide furniture that never moved.
   */
  useEffect(() => {
    if (docked) {
      translation.value = extent;
      return;
    }
    settle(open);
  }, [docked, extent, open, settle, translation]);

  const offsets = OFFSETS[swipeFrom];

  const pan = useMemo(() => {
    let gesture = Gesture.Pan()
      .enabled(swipeEnabled && !docked)
      .activeOffsetX([-offsets.activate, offsets.activate])
      // Real vertical intent hands the touch back, so a list inside the panel
      // and a scroller inside the app both keep their own drags.
      .failOffsetY([-offsets.fail, offsets.fail])
      .onChange((event) => {
        translation.value = clamp(translation.value + event.changeX * sign, 0, extent);
      })
      .onEnd((event) => {
        const distance = event.translationX * sign;
        const velocity = event.velocityX * sign;
        const decisive =
          (Math.abs(distance) > MIN_OFFSET && Math.abs(velocity) > COMMIT_VELOCITY) ||
          Math.abs(distance) > COMMIT_DISTANCE;
        // Below the threshold the drag was not an instruction: go back to
        // wherever the panel already was.
        const next = decisive ? (velocity === 0 ? distance : velocity) > 0 : open;

        // `velocity` is already in travel space; the spring runs on the same
        // axis, so it must not be converted back to screen space here.
        settle(next, velocity);
        runOnJS(setOpen)(next);
      });

    /*
     * The strip is only ever a closed-state restriction. Open, it is dropped
     * whatever `swipeFrom` says: the panel is already out, so there is no app
     * underneath left to compete for the same horizontal swipe.
     */
    if (!open && swipeFrom === 'edge') {
      gesture = gesture.hitSlop(
        sign === 1 ? { left: 0, width: edgeWidth } : { right: 0, width: edgeWidth }
      );
    }

    return gesture;
  }, [
    docked,
    edgeWidth,
    extent,
    offsets,
    open,
    setOpen,
    settle,
    sign,
    swipeEnabled,
    swipeFrom,
    translation,
  ]);

  const context = useMemo<PanelsideContextValue>(
    () => ({ open, setOpen, toggle, progress, width, mode, docked, dismissible }),
    [dismissible, docked, mode, open, progress, setOpen, toggle, width]
  );

  return (
    <PanelsideContext.Provider value={context}>
      <View
        onLayout={onLayout}
        // Clipping is what lets the panel sit at the edge with a parallax
        // offset without a sliver of it hanging outside the container.
        className={cn('flex-1 overflow-hidden', docked && 'flex-row', className)}
      >
        <GestureDetector gesture={pan}>
          <Animated.View className={cn('flex-1', docked && 'flex-row')}>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </PanelsideContext.Provider>
  );
}

export interface PanelsidePanelProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

function PanelsidePanel({ className, children, style, ...props }: PanelsidePanelProps) {
  const { progress, width, mode, docked } = usePanelsideContext('Panelside.Panel');
  const [footerHeight, setFooterHeight] = useState(0);

  const animatedStyle = useAnimatedStyle(() => {
    const p = docked ? 1 : progress.value;
    const distance = mode === 'overlay' ? width : width * PARALLAX;
    return { transform: [{ translateX: -(1 - p) * distance }] };
  }, [docked, mode, width]);

  /*
   * Out of the accessibility tree until it is nearly all the way in. A panel
   * at rest is behind the app, fully covered and not a thing you can reach —
   * but nothing about being covered says that to a screen reader, which will
   * happily read out a navigation list nobody can see.
   */
  const animatedProps = useAnimatedProps<ViewProps>(() => {
    const hidden = !docked && progress.value < 1 - HIDDEN_EPSILON;
    return Platform.OS === 'android'
      ? { importantForAccessibility: hidden ? 'no-hide-descendants' : 'auto' }
      : { accessibilityElementsHidden: hidden };
  }, [docked]);

  const surface = useMemo<PanelsideSurfaceValue>(
    () => ({ footerHeight, setFooterHeight }),
    [footerHeight]
  );

  return (
    <PanelsideSurfaceContext.Provider value={surface}>
      <Animated.View
        animatedProps={animatedProps}
        className={cn(
          'bg-background',
          docked ? 'h-full border-e border-border' : 'absolute bottom-0 start-0 top-0',
          // In overlay mode the panel comes in *over* the app, but it is the
          // first child and the scene is the second — so without this it slides
          // in behind the very thing it is supposed to cover, and all you see
          // is the scrim.
          !docked && mode === 'overlay' && 'z-10 shadow-lg',
          className
        )}
        // Animated style before the caller's, so a className or style cannot
        // silently drop the transform the panel is being moved by.
        style={[{ width }, animatedStyle, style]}
        {...props}
      >
        {children}
      </Animated.View>
    </PanelsideSurfaceContext.Provider>
  );
}

export interface PanelsideHeaderProps extends ViewProps {
  className?: string;
  /** Rendered as the heading. Omit it and supply your own in `children`. */
  title?: string;
  /** A single element pinned to the trailing end of the title row. */
  action?: ReactNode;
  /** Anything below the title row — a search field, a workspace switcher. */
  children?: ReactNode;
}

function PanelsideHeader({
  className,
  title,
  action,
  children,
  style,
  ...props
}: PanelsideHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      // The panel draws behind the status bar on purpose, so it reads as a
      // full-height surface rather than a card. That makes the inset the
      // header's to clear, and it stacks with its own padding rather than
      // being maxed against it.
      style={[{ paddingTop: insets.top + 12 }, style]}
      // `px-3` matches the scroller below it, so the search field and the rows
      // share one edge. A header inset further would leave the field floating
      // a few points inside the list it filters.
      className={cn('gap-3 px-3 pb-3', className)}
      {...props}
    >
      {(title || action) && (
        <View className="h-9 flex-row items-center justify-between gap-2">
          {title ? (
            <Text size="xl" weight="semibold" numberOfLines={1} className="flex-1">
              {title}
            </Text>
          ) : (
            <View className="flex-1" />
          )}
          {action}
        </View>
      )}
      {textChildren(children)}
    </View>
  );
}

export interface PanelsideSearchProps extends TextInputProps {
  className?: string;
  containerClassName?: string;
}

/**
 * A compact filter field for the panel.
 *
 * Deliberately not the library's `Input`: that field carries a label, a
 * description, an error slot and keyboard avoidance, none of which a panel
 * search row wants, and all of which would have to be switched off at every
 * call site.
 */
function PanelsideSearch({
  className,
  containerClassName,
  placeholder = 'Search',
  ...props
}: PanelsideSearchProps) {
  const placeholderTint = useCSSVariable('--color-muted-foreground');
  const textTint = useCSSVariable('--color-foreground');
  const muted = typeof placeholderTint === 'string' ? placeholderTint : undefined;

  return (
    <View
      className={cn(
        'h-10 flex-row items-center gap-2 rounded-xl bg-secondary px-3',
        containerClassName
      )}
    >
      <SearchIcon size={16} color={muted} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={muted}
        /*
         * `text-[16px]`, not `text-base`. A `text-*` step sets a size and a
         * line height together — 16px glyphs in a 24px line box — and in a
         * field of fixed height the extra leading lands above them, so the
         * text and the placeholder sit below the middle of the row. A length
         * sets the size alone and leaves the line box the font's own.
         */
        className={cn('h-full flex-1 text-[16px] text-foreground', className)}
        style={typeof textTint === 'string' ? { color: textTint } : undefined}
        accessibilityRole="search"
        returnKeyType="search"
        clearButtonMode="while-editing"
        {...props}
      />
    </View>
  );
}

export interface PanelsideContentProps extends ScrollViewProps {
  className?: string;
  contentContainerClassName?: string;
  children?: ReactNode;
}

function PanelsideContent({
  className,
  contentContainerClassName,
  contentContainerStyle,
  children,
  ...props
}: PanelsideContentProps) {
  const surface = useContext(PanelsideSurfaceContext);

  return (
    <ScrollView
      className={cn('flex-1', className)}
      contentContainerClassName={cn('gap-1 px-3 pb-3', contentContainerClassName)}
      // Room for the footer, which floats over this list rather than taking a
      // row below it — so the last item can be scrolled clear of the pill
      // instead of living permanently underneath it.
      contentContainerStyle={[{ paddingBottom: (surface?.footerHeight ?? 0) + 12 }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...props}
    >
      {textChildren(children)}
    </ScrollView>
  );
}

export interface PanelsideGroupProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

function PanelsideGroup({ className, children, ...props }: PanelsideGroupProps) {
  return (
    <View className={cn('gap-0.5 pb-2', className)} {...props}>
      {textChildren(children)}
    </View>
  );
}

export interface PanelsideGroupLabelProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

function PanelsideGroupLabel({ className, children, ...props }: PanelsideGroupLabelProps) {
  return (
    <View
      className={cn('px-3 pb-1 pt-3', className)}
      accessibilityRole="header"
      {...props}
    >
      {textChildren(children, (text) => (
        <Text size="xs" weight="medium" muted>
          {text}
        </Text>
      ))}
    </View>
  );
}

export interface PanelsideItemProps extends Omit<PressableProps, 'children'> {
  className?: string;
  /** Leading element — an icon, an avatar, a coloured dot. */
  icon?: ReactNode;
  /** The row's text. Truncated to one line, since chat titles run long. */
  label?: string;
  /** Marks the row as the current destination. */
  active?: boolean;
  /**
   * Trailing count or status. A number or string renders as a pill; anything
   * else renders as given.
   */
  badge?: ReactNode;
  disabled?: boolean;
  /** Trailing content — usually a `Panelside.Action`. */
  children?: ReactNode;
}

function PanelsideItem({
  className,
  icon,
  label,
  active = false,
  badge,
  disabled = false,
  children,
  ...props
}: PanelsideItemProps) {
  const restTint = useCSSVariable('--color-muted-foreground');
  const activeTint = useCSSVariable('--color-foreground');

  const tint = active
    ? typeof activeTint === 'string'
      ? activeTint
      : undefined
    : typeof restTint === 'string'
      ? restTint
      : undefined;

  return (
    <AnimatedPressable
      className={itemVariants({ active, disabled, className })}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={label}
      pressScale={0.985}
      {...props}
    >
      {/* Icons inherit the row's state rather than each caller passing a
          colour that stops being right the moment the row goes active. */}
      {icon ? <IconColorProvider color={tint}>{icon}</IconColorProvider> : null}

      {label ? (
        <Text
          size="base"
          weight={active ? 'medium' : 'normal'}
          muted={!active}
          numberOfLines={1}
          className="flex-1"
        >
          {label}
        </Text>
      ) : (
        <View className="flex-1" />
      )}

      {typeof badge === 'string' || typeof badge === 'number' ? (
        <View className="rounded-full bg-secondary px-2 py-0.5">
          <Text size="xs" muted>
            {badge}
          </Text>
        </View>
      ) : (
        badge
      )}

      {children}
    </AnimatedPressable>
  );
}

export interface PanelsideActionProps extends Omit<PressableProps, 'children'> {
  className?: string;
  /**
   * What a screen reader announces. The default control is an unlabelled glyph,
   * so this is the only description it has.
   */
  label?: string;
  /** Replaces the default overflow glyph. */
  children?: ReactNode;
}

function PanelsideAction({
  className,
  label = 'More options',
  children,
  ...props
}: PanelsideActionProps) {
  const tint = useCSSVariable('--color-muted-foreground');
  const color = typeof tint === 'string' ? tint : undefined;

  return (
    <AnimatedPressable
      className={cn('h-7 w-7 items-center justify-center rounded-lg', className)}
      accessibilityRole="button"
      accessibilityLabel={label}
      // The glyph is small and sits next to a row-sized target, so it takes
      // the difference back as slop rather than as layout.
      hitSlop={8}
      {...props}
    >
      {children ?? <EllipsisIcon size={18} color={color} />}
    </AnimatedPressable>
  );
}

export interface PanelsideFooterProps extends ViewProps {
  className?: string;
  /**
   * Overlay the scrolling list instead of taking a row below it. Default true —
   * the list runs the full height of the panel behind it, and `Panelside.Content`
   * leaves exactly this footer's height of room at the end.
   */
  floating?: boolean;
  children?: ReactNode;
}

function PanelsideFooter({
  className,
  floating = true,
  children,
  style,
  ...props
}: PanelsideFooterProps) {
  const insets = useSafeAreaInsets();
  const surface = useContext(PanelsideSurfaceContext);
  const setFooterHeight = surface?.setFooterHeight;
  const background = useCSSVariable('--color-background');
  const solid = typeof background === 'string' ? background : '#000000';

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setFooterHeight?.(event.nativeEvent.layout.height);
    },
    [setFooterHeight]
  );

  return (
    <View
      onLayout={floating ? onLayout : undefined}
      style={[
        { paddingBottom: Math.max(insets.bottom, 12) },
        floating ? { paddingTop: FOOTER_FADE } : null,
        style,
      ]}
      className={cn(
        // `gap-3` and a wider inset: the compose control is the one thing in
        // the panel that is not a list row, and a native one brings its own
        // metrics — it needs room around it rather than the row spacing the
        // list uses.
        'flex-row items-center gap-3 px-4',
        floating ? 'absolute bottom-0 end-0 start-0' : 'border-t border-border bg-background pt-2',
        className
      )}
      {...props}
    >
      {/*
        A floating footer has no edge and no bar. A solid one cuts a strip out
        of the bottom of the list; a transparent one lets rows slide under the
        controls and show through the labels. So it is neither: the top
        `FOOTER_FADE` points are a gradient the list dissolves into, and
        everything below that — the band the controls actually sit in — is
        plain background.

        The fade has to finish *above* the first control, not run through it.
        Two layers rather than one gradient across the whole box, because a
        gradient sized to the box puts its midpoint wherever the box happens to
        be tall, which is exactly where the labels are.

        Both are inside the footer's own bounds, so neither depends on a parent
        that does not clip its children.
      */}
      {floating ? (
        <>
          <LinearGradient
            colors={[`${solid}00`, solid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
            style={[styles.fade, { height: FOOTER_FADE }]}
          />
          <View
            pointerEvents="none"
            className="absolute bottom-0 end-0 start-0 bg-background"
            style={{ top: FOOTER_FADE }}
          />
        </>
      ) : null}
      {textChildren(children)}
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, left: 0, right: 0 },
  nativeLabel: { paddingHorizontal: 10, paddingVertical: 3 },
});

export interface PanelsideCtaProps extends Omit<PressableProps, 'children'> {
  className?: string;
  /** The button's text. */
  label?: string;
  /** Leading element, usually an icon. */
  icon?: ReactNode;
  /** `primary` is the filled accent pill; `secondary` is the quiet one. */
  variant?: 'primary' | 'secondary';
  /**
   * Render the platform's own button instead of the pill. Requires the
   * optional `@expo/ui` package; without it this prop does nothing.
   *
   * **Theme tokens do not apply** — the platform draws the button, so
   * `className` and `icon` are ignored and it sizes itself to `label`.
   */
  native?: boolean;
  /**
   * Draw the native button in the platform's Liquid Glass material. Requires
   * `native`, and iOS 26 or later; ignored anywhere else.
   */
  glass?: boolean;
  children?: ReactNode;
}

function PanelsideCta({
  className,
  label,
  icon,
  variant = 'primary',
  native = false,
  glass = false,
  disabled,
  children,
  ...props
}: PanelsideCtaProps) {
  const primaryTint = useCSSVariable('--color-primary-foreground');
  const secondaryTint = useCSSVariable('--color-secondary-foreground');
  const raw = variant === 'primary' ? primaryTint : secondaryTint;
  const tint = typeof raw === 'string' ? raw : undefined;

  /*
   * Delegated to Button rather than reaching for the native bridge here.
   * Button already resolves the package lazily, maps the variant onto the
   * platform's own style and falls back when it is missing — reimplementing
   * that would be a second copy to keep in step with the first.
   */
  if (native) {
    return (
      <Button
        native
        glass={glass}
        // The platform sizes a native button from its label, so the step up
        // has to be asked for rather than styled on.
        size="lg"
        variant={variant}
        accessibilityLabel={label}
        // Pressable allows `null` for disabled; Button does not.
        disabled={disabled ?? undefined}
        {...props}
      >
        {/*
          A hosted label rather than a plain string, and that is what makes the
          padding possible at all: handed a string the platform draws its own
          label and its own room around it, with no way to ask for more short
          of a control-size modifier that this app cannot survive. Handed a
          view, it draws the background around the view — so the padding here
          is the button's padding.

          The colour is set rather than inherited because the platform paints
          the background: a prominent button is the accent, whatever the theme
          believes its own primary foreground to be.
        */}
        <View style={styles.nativeLabel}>
          {label ? (
            <Text
              size="lg"
              weight="medium"
              numberOfLines={1}
              style={{ color: variant === 'primary' ? '#ffffff' : tint }}
            >
              {label}
            </Text>
          ) : (
            textChildren(children)
          )}
        </View>
      </Button>
    );
  }

  return (
    <AnimatedPressable
      className={ctaVariants({ variant, className })}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      {...props}
    >
      <IconColorProvider color={tint}>
        {icon}
        {label ? (
          <Text
            size="lg"
            weight="medium"
            // The pill gives way before the panel does, so the label has to be
            // able to end somewhere rather than pushing the button off the edge.
            numberOfLines={1}
            className={cn(
              'shrink',
              variant === 'primary' ? 'text-primary-foreground' : 'text-secondary-foreground'
            )}
          >
            {label}
          </Text>
        ) : null}
        {textChildren(children)}
      </IconColorProvider>
    </AnimatedPressable>
  );
}

export interface PanelsideSceneProps extends ViewProps {
  className?: string;
  /** How small the scene gets at full travel. Default 0.92. */
  scale?: number;
  /** The corner radius the scene reaches at full travel. Default 28. */
  radius?: number;
  /** How far the scene dims at full travel, 0 to 1. Default 0.45. */
  dim?: number;
  children?: ReactNode;
}

function PanelsideScene({
  className,
  scale = SCENE_SCALE,
  radius = SCENE_RADIUS,
  dim = SCENE_DIM,
  children,
  style,
  ...props
}: PanelsideSceneProps) {
  const { progress, width, mode, docked, dismissible, open, setOpen } =
    usePanelsideContext('Panelside.Scene');
  const [sceneWidth, setSceneWidth] = useState(0);
  const sign = useDirectionSign();

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setSceneWidth(event.nativeEvent.layout.width);
  }, []);

  const close = useCallback(() => setOpen(false), [setOpen]);

  /*
   * `pushes` rather than a branch inside the worklet, so the style always
   * returns the same set of properties. Reanimated keeps a property it has
   * seen once; dropping it from a later frame leaves the last value applied
   * instead of resetting it.
   */
  const pushes = mode === 'push' && !docked;

  const animatedStyle = useAnimatedStyle(() => {
    const p = pushes ? progress.value : 0;
    const s = 1 - (1 - scale) * p;
    return {
      transform: [
        // Subtracting the inset a centre-origin scale already applied is what
        // lands the scene's visible edge on the panel's, rather than near it.
        { translateX: sign * (p * (width + GAP) - (sceneWidth * (1 - s)) / 2) },
        { scale: s },
      ],
      borderRadius: p * radius,
    };
  }, [pushes, radius, scale, sceneWidth, sign, width]);

  const scrimStyle = useAnimatedStyle(() => {
    const p = docked ? 0 : progress.value;
    return { opacity: p * dim };
  }, [dim, docked]);

  const animatedProps = useAnimatedProps<ViewProps>(() => {
    const hidden = !docked && progress.value > 1 - HIDDEN_EPSILON;
    return Platform.OS === 'android'
      ? { importantForAccessibility: hidden ? 'no-hide-descendants' : 'auto' }
      : { accessibilityElementsHidden: hidden };
  }, [docked]);

  return (
    <Animated.View
      onLayout={onLayout}
      className={cn('flex-1 overflow-hidden bg-background', className)}
      style={[animatedStyle, style]}
      {...props}
    >
      <Animated.View animatedProps={animatedProps} className="flex-1">
        {children}
      </Animated.View>

      {/* Layered over the scene rather than under it, so it dims the app and
          catches the tap in the scene's own space — which means it inherits
          the corner radius instead of having to reproduce it.

          `pointerEvents` is a prop driven by state, not an animated style.
          A view at zero opacity still takes touches, so getting this wrong
          does not look like anything — it silently eats every tap on the app,
          including the one on the button that opens the panel. */}
      <Animated.View
        pointerEvents={open && !docked ? 'auto' : 'none'}
        className="absolute bottom-0 end-0 start-0 top-0 bg-black"
        style={scrimStyle}
      >
        {dismissible ? (
          <Pressable
            onPress={close}
            className="flex-1"
            accessibilityRole="button"
            accessibilityLabel="Close navigation panel"
          />
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

export interface PanelsideTriggerProps extends Omit<PressableProps, 'children'> {
  className?: string;
  /** What a screen reader announces. */
  label?: string;
  /**
   * A single pressable element to use instead of the default button. Its own
   * `onPress` still runs.
   */
  children?: ReactElement<{ onPress?: (...args: unknown[]) => void }>;
}

function PanelsideTrigger({
  className,
  label = 'Open navigation panel',
  children,
  ...props
}: PanelsideTriggerProps) {
  const { toggle, docked } = usePanelsideContext('Panelside.Trigger');
  const tint = useCSSVariable('--color-foreground');
  const color = typeof tint === 'string' ? tint : undefined;

  // A docked panel is already open and cannot be closed, so a control for it
  // would be a button that does nothing.
  if (docked) return null;

  if (children && isValidElement(children)) {
    return cloneElement(children, {
      onPress: (...args: unknown[]) => {
        children.props.onPress?.(...args);
        toggle();
      },
    });
  }

  return (
    <AnimatedPressable
      onPress={toggle}
      className={cn('h-10 w-10 items-center justify-center rounded-full', className)}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...props}
    >
      <MenuIcon size={20} color={color} />
    </AnimatedPressable>
  );
}

PanelsidePanel.displayName = 'Panelside.Panel';
PanelsideHeader.displayName = 'Panelside.Header';
PanelsideSearch.displayName = 'Panelside.Search';
PanelsideContent.displayName = 'Panelside.Content';
PanelsideGroup.displayName = 'Panelside.Group';
PanelsideGroupLabel.displayName = 'Panelside.GroupLabel';
PanelsideItem.displayName = 'Panelside.Item';
PanelsideAction.displayName = 'Panelside.Action';
PanelsideFooter.displayName = 'Panelside.Footer';
PanelsideCta.displayName = 'Panelside.Cta';
PanelsideScene.displayName = 'Panelside.Scene';
PanelsideTrigger.displayName = 'Panelside.Trigger';

export const Panelside = Object.assign(PanelsideRoot, {
  Panel: PanelsidePanel,
  Header: PanelsideHeader,
  Search: PanelsideSearch,
  Content: PanelsideContent,
  Group: PanelsideGroup,
  GroupLabel: PanelsideGroupLabel,
  Item: PanelsideItem,
  Action: PanelsideAction,
  Footer: PanelsideFooter,
  Cta: PanelsideCta,
  Scene: PanelsideScene,
  Trigger: PanelsideTrigger,
});
