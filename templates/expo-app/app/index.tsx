import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, useThemeMode } from 'panelui-native';

/**
 * The landing screen — the one you delete first.
 *
 * It says three things and stops: what this is, that it is running, and the
 * one command that adds the next thing.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { mode, toggleMode } = useThemeMode();

  return (
    <View
      className="flex-1 items-center justify-center gap-8 bg-background px-8"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Two files rather than one tinted image: the mark carries a glow, and
          a glow does not survive being recoloured. */}
      <Image
        source={
          mode === 'dark'
            ? require('../assets/logo-dark.png')
            : require('../assets/logo-light.png')
        }
        style={{ width: 132, height: 132 }}
        resizeMode="contain"
        accessibilityLabel="PanelUI"
      />

      <View className="items-center gap-2">
        <Text size="3xl" weight="bold">
          PanelUI
        </Text>
        <Text muted className="text-center">
          Edit{' '}
          <Text muted className="font-mono">
            app/index.tsx
          </Text>{' '}
          and save to reload.
        </Text>
      </View>

      <View className="w-full max-w-xs items-center gap-3">
        {/* Nothing here names a colour — the button and the page both follow
            the theme this switches. */}
        <Button variant="outline" className="w-full" onPress={toggleMode}>
          Switch to {mode === 'dark' ? 'light' : 'dark'}
        </Button>
        <View className="rounded-xl border border-border bg-surface px-4 py-2.5">
          <Text size="sm" className="font-mono">
            npx panelui-cli@latest add dialog
          </Text>
        </View>
      </View>
    </View>
  );
}
