/**
 * The geometry a styled QR code is drawn from.
 *
 * A code is three different things wearing one colour: the body — every module
 * that carries data — and the three corner eyes, each of which is a square
 * ring with a square inside it. Scanners find a code by those three eyes
 * before they read a single module, which is why they are the part worth
 * shaping separately and the part it is most dangerous to shape badly.
 *
 * Everything here works in **module units**: one module is 1×1, and the paths
 * are placed into a viewBox that is the matrix plus its quiet zone. So a shape
 * is written once and scales to whatever the code is drawn at, with no
 * arithmetic per module and no rounding gaps between neighbours at fractional
 * sizes.
 *
 * ## What is safe to change and what is not
 *
 * A scanner locates a module by sampling the centre of its cell, so a shape
 * that stays inside its own cell and keeps that centre dark reads exactly as a
 * square does. All of these do. What actually costs read distance is *area*:
 * `dot` covers about two thirds of its cell and `diamond` exactly half, so a
 * code in either is a fainter code at the same size, and one in `diamond` at a
 * low error-correction level is a code that works on a screen and not on
 * paper.
 *
 * The rounded shapes join to their neighbours rather than rounding every
 * corner. A corner is rounded only where both cells touching it are light —
 * otherwise a run of modules would be a string of beads with a light seam
 * through it, and the seam is what the sampler sees.
 */

/** How a data module is drawn. */
export type QRCodeModuleShape = 'square' | 'rounded' | 'dot' | 'classy' | 'diamond';
/** How the ring around each of the three corner eyes is drawn. */
export type QRCodeEyeFrameShape = 'square' | 'rounded' | 'circle' | 'leaf' | 'shield';
/** How the square inside each corner eye is drawn. */
export type QRCodeEyeBallShape = 'square' | 'rounded' | 'dot' | 'diamond' | 'leaf';

/** A finder pattern is seven modules on a side, in three of the four corners. */
export const FINDER_SIZE = 7;

/**
 * How much smaller than its cell a free-standing shape is drawn.
 *
 * Circles and diamonds do not tile, so nothing is gained by having them touch:
 * a hair of space is what makes a field of dots read as dots rather than as a
 * grid that has gone soft. Squares and the rounded shapes keep the full cell,
 * because they *do* tile and any gap there is a light seam through a run.
 */
const INSET = 0.05;

/** Corner radii, clockwise from the top-left, in module units. */
type Corners = [number, number, number, number];

/**
 * A rectangle with a radius per corner.
 *
 * `A` with a zero radius is a straight line by the SVG specification, so a
 * sharp corner needs no branch of its own.
 */
function roundedRect(x: number, y: number, w: number, h: number, r: Corners): string {
  const [tl, tr, br, bl] = r;
  return (
    `M${x + tl} ${y}` +
    `H${x + w - tr}A${tr} ${tr} 0 0 1 ${x + w} ${y + tr}` +
    `V${y + h - br}A${br} ${br} 0 0 1 ${x + w - br} ${y + h}` +
    `H${x + bl}A${bl} ${bl} 0 0 1 ${x} ${y + h - bl}` +
    `V${y + tl}A${tl} ${tl} 0 0 1 ${x + tl} ${y}` +
    'Z'
  );
}

/** A circle, as two half-arcs — the only way to write one in a path. */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}

/** A square stood on its point, inscribed in the cell. */
function diamond(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`;
}

/**
 * Which of a module's four sides have a dark module against them.
 *
 * Only the four orthogonal neighbours, not the diagonals. A corner is rounded
 * when both of its sides are free, and a diagonal neighbour touching that
 * corner is a separate run — rounding away from it is what gives a diagonal
 * stripe its scalloped edge instead of a chain of squares.
 */
function neighbours(modules: boolean[][], x: number, y: number, size: number) {
  const at = (nx: number, ny: number) =>
    nx >= 0 && ny >= 0 && nx < size && ny < size && !!modules[ny]![nx];
  return { up: at(x, y - 1), right: at(x + 1, y), down: at(x, y + 1), left: at(x - 1, y) };
}

/** True where `(x, y)` falls inside one of the three finder patterns. */
export function inFinder(x: number, y: number, size: number): boolean {
  const far = size - FINDER_SIZE;
  return (
    (x < FINDER_SIZE && y < FINDER_SIZE) ||
    (x >= far && y < FINDER_SIZE) ||
    (x < FINDER_SIZE && y >= far)
  );
}

/** Which corner of the code an eye sits in. */
export type QRCodeEyeCorner = 'tl' | 'tr' | 'bl';

/**
 * Where each finder pattern starts, and which corner it is in.
 *
 * The corner is not decoration: an asymmetric eye shape has to be turned to
 * face outwards, or two of the three point into the middle of the code and
 * read as a mistake rather than as a style.
 */
export function finderOrigins(size: number): [number, number, QRCodeEyeCorner][] {
  const far = size - FINDER_SIZE;
  return [
    [0, 0, 'tl'],
    [far, 0, 'tr'],
    [0, far, 'bl'],
  ];
}

/** One data module, in the requested shape, offset into the quiet zone. */
export function modulePath(
  shape: QRCodeModuleShape,
  modules: boolean[][],
  x: number,
  y: number,
  size: number,
  offset: number
): string {
  const px = x + offset;
  const py = y + offset;

  if (shape === 'square') return `M${px} ${py}h1v1h-1z`;
  if (shape === 'dot') return circle(px + 0.5, py + 0.5, 0.5 - INSET);
  // No inset on the diamond. It already covers half its cell, which is the
  // least of any shape here, and taking another tenth off the radius costs a
  // fifth of what is left.
  if (shape === 'diamond') return diamond(px + 0.5, py + 0.5, 0.5);

  const { up, right, down, left } = neighbours(modules, x, y, size);
  // Half a module: a free-standing cell becomes a circle and a run becomes a
  // stadium, which is the shape the corner joining exists to produce.
  const r = 0.5;
  const tl = up || left ? 0 : r;
  const tr = up || right ? 0 : r;
  const br = down || right ? 0 : r;
  const bl = down || left ? 0 : r;

  if (shape === 'classy') {
    // One diagonal rounded, the other left sharp — the leaf. Still joined, so
    // a run of them is one stroke with two rounded ends rather than a row of
    // leaves with seams between.
    return roundedRect(px, py, 1, 1, [tl, 0, br, 0]);
  }
  return roundedRect(px, py, 1, 1, [tl, tr, br, bl]);
}

/**
 * One eye's ring: a 7×7 outline with a 5×5 hole in it.
 *
 * Two subpaths and `fillRule="evenodd"`, rather than a stroked rectangle. A
 * stroke is centred on its path, so its outer edge lands half a module outside
 * the seven the specification allows — and the eye stops being seven modules
 * wide, which is the one measurement a scanner takes before it reads anything.
 */
export function eyeFramePath(
  shape: QRCodeEyeFrameShape,
  x: number,
  y: number,
  offset: number,
  corner: QRCodeEyeCorner = 'tl'
): string {
  const px = x + offset;
  const py = y + offset;
  const s = FINDER_SIZE;
  const inner = s - 2;

  if (shape === 'circle') {
    return circle(px + s / 2, py + s / 2, s / 2) + circle(px + s / 2, py + s / 2, inner / 2);
  }

  /*
   * `shield` keeps one corner square and rounds the other three, and the
   * square one is the corner of the code the eye sits in — the corner a
   * reader's eye already finds the edge of the page by. Turned the same way
   * in all three positions, two of them point their flat corner into the
   * middle of the code and the set reads as a mistake.
   */
  const SHARP: Record<QRCodeEyeCorner, Corners> = {
    tl: [0, 3.5, 3.5, 3.5],
    tr: [3.5, 0, 3.5, 3.5],
    bl: [3.5, 3.5, 3.5, 0],
  };

  const outer: Record<Exclude<QRCodeEyeFrameShape, 'circle'>, Corners> = {
    square: [0, 0, 0, 0],
    rounded: [2, 2, 2, 2],
    // Two opposite corners, the same diagonal in all three positions: a leaf
    // is symmetric about that diagonal, so there is no outward to face and
    // turning them would only break the set's rhythm.
    leaf: [3.5, 0, 3.5, 0],
    shield: SHARP[corner],
  };

  const o = outer[shape as Exclude<QRCodeEyeFrameShape, 'circle'>];
  // The hole is concentric, so each radius loses the ring's own thickness —
  // one module. Floored at zero: a square corner stays square.
  const i = o.map((value) => Math.max(value - 1, 0)) as Corners;

  return roundedRect(px, py, s, s, o) + roundedRect(px + 1, py + 1, inner, inner, i);
}

/** One eye's centre: the 3×3 square two modules inside the ring. */
export function eyeBallPath(
  shape: QRCodeEyeBallShape,
  x: number,
  y: number,
  offset: number
): string {
  const px = x + offset + 2;
  const py = y + offset + 2;
  const s = 3;

  if (shape === 'square') return `M${px} ${py}h${s}v${s}h${-s}z`;
  if (shape === 'dot') return circle(px + s / 2, py + s / 2, s / 2);
  if (shape === 'diamond') return diamond(px + s / 2, py + s / 2, s / 2);
  if (shape === 'leaf') return roundedRect(px, py, s, s, [1.5, 0, 1.5, 0]);
  return roundedRect(px, py, s, s, [1, 1, 1, 1]);
}
