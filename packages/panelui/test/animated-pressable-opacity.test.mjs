import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/primitives/animated-pressable.tsx', import.meta.url),
  'utf8'
);

// The animated style is applied after the class styles, so an `opacity` it
// writes at rest overrides every disabled dim set through `className`.
test('the press style writes opacity only when the press fades', () => {
  assert.match(source, /const fades = pressOpacity !== 1;/);
  assert.match(
    source,
    /return fades\s*\?\s*\{ transform, opacity: restingOpacity \* \(1 \+ pressed\.value \* \(pressOpacity - 1\)\) \}\s*:\s*\{ transform \};/
  );
});

test('a fading press starts from the resting opacity of the style or class', () => {
  assert.match(source, /useResolveClassNames\(fades \? \(className \?\? ''\) : ''\)/);
  assert.match(source, /StyleSheet\.flatten\(style\)/);
});
