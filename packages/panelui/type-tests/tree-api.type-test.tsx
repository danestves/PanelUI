import { Tree } from 'panelui-native/components/tree';

const trigger = (
  <Tree.Trigger
    disabled={false}
    onPress={(event) => event.currentTarget}
    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
  >
    <Tree.Label>src</Tree.Label>
  </Tree.Trigger>
);

void trigger;
