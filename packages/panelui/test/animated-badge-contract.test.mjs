import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/animated-badge/index.tsx', import.meta.url),
  'utf8'
);

test('the width spring is armed by a change, not by mounting', () => {
  /*
   * The pill's first *measured* layout lands a frame or two after the first
   * render, so a spring switched on at mount catches that settling: the badge
   * appears, drifts, and stops, on every screen that shows one. Reported twice.
   *
   * Arming on the first real change needs nothing guessed about when layout
   * has finished — until the status or the word moves there is nothing the
   * spring is for.
   */
  assert.match(source, /const \[armed, setArmed\] = useState\(false\)/);
  assert.match(source, /if \(key !== first\.current\) setArmed\(true\)/);
  assert.match(source, /reducedMotion \|\| !armed\s*\?\s*undefined/);
  assert.doesNotMatch(source, /!mounted\s*\?\s*undefined/);
});

test('the pill draws no ring', () => {
  // A ring needs a colour per status and there is no token for one. `border`
  // alone resolves to the current text colour, which came out as a black
  // outline on every badge in every theme.
  assert.doesNotMatch(source, /root: '[^']*\bborder\b/);
  assert.doesNotMatch(source, /border-(info|success|warning|destructive)\//);
});

test('loading draws its own ring rather than borrowing one', () => {
  /*
   * It used to override `Spinner`'s size with an arbitrary border width. The
   * class merge dropped the base `border-2`, the arbitrary value did not
   * compile, and what was left was a ring with no border — an empty hole where
   * the glyph belongs.
   */
  assert.match(source, /function LoadingRing\(/);
  assert.doesNotMatch(source, /from '\.\.\/spinner'/);
  assert.doesNotMatch(source, /border-\[1\.5px\]/);

  // Sized and coloured from values, so nothing depends on a class compiling.
  const ring = source.slice(source.indexOf('function LoadingRing'));
  assert.match(ring.slice(0, 1600), /borderWidth: Math\.max\(1, Math\.round\(size \/ 8\)\)/);
  assert.match(ring.slice(0, 1600), /borderTopColor: color/);
});

test("a caller's glyph takes the status colour", () => {
  // An icon from any set reads the ambient colour, which is its own set's grey
  // unless the badge provides one.
  assert.match(source, /<IconColorProvider color=\{iconColor\}>/);
});

test('a roll interrupted by a change back is sent home', () => {
  // The swap that would bring the element back is never scheduled, so without
  // this the glyph stays parked outside the badge for as long as the status
  // holds — the same empty slot, from the other direction.
  assert.match(
    source,
    /if \(settled\) \{[\s\S]{0,400}if \(phase\.value !== 0\) phase\.value = withSpring\(0, ROLL_IN\)/
  );
});
