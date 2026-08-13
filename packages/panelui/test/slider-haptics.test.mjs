import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/components/slider/index.tsx', import.meta.url),
  'utf8'
);

const recordStepSource = source.match(/function recordStep[\s\S]*?\n\}/)?.[0];
assert.ok(recordStepSource, 'recordStep helper is present');
const compiled = ts.transpileModule(`${recordStepSource}\nexport { recordStep };`, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { recordStep } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

const clampSource = source.match(/function clampJS[\s\S]*?\n\}/)?.[0];
const snapSource = source.match(/function snap[\s\S]*?\n\}/)?.[0];
assert.ok(clampSource && snapSource, 'slider value math is present');
const math = ts.transpileModule(`${clampSource}\n${snapSource}\nexport { snap };`, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { snap } = await import(
  `data:text/javascript;base64,${Buffer.from(math).toString('base64')}`
);

test('range haptics track the step owned by each thumb', () => {
  const last = { low: 20, high: 80 };
  assert.equal(recordStep(last, 'high', 90), true);
  assert.deepEqual(last, { low: 20, high: 90 });
  assert.equal(recordStep(last, 'high', 90), false);
  assert.equal(recordStep(last, 'low', 30), true);
  assert.deepEqual(last, { low: 30, high: 90 });
  assert.equal(recordStep(last, 'high', 80), true);

  assert.match(
    source,
    /useRef<Record<Thumb, number>>\(\{\s+low,\s+high: isRange \? high : value,?\s+\}\)/
  );
  assert.match(source, /recordStep\(lastTick\.current, thumb, nextStep\)/);
});

test('gesture updates identify the thumb whose step changed', () => {
  assert.match(
    source,
    /commitRangeFromProgress\)\(next, highProgress\.value, false, 'low'\)/
  );
  assert.match(
    source,
    /commitRangeFromProgress\)\(lowProgress\.value, next, false, 'high'\)/
  );
  assert.match(source, /true,\s+activeThumb\.value\s+\)/);
});

test('range gestures retain crossing bounds and step normalization', () => {
  assert.equal(snap(34, 0, 100, 10), 30);
  assert.equal(snap(-4, 0, 100, 10), 0);
  assert.equal(snap(106, 0, 100, 10), 100);

  assert.match(
    source,
    /const ceiling = Math\.max\(highProgress\.value - gap, 0\);\s+const next = Math\.min\(Math\.max\(dragStartLow\.value \+ delta, 0\), ceiling\);/
  );
  assert.match(
    source,
    /const floor = Math\.min\(lowProgress\.value \+ gap, 1\);\s+const next = Math\.min\(Math\.max\(dragStartHigh\.value \+ delta, floor\), 1\);/
  );
});

test('accessibility changes update the same per-thumb history', () => {
  assert.match(source, /recordStep\(lastTick\.current, 'high', next\);/);
  assert.match(source, /recordStep\(lastTick\.current, thumb, next\);/);
});
