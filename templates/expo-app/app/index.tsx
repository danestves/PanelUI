import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Text, useThemeMode } from 'panelui-native';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { mode, toggleMode } = useThemeMode();
  const [count, setCount] = useState(0);

  return (
    <View
      className="flex-1 justify-center gap-6 bg-background px-6"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="gap-2">
        <Text size="3xl" weight="bold">
          Hello
        </Text>
        <Text muted>
          Every colour and corner on this screen comes from a theme token, so
          the toggle below restyles it without a single value changing here.
        </Text>
      </View>

      <Card>
        <Card.Content className="gap-4 p-4">
          <Text size="sm" muted>
            Pressed {count} {count === 1 ? 'time' : 'times'}
          </Text>
          <Button onPress={() => setCount((current) => current + 1)}>Press me</Button>
          <Button variant="outline" onPress={toggleMode}>
            Switch to {mode === 'dark' ? 'light' : 'dark'}
          </Button>
        </Card.Content>
      </Card>

      <Text size="sm" muted>
        Add more with{' '}
        <Text size="sm" className="font-mono">
          npx panelui-cli@latest add &lt;name&gt;
        </Text>
      </Text>
    </View>
  );
}
