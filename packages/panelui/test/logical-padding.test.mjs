import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = (name) =>
  readFile(new URL(`../src/components/${name}/index.tsx`, import.meta.url), 'utf8');

test('measured decorators pad the field on the logical side', async () => {
  const [inputGroup, input] = await Promise.all([component('input-group'), component('input')]);

  // Both position their decorators with start-0/end-0, so Yoga moves them to
  // the other edge under Direction dir="rtl". Physical padding would stay
  // where it was written and leave the value running underneath them.
  assert.match(inputGroup, /paddingStart: group\.prefixWidth/);
  assert.match(inputGroup, /paddingEnd: group\.suffixWidth/);
  assert.doesNotMatch(inputGroup, /padding(?:Left|Right):/);

  assert.match(input, /paddingStart: startWidth/);
  assert.match(input, /paddingEnd: endWidth/);
  assert.doesNotMatch(input, /padding(?:Left|Right):/);
});
