/**
 * ThemeSelector — light, dark, or whatever the device is set to.
 *
 * Three miniatures of a screen, the chosen one ringed. A row of words would
 * take a third of the space and say the same thing, but "System" is the option
 * people hesitate over, and a picture of a screen split down the middle
 * explains it in less time than a sentence does.
 *
 * ```tsx
 * <ThemeSelector label="Choose a theme" />
 * ```
 *
 * ## It reads the theme rather than remembering it
 *
 * There is already one answer to "which theme is this" — Uniwind's — so the
 * selector asks for it instead of keeping a copy that can disagree. Change the
 * theme anywhere else in the app and the ring moves. Pass `value` to show
 * something else, for a settings screen that stages a choice before applying
 * it.
 *
 * ## Light and dark stay inside the family
 *
 * A reader in Moon who picks Light gets Moon's light theme, not the default
 * one. System is the exception, and cannot be otherwise: the device knows only
 * light and dark, so following it means following those two.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { tv } from 'tailwind-variants';
import { useUniwind } from 'uniwind';
import { Text, textChildren } from '../../primitives/text';
import { useTheme, useThemeMode } from '../../theme/use-theme';
import { ThemePreview, type ThemePreviewVariant } from './theme-preview';

export type { ThemePreviewVariant } from './theme-preview';

/** What the selector chooses between. */
export type ThemeSelection = 'system' | 'light' | 'dark';

/** How big the miniatures are drawn. */
export type ThemeSelectorSize = 'sm' | 'md';

/** The three, in the order a selector draws them when it is not told. */
const OPTIONS: readonly ThemeSelection[] = ['system', 'light', 'dark'];

/** What each one is called, when the caller does not say. */
const LABELS: Record<ThemeSelection, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

/** How wide the miniature is drawn, per size. */
const PREVIEW_WIDTH: Record<ThemeSelectorSize, number> = { sm: 72, md: 88 };

const themeSelectorVariants = tv({
  slots: {
    root: 'gap-3',
    legend: 'font-medium',
    options: 'flex-row flex-wrap items-start gap-4',
    option: 'items-center gap-2',
    /*
     * The ring lives on a box around the artwork rather than on the artwork
     * itself. React Native has no outline, so a border on the preview would
     * take a strip out of the drawing every time the option was chosen — the
     * miniature would change size as you picked it.
     */
    frame: 'overflow-hidden rounded-xl border-2 p-1',
    label: 'text-center',
  },
  variants: {
    selected: {
      true: { frame: 'border-primary', label: 'text-foreground' },
      false: { frame: 'border-transparent', label: 'text-muted-foreground' },
    },
    disabled: {
      true: { root: 'opacity-40' },
    },
  },
  defaultVariants: { selected: false },
});

interface ThemeSelectorContextValue {
  value: ThemeSelection;
  select: (value: ThemeSelection) => void;
  variant: ThemePreviewVariant;
  size: ThemeSelectorSize;
  disabled: boolean;
}

const ThemeSelectorContext = createContext<ThemeSelectorContextValue | null>(null);

function useThemeSelector(part: string): ThemeSelectorContextValue {
  const value = useContext(ThemeSelectorContext);
  if (!value) throw new Error(`${part} must be used inside a <ThemeSelector>.`);
  return value;
}

/**
 * Which of the three the app is on, read from the theme itself.
 *
 * `hasAdaptiveThemes` is the part that makes this possible: it is true exactly
 * while the theme is following the device, which is the one thing the theme's
 * own name cannot tell you — `system` resolves to `light` or `dark` the moment
 * it is applied, and the two are indistinguishable afterwards.
 */
export function useThemeSelection(): ThemeSelection {
  const { hasAdaptiveThemes } = useUniwind();
  const { mode } = useThemeMode();
  return hasAdaptiveThemes ? 'system' : mode;
}

export interface ThemeSelectorProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /**
   * Show this as chosen instead of whatever the app is actually on. For a
   * settings screen that stages a choice before applying it; left unset, the
   * selector reads the live theme.
   */
  value?: ThemeSelection;
  /** Fires with the option pressed, before the theme changes. */
  onValueChange?: (value: ThemeSelection) => void;
  /**
   * Apply the choice. On by default — a theme selector that does not select a
   * theme is a radio group. Turn it off to store the choice and apply it
   * yourself, which is what an app that persists the preference wants.
   */
  applyTheme?: boolean;
  /** The heading above the row. Left out, there is none. */
  label?: string;
  /**
   * Which miniature is drawn. `window` is an app screen with a panel on it;
   * `card` is a framed card with an accent, cut on the diagonal for system.
   */
  variant?: ThemePreviewVariant;
  /**
   * How wide the miniatures are drawn. `sm` for a settings row that has other
   * things on it; `md` when choosing the theme is what the screen is for.
   */
  size?: ThemeSelectorSize;
  /** Stop the row being pressed, and dim it to say so. */
  disabled?: boolean;
  /**
   * The options, in the order you want them. Left out, the selector draws
   * system, light and dark in that order — which is the whole component.
   */
  children?: ReactNode;
}

function ThemeSelectorRoot({
  className,
  value,
  onValueChange,
  applyTheme = true,
  label,
  variant = 'window',
  size = 'md',
  disabled = false,
  children,
  ...props
}: ThemeSelectorProps) {
  const slots = themeSelectorVariants({ disabled });
  const { setTheme } = useTheme();
  const { setMode } = useThemeMode();
  const live = useThemeSelection();
  const current = value ?? live;

  const select = useCallback(
    (next: ThemeSelection) => {
      onValueChange?.(next);
      if (!applyTheme) return;
      // `setMode` rather than `setTheme`, so a reader in a named family stays
      // in it. Following the device is the one choice that cannot: the device
      // has no opinion beyond light and dark.
      if (next === 'system') setTheme('system');
      else setMode(next);
    },
    [applyTheme, onValueChange, setTheme, setMode]
  );

  const context = useMemo<ThemeSelectorContextValue>(
    () => ({ value: current, select, variant, size, disabled }),
    [current, select, variant, size, disabled]
  );

  return (
    <ThemeSelectorContext.Provider value={context}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        {...props}
        className={slots.root({ className })}
      >
        {label ? (
          <Text size="sm" className={slots.legend()}>
            {label}
          </Text>
        ) : null}
        <View className={slots.options()}>
          {children
            ? textChildren(children)
            : OPTIONS.map((option) => (
                <ThemeSelectorOption key={option} value={option} />
              ))}
        </View>
      </View>
    </ThemeSelectorContext.Provider>
  );
}

export interface ThemeSelectorOptionProps
  extends Omit<PressableProps, 'children' | 'onPress'> {
  className?: string;
  /** Which of the three this option chooses. */
  value: ThemeSelection;
  /** What it is called under the miniature. Defaults to System, Light or Dark. */
  label?: string;
  /** Replaces the drawn miniature. */
  children?: ReactNode;
}

/**
 * One of the three.
 *
 * The whole thing is the target — the miniature and the word under it — because
 * at this size the word is the easier of the two to hit and pressing it should
 * not miss.
 */
function ThemeSelectorOption({
  className,
  value,
  label,
  children,
  ...props
}: ThemeSelectorOptionProps) {
  const context = useThemeSelector('ThemeSelector.Option');
  const selected = context.value === value;
  const slots = themeSelectorVariants({ selected, disabled: context.disabled });
  const name = label ?? LABELS[value];

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ selected, disabled: context.disabled }}
      disabled={context.disabled}
      {...props}
      onPress={() => context.select(value)}
      className={slots.option({ className })}
    >
      <View className={slots.frame()}>
        {children ?? (
          <ThemePreview
            mode={value}
            variant={context.variant}
            width={PREVIEW_WIDTH[context.size]}
          />
        )}
      </View>
      <Text size="sm" className={slots.label()}>
        {name}
      </Text>
    </Pressable>
  );
}

ThemeSelectorRoot.displayName = 'ThemeSelector';
ThemeSelectorOption.displayName = 'ThemeSelector.Option';

export const ThemeSelector = Object.assign(ThemeSelectorRoot, {
  Option: ThemeSelectorOption,
});
