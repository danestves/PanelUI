/**
 * The components index draws a wireframe per component, and a component with
 * no wireframe leaves a hole in the grid.
 *
 * Nothing else catches it. The page still builds, the card still links, and
 * the gap only shows to somebody looking at that row of the gallery — which,
 * for a component added late in a release, is nobody until it has shipped.
 *
 * The thumbnails are TSX, so they are read as text rather than imported: JSX
 * is not something the test runner's type stripping can execute. That is
 * enough for the only question being asked, which is whether the key is there.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const meta = JSON.parse(fs.readFileSync(path.join(root, 'apps/docs/scripts/meta.json'), 'utf8'));
const source = fs.readFileSync(
  path.join(root, 'apps/docs/components/component-thumbnails.tsx'),
  'utf8'
);

/** The keys of the `THUMBNAILS` map, however each one is written. */
function thumbnailSlugs() {
  const block = source.match(
    /const THUMBNAILS: Record<string, ReactNode> = \{([\s\S]*?)\n\};/
  );
  assert.ok(block, 'the THUMBNAILS map could not be found — has it been renamed?');

  const slugs = [];
  for (const line of block[1].split('\n')) {
    // `'kebab-case': value,` · `name: value,` · `name,`
    const quoted = line.match(/^\s*'([^']+)':/);
    if (quoted) {
      slugs.push(quoted[1]);
      continue;
    }
    const bare = line.match(/^\s*([A-Za-z][A-Za-z0-9]*)\s*[,:]/);
    if (bare) slugs.push(bare[1]);
  }
  return slugs;
}

test('every component in the docs navigation has a gallery thumbnail', () => {
  const drawn = new Set(thumbnailSlugs());
  const missing = Object.keys(meta).filter((slug) => !drawn.has(slug));
  assert.deepEqual(
    missing,
    [],
    `add a wireframe for these in apps/docs/components/component-thumbnails.tsx: ${missing.join(', ')}`
  );
});

test('no gallery thumbnail is drawn for a component that no longer exists', () => {
  const slugs = thumbnailSlugs();
  const stale = slugs.filter((slug) => !(slug in meta));
  assert.deepEqual(stale, [], `remove these stale wireframes: ${stale.join(', ')}`);
});

test('gallery thumbnail keys are unique', () => {
  const slugs = thumbnailSlugs();
  const duplicates = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
  assert.deepEqual(duplicates, [], `duplicated wireframe keys: ${duplicates.join(', ')}`);
});
