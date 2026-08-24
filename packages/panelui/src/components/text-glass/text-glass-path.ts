/**
 * Measuring an SVG path in JavaScript: how long its line is, and the box it
 * occupies.
 *
 * ## Why this exists
 *
 * The draw-on effect is a dash pattern whose lit part grows from nothing to
 * the whole line, and the pattern is written in the path's own units — so the
 * length of the line has to be a number before the first frame. The SVG
 * renderer knows it and will not say, and there is no measurement call to make
 * from JavaScript. Hardcoding a length per stroke would work for the built-in
 * words and break the moment somebody passed a path of their own, which is the
 * case the escape hatch exists for.
 *
 * The box comes from the same walk. A caller who supplies paths but no
 * `viewBox` would otherwise have to work one out by hand.
 *
 * ## How
 *
 * Curves are flattened into short line segments and the segments are summed.
 * `SEGMENTS` sets how short: 24 pieces per curve is well inside a rounding
 * error at the sizes a wordmark is drawn at, and the walk happens once per
 * path rather than once per frame.
 *
 * Arcs (`A`/`a`) are not implemented — nothing in the alphabet needs one, and
 * a wrong length is worse than a refusal. A path containing one measures only
 * the rest of itself, so pass `length` alongside it.
 */

/** Pieces each curve is flattened into before its length is summed. */
const SEGMENTS = 24;

/** What a path occupies, and how far the pen travels drawing it. */
export interface PathMeasurement {
  /** Total length of the line, in the path's own units. */
  length: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Every number in a command's arguments, in order. */
function numbersOf(source: string): number[] {
  const out: number[] = [];
  const re = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
  let match = re.exec(source);
  while (match) {
    out.push(Number(match[0]));
    match = re.exec(source);
  }
  return out;
}

function cubic(t: number, a: number, b: number, c: number, d: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

function quadratic(t: number, a: number, b: number, c: number): number {
  const u = 1 - t;
  return u * u * a + 2 * u * t * b + t * t * c;
}

/**
 * Walk a path, summing the distance travelled and tracking the box.
 *
 * A subpath's `Z` closes it back to where that subpath opened, which counts
 * towards the length like any other line — a closed shape that stopped short
 * of its own start would draw with a gap in it.
 */
export function measurePath(d: string): PathMeasurement {
  let length = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Where the pen is, where the current subpath opened, and the reflection of
  // the last curve's trailing control point — what `S` and `T` continue from.
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let lastControlX = 0;
  let lastControlY = 0;
  let lastCurve = '';

  const see = (px: number, py: number) => {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  };

  const lineTo = (px: number, py: number) => {
    length += Math.hypot(px - x, py - y);
    x = px;
    y = py;
    see(x, y);
  };

  for (const token of d.match(/[a-z][^a-z]*/gi) ?? []) {
    const command = token[0]!;
    const upper = command.toUpperCase();
    const relative = command !== upper;
    const args = numbersOf(token.slice(1));
    // How many numbers one repetition of this command consumes. A command may
    // carry several sets — `c` with twelve numbers is two curves.
    const arity =
      upper === 'M' || upper === 'L' || upper === 'T'
        ? 2
        : upper === 'H' || upper === 'V'
          ? 1
          : upper === 'C'
            ? 6
            : upper === 'S' || upper === 'Q'
              ? 4
              : 0;

    if (upper === 'Z') {
      lineTo(startX, startY);
      lastCurve = '';
      continue;
    }
    if (!arity) continue;

    for (let at = 0; at + arity <= args.length; at += arity) {
      const set = args.slice(at, at + arity);
      const dx = relative ? x : 0;
      const dy = relative ? y : 0;

      if (upper === 'M') {
        // Only the first pair of an `M` moves; the rest are implicit lines.
        x = set[0]! + dx;
        y = set[1]! + dy;
        if (at === 0) {
          startX = x;
          startY = y;
          see(x, y);
        } else {
          length += Math.hypot(x - dx, y - dy);
          see(x, y);
        }
        lastCurve = '';
        continue;
      }
      if (upper === 'L') {
        lineTo(set[0]! + dx, set[1]! + dy);
        lastCurve = '';
        continue;
      }
      if (upper === 'H') {
        lineTo(set[0]! + dx, y);
        lastCurve = '';
        continue;
      }
      if (upper === 'V') {
        lineTo(x, set[0]! + dy);
        lastCurve = '';
        continue;
      }

      const fromX = x;
      const fromY = y;
      let c1x: number;
      let c1y: number;
      let c2x: number;
      let c2y: number;
      let toX: number;
      let toY: number;

      if (upper === 'C') {
        c1x = set[0]! + dx;
        c1y = set[1]! + dy;
        c2x = set[2]! + dx;
        c2y = set[3]! + dy;
        toX = set[4]! + dx;
        toY = set[5]! + dy;
      } else if (upper === 'S') {
        const mirrored = lastCurve === 'C';
        c1x = mirrored ? 2 * x - lastControlX : x;
        c1y = mirrored ? 2 * y - lastControlY : y;
        c2x = set[0]! + dx;
        c2y = set[1]! + dy;
        toX = set[2]! + dx;
        toY = set[3]! + dy;
      } else {
        // Q and T are quadratic: one control point, raised to a cubic below.
        const qx = upper === 'Q' ? set[0]! + dx : lastCurve === 'Q' ? 2 * x - lastControlX : x;
        const qy = upper === 'Q' ? set[1]! + dy : lastCurve === 'Q' ? 2 * y - lastControlY : y;
        toX = upper === 'Q' ? set[2]! + dx : set[0]! + dx;
        toY = upper === 'Q' ? set[3]! + dy : set[1]! + dy;
        lastControlX = qx;
        lastControlY = qy;
        lastCurve = 'Q';
        let prevX = fromX;
        let prevY = fromY;
        for (let step = 1; step <= SEGMENTS; step += 1) {
          const t = step / SEGMENTS;
          const px = quadratic(t, fromX, qx, toX);
          const py = quadratic(t, fromY, qy, toY);
          length += Math.hypot(px - prevX, py - prevY);
          see(px, py);
          prevX = px;
          prevY = py;
        }
        x = toX;
        y = toY;
        continue;
      }

      let prevX = fromX;
      let prevY = fromY;
      for (let step = 1; step <= SEGMENTS; step += 1) {
        const t = step / SEGMENTS;
        const px = cubic(t, fromX, c1x, c2x, toX);
        const py = cubic(t, fromY, c1y, c2y, toY);
        length += Math.hypot(px - prevX, py - prevY);
        see(px, py);
        prevX = px;
        prevY = py;
      }
      x = toX;
      y = toY;
      lastControlX = c2x;
      lastControlY = c2y;
      lastCurve = 'C';
    }
  }

  if (minX === Infinity) {
    return { length: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { length, minX, minY, maxX, maxY };
}
