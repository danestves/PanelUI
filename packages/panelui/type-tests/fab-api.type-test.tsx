import { Fab } from 'panelui-native/components/fab';

const fab = (
  <Fab
    accessibilityLabel="Create"
    hitSlop={8}
    onLongPress={(event) => event.currentTarget}
    onPress={(event) => event.currentTarget}
    pressOpacity={0.8}
  />
);

void fab;
