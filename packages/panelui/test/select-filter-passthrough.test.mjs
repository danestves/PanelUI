import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/select/index.tsx', import.meta.url),
  'utf8'
);

const filter = source.slice(
  source.indexOf('function filterOptions('),
  source.indexOf('/** Trigger frame in window coordinates')
);

/*
 * A child that is not an option survives the filter.
 *
 * This is the whole of the reported bug: a `Select.Item` rendered by a list
 * component is not a child of Select, the list is — and the filter only ever
 * pushed items and groups, so typing one character dropped the list and every
 * row inside it. A caption or a divider went the same way.
 */
test('the filter keeps children it has no opinion about', () => {
  // The last statement of the walk, reached by anything the branches above
  // did not claim.
  assert.match(filter, /\n    kept\.push\(child\);\n  \}\);/);
  const branches = [...filter.matchAll(/kept\.push\(/g)];
  assert.ok(branches.length >= 3, 'expected pushes for groups, items and everything else');
});

test('the filter counts the options it saw', () => {
  assert.match(filter, /let seen = 0;/);
  assert.match(filter, /seen \+= inner\.seen;/, 'a group reports its own items upward');
  assert.match(filter, /seen \+= 1;/, 'an item counts itself');
  assert.match(filter, /return \{ kept, seen \};/);
});

/*
 * "No matches" is a claim about options Select was shown. When a caller
 * renders their own rows there are none, so the message would be Select
 * answering a question nobody asked it — over the top of a list that may be
 * perfectly full.
 */
test('the empty message needs options to have been seen', () => {
  assert.match(
    source,
    /const noMatches =\s*filtered !== null && filtered\.seen > 0 && filtered\.kept\.length === 0;/
  );
});

test('the trigger label can be supplied when it cannot be read', () => {
  assert.match(source, /valueLabel\?: string;/);
  assert.match(source, /valueLabel \?\? options\.find\(\(option\) => option\.value === value\)\?\.label/);
});

test('the filter query is reachable from inside the list', () => {
  assert.match(source, /export function useSelectSearch\(\)/);
  assert.match(source, /query: string;\s*setQuery: \(query: string\) => void;/);
  // Both presentations re-provide the context, so the hook has to work from a
  // portaled subtree as well as from an inline one.
  assert.ok(
    (source.match(/<SelectContext\.Provider value=\{context\}>/g) ?? []).length >= 2,
    'the context must be re-provided wherever the list is portaled'
  );
});

test('the hook is exported from the package', async () => {
  const barrel = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(barrel, /\n  useSelectSearch,\n/);
});
