import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Checkbox, Chip, Input, Text } from 'panelui-native';

/** A labelled block, so each group reads as one thing rather than a run of rows. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text size="sm" weight="medium" muted className="uppercase tracking-wider">
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function ComponentsScreen() {
  const insets = useSafeAreaInsets();
  const [agreed, setAgreed] = useState(false);
  const [filter, setFilter] = useState('All');

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 32,
        paddingHorizontal: 16,
        gap: 24,
      }}
    >
      <View className="gap-1">
        <Text size="3xl" weight="bold">
          Components
        </Text>
        <Text muted>A few to start from. There are eighty more.</Text>
      </View>

      <Section title="Buttons">
        <View className="gap-2">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </View>
      </Section>

      <Section title="Form">
        <Card>
          <Card.Content className="gap-4 p-4">
            <Input label="Name" placeholder="Ada Lovelace" />
            <Input
              label="Email"
              placeholder="ada@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {/* A Checkbox carries its own label, because a tick and its text
                are one target — tapping the words has to toggle it. */}
            <Checkbox
              checked={agreed}
              onCheckedChange={setAgreed}
              label="I agree to the terms"
            />
          </Card.Content>
        </Card>
      </Section>

      <Section title="Chips and badges">
        <View className="flex-row flex-wrap gap-2">
          {['All', 'Open', 'Closed'].map((label) => (
            <Chip key={label} selected={filter === label} onPress={() => setFilter(label)}>
              {label}
            </Chip>
          ))}
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Shipped</Badge>
        </View>
      </Section>
    </ScrollView>
  );
}
