import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  liveLineClockRuns,
  normalizeLiveLineMaxPoints,
  normalizeLiveLinePoints,
  normalizeLiveLineWindow,
  reconcileLiveLineActivePoint,
} from '../src/components/live-line-chart/live-line-lifecycle.ts';

test('the bounded buffer orders, repairs, filters, and trims controlled data', () => {
  const corrected = { time: 20, value: 22 };
  const input = [
    { time: 30, value: 30 },
    { time: 20, value: 20 },
    { time: Number.NaN, value: 10 },
    { time: 10, value: Number.POSITIVE_INFINITY },
    corrected,
    { time: 40, value: 40 },
  ];
  assert.deepEqual(normalizeLiveLinePoints(input, 500), [corrected, input[0], input[5]]);
  assert.deepEqual(normalizeLiveLinePoints(input, 2), [input[0], input[5]]);
  assert.deepEqual(input.map((point) => point.time), [30, 20, NaN, 10, 20, 40]);
});

test('invalid window and buffer options stay finite and bounded', () => {
  assert.equal(normalizeLiveLineWindow(0), 30);
  assert.equal(normalizeLiveLineWindow(Number.NaN), 30);
  assert.equal(normalizeLiveLineWindow(0.2), 1);
  assert.equal(normalizeLiveLineMaxPoints(-1), 500);
  assert.equal(normalizeLiveLineMaxPoints(Number.POSITIVE_INFINITY), 500);
  assert.equal(normalizeLiveLineMaxPoints(2.9), 2);
});

test('controlled replacement and maxPoints shrink reconcile the active reading', () => {
  const active = { time: 10, value: 1 };
  const replacement = { time: 10, value: 2 };
  assert.equal(reconcileLiveLineActivePoint(active, [replacement]), replacement);
  assert.equal(reconcileLiveLineActivePoint(active, [{ time: 20, value: 2 }]), null);
});

test('the clock only owns frames while foregrounded and visibly live', () => {
  const live = { paused: false, loading: false, reducedMotion: false, appState: 'active' };
  assert.equal(liveLineClockRuns(live), true);
  for (const change of [
    { paused: true },
    { loading: true },
    { reducedMotion: true },
    { appState: 'background' },
    { appState: 'inactive' },
  ]) {
    assert.equal(liveLineClockRuns({ ...live, ...change }), false);
  }
});

test('runtime cleans up app and tooltip lifecycle ownership', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../src/components/live-line-chart/index.tsx', import.meta.url)),
    'utf8',
  );
  assert.match(source, /AppState\.addEventListener\('change', setAppState\)/);
  assert.match(source, /return \(\) => subscription\.remove\(\)/);
  assert.match(source, /activeTime\.value = -1;\n\s+setActivePoint\(null\)/);
  assert.match(source, /frame\.setActive\(running\)/);
  assert.match(source, /return \(\) => frame\.setActive\(false\)/);
});
