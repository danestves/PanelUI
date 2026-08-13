import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  layoutLinkPrefetch,
  REPEATED_LAYOUT_ROUTES,
} from '../components/layout-link-policy.ts';

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(docs, file), 'utf8');

test('layout prefetch policy covers every repeated route and preserves overrides', () => {
  assert.deepEqual([...REPEATED_LAYOUT_ROUTES], ['/', '/docs', '/docs/components']);

  for (const href of REPEATED_LAYOUT_ROUTES) {
    assert.equal(layoutLinkPrefetch(href), false, href);
    assert.equal(layoutLinkPrefetch(href, true), true, `${href} explicit true`);
  }

  assert.equal(layoutLinkPrefetch('/docs/installation'), null);
  assert.equal(layoutLinkPrefetch('https://github.com/panel-ui/PanelUI'), null);
  assert.equal(layoutLinkPrefetch('/docs/installation', false), false);
});

test('every repeated layout instance uses the shared policy', () => {
  const instances = [
    ['brand title', 'app/layout.config.tsx', "url: '/'"],
    ['Docs navigation', 'app/layout.config.tsx', "text: 'Docs', url: '/docs'"],
    ['Components navigation', 'app/layout.config.tsx', "url: '/docs/components'"],
    [
      'Get started navigation',
      'app/layout.config.tsx',
      "text: 'Get started',\n      url: '/docs'",
    ],
    ['Docs footer', 'app/(home)/page.tsx', '<LayoutLink href="/docs"'],
    ['Components footer', 'app/(home)/page.tsx', '<LayoutLink href="/docs/components"'],
  ];

  for (const [name, file, source] of instances) {
    assert.ok(read(file).includes(source), `${name} must remain covered`);
  }

  assert.match(read('app/layout.tsx'), /components=\{\{ Link: LayoutLink \}\}/);
});

test('primary content links keep Next prefetch and link behavior passes through', () => {
  const home = read('app/(home)/page.tsx');
  const showcase = read('components/showcase/index.tsx');
  const layoutLink = read('components/layout-link.tsx');

  assert.match(home, /<Button render=\{<Link href="\/docs" \/>\}>/);
  assert.match(showcase, /render=\{<Link href="\/docs\/components" \/>\}/);
  assert.match(home, /<Link href=\{site\.repo\}/);
  assert.match(layoutLink, /prefetch=\{layoutLinkPrefetch\(href, prefetch\)\} \{\.\.\.props\}/);
});
