import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DEFAULT_MARQUEE_SPEED,
  MAX_MARQUEE_COPIES,
  marqueeCopyCount,
  normalizeMarqueeSpacing,
  normalizeMarqueeSpeed,
} from '../src/components/marquee/marquee-math.ts';

test('Marquee motion inputs stay finite and non-negative', () => {
  assert.equal(normalizeMarqueeSpeed(Number.NaN), DEFAULT_MARQUEE_SPEED);
  assert.equal(normalizeMarqueeSpeed(Number.POSITIVE_INFINITY), DEFAULT_MARQUEE_SPEED);
  assert.equal(normalizeMarqueeSpeed(-12), 0);
  assert.equal(normalizeMarqueeSpeed(24), 24);

  assert.equal(normalizeMarqueeSpacing(Number.NaN), 0);
  assert.equal(normalizeMarqueeSpacing(Number.NEGATIVE_INFINITY), 0);
  assert.equal(normalizeMarqueeSpacing(-8), 0);
  assert.equal(normalizeMarqueeSpacing(16), 16);
});

test('copy layout rejects invalid measurements and preserves coverage', () => {
  assert.deepEqual(marqueeCopyCount(320, 100, 20), { period: 120, count: 5 });
  assert.deepEqual(marqueeCopyCount(320, 100, -20), { period: 100, count: 6 });
  assert.deepEqual(marqueeCopyCount(Number.NaN, 100, 20), {
    period: 120,
    count: 0,
  });
  assert.deepEqual(marqueeCopyCount(320, Number.POSITIVE_INFINITY, 20), {
    period: 0,
    count: 0,
  });
});

test('copy layout keeps tiny content inside a fixed mount budget', () => {
  const viewport = 390;
  const layout = marqueeCopyCount(viewport, 1, 0);

  assert.deepEqual(layout, {
    period: viewport / (MAX_MARQUEE_COPIES - 2),
    count: MAX_MARQUEE_COPIES,
  });
  assert.ok((layout.count - 2) * layout.period >= viewport);

  for (const content of [0.001, 0.1, 1, 8, 32, 128, 512]) {
    const candidate = marqueeCopyCount(1440, content, 0);
    assert.ok(candidate.count <= MAX_MARQUEE_COPIES);
    assert.ok((candidate.count - 2) * candidate.period >= 1440);
  }
});

test('the copied Marquee ships the normalization helper', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/marquee.json', import.meta.url),
      'utf8'
    )
  );
  assert.ok(item.files.some((file) => file.path === 'ui/marquee-math.ts'));
  assert.match(
    item.files.find((file) => file.path === 'ui/marquee.tsx').content,
    /normalizeMarqueeSpeed\(speedProp\)/
  );
});
