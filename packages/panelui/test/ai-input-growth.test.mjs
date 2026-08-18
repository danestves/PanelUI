import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  AI_INPUT_METRICS,
  growthBounds,
  heightForLines,
} from '../src/components/ai-input/ai-input-growth.ts';

const md = AI_INPUT_METRICS.md;

const source = await readFile(
  new URL('../src/components/ai-input/index.tsx', import.meta.url),
  'utf8'
);

test('an empty composer is one line tall, not nothing', () => {
  assert.equal(growthBounds(md, 1, 5).minHeight, heightForLines(md, 1));
  assert.equal(growthBounds(md, 0, 5).minHeight, heightForLines(md, 1));
  assert.equal(growthBounds(md, Number.NaN, 5).minHeight, heightForLines(md, 1));
});

test('the ceiling is maxRows, and never below the floor', () => {
  assert.equal(growthBounds(md, 1, 5).maxHeight, heightForLines(md, 5));
  assert.equal(growthBounds(md, 3, 5).minHeight, heightForLines(md, 3));

  // A maxRows under minRows is a caller contradicting itself. The floor wins:
  // a field shorter than the rows it was told to open at is the one failure
  // visible before anybody has typed anything.
  const contradictory = growthBounds(md, 3, 1);
  assert.equal(contradictory.minHeight, heightForLines(md, 3));
  assert.equal(contradictory.maxHeight, heightForLines(md, 3));
  assert.ok(contradictory.maxHeight >= contradictory.minHeight);
});

test('nothing about the height is measured', () => {
  /*
   * Deriving a height from `onContentSizeChange` is a loop with a different
   * answer per platform: one reports the height of the text, the other the
   * height of the box that was just set from it — and on that one the field
   * can never grow past the height it opened at, which is a composer that
   * looks permanently squashed.
   *
   * A floor and a ceiling have neither failure, and no state at all.
   */
  assert.doesNotMatch(source, /onContentSizeChange=\{/);
  assert.doesNotMatch(source, /contentSize/);
  assert.doesNotMatch(source, /scrollEnabled=\{/);
  assert.match(source, /bounds\.minHeight/);
  assert.match(source, /maxHeight: bounds\.maxHeight/);
  // And no fixed height, which is what would stop it growing between them.
  assert.doesNotMatch(source, /\n\s+height: bounds\./);
});

test('every size states one line height, in one place', () => {
  // The bounds are computed from these numbers and the field is drawn with
  // them, so a leading set in a class as well would be a leading that
  // disagrees with itself.
  assert.match(source, /lineHeight: metrics\.lineHeight/);
  assert.doesNotMatch(source, /leading-\[/);

  for (const size of Object.keys(AI_INPUT_METRICS)) {
    const metrics = AI_INPUT_METRICS[size];
    assert.ok(metrics.lineHeight > metrics.fontSize, `${size} leading is too tight`);
    assert.ok(metrics.padding > 0, `${size} has no padding`);
  }
});
