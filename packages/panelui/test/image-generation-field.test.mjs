/**
 * The field has to fill the box it is given, and cost almost nothing to run.
 *
 * Both of these were reported. The first version measured itself in normal
 * layout flow, where a grid of drawings has no intrinsic height, so it drew a
 * single row of dots along the top of an empty frame. The second rebuilt every
 * dot as a string on every frame, which stalled a page showing several at once.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DOT_GAP,
  DOT_REST_OPACITY,
  dotCount,
  driftAt,
  gapFor,
  gridPath,
  lightRadius,
  pulseAt,
  scanAt,
} from '../src/components/image-generation/dot-field.ts';

const source = await readFile(
  new URL('../src/components/image-generation/index.tsx', import.meta.url),
  'utf8'
);

/** How many circles a path holds. Each one opens with `M`. */
const circles = (d) => (d.match(/M/g) ?? []).length;

test('the grid covers the whole box, not one row of it', () => {
  const drawn = circles(gridPath(208, 208));
  // A 208pt square at a 10pt gap is 22 columns by 22 rows.
  assert.ok(drawn > 400, `expected a full grid, drew ${drawn}`);
  assert.equal(drawn, dotCount(208, 208));
});

test('the grid follows the box rather than assuming a square', () => {
  const wide = circles(gridPath(320, 180));
  const tall = circles(gridPath(180, 320));
  assert.ok(Math.abs(wide - tall) < 10, `${wide} vs ${tall}`);
});

test('an unmeasured box draws nothing rather than dividing by zero', () => {
  for (const size of [[0, 0], [200, 0], [0, 200]]) {
    assert.equal(gridPath(...size), '');
    assert.equal(dotCount(...size), 0);
  }
  assert.equal(gapFor(0, 0), DOT_GAP);
});

test('a very large box is drawn coarser rather than with more dots', () => {
  const drawn = circles(gridPath(1200, 1200));
  assert.ok(drawn <= 1000, `drew ${drawn}`);
  assert.ok(drawn > 500, `drew ${drawn} — too coarse to read as a field`);
  assert.ok(gapFor(1200, 1200) > DOT_GAP, 'the gap should open up');
});

/*
 * The whole point of the rewrite. The grid is the expensive half and none of it
 * changes as the light moves, so it is built when the box is measured and not
 * touched again — whatever moves must be a handful of numbers, not a string.
 */
test('the grid is built once per size, not once per frame', () => {
  assert.match(source, /const grid = useMemo\(\(\) => gridPath\(size\.width, size\.height\), \[size\.width, size\.height\]\)/);
  const callback = source.slice(
    source.indexOf('const frame = useFrameCallback('),
    source.indexOf('const { setActive } = frame;')
  );
  assert.ok(!callback.includes('gridPath'), 'the frame callback must not rebuild the grid');
  assert.match(callback, /clock\.value \+= Math\.min\(/, 'it should only advance the clock');
});

test('the light is clipped to the dots rather than drawn over them', () => {
  // Clipping is what makes the light land on the field instead of over it.
  assert.match(source, /<ClipPath id=\{clipId\}>\s*<Path d=\{grid\} \/>\s*<\/ClipPath>/);
  assert.equal((source.match(/clipPath=\{`url\(#\$\{clipId\}\)`\}/g) ?? []).length, 3);
});

/*
 * Two fields on one screen is exactly what a page of these is, and an SVG id is
 * looked up by name. Shared ids mean one field draws and the rest go blank.
 */
test('the gradients and the clip are named per instance', () => {
  assert.match(source, /const uid = useId\(\)\.replace\(/);
  for (const name of ['lightId', 'bandId', 'clipId']) {
    assert.match(source, new RegExp(`const ${name} = \`panelui-ig-[a-z]+-\\\$\\{uid\\}\``));
  }
  assert.ok(!/id="panelui-ig/.test(source), 'no literal ids');
});

test('the drifting light stays around the middle', () => {
  const [x0, y0] = driftAt(0, 200, 200);
  const [x1, y1] = driftAt(900, 200, 200);
  assert.notEqual(x0, x1);
  assert.notEqual(y0, y1);
  // A light that reaches a corner stops reading as one source.
  for (const time of [0, 400, 900, 1700, 2100, 5000, 12000]) {
    const [x, y] = driftAt(time, 200, 200);
    assert.ok(x > 60 && x < 140, `x drifted to ${x}`);
    assert.ok(y > 60 && y < 140, `y drifted to ${y}`);
  }
});

test('the pulse leaves the centre and fades out', () => {
  const [nearScale, nearStrength] = pulseAt(0);
  const [farScale, farStrength] = pulseAt(2000);
  assert.ok(farScale > nearScale, 'it should travel outward');
  assert.ok(farStrength < nearStrength, 'and fade as it goes');
  // It repeats rather than running away.
  const [wrappedScale] = pulseAt(2200);
  assert.ok(Math.abs(wrappedScale - nearScale) < 0.01);
});

test('the scan crosses and repeats', () => {
  assert.equal(scanAt(0), 0);
  assert.ok(scanAt(950) > 0.4 && scanAt(950) < 0.6);
  assert.ok(scanAt(1900) < 0.01, 'it should wrap rather than run away');
});

test('the light is sized against the box, not against the screen', () => {
  assert.ok(lightRadius(200, 200) < 200);
  assert.equal(lightRadius(400, 200), lightRadius(200, 200) * 2 * 0.5 * 2 * 0.5 || lightRadius(400, 200));
  // The shorter side decides, so a wide box does not get a light spanning it.
  assert.equal(lightRadius(1000, 200), lightRadius(200, 200));
});

test('a dot is visible before the light reaches it', () => {
  // A field that is invisible until lit is a field that flickers into being.
  assert.ok(DOT_REST_OPACITY > 0.1 && DOT_REST_OPACITY < 0.3);
});

test('the field is drawn to fill rather than measured in flow', () => {
  assert.match(source, /style=\{\[StyleSheet\.absoluteFill, style\]\}/);
});
