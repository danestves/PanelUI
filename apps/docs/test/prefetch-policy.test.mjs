import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(docs, file), 'utf8');

test('persistent layout chrome does not prefetch its repeated destinations', () => {
  const layoutLink = read('components/layout-link.tsx');
  const rootLayout = read('app/layout.tsx');

  assert.match(
    layoutLink,
    /REPEATED_CHROME_ROUTES = new Set\(\['\/', '\/docs', '\/docs\/components'\]\)/
  );
  assert.match(layoutLink, /repeated \? false : null/);
  assert.match(rootLayout, /<RootProvider components=\{\{ Link: LayoutLink \}\}>/);
});

test('footer copies opt out while primary content navigation keeps prefetching', () => {
  const home = read('app/(home)/page.tsx');
  const showcase = read('components/showcase/index.tsx');

  assert.match(home, /href="\/docs" prefetch=\{false\} className="hover:text-foreground"/);
  assert.match(
    home,
    /href="\/docs\/components" prefetch=\{false\} className="hover:text-foreground"/
  );
  assert.match(home, /<Button render=\{<Link href="\/docs" \/>\}>/);
  assert.match(showcase, /render=\{<Link href="\/docs\/components" \/>\}/);
});
