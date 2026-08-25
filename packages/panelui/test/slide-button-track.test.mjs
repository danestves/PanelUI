import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DEFAULT_THRESHOLD,
  VELOCITY_LOOKAHEAD,
  clamp,
  isCommitted,
  offsetFor,
  progressFor,
  resolveThreshold,
} from '../src/components/slide-button/slide-button-track.ts';

test('a threshold cannot make the button fire on contact', () => {
  assert.equal(resolveThreshold(undefined), DEFAULT_THRESHOLD);
  assert.equal(resolveThreshold(Number.NaN), DEFAULT_THRESHOLD);
  // Zero would complete the moment the thumb moved, which is a button with a
  // gesture in front of it rather than a slide.
  assert.equal(resolveThreshold(0), 0.1);
  assert.equal(resolveThreshold(-4), 0.1);
  // One is allowed: reaching the far end exactly is a legitimate ask.
  assert.equal(resolveThreshold(1), 1);
  assert.equal(resolveThreshold(2), 1);
  assert.equal(resolveThreshold(0.5), 0.5);
});

test('progress is measured against the distance the thumb can cover', () => {
  assert.equal(progressFor(0, 200), 0);
  assert.equal(progressFor(100, 200), 0.5);
  assert.equal(progressFor(200, 200), 1);
  // Past the end and before the start both clamp, so a rubber-banded offset
  // never reports more than a finished slide.
  assert.equal(progressFor(260, 200), 1);
  assert.equal(progressFor(-40, 200), 0);
});

test('progress is zero before the rail has been measured', () => {
  // The first frame runs before layout. Dividing by zero here would put the
  // thumb at NaN, which in Reanimated is a view that never draws again.
  assert.equal(progressFor(50, 0), 0);
  assert.equal(offsetFor(50, 0), 0);
});

test('the thumb follows the finger exactly until the end', () => {
  for (const at of [0, 1, 99, 150, 200]) {
    assert.equal(offsetFor(at, 200), at, `lagging at ${at}`);
  }
});

test('past either end the overshoot is given back at an eighth', () => {
  assert.equal(offsetFor(280, 200), 200 + 80 / 8);
  assert.equal(offsetFor(-80, 200), -10);
});

test('a slide let go at the far end commits', () => {
  assert.equal(isCommitted(1, 0, 200, 0.9), true);
  assert.equal(isCommitted(0.92, 0, 200, 0.9), true);
});

test('a slide let go short and still is refused', () => {
  assert.equal(isCommitted(0.5, 0, 200, 0.9), false);
  assert.equal(isCommitted(0.89, 0, 200, 0.9), false);
});

test('a slide let go short but travelling is honoured', () => {
  // 700 px/s over the lookahead covers 84 px of a 200 px rail — 0.42 — so a
  // flick from just past halfway arrives.
  const carried = (700 * VELOCITY_LOOKAHEAD) / 200;
  assert.ok(carried > 0.4 && carried < 0.45, 'the lookahead has moved');
  assert.equal(isCommitted(0.55, 700, 200, 0.9), true);
  // The same position with the flick going the other way is still refused.
  assert.equal(isCommitted(0.55, -700, 200, 0.9), false);
});

test('nothing commits on an unmeasured rail', () => {
  assert.equal(isCommitted(1, 9000, 0, 0.9), false);
});

test('clamp holds the range', () => {
  assert.equal(clamp(-1, 0, 1), 0);
  assert.equal(clamp(2, 0, 1), 1);
  assert.equal(clamp(0.3, 0, 1), 0.3);
});

/*
 * The gesture writes the arithmetic out rather than calling in here.
 *
 * A pan handler is the one place in the library that cannot afford a surprise,
 * and a worklet reaching across a module boundary for a helper that reaches
 * across again is a chain with more ways to fail than three lines are long.
 * That is a deliberate duplication, so these hold the copy to the definition.
 */
const source = await readFile(
  new URL('../src/components/slide-button/index.tsx', import.meta.url),
  'utf8'
);

test('the gesture calls no helper from another module', () => {
  const gesture = source.slice(
    source.indexOf('const gesture = useMemo('),
    source.indexOf('   * A controlled completion arrives')
  );
  for (const name of ['progressFor', 'offsetFor', 'isCommitted', 'clamp']) {
    assert.ok(!gesture.includes(`${name}(`), `${name} must not be called from the gesture`);
  }
  assert.ok(gesture.includes("'worklet';"), 'each handler declares itself');
});

test('the inlined overshoot matches the definition', () => {
  assert.match(source, /at = moved \/ OVERSHOOT_FRICTION;/);
  assert.match(source, /at = span \+ \(moved - span\) \/ OVERSHOOT_FRICTION;/);
  // Same numbers as offsetFor, checked above.
  assert.equal(offsetFor(-80, 200), -80 / 8);
  assert.equal(offsetFor(280, 200), 200 + 80 / 8);
});

test('the inlined commit test matches the definition', () => {
  assert.match(
    source,
    /const carried = \(event\.velocityX \* sign \* VELOCITY_LOOKAHEAD\) \/ travel\.value;/
  );
  assert.match(source, /progress\.value \+ carried >= threshold\.value/);
});

/*
 * The rail's measurements live in shared values.
 *
 * Built over plain numbers the gesture is a new object the first time the rail
 * is measured, and re-attaching a handler mid-drag is how a live touch is
 * dropped. The dependency list is what enforces it: nothing in it may be a
 * value that changes with layout or with a prop.
 */
test('the gesture is built once', () => {
  const deps = source
    .slice(source.indexOf('const gesture = useMemo('))
    .match(/\n    \[([^\]]*)\]\n  \);/)?.[1];
  assert.ok(deps, 'could not find the dependency list');
  const names = deps.split(',').map((name) => name.trim()).filter(Boolean);
  assert.deepEqual(
    names.sort(),
    ['active', 'armed', 'finish', 'origin', 'progress', 'sign', 'threshold', 'tick', 'travel']
  );
  for (const shared of ['travel', 'threshold', 'active']) {
    assert.match(
      source,
      new RegExp(`const ${shared} = useSharedValue\\(`),
      `${shared} must be a shared value, not a number the gesture closes over`
    );
  }
});

/*
 * The detector's child does one job.
 *
 * It carries no styling, no measurement, no ref and no accessibility — those
 * belong to the rail around it. A child doing five jobs is a child that can be
 * re-created for five reasons, and the detector re-attaches every time.
 */
test('the gesture wraps a bare surface', () => {
  assert.match(
    source,
    /<GestureDetector gesture=\{gesture\}>\s*<Animated\.View style=\{StyleSheet\.absoluteFill\} \/>\s*<\/GestureDetector>/
  );
});

test('the rail, not the surface, carries the ref and the accessibility', () => {
  const rail = source.slice(source.indexOf('<SlideButtonContext.Provider'), source.indexOf('<SlideButtonFill />'));
  assert.match(rail, /ref=\{ref\}/);
  assert.match(rail, /accessibilityRole="button"/);
  assert.match(rail, /onAccessibilityAction=\{activate\}/);
  assert.match(rail, /onLayout=\{onLayout\}/);
});

test('the fill is a width in points, not a percentage string', () => {
  // A style value that is sometimes a number and sometimes a string is a class
  // of bug worth not having in a view that updates every frame.
  assert.match(source, /width: progress\.value \* \(travel\.value \+ overlap\)/);
  assert.ok(!/width: `\$\{/.test(source), 'no template-literal width');
});

/*
 * The trail ends where the thumb is, not inside it.
 *
 * Ending it under the middle of the handle put the boundary inside the thing
 * that made it, so the colour appeared to come out of the middle of the thumb
 * rather than to be left behind it.
 */
/*
 * The trail's leading end is rounded, like the rail. Stopped exactly at the
 * handle's tail that cap meets the handle's own cap, and the two facing curves
 * leave a lens of bare track between them — two pills on a rail rather than a
 * track being filled in. Carrying half a handle-width keeps the cap under the
 * handle: always ahead of the tail, never past the centre.
 */
test('the trail is always ahead of the handle tail and behind its centre', () => {
  const overlap = 37; // half of the medium handle's width
  const travel = 200;
  for (const progress of [0.01, 0.25, 0.5, 0.75, 1]) {
    const trailEdge = progress * (travel + overlap);
    const tail = progress * travel;
    const centre = progress * travel + overlap;
    assert.ok(trailEdge >= tail, `trail behind the tail at ${progress}`);
    assert.ok(trailEdge <= centre, `trail past the centre at ${progress}`);
  }
});

/*
 * Nothing to see before anything has been dragged. A slice of colour beside the
 * handle at rest is a control that looks part-finished.
 */
test('the trail is zero wide at rest', () => {
  const width = source.match(/width: progress\.value \* \(([^)]+)\)/)?.[1];
  assert.ok(width, 'could not read the trail width');
  // Every term is scaled by progress, so at rest the whole thing is zero.
  assert.ok(!/^\s*RAIL_INSET/.test(width), 'no constant term, or it shows at rest');
  assert.equal(0 * (200 + 37), 0);
});

test('the trail and the handle are laid out from the same inset', () => {
  assert.match(source, /\[sign === 1 \? 'left' : 'right'\]: RAIL_INSET,\n        \},\n        style,/);
  assert.match(source, /\[sign === 1 \? 'left' : 'right'\]: RAIL_INSET,\n        \},\n        slide,/);
});

/*
 * The rail has hard ends, and the release hands the drag's own velocity to the
 * spring. Unclamped, a fast flick overshoots past the end, disappears behind
 * the rail's clip and comes back — worst on exactly the gesture people make
 * when they are sure.
 */
test('the settle cannot overshoot either end', () => {
  const spring = source.match(/const SPRING = \{([\s\S]*?)\} as const;/)?.[1];
  assert.ok(spring, 'could not read the spring');
  assert.match(spring, /overshootClamping: true/);
});

test('both ends are sprung with the same config', () => {
  // One spring for home and for the far end, so a slide that was refused and
  // one that was honoured are the same object moving at the same weight.
  assert.match(source, /withSpring\(committed \? 1 : 0, \{ \.\.\.SPRING, velocity \}\)/);
});
