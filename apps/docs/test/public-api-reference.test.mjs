import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(docs, '../..');
const inventory = JSON.parse(
  fs.readFileSync(path.join(docs, 'lib/public-api.generated.json'), 'utf8')
);

test('the generated public API reference is current and internally complete', () => {
  const checked = spawnSync(
    process.execPath,
    [path.join(docs, 'scripts/build-api-reference.mjs'), '--check'],
    { encoding: 'utf8' }
  );
  assert.equal(checked.status, 0, `${checked.stdout}${checked.stderr}`);

  const modules = Object.values(inventory.groups).flat();
  const symbols = modules.flatMap((item) => item.symbols);
  assert.equal(modules.length, inventory.counts.modules);
  assert.equal(symbols.length, inventory.counts.exports);
  assert.equal(symbols.filter((item) => item.kind === 'value').length, inventory.counts.values);
  assert.equal(symbols.filter((item) => item.kind === 'type').length, inventory.counts.types);
  assert.equal(new Set(symbols.map((item) => item.name)).size, symbols.length);
});

test('component, hook and utility exports all have bounded browseable destinations', () => {
  for (const item of inventory.groups.components) {
    const slug = item.source.split('/')[1];
    const meta = JSON.parse(fs.readFileSync(path.join(docs, 'scripts/meta.json'), 'utf8'));
    const group = meta[slug][3]?.group ?? 'components';
    const page = fs.readFileSync(path.join(docs, `content/docs/${group}/${slug}.mdx`), 'utf8');
    const api = page.split('\n## Public exports\n')[1];
    for (const symbol of item.symbols) assert.match(api, new RegExp(`\\b${symbol.name}\\b`));
  }

  const hookIndex = fs.readFileSync(path.join(docs, 'content/docs/reference/hooks.mdx'), 'utf8');
  const registry = JSON.parse(fs.readFileSync(path.join(docs, 'public/r/index.json'), 'utf8'));
  for (const item of registry.filter((item) => item.type === 'registry:hook')) {
    assert.match(hookIndex, new RegExp(`/docs/hooks/${item.name}\\)`));
  }

  assert.deepEqual(inventory.groups.utilities.map((item) => item.slug), ['cn', 'color', 'time']);
  const rootMeta = JSON.parse(fs.readFileSync(path.join(docs, 'content/docs/meta.json'), 'utf8'));
  assert.ok(rootMeta.pages.includes('...reference'));
  assert.equal(fs.existsSync(path.join(root, 'packages/panelui/src/index.ts')), true);
});
