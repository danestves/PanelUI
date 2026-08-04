/**
 * Colour arithmetic, in the model a picker is shaped like.
 *
 * A picker's controls *are* HSV: a square of saturation against brightness
 * under one hue, with the hue itself on a separate scale. Storing anything
 * else means converting on every frame of a drag and, worse, losing the
 * position of the thumb — a fully black colour is `#000` whatever its hue and
 * saturation were, so a round trip through RGB throws away where the finger
 * was. HSV is kept as the truth and everything here converts *out* of it.
 *
 * Every function is a worklet. The drag never leaves the UI thread, so the
 * hue behind the square, the thumb fill and the preview swatch all need these
 * on the same frame the finger moved, and a JS-only helper would put a bridge
 * hop in the middle of that.
 */

/** A colour in the model the picker stores: hue, saturation, value, alpha. */
export interface HsvaColor {
  /** Hue in degrees, `0`–`360`. */
  h: number;
  /** Saturation, `0`–`1`. */
  s: number;
  /** Value — brightness — `0`–`1`. */
  v: number;
  /** Alpha, `0`–`1`. */
  a: number;
}

/** How a colour is written when it leaves the picker. */
export type ColorFormat = 'hex' | 'rgb' | 'hsl';

function clamp01(n: number) {
  'worklet';
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Hue wraps rather than clamps — 370° is 10°, and -10° is 350°. */
function wrapHue(h: number) {
  'worklet';
  return ((h % 360) + 360) % 360;
}

/** HSV to 8-bit RGB. */
export function hsvToRgb(h: number, s: number, v: number) {
  'worklet';
  const hue = wrapHue(h) / 60;
  const sat = clamp01(s);
  const val = clamp01(v);
  const c = val * sat;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const m = val - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 1) {
    r = c;
    g = x;
  } else if (hue < 2) {
    r = x;
    g = c;
  } else if (hue < 3) {
    g = c;
    b = x;
  } else if (hue < 4) {
    g = x;
    b = c;
  } else if (hue < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** 8-bit RGB to HSV. Hue is undefined for a grey, and comes back as `0`. */
export function rgbToHsv(r: number, g: number, b: number) {
  'worklet';
  const rr = clamp01(r / 255);
  const gg = clamp01(g / 255);
  const bb = clamp01(b / 255);
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / d) % 6);
    else if (max === gg) h = 60 * ((bb - rr) / d + 2);
    else h = 60 * ((rr - gg) / d + 4);
  }

  return { h: wrapHue(h), s: max === 0 ? 0 : d / max, v: max };
}

/** HSV to HSL, for `format="hsl"`. Both are cylinders; only the axis differs. */
export function hsvToHsl(h: number, s: number, v: number) {
  'worklet';
  const val = clamp01(v);
  const sat = clamp01(s);
  const l = val * (1 - sat / 2);
  const denominator = Math.min(l, 1 - l);
  return { h: wrapHue(h), s: denominator === 0 ? 0 : (val - l) / denominator, l };
}

/**
 * An `rgba()` string, which is what a style wants. Used for every animated
 * fill in the picker, so it stays cheap: no allocation beyond the string, and
 * no branch on the alpha.
 */
export function hsvToCss(h: number, s: number, v: number, a = 1) {
  'worklet';
  const { r, g, b } = hsvToRgb(h, s, v);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(a)})`;
}

function toHexPair(n: number) {
  'worklet';
  const clamped = n < 0 ? 0 : n > 255 ? 255 : Math.round(n);
  return clamped < 16 ? `0${clamped.toString(16)}` : clamped.toString(16);
}

/**
 * A `#rrggbb` string, gaining a `#rrggbbaa` alpha pair only when the colour is
 * actually translucent — an opaque colour written with a trailing `ff` is the
 * same colour spelled in a way half the CSS parsers in the world reject.
 */
export function hsvToHex(h: number, s: number, v: number, a = 1) {
  'worklet';
  const { r, g, b } = hsvToRgb(h, s, v);
  const base = `#${toHexPair(r)}${toHexPair(g)}${toHexPair(b)}`;
  return a >= 1 ? base : `${base}${toHexPair(clamp01(a) * 255)}`;
}

/** Writes a stored colour out in one of the three formats a consumer asks for. */
export function formatColor(color: HsvaColor, format: ColorFormat = 'hex') {
  'worklet';
  const { h, s, v, a } = color;
  const alpha = clamp01(a);

  if (format === 'rgb') {
    const { r, g, b } = hsvToRgb(h, s, v);
    return alpha >= 1
      ? `rgb(${r}, ${g}, ${b})`
      : `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`;
  }

  if (format === 'hsl') {
    const hsl = hsvToHsl(h, s, v);
    const sat = Math.round(hsl.s * 100);
    const light = Math.round(hsl.l * 100);
    const hue = Math.round(hsl.h);
    return alpha >= 1
      ? `hsl(${hue}, ${sat}%, ${light}%)`
      : `hsla(${hue}, ${sat}%, ${light}%, ${Math.round(alpha * 100) / 100})`;
  }

  return hsvToHex(h, s, v, alpha);
}

function expandShorthand(hex: string) {
  let out = '';
  for (let i = 0; i < hex.length; i++) out += hex[i]! + hex[i]!;
  return out;
}

/**
 * Reads `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`
 * and `hsla()`, and returns `null` for anything else — including the named
 * colours, which would mean shipping a lookup table of 148 words to parse a
 * string a caller almost never writes.
 *
 * `null` rather than a thrown error or a silent black: a picker handed a value
 * it cannot read should keep the one it has, and only a distinguishable "no"
 * lets the caller do that.
 */
export function parseColor(input: string): HsvaColor | null {
  const value = input.trim().toLowerCase();

  if (value.startsWith('#')) {
    let body = value.slice(1);
    if (body.length === 3 || body.length === 4) body = expandShorthand(body);
    if ((body.length !== 6 && body.length !== 8) || /[^0-9a-f]/.test(body)) return null;

    const r = parseInt(body.slice(0, 2), 16);
    const g = parseInt(body.slice(2, 4), 16);
    const b = parseInt(body.slice(4, 6), 16);
    const a = body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1;
    const { h, s, v } = rgbToHsv(r, g, b);
    return { h, s, v, a };
  }

  const fn = /^(rgba?|hsla?)\(([^)]+)\)$/.exec(value);
  if (!fn) return null;

  // Both the comma and the space syntaxes, and the `/` that separates alpha in
  // the space one.
  const parts = fn[2]!.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const num = (raw: string, scale: number) => {
    const n = parseFloat(raw);
    if (Number.isNaN(n)) return null;
    return raw.endsWith('%') ? (n / 100) * scale : n;
  };

  const a = parts[3] === undefined ? 1 : num(parts[3], 1);
  if (a === null) return null;

  if (fn[1]!.startsWith('rgb')) {
    const r = num(parts[0]!, 255);
    const g = num(parts[1]!, 255);
    const b = num(parts[2]!, 255);
    if (r === null || g === null || b === null) return null;
    const { h, s, v } = rgbToHsv(r, g, b);
    return { h, s, v, a: clamp01(a) };
  }

  const h = num(parts[0]!, 360);
  const sl = num(parts[1]!, 1);
  const l = num(parts[2]!, 1);
  if (h === null || sl === null || l === null) return null;

  // HSL to HSV, so the picker only ever stores the one model.
  const light = clamp01(l);
  const sat = clamp01(parts[1]!.endsWith('%') ? sl : sl > 1 ? sl / 100 : sl);
  const v = light + sat * Math.min(light, 1 - light);
  return {
    h: wrapHue(h),
    s: v === 0 ? 0 : 2 * (1 - light / v),
    v,
    a: clamp01(a),
  };
}

/** Whether `parseColor` can read this string. */
export function isValidColor(input: string) {
  return parseColor(input) !== null;
}
