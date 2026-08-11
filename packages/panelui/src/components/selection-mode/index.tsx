/**
 * SelectionMode — turning a list into one you can pick several things out of.
 *
 * ```tsx
 * <SelectionMode values={ids} onSelectedChange={setSelected}>
 *   <SelectionMode.Header title="Choose" />
 *   <FlashList
 *     data={threads}
 *     renderItem={({ item }) => (
 *       <SelectionMode.Item value={item.id} onPress={() => open(item)}>
 *         <Item>…</Item>
 *       </SelectionMode.Item>
 *     )}
 *   />
 *   <SelectionMode.Bar>
 *     <SelectionMode.Action icon={<TrashIcon size={20} />} destructive onPress={remove}>
 *       Delete
 *     </SelectionMode.Action>
 *   </SelectionMode.Bar>
 * </SelectionMode>
 * ```
 *
 * ## The rows stay yours
 *
 * `SelectionMode.Item` wraps a row rather than replacing it. It adds the circle
 * on the left and takes over what a press means; what the row looks like is
 * whatever you put inside, which is the only way this can work across a chat
 * list, a file list and a grid of photos without growing a prop for each.
 *
 * ## It is a mode, and modes have to be obvious
 *
 * There are two states and the list behaves differently in each: normally a tap
 * opens a row, and in selection a tap picks it. That is only safe if leaving is
 * always available and never hidden — hence a cancel in the header, the Android
 * back button, and the count in front of the reader the whole time.
 *
 * Entering is a long press on a row, which is the gesture the platform has used
 * for this for fifteen years, and the row you pressed is the first one picked.
 * Entering with nothing selected leaves the reader in a changed list with no
 * explanation of what changed.
 *
 * ## Selection is a set of values, not of rows
 *
 * The component holds ids, never indices or elements. A list that reorders,
 * pages in more rows or drops one underneath the reader would invalidate
 * anything positional; a set of ids survives all three, and is also the shape
 * the action at the end needs — deleting takes ids.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { tv, type VariantProps } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { useBackHandler } from '../../hooks/use-back-handler';
import { CheckIcon, IconColorProvider, XIcon } from '../../icons';
import { AnimatedPressable } from '../../primitives/animated-pressable';
import { Text, textChildren } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { selectionTick } from '../../utils/haptics';

/** How long the circle takes to come and go, in milliseconds. */
const REVEAL_DURATION = 180;

/** The spring the tick lands with — the same one the checkbox uses. */
const TICK_SPRING = { damping: 15, stiffness: 300, mass: 0.5 } as const;

/** How far a floating action bar sits from the edges, in points. */
const DEFAULT_BAR_OFFSET = 16;

/**
 * Fill a height that is offered, and take the content's own when none is.
 *
 * `flexBasis: 'auto'` rather than the `0` that `flex: 1` sets. A `flex: 1` box
 * inside a parent of indefinite height resolves to *nothing* — its basis is
 * zero and there is no free space to grow into — so a selection list dropped
 * into a scrolling page would collapse to a hairline instead of showing its
 * rows.
 */
const FILL = { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' } as const;

const selectionVariants = tv({
  slots: {
    circle: 'h-6 w-6 items-center justify-center rounded-full border-2 border-muted-foreground',
    fill: 'absolute inset-0 items-center justify-center rounded-full bg-primary',
    header: 'h-14 flex-row items-center gap-3 border-b border-border px-4',
    title: 'flex-1 text-center text-base font-semibold text-foreground',
    bar: 'flex-row items-stretch',
    action: 'flex-1 items-center justify-center gap-1.5 px-2 py-3',
    actionLabel: 'text-xs font-medium text-foreground',
  },
  variants: {
    selected: {
      true: { circle: 'border-primary' },
    },
    destructive: {
      true: { actionLabel: 'text-destructive' },
    },
    disabled: {
      true: { action: 'opacity-[0.44]' },
    },
    /**
     * Flush to the bottom edge, or lifted off it.
     *
     * `bar` is the platform shape — full width against the edge, a hairline
     * along the top, and the same background as the screen's own chrome. It is
     * the default because it is what a list with a selection in it does on both
     * platforms, and because it does not take width away from the list.
     */
    placement: {
      bar: { bar: 'border-t border-border bg-popover' },
      floating: { bar: 'rounded-2xl border border-border bg-popover shadow-lg' },
    },
  },
  defaultVariants: {
    placement: 'bar',
  },
});

type SelectionVariantProps = VariantProps<typeof selectionVariants>;

interface SelectionModeContextValue {
  active: boolean;
  enter: (value?: string) => void;
  exit: () => void;
  selected: string[];
  isSelected: (value: string) => boolean;
  toggle: (value: string) => void;
  selectAll: () => void;
  clear: () => void;
  /** True when everything selectable is picked, and there is something to pick. */
  allSelected: boolean;
  count: number;
  /** How many rows `values` says there are, or 0 when it was not given. */
  total: number;
  max?: number;
  haptics: boolean;
}

const SelectionModeContext = createContext<SelectionModeContextValue | null>(null);

/**
 * Read the selection from anywhere inside a `SelectionMode` — for a header of
 * your own, a count somewhere else on the screen, or an action that has to know
 * what is picked.
 */
export function useSelectionMode(): SelectionModeContextValue {
  const context = useContext(SelectionModeContext);
  if (!context) {
    throw new Error('useSelectionMode must be used within a <SelectionMode>');
  }
  return context;
}

export interface SelectionModeProps extends ViewProps {
  className?: string;
  /**
   * Every value that can be picked, in list order.
   *
   * Only "select all" and the "n of m" in the header need it — picking rows one
   * at a time works without it. Give it the same ids you give the list.
   */
  values?: string[];
  /** Controlled selection mode. Leave it out and a long press turns it on. */
  active?: boolean;
  /** Whether selection mode starts on. */
  defaultActive?: boolean;
  onActiveChange?: (active: boolean) => void;
  /** Controlled selection. */
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (selected: string[]) => void;
  /**
   * The most that can be picked at once.
   *
   * A row that would go over it does not toggle on, and "select all" stops at
   * the limit rather than refusing. Leave it out for no limit.
   */
  max?: number;
  /**
   * A tick when a row is picked and when the mode is entered. Off by default —
   * needs the optional `expo-haptics`, and is silent without it.
   */
  haptics?: boolean;
  children: ReactNode;
}

function SelectionModeRoot({
  className,
  values,
  active: activeProp,
  defaultActive = false,
  onActiveChange,
  selected: selectedProp,
  defaultSelected,
  onSelectedChange,
  max,
  haptics = false,
  children,
  ...props
}: SelectionModeProps) {
  const [internalActive, setInternalActive] = useState(defaultActive);
  const [internalSelected, setInternalSelected] = useState<string[]>(defaultSelected ?? []);

  const active = activeProp ?? internalActive;
  const selected = selectedProp ?? internalSelected;

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const setSelected = useCallback(
    (next: string[]) => {
      if (selectedProp === undefined) setInternalSelected(next);
      onSelectedChange?.(next);
    },
    [selectedProp, onSelectedChange]
  );

  const setActive = useCallback(
    (next: boolean) => {
      if (activeProp === undefined) setInternalActive(next);
      onActiveChange?.(next);
    },
    [activeProp, onActiveChange]
  );

  const enter = useCallback(
    (value?: string) => {
      if (haptics) selectionTick();
      setActive(true);
      // Entering with the row that was pressed already picked. Entering with
      // nothing picked leaves the reader in a list that has changed under them
      // with nothing to show for it.
      if (value !== undefined && !selectedRef.current.includes(value)) {
        setSelected([...selectedRef.current, value]);
      }
    },
    [haptics, setActive, setSelected]
  );

  /*
   * Leaving clears the selection.
   *
   * A selection that outlived the mode would come back the next time it was
   * entered, and the reader who left by pressing cancel is exactly the reader
   * who meant "not those". Keep it across a mode change by controlling
   * `selected` yourself.
   */
  const exit = useCallback(() => {
    setActive(false);
    setSelected([]);
  }, [setActive, setSelected]);

  const isSelected = useCallback(
    (value: string) => selectedRef.current.includes(value),
    []
  );

  const toggle = useCallback(
    (value: string) => {
      const current = selectedRef.current;
      if (current.includes(value)) {
        setSelected(current.filter((entry) => entry !== value));
      } else {
        if (max !== undefined && current.length >= max) return;
        if (haptics) selectionTick();
        setSelected([...current, value]);
      }
    },
    [max, haptics, setSelected]
  );

  const selectAll = useCallback(() => {
    if (!values) return;
    // At the limit rather than refusing: somebody who asked for all of them and
    // can only have twenty wants the twenty, not an error.
    setSelected(max === undefined ? [...values] : values.slice(0, max));
  }, [values, max, setSelected]);

  const clear = useCallback(() => setSelected([]), [setSelected]);

  const total = values?.length ?? 0;
  const count = selected.length;
  const allSelected =
    total > 0 && count >= (max === undefined ? total : Math.min(total, max));

  // An open mode owns the back button: back should leave the mode, not the
  // screen the list is on.
  useBackHandler(active, exit);

  const context = useMemo<SelectionModeContextValue>(
    () => ({
      active,
      enter,
      exit,
      selected,
      isSelected,
      toggle,
      selectAll,
      clear,
      allSelected,
      count,
      total,
      max,
      haptics,
    }),
    [
      active,
      enter,
      exit,
      selected,
      isSelected,
      toggle,
      selectAll,
      clear,
      allSelected,
      count,
      total,
      max,
      haptics,
    ]
  );

  return (
    <SelectionModeContext.Provider value={context}>
      <View style={FILL} className={className} {...props}>
        {textChildren(children)}
      </View>
    </SelectionModeContext.Provider>
  );
}

/* -------------------------------------------------------------------------- *
 * Indicator
 * -------------------------------------------------------------------------- */

export interface SelectionModeIndicatorProps {
  className?: string;
  /** Which row this stands for. Defaults to the row it is inside. */
  value?: string;
}

/**
 * The circle at the left of a row.
 *
 * Round rather than square, and that is the convention doing real work: a
 * square box is a form control the reader is filling in, a round one is a thing
 * they are picking out of a list. `Checkbox` is the former and stays that way.
 *
 * `Item` draws one for you. This is exported for a row that wants it somewhere
 * else — over a photo's corner, at the end instead of the start.
 */
function SelectionModeIndicator({ className, value }: SelectionModeIndicatorProps) {
  const { isSelected } = useSelectionMode();
  const row = useContext(SelectionModeItemContext);
  const target = value ?? row?.value;
  const selected = target !== undefined && isSelected(target);

  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  const tickColor = useCSSVariable('--color-primary-foreground');
  const slots = selectionVariants({ selected });

  useEffect(() => {
    if (reducedMotion) {
      progress.value = selected ? 1 : 0;
      return;
    }
    progress.value = selected
      ? withSpring(1, TICK_SPRING)
      : withTiming(0, { duration: 120 });
  }, [selected, reducedMotion, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.6 + progress.value * 0.4 }],
  }));

  return (
    <View className={cn(slots.circle(), className)}>
      <Animated.View style={fillStyle} className={slots.fill()}>
        <CheckIcon size={14} color={typeof tickColor === 'string' ? tickColor : '#fff'} />
      </Animated.View>
    </View>
  );
}

/* -------------------------------------------------------------------------- *
 * Item
 * -------------------------------------------------------------------------- */

/** What an indicator inside a row needs to know, without being told twice. */
const SelectionModeItemContext = createContext<{ value: string } | null>(null);

export interface SelectionModeItemProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** This row's id. What ends up in `selected`. */
  value: string;
  /** What the row does when it is pressed and the mode is off. */
  onPress?: () => void;
  /**
   * Stop this row entering selection mode, and being picked once in it. For a
   * header row, an advert, a "load more" — anything in the list that is not one
   * of the things being chosen between.
   */
  disabled?: boolean;
  /** Draw the circle without waiting for the mode. */
  alwaysShowIndicator?: boolean;
  children: ReactNode;
}

/**
 * One row, with the circle in front of it.
 *
 * The press behaviour is the whole component: off mode, a press is the row's
 * own and a long press turns the mode on with this row picked; in it, a press
 * picks and unpicks and the row's own press is unreachable. Two meanings for
 * one gesture is exactly why the mode has to be visible from the header.
 */
function SelectionModeItem({
  className,
  value,
  onPress,
  disabled = false,
  alwaysShowIndicator = false,
  children,
  ...props
}: SelectionModeItemProps) {
  const { active, enter, toggle, isSelected } = useSelectionMode();
  const selected = isSelected(value);
  const showing = alwaysShowIndicator || active;
  const reducedMotion = useReducedMotion();

  const context = useMemo(() => ({ value }), [value]);

  return (
    <SelectionModeItemContext.Provider value={context}>
      <Pressable
        accessibilityRole={showing ? 'checkbox' : 'button'}
        accessibilityState={showing ? { checked: selected, disabled } : { disabled }}
        // The row is unreachable in selection mode, so a screen reader is told
        // what pressing it does now rather than what it used to do.
        accessibilityHint={
          showing ? undefined : disabled ? undefined : 'Long press to select'
        }
        disabled={disabled && showing}
        onPress={() => {
          if (disabled) return;
          if (showing) toggle(value);
          else onPress?.();
        }}
        onLongPress={() => {
          if (disabled || showing) return;
          enter(value);
        }}
        className={cn('flex-row items-center gap-3 px-4 py-2', className)}
        {...props}
      >
        {showing ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(REVEAL_DURATION)}
            exiting={reducedMotion ? undefined : FadeOut.duration(REVEAL_DURATION)}
          >
            <SelectionModeIndicator value={value} />
          </Animated.View>
        ) : null}
        {/*
         * `minWidth: 0` as well as growing. Without it a long title refuses to
         * be narrower than its own text, pushes the row past the screen and
         * takes the layout with it — which is what a flex child does by
         * default, and why a name ends up broken across lines mid-word.
         */}
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
          {textChildren(children)}
        </View>
      </Pressable>
    </SelectionModeItemContext.Provider>
  );
}

/* -------------------------------------------------------------------------- *
 * Header
 * -------------------------------------------------------------------------- */

export interface SelectionModeHeaderProps extends ViewProps {
  className?: string;
  /** The word in front of the count. */
  title?: string;
  /** Hide the select-all control, for a list where picking everything is wrong. */
  hideSelectAll?: boolean;
  /** Replaces the whole header's contents, keeping only its layout. */
  children?: ReactNode;
}

/**
 * The bar that says the mode is on: a way out, how many are picked, and all
 * of them at once.
 *
 * Rendered only while the mode is on, and it is the thing that makes the mode
 * legible — a list whose rows have quietly changed what a tap does, with no
 * banner saying so, is a list that loses somebody's work.
 */
function SelectionModeHeader({
  className,
  title = 'Select',
  hideSelectAll = false,
  children,
  ...props
}: SelectionModeHeaderProps) {
  const { active, exit, count, total, allSelected, selectAll, clear } = useSelectionMode();
  const reducedMotion = useReducedMotion();
  const slots = selectionVariants({});

  if (!active) return null;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(REVEAL_DURATION)}
      exiting={reducedMotion ? undefined : FadeOut.duration(REVEAL_DURATION)}
      className={cn(slots.header(), className)}
      {...props}
    >
      {children ? (
        textChildren(children)
      ) : (
        <>
          {/*
           * The two ends are the same width, so the title between them is
           * centred on the screen rather than on whatever is left over. A title
           * that shifts sideways as the count goes from 9 to 10 reads as the
           * header being rebuilt.
           */}
          <View className="w-20 items-start">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel selection"
              onPress={exit}
              hitSlop={12}
            >
              <XIcon size={24} />
            </Pressable>
          </View>

          <Text numberOfLines={1} className={slots.title()}>
            {count > 0 ? `${title} (${count})` : title}
          </Text>

          <View className="w-20 items-end">
            {hideSelectAll || total === 0 ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={allSelected ? 'Clear selection' : 'Select all'}
                accessibilityState={{ checked: allSelected }}
                onPress={allSelected ? clear : selectAll}
                hitSlop={12}
              >
                <Text size="sm" weight="medium" className="text-primary">
                  {allSelected ? 'Clear' : 'All'}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- *
 * Bar
 * -------------------------------------------------------------------------- */

export interface SelectionModeBarProps
  extends ViewProps,
    Pick<SelectionVariantProps, 'placement'> {
  className?: string;
  /**
   * Room under the actions, in points — your safe-area inset.
   *
   * A bar against the bottom edge sits over the home indicator on a phone that
   * has one, and an action under a home indicator is an action that takes two
   * tries. `floating` uses it as the gap on all four sides instead.
   */
  inset?: number;
  /**
   * Keep the bar up with nothing picked.
   *
   * Off by default: every action on it needs something to act on, and a row of
   * buttons that all refuse is worse than a row that is not there yet.
   */
  showWhenEmpty?: boolean;
  children: ReactNode;
}

/**
 * The actions, across the bottom of the list.
 *
 * Over the list rather than under it, because the list is as long as it is and
 * a bar in the flow would be somewhere off the end of it. **Pad the bottom of
 * your list so the last row can clear this** — nothing here can work out how
 * tall the list is.
 *
 * Flush to the edge by default. A bar inset from the sides is a card floating
 * over a list, which reads as something that arrived rather than as the mode
 * the screen is in — and it takes width away from the actions, which are the
 * one row of controls on screen that must not be cramped.
 */
function SelectionModeBar({
  className,
  placement,
  inset = 0,
  showWhenEmpty = false,
  children,
  style,
  ...props
}: SelectionModeBarProps) {
  const { active, count } = useSelectionMode();
  const reducedMotion = useReducedMotion();
  const floating = placement === 'floating';
  const slots = selectionVariants({ placement });

  if (!active || (count === 0 && !showWhenEmpty)) return null;

  const edge = floating ? inset || DEFAULT_BAR_OFFSET : 0;

  return (
    <Animated.View
      entering={reducedMotion ? FadeIn : SlideInDown.duration(220)}
      exiting={reducedMotion ? FadeOut : SlideOutDown.duration(180)}
      style={[{ position: 'absolute', left: edge, right: edge, bottom: edge }, style]}
      {...props}
    >
      <View
        // Padding rather than a margin, so the bar's own background runs all
        // the way to the edge and the safe area is filled rather than left as a
        // stripe of whatever is behind it.
        style={floating ? undefined : { paddingBottom: inset }}
        className={cn(slots.bar(), className)}
      >
        {textChildren(children)}
      </View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- *
 * Action
 * -------------------------------------------------------------------------- */

export interface SelectionModeActionProps
  extends Omit<ViewProps, 'children'>,
    Pick<SelectionVariantProps, 'destructive'> {
  className?: string;
  /** The glyph above the label. */
  icon?: ReactNode;
  /**
   * What it does. Handed the selection, so the common case needs no other
   * wiring — and leaving the mode afterwards is up to you, because whether the
   * list still makes sense depends on what you did to it.
   */
  onPress?: (selected: string[]) => void;
  /** Leave selection mode after the action runs. */
  exitOnPress?: boolean;
  disabled?: boolean;
  /** Extra classes for the label. */
  labelClassName?: string;
  children?: ReactNode;
}

/**
 * One action in the bar: a glyph with its name under it.
 *
 * Labelled, always. A row of bare glyphs at the bottom of a screen is a row of
 * guesses, and one of them usually deletes something.
 */
function SelectionModeAction({
  className,
  icon,
  onPress,
  exitOnPress = false,
  disabled = false,
  destructive,
  labelClassName,
  children,
  ...props
}: SelectionModeActionProps) {
  const { selected, exit, count } = useSelectionMode();
  const destructiveColor = useCSSVariable('--color-destructive');
  // Nothing picked is nothing to act on, so the action is off rather than
  // pressable-and-inert.
  const off = disabled || count === 0;
  const slots = selectionVariants({ destructive, disabled: off });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={() => {
        onPress?.(selected);
        if (exitOnPress) exit();
      }}
      className={cn(slots.action(), className)}
      {...props}
    >
      <IconColorProvider
        color={destructive && typeof destructiveColor === 'string' ? destructiveColor : undefined}
      >
        {icon}
      </IconColorProvider>
      {textChildren(children, (text) => (
        <Text className={cn(slots.actionLabel(), labelClassName)}>{text}</Text>
      ))}
    </AnimatedPressable>
  );
}

SelectionModeRoot.displayName = 'SelectionMode';
SelectionModeItem.displayName = 'SelectionMode.Item';
SelectionModeIndicator.displayName = 'SelectionMode.Indicator';
SelectionModeHeader.displayName = 'SelectionMode.Header';
SelectionModeBar.displayName = 'SelectionMode.Bar';
SelectionModeAction.displayName = 'SelectionMode.Action';

export const SelectionMode = Object.assign(SelectionModeRoot, {
  Item: SelectionModeItem,
  Indicator: SelectionModeIndicator,
  Header: SelectionModeHeader,
  Bar: SelectionModeBar,
  Action: SelectionModeAction,
});
