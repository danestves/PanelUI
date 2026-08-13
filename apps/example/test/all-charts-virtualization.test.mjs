import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const screen = await readFile(
  new URL('../app/components/all-charts.tsx', import.meta.url),
  'utf8'
);
const catalogue = await readFile(
  new URL('../src/data/components.tsx', import.meta.url),
  'utf8'
);

test('the chart gallery delegates rows to a bounded virtualized list', () => {
  assert.match(screen, /<FlatList/);
  assert.match(screen, /<FlatList\s+className="flex-1"/);
  assert.match(screen, /data=\{CHART_SHOWCASE\}/);
  assert.match(screen, /renderItem=\{renderChart\}/);
  assert.match(screen, /initialNumToRender=\{2\}/);
  assert.match(screen, /maxToRenderPerBatch=\{2\}/);
  assert.match(screen, /windowSize=\{3\}/);
  // Detaching offscreen views blanks animated SVG on iOS, and every row here is
  // a chart. The window bounds the work without it.
  assert.doesNotMatch(screen, /^\s*removeClippedSubviews\b/m);
  assert.doesNotMatch(screen, /CHART_SHOWCASE\.map/);
  assert.doesNotMatch(screen, /<ScrollView/);
});

test('renderItem mounts the existing first demo with stable slug keys', () => {
  assert.match(
    screen,
    /\(\{ item, index \}: ListRenderItemInfo<ComponentEntry>\) => \(\s*<ChartCard entry=\{item\} tint=\{tint\} first=\{index === 0\} \/>/
  );
  assert.match(screen, /const chartKey = \(entry: ComponentEntry\) => entry\.slug;/);
  assert.match(screen, /keyExtractor=\{chartKey\}/);
  assert.match(screen, /const version = entry\.demos\[0\];/);
  assert.match(screen, /<View style=\{\{ minHeight: 300 \}\}>\{version\.render\(\)\}<\/View>/);
});

test('every declared chart remains sourced from the catalogue', () => {
  const declaration = catalogue.match(/export const CHART_SLUGS = \[([\s\S]*?)\] as const;/);
  assert.ok(declaration, 'CHART_SLUGS declaration is present');
  const slugs = [...declaration[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);

  assert.equal(slugs.length, 14);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const slug of slugs) {
    assert.match(catalogue, new RegExp(`slug: '${slug.replaceAll('-', '\\-')}'`));
  }
  assert.match(
    catalogue,
    /CHART_SLUGS\.map\(\s*\(slug\) => COMPONENTS_BY_SLUG\[slug\]\s*\)\.filter/
  );
});
