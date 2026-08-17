import { Accordion } from 'panelui-native/components/accordion';

const trigger = (
  <Accordion.Trigger
    disabled={false}
    onPress={(event) => event.currentTarget}
    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
  >
    Account
  </Accordion.Trigger>
);

void trigger;
