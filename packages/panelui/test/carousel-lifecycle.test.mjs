import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  normalizeCarouselIndex,
  useCarouselAutoplay,
  useCarouselIndexLifecycle,
} from '../src/components/carousel/carousel-lifecycle.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mountHook(useHook, options) {
  let value;
  function Harness({ current }) {
    value = useHook(current);
    return null;
  }

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness, { current: options }));
  });

  return {
    get value() {
      return value;
    },
    async update(current) {
      await act(async () => renderer.update(React.createElement(Harness, { current })));
    },
    async unmount() {
      await act(async () => renderer.unmount());
    },
  };
}

test('indices clamp or wrap consistently when the slide count shrinks', () => {
  assert.equal(normalizeCarouselIndex(4, 3, false), 2);
  assert.equal(normalizeCarouselIndex(4, 3, true), 1);
  assert.equal(normalizeCarouselIndex(-1, 3, false), 0);
  assert.equal(normalizeCarouselIndex(-1, 3, true), 2);
  assert.equal(normalizeCarouselIndex(3, 0, false), 0);
  assert.equal(normalizeCarouselIndex(Number.POSITIVE_INFINITY, 3, true), 0);
});

test('an invalid controlled index is rendered safely and reported once', async () => {
  const corrections = [];
  const settled = [];
  const options = (count, suffix = '') => ({
    requestedIndex: 4,
    count,
    countKnown: true,
    loop: false,
    onCorrection: (index) => corrections.push(`${index}${suffix}`),
    onSettledIndex: (index) => settled.push(index),
  });
  const mounted = await mountHook(useCarouselIndexLifecycle, options(5));

  assert.equal(mounted.value, 4);
  assert.deepEqual(corrections, []);

  await mounted.update(options(3));

  assert.equal(mounted.value, 2);
  assert.deepEqual(corrections, ['2']);
  assert.deepEqual(settled, [4, 2]);

  // A parent render with a new callback must not repeat an ignored correction.
  await mounted.update(options(3, '-duplicate'));
  assert.deepEqual(corrections, ['2']);

  // Accepting the correction resets the ledger, so a later invalid state reports again.
  await mounted.update({ ...options(3), requestedIndex: 2 });
  await mounted.update(options(3, '-again'));
  assert.deepEqual(corrections, ['2', '2-again']);
  await mounted.unmount();
});

test('autoplay stops at the terminal index and re-arms after lifecycle changes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const advances = [];
  const base = {
    enabled: true,
    index: 2,
    count: 3,
    loop: false,
    interval: 1_000,
    onAdvance: (index) => advances.push(index),
  };
  const mounted = await mountHook(useCarouselAutoplay, base);

  t.mock.timers.tick(5_000);
  assert.deepEqual(advances, []);

  await mounted.update({ ...base, index: 1 });
  t.mock.timers.tick(1_000);
  assert.deepEqual(advances, [2]);
  await mounted.update(base);
  t.mock.timers.tick(5_000);
  assert.deepEqual(advances, [2]);

  await mounted.update({ ...base, count: 4 });
  t.mock.timers.tick(1_000);
  assert.deepEqual(advances, [2, 3]);
  t.mock.timers.tick(5_000);
  assert.deepEqual(advances, [2, 3]);

  await mounted.update({ ...base, loop: true });
  t.mock.timers.tick(1_000);
  assert.deepEqual(advances, [2, 3, 3]);

  await mounted.update({ ...base, index: 0, interval: 500 });
  t.mock.timers.tick(500);
  assert.deepEqual(advances, [2, 3, 3, 1]);
  await mounted.unmount();
});
