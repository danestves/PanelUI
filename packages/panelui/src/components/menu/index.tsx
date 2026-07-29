/**
 * Menu — the list of things you can do to something.
 *
 * It is not a Select, and the difference is what the rows *are*. A select's
 * rows are values: picking one answers a question the form asked, and the
 * trigger then shows the answer. A menu's rows are verbs — rename, duplicate,
 * delete — and the trigger goes on saying the same thing afterwards, because
 * nothing about it was chosen. Anything built out of a popover and a column of
 * pressables ends up re-deriving that distinction by hand, and re-deriving the
 * roles, the dismiss-on-select rule and the destructive colour with it.
 *
 * ```tsx
 * <Menu>
 *   <Menu.Trigger>
 *     <Button variant="outline">Options</Button>
 *   </Menu.Trigger>
 *   <Menu.Content align="start">
 *     <Menu.Item icon={<PencilIcon size={16} />}>Rename</Menu.Item>
 *     <Menu.Separator />
 *     <Menu.Item variant="destructive" icon={<TrashIcon size={16} />}>
 *       Delete
 *     </Menu.Item>
 *   </Menu.Content>
 * </Menu>
 * ```
 *
 * The panel is a `Popover` underneath, so the menu inherits its measuring,
 * flipping and edge-clamping rather than owning a second copy of them — a menu
 * near the bottom of the screen opens upwards for the same reason a popover
 * does, and `presentation="bottom-sheet"` moves the same rows into a sheet.
 *
 * Submenus expand in place rather than flying out sideways. A flyout needs a
 * pointer to travel from the parent row to the child panel without crossing
 * anything that would close it; a finger has no such path, and a second panel
 * hanging off the first is usually the thing that pushes a menu off the edge
 * of a phone. Opening downwards into the panel keeps every row under the
 * thumb that opened it.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { tv } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { CheckIcon, ChevronRightIcon } from '../../icons';
import { Text, textChildren } from '../../primitives/text';
import { useDirectionSign } from '../../hooks/use-direction';
import { selectionTick } from '../../utils/haptics';
import { cn } from '../../utils/cn';
import { Popover, type PopoverContentProps, type PopoverProps } from '../popover';

/** Side of the column every indicator is drawn in. */
const INDICATOR_SIZE = 18;

/**
 * A theme token as a colour an icon will accept.
 *
 * `useCSSVariable` answers with whatever the token holds, which for a length
 * or a number is not a colour at all — so anything that is not a string is
 * dropped and the icon falls back to what it inherits.
 */
function useTint(variable: string): string | undefined {
  const raw = useCSSVariable(variable);
  return typeof raw === 'string' ? raw : undefined;
}

const menuVariants = tv({
  slots: {
    content: 'gap-0.5 rounded-2xl p-1.5',
    label: 'px-2.5 pb-1 pt-1.5',
    item: 'w-full flex-row items-center gap-2.5 rounded-xl px-2.5 py-2.5',
    itemLabel: 'text-sm font-medium text-popover-foreground',
    itemDescription: 'text-xs',
    shortcut: 'text-xs tracking-widest',
    separator: 'my-1 h-px bg-border',
    indicator: 'items-center justify-center',
  },
  variants: {
    variant: {
      default: { item: 'active:bg-accent' },
      /*
       * The row is tinted rather than only recoloured. A red word on an
       * otherwise ordinary row is easy to read past at a glance, and this is
       * the one row in the menu where reading past it is expensive.
       */
      destructive: {
        item: 'active:bg-destructive-subtle',
        itemLabel: 'text-destructive',
      },
    },
    disabled: {
      true: { item: 'opacity-[0.45]' },
    },
    /** Reserves the indicator column on a row that has no indicator of its own. */
    inset: {
      true: { item: 'ps-[38px]', label: 'ps-[38px]' },
    },
  },
  defaultVariants: {
    variant: 'default',
    disabled: false,
    inset: false,
  },
});

export type MenuItemVariant = 'default' | 'destructive';

interface MenuContextValue {
  close: () => void;
  haptics: boolean;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenu(component: string): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Menu>`);
  }
  return context;
}

export interface MenuProps extends PopoverProps {
  /**
   * Tick the haptic engine as a row is chosen. Needs the optional
   * `expo-haptics`, and is silent without it.
   */
  haptics?: boolean;
}

function MenuRoot({ children, open, onOpenChange, defaultOpen, haptics = false, ...props }: MenuProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const isControlled = open !== undefined;

  /*
   * The open state is mirrored here as well as inside the popover, because a
   * row has to be able to dismiss the panel it is sitting in and the popover
   * only publishes that through `Popover.Close` — which wraps a child and so
   * cannot be handed to a row that already owns its own press handler.
   */
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const context = useMemo(
    () => ({ close: () => setOpen(false), haptics }),
    [setOpen, haptics]
  );

  return (
    <MenuContext.Provider value={context}>
      <Popover
        open={isControlled ? open : internalOpen}
        onOpenChange={setOpen}
        {...props}
      >
        {children}
      </Popover>
    </MenuContext.Provider>
  );
}

export interface MenuTriggerProps {
  children: ReactElement<{ onPress?: (...args: unknown[]) => void }>;
}

/** Wraps a single child and opens the menu on press. Also what gets measured. */
function MenuTrigger({ children }: MenuTriggerProps) {
  return <Popover.Trigger>{children}</Popover.Trigger>;
}

export interface MenuContentProps
  extends Omit<PopoverContentProps, 'children' | 'scrollable'> {
  children?: ReactNode;
  /**
   * Scroll the rows when there are more of them than fit on screen. On by
   * default, unlike the popover it is built on: a menu is a list, its length
   * is usually a `map` over data rather than something written out by hand,
   * and a row that cannot be reached is a row that may as well not exist.
   */
  scrollable?: boolean;
}

/**
 * The panel, and the thing screen readers announce as a menu.
 *
 * Its padding is the row gutter rather than the popover's content padding —
 * rows run to the panel's inner edge so that a pressed row's highlight reads
 * as part of the panel instead of a floating chip inside it.
 */
function MenuContent({ className, children, scrollable = true, ...props }: MenuContentProps) {
  const { content } = menuVariants();
  const context = useMenu('Menu.Content');

  return (
    <Popover.Content
      accessibilityRole="menu"
      scrollable={scrollable}
      className={cn(content(), className)}
      {...props}
    >
      {/*
        The panel is portalled out of this subtree, and context follows the
        render tree rather than the call site — so the value provided around
        the root never reaches the rows. Re-provide it here, where the rows
        actually mount, and Menu.Item keeps working in both presentations.
      */}
      <MenuContext.Provider value={context}>{textChildren(children)}</MenuContext.Provider>
    </Popover.Content>
  );
}

export interface MenuLabelProps extends ViewProps {
  className?: string;
  /** Line the text up with rows that carry an icon or an indicator. */
  inset?: boolean;
  children?: ReactNode;
}

/** Non-interactive heading over a run of rows. */
function MenuLabel({ className, inset, children, ...props }: MenuLabelProps) {
  const { label } = menuVariants({ inset });

  return (
    <View accessibilityRole="header" className={cn(label(), className)} {...props}>
      {textChildren(children, (text) => (
        <Text size="xs" weight="medium" muted className="uppercase tracking-wide">
          {text}
        </Text>
      ))}
    </View>
  );
}

export interface MenuSeparatorProps extends ViewProps {
  className?: string;
}

/** Hairline between two runs of rows. */
function MenuSeparator({ className, ...props }: MenuSeparatorProps) {
  const { separator } = menuVariants();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn(separator(), className)}
      {...props}
    />
  );
}

export interface MenuItemProps extends Omit<PressableProps, 'children' | 'style'> {
  className?: string;
  /** The row's label. */
  children?: ReactNode;
  /** Leading glyph, drawn in the indicator column. */
  icon?: ReactNode;
  /** Second line under the label, for a row whose effect needs a sentence. */
  description?: string;
  /** Right-aligned hint, for a row that also has a keyboard or gesture shortcut. */
  shortcut?: string;
  /**
   * Element pinned to the row's trailing edge, after the shortcut. For the
   * things a shortcut string cannot be — a chevron, a badge, a small avatar.
   */
  trailing?: ReactNode;
  /** `destructive` colours the row for an action that removes something. */
  variant?: MenuItemVariant;
  /** Line the label up with rows that carry an icon, without drawing one. */
  inset?: boolean;
  disabled?: boolean;
  /**
   * Dismiss the menu once the row has run. Default true — a menu of verbs has
   * done its job the moment one is chosen. Turn it off for a row that toggles
   * something the user is likely to toggle twice.
   */
  closeOnSelect?: boolean;
  onSelect?: () => void;
}

/**
 * One row of the menu.
 *
 * `onSelect` rather than `onPress` is the handler that closes the panel:
 * `onPress` is still forwarded and still fires, so a row can keep whatever
 * press behaviour it had, but the dismissal is tied to the semantic event so
 * that a row which is disabled or which opts out via `closeOnSelect` behaves
 * the same either way.
 */
function MenuItem({
  className,
  children,
  icon,
  description,
  shortcut,
  trailing,
  variant = 'default',
  inset,
  disabled = false,
  closeOnSelect = true,
  onSelect,
  onPress,
  ...props
}: MenuItemProps) {
  const { close, haptics } = useMenu('Menu.Item');
  const slots = menuVariants({ variant, disabled, inset: inset && !icon });

  const handlePress = (...args: Parameters<NonNullable<PressableProps['onPress']>>) => {
    if (disabled) return;
    if (haptics) selectionTick();
    onPress?.(...args);
    onSelect?.();
    if (closeOnSelect) close();
  };

  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      className={cn(slots.item(), className)}
      {...props}
    >
      {icon ? <MenuIndicatorSlot>{icon}</MenuIndicatorSlot> : null}
      <View className="flex-1">
        {textChildren(children, (text) => (
          <Text className={slots.itemLabel()}>{text}</Text>
        ))}
        {description ? (
          <Text size="xs" muted className={slots.itemDescription()}>
            {description}
          </Text>
        ) : null}
      </View>
      {shortcut ? (
        <Text size="xs" muted className={slots.shortcut()}>
          {shortcut}
        </Text>
      ) : null}
      {trailing}
    </Pressable>
  );
}

/**
 * Fixed-width column the leading glyph sits in.
 *
 * Fixed rather than sized to its contents so that a checkmark appearing and
 * disappearing does not shift the label beside it, and so that rows with and
 * without a glyph line their labels up in the same panel.
 */
function MenuIndicatorSlot({ children }: { children?: ReactNode }) {
  const { indicator } = menuVariants();

  return (
    <View className={indicator()} style={{ width: INDICATOR_SIZE, height: INDICATOR_SIZE }}>
      {children}
    </View>
  );
}

/**
 * Placeholder that keeps the indicator column open on an unmarked row.
 *
 * `Menu.Item` draws no column at all when it has no icon, which is right for a
 * row that will never have one — but wrong for a row whose mark appears and
 * disappears as it is toggled.
 */
function MenuIndicatorSpacer() {
  return <View />;
}

export interface MenuCheckboxItemProps extends Omit<MenuItemProps, 'icon' | 'inset'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * A row that carries a state instead of running an action.
 *
 * It keeps the menu open by default, which is the opposite of `Menu.Item` and
 * deliberately so: a set of toggles is nearly always set more than one at a
 * time, and closing after each one turns three taps into six.
 */
function MenuCheckboxItem({
  checked = false,
  onCheckedChange,
  onSelect,
  closeOnSelect = false,
  ...props
}: MenuCheckboxItemProps) {
  const tint = useTint('--color-popover-foreground');

  return (
    <MenuItem
      accessibilityRole="menuitem"
      accessibilityState={{ checked, disabled: props.disabled ?? false }}
      closeOnSelect={closeOnSelect}
      // An empty column rather than no column: the mark comes and goes as the
      // row is toggled, and a row whose label steps sideways each time reads
      // as a different row rather than the same one in a new state.
      icon={checked ? <CheckIcon size={16} color={tint} /> : <MenuIndicatorSpacer />}
      onSelect={() => {
        onCheckedChange?.(!checked);
        onSelect?.();
      }}
      {...props}
    />
  );
}

interface MenuRadioContextValue {
  value: string | undefined;
  select: (value: string) => void;
}

const MenuRadioContext = createContext<MenuRadioContextValue | null>(null);

export interface MenuRadioGroupProps extends ViewProps {
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}

/** A run of rows of which exactly one is chosen. */
function MenuRadioGroup({ value, onValueChange, className, children, ...props }: MenuRadioGroupProps) {
  const context = useMemo(
    () => ({ value, select: (next: string) => onValueChange?.(next) }),
    [value, onValueChange]
  );

  return (
    <MenuRadioContext.Provider value={context}>
      <View accessibilityRole="radiogroup" className={className} {...props}>
        {children}
      </View>
    </MenuRadioContext.Provider>
  );
}

export type MenuRadioIndicator = 'check' | 'dot';

export interface MenuRadioItemProps extends Omit<MenuItemProps, 'icon' | 'inset'> {
  value: string;
  /** `check` marks the chosen row, `dot` is quieter beside a list of nouns. */
  indicator?: MenuRadioIndicator;
}

/** One option inside a `Menu.RadioGroup`. */
function MenuRadioItem({
  value,
  indicator = 'check',
  onSelect,
  closeOnSelect = true,
  ...props
}: MenuRadioItemProps) {
  const group = useContext(MenuRadioContext);
  if (!group) {
    throw new Error('Menu.RadioItem must be used within a <Menu.RadioGroup>');
  }

  const tint = useTint('--color-popover-foreground');
  const selected = group.value === value;

  return (
    <MenuItem
      accessibilityRole="menuitem"
      accessibilityState={{ selected, disabled: props.disabled ?? false }}
      closeOnSelect={closeOnSelect}
      icon={
        selected ? (
          indicator === 'dot' ? (
            <View className="h-2 w-2 rounded-full bg-popover-foreground" />
          ) : (
            <CheckIcon size={16} color={tint} />
          )
        ) : (
          // Held open, so the options stay in one column as the choice moves
          // between them.
          <MenuIndicatorSpacer />
        )
      }
      onSelect={() => {
        group.select(value);
        onSelect?.();
      }}
      {...props}
    />
  );
}

interface MenuSubContextValue {
  open: boolean;
  toggle: () => void;
}

const MenuSubContext = createContext<MenuSubContextValue | null>(null);

function useMenuSub(component: string): MenuSubContextValue {
  const context = useContext(MenuSubContext);
  if (!context) {
    throw new Error(`${component} must be used within a <Menu.Sub>`);
  }
  return context;
}

export interface MenuSubProps {
  children?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Groups a `Menu.SubTrigger` with the rows it reveals. */
function MenuSub({ children, defaultOpen = false, open, onOpenChange }: MenuSubProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const resolved = isControlled ? open : internalOpen;

  const context = useMemo(
    () => ({
      open: resolved,
      toggle: () => {
        if (!isControlled) setInternalOpen(!resolved);
        onOpenChange?.(!resolved);
      },
    }),
    [resolved, isControlled, onOpenChange]
  );

  return <MenuSubContext.Provider value={context}>{children}</MenuSubContext.Provider>;
}

export interface MenuSubTriggerProps
  extends Omit<MenuItemProps, 'closeOnSelect' | 'shortcut' | 'trailing'> {}

/**
 * The row that opens a submenu.
 *
 * Its chevron points along the reading direction while closed and turns to
 * point down once open, so the row states which way its rows will appear
 * rather than only that it has some.
 */
function MenuSubTrigger({ className, children, icon, onSelect, ...props }: MenuSubTriggerProps) {
  const { open, toggle } = useMenuSub('Menu.SubTrigger');
  const sign = useDirectionSign();
  const reducedMotion = useReducedMotion();
  const chevronTint = useTint('--color-muted-foreground');
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = reducedMotion
      ? open
        ? 1
        : 0
      : withTiming(open ? 1 : 0, { duration: 180 });
  }, [open, reducedMotion, progress]);

  // 90° takes a chevron from pointing along the line of text to pointing down
  // into the rows it is about to reveal. Mirrored under RTL, where the closed
  // state points the other way to begin with.
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90 * sign}deg` }],
  }));

  return (
    <MenuItem
      accessibilityState={{ expanded: open, disabled: props.disabled ?? false }}
      closeOnSelect={false}
      icon={icon}
      className={className}
      trailing={
        <Animated.View style={chevronStyle}>
          <ChevronRightIcon size={16} color={chevronTint} />
        </Animated.View>
      }
      onSelect={() => {
        toggle();
        onSelect?.();
      }}
      {...props}
    >
      {children}
    </MenuItem>
  );
}

export interface MenuSubContentProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/**
 * The rows a submenu reveals, opening in place.
 *
 * The height is animated from a measurement rather than left to a layout
 * animation, and the measured copy is absolutely positioned so it always lays
 * out at its natural size — a child of a view whose height is mid-animation
 * would otherwise report the animated height back, and the panel would settle
 * at whatever it happened to measure on the first frame.
 */
function MenuSubContent({ className, children, ...props }: MenuSubContentProps) {
  const { open } = useMenuSub('Menu.SubContent');
  const reducedMotion = useReducedMotion();
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = reducedMotion
      ? open
        ? 1
        : 0
      : withTiming(open ? 1 : 0, { duration: 200 });
  }, [open, reducedMotion, progress]);

  const style = useAnimatedStyle(() => ({
    height: progress.value * height,
    opacity: progress.value,
  }));

  return (
    <Animated.View style={style} className="overflow-hidden">
      {/*
        Indented and ruled along its inner edge, so the rows read as belonging
        to the trigger above them rather than as a second flat list. The rule
        is logical-start, which puts it on the right under RTL.
      */}
      <View
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
        className={cn('ms-4 gap-0.5 border-s border-border ps-1', className)}
        {...props}
      >
        {children}
      </View>
    </Animated.View>
  );
}

MenuTrigger.displayName = 'Menu.Trigger';
MenuContent.displayName = 'Menu.Content';
MenuLabel.displayName = 'Menu.Label';
MenuItem.displayName = 'Menu.Item';
MenuCheckboxItem.displayName = 'Menu.CheckboxItem';
MenuRadioGroup.displayName = 'Menu.RadioGroup';
MenuRadioItem.displayName = 'Menu.RadioItem';
MenuSeparator.displayName = 'Menu.Separator';
MenuSub.displayName = 'Menu.Sub';
MenuSubTrigger.displayName = 'Menu.SubTrigger';
MenuSubContent.displayName = 'Menu.SubContent';

export const Menu = Object.assign(MenuRoot, {
  Trigger: MenuTrigger,
  Content: MenuContent,
  Label: MenuLabel,
  Item: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  Separator: MenuSeparator,
  Sub: MenuSub,
  SubTrigger: MenuSubTrigger,
  SubContent: MenuSubContent,
});
