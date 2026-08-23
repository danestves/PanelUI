/**
 * The shaped QR code has to stay a QR code.
 *
 * A reader does two things, and the shapes have to survive both. It *finds* a
 * code by the three corner eyes — specifically by the 1:1:3:1:1 run of dark
 * and light through the middle of one, which only holds while the eye is
 * exactly seven modules across. Then it *reads* every module by sampling the
 * centre of that module's cell, which only works while each shape stays inside
 * its own cell and covers the middle of it.
 *
 * Both are properties of the geometry rather than of the drawing, so they are
 * checked here on the emitted paths — flattened to polygons and measured —
 * rather than by rendering anything. A radius that grows by a module or an eye
 * that loses a corner is a code that stops scanning, and nothing else in the
 * repository would notice.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FINDER_SIZE,
  eyeBallPath,
  eyeFramePath,
  finderOrigins,
  inFinder,
  modulePath,
} from '../packages/panelui/src/components/qr-code/qr-shapes.ts';

const MODULE_SHAPES = ['square', 'rounded', 'dot', 'classy', 'diamond'];
const EYE_FRAME_SHAPES = ['square', 'rounded', 'circle', 'leaf', 'shield'];
const EYE_BALL_SHAPES = ['square', 'rounded', 'dot', 'diamond', 'leaf'];

const EPSILON = 1e-9;
/** How finely an arc is sampled. Enough that a bounding box is exact to 1e-3. */
const ARC_STEPS = 64;

/**
 * Flatten one of our path strings into subpaths of points.
 *
 * It understands only the commands the shapes emit — `M`, `H`/`h`, `V`/`v`,
 * `L`, `A`/`a` and `Z` — and every arc is circular with no x-rotation, which
 * is what makes the centre solvable in a few lines rather than in the general
 * case.
 */
function flatten(d) {
  const tokens = d.match(/[MmHhVvLlAaZz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const subpaths = [];
  let current = null;
  let x = 0;
  let y = 0;
  let i = 0;
  const num = () => {
    const value = Number(tokens[i++]);
    assert.ok(Number.isFinite(value), `non-finite coordinate in path: ${d.slice(0, 120)}`);
    return value;
  };

  while (i < tokens.length) {
    const command = tokens[i++];
    switch (command) {
      case 'M': {
        x = num();
        y = num();
        current = [[x, y]];
        subpaths.push(current);
        break;
      }
      case 'H':
      case 'h': {
        x = command === 'H' ? num() : x + num();
        current.push([x, y]);
        break;
      }
      case 'V':
      case 'v': {
        y = command === 'V' ? num() : y + num();
        current.push([x, y]);
        break;
      }
      case 'L':
      case 'l': {
        x = command === 'L' ? num() : x + num();
        y = command === 'L' ? num() : y + num();
        current.push([x, y]);
        break;
      }
      case 'A':
      case 'a': {
        const r = num();
        num(); // ry, always equal to rx here
        num(); // x-axis rotation, always zero here
        const largeArc = num();
        const sweep = num();
        const tx = command === 'A' ? num() : x + num();
        const ty = command === 'A' ? num() : y + num();
        for (const point of arcPoints(x, y, tx, ty, r, largeArc === 1, sweep === 1)) {
          current.push(point);
        }
        x = tx;
        y = ty;
        break;
      }
      case 'Z':
      case 'z':
        break;
      default:
        assert.fail(`unhandled path command ${command} in ${d.slice(0, 120)}`);
    }
  }
  return subpaths;
}

/** Endpoint-to-centre for a circular arc, then sampled. */
function arcPoints(x0, y0, x1, y1, r, largeArc, sweep) {
  if (r <= EPSILON) return [[x1, y1]];
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = (x1 - x0) / 2;
  const dy = (y1 - y0) / 2;
  const half = Math.hypot(dx, dy);
  // A radius smaller than the chord's half-length has no solution; the
  // specification says to scale it up until it does.
  const radius = Math.max(r, half);
  const offset = Math.sqrt(Math.max(radius * radius - half * half, 0));
  const sign = largeArc === sweep ? 1 : -1;
  const cx = mx + (sign * offset * dy) / half;
  const cy = my - (sign * offset * dx) / half;

  let start = Math.atan2(y0 - cy, x0 - cx);
  let end = Math.atan2(y1 - cy, x1 - cx);
  let sweepAngle = end - start;
  if (sweep && sweepAngle < 0) sweepAngle += Math.PI * 2;
  if (!sweep && sweepAngle > 0) sweepAngle -= Math.PI * 2;

  const points = [];
  for (let step = 1; step <= ARC_STEPS; step++) {
    const angle = start + (sweepAngle * step) / ARC_STEPS;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return points;
}

function bounds(subpaths) {
  const all = subpaths.flat();
  return {
    minX: Math.min(...all.map(([px]) => px)),
    maxX: Math.max(...all.map(([px]) => px)),
    minY: Math.min(...all.map(([, py]) => py)),
    maxY: Math.max(...all.map(([, py]) => py)),
  };
}

/** Even-odd containment, which is the rule the eye frames are filled under. */
function contains(subpaths, px, py) {
  let inside = false;
  for (const ring of subpaths) {
    for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
      const [ax, ay] = ring[a];
      const [bx, by] = ring[b];
      if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/** A code with a mix of runs, isolated modules and diagonals in it. */
function sampleMatrix() {
  const size = 21;
  const modules = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) row.push(!inFinder(x, y, size) && (x * 7 + y * 3) % 5 < 2);
    modules.push(row);
  }
  return { size, modules };
}

test('every module shape stays inside its own cell and covers the centre', () => {
  const { size, modules } = sampleMatrix();

  for (const shape of MODULE_SHAPES) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!modules[y][x]) continue;
        const subpaths = flatten(modulePath(shape, modules, x, y, size, 4));
        const box = bounds(subpaths);

        // Outside its cell it would merge with the neighbour, and two modules
        // read as one.
        assert.ok(box.minX >= x + 4 - EPSILON, `${shape} escapes its cell to the left`);
        assert.ok(box.minY >= y + 4 - EPSILON, `${shape} escapes its cell upward`);
        assert.ok(box.maxX <= x + 5 + EPSILON, `${shape} escapes its cell to the right`);
        assert.ok(box.maxY <= y + 5 + EPSILON, `${shape} escapes its cell downward`);

        // The centre is the one point a reader samples.
        assert.ok(
          contains(subpaths, x + 4.5, y + 4.5),
          `${shape} leaves the centre of its cell uncovered`
        );
      }
    }
  }
});

test('every eye frame is exactly seven modules across, with a five-module hole', () => {
  const size = 25;
  for (const shape of EYE_FRAME_SHAPES) {
    for (const [x, y, corner] of finderOrigins(size)) {
      const subpaths = flatten(eyeFramePath(shape, x, y, 4, corner));
      const box = bounds(subpaths);

      assert.equal(subpaths.length, 2, `${shape} eye is not a ring`);
      // The width of this square is what a reader measures the whole code
      // against before it decodes a single module.
      assert.ok(
        Math.abs(box.maxX - box.minX - FINDER_SIZE) < 1e-6 &&
          Math.abs(box.maxY - box.minY - FINDER_SIZE) < 1e-6,
        `${shape} eye at ${corner} is ${box.maxX - box.minX} modules across, not ${FINDER_SIZE}`
      );
      assert.ok(Math.abs(box.minX - (x + 4)) < 1e-6, `${shape} eye at ${corner} is off its origin`);

      // The ring is one module thick, so its centre falls in the hole and the
      // run through it reads dark-light-dark rather than solid.
      assert.equal(
        contains(subpaths, x + 4 + FINDER_SIZE / 2, y + 4 + FINDER_SIZE / 2),
        false,
        `${shape} eye at ${corner} has no hole in it`
      );
      // And the ring itself is there, half a module in from the edge.
      assert.equal(
        contains(subpaths, x + 4 + 0.5, y + 4 + FINDER_SIZE / 2),
        true,
        `${shape} eye at ${corner} is missing its left edge`
      );
    }
  }
});

test('the shield eye turns its square corner outward at each position', () => {
  const size = 25;
  const drawn = finderOrigins(size).map(([x, y, corner]) =>
    // Normalised to the origin, so the three differ only by rotation.
    eyeFramePath('shield', 0, 0, 4, corner)
  );
  assert.equal(new Set(drawn).size, 3, 'the three shield eyes are drawn identically');

  // Symmetric shapes must not vary with the corner, or the set loses its
  // rhythm for no reason.
  for (const shape of ['square', 'rounded', 'circle', 'leaf']) {
    const same = finderOrigins(size).map(([, , corner]) => eyeFramePath(shape, 0, 0, 4, corner));
    assert.equal(new Set(same).size, 1, `${shape} eye should not turn with the corner`);
  }
});

test('every eye ball sits inside the hole in the frame', () => {
  for (const shape of EYE_BALL_SHAPES) {
    const subpaths = flatten(eyeBallPath(shape, 0, 0, 4));
    const box = bounds(subpaths);

    // The hole runs from +1 to +6; the ball from +2 to +5. Touching the hole's
    // edge would close the ring's light gap and destroy the 1:1:3:1:1 run.
    assert.ok(box.minX >= 4 + 2 - EPSILON, `${shape} ball reaches the frame`);
    assert.ok(box.minY >= 4 + 2 - EPSILON, `${shape} ball reaches the frame`);
    assert.ok(box.maxX <= 4 + 5 + EPSILON, `${shape} ball reaches the frame`);
    assert.ok(box.maxY <= 4 + 5 + EPSILON, `${shape} ball reaches the frame`);

    assert.ok(contains(subpaths, 4 + 3.5, 4 + 3.5), `${shape} ball misses its own centre`);
  }
});
