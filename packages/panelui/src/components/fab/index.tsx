/**
 * Fab — the floating action button: one screen, one thing it is mostly for.
 *
 * ```tsx
 * <Fab icon={<PlusIcon size={24} />} accessibilityLabel="New note" onPress={compose} />
 * ```
 *
 * ## It floats, which is the whole problem with it
 *
 * A button pinned over the content is a button covering some of it, and the
 * bottom-right corner of a scrolling list is exactly where the last row goes. So
 * a Fab is right when a screen has *one* action worth that trade and wrong when
 * it has three — a corner with three buttons in it is a toolbar that has been
 * put in the wrong place. Where a screen has several, the honest shapes are a
 * `ButtonGroup` in a bar or, if one of them really does lead, this with a
 * `Fab.Group` behind it.
 *
 * It positions itself absolutely against its nearest positioned ancestor, which
 * on a screen means the screen. Give the content below it enough bottom padding
 * to scroll clear — this cannot know how tall your list is, and a Fab sitting on
 * the last row forever is the failure people actually hit.
 *
 * ## Extended, and when to bother
 *
 * ```tsx
 * <Fab extended icon={<PencilIcon size={20} />}>Write</Fab>
 * ```
 *
 * A lone glyph is a guess unless the glyph is a plus. `extended` spells the
 * action out, costs the width, and is worth it for anything a plus would not
 * have said.
 *
 * ## The speed dial
 *
 * ```tsx
 * <Fab.Group icon={<PlusIcon size={24} />} accessibilityLabel="Add">
 *   <Fab.Action icon={<ImageIcon size={18} />} label="Photo" onPress={addPhoto} />
 *   <Fab.Action icon={<FileIcon size={18} />} label="File" onPress={addFile} />
 * </Fab.Group>
 * ```
 *
 * The actions come out of the button one after another rather than together —
 * a stagger of a few frames each, which is enough to read as a list unfolding
 * instead of a menu appearing. Every action carries its label beside it, because
 * a column of unlabelled circles is a quiz.
 *
 * Opening also drops a scrim over the screen. Not for looks: an open dial is
 * modal — the next tap either picks something or closes it — and a scrim is what
 * says so, as well as what catches the tap that closes it.
 *
 * ## Where a group has to be written
 *
 * A `Fab.Group` draws its scrim and its buttons as two absolutely positioned
 * siblings in whatever it is written inside, so put it in the screen's root
 * container. That is where its `offset` is measured from, and it is what the
 * scrim covers.
 *
 * It stays in the screen's own view tree rather than being lifted out of it,
 * which is the part that matters after navigation: pushing a screen over this
 * one hides the dial with everything else on it. A group lifted to the top of
 * the app would still be drawn over the screen that replaced it.
 */
import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { tv, type VariantProps } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { IconColorProvider } from '../../icons';
import { useBackHandler } from '../../hooks/use-back-handler';
import { AnimatedPressable } from '../../primitives/animated-pressable';
import { Scrim } from '../../primitives/scrim';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { selectionTick } from '../../utils/haptics';

/** Which corner the button sits in. */
export type FabPlacement = 'bottom-right' | 'bottom-center' | 'bottom-left';

/** How far from the edges a floating button sits, in points. */
const DEFAULT_OFFSET = 16;

/** How long the dial takes to open, and how much each action lags the one above it. */
const OPEN_DURATION = 220;
const STAGGER = 45;

/** How far an action starts below its resting place, in points. */
const ACTION_TRAVEL = 12;

/** A quarter turn on the trigger while the dial is open — a plus becomes a cross. */
const OPEN_ROTATION = 45;

const fabVariants = tv({
  slots: {
    root: 'flex-row items-center justify-center gap-2 rounded-full bg-primary shadow-lg',
    label: 'font-medium text-primary-foreground',
  },
  variants: {
    size: {
      sm: { root: 'h-11 min-w-11', label: 'text-sm' },
      md: { root: 'h-14 min-w-14', label: 'text-base' },
      lg: { root: 'h-16 min-w-16', label: 'text-lg' },
    },
    /* An icon-only button is a circle, so its width is its height and it takes
       no padding. Extended, it is a stadium and the padding is what makes it
       one. */
    extended: {
      true: {},
      false: {},
    },
    variant: {
      primary: { root: 'bg-primary', label: 'text-primary-foreground' },
      secondary: { root: 'bg-secondary', label: 'text-secondary-foreground' },
      surface: { root: 'border border-border bg-popover', label: 'text-foreground' },
      destructive: { root: 'bg-destructive', label: 'text-white' },
    },
    disabled: {
      true: { root: 'opacity-[0.64] shadow-none' },
    },
  },
  compoundVariants: [
    { extended: true, size: 'sm', class: { root: 'px-4' } },
    { extended: true, size: 'md', class: { root: 'px-5' } },
    { extended: true, size: 'lg', class: { root: 'px-6' } },
    { extended: false, size: 'sm', class: { root: 'w-11' } },
    { extended: false, size: 'md', class: { root: 'w-14' } },
    { extended: false, size: 'lg', class: { root: 'w-16' } },
  ],
  defaultVariants: {
    size: 'md',
    variant: 'primary',
    extended: false,
  },
});

type FabVariantProps = VariantProps<typeof fabVariants>;

/** How big the button is. */
export type FabSize = NonNullable<FabVariantProps['size']>;
/** What the button is drawn in. */
export type FabVariant = NonNullable<FabVariantProps['variant']>;

/** The theme token each variant's icon reads against. */
const CONTENT_COLOR_VAR: Record<Exclude<FabVariant, 'destructive'>, string> = {
  primary: '--color-primary-foreground',
  secondary: '--color-secondary-foreground',
  surface: '--color-foreground',
};

/** Where a floating button parks itself, given its offset. */
function anchor(placement: FabPlacement, offset: number) {
  const base = { position: 'absolute' as const, bottom: offset };
  if (placement === 'bottom-left') return { ...base, left: offset };
  if (placement === 'bottom-center') return { ...base, alignSelf: 'center' as const };
  return { ...base, right: offset };
}

/* -------------------------------------------------------------------------- *
 * Fab
 * -------------------------------------------------------------------------- */

export interface FabProps extends Omit<ViewProps, 'children'>, FabVariantProps {
  className?: string;
  /** The glyph. Sized by you — this is the one thing that should not guess. */
  icon?: ReactNode;
  /**
   * The label, which turns the circle into a stadium. Needs `extended`; a
   * label with nowhere to go is a label that gets clipped by the circle.
   */
  children?: ReactNode;
  /** Spell the action out beside the glyph. */
  extended?: boolean;
  /**
   * Pin it over the content, in a corner.
   *
   * Left out, it is an ordinary button in the flow — which is what you want
   * inside a `Fab.Group`, or when the screen already has somewhere for it to
   * sit.
   */
  placement?: FabPlacement;
  /** Distance from the edges when `placement` is set, in points. */
  offset?: number;
  onPress?: () => void;
  disabled?: boolean;
  /**
   * A tick on press. Off by default — needs the optional `expo-haptics`, and
   * is silent without it.
   */
  haptics?: boolean;
  /** Required for an icon-only button. A lone glyph reads out as nothing. */
  accessibilityLabel?: string;
}

const FabRoot = forwardRef<View, FabProps>(
  (
    {
      className,
      icon,
      children,
      extended = false,
      placement,
      offset = DEFAULT_OFFSET,
      size,
      variant,
      disabled = false,
      haptics = false,
      onPress,
      style,
      ...props
    },
    ref
  ) => {
    const { root, label } = fabVariants({
      size,
      variant,
      extended: extended && !!children,
      disabled,
    });

    const themed = useCSSVariable(
      CONTENT_COLOR_VAR[
        variant === 'destructive' ? 'primary' : (variant ?? 'primary')
      ]
    );
    const contentColor =
      variant === 'destructive'
        ? '#ffffff'
        : typeof themed === 'string'
          ? themed
          : undefined;

    const handlePress = useCallback(() => {
      if (haptics) selectionTick();
      onPress?.();
    }, [haptics, onPress]);

    return (
      <IconColorProvider color={contentColor}>
        <AnimatedPressable
          ref={ref}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={handlePress}
          className={root({ className })}
          style={[placement ? anchor(placement, offset) : null, style]}
          {...props}
        >
          {icon}
          {extended && children ? (
            <Text className={label()}>{children}</Text>
          ) : null}
        </AnimatedPressable>
      </IconColorProvider>
    );
  }
);

FabRoot.displayName = 'Fab';

/* -------------------------------------------------------------------------- *
 * Group — the speed dial
 * -------------------------------------------------------------------------- */

/** Whatever was written as a dial child, and the one prop a slot reaches for. */
type PressableChild = ReactElement<{ onPress?: () => void }>;

interface FabGroupContextValue {
  /** 0 closed, 1 open. Every action reads it and its own index off it. */
  progress: SharedValue<number>;
  count: number;
  size: FabSize;
  close: () => void;
}

const FabGroupContext = createContext<FabGroupContextValue | null>(null);

function useFabGroup(part: string): FabGroupContextValue {
  const ctx = useContext(FabGroupContext);
  if (!ctx) throw new Error(`${part} must be used inside <Fab.Group>.`);
  return ctx;
}

export interface FabGroupProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** The glyph on the trigger. */
  icon?: ReactNode;
  /** The trigger's label, if it should be extended while closed. */
  label?: string;
  /** `Fab.Action` children, in the order they should unfold. */
  children?: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Which corner of the *screen* the whole dial parks in. */
  placement?: FabPlacement;
  /** Distance from the screen's edges, in points. Add your safe-area inset. */
  offset?: number;
  size?: FabSize;
  variant?: FabVariant;
  disabled?: boolean;
  haptics?: boolean;
  /** Frost the screen behind the open dial instead of dimming it. */
  blur?: boolean;
  /** Required — the trigger is a lone glyph until it is opened. */
  accessibilityLabel?: string;
  /**
   * Turn the trigger's glyph a quarter circle while the dial is open.
   *
   * On by default, and it is doing real work when the glyph is a plus: the
   * same mark becomes a cross, which says "this closes now" without a second
   * icon that has to be swapped in. Turn it off for a glyph that means
   * something at one angle only.
   */
  rotateOnOpen?: boolean;
}

/**
 * A trigger with actions behind it.
 *
 * The scrim and the dial are two absolutely positioned siblings written into
 * the group's own parent — the scrim first, so the dial is drawn over it. Both
 * are laid out against that parent, which is why a group belongs in the
 * screen's root container: it is what `offset` is measured from and what the
 * scrim covers.
 */
const FabGroup = forwardRef<View, FabGroupProps>(
  (
    {
      className,
      icon,
      label,
      children,
      open: openProp,
      onOpenChange,
      placement = 'bottom-right',
      offset = DEFAULT_OFFSET,
      size = 'md',
      variant,
      disabled = false,
      haptics = false,
      blur = false,
      rotateOnOpen = true,
      accessibilityLabel,
      style,
      ...props
    },
    ref
  ) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = openProp ?? internalOpen;

    const setOpen = useCallback(
      (next: boolean) => {
        if (openProp === undefined) setInternalOpen(next);
        onOpenChange?.(next);
      },
      [openProp, onOpenChange]
    );

    const actions = Children.toArray(children).filter(isValidElement) as PressableChild[];
    /*
     * The count, pulled out as a plain number before any worklet sees it.
     *
     * A worklet captures every variable it *references*, whole — so reading
     * `actions.length` inside one would drag the array of React elements onto
     * the UI thread with it, and an element holds a fibre, which cannot be
     * serialised. The error that produces names neither this file nor this
     * line, so: never reach through an object into a worklet.
     */
    const actionCount = actions.length;

    /*
     * One shared value for the whole dial rather than one per action.
     *
     * The stagger is a function of the action's index, applied on the UI
     * thread inside each action's own style — so opening is a single timing
     * driving every row, and there is no chain of JavaScript timeouts to get
     * out of step with itself when the dial is closed halfway through opening.
     */
    const progress = useDerivedValue<number>(
      () => withTiming(open ? 1 : 0, { duration: OPEN_DURATION + STAGGER * actionCount }),
      [open, actionCount]
    );

    const rotation = useAnimatedStyle(() => ({
      transform: [
        { rotate: `${interpolate(progress.value, [0, 1], [0, OPEN_ROTATION])}deg` },
      ],
    }));

    const close = useCallback(() => setOpen(false), [setOpen]);

    const context = useMemo<FabGroupContextValue>(
      () => ({ progress, count: actionCount, size, close }),
      [progress, actionCount, size, close]
    );

    const toggle = useCallback(() => {
      if (haptics) selectionTick();
      setOpen(!open);
    }, [haptics, open, setOpen]);

    // An open dial owns the back button: back should shut it, not leave it
    // standing over the screen underneath.
    useBackHandler(open, close);

    /*
     * Two absolutely positioned siblings, scrim first, both in the group's own
     * parent — which is why a group belongs in the screen's root container.
     *
     * This used to go through a portal, and the portal was the bug. Portalled
     * content is mounted at the app root, above the router, and is removed only
     * when the component that declared it unmounts. A stack keeps the screen
     * you pushed from mounted, so a group declared on that screen carried on
     * drawing over every screen after it — open or closed, since the trigger
     * travelled through the portal too.
     *
     * Ordering is the reason the portal was reached for in the first place: a
     * scrim that covers the screen must not cover the dial it belongs to. As
     * siblings it comes out right for free — the scrim is written first and the
     * dial after it, and the later sibling draws on top.
     *
     * Nothing remounts when the dial opens. The trigger is in the same place in
     * the tree either way, so opening adds the scrim and the actions and leaves
     * the button alone.
     */
    return (
      <>
        {open ? (
          // Catches the tap that closes the dial, and says it is modal.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
            style={StyleSheet.absoluteFill}
          >
            <Scrim blur={blur} dimClassName="bg-black/32" />
          </Pressable>
        ) : null}

        <FabGroupContext.Provider value={context}>
          <View
            ref={ref}
            className={cn('items-end gap-3', className)}
            style={[anchor(placement, offset), style]}
            {...props}
          >
            {/* Mounted only while open: a column of actions kept alive behind
                the trigger would still be in the accessibility tree, and a
                screen reader would walk into four buttons nobody can see. */}
            {open
              ? actions.map((action, index) => (
                  <FabActionSlot key={index} index={index}>
                    {action}
                  </FabActionSlot>
                ))
              : null}

            <FabRoot
              icon={
                rotateOnOpen ? (
                  <Animated.View style={rotation}>{icon}</Animated.View>
                ) : (
                  icon
                )
              }
              extended={!!label && !open}
              size={size}
              variant={variant}
              disabled={disabled}
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{ disabled, expanded: open }}
              onPress={toggle}
            >
              {label}
            </FabRoot>
          </View>
        </FabGroupContext.Provider>
      </>
    );
  }
);

FabGroup.displayName = 'Fab.Group';

/**
 * One action's slot in the unfolding.
 *
 * The stagger runs bottom-up: the action nearest the trigger arrives first,
 * which is the order a hand travelling away from the button meets them in.
 */
function FabActionSlot({ index, children }: { index: number; children: PressableChild }) {
  const { progress, count, close } = useFabGroup('Fab.Action');

  /*
   * Whatever is in the slot closes the dial when it is pressed.
   *
   * `Fab.Action` does this itself, but a plain `Fab` written as a child is a
   * perfectly reasonable thing to reach for and knows nothing about the dial it
   * is in. Left alone it runs its action — navigating, usually — with the dial
   * still open behind it. Wrapping the handler here covers both, and closing
   * twice is closing once.
   */
  const { onPress } = children.props;
  const child = onPress
    ? cloneElement(children, {
        onPress: () => {
          close();
          onPress();
        },
      })
    : children;

  const style = useAnimatedStyle(() => {
    const steps = Math.max(1, count);
    const from = (count - 1 - index) / (steps + 1);
    const to = from + 1 / (steps + 1) + 0.35;
    const t = interpolate(progress.value, [from, Math.min(1, to)], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: [{ translateY: interpolate(t, [0, 1], [ACTION_TRAVEL, 0]) }],
    };
  });

  return <Animated.View style={style}>{child}</Animated.View>;
}

/* -------------------------------------------------------------------------- *
 * Action
 * -------------------------------------------------------------------------- */

export interface FabActionProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** The glyph. */
  icon?: ReactNode;
  /** What it does, beside the glyph. A column of unlabelled circles is a quiz. */
  label?: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Draws it in the destructive colour, for the one that removes something. */
  destructive?: boolean;
  /** Extra classes for the label chip. */
  labelClassName?: string;
}

/**
 * One choice in an open dial: a small round button with its name beside it.
 *
 * The label is a chip of its own rather than text on the background, because
 * the background is whatever the screen behind the scrim happens to be and
 * plain text over it is legible on some screens and not others.
 *
 * Pressing one closes the dial before running the action. Leaving it open over
 * whatever the action just did is the wrong default: the dial is a menu, and a
 * menu that stays up after a choice reads as the choice not having registered.
 */
const FabAction = forwardRef<View, FabActionProps>(
  (
    { className, icon, label, onPress, disabled = false, destructive = false, labelClassName, ...props },
    ref
  ) => {
    const { size, close } = useFabGroup('Fab.Action');

    const handlePress = useCallback(() => {
      close();
      onPress?.();
    }, [close, onPress]);

    return (
      <View className="flex-row items-center justify-end gap-3" {...props}>
        {label ? (
          <View className="rounded-lg bg-popover px-2.5 py-1 shadow-sm">
            <Text size="sm" className={cn('text-foreground', labelClassName)}>
              {label}
            </Text>
          </View>
        ) : null}
        <FabRoot
          ref={ref}
          icon={icon}
          // A step down from the trigger, so the trigger stays the one that
          // leads even while the dial it opened is on screen.
          size={size === 'lg' ? 'md' : 'sm'}
          variant={destructive ? 'destructive' : 'surface'}
          disabled={disabled}
          accessibilityLabel={label}
          onPress={handlePress}
          className={className}
        />
      </View>
    );
  }
);

FabAction.displayName = 'Fab.Action';

export const Fab = Object.assign(FabRoot, {
  Group: FabGroup,
  Action: FabAction,
});
