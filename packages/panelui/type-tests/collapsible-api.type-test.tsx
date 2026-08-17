import { Collapsible } from 'panelui-native/components/collapsible';

const trigger = (
  <Collapsible.Trigger
    accessibilityHint="Shows delivery options"
    onPress={(event) => event.currentTarget}
    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
  >
    Delivery options
  </Collapsible.Trigger>
);

void trigger;
