/**
 * SearchBar — a text field for querying a list, with the two controls a search
 * needs and an ordinary field does not, and a panel of results that opens out
 * of the field itself.
 *
 * ```tsx
 * <SearchBar placeholder="Search orders" onSubmit={run} />
 * <SearchBar variant="filled" shape="pill" cancel="focus" />
 * <SearchBar avoidKeyboard value={query} onChangeText={setQuery}>
 *   <SearchBar.Section label="Suggested">
 *     <SearchBar.Item trailing={<AddButton />} onPress={add}>Claude</SearchBar.Item>
 *   </SearchBar.Section>
 * </SearchBar>
 * ```
 *
 * ## The results are above the field, and the field is above the keyboard
 *
 * A search that is being typed into has a keyboard under it, and a list drawn
 * below the field is a list drawn behind the keyboard. So `avoidKeyboard`
 * lifts the field until it sits `keyboardOffset` points clear of the keyboard's
 * top edge, and the panel opens *upward* out of it into the space that is
 * actually free.
 *
 * That puts the first result nearest the field and the last one furthest away,
 * which is the order a reader walking away from the caret expects. Pass
 * `panelPlacement="bottom"` for a search bar in a header, where the space is
 * the other way round.
 *
 * The panel is positioned absolutely rather than laid out in the flow, so
 * opening it never moves the page underneath — a list that pushes the field it
 * belongs to is a field that walks away from the finger typing into it.
 *
 * ## Touches inside the panel must not close the keyboard
 *
 * The panel scrolls with `keyboardShouldPersistTaps="handled"`. Without it the
 * first tap on a row is spent dismissing the keyboard and the press never
 * arrives, which reads as a row that ignores every other tap.
 *
 * ## The clear button, and why it is not the platform's
 *
 * A ✕ appears inside the field as soon as there is something to clear, and
 * takes it back to empty without dismissing the keyboard — clearing a query is
 * the start of the next one, not the end of the search. It is drawn here
 * rather than left to `clearButtonMode`, which exists on iOS only, cannot be
 * labelled for a screen reader and cannot be swapped for a spinner while
 * results are in flight.
 *
 * The glyph is 24 points and its touch box is 48, made up with slop rather
 * than with size. A 48-point circle inside a 40-point field either overflows
 * it or forces every search bar in an app to be as tall as the largest one.
 *
 * ## Cancel is a row, not a decoration
 *
 * `cancel="focus"` puts a Cancel button beside the field and slides it in
 * while the field is being edited, which is the platform's own answer to
 * "how do I get out of this search". It is a sibling of the field rather than
 * something inside it, because it acts on the search as a whole: it empties
 * the query, drops focus and calls `onCancel`, and a control that ends the
 * thing it sits inside reads as part of the query it is about to discard.
 *
 * Its width is measured once and animated on the UI thread. The button is
 * always mounted when `cancel` is not `never`, so the measurement is already
 * there the first time the field is touched and the first slide is as smooth
 * as the tenth.
 *
 * ## Debouncing belongs to the caller's search, not to the field
 *
 * `onChangeText` always fires on every keystroke — a controlled field that
 * lags its own input is unusable. `debounce` is about the *query*: it holds
 * `onDebouncedChange` until typing pauses, so a network search runs once per
 * pause instead of once per letter. Submitting flushes it immediately, since
 * a return key is somebody saying they are done waiting.
 */
import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputSubmitEditingEventData,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { tv, type VariantProps } from 'tailwind-variants';
import { useKeyboard } from '../../hooks/use-keyboard';
import { SearchIcon, XIcon } from '../../icons';
import {
  AnimatedPressable,
  type AnimatedPressableProps,
} from '../../primitives/animated-pressable';
import { KeyboardAvoider } from '../../primitives/keyboard-avoider';
import { Text } from '../../primitives/text';
import { Input, type InputProps } from '../input';
import { Spinner } from '../spinner';
import {
  cancelSearchBarDebounce,
  flushSearchBarDebounce,
  scheduleSearchBarDebounce,
  type SearchBarDebounceTimer,
} from './search-bar-debounce';

/** Matches the field's own focus crossfade, so the row settles as one thing. */
const CANCEL_DURATION = 180;

/** Space kept between the field and the Cancel button while it is out. */
const CANCEL_GAP = 8;

/**
 * Slop around the 24-point clear glyph, taking its touch box to 48 without
 * changing the height of the field it sits in.
 */
const CLEAR_HIT_SLOP = 12;

/** The panel's crossfade, matching every other anchored list in the library. */
const PANEL_IN = 140;
const PANEL_OUT = 120;

/** Gap left between the panel's far edge and the edge of the screen. */
const PANEL_EDGE_GAP = 24;

/** Floor for the derived height — below this a list is not worth opening. */
const PANEL_MIN_HEIGHT = 160;

/*
 * The panel's geometry, off the class list because two of these five have no
 * utility and the other three read better beside them.
 *
 * `zIndex` *and* `elevation`: Android draws siblings in tree order and takes
 * its stacking from elevation, so a panel that overlaps the content above the
 * field would otherwise be painted under it.
 */
const PANEL_ABOVE: ViewStyle = {
  position: 'absolute',
  bottom: '100%',
  left: 0,
  right: 0,
  zIndex: 20,
  elevation: 20,
};

const PANEL_BELOW: ViewStyle = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 20,
  elevation: 20,
};

const searchBarVariants = tv({
  slots: {
    row: 'w-full flex-row items-center',
    /*
     * The box the panel is positioned against — the field alone, so the panel
     * is the field's width rather than the row's and does not run out under a
     * Cancel button that is only sometimes there.
     */
    anchor: 'relative',
    field: '',
    /*
     * The panel and the field are one card: the panel's own bottom edge is the
     * hairline between them, so the field drops its top border rather than
     * drawing a second line a pixel below it.
     */
    panel: 'overflow-hidden border border-border bg-card p-1.5 shadow-sm',
    sectionLabel: 'px-3 pb-1 pt-2 text-sm text-muted-foreground',
    item: 'flex-row items-center gap-3 rounded-lg px-3 py-2.5',
    itemLabel: 'flex-1 text-base text-foreground',
    status: 'flex-row items-center justify-center gap-2 px-3 py-8',
    // Clipped, because this is what the Cancel button is revealed out of: the
    // button keeps its measured width and the container's grows past it.
    //
    // `self-stretch` gives it the row's height, which it has no other way of
    // getting — its only child is positioned absolutely, so it has no content
    // to be as tall as.
    cancelClip: 'self-stretch overflow-hidden',
    cancelButton: 'absolute bottom-0 end-0 top-0 items-center justify-center ps-2',
    cancelLabel: 'font-medium text-primary',
    clear: 'items-center justify-center rounded-full',
  },
  variants: {
    size: {
      sm: { cancelLabel: 'text-[14px]', clear: 'h-6 w-6' },
      md: { cancelLabel: 'text-[16px]', clear: 'h-6 w-6' },
      lg: { cancelLabel: 'text-[16px]', clear: 'h-7 w-7' },
    },
    /**
     * The field's corner. `pill` is the shape a search field takes when it is
     * chrome — sitting above a list, in a header — and `rounded` the one it
     * takes inside a form beside other fields.
     */
    shape: {
      rounded: { field: '' },
      pill: { field: 'rounded-full' },
    },
    /**
     * Which edge of the field the panel is welded to. The corners on that edge
     * go square and its border comes off, so the two read as one card rather
     * than as a list resting on a field.
     */
    attached: {
      none: {},
      top: { field: 'rounded-t-none rounded-b-2xl border-t-0', panel: 'rounded-t-2xl' },
      bottom: { field: 'rounded-b-none rounded-t-2xl border-b-0', panel: 'rounded-b-2xl' },
    },
    selected: {
      true: { item: 'bg-accent' },
    },
  },
  defaultVariants: {
    size: 'md',
    shape: 'rounded',
    attached: 'none',
  },
});

type SearchBarVariantProps = VariantProps<typeof searchBarVariants>;

/** Glyph sizes per field size — the icon tracks the text, not the box. */
const ICON_SIZE = { sm: 16, md: 18, lg: 20 } as const;

/** Where the results open. */
export type SearchBarPanelPlacement = 'top' | 'bottom';

/** When the results are shown. */
export type SearchBarPanelMode = 'never' | 'focus' | 'always';

/**
 * What SearchBar takes from Input, minus everything it owns itself. The form
 * furniture is dropped along with it: a label and an error line stack above
 * and below the field, and Cancel sits beside the whole stack rather than
 * beside the field it belongs to. Use `Field` for a search that is one answer
 * in a form.
 *
 * The keyboard props go too. Input's would move the field and leave the Cancel
 * button and the panel where they were; SearchBar lifts all three together.
 */
type InheritedInputProps = Omit<
  InputProps,
  | 'avoidKeyboard'
  | 'defaultValue'
  | 'description'
  | 'endContent'
  | 'errorMessage'
  | 'interactiveContent'
  | 'isRequired'
  | 'keyboardBottomInset'
  | 'keyboardMode'
  | 'keyboardOffset'
  | 'label'
  | 'multiline'
  | 'onChangeText'
  | 'size'
  | 'startContent'
  | 'value'
>;

export interface SearchBarProps
  extends InheritedInputProps,
    Omit<SearchBarVariantProps, 'attached' | 'selected'> {
  /**
   * The field's background, from `Input`. `outline` draws its own edge, for a
   * search bar sitting on the page; `filled` drops it, for one inside a card
   * or a header where a second border reads as a seam. Defaults to `outline`.
   */
  variant?: InputProps['variant'];
  /** The query, when the caller holds it. Leave unset to let the field keep it. */
  value?: string;
  /** Starting query for an uncontrolled field. Ignored once `value` is passed. */
  defaultValue?: string;
  /** Fires on every keystroke. For a search that costs something, see `debounce`. */
  onChangeText?: (value: string) => void;
  /** The return key, which is labelled Search. Flushes `onDebouncedChange` first. */
  onSubmit?: (value: string) => void;
  /**
   * How long typing has to pause before `onDebouncedChange` runs, in
   * milliseconds. `0` runs it on every keystroke, which is only right for a
   * filter over a list already in memory.
   */
  debounce?: number;
  /** The query, once typing has paused for `debounce` milliseconds. */
  onDebouncedChange?: (value: string) => void;
  /** Fires after the ✕ empties the field. The field keeps focus. */
  onClear?: () => void;
  /** Fires after Cancel empties the field and drops focus. */
  onCancel?: () => void;
  /** Whether the ✕ appears once there is a query. */
  isClearable?: boolean;
  /**
   * When the Cancel button is beside the field. `focus` slides it in while the
   * field is being edited and away again when it is not, which is what a
   * search bar above a list wants. `always` keeps it out, for a screen that is
   * nothing but the search.
   */
  cancel?: 'never' | 'focus' | 'always';
  /** The Cancel button's word. */
  cancelLabel?: string;
  /** How the ✕ announces itself. */
  clearLabel?: string;
  /**
   * Results are on their way. A spinner takes the ✕'s place, because the two
   * would otherwise sit on top of one another at exactly the moment a query is
   * both non-empty and running.
   */
  loading?: boolean;
  /** The leading glyph, for a search over something with a symbol of its own. */
  icon?: ReactNode;
  /**
   * Lift the whole search — field, Cancel button and panel — until it sits
   * clear of the software keyboard, and put it back on blur. Without it the
   * field stays where the page left it, which on most screens is behind the
   * keyboard it just opened.
   *
   * Install `react-native-keyboard-controller` for this to behave on Android.
   *
   * Do not toggle it at runtime: it changes which component wraps the row, so
   * the field would remount and lose focus.
   */
  avoidKeyboard?: boolean;
  /** Gap kept between the field's bottom edge and the keyboard. */
  keyboardOffset?: number;
  /**
   * When the results panel is shown. `focus` opens it while the field is being
   * typed into, `always` keeps it out for a screen that is nothing but the
   * search, `never` ignores the children entirely.
   */
  panel?: SearchBarPanelMode;
  /**
   * Which side of the field the panel opens out of. `top` is the default,
   * because the space under a focused field belongs to the keyboard.
   */
  panelPlacement?: SearchBarPanelPlacement;
  /**
   * Cap on the panel's height, in points. Derived from the room between the
   * field and the edge of the screen when it is not given, so a panel never
   * runs off the top of the display.
   */
  panelMaxHeight?: number;
  /** The panel's contents — `SearchBar.Section`, `.Item` and `.Status`. */
  children?: ReactNode;
}

const SearchBarRoot = forwardRef<TextInput, SearchBarProps>(
  (
    {
      value: valueProp,
      defaultValue,
      onChangeText,
      onSubmit,
      debounce = 0,
      onDebouncedChange,
      onClear,
      onCancel,
      isClearable = true,
      cancel = 'never',
      cancelLabel = 'Cancel',
      clearLabel = 'Clear search',
      loading = false,
      icon,
      shape,
      size = 'md',
      className,
      containerClassName,
      disabled,
      avoidKeyboard = false,
      keyboardOffset = 12,
      panel = 'focus',
      panelPlacement = 'top',
      panelMaxHeight,
      children,
      onFocus,
      onBlur,
      onSubmitEditing,
      ...props
    },
    ref
  ) => {
    const controlled = valueProp !== undefined;
    const [internal, setInternal] = useState(defaultValue ?? '');
    const text = controlled ? valueProp : internal;

    const [focused, setFocused] = useState(false);
    const inputRef = useRef<TextInput | null>(null);
    useImperativeHandle(ref, () => inputRef.current as TextInput, []);

    /*
     * Counted rather than tested for truthiness: `{results.map(…)}` over an
     * empty array is a child, and a panel that opens on nothing is a card of
     * padding.
     */
    const hasPanel = useMemo(() => {
      let found = false;
      Children.forEach(children, (child) => {
        if (isValidElement(child)) found = true;
      });
      return found;
    }, [children]);

    const panelOpen =
      !disabled &&
      panel !== 'never' &&
      hasPanel &&
      (panel === 'always' || focused);

    const attached = panelOpen ? panelPlacement : 'none';
    const slots = searchBarVariants({ size, shape, attached });

    const setText = useCallback(
      (next: string) => {
        if (!controlled) setInternal(next);
        onChangeText?.(next);
      },
      [controlled, onChangeText]
    );

    /*
     * The debounced callback is read through a ref so an inline arrow function
     * — which is what a caller writes — does not restart the timer on every
     * render and push the pause out forever.
     */
    const debouncedRef = useRef(onDebouncedChange);
    const debounceTimerRef = useRef<SearchBarDebounceTimer['current']>(null);
    useEffect(() => {
      debouncedRef.current = onDebouncedChange;
    });

    // Skipped on mount: nothing was typed, so there is no pause to be at the
    // end of, and firing here would run a search for the initial value.
    const settled = useRef(false);
    useEffect(() => {
      if (!settled.current) {
        settled.current = true;
        return;
      }
      scheduleSearchBarDebounce(debounceTimerRef, debouncedRef.current, text, debounce);
      return () => {
        cancelSearchBarDebounce(debounceTimerRef);
      };
    }, [text, debounce]);

    const handleFocus = useCallback<NonNullable<InputProps['onFocus']>>(
      (event) => {
        setFocused(true);
        onFocus?.(event);
      },
      [onFocus]
    );

    const handleBlur = useCallback<NonNullable<InputProps['onBlur']>>(
      (event) => {
        setFocused(false);
        onBlur?.(event);
      },
      [onBlur]
    );

    const handleSubmit = useCallback(
      (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
        if (disabled) return;
        // A return key is somebody saying they are done waiting, so the
        // pending pause is spent rather than waited out.
        flushSearchBarDebounce(debounceTimerRef, debouncedRef.current, text);
        onSubmit?.(text);
        onSubmitEditing?.(event);
      },
      [disabled, onSubmit, onSubmitEditing, text]
    );

    const handleClear = useCallback(() => {
      if (disabled) return;
      setText('');
      onClear?.();
      // The keyboard stays: clearing a query is the start of the next one.
      // Android takes focus away with the press, so it is asked back.
      inputRef.current?.focus();
    }, [disabled, onClear, setText]);

    const handleCancel = useCallback(() => {
      if (disabled) return;
      setText('');
      inputRef.current?.blur();
      onCancel?.();
    }, [disabled, onCancel, setText]);

    /*
     * Cancel's width is measured once and driven from a shared value, so the
     * slide costs no re-render. `cancelWidth` is a shared value rather than
     * state for the same reason — a measurement that arrives as state would
     * re-render the field it is beside.
     */
    const cancelWidth = useSharedValue(0);
    const cancelOut = cancel === 'always' || (cancel === 'focus' && focused);
    const cancelProgress = useSharedValue(cancel === 'always' ? 1 : 0);

    useEffect(() => {
      if (cancel === 'never') return;
      cancelProgress.value = withTiming(cancelOut ? 1 : 0, {
        duration: CANCEL_DURATION,
      });
    }, [cancel, cancelOut, cancelProgress]);

    const cancelStyle = useAnimatedStyle(() => ({
      width: (cancelWidth.value + CANCEL_GAP) * cancelProgress.value,
      opacity: cancelProgress.value,
    }));

    const handleCancelLayout = useCallback(
      (event: LayoutChangeEvent) => {
        cancelWidth.value = event.nativeEvent.layout.width;
      },
      [cancelWidth]
    );

    /*
     * How much room the panel has, in the direction it opens. Measured on the
     * JS side because it decides a layout constraint rather than a frame of an
     * animation: a `maxHeight` that changed every frame would re-lay out the
     * list under the finger scrolling it.
     */
    const { height: windowHeight } = useWindowDimensions();
    const { height: keyboardHeight } = useKeyboard();
    const anchorRef = useRef<View | null>(null);
    const [anchorBox, setAnchorBox] = useState<{ top: number; height: number } | null>(
      null
    );

    const measureAnchor = useCallback(() => {
      anchorRef.current?.measureInWindow((_x, y, _width, height) => {
        setAnchorBox((current) =>
          current && current.top === y && current.height === height
            ? current
            : { top: y, height }
        );
      });
    }, []);

    useEffect(() => {
      if (!panelOpen) return;
      measureAnchor();
    }, [panelOpen, keyboardHeight, measureAnchor]);

    const resolvedMaxHeight = useMemo(() => {
      if (panelMaxHeight !== undefined) return panelMaxHeight;
      const fieldHeight = anchorBox?.height ?? 0;
      /*
       * While the field is riding the keyboard, where it has come to rest is
       * computed rather than measured: the lift is a transform applied on the
       * UI thread, so a measurement taken from JavaScript is a frame behind it
       * for the whole of the animation.
       */
      const fieldTop =
        avoidKeyboard && keyboardHeight > 0
          ? windowHeight - keyboardHeight - keyboardOffset - fieldHeight
          : (anchorBox?.top ?? 0);
      const room =
        panelPlacement === 'top'
          ? fieldTop - PANEL_EDGE_GAP
          : windowHeight - keyboardHeight - fieldTop - fieldHeight - PANEL_EDGE_GAP;
      return Math.max(room, PANEL_MIN_HEIGHT);
    }, [
      anchorBox,
      avoidKeyboard,
      keyboardHeight,
      keyboardOffset,
      panelMaxHeight,
      panelPlacement,
      windowHeight,
    ]);

    const startContent = (
      /*
       * Decorative, and said so here rather than through Input's
       * `interactiveContent` — that flag covers both ends of the field, and
       * turning it off to quieten the magnifier would take the clear button's
       * touches with it.
       */
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {icon ?? <SearchIcon size={ICON_SIZE[size]} />}
      </View>
    );

    const endContent = loading ? (
      <Spinner size="sm" />
    ) : isClearable && text.length > 0 ? (
      <AnimatedPressable
        onPress={handleClear}
        disabled={disabled}
        hitSlop={CLEAR_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={clearLabel}
        className={slots.clear()}
      >
        <XIcon size={ICON_SIZE[size]} />
      </AnimatedPressable>
    ) : null;

    const field = (
      <Input
        ref={inputRef}
        size={size}
        disabled={disabled}
        className={slots.field({ className })}
        containerClassName="w-full"
        startContent={startContent}
        endContent={endContent}
        value={text}
        onChangeText={setText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={handleSubmit}
        accessibilityRole="search"
        returnKeyType="search"
        // The platform's own ✕ would sit on top of this component's, and only
        // on iOS.
        clearButtonMode="never"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="Search"
        {...props}
      />
    );

    // Nothing beside it and nothing under it: the field is the whole component,
    // and a wrapper around it would only be a box for the caller's layout to
    // fight.
    if (cancel === 'never' && !avoidKeyboard && !hasPanel) {
      return <View className={containerClassName}>{field}</View>;
    }

    const anchor = (
      <View
        ref={anchorRef}
        onLayout={panelOpen ? measureAnchor : undefined}
        className={slots.anchor({ className: cancel === 'never' ? 'w-full' : 'flex-1' })}
      >
        {panelOpen ? (
          <Animated.View
            entering={FadeIn.duration(PANEL_IN)}
            exiting={FadeOut.duration(PANEL_OUT)}
            style={[
              panelPlacement === 'top' ? PANEL_ABOVE : PANEL_BELOW,
              { maxHeight: resolvedMaxHeight },
            ]}
            className={slots.panel()}
          >
            <ScrollView
              /*
               * Without this the first tap on a row is spent dismissing the
               * keyboard and the press never lands, which reads as a list that
               * ignores every other touch.
               */
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {children}
            </ScrollView>
          </Animated.View>
        ) : null}
        {field}
      </View>
    );

    const body =
      cancel === 'never' ? (
        anchor
      ) : (
        <>
          {anchor}
          <Animated.View
            style={cancelStyle}
            className={slots.cancelClip()}
            pointerEvents={cancelOut ? 'auto' : 'none'}
            accessibilityElementsHidden={!cancelOut}
            importantForAccessibility={cancelOut ? 'auto' : 'no-hide-descendants'}
          >
            {/*
             * Absolute, and pinned to the end edge: it keeps its natural width
             * inside a container whose width is animating, so the clip reveals
             * it from the edge instead of squeezing the word as it arrives. It
             * is also what makes the measurement possible at all — a child laid
             * out against a container of width 0 would otherwise report 0.
             */}
            <AnimatedPressable
              onLayout={handleCancelLayout}
              onPress={handleCancel}
              disabled={disabled}
              focusable={!disabled}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!disabled }}
              className={slots.cancelButton()}
            >
              <Text className={slots.cancelLabel()}>{cancelLabel}</Text>
            </AnimatedPressable>
          </Animated.View>
        </>
      );

    /*
     * The keyboard hook is behind a component boundary rather than a flag.
     * Calling it at all has global consequences — without the keyboard
     * controller installed it falls back to Reanimated's useAnimatedKeyboard,
     * which switches Android out of adjustResize for the whole app. A search
     * bar that never asked to avoid the keyboard must not do that to every
     * other screen.
     */
    if (avoidKeyboard) {
      return (
        <KeyboardAvoider
          // Only while *this* field is the one being typed into. Without it
          // every avoiding field on the screen lifts the moment any field
          // anywhere is tapped, and since they all aim at the same gap above
          // the keyboard, they arrive stacked on top of one another.
          active={focused}
          mode="lift"
          offset={keyboardOffset}
          className={slots.row({ className: containerClassName })}
        >
          {body}
        </KeyboardAvoider>
      );
    }

    return <View className={slots.row({ className: containerClassName })}>{body}</View>;
  }
);

SearchBarRoot.displayName = 'SearchBar';

export interface SearchBarSectionProps extends ViewProps {
  className?: string;
  /**
   * The heading over the run of rows — "Suggested", "Results". Announced as a
   * header, so a screen reader reaching the group is told what it is before
   * walking into it.
   */
  label?: string;
  children?: ReactNode;
}

/** A labelled run of rows inside the panel. */
function SearchBarSection({ className, label, children, ...props }: SearchBarSectionProps) {
  const { sectionLabel } = searchBarVariants();
  return (
    <View {...props} className={className}>
      {label ? (
        <Text accessibilityRole="header" className={sectionLabel()}>
          {label}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

SearchBarSection.displayName = 'SearchBar.Section';

export interface SearchBarItemProps extends Omit<AnimatedPressableProps, 'children'> {
  className?: string;
  /** Anything before the label — an avatar, a logo, a status dot. */
  leading?: ReactNode;
  /**
   * Anything after it. A slot rather than a built-in button, because what a
   * result row offers differs per search: an add, a pin, a count, nothing.
   */
  trailing?: ReactNode;
  /** A second line under the label, for what the label alone cannot say. */
  description?: string;
  /** Draws the row as the one the search has settled on. */
  selected?: boolean;
  /** The row's label. */
  children?: ReactNode;
}

/** One result. */
function SearchBarItem({
  className,
  leading,
  trailing,
  description,
  selected,
  children,
  ...props
}: SearchBarItemProps) {
  const { item, itemLabel } = searchBarVariants({ selected: !!selected });
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!props.disabled }}
      // A row is a wide target, and a target that shrinks when pressed reads as
      // a card rather than a line in a list. The dim is the whole feedback.
      pressScale={1}
      pressOpacity={0.6}
      // The rows sit flush against each other, so the points either side of the
      // gap between two of them would otherwise belong to neither.
      hitSlop={{ top: 2, bottom: 2 }}
      {...props}
      className={item({ className })}
    >
      {leading}
      <View className="flex-1">
        <Text numberOfLines={1} className={itemLabel()}>
          {children}
        </Text>
        {description ? (
          <Text size="sm" muted numberOfLines={1}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing}
    </AnimatedPressable>
  );
}

SearchBarItem.displayName = 'SearchBar.Item';

export interface SearchBarStatusProps extends ViewProps {
  className?: string;
  /** A spinner beside the line, for a search that is still running. */
  loading?: boolean;
  children?: ReactNode;
}

/**
 * The one line a panel shows instead of rows — nothing typed yet, a search in
 * flight, or a query that matched nothing. It is a sentence rather than an
 * empty box because those three states look identical when they are blank, and
 * which one it is decides what the person does next.
 */
function SearchBarStatus({
  className,
  loading = false,
  children,
  ...props
}: SearchBarStatusProps) {
  const { status } = searchBarVariants();
  return (
    <View accessibilityRole="text" {...props} className={status({ className })}>
      {loading ? <Spinner size="sm" /> : null}
      <Text size="sm" muted>
        {children}
      </Text>
    </View>
  );
}

SearchBarStatus.displayName = 'SearchBar.Status';

export const SearchBar = Object.assign(SearchBarRoot, {
  Section: SearchBarSection,
  Item: SearchBarItem,
  Status: SearchBarStatus,
});
