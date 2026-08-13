import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = (name) =>
  readFile(new URL(`../src/components/${name}/index.tsx`, import.meta.url), 'utf8');

test('compact core controls keep 48dp interaction boxes', async () => {
  const [button, checkbox, radio, toggle, carousel] = await Promise.all(
    ['button', 'checkbox', 'radio-group', 'switch', 'carousel'].map(component)
  );

  assert.match(button, /const BUTTON_HIT_SLOP = \{ sm: 6, md: 2, lg: 0, icon: 2 \}/);
  assert.match(button, /hitSlop=\{attached \? undefined : BUTTON_HIT_SLOP/);
  assert.match(button, /sm: \{ root: 'h-9 min-w-9 /);
  assert.match(button, /md: \{ root: 'h-11 min-w-11 /);
  assert.match(checkbox, /row: 'min-h-12 min-w-12 /);
  assert.match(radio, /row: 'min-h-12 min-w-12 /);
  assert.match(toggle, /className="h-12 w-12 items-center justify-center"/);
  assert.match(carousel, /interactive && 'h-12 w-12'/);
  assert.match(carousel, /'h-12 w-12 items-center justify-center rounded-full'/);
});
