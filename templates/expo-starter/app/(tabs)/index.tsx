import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Item, Switch, Text } from 'panelui-native';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [notify, setNotify] = useState(true);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 32,
        paddingHorizontal: 16,
        gap: 20,
      }}
    >
      <View className="gap-1">
        <Text size="3xl" weight="bold">
          Home
        </Text>
        <Text muted>
          Nothing on this screen names a colour or a corner radius — every one
          of them comes from the theme, which the Settings tab can change.
        </Text>
      </View>

      <Card>
        <Card.Header>
          <Card.Title>Getting started</Card.Title>
          <Card.Description>Three screens, and somewhere to put yours.</Card.Description>
        </Card.Header>
        <Card.Content className="gap-3 p-4 pt-0">
          <Button>Primary action</Button>
          <Button variant="outline">Secondary</Button>
        </Card.Content>
      </Card>

      <Card>
        <Item>
          <Item.Content>
            <Item.Title>Notifications</Item.Title>
            <Item.Description>An example of a settings row</Item.Description>
          </Item.Content>
          <Item.Actions>
            <Switch value={notify} onValueChange={setNotify} />
          </Item.Actions>
        </Item>
      </Card>

      <Text size="sm" muted>
        Add anything else with{' '}
        <Text size="sm" className="font-mono">
          npx panelui-cli@latest add &lt;name&gt;
        </Text>
      </Text>
    </ScrollView>
  );
}
