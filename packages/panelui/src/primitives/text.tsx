import { forwardRef } from 'react';
import { Text as RNText, type Text as RNTextType, type TextProps as RNTextProps } from 'react-native';
import { tv, type VariantProps } from 'tailwind-variants';
import { useDirection } from '../hooks/use-direction';

const textVariants = tv({
  base: 'text-foreground',
  variants: {
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    muted: {
      true: 'text-muted-foreground',
    },
  },
  defaultVariants: {
    size: 'base',
    weight: 'normal',
  },
});

export interface TextProps extends RNTextProps, VariantProps<typeof textVariants> {
  className?: string;
}

export const Text = forwardRef<RNTextType, TextProps>(
  ({ className, size, weight, muted, style, ...props }, ref) => {
    /*
     * `direction` is a Yoga *layout* property, and React Native resolves a
     * paragraph's own alignment from the process-wide `I18nManager.isRTL`
     * instead — so a `<Direction dir="rtl">` mirrors the furniture around this
     * text and leaves the text itself left-aligned inside it. Setting
     * `writingDirection` is what closes that gap, and it also puts bidi
     * punctuation on the correct end of a mixed line.
     *
     * Only the direction, not the alignment: `textAlign` stays whatever the
     * caller asked for, or unset. A component that centres its label means it
     * in both directions.
     */
    const direction = useDirection();

    return (
      <RNText
        ref={ref}
        className={textVariants({ size, weight, muted, className })}
        style={[{ writingDirection: direction }, style]}
        {...props}
      />
    );
  }
);

Text.displayName = 'Text';
