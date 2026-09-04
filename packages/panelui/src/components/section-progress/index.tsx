/**
 * SectionProgress — a floating pill saying how far through a screen you are,
 * and which part of it you are in.
 *
 * A ring filled to the scroll position, and beside it the title of the section
 * being read. Pressed, it opens into the list of sections and jumps to any of
 * them.
 *
 * ```tsx
 * const sections = useScrollSections({ ids: SECTIONS.map((s) => s.id) });
 *
 * <SectionProgress
 *   scroll={sections.scroll}
 *   value={sections.active}
 *   onValueChange={sections.scrollTo}
 * >
 *   <SectionProgress.Item value="intro">Introduction</SectionProgress.Item>
 *   <SectionProgress.Item value="setup">Setup</SectionProgress.Item>
 * </SectionProgress>
 * ```
 *
 * ## Two readings, one control
 *
 * The ring is continuous and the label is not, and that is the point: a
 * percentage says how much is left, a section name says what is being read.
 * Either on its own leaves the other question open — a bar at 60% of an
 * unfamiliar page means nothing in particular, and a heading with no sense of
 * depth is a position without a scale.
 *
 * ## It arrives, and then it stays
 *
 * Nothing is drawn on the first screen. Past `revealAt` the pill fades in and
 * remains for the rest of the scroll — it does not hide again on the way back
 * up. A label that comes and goes with the scroll direction is one the reader
 * has to catch rather than read.
 *
 * ## The section, and the colour it brings
 *
 * An `Item` may carry a `color`, and the active one's colour is taken by the
 * ring, the label and a wash across the pill, crossfading as the reader moves
 * between sections. It turns the pill into a second, peripheral signal — the
 * part of the page you are in, readable without the words.
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
  type ReactNode,
} from 'react';
import { Pressable, ScrollView, View, type ViewProps } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { useBackHandler } from '../../hooks/use-back-handler';
import { Portal } from '../../primitives/portal';
import { useScrollProgress } from '../../primitives/scroll-progress';
import { Text, textChildren } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { selectionTick } from '../../utils/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Diameter of the ring, and the weight of its stroke. */
const RING_SIZE = 22;
const RING_STROKE = 2.5;
/**
 * How long the ring takes to reach a new scroll position.
 *
 * The position arrives from a scroll handler on the JavaScript thread, so it
 * comes in steps rather than continuously. Easing towards each step turns that
 * back into a glide — and because the easing itself runs on the UI thread, a
 * busy JavaScript thread costs the ring some lag rather than the whole motion.
 */
const PROGRESS_EASE = 160;
/** How long the pill takes to arrive, and to take on a new section's colour. */
const REVEAL_DURATION = 200;
const TINT_DURATION = 240;
/** How far the pill rises as it appears. */
const REVEAL_RISE = 10;
/**
 * How long a jump from the panel is given to arrive before section changes
 * start being felt again. Only reached when the scroll had nowhere to go.
 */
const JUMP_TIMEOUT = 900;
/** Panel width: a floor so one short section still reads, and a cap so long
    titles wrap instead of pushing the panel across the screen. */
const PANEL_MIN_WIDTH = 180;
const PANEL_MAX_WIDTH = '78%' as const;
/**
 * The pill's own height, and the gap the panel leaves above or below it.
 *
 * Measured from what it is built out of — the ring, the padding either side of
 * it and the border — rather than measured at runtime, because the panel is
 * positioned in the same frame it mounts in and a measurement pass would place
 * it over the pill for that frame.
 */
const PILL_HEIGHT = RING_SIZE + 12 + 2;
const PANEL_GAP = 10;

export type SectionProgressPlacement =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** The colour an `Item` can bring with it. */
export type SectionProgressColor =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'foreground';

/** Which side of the pill's row the content sits on, per placement. */
const ALIGNMENT: Record<SectionProgressPlacement, string> = {
  'top-left': 'items-start',
  'top-center': 'items-center',
  'top-right': 'items-end',
  'bottom-left': 'items-start',
  'bottom-center': 'items-center',
  'bottom-right': 'items-end',
};

/**
 * The tokens, read in one call, and where each colour name sits in the result.
 *
 * One array call rather than one hook per name: an `Item`'s colour is a prop
 * on a child element, and a hook cannot be run per child without the number of
 * hooks changing with the number of sections.
 */
const COLOR_TOKENS = [
  '--color-foreground',
  '--color-primary',
  '--color-success',
  '--color-warning',
  '--color-destructive',
  '--color-info',
  '--color-muted',
];
const COLOR_INDEX: Record<SectionProgressColor, number> = {
  foreground: 0,
  primary: 1,
  success: 2,
  warning: 3,
  danger: 4,
  info: 5,
};
/** Where the track colour sits in the same result. */
const TRACK_INDEX = 6;
/** Drawn if a token cannot be resolved — a theme that has not loaded yet. */
const COLOR_FALLBACK = '#f5f5f5';
const TRACK_FALLBACK = '#3f3f46';

/**
 * Where the scroller is.
 *
 * Three values rather than one fraction, because the fraction is not the only
 * thing that is wanted: the reveal threshold is a distance in points, and a
 * distance cannot be recovered from a percentage.
 *
 * Both `useScrollSections().scroll` and the `ScrollProgress` primitive's
 * context satisfy this shape.
 */
export interface SectionProgressScroll {
  /** Distance scrolled, in points. */
  offset: SharedValue<number>;
  /** Height of the visible area. */
  viewport: SharedValue<number>;
  /** Total height of the content. */
  content: SharedValue<number>;
}

interface SectionProgressContextValue {
  value: string | undefined;
  onValueChange: (value: string) => void;
  close: () => void;
  /** The active section's colour, already resolved to something drawable. */
  tint: string;
}

const SectionProgressContext = createContext<SectionProgressContextValue | null>(null);

function useSectionProgress(component: string): SectionProgressContextValue {
  const context = useContext(SectionProgressContext);
  if (!context) {
    throw new Error(`${component} must be used within a <SectionProgress>`);
  }
  return context;
}

export interface SectionProgressProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /**
   * The scroll position the ring is filled from. `useScrollSections` returns
   * one as `scroll`; without it the component falls back to the nearest
   * `ScrollProgress`, and with neither the ring stays empty.
   */
  scroll?: SectionProgressScroll;
  /**
   * Fill the ring from a value of your own, between 0 and 1. Nothing is
   * derived when this is passed.
   */
  progress?: SharedValue<number> | number;
  /** Active section id. Controlled — usually driven by a scroll handler. */
  value?: string;
  /** Starting section when uncontrolled. */
  defaultValue?: string;
  /** Fires when a section is chosen from the panel. Scroll there. */
  onValueChange?: (value: string) => void;
  /** Controlled expansion of the panel. */
  open?: boolean;
  /** Whether the panel starts open when uncontrolled. */
  defaultOpen?: boolean;
  /** Fires when the panel opens or closes, however it was done. */
  onOpenChange?: (open: boolean) => void;
  /** Which corner or edge the pill floats in. */
  placement?: SectionProgressPlacement;
  /** Gap between the pill and the edge of the safe area. */
  offset?: number;
  /**
   * How far the reader must scroll, in points, before the pill appears. `0`
   * shows it from the first frame. It never hides again.
   */
  revealAt?: number;
  /**
   * Tick under the finger on every change of section, however it was made.
   * Nothing between a tap in the panel and its arrival counts as a change.
   * Needs the optional `expo-haptics` package; without it this does nothing.
   */
  haptics?: boolean;
  /**
   * What the pill is called to a screen reader. The section being read and
   * the percentage are announced after it, so this names the control rather
   * than describing the state.
   */
  label?: string;
  /** One `SectionProgress.Item` per section, in the order they appear. */
  children: ReactNode;
}

function SectionProgressRoot({
  className,
  scroll,
  progress,
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-center',
  offset = 16,
  revealAt = 64,
  haptics = false,
  label = 'Sections',
  children,
  ...props
}: SectionProgressProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const [internalValue, setInternalValue] = useState(defaultValue);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : internalValue;
  const isOpenControlled = openProp !== undefined;
  const open = isOpenControlled ? openProp : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isOpenControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isOpenControlled, onOpenChange]
  );
  const close = useCallback(() => setOpen(false), [setOpen]);

  // The panel owns the back button while it is up — back should put the list
  // away, not leave the screen behind it.
  useBackHandler(open, close);

  /*
   * The sections, read straight off the children.
   *
   * The pill has to draw the active section's own label and colour while the
   * panel that holds the rows is closed and unmounted. Reading the elements is
   * synchronous, so the first frame is already right — a registration effect
   * would leave the pill blank until after mount, which is the frame the
   * reveal animation is playing on.
   */
  const items = useMemo(() => {
    const found: { value: string; label: ReactNode; color?: SectionProgressColor }[] = [];
    Children.forEach(children, (child) => {
      if (!isValidElement(child) || child.type !== SectionProgressItem) return;
      const itemProps = child.props as SectionProgressItemProps;
      if (typeof itemProps.value !== 'string') return;
      found.push({
        value: itemProps.value,
        label: itemProps.children,
        color: itemProps.color,
      });
    });
    return found;
  }, [children]);

  const active = items.find((item) => item.value === value) ?? items[0];

  // Narrowed on the way out because `useCSSVariable` resolves to a number for
  // any token that happens to be one.
  const tokens = useCSSVariable(COLOR_TOKENS);
  const resolved = tokens[COLOR_INDEX[active?.color ?? 'foreground']];
  const tint = typeof resolved === 'string' ? resolved : COLOR_FALLBACK;
  const trackToken = tokens[TRACK_INDEX];
  const track = typeof trackToken === 'string' ? trackToken : TRACK_FALLBACK;

  /* ------------------------------------------------------------------ *
   * The ring
   * ------------------------------------------------------------------ */

  // Called unconditionally, used only as a fallback: a hook cannot sit behind
  // a `??`, and the context returns null outside a provider anyway.
  const inherited = useScrollProgress();
  const source = scroll ?? inherited;
  const filled = useSharedValue(0);

  useAnimatedReaction(
    () => {
      if (typeof progress === 'number') return progress;
      if (progress) return progress.value;
      if (!source) return 0;
      const span = source.content.value - source.viewport.value;
      return span > 0 ? source.offset.value / span : 0;
    },
    (next) => {
      const clamped = next < 0 ? 0 : next > 1 ? 1 : next;
      filled.value = withTiming(clamped, { duration: PROGRESS_EASE });
    },
    [progress, source]
  );

  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = RING_SIZE / 2;

  /*
   * A circle's stroke starts at three o'clock, so it is turned back a quarter
   * to start at twelve. An arc that begins at three reads as a gauge already
   * part-way along.
   */
  const rotate = `rotate(-90 ${centre} ${centre})`;

  /* ------------------------------------------------------------------ *
   * The reveal
   * ------------------------------------------------------------------ */

  /*
   * A React state, not only a shared value: the pill has to stop taking
   * touches while it is invisible, and `pointerEvents` is not a style. The
   * reaction fires when the threshold is crossed rather than every frame, so
   * this costs one hop to the JavaScript thread per scroll, not per event.
   */
  const [revealed, setRevealed] = useState(revealAt <= 0);
  useAnimatedReaction(
    () => (source ? source.offset.value >= revealAt : true),
    (next, previous) => {
      if (next !== previous) runOnJS(setRevealed)(next);
    },
    [revealAt, source]
  );

  const shown = useSharedValue(revealAt <= 0 ? 1 : 0);
  useEffect(() => {
    const to = revealed ? 1 : 0;
    shown.value = reduceMotion ? to : withTiming(to, { duration: REVEAL_DURATION });
  }, [revealed, reduceMotion, shown]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [
      {
        translateY: interpolate(
          shown.value,
          [0, 1],
          [placement.startsWith('top') ? -REVEAL_RISE : REVEAL_RISE, 0]
        ),
      },
    ],
  }));

  /* ------------------------------------------------------------------ *
   * The colour the section brings
   * ------------------------------------------------------------------ */

  /*
   * Two colours and a scalar between them, rather than one colour swapped: a
   * section change is a change of state the reader did not ask for, and one
   * that lands instantly reads as a flicker rather than as a transition.
   */
  const [fade, setFade] = useState({ from: tint, to: tint });
  const crossfade = useSharedValue(1);
  useEffect(() => {
    setFade((current) => (current.to === tint ? current : { from: current.to, to: tint }));
  }, [tint]);
  useEffect(() => {
    if (fade.from === fade.to) return;
    crossfade.value = 0;
    crossfade.value = reduceMotion ? 1 : withTiming(1, { duration: TINT_DURATION });
  }, [fade, crossfade, reduceMotion]);

  const ringProps = useAnimatedProps(() => ({
    strokeDasharray: [circumference * filled.value, circumference],
    stroke: interpolateColor(crossfade.value, [0, 1], [fade.from, fade.to]),
  }));
  const tintStyle = useAnimatedStyle(() => ({
    color: interpolateColor(crossfade.value, [0, 1], [fade.from, fade.to]),
  }));
  const washStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(crossfade.value, [0, 1], [fade.from, fade.to]),
  }));

  /* ------------------------------------------------------------------ *
   * Choosing a section, and feeling the ones scrolled past
   * ------------------------------------------------------------------ */

  /*
   * The section a tap asked for, while the screen is still travelling to it.
   * A jump passes every section in between, and each of those arrives here as
   * a change of section — one tap, three ticks, none of them a place the
   * reader went.
   */
  const jumpTo = useRef<string | null>(null);
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endJump = useCallback(() => {
    jumpTo.current = null;
    if (jumpTimer.current) {
      clearTimeout(jumpTimer.current);
      jumpTimer.current = null;
    }
  }, []);
  useEffect(() => () => endJump(), [endJump]);

  const handleValueChange = useCallback(
    (next: string) => {
      jumpTo.current = next;
      if (jumpTimer.current) clearTimeout(jumpTimer.current);
      // A backstop, not the usual way out: a jump to a section the scroller
      // cannot reach never arrives, and without this nothing would tick again.
      jumpTimer.current = setTimeout(endJump, JUMP_TIMEOUT);
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
      setOpen(false);
    },
    [isControlled, onValueChange, setOpen, endJump]
  );

  /*
   * Fired from the resolved value rather than from the handler, so a section
   * arrived at by scrolling is felt as well as one that was tapped. The ref
   * skips the first run — mounting is not a change of section.
   */
  const ticked = useRef(false);
  useEffect(() => {
    if (!ticked.current) {
      ticked.current = true;
      return;
    }
    if (jumpTo.current !== null) {
      if (value !== jumpTo.current) return;
      endJump();
    }
    if (haptics) selectionTick();
  }, [value, haptics, endJump]);

  /* ------------------------------------------------------------------ *
   * What a screen reader is told
   * ------------------------------------------------------------------ */

  /*
   * Rounded to five, and pushed across only when it changes: the ring is a
   * continuous value and an announcement is not, so the number is coarse on
   * purpose rather than accurate to a percent nobody can act on.
   */
  const [percent, setPercent] = useState(0);
  useAnimatedReaction(
    () => Math.round(filled.value * 20) * 5,
    (next, previous) => {
      if (next !== previous) runOnJS(setPercent)(next);
    }
  );

  const activeLabel = typeof active?.label === 'string' ? active.label : undefined;

  const context = useMemo<SectionProgressContextValue>(
    () => ({ value: active?.value, onValueChange: handleValueChange, close, tint }),
    [active?.value, handleValueChange, close, tint]
  );

  const vertical = placement.startsWith('top')
    ? { top: insets.top + offset }
    : { bottom: insets.bottom + offset };

  return (
    <SectionProgressContext.Provider value={context}>
      <Animated.View
        /*
         * `box-none`, not `none`: the pill takes touches, the strip of empty
         * space it sits in does not — a full-width bar across the bottom of
         * the screen with ordinary pointer events swallows every scroll that
         * starts under it.
         */
        pointerEvents={revealed ? 'box-none' : 'none'}
        style={[
          revealStyle,
          {
            position: 'absolute',
            left: insets.left + offset,
            right: insets.right + offset,
            ...vertical,
          },
        ]}
        className={cn(ALIGNMENT[placement], className)}
        {...props}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            activeLabel ? `${label}. ${activeLabel}. ${percent}% read.` : label
          }
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(!open)}
          hitSlop={8}
          className="flex-row items-center gap-2.5 overflow-hidden rounded-full border border-border bg-popover py-1.5 pe-4 ps-2 shadow-lg"
        >
          {/* The wash, under everything: the section's colour at a strength
              that tints the pill without making the label sit on it. */}
          <Animated.View
            pointerEvents="none"
            style={[washStyle, { opacity: 0.1 }]}
            className="absolute inset-0"
          />

          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <G>
                <Circle
                  cx={centre}
                  cy={centre}
                  r={radius}
                  stroke={track}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <AnimatedCircle
                  animatedProps={ringProps}
                  cx={centre}
                  cy={centre}
                  r={radius}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  fill="none"
                  transform={rotate}
                />
              </G>
            </Svg>
          </View>

          <Animated.Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={tintStyle}
            className="text-sm font-medium"
            numberOfLines={1}
          >
            {active?.label}
          </Animated.Text>
        </Pressable>
      </Animated.View>

      {open && revealed ? (
        <Portal>
          {/* A press anywhere else puts it away. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <SectionProgressContext.Provider value={context}>
            <Animated.View
              entering={FadeIn.duration(140)}
              exiting={FadeOut.duration(120)}
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: insets.left + offset,
                right: insets.right + offset,
                // Clear of the pill, so the panel opens out of it rather than
                // over the thing that was pressed.
                ...(placement.startsWith('top')
                  ? { top: insets.top + offset + PILL_HEIGHT + PANEL_GAP }
                  : { bottom: insets.bottom + offset + PILL_HEIGHT + PANEL_GAP }),
              }}
              className={ALIGNMENT[placement]}
            >
              <SectionProgressPanel>{children}</SectionProgressPanel>
            </Animated.View>
          </SectionProgressContext.Provider>
        </Portal>
      ) : null}
    </SectionProgressContext.Provider>
  );
}

/** The list of sections, on the surface it opens onto. */
function SectionProgressPanel({ children }: { children: ReactNode }) {
  return (
    <View
      accessibilityRole="menu"
      style={{ minWidth: PANEL_MIN_WIDTH, maxWidth: PANEL_MAX_WIDTH }}
      className="gap-0.5 rounded-2xl border border-border bg-popover p-1.5 shadow-lg"
    >
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {textChildren(children)}
      </ScrollView>
    </View>
  );
}

export interface SectionProgressItemProps {
  className?: string;
  /** Section this row jumps to. Matches the root's `value`. */
  value: string;
  /**
   * The colour this section brings to the pill. Left out, the section takes
   * the foreground colour like every other.
   */
  color?: SectionProgressColor;
  /** The section's title. It is what the collapsed pill shows. */
  children: ReactNode;
}

/**
 * One section: a row in the panel, and the label the pill shows while that
 * section is the one being read.
 */
function SectionProgressItem({ className, value, children }: SectionProgressItemProps) {
  const { value: active, onValueChange, tint } = useSectionProgress('SectionProgress.Item');
  const selected = active === value;

  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      onPress={() => onValueChange(value)}
      className={cn('flex-row items-center gap-3 rounded-xl px-3 py-2 active:bg-accent', selected && 'bg-accent', className)}
    >
      {/* The dot is the position marker the pill's ring cannot be at this
          size — filled and in the section's own colour when it is the one
          being read, a hairline dot otherwise. */}
      <View
        style={selected ? { backgroundColor: tint } : undefined}
        className={cn('h-1.5 w-1.5 rounded-full', !selected && 'bg-muted-foreground/40')}
      />
      <Text
        size="sm"
        weight={selected ? 'medium' : 'normal'}
        className={selected ? 'text-foreground' : 'text-muted-foreground'}
        // Two lines rather than one: an ellipsis in a navigator hides the very
        // word that says which section the row would jump to.
        numberOfLines={2}
      >
        {children}
      </Text>
    </Pressable>
  );
}

SectionProgressRoot.displayName = 'SectionProgress';
SectionProgressItem.displayName = 'SectionProgress.Item';

export const SectionProgress = Object.assign(SectionProgressRoot, {
  Item: SectionProgressItem,
});
