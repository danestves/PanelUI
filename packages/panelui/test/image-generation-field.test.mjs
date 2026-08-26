/**
 * The field has to fill the box it is given, and cost almost nothing to run.
 *
 * Both were reported, and both had to be fixed twice. It first measured itself
 * in normal layout flow, where a grid of drawings has no intrinsic height, so
 * it drew one row of dots along the top of an empty frame. Then it rebuilt
 * every dot as a string on every frame, and a page showing several stalled on
 * scroll. Then it clipped a moving light to a path with hundreds of subpaths
 * in it, which is re-rasterized every time the view is drawn — so the cost had
 * moved rather than left.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DOT_GAP,
  DOT_LIT_RADIUS,
  DOT_RADIUS,
  DOT_REST_OPACITY,
  FRAMES,
  LIT_OPACITY,
  PERIOD,
  crossfadeAlphas,
  dotCount,
  frameAt,
  framePhase,
  gapFor,
  gridPath,
  influenceAt,
  litFrames,
  litPath,
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
    assert.equal(litPath(...size, 0.5), '');
  }
  assert.equal(gapFor(0, 0), DOT_GAP);
});

test('a very large box is drawn coarser rather than with more dots', () => {
  const drawn = circles(gridPath(1200, 1200));
  assert.ok(drawn <= 800, `drew ${drawn}`);
  assert.ok(drawn > 400, `drew ${drawn} — too coarse to read as a field`);
  assert.ok(gapFor(1200, 1200) > DOT_GAP, 'the gap should open up');
});

/*
 * The whole point. Every frame the field will draw is built when the box is
 * measured, so running it is handing over a string that already exists.
 */
test('every frame is built once, not per frame', () => {
  assert.match(source, /const grid = useMemo\(\s*\(\) => gridPath\(size\.width, size\.height\)/);
  assert.match(source, /const frames = useMemo\(\s*\(\) => litFrames\(size\.width, size\.height, animation\)/);

  const callback = source.slice(
    source.indexOf('const frame = useFrameCallback('),
    source.indexOf('const { setActive } = frame;')
  );
  for (const built of ['gridPath', 'litPath', 'litFrames']) {
    assert.ok(!callback.includes(built), `the frame callback must not call ${built}`);
  }
  assert.match(callback, /clock\.value \+= Math\.min\(/, 'it should only advance the clock');

  // And what is handed over is an index into that array, twice: the frame
  // being left and the frame being arrived at.
  assert.match(source, /d: frames\[Math\.floor\(framePhase\(clock\.value, animation\)\)\] \?\? ''/);
  assert.match(
    source,
    /d: frames\[\(Math\.floor\(framePhase\(clock\.value, animation\)\) \+ 1\) % FRAMES\] \?\? ''/
  );
});

/*
 * What moves between one frame and the next is two view opacities, and nothing
 * else. A value that changes every frame returned beside `d` would defeat
 * Reanimated's shallow-equal gate and push the path string every frame too —
 * and every push of a path is a fresh parse of several hundred subpaths, which
 * is the cost the prebuilt frames exist to avoid.
 */
test('the path and the opacity are animated apart', () => {
  for (const slot of ['slotA', 'slotB']) {
    const updater = source.slice(
      source.indexOf(`const ${slot} = useAnimatedProps(`),
      source.indexOf('}));', source.indexOf(`const ${slot} = useAnimatedProps(`))
    );
    assert.ok(updater.includes('d:'), `${slot} should return a path`);
    assert.ok(!updater.includes('opacity'), `${slot} must not return an opacity`);
  }

  for (const ramp of ['fadeOut', 'fadeIn']) {
    const updater = source.slice(
      source.indexOf(`const ${ramp} = useAnimatedStyle(`),
      source.indexOf('}));', source.indexOf(`const ${ramp} = useAnimatedStyle(`))
    );
    assert.ok(updater.includes('opacity:'), `${ramp} should return an opacity`);
    assert.ok(!updater.includes('d:'), `${ramp} must not return a path`);
  }
});

test('nothing is clipped or masked', () => {
  // A complex clip is re-rasterized every time the view is drawn, which
  // scrolling does constantly. It was the second stall.
  for (const token of ['ClipPath', 'clipPath=', '<Mask', 'mask=']) {
    assert.ok(!source.includes(token), `${token} must not be used`);
  }
});

test('the lit dots are drawn over the resting grid, not instead of it', () => {
  // A dot brightens in place rather than appearing to move.
  assert.match(source, /<Path d=\{grid\} fill=\{color\} fillOpacity=\{DOT_REST_OPACITY\} \/>/);
  assert.match(source, /<AnimatedPath animatedProps=\{slotA\} fill=\{color\} \/>/);
  assert.match(source, /<AnimatedPath animatedProps=\{slotB\} fill=\{color\} \/>/);
});

test('the two layers come to one brightness at every point of the ramp', () => {
  // Drawn over one another, so a dot lit in both composites to
  // 1 - (1-a)(1-b). A plain cross-fade dips a fifth in the middle of every
  // step, and six steps a second makes that a flicker.
  for (let step = 0; step <= 20; step += 1) {
    const [out, arriving] = crossfadeAlphas(step / 20);
    const together = 1 - (1 - out) * (1 - arriving);
    assert.ok(
      Math.abs(together - LIT_OPACITY) < 1e-9,
      `at ${step / 20} the pair came to ${together}`
    );
    for (const alpha of [out, arriving]) {
      assert.ok(alpha >= 0 && alpha <= 1, `${alpha} is not an opacity`);
    }
  }

  // And the ends hand the field wholly to one layer or the other.
  assert.deepEqual(crossfadeAlphas(0), [LIT_OPACITY, 0]);
  assert.deepEqual(crossfadeAlphas(1), [0, LIT_OPACITY]);
});

test('the fraction between frames is kept, not rounded away', () => {
  for (const animation of ['drift', 'pulse', 'scan']) {
    for (const time of [0, 1, 999, PERIOD[animation] - 1, PERIOD[animation], 1e6]) {
      const phase = framePhase(time, animation);
      assert.ok(phase >= 0 && phase < FRAMES, `${animation} at ${time} gave ${phase}`);
      // It is the same clock frameAt reads, one rounding later.
      assert.equal(Math.floor(phase), frameAt(time, animation));
    }
  }

  // Somewhere between two frames, or there is nothing to cross-fade on.
  assert.ok(framePhase(PERIOD.drift / FRAMES / 2, 'drift') % 1 > 0);
});

test('a frame lights some of the field but never all of it', () => {
  const total = dotCount(208, 208);
  for (const animation of ['drift', 'pulse', 'scan']) {
    for (const frame of litFrames(208, 208, animation)) {
      const lit = circles(frame);
      assert.ok(lit > 0, `${animation}: a frame lit nothing`);
      assert.ok(lit < total, `${animation}: a frame lit the whole field`);
    }
  }
});

/** Every circle in a path, as `[centreX, centreY, radius]`. */
const dots = (d) =>
  [...d.matchAll(/M(-?[\d.]+),(-?[\d.]+)a([\d.]+)/g)].map(([, x, y, r]) => [
    Number(x) + Number(r),
    Number(y),
    Number(r),
  ]);

/**
 * Where the light is in a frame: its dots' centroid, weighted by how far each
 * one has been grown past resting. A dot the light barely reached pulls on it
 * barely.
 */
const lightIn = (d) => {
  let x = 0;
  let y = 0;
  let total = 0;
  for (const [dotX, dotY, radius] of dots(d)) {
    const weight = radius - DOT_RADIUS;
    x += dotX * weight;
    y += dotY * weight;
    total += weight;
  }
  return total > 0 ? [x / total, y / total] : [Number.NaN, Number.NaN];
};

const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('the loop closes rather than jumping', () => {
  /*
   * Where the light is, not how many dots it lit.
   *
   * This used to compare circle counts, which a snap passes: the disc has the
   * same area wherever it is, so a frame that has jumped across the box counts
   * the same as one that has not. `drift` did jump — 65pt against a typical
   * step of 15pt, once every pass — and this test said it did not.
   *
   * `drift` is the one held to it. `pulse` is a ring that has expanded past
   * every dot before it restarts, so it has faded out rather than moved, and
   * `scan` is a band that leaves one edge and returns at the other by design.
   */
  const frames = litFrames(208, 208, 'drift');
  const steps = [];
  for (let index = 0; index < FRAMES - 1; index += 1) {
    steps.push(apart(lightIn(frames[index]), lightIn(frames[index + 1])));
  }
  const typical = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)];
  const wrap = apart(lightIn(frames[FRAMES - 1]), lightIn(frames[0]));
  assert.ok(
    wrap <= typical * 2,
    `wrapped ${wrap.toFixed(1)}pt against a typical step of ${typical.toFixed(1)}pt`
  );
});

test('every animation has a period and every moment has a frame', () => {
  for (const animation of ['drift', 'pulse', 'scan']) {
    assert.ok(PERIOD[animation] > 0);
    for (const time of [0, 1, 999, PERIOD[animation] - 1, PERIOD[animation], 1e6]) {
      const index = frameAt(time, animation);
      assert.ok(Number.isInteger(index), `${animation} at ${time} gave ${index}`);
      assert.ok(index >= 0 && index < FRAMES, `${animation} at ${time} gave ${index}`);
    }
  }
});

test('the light has no edge', () => {
  // Smoothstep: it arrives and leaves at zero slope, so there is no rim where
  // the eye can find the boundary.
  assert.equal(influenceAt(0, 100), 1);
  assert.equal(influenceAt(100, 100), 0);
  assert.equal(influenceAt(200, 100), 0);
  const near = influenceAt(5, 100) - influenceAt(0, 100);
  const mid = influenceAt(55, 100) - influenceAt(50, 100);
  assert.ok(Math.abs(near) < Math.abs(mid), 'the ramp should be flat at the centre');
});

test('a lit dot is larger than a resting one', () => {
  assert.ok(DOT_LIT_RADIUS > DOT_RADIUS);
  // And a dot the light has not reached is still a dot: a field invisible
  // until lit is a field that flickers into being.
  assert.ok(DOT_REST_OPACITY > 0.1 && DOT_REST_OPACITY < 0.3);
});

test('the field is drawn to fill rather than measured in flow', () => {
  assert.match(source, /style=\{\[StyleSheet\.absoluteFill, style\]\}/);
});

/*
 * Every dot, whole, inside the box.
 *
 * Counted with `ceil` the grid overhung by up to half a gap on every side.
 * That is invisible while the light stays near the middle and obvious the
 * moment it reaches an edge — which the scanning band does by design and a
 * short wide box does simply by being short — so the dots drew outside the
 * card and the animation looked like it had escaped it.
 */
test('no dot falls outside the box it was given', () => {
  const boxes = [[208, 208], [340, 128], [128, 340], [200, 60], [1200, 1200]];
  for (const [width, height] of boxes) {
    const paths = [gridPath(width, height), ...litFrames(width, height, 'scan'), ...litFrames(width, height, 'drift')];
    for (const d of paths) {
      // Each subpath opens at the circle's leftmost point: `M<x>,<y>a<r>,...`
      for (const [, x, y, r] of d.matchAll(/M(-?[\d.]+),(-?[\d.]+)a([\d.]+)/g)) {
        const centreX = Number(x) + Number(r);
        const centreY = Number(y);
        const radius = Number(r);
        assert.ok(centreX - radius >= -0.01, `${width}x${height}: dot off the left at ${centreX}`);
        assert.ok(centreY - radius >= -0.01, `${width}x${height}: dot off the top at ${centreY}`);
        assert.ok(centreX + radius <= width + 0.01, `${width}x${height}: dot off the right at ${centreX}`);
        assert.ok(centreY + radius <= height + 0.01, `${width}x${height}: dot off the bottom at ${centreY}`);
      }
    }
  }
});

test('a box too small for a margin still draws rather than throwing', () => {
  for (const [width, height] of [[3, 3], [1, 40], [40, 1]]) {
    assert.doesNotThrow(() => gridPath(width, height));
    assert.doesNotThrow(() => litFrames(width, height, 'pulse'));
  }
});
