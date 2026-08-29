import { Fragment, type ComponentType, type ReactNode } from 'react';
import { Platform, StyleSheet, TurboModuleRegistry, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  PortalHost,
  PortalProvider,
  useModalIsolationActive,
} from '../primitives/portal';
import { ToastViewport } from '../components/toast';
import { cn } from '../utils/cn';

/**
 * `react-native-keyboard-controller` needs its provider at the root, and
 * forgetting it is a silent failure — the hooks return zeroes and keyboard
 * avoidance simply does nothing. Mount it here when the package is installed
 * so `avoidKeyboard` works without any extra setup, and fall back to a
 * pass-through when it is not.
 *
 * Installed is not the same question as usable, and the difference is what a
 * `try`/`catch` around the `require` cannot see. In a client that loads no
 * native modules of its own — Expo Go — the JavaScript is in `node_modules`
 * and resolves, so the require succeeds and hands back a provider whose native
 * side is absent. The throw then lands when that provider mounts, outside the
 * `try`, and takes the app down before anything has painted.
 *
 * `TurboModuleRegistry.get` answers the real question and returns null rather
 * than throwing, so the pass-through is reached instead.
 */
const KeyboardProvider: ComponentType<{ children?: ReactNode }> = (() => {
  try {
    if (TurboModuleRegistry.get('KeyboardController') === null) return Fragment;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const controller = require('react-native-keyboard-controller');
    return controller?.KeyboardProvider ?? Fragment;
  } catch {
    return Fragment;
  }
})();

export interface PanelUIProviderProps {
  children: ReactNode;
  /**
   * Classes for the themed page surface. Defaults to `bg-background`, which
   * follows the active theme. Pass your own to change the page colour.
   */
  className?: string;
  /**
   * Set to false to render without the themed page background — do this only
   * if you paint the app background yourself.
   */
  background?: boolean;
}

/**
 * Root provider for PanelUI. Owns three things:
 * the gesture handler root, the themed page background, and the portal host
 * used by overlay components (Dialog, BottomSheet, Select).
 *
 * The background lives here because native wrappers like SafeAreaView do not
 * accept `className` — putting `bg-background` on one silently does nothing,
 * leaving the page unthemed while its children follow the theme.
 *
 * Theme switching is handled natively by Uniwind — use the `useTheme()` hook
 * exported from panelui-native.
 */
export function PanelUIProvider({
  children,
  className,
  background = true,
}: PanelUIProviderProps) {
  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Outermost of ours, so every field below it can avoid the keyboard.
          A no-op Fragment when the controller is not installed. */}
      <KeyboardProvider>
        <PortalProvider>
          <ProviderSurface
            background={background}
            className={className}
          >
            {children}
          </ProviderSurface>
        </PortalProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function ProviderSurface({
  children,
  className,
  background,
}: Required<Pick<PanelUIProviderProps, 'children' | 'background'>> &
  Pick<PanelUIProviderProps, 'className'>) {
  const modalActive = useModalIsolationActive();
  const isolateApp = Platform.OS === 'android' && modalActive;

  return (
    <View className={cn('flex-1', background && 'bg-background', className)}>
      {/* This wrapper is the app accessibility boundary. PortalHost stays its
          sibling, so hiding the background can never hide the active modal. */}
      <View
        collapsable={false}
        style={styles.content}
        importantForAccessibility={isolateApp ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {/* Sits before PortalHost so it can portal into it. */}
      <ToastViewport />
      <PortalHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});
