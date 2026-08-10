/**
 * A QR encoder, in TypeScript, with no dependencies.
 *
 * Vendored rather than installed for the reason the rest of this library has
 * no runtime dependencies: a component that needs an npm package to draw
 * itself is one the CLI has to install on someone's behalf, and every project
 * that copies the source in inherits it. This is a few hundred lines of
 * arithmetic that has not changed since 2000 — it is cheaper to own.
 *
 * Byte mode only. The alphanumeric and numeric modes pack more into the same
 * version, but they only accept their own alphabets, and the thing people
 * encode is a URL. Byte mode takes anything.
 *
 * The output is a square matrix of booleans, dark first. Everything about how
 * it is drawn — module size, colour, quiet zone, the hole in the middle for a
 * logo — belongs to the component, not here.
 */

/** How much of the code can be lost and still read. */
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/** Format bits per level. Not the same order as the letters. */
const FORMAT_BITS: Record<ErrorCorrectionLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

/** Error-correction codewords per block, indexed [level][version]. */
const ECC_CODEWORDS_PER_BLOCK: Record<ErrorCorrectionLevel, Int16Array> = {
  // Version 0 does not exist; the -1 keeps the index honest.
  L: Int16Array.from([-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]),
  M: Int16Array.from([-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]),
  Q: Int16Array.from([-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]),
  H: Int16Array.from([-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]),
};

/** How many blocks the data is split into, indexed [level][version]. */
const NUM_ERROR_CORRECTION_BLOCKS: Record<ErrorCorrectionLevel, Int16Array> = {
  L: Int16Array.from([-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25]),
  M: Int16Array.from([-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]),
  Q: Int16Array.from([-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68]),
  H: Int16Array.from([-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]),
};

const MIN_VERSION = 1;
const MAX_VERSION = 40;

/** Total data-and-error modules in a version, before the format areas. */
function rawDataModules(version: number): number {
  let modules = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignmentCount = Math.floor(version / 7) + 2;
    modules -= (25 * alignmentCount - 10) * alignmentCount - 55;
    if (version >= 7) modules -= 36;
  }
  return modules;
}

/** Codewords available for data, once error correction has taken its share. */
function dataCodewords(version: number, level: ErrorCorrectionLevel): number {
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[level]![version]! * NUM_ERROR_CORRECTION_BLOCKS[level]![version]!
  );
}

/** Where the alignment patterns go, as coordinates on both axes. */
function alignmentPositions(version: number): number[] {
  if (version === 1) return [];

  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  // Version 32 is the one exception to the formula, and it is in the spec as
  // an exception rather than as anything derivable.
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;

  /*
   * Ascending, and that is load-bearing: the caller skips the three
   * coordinate pairs that would land on a finder by index — first and last —
   * so a list in the other order draws an alignment pattern over the top-left
   * finder and leaves the bottom-right one off.
   *
   * They are walked backwards from the far edge because the spacing is even
   * from that end and the first one is pinned at 6, so the uneven gap falls
   * between the first two.
   */
  const positions: number[] = [];
  for (let pos = size - 7; positions.length < count - 1; pos -= step) positions.unshift(pos);
  positions.unshift(6);
  return positions;
}

/* ------------------------------------------------------------------ *
 * GF(256) arithmetic, for Reed–Solomon.
 * ------------------------------------------------------------------ */

/** Multiply in GF(256) with the QR primitive polynomial, x^8 + x^4 + x^3 + x^2 + 1. */
function multiply(a: number, b: number): number {
  let result = 0;
  for (let i = 7; i >= 0; i--) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((b >>> i) & 1) * a;
  }
  return result & 0xff;
}

/** The divisor polynomial for `degree` error-correction codewords. */
function generatorPolynomial(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;

  // Multiply out (x - r^0)(x - r^1)…(x - r^(degree-1)), keeping the monic
  // leading coefficient implicit.
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = multiply(result[j]!, root);
      if (j + 1 < degree) result[j]! ^= result[j + 1]!;
    }
    root = multiply(root, 0x02);
  }
  return result;
}

/** The remainder of `data` divided by the generator — the check codewords. */
function remainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
  const result = new Uint8Array(divisor.length);

  for (const byte of data) {
    const factor = byte ^ result[0]!;
    // Shift left by one and drop the leading term, which the factor consumed.
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < divisor.length; i++) result[i]! ^= multiply(divisor[i]!, factor);
  }

  return result;
}

/* ------------------------------------------------------------------ *
 * The bit stream.
 * ------------------------------------------------------------------ */

class BitBuffer {
  readonly bits: number[] = [];

  append(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
}

/** UTF-8 bytes. QR's byte mode is nominally Latin-1; every reader takes UTF-8. */
function toUtf8(text: string): number[] {
  const bytes: number[] = [];

  for (const character of text) {
    const point = character.codePointAt(0) as number;
    if (point < 0x80) {
      bytes.push(point);
    } else if (point < 0x800) {
      bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    } else if (point < 0x10000) {
      bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
    } else {
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f)
      );
    }
  }

  return bytes;
}

/** The character-count field is wider once there is more to count. */
function characterCountBits(version: number): number {
  return version < 10 ? 8 : 16;
}

/** The smallest version this data fits in at this level. */
function smallestVersion(byteLength: number, level: ErrorCorrectionLevel): number {
  for (let version = MIN_VERSION; version <= MAX_VERSION; version++) {
    const capacity = dataCodewords(version, level) * 8;
    // 4 bits of mode indicator, then the character count, then the data.
    const needed = 4 + characterCountBits(version) + byteLength * 8;
    if (needed <= capacity) return version;
  }

  throw new Error(
    `Too much data for a QR code: ${byteLength} bytes will not fit at error correction level ${level}.`
  );
}

/** Data codewords, padded and interleaved with their error correction. */
function codewords(bytes: number[], version: number, level: ErrorCorrectionLevel): Uint8Array {
  const capacity = dataCodewords(version, level) * 8;
  const buffer = new BitBuffer();

  buffer.append(0b0100, 4); // byte mode
  buffer.append(bytes.length, characterCountBits(version));
  for (const byte of bytes) buffer.append(byte, 8);

  // Terminator, then up to a byte boundary.
  buffer.append(0, Math.min(4, capacity - buffer.bits.length));
  buffer.append(0, (8 - (buffer.bits.length % 8)) % 8);

  // Then the two alternating pad codewords, until full.
  for (let pad = 0xec; buffer.bits.length < capacity; pad ^= 0xec ^ 0x11) {
    buffer.append(pad, 8);
  }

  const data = new Uint8Array(buffer.bits.length / 8);
  for (let i = 0; i < data.length; i++) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) byte = (byte << 1) | buffer.bits[i * 8 + bit]!;
    data[i] = byte;
  }

  const blockCount = NUM_ERROR_CORRECTION_BLOCKS[level]![version]!;
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[level]![version]!;
  const totalCodewords = Math.floor(rawDataModules(version) / 8);
  const shortBlockLength = Math.floor(totalCodewords / blockCount);
  // The last few blocks are one codeword longer, which is what makes the
  // interleave below uneven.
  const shortBlockCount = blockCount - (totalCodewords % blockCount);

  const divisor = generatorPolynomial(eccPerBlock);
  const blocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];

  for (let i = 0, offset = 0; i < blockCount; i++) {
    const length = shortBlockLength - eccPerBlock + (i < shortBlockCount ? 0 : 1);
    const block = data.slice(offset, offset + length);
    offset += length;
    blocks.push(block);
    eccBlocks.push(remainder(block, divisor));
  }

  // Interleave: one codeword from each block in turn, then the same for the
  // error correction. A burst of damage then falls across every block a little
  // rather than destroying one entirely.
  const result: number[] = [];

  // The last block is the longest, so its length is the number of rounds.
  for (let i = 0; i < blocks[blocks.length - 1]!.length; i++) {
    for (const block of blocks) if (i < block.length) result.push(block[i]!);
  }
  for (let i = 0; i < eccPerBlock; i++) {
    for (const block of eccBlocks) result.push(block[i]!);
  }

  return Uint8Array.from(result);
}

/* ------------------------------------------------------------------ *
 * The matrix.
 * ------------------------------------------------------------------ */

/** The eight mask patterns, by their index in the spec. */
const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

export interface QrMatrix {
  /** `true` is a dark module. Row-major, `[y][x]`. */
  modules: boolean[][];
  /** Modules per side, quiet zone excluded. */
  size: number;
  /** The version chosen for this data, 1–40. */
  version: number;
}

/**
 * Encode `text` as a QR matrix.
 *
 * `version` is chosen to be the smallest that fits unless one is given. A
 * fixed version is worth asking for when the content changes and the code
 * should not visibly change size with it.
 */
export function encodeQr(
  text: string,
  {
    errorCorrection = 'M',
    version: requestedVersion,
  }: { errorCorrection?: ErrorCorrectionLevel; version?: number } = {}
): QrMatrix {
  const bytes = toUtf8(text);
  const version = requestedVersion ?? smallestVersion(bytes.length, errorCorrection);

  if (version < MIN_VERSION || version > MAX_VERSION) {
    throw new Error(`QR version must be between ${MIN_VERSION} and ${MAX_VERSION}.`);
  }
  if (4 + characterCountBits(version) + bytes.length * 8 > dataCodewords(version, errorCorrection) * 8) {
    throw new Error(`That data does not fit in QR version ${version} at level ${errorCorrection}.`);
  }

  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );
  // Function patterns are not masked and take no data, so they are tracked
  // separately rather than inferred from their position afterwards.
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );

  const set = (x: number, y: number, dark: boolean) => {
    modules[y]![x] = dark;
    reserved[y]![x] = true;
  };

  /* Finder patterns, and the separator around each. */
  for (const [originX, originY] of [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ] as const) {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const x = originX + dx;
        const y = originY + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        // Distance from the finder's centre, as a square ring index: 0 and 1
        // are the dark core, 2 is the light ring inside it, 3 is the dark
        // border, and 4 is the separator — which is light, and is the reason
        // this walks one module further out than the pattern itself.
        const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        set(x, y, ring !== 2 && ring <= 3);
      }
    }
  }

  /* Timing patterns — the dotted lines joining the finders. */
  for (let i = 0; i < size; i++) {
    if (!reserved[6]![i]) set(i, 6, i % 2 === 0);
    if (!reserved[i]![6]) set(6, i, i % 2 === 0);
  }

  /* Alignment patterns, everywhere except under a finder. */
  const positions = alignmentPositions(version);
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      const corner = (i === 0 && j === 0) || (i === 0 && j === positions.length - 1) ||
        (i === positions.length - 1 && j === 0);
      if (corner) continue;

      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(positions[j]! + dx, positions[i]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  /* Reserve the format areas; the bits go in after masking. */
  for (let i = 0; i < 9; i++) {
    if (!reserved[8]![i]) set(i, 8, false);
    if (!reserved[i]![8]) set(8, i, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8]![size - 1 - i]) set(size - 1 - i, 8, false);
    if (!reserved[size - 1 - i]![8]) set(8, size - 1 - i, false);
  }
  // The dark module, which is always dark and is not part of anything.
  set(8, size - 8, true);

  /* Version information, for 7 and up. */
  if (version >= 7) {
    let rest = version;
    for (let i = 0; i < 12; i++) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
    const bits = ((version << 12) | rest) >>> 0;

    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  /* The data, walked in two-module columns, upwards then downwards. */
  const data = codewords(bytes, version, errorCorrection);
  let bit = 0;

  for (let right = size - 1; right >= 1; right -= 2) {
    // Column 6 is the vertical timing pattern; the walk skips over it.
    if (right === 6) right = 5;

    for (let vertical = 0; vertical < size; vertical++) {
      for (let column = 0; column < 2; column++) {
        const x = right - column;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;

        if (reserved[y]![x]) continue;

        // Past the end of the data the remainder bits are zero, which the
        // spec allows and every reader expects.
        modules[y]![x] = bit < data.length * 8 && ((data[bit >>> 3]! >>> (7 - (bit & 7))) & 1) === 1;
        bit++;
      }
    }
  }

  /* Mask, score, keep the best. */
  let bestMask = 0;
  let bestPenalty = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    applyMask(modules, reserved, mask, size);
    writeFormat(modules, errorCorrection, mask, size);
    const penalty = penaltyScore(modules, size);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
    }
    // Masking is its own inverse, so undoing it is applying it again.
    applyMask(modules, reserved, mask, size);
  }

  applyMask(modules, reserved, bestMask, size);
  writeFormat(modules, errorCorrection, bestMask, size);

  return { modules, size, version };
}

function applyMask(
  modules: boolean[][],
  reserved: boolean[][],
  mask: number,
  size: number
): void {
  const test = MASKS[mask]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!reserved[y]![x] && test!(x, y)) modules[y]![x] = !modules[y]![x];
    }
  }
}

/** The 15 format bits, BCH-protected and masked, in both of their places. */
function writeFormat(
  modules: boolean[][],
  level: ErrorCorrectionLevel,
  mask: number,
  size: number
): void {
  const data = (FORMAT_BITS[level] << 3) | mask;
  let rest = data;
  for (let i = 0; i < 10; i++) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
  const bits = (((data << 10) | rest) ^ 0x5412) >>> 0;

  const at = (i: number) => ((bits >>> i) & 1) === 1;

  // The copy around the top-left finder: down column 8, then along row 8.
  // Indices are [y][x], and the two runs change different axes — which is the
  // whole trap here.
  for (let i = 0; i <= 5; i++) modules[i]![8] = at(i);
  modules[7]![8] = at(6);
  modules[8]![8] = at(7);
  modules[8]![7] = at(8);
  for (let i = 9; i < 15; i++) modules[8]![14 - i] = at(i);

  // And the split copy: along row 8 at the right edge, then down column 8 at
  // the bottom.
  for (let i = 0; i < 8; i++) modules[8]![size - 1 - i] = at(i);
  for (let i = 8; i < 15; i++) modules[size - 15 + i]![8] = at(i);

  modules[size - 8]![8] = true;
}

/** The four penalty rules. Lower is a code more readers agree about. */
function penaltyScore(modules: boolean[][], size: number): number {
  let penalty = 0;

  // 1 & 3 — runs of five or more, and the finder-like 1:1:3:1:1 sequence.
  for (let axis = 0; axis < 2; axis++) {
    for (let a = 0; a < size; a++) {
      let runColour = false;
      let runLength = 0;
      const history = [0, 0, 0, 0, 0, 0, 0];

      for (let b = 0; b < size; b++) {
        const dark = axis === 0 ? modules[a]![b]! : modules[b]![a]!;

        if (dark === runColour) {
          runLength++;
          if (runLength === 5) penalty += 3;
          else if (runLength > 5) penalty += 1;
        } else {
          history.pop();
          history.unshift(runLength);
          if (!runColour && hasFinderPattern(history)) penalty += 40;
          runColour = dark;
          runLength = 1;
        }
      }

      history.pop();
      history.unshift(runLength);
      if (runColour) {
        history.pop();
        history.unshift(0);
      }
      if (hasFinderPattern(history)) penalty += 40;
    }
  }

  // 2 — solid 2×2 blocks.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const corner = modules[y]![x];
      if (
        corner === modules[y]![x + 1] &&
        corner === modules[y + 1]![x] &&
        corner === modules[y + 1]![x + 1]
      ) {
        penalty += 3;
      }
    }
  }

  // 4 — the balance of dark to light across the whole code.
  let dark = 0;
  for (const row of modules) for (const module of row) if (module) dark++;
  const total = size * size;
  const deviation = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  penalty += deviation * 10;

  return penalty;
}

/** The 1:1:3:1:1 run ratio, with four light modules on one side of it. */
function hasFinderPattern(history: number[]): boolean {
  const middle = history[1]!;
  if (middle <= 0 || history[2] !== middle || history[4] !== middle || history[5] !== middle) {
    return false;
  }
  if (history[3] !== middle * 3) return false;
  return Math.max(history[0]!, history[6]!) >= middle * 4;
}
