import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/components/meter/meter-scale.ts', import.meta.url),
  'utf8'
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  clamp,
  colorFor,
  fractionOf,
  formatValue,
  litSegments,
  meterSemantics,
  normalizeScale,
  normalizeSegments,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('fractionOf reads a value against its own scale', () => {
  assert.equal(fractionOf(50, 0, 100), 0.5);
  assert.equal(fractionOf(168, 0, 256), 168 / 256);
  // A scale that does not start at zero measures from its own floor.
  assert.equal(fractionOf(60, 40, 80), 0.5);
  // Out of range reads as one end of the track, never past it.
  assert.equal(fractionOf(-20, 0, 100), 0);
  assert.equal(fractionOf(140, 0, 100), 1);
});

test('a scale with no span reads as empty rather than dividing by zero', () => {
  for (const [min, max] of [
    [10, 10],
    [80, 20],
  ]) {
    const fraction = fractionOf(15, min, max);
    assert.equal(fraction, 0);
    assert.ok(Number.isFinite(fraction));
  }
});

test('invalid public scales normalize to finite ordered accessibility values', () => {
  const cases = [
    [Number.NaN, 0, 100, { min: 0, max: 100, value: 0, fraction: 0 }],
    [Number.POSITIVE_INFINITY, 0, 100, { min: 0, max: 100, value: 100, fraction: 1 }],
    [Number.NEGATIVE_INFINITY, 0, 100, { min: 0, max: 100, value: 0, fraction: 0 }],
    [15, 10, 10, { min: 10, max: 10, value: 10, fraction: 0 }],
    [15, 80, 20, { min: 80, max: 80, value: 80, fraction: 0 }],
    [50, Number.NaN, 100, { min: 0, max: 100, value: 50, fraction: 0.5 }],
    [50, 0, Number.POSITIVE_INFINITY, { min: 0, max: 100, value: 50, fraction: 0.5 }],
    [
      0,
      -Number.MAX_VALUE,
      Number.MAX_VALUE,
      { min: -Number.MAX_VALUE, max: Number.MAX_VALUE, value: 0, fraction: 0.5 },
    ],
  ];
  for (const [value, min, max, expected] of cases) {
    const scale = normalizeScale(value, min, max);
    assert.deepEqual(scale, expected);
    assert.ok(Object.values(scale).every(Number.isFinite));
    assert.ok(scale.min <= scale.value && scale.value <= scale.max);
    assert.ok(scale.fraction >= 0 && scale.fraction <= 1);
  }
});

test('clamp holds a stray value inside the scale', () => {
  assert.equal(clamp(5, 0, 100), 5);
  assert.equal(clamp(-5, 0, 100), 0);
  assert.equal(clamp(105, 0, 100), 100);
  assert.equal(clamp(Number.NaN, 0, 100), 0);
});

test('the highest threshold the reading has reached wins', () => {
  const climbing = [
    { from: 70, color: 'warning' },
    { from: 90, color: 'destructive' },
  ];
  assert.equal(colorFor(10, 'success', climbing), 'success');
  assert.equal(colorFor(70, 'success', climbing), 'warning');
  assert.equal(colorFor(89, 'success', climbing), 'warning');
  assert.equal(colorFor(90, 'success', climbing), 'destructive');
  assert.equal(colorFor(100, 'success', climbing), 'destructive');
});

test('thresholds give the same answer whatever order they are listed in', () => {
  // Order-independence is the contract. A first-wins rule would make a
  // reordered array a silent behaviour change for the caller.
  const bands = [
    { from: 0, color: 'destructive' },
    { from: 20, color: 'warning' },
    { from: 50, color: 'success' },
  ];
  const shuffled = [bands[2], bands[0], bands[1]];
  for (const value of [0, 19, 20, 49, 50, 100]) {
    assert.equal(colorFor(value, 'primary', bands), colorFor(value, 'primary', shuffled));
  }
  assert.equal(colorFor(10, 'primary', bands), 'destructive');
  assert.equal(colorFor(60, 'primary', bands), 'success');
});

test('no thresholds, or none reached, leaves the base colour', () => {
  assert.equal(colorFor(50, 'info', undefined), 'info');
  assert.equal(colorFor(50, 'info', []), 'info');
  assert.equal(colorFor(5, 'info', [{ from: 80, color: 'destructive' }]), 'info');
});

test('non-finite thresholds cannot take over a finite reading', () => {
  const invalid = [
    { from: Number.NaN, color: 'warning' },
    { from: Number.POSITIVE_INFINITY, color: 'destructive' },
    { from: Number.NEGATIVE_INFINITY, color: 'info' },
  ];
  assert.equal(colorFor(50, 'success', invalid), 'success');
});

test('any reading above the floor lights a segment', () => {
  // Rounding down would leave the whole first block of a four-block meter
  // dark, so "a little" would look like "none".
  assert.equal(litSegments(0, 4), 0);
  assert.equal(litSegments(0.01, 4), 1);
  assert.equal(litSegments(0.25, 4), 1);
  assert.equal(litSegments(0.26, 4), 2);
  assert.equal(litSegments(0.75, 4), 3);
  assert.equal(litSegments(1, 4), 4);
});

test('the lit count never runs past the blocks that exist', () => {
  assert.equal(litSegments(1.5, 4), 4);
  assert.equal(litSegments(1, 10), 10);
  assert.equal(litSegments(0.5, 0), 0);
  assert.equal(litSegments(0.5, -3), 0);
  assert.equal(litSegments(Number.NaN, 4), 0);
  assert.equal(litSegments(Number.POSITIVE_INFINITY, 4), 4);
  assert.equal(litSegments(Number.NEGATIVE_INFINITY, 4), 0);
});

test('segment counts cannot create fractional, non-finite, or unbounded rows', () => {
  for (const [input, expected] of [
    [undefined, 0],
    [Number.NaN, 0],
    [Number.NEGATIVE_INFINITY, 0],
    [0.5, 0],
    [2.9, 2],
    [4, 4],
    [Number.POSITIVE_INFINITY, 0],
    [101, 100],
    [1_000_000, 100],
  ]) {
    assert.equal(normalizeSegments(input), expected);
  }
});

test('formatValue prefers an explicit label over any number', () => {
  assert.equal(formatValue(3, 0.75, 'Strong'), 'Strong');
  assert.equal(formatValue(3, 0.75, 'Strong', { style: 'percent' }), 'Strong');
  // An empty string is a caller saying "no caption", not an absent one.
  assert.equal(formatValue(3, 0.75, ''), '');
});

test('a percent style formats the fraction, and anything else the value', () => {
  assert.equal(formatValue(168, 0.65625, undefined, { style: 'percent' }), '66%');
  assert.equal(
    formatValue(168, 0.65625, undefined, {
      style: 'unit',
      unit: 'gigabyte',
      unitDisplay: 'short',
    }),
    '168 GB'
  );
});

test('formatValue falls back to a rounded percent', () => {
  assert.equal(formatValue(50, 0.5), '50%');
  assert.equal(formatValue(168, 168 / 256), '66%');
  // A partial Intl must not take the caption down with it.
  assert.equal(formatValue(50, 0.5, undefined, { style: 'nonsense' }), '50%');
});

test('meter semantics expose one named range with one formatted value', () => {
  assert.deepEqual(
    meterSemantics({
      value: 68,
      fraction: 0.68,
      minValue: 0,
      maxValue: 100,
      label: 'Storage',
    }),
    {
      label: 'Storage',
      text: '68%',
      value: { min: 0, max: 100, now: 68, text: '68%' },
    }
  );
});

test('meter spoken names and values follow their explicit overrides', () => {
  const units = meterSemantics({
    value: 168,
    fraction: 168 / 256,
    minValue: 0,
    maxValue: 256,
    label: 'Storage',
    accessibilityLabel: 'Project storage used',
    formatOptions: { style: 'unit', unit: 'gigabyte', unitDisplay: 'short' },
  });
  assert.equal(units.label, 'Project storage used');
  assert.equal(units.text, '168 GB');

  const custom = meterSemantics({
    value: 3,
    fraction: 0.75,
    minValue: 0,
    maxValue: 4,
    label: 'Password strength',
    valueLabel: 'Good',
  });
  assert.equal(custom.text, 'Good');
  assert.equal(custom.value.text, 'Good');
});

test('an absent name stays absent instead of inventing app context', () => {
  const unnamed = meterSemantics({
    value: 42,
    fraction: 0.42,
    minValue: 0,
    maxValue: 100,
  });
  assert.equal(unnamed.label, undefined);
});

test('a value update keeps the name and refreshes the semantic range', () => {
  const reading = (value) =>
    meterSemantics({
      value,
      fraction: value / 100,
      minValue: 0,
      maxValue: 100,
      label: 'Battery',
    });
  assert.equal(reading(20).label, reading(80).label);
  assert.deepEqual(reading(80).value, { min: 0, max: 100, now: 80, text: '80%' });
});

test('Meter feeds only normalized values into layout, animation, and accessibility', async () => {
  const component = await readFile(
    new URL('../src/components/meter/index.tsx', import.meta.url),
    'utf8'
  );
  assert.match(component, /const scale = normalizeScale\(value, minValue, maxValue\)/);
  assert.match(component, /const segmentCount = normalizeSegments\(segments\)/);
  assert.match(component, /minValue: scale\.min,\s*\n\s*maxValue: scale\.max,/);
  assert.match(component, /accessibilityValue: semantics\.value/);
  assert.match(component, /overshootClamping: true/);
  assert.match(component, /Number\.isFinite\(width\) && width > 0 \? width : 0/);
  assert.match(component, /accessibilityElementsHidden/);
  assert.match(component, /importantForAccessibility="no-hide-descendants"/);
  assert.match(component, /accessibilityRole: 'progressbar'/);
  assert.doesNotMatch(component, /accessibilityActions|accessibilityLiveRegion/);
});
