import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/*
 * Component, and how many `useId`-derived SVG definition ids it should have.
 *
 * The count is exact on purpose: a new `<Defs>` id added with a fixed string
 * makes two of the same chart on one screen share it, and the second to mount
 * wins — a bug that only shows up on a screen nobody built while writing the
 * component.
 *
 * `heatmap-chart` and `plot` are down to zero because their reveal clips are
 * gone: the clip is a view now, and a view needs no id. See
 * chart-reveal-clip.test.mjs.
 */
const components = [
  ['flow', 1],
  ['hex-chart', 1],
  ['heatmap-chart', 0],
  ['line-chart', 2],
  ['plot', 0],
  ['area-chart', 1],
  ['treemap-chart', 1],
  ['waterfall-chart', 1],
];
const root = new URL('../../../', import.meta.url);

function sourceFor(name) {
  return readFileSync(
    new URL(`packages/panelui/src/components/${name}/index.tsx`, root),
    'utf8'
  );
}

function registrySourceFor(name) {
  const registry = JSON.parse(
    readFileSync(new URL(`apps/docs/public/r/${name}.json`, root), 'utf8')
  );
  const component = registry.files.find((file) => file.path.endsWith(`${name}.tsx`));
  assert.ok(component, `${name} registry source is missing`);
  return component.content;
}

function assertStableIds(source, name, expectedIds) {
  assert.doesNotMatch(source, /Math\.random\s*\(/, `${name} still creates random IDs`);
  const ids = source.match(/useId\(\)\.replace\(\/\[\^a-zA-Z0-9\]\/g, ''\)/g) ?? [];
  assert.equal(ids.length, expectedIds, `${name} stable SVG ID count`);
}

test('SVG definition IDs use hydration-stable React instance IDs', () => {
  for (const [name, expectedIds] of components) {
    assertStableIds(sourceFor(name), name, expectedIds);
  }
});

test('copied registry components preserve stable SVG IDs', () => {
  for (const [name, expectedIds] of components) {
    assertStableIds(registrySourceFor(name), `${name} registry`, expectedIds);
  }
});
