/**
 * Where each character of a ring lands.
 *
 * The failure this guards against reached a device: one glyph orbiting at
 * roughly twice the radius of the rest, in every version. Nothing in the
 * arithmetic could produce it — every glyph is placed by the same transform —
 * which is the point. A ring is a shape whose defect is obvious to look at and
 * invisible in a diff, so the two properties that make it a ring are asserted
 * here rather than left to be noticed.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const DIR = new URL('../src/components/circular-text/', import.meta.url);
const geometry = await readFile(new URL('circular-text-geometry.ts', DIR), 'utf8');
const source = await readFile(new URL('index.tsx', DIR), 'utf8');

/** The module is TypeScript, so the arithmetic is re-stated rather than imported. */
function glyphs(text, spread = 360, startAngle = 0) {
  const characters = Array.from(text);
  if (characters.length === 0) return [];
  const arc = Math.min(Math.abs(spread), 360);
  const closed = arc >= 360;
  const step =
    characters.length === 1 ? 0 : arc / (closed ? characters.length : characters.length - 1);
  return characters.map((character, index) => ({
    character,
    index,
    angle: startAngle + step * index,
  }));
}

test('a closed ring divides by the character count, not one fewer', () => {
  // `n` characters make `n` gaps when the end of the string is adjacent to its
  // start. Dividing by `n - 1` puts the last character on top of the first.
  assert.match(
    geometry,
    /arc \/ \(closed \? characters\.length : characters\.length - 1\)/,
    'the closed and open cases must divide by different counts'
  );

  const ring = glyphs('ABCD');
  assert.deepEqual(
    ring.map((glyph) => glyph.angle),
    [0, 90, 180, 270]
  );
});

test('an arc reaches both of its ends', () => {
  const arc = glyphs('ABC', 180);
  assert.deepEqual(
    arc.map((glyph) => glyph.angle),
    [0, 90, 180]
  );
});

test('the angles are evenly spaced, whatever the string', () => {
  for (const text of ['A', 'AB', 'PANELUI · COMPONENTS ·', '  ', '···']) {
    const ring = glyphs(text);
    if (ring.length < 3) continue;
    const step = ring[1].angle - ring[0].angle;
    for (let index = 1; index < ring.length; index += 1) {
      assert.ok(
        Math.abs(ring[index].angle - ring[index - 1].angle - step) < 1e-9,
        `uneven step in ${JSON.stringify(text)} at ${index}`
      );
    }
  }
});

test('a spread past a full turn is clamped rather than wrapped', () => {
  // Past a full turn the characters would be laid over the ones already there.
  assert.match(geometry, /Math\.min\(Math\.abs\(value\), 360\)/);
});

/*
 * Every glyph gets a box of the ring's own size, stated inline.
 *
 * A box that states its width and height cannot inherit a different one, and a
 * glyph at twice the radius of the rest is exactly what a box of the wrong
 * size looks like. This is the assertion that would have caught it.
 */
test('every glyph box states the ring size itself', () => {
  const box = source.match(/style=\{\{\s*position: 'absolute',[\s\S]*?\}\}/);
  assert.ok(box, 'the glyph box is positioned inline');
  for (const property of ['left: 0', 'top: 0', 'width: size', 'height: size']) {
    assert.match(box[0], new RegExp(property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(source, /inset-0/, 'the box must not take its size from a utility');
});

test('one angle per glyph reaches the transform, and nothing else', () => {
  assert.match(source, /transform: \[\{ rotate: `\$\{glyph\.angle\}deg` \}\]/);
});
