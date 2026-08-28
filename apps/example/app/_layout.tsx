import '../global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
/*
 * Through the subpaths, not the root.
 *
 * `panelui-native`'s root entry re-exports all 119 components, and Metro does
 * not tree-shake — so importing the provider from it evaluates every chart's
 * SVG graph, the map, the signature pad and the rest before the first frame.
 * The screens under this layout load their demos in chunks; the layout itself
 * has no reason to bring the library with it.
 */
import { PanelUIProvider } from 'panelui-native/provider';
import { useThemeMode } from 'panelui-native/theme';

/**
 * React Navigation paints its own theme background over every screen
 * (NativeStackView sets `contentStyle.backgroundColor` and
 * `nativeContainerStyle` from `colors.background`), and it defaults to an
 * opaque light grey. That sits on top of PanelUIProvider's `bg-background`,
 * so without this the page never follows the theme.
 *
 * Building the navigation theme from the live PanelUI tokens fixes it for all
 * six themes — `useCSSVariable` subscribes to Uniwind's theme changes, so this
 * re-runs on every switch, including the named themes that `Appearance`
 * knows nothing about.
 */
function ThemedNavigation() {
  const { mode } = useThemeMode();
  const [background, card, text, border, primary] = useCSSVariable([
    '--color-background',
    '--color-card',
    '--color-foreground',
    '--color-border',
    '--color-primary',
  ]) as (string | undefined)[];

  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      ...(background ? { background } : null),
      ...(card ? { card } : null),
      ...(text ? { text } : null),
      ...(border ? { border } : null),
      ...(primary ? { primary, notification: primary } : null),
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      {/* Headers are drawn by ScreenHeader so they can carry the theme
          toggle and match the design; the native header stays off. */}
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      {/* Not style="auto": that reads Appearance, which Uniwind leaves
          "unspecified" for the named themes. */}
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PanelUIProvider>
        <ThemedNavigation />
      </PanelUIProvider>
    </SafeAreaProvider>
  );
}
