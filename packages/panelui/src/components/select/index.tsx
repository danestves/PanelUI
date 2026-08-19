/**
 * Select — a picker with one trigger and three ways of showing its options.
 *
 * Which one is right depends on what surrounds the trigger, not on what the
 * options are, which is why it is a prop rather than three components:
 *
 * - `sheet` (default) takes the bottom of the screen. Best for a long list, or
 *   on a small screen where an anchored panel would cover the thing you are
 *   choosing for.
 * - `inline` expands the list in normal layout flow. Everything below moves
 *   down. Right inside a settings list, where that reads as the row growing;
 *   wrong anywhere the shift is jarring.
 * - `overlay` floats the list above the page through a portal, anchored to the
 *   trigger and flipped above it when there is no room below. Nothing else on
 *   the screen moves.
 *
 * ```tsx
 * <Select value={region} onValueChange={setRegion} presentation="overlay">
 *   <Select.Item value="us" label="United States" />
 *   <Select.Item value="eu" label="Europe" />
 * </Select>
 * ```
 *
 * Past a couple of dozen options, scrolling stops being a way of finding
 * anything: pass `searchable` and the list gets a filter above it, matching on
 * the option labels. The filter narrows what is *shown* — the declared options
 * are still the source of truth, so nothing has to be lifted into state to make
 * it work.
 *
 * A list long enough to need a filter is usually long enough to want dividing,
 * so options can be wrapped in `Select.Group` under a heading. Grouping is
 * presentational — the value is still a flat string — and the filter reaches
 * through it, dropping any group the query empties rather than leaving a
 * heading standing over nothing.
 */
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { tv } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { CheckIcon, ChevronDownIcon, SearchIcon } from '../../icons';
import { getNativeUI } from '../../native';
import { Portal } from '../../primitives/portal';
import { Text, textChildren } from '../../primitives/text';
import { useBackHandler } from '../../hooks/use-back-handler';
import { cn } from '../../utils/cn';
import { BottomSheet } from '../bottom-sheet';
import { InputGroup } from '../input-group';
import { nativeSelectSupportsOptions } from './native-select-contract';

const selectVariants = tv({
  slots: {
    // `rounded-lg`, the same radius Button and Input use — a select sitting in
    // a form beside either of them should read as the same family of control.
    trigger:
      'w-full flex-row items-center justify-between gap-3 rounded-lg border border-input bg-background px-4 py-3.5',
    triggerLabel: 'flex-1 text-base font-medium text-foreground',
    placeholder: 'flex-1 text-base text-muted-foreground',
    list: 'overflow-hidden rounded-xl border border-border bg-popover p-2 shadow-sm',
    item: 'flex-row items-center gap-2 rounded-lg px-3 py-3',
    itemLabel: 'flex-1 text-base font-medium text-foreground',
    itemIndicator: 'h-5 w-5 items-center justify-center',
    group: 'gap-1',
    groupLabel: 'px-3 pb-1 pt-2',
  },
  variants: {
    selected: {
      true: { item: 'bg-accent' },
    },
    disabled: {
      true: { trigger: 'opacity-[0.64]' },
    },
    itemDisabled: {
      true: { item: 'opacity-[0.64]' },
    },
    presentation: {
      sheet: {},
      inline: { list: 'mt-2' },
      overlay: { list: 'shadow-lg' },
    },
  },
  defaultVariants: {
    presentation: 'sheet',
  },
});

export type SelectPresentation = 'sheet' | 'inline' | 'overlay';

interface SelectContextValue {
  value: string | undefined;
  onSelect: (value: string) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

export interface SelectItemProps {
  value: string;
  label: string;
  /**
   * Shows the option but refuses it — a plan above the current tier, a region
   * with nothing in stock. Kept in the list rather than dropped from it, because
   * an option that vanishes reads as one that never existed.
   */
  disabled?: boolean;
}

/** Declarative option. Rendered inside whichever surface is presenting. */
function SelectItem({ value, label, disabled }: SelectItemProps) {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('Select.Item must be used within a <Select>');
  }

  const selected = context.value === value;
  const { item, itemLabel, itemIndicator } = selectVariants({
    selected,
    itemDisabled: !!disabled,
  });
  const checkColor = useCSSVariable('--color-muted-foreground');

  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => context.onSelect(value)}
      className={item()}
    >
      <Text className={itemLabel()}>{label}</Text>
      <View className={itemIndicator()}>
        {selected ? (
          <CheckIcon
            size={16}
            color={typeof checkColor === 'string' ? checkColor : '#737373'}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export interface SelectGroupProps {
  /**
   * Heading over the run of options. Announced as a header, so a screen reader
   * reaching the group is told what it is before walking into it.
   */
  label?: string;
  /** Extra classes for the group wrapper. */
  className?: string;
  /** Extra classes for the heading. */
  labelClassName?: string;
  children: ReactNode;
}

/**
 * A titled run of options.
 *
 * Purely a way of arranging the list: a grouped Select still reports one flat
 * string, and `Select.Item` needs to know nothing about being inside one.
 */
function SelectGroup({ label, className, labelClassName, children }: SelectGroupProps) {
  const { group, groupLabel } = selectVariants();

  return (
    <View className={cn(group(), className)}>
      {label ? (
        <View accessibilityRole="header" className={cn(groupLabel(), labelClassName)}>
          <Text size="xs" weight="medium" muted className="uppercase tracking-wide">
            {label}
          </Text>
        </View>
      ) : null}
      {textChildren(children)}
    </View>
  );
}

/**
 * Walk the declared children, visiting every `Select.Item` — including the ones
 * nested inside a `Select.Group`.
 *
 * Grouping is a rendering concern, but the selected label and the native
 * picker's option list both want the flat set, so the tree is flattened once
 * here rather than in each of them.
 */
function eachOption(children: ReactNode, visit: (option: SelectItemProps) => void) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === SelectGroup) {
      eachOption((child.props as SelectGroupProps).children, visit);
      return;
    }
    if (child.type !== SelectItem) return;
    const { value, label, disabled } = child.props as SelectItemProps;
    visit({ value, label, disabled });
  });
}

/**
 * The children a query leaves standing.
 *
 * A group is rebuilt around whatever survives inside it and dropped when that
 * is nothing — a heading with no options under it reads as a section that
 * failed to load rather than one the filter emptied. Anything that is neither
 * an item nor a group is left alone: a caption or a divider the caller put in
 * the list is not something a filter has an opinion about.
 */
function filterOptions(children: ReactNode, needle: string): ReactNode[] {
  const kept: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    if (child.type === SelectGroup) {
      const props = child.props as SelectGroupProps;
      const inner = filterOptions(props.children, needle);
      if (inner.length) {
        kept.push(cloneElement(child as ReactElement<SelectGroupProps>, {}, inner));
      }
      return;
    }

    if (child.type === SelectItem) {
      const { label } = child.props as SelectItemProps;
      if (label.toLowerCase().includes(needle)) kept.push(child);
    }
  });

  return kept;
}

/** Trigger frame in window coordinates, measured when the list opens. */
interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectProps {
  className?: string;
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Where the options appear. `sheet` takes the bottom of the screen, `inline`
   * expands the list in layout flow, `overlay` floats it above the page
   * anchored to the trigger.
   */
  presentation?: SelectPresentation;
  /** Sheet title shown above the options. `sheet` presentation only. */
  title?: string;
  /**
   * Width of the floating list. `trigger` matches the trigger, `content` sizes
   * to the longest option, or pass a pixel value. `overlay` only.
   */
  contentWidth?: 'trigger' | 'content' | number;
  /** Gap between the trigger and the floating list. `overlay` only. */
  offset?: number;
  /** Called when the options open or close. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Put a filter above the options, matching case-insensitively on any part of
   * an option's label. For a list long enough that scrolling it is not finding
   * anything — countries, currencies, a repository's branches.
   *
   * The field is not focused on open: on a phone that would throw the keyboard
   * over the very list you are trying to look at.
   */
  searchable?: boolean;
  /** Placeholder for the filter field. `searchable` only. */
  searchPlaceholder?: string;
  /** Shown in place of the list when the filter matches nothing. */
  emptyMessage?: string;
  /**
   * Render the platform's own picker instead of the trigger-and-list pair.
   * Requires the optional `@expo/ui` package; without it this prop does
   * nothing.
   *
   * **Theme tokens do not apply** — the platform draws the picker, so
   * `className`, `title` and `presentation` are ignored. `Select.Item`
   * children still declare the options.
   */
  native?: boolean;
  /**
   * Native picker style. `menu` is a compact button opening a dropdown;
   * `wheel` is an always-visible rotor (iOS; falls back to `menu` elsewhere).
   */
  nativeAppearance?: 'menu' | 'wheel';
  children: ReactNode;
}

function SelectRoot({
  className,
  value,
  onValueChange,
  placeholder = 'Select an option',
  disabled,
  presentation = 'sheet',
  title,
  contentWidth = 'trigger',
  offset = 8,
  onOpenChange,
  searchable = false,
  searchPlaceholder = 'Search',
  emptyMessage = 'No matches',
  native,
  nativeAppearance = 'menu',
  children,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [listHeight, setListHeight] = useState(0);
  const triggerRef = useRef<View>(null);
  const chevron = useSharedValue(0);
  const { height: screenHeight } = useWindowDimensions();

  const options = useMemo(() => {
    const collected: SelectItemProps[] = [];
    eachOption(children, (option) => collected.push(option));
    return collected;
  }, [children]);

  /*
   * @expo/ui's portable Picker only has a control-wide `enabled` flag. Its
   * items accept label and value, but no disabled state, so handing it a
   * disabled Select.Item would make that option selectable again. Preserve
   * the public item contract by using the styled Select for that list.
   */
  const nativeUI =
    native && nativeSelectSupportsOptions(options) ? getNativeUI() : null;

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label,
    [options, value]
  );

  /*
   * The options the filter leaves standing, or null when nothing is being
   * filtered — which is the common case, and the one that must not pay for the
   * feature. `null` means "render the children as given", so an unsearched
   * Select does no per-option work at all.
   */
  const filtered = useMemo(() => {
    const needle = searchable ? query.trim().toLowerCase() : '';
    if (!needle) return null;

    return filterOptions(children, needle);
  }, [children, query, searchable]);

  const close = useCallback(() => {
    chevron.value = withTiming(0, { duration: 160 });
    setOpen(false);
    onOpenChange?.(false);
    // A filter left behind would be waiting the next time the list opens, with
    // most of the options missing and no obvious reason why.
    setQuery('');
  }, [chevron, onOpenChange]);

  // An open overlay list catches the Android back button, closing itself
  // instead of popping the screen behind it. The `sheet` presentation gets the
  // same behaviour from its BottomSheet; the native picker owns its own back.
  useBackHandler(open && presentation === 'overlay' && !nativeUI, close);

  const toggle = useCallback(() => {
    if (open) {
      close();
      return;
    }

    const show = () => {
      chevron.value = withTiming(1, { duration: 160 });
      setOpen(true);
      onOpenChange?.(true);
    };

    if (presentation !== 'overlay') {
      show();
      return;
    }

    // The floating list is positioned in window coordinates, so it has to know
    // where the trigger actually landed — not where layout said it would.
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      show();
    });
  }, [chevron, close, onOpenChange, open, presentation]);

  const context = useMemo<SelectContextValue>(
    () => ({
      value,
      onSelect: (next) => {
        onValueChange(next);
        close();
      },
    }),
    [value, onValueChange, close]
  );

  const slots = selectVariants({ disabled: !!disabled, presentation });
  const chevronColor = useCSSVariable('--color-muted-foreground');

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevron.value * 180}deg` }],
  }));

  if (nativeUI) {
    const { Host, Picker } = nativeUI;
    // The native picker has no empty state, so an unset value shows the first
    // selectable option rather than the placeholder.
    const firstEnabled = options.find((option) => !option.disabled);
    return (
      // A picker fills the width of the row it sits in and reports its own
      // height — a menu is a compact button, a wheel a full rotor, and the
      // platform is the only thing that knows which by how much.
      <Host matchContents={{ vertical: true }} ignoreSafeArea="keyboard">
        <Picker
          selectedValue={value ?? firstEnabled?.value ?? ''}
          onValueChange={(next: string) => onValueChange(next)}
          appearance={nativeAppearance}
          enabled={!disabled}
        >
          {options.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </Host>
    );
  }

  const trigger = (
    <Pressable
      ref={triggerRef}
      /*
       * A trigger that owns a list of options and reports whether that list is
       * open is a combobox, not a button — and `expanded` only means anything
       * on a role that can be expanded. Announced as "collapsed"/"expanded"
       * rather than as a button whose state has nowhere to be read.
       */
      accessibilityRole="combobox"
      accessibilityState={{ disabled: !!disabled, expanded: open }}
      disabled={disabled}
      onPress={toggle}
      className={slots.trigger()}
    >
      {selectedLabel ? (
        <Text className={slots.triggerLabel()}>{selectedLabel}</Text>
      ) : (
        <Text className={slots.placeholder()}>{placeholder}</Text>
      )}
      <Animated.View style={chevronStyle}>
        <ChevronDownIcon
          color={typeof chevronColor === 'string' ? chevronColor : '#737373'}
        />
      </Animated.View>
    </Pressable>
  );

  /*
   * The filter, and the list it narrows. Both are built once here rather than
   * per presentation: the three surfaces differ in where they put the field —
   * above the scroller, so it does not scroll away with the options — not in
   * what it is.
   */
  const search = searchable ? (
    <View className="pb-2">
      <InputGroup>
        <InputGroup.Prefix isDecorative>
          <SearchIcon
            size={18}
            color={typeof chevronColor === 'string' ? chevronColor : '#737373'}
          />
        </InputGroup.Prefix>
        <InputGroup.Input
          variant="filled"
          size="sm"
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          accessibilityLabel={searchPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </InputGroup>
    </View>
  ) : null;

  const optionList =
    filtered === null ? (
      textChildren(children)
    ) : filtered.length ? (
      filtered
    ) : (
      <Text className="px-3 py-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </Text>
    );

  if (presentation === 'sheet') {
    return (
      <SelectContext.Provider value={context}>
        <View className={className}>{trigger}</View>
        {/* The sheet only ever reports a close — it is opened from the
            trigger — and close() has the chevron to put back. */}
        <BottomSheet
          open={open}
          onOpenChange={(next) => {
            if (!next) close();
          }}
        >
          <BottomSheet.Content>
            {/* BottomSheet.Content portals its children out of this subtree —
                re-provide the select context so Select.Item keeps working. */}
            <SelectContext.Provider value={context}>
              {title ? (
                <Text size="lg" weight="semibold" className="mb-2 px-3">
                  {title}
                </Text>
              ) : null}
              {search ? <View className="px-1">{search}</View> : null}
              <ScrollView
                bounces={false}
                className="max-h-96"
                // The filter is a text field above a scroller: dismissing the
                // keyboard on a drag is what lets you look at what you filtered
                // to without first tapping somewhere neutral.
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              >
                <View className="gap-1 pb-2">{optionList}</View>
              </ScrollView>
            </SelectContext.Provider>
          </BottomSheet.Content>
        </BottomSheet>
      </SelectContext.Provider>
    );
  }

  if (presentation === 'inline') {
    return (
      <SelectContext.Provider value={context}>
        <View className={className}>
          {trigger}
          {open ? (
            <Animated.View
              entering={FadeIn.duration(140)}
              exiting={FadeOut.duration(120)}
              className={slots.list()}
            >
              {search}
              {optionList}
            </Animated.View>
          ) : null}
        </View>
      </SelectContext.Provider>
    );
  }

  // Flip above the trigger when the list would run off the bottom. listHeight
  // is 0 on the first frame, so the list opens downwards and corrects itself
  // once measured — which is invisible inside the 140ms fade.
  const spaceBelow = anchor ? screenHeight - (anchor.y + anchor.height) - offset : 0;
  const flip = !!anchor && listHeight > 0 && listHeight > spaceBelow;

  const overlayPosition = anchor
    ? {
        position: 'absolute' as const,
        left: anchor.x,
        ...(flip
          ? { bottom: screenHeight - anchor.y + offset }
          : { top: anchor.y + anchor.height + offset }),
        ...(contentWidth === 'trigger'
          ? { width: anchor.width }
          : typeof contentWidth === 'number'
            ? { width: contentWidth }
            : { minWidth: anchor.width }),
        // Never collapse to nothing in a cramped viewport — the list scrolls.
        maxHeight: Math.max((flip ? anchor.y : spaceBelow) - offset, 160),
      }
    : null;

  const onListLayout = (event: LayoutChangeEvent) => {
    setListHeight(event.nativeEvent.layout.height);
  };

  return (
    <SelectContext.Provider value={context}>
      <View className={className}>{trigger}</View>

      {open && overlayPosition ? (
        <Portal>
          {/*
           * Full-screen catcher so a press anywhere else dismisses the list.
           *
           * Hidden from assistive tech, and deliberately: it is a dismiss
           * affordance for a pointer, and announcing it would put an unlabelled
           * full-screen "button" ahead of the options in the reading order,
           * where swiping through the list would land on it before the first
           * one. Escaping the list is the back gesture's job, and on iOS the
           * modal flag's.
           */}
          <Pressable
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            onPress={close}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <SelectContext.Provider value={context}>
            <Animated.View
              entering={FadeIn.duration(140)}
              exiting={FadeOut.duration(120)}
              onLayout={onListLayout}
              style={overlayPosition}
              /*
               * The floating list is a modal layer, the same as the sheet
               * presentation's is — it covers the screen with a catcher and
               * takes the back button. Without this the page behind it stays
               * in the accessibility tree, so a screen reader could walk out
               * of the open list into content the list is covering and act on
               * it. The sheet gets this from BottomSheet; the anchored list
               * has to say it itself.
               */
              accessibilityViewIsModal
              className={slots.list()}
            >
              {search}
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              >
                {optionList}
              </ScrollView>
            </Animated.View>
          </SelectContext.Provider>
        </Portal>
      ) : null}
    </SelectContext.Provider>
  );
}

SelectItem.displayName = 'Select.Item';
SelectGroup.displayName = 'Select.Group';

export const Select = Object.assign(SelectRoot, {
  Item: SelectItem,
  Group: SelectGroup,
});
