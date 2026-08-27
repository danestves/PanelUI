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

test('Marquee ships a visible user pause control by default', async () => {
  const source = await readFile(
    new URL('../src/components/marquee/index.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /showPauseControl = true/);
  assert.match(source, /const moving = playing && !userPaused/);
  assert.match(source, /<Pressable[\s\S]*accessibilityRole="button"[\s\S]*min-h-12/);
  assert.match(source, /onPlayingChange\?\.\(!next\)/);
  assert.match(source, /\{userPaused \? playLabel : pauseLabel\}/);

  // Both controls — a lone marquee's and a group's — are drawn below the
  // content in flow. Floating, a 48pt target was clipped by the track's own
  // `overflow-hidden` and covered the content it exists to let you read.
  const controls = source.match(/className="min-h-12 self-end[^"]*"/g) ?? [];
  assert.equal(controls.length, 2);
  for (const control of controls) assert.doesNotMatch(control, /absolute/);
});

test('a Marquee only offers to pause motion it actually has', async () => {
  const source = await readFile(
    new URL('../src/components/marquee/index.tsx', import.meta.url),
    'utf8'
  );
  // Content that never measured never moves, and a control offering to stop it
  // is the same lie as a disabled button with no reason on it.
  //
  // Keyed to the copy count rather than to the period. Content that measured
  // inside a container that did not has a period — it is the content's own
  // length — and no copies to draw it with, so asking the period reported a
  // row that renders nothing as live and drew a pause control over an empty
  // strip. The count is the number that agrees with what is on screen.
  assert.match(source, /const live = playing && !reducedMotion && layout\.count > 0 && speed > 0/);
  assert.match(source, /\{showControl && live \?/);
  // A group draws one control for its rows, so it has to be told by them.
  assert.match(source, /liveRows\.size > 0/);
});

test('pausing a Marquee freezes it where it is', async () => {
  const source = await readFile(
    new URL('../src/components/marquee/index.tsx', import.meta.url),
    'utf8'
  );
  // `cancelAnimation` leaves the offset where it reached, so the only reset
  // allowed is the one a re-measure forces — `period` changing, and nothing
  // else. Zeroing on every `moving` toggle sent the content back to the start.
  const reset = source.match(/cancelAnimation\(offset\);\n\s*offset\.value = 0;\n\s*\}, \[offset, period\]\);/);
  assert.ok(reset, 'the offset reset is keyed to the measurement, not to the pause');
  // And the first leg after a resume covers the distance left rather than the
  // whole loop, or the lap after a pause runs slower than every other lap.
  assert.match(source, /const remaining = period - from;/);
  assert.match(source, /duration: cycle \* \(remaining \/ period\)/);
});

test('only the spoken Marquee copy can receive pointer or keyboard interaction', async () => {
  const source = await readFile(
    new URL('../src/components/marquee/index.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /pointerEvents=\{spoken \? 'box-none' : 'none'\}/);
  assert.match(source, /inert=\{Platform\.OS === 'web' && !spoken \? true : undefined\}/);
  assert.match(source, /aria-hidden=\{!spoken\}/);
  assert.match(source, /inert=\{Platform\.OS === 'web' \? true : undefined\}[\s\S]*onLayout=\{onContentLayout\}/);
});
