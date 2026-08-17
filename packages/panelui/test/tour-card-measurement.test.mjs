import assert from 'node:assert/strict';
import test from 'node:test';
import {
  currentTourCardHeight,
  nextTourCardMeasurement,
} from '../src/components/tour/tour-card-measurement.ts';

test('a Tour card never reuses the previous step height', () => {
  const first = {};
  const second = {};
  const measured = nextTourCardMeasurement(first, 180, null);

  assert.equal(currentTourCardHeight(first, measured), 180);
  assert.equal(currentTourCardHeight(second, measured), null);

  const next = nextTourCardMeasurement(second, 96, measured);
  assert.equal(currentTourCardHeight(second, next), 96);
});

test('sub-pixel relayouts preserve the current measurement identity', () => {
  const step = {};
  const measured = nextTourCardMeasurement(step, 120, null);

  assert.equal(nextTourCardMeasurement(step, 120.5, measured), measured);
  assert.notEqual(nextTourCardMeasurement({}, 120.5, measured), measured);
});

test('the Tour overlay gates card placement and visibility by active step ownership', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('../src/components/tour/index.tsx', import.meta.url),
    'utf8'
  );
  const helper = await readFile(
    new URL('../src/components/tour/tour-card-measurement.ts', import.meta.url),
    'utf8'
  );
  const registry = JSON.parse(
    await readFile(new URL('../../../apps/docs/public/r/tour.json', import.meta.url), 'utf8')
  );

  assert.match(source, /currentTourCardHeight\(active, cardMeasurement\)/);
  assert.match(source, /nextTourCardMeasurement\(active, measured, current\)/);
  assert.match(source, /opacity: cardHeight === null \? 0 : 1/);
  assert.equal(
    registry.files.find(({ path }) => path === 'ui/tour-card-measurement.ts')?.content,
    helper
  );
});
