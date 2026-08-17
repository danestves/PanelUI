import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/pagination/index.tsx', import.meta.url), 'utf8');

function assertContracts(content) {
  assert.match(content, /onPress\?\.\(event\);\s*goTo\(page\)/);
  assert.match(content, /const isDisabled = Boolean\(spent \|\| disabled\)/);
  assert.match(content, /onPress\?\.\(event\);\s*press\(\)/);
  assert.match(content, /const isDisabled = Boolean\(disabled \|\| disabledProp\)/);
  assert.match(content, /onPress\?\.\(event\);\s*goTo\(page \+ direction \* jump\)/);
  assert.doesNotMatch(content, /onPress=\{press\}[\s\S]{0,250}\{\.\.\.props\}/);
}

test('Pagination controls compose callbacks and disabled ownership', () => assertContracts(source));

test('the copied Pagination source retains all control contracts', async () => {
  const item = JSON.parse(await readFile(new URL('../../../apps/docs/public/r/pagination.json', import.meta.url), 'utf8'));
  assertContracts(item.files.find((file) => file.path === 'ui/pagination.tsx').content);
});
