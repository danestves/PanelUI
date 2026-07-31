import { forwardRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { tv, type VariantProps } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import {
  AnimatedPressable,
  type AnimatedPressableProps,
} from '../../primitives/animated-pressable';
import { Text, textChildren } from '../../primitives/text';
import { IconColorProvider } from '../../icons';
import { getNativeUI, getSwiftUIModifiers } from '../../native';
import { Spinner } from '../spinner';

const buttonVariants = tv({
  slots: {
    root: 'flex-row items-center justify-center gap-2 rounded-lg border border-transparent',
    label: 'font-medium',
    spinner: '',
  },
  variants: {
    variant: {
      primary: {
        root: 'border-primary bg-primary shadow-sm',
        label: 'text-primary-foreground',
        spinner: 'border-primary-foreground/32 border-t-primary-foreground',
      },
      secondary: {
        root: 'bg-secondary',
        label: 'text-secondary-foreground',
        spinner: 'border-secondary-foreground/24 border-t-secondary-foreground',
      },
      outline: {
        root: 'border-input bg-popover shadow-sm',
        label: 'text-foreground',
        spinner: 'border-muted border-t-foreground',
      },
      ghost: {
        root: 'bg-transparent',
        label: 'text-foreground',
        spinner: 'border-muted border-t-foreground',
      },
      destructive: {
        root: 'border-destructive bg-destructive shadow-sm',
        label: 'text-white',
        spinner: 'border-white/32 border-t-white',
      },
      /** Neutral surface for third-party sign-in, sized for a full-width stack. */
      social: {
        root: 'border-input bg-card shadow-sm',
        label: 'text-foreground',
        spinner: 'border-muted border-t-foreground',
      },
    },
    size: {
      sm: { root: 'h-9 gap-1.5 px-2.5', label: 'text-sm' },
      md: { root: 'h-11 px-4', label: 'text-base' },
      lg: { root: 'h-12 px-6', label: 'text-lg' },
      icon: { root: 'h-11 w-11 px-0' },
    },
    fullWidth: {
      true: { root: 'w-full' },
    },
    disabled: {
      true: { root: 'opacity-[0.64]' },
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

const SPINNER_SIZE = { sm: 'sm', md: 'sm', lg: 'md', icon: 'sm' } as const;

/**
 * The theme token each variant's content reads against. Icons in the content
 * slots inherit the resolved value, so they follow the theme automatically.
 *
 * `destructive` is absent on purpose: its background is a saturated red in
 * every theme, so its content is always white rather than a themed token.
 */
const CONTENT_COLOR_VAR: Record<
  Exclude<NonNullable<ButtonVariantProps['variant']>, 'destructive'>,
  string
> = {
  primary: '--color-primary-foreground',
  secondary: '--color-secondary-foreground',
  outline: '--color-foreground',
  ghost: '--color-foreground',
  social: '--color-foreground',
};

export interface ButtonProps
  extends Omit<AnimatedPressableProps, 'children' | 'disabled'>,
    Omit<ButtonVariantProps, 'disabled'> {
  children?: ReactNode;
  disabled?: boolean;
  /** Show a spinner and block presses while an action is in flight. */
  loading?: boolean;
  /** Content rendered before the label (replaced by the spinner while loading). */
  startContent?: ReactNode;
  /** Content rendered after the label. */
  endContent?: ReactNode;
  /** Extra classes for the label when children is a string. */
  labelClassName?: string;
  /**
   * Render the platform's own button instead of this one. Requires the
   * optional `@expo/ui` package; without it this prop does nothing.
   *
   * **Theme tokens do not apply** — the platform draws the button, so
   * `className`, `fullWidth`, `startContent`, `endContent` and `loading` are
   * all ignored. `variant` maps onto the nearest platform style:
   * `primary`/`destructive` → filled, `outline` → outlined, everything else
   * → text; `size` sets the height.
   *
   * A native button **sizes itself to its label**, the way a platform button
   * is supposed to. It does not stretch to fill its container, and `fullWidth`
   * has no effect on it.
   */
  native?: boolean;
  /**
   * Draw the native button in the platform's Liquid Glass material — the one
   * iOS 26 uses for its own floating controls. Requires `native`, and iOS 26 or
   * later; anywhere else it is ignored and the button keeps its ordinary
   * platform style rather than failing.
   *
   * `primary` and `destructive` take the prominent variant, which keeps the
   * accent tint a filled button is supposed to have; every other variant takes
   * the plain one. An icon button is drawn round rather than in the platform's
   * default capsule.
   */
  glass?: boolean;
}

/**
 * Height given to the platform button, matching the styled scale above.
 *
 * It goes on the button rather than on the host, and that distinction is the
 * whole fix for the jump. A host sized to a number with an unsized control
 * inside it hands the platform a box the control never agreed to: SwiftUI and
 * Compose both lay out against their own intrinsic size and only settle into
 * the box when something forces a second pass — which for a button is the
 * first press. Given a definite height of its own, the button has nothing left
 * to recompute, and the host follows it with `matchContents`.
 */
const NATIVE_HEIGHT: Record<NonNullable<ButtonVariantProps['size']>, number> = {
  sm: 36,
  md: 44,
  lg: 48,
  icon: 44,
};

/**
 * Room around the glyph in a native icon button, applied to the glyph itself.
 *
 * Not to the button, and that distinction is the whole thing. SwiftUI's
 * `padding` on a Button pads *outside* its background — the chrome stays the
 * size it was and moves inward — and `frame` only sets the layout box, leaving
 * a glyph-sized background centred in a larger invisible one. Neither grows
 * the button. What the background is drawn around is the *label*, and the
 * label here is a React Native view we host ourselves, so padding it in React
 * is both the simplest lever and the only one that works.
 */
const NATIVE_ICON_PADDING = 12;

/*
 * `controlSize` is deliberately not sent, though it is the modifier that would
 * otherwise be right for this. Adding it took Expo Go down on entering a screen
 * with a native button on it — a native decode failure is not something a JS
 * try/catch can catch, so an unproven modifier is not worth a crash when
 * padding the label achieves the same thing from the React side. The two
 * modifiers below are the ones already shipped and seen working.
 */

/** PanelUI variants mapped onto the platform button styles. */
const NATIVE_VARIANT: Record<
  NonNullable<ButtonVariantProps['variant']>,
  'filled' | 'outlined' | 'text'
> = {
  primary: 'filled',
  destructive: 'filled',
  secondary: 'filled',
  outline: 'outlined',
  ghost: 'text',
  social: 'outlined',
};

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      children,
      className,
      labelClassName,
      variant,
      size,
      fullWidth,
      disabled,
      loading = false,
      startContent,
      endContent,
      native,
      glass = false,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const nativeUI = native ? getNativeUI() : null;
    const { root, label, spinner } = buttonVariants({
      variant,
      size,
      fullWidth,
      disabled: isDisabled,
    });

    // Icons in the content slots inherit this, so they stay legible when the
    // theme inverts the button's background. Without it every caller has to
    // hardcode a hex that is wrong in one theme or the other.
    const themedColor = useCSSVariable(
      CONTENT_COLOR_VAR[
        variant === 'destructive' ? 'primary' : (variant ?? 'primary')
      ]
    );
    const contentColor =
      variant === 'destructive'
        ? '#ffffff'
        : typeof themedColor === 'string'
          ? themedColor
          : undefined;

    if (nativeUI) {
      const { Host, Button: NativeButton, RNHostView } = nativeUI;
      const isStringLabel = typeof children === 'string';
      const prominent = variant === 'primary' || variant === 'destructive';

      /*
       * Looks the portable props cannot ask for.
       *
       * `buttonStyle` because Liquid Glass has no cross-platform variant to
       * map onto. `glassProminent` is the tinted one — it keeps the accent
       * fill a prominent button is supposed to have, which drawing the
       * material by hand over a plain button throws away. A supplied
       * `buttonStyle` replaces the one the variant would have set, so this is
       * a substitution rather than a layer on top.
       *
       * `buttonBorderShape` because an icon button is round and the platform's
       * default capsule is not — a lone glyph in a capsule reads as a text
       * button somebody forgot to label. It shapes the glass too.
       */
      const swiftUI = getSwiftUIModifiers();
      const nativeModifiers = swiftUI
        ? [
            glass ? swiftUI.buttonStyle(prominent ? 'glassProminent' : 'glass') : null,
            size === 'icon' ? swiftUI.buttonBorderShape('circle') : null,
          ].filter(Boolean)
        : [];

      /*
       * The platform paints the background, not the theme — so a hosted icon
       * cannot read its colour from a token the way it does in the styled
       * button. On a tinted button that is white, whatever the theme thinks its
       * own primary foreground is; on the rest, including plain glass, the
       * material is clear enough to leave the page's own foreground legible.
       */
      const nativeContent = prominent ? '#ffffff' : contentColor;

      return (
        <Host matchContents>
          <NativeButton
            label={isStringLabel ? children : undefined}
            variant={NATIVE_VARIANT[variant ?? 'primary']}
            disabled={isDisabled}
            /*
             * A height for a labelled button, and nothing at all for an icon
             * one. The label's own padding is what decides how big an icon
             * button is; a frame on top would only re-centre the result inside
             * a box of a different size.
             */
            style={size === 'icon' ? undefined : { height: NATIVE_HEIGHT[size ?? 'md'] }}
            modifiers={nativeModifiers.length ? nativeModifiers : undefined}
            onPress={props.onPress}
          >
            {/* Non-string children are React Native views, and the native
                button cannot measure those directly — they have to be hosted
                or they render outside the button's bounds. An icon beside a
                label is the common case, and the label half of it is still
                bare text once it is in there. */}
            {isStringLabel ? undefined : (
              <RNHostView matchContents>
                {/* Padding the hosted label is what grows the button, because
                    the platform draws its background around the label. */}
                <View
                  style={size === 'icon' ? { padding: NATIVE_ICON_PADDING } : undefined}
                >
                  <IconColorProvider color={nativeContent}>
                    {textChildren(children, (text) => (
                      <Text className={label({ className: labelClassName })}>{text}</Text>
                    ))}
                  </IconColorProvider>
                </View>
              </RNHostView>
            )}
          </NativeButton>
        </Host>
      );
    }

    return (
      <IconColorProvider color={contentColor}>
        <AnimatedPressable
          ref={ref}
          accessibilityRole="button"
          accessibilityState={{ disabled: isDisabled, busy: loading }}
          disabled={isDisabled}
          className={root({ className })}
          {...props}
        >
          {loading ? (
            <Spinner size={SPINNER_SIZE[size ?? 'md']} className={spinner()} />
          ) : (
            startContent
          )}
          {textChildren(children, (text) => (
            <Text className={label({ className: labelClassName })}>{text}</Text>
          ))}
          {endContent}
        </AnimatedPressable>
      </IconColorProvider>
    );
  }
);

Button.displayName = 'Button';
