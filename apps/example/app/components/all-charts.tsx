import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRightIcon, Text, useThemeMode } from 'panelui-native';
import { ScreenHeader } from '../../src/components/screen-header';
import { CHART_SHOWCASE, type ComponentEntry } from '../../src/data/components';

/**
 * One example of every chart, on one screen.
 *
 * The list screen next door answers "what is there"; this answers "which one do
 * I want", which is a question no list of names can. Picking a chart is a
 * decision about shape — whether the thing being shown is a series, a split, a
 * comparison or a relationship — and the only way to make it quickly is to see
 * the shapes side by side.
 *
 * Each entry is the chart's *first version*, rendered exactly as its own screen
 * renders it: the same card, the same data, the same proportions, drawn by the
 * real component in the active theme. Nothing here draws a smaller version of
 * its own, because a second design is a second thing to keep in step and the
 * day the two stop matching is the day this screen starts lying about what you
 * get.
 *
 * A static route, which Expo Router resolves ahead of the `[slug]` directory
 * beside it — `/components/all-charts` reaches this rather than looking for a
 * component slugged "all-charts".
 */
function ChartCard({ entry, tint }: { entry: ComponentEntry; tint: string }) {
  const version = entry.demos[0];
  if (!version) return null;

  return (
    <View className="gap-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.name}. ${entry.summary}. Opens the component.`}
        onPress={() => router.push(`/components/${entry.slug}`)}
        className="flex-row items-center gap-2 px-5 active:opacity-60"
      >
        <Text size="sm" weight="semibold" className="flex-1">
          {entry.name}
        </Text>
        <Text size="xs" muted>
          {version.label}
        </Text>
        <ChevronRightIcon size={14} color={tint} />
      </Pressable>

      {/*
       * A minimum rather than a fixed height. The versions lay themselves out
       * to fill a screen, and a chart that is squarer than the rest — a pie, a
       * radar — is taller than any single number would allow for. This leaves
       * each one the room it asks for and stops the shorter ones collapsing.
       */}
      <View style={{ minHeight: 300 }}>{version.render()}</View>
    </View>
  );
}

export default function AllChartsScreen() {
  const insets = useSafeAreaInsets();
  const { mode } = useThemeMode();
  const tint = mode === 'dark' ? '#818181' : '#686868';

  return (
    <View className="flex-1">
      <ScreenHeader title="All charts" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, gap: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <Text size="sm" muted className="px-5 pb-2">
          {`${CHART_SHOWCASE.length} charts, one example each. Tap a name for its versions and props.`}
        </Text>
        {CHART_SHOWCASE.map((entry) => (
          <ChartCard key={entry.slug} entry={entry} tint={tint} />
        ))}
      </ScrollView>
    </View>
  );
}
