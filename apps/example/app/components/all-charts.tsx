import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRightIcon, Frame, Text } from 'panelui-native';
import { ScreenHeader } from '../../src/components/screen-header';
import { CHART_SHOWCASE, type ChartShowcaseEntry } from '../../src/data/components';

/**
 * One example of every chart, on one screen.
 *
 * The list screen next door answers "what is there"; this answers "which one do
 * I want", which is a question no list of names can. Picking a chart is a
 * decision about shape — whether the thing being shown is a series, a split, a
 * comparison or a relationship — and the only way to make it quickly is to see
 * the shapes side by side.
 *
 * Each card is the chart itself rather than a picture of it, so what is on
 * screen is the real component in the active theme, and it opens that chart's
 * own page for the versions and the props.
 *
 * A static route, which Expo Router resolves ahead of the `[slug]` directory
 * beside it — `/components/all-charts` reaches this rather than looking for a
 * component slugged "all-charts".
 */
function ChartCard({ entry }: { entry: ChartShowcaseEntry }) {
  return (
    // The press goes on a wrapper rather than on the frame: a Frame is a tray,
    // not a control, and the charts inside this one have presses of their own
    // that would otherwise be swallowed on the way up.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.name}. ${entry.summary}.`}
      onPress={() => router.push(`/components/${entry.slug}`)}
    >
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>{entry.name}</Frame.Title>
          <Frame.Action>
            <ChevronRightIcon size={16} />
          </Frame.Action>
        </Frame.Header>
        <Frame.Panel>{entry.render()}</Frame.Panel>
        <Text size="xs" muted className="px-4 pb-3 pt-2">
          {entry.summary}
        </Text>
      </Frame>
    </Pressable>
  );
}

export default function AllChartsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1">
      <ScreenHeader title="All charts" showBack />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text size="sm" muted className="pb-1">
          {`${CHART_SHOWCASE.length} charts, one example each. Tap one for its versions and props.`}
        </Text>
        {CHART_SHOWCASE.map((entry) => (
          <ChartCard key={entry.slug} entry={entry} />
        ))}
      </ScrollView>
    </View>
  );
}
