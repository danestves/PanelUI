/*
 * The icon gallery, read out of the library's own source.
 *
 * The docs site is a web app and the icon set is drawn with react-native-svg,
 * so the components themselves cannot be rendered on this page. The obvious
 * alternative — hand-copying 60-odd path strings into a web component — is the
 * exact thing this repo's generated registry exists to avoid: the copy is
 * correct on the day it is written and silently wrong after the first time
 * somebody nudges a curve.
 *
 * So each glyph is resolved at build time and re-emitted as plain SVG, in two
 * passes because the set is drawn two ways.
 *
 * ## The mapped icons
 *
 * Most of the set is `icon(HgSomething, { … })` — a glyph from the icon
 * package plus the size, colour and weight it is normally drawn at. Those are
 * read straight from the package's own data, which is already a list of
 * `[tag, attributes]` pairs, so there is nothing to parse: the alias imports
 * name the glyph, the declaration names the weight, and the pair is enough.
 *
 * That makes `@hugeicons/core-free-icons` a real dependency of this workspace
 * rather than only of the library, and it is declared as one. Left to resolve
 * through the monorepo's hoisted `node_modules` it works on a developer's
 * machine and fails on the deploy, which installs this workspace's own
 * dependencies and nothing else.
 *
 * ## The four drawn by hand
 *
 * Google, Facebook, Apple and BadgeCheck are still JSX in the library source,
 * so those are parsed out of it:
 *
 *   - `width`/`height` are dropped; the gallery sizes each icon itself.
 *   - `stroke={resolved}` and `fill={resolved}` become `currentColor`, which
 *     is how the same "inherit the surrounding colour" rule is spelled on the
 *     web. A brand mark's literal hexes are left alone, which is what keeps
 *     Google's four colours.
 *   - A prop-driven ternary resolves to its default branch, so a toggle icon
 *     shows its resting state.
 *   - `{...props}` is dropped: it is the caller's, not the drawing's.
 *
 * Anything either pass cannot resolve throws rather than being skipped. A
 * gallery that quietly omits an icon is worse than one that fails the build,
 * because the missing icon is exactly what a reader came to look for.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, '../../../packages/panelui/src/icons/index.tsx');
const OUT = path.join(HERE, '../lib/icons.generated.json');

const src = fs.readFileSync(SOURCE, 'utf8');

/** Elements the set is drawn with. Anything else is a parse failure. */
const SHAPES = ['Path', 'Circle', 'Rect', 'Line', 'Polyline', 'Ellipse'];

/** JSX attribute names that do not survive the trip to the web. */
const DROP = new Set(['width', 'height']);

/** React camelCase to the SVG attribute the browser wants. */
const ATTR = {
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeDasharray: 'stroke-dasharray',
  fillRule: 'fill-rule',
  clipRule: 'clip-rule',
  fillOpacity: 'fill-opacity',
  strokeOpacity: 'stroke-opacity',
};

/**
 * One JSX attribute value to its SVG string.
 *
 * `resolved` is the icon's own colour after the context has had its say, so it
 * is the one that becomes `currentColor`. A ternary is resolved to the branch
 * its prop takes by default — every toggle in the set defaults to off.
 */
function attrValue(raw, defaults) {
  const value = raw.trim();

  // "literal"
  if (/^['"].*['"]$/.test(value)) return value.slice(1, -1);

  // {expression}
  if (value.startsWith('{') && value.endsWith('}')) {
    const expr = value.slice(1, -1).trim();

    if (expr === 'resolved') return 'currentColor';
    if (/^-?[\d.]+$/.test(expr)) return expr;
    if (/^['"].*['"]$/.test(expr)) return expr.slice(1, -1);

    // `flag ? a : b` — every toggle prop in the set defaults to falsy.
    const ternary = expr.match(/^([A-Za-z_$][\w$]*)\s*\?\s*(.+?)\s*:\s*(.+)$/s);
    if (ternary) {
      const [, , whenTrue, whenFalse] = ternary;
      const branch = defaults[ternary[1]] ? whenTrue : whenFalse;
      return attrValue(`{${branch}}`, defaults);
    }

    // A named prop with a literal default, such as BadgeCheck's checkColor.
    if (Object.hasOwn(defaults, expr)) return String(defaults[expr]);

    throw new Error(`Cannot resolve icon attribute expression: ${expr}`);
  }

  throw new Error(`Cannot resolve icon attribute: ${raw}`);
}

/** Every `name={value}` / `name="value"` on one element. */
function parseAttrs(chunk, defaults) {
  const out = [];
  const re = /([A-Za-z_$][\w$-]*)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|'[^']*')/g;
  let match;
  while ((match = re.exec(chunk)) !== null) {
    const [, name, value] = match;
    if (DROP.has(name)) continue;
    out.push([ATTR[name] ?? name, attrValue(value, defaults)]);
  }
  return out;
}

/** Literal defaults in a component's destructured signature. */
function parseDefaults(signature) {
  const out = {};
  for (const match of signature.matchAll(
    /([A-Za-z_$][\w$]*)\s*=\s*('[^']*'|"[^"]*"|-?[\d.]+|true|false)/g
  )) {
    const [, name, raw] = match;
    if (raw === 'true') out[name] = true;
    else if (raw === 'false') out[name] = false;
    else if (/^-?[\d.]+$/.test(raw)) out[name] = Number(raw);
    else out[name] = raw.slice(1, -1);
  }
  return out;
}

const icons = [];

/**
 * The glyph each alias stands for: `import HgSearch01Icon from '…/Search01Icon'`.
 */
const aliases = new Map(
  [...src.matchAll(/^import (Hg\w+) from '@hugeicons\/core-free-icons\/(\w+)';$/gm)].map(
    (match) => [match[1], match[2]]
  )
);

/** The default weight the library draws the set at, read rather than assumed. */
const strokeDefault = Number(src.match(/^const STROKE = ([\d.]+);$/m)?.[1]);
if (!Number.isFinite(strokeDefault)) throw new Error('Cannot find the STROKE default');

/** Attribute keys carried in the glyph data that mean nothing in the markup. */
const GLYPH_DROP = new Set(['key']);

for (const match of src.matchAll(
  /^export const (\w+Icon) = icon\((Hg\w+), \{([\s\S]*?)\}\);$/gm
)) {
  const [, name, alias, options] = match;
  const glyphName = aliases.get(alias);
  if (!glyphName) throw new Error(`${name}: no import found for ${alias}`);

  const size = Number(options.match(/size:\s*(\d+)/)?.[1]);
  if (!Number.isFinite(size)) throw new Error(`${name}: no size`);
  const strokeWidth = Number(options.match(/strokeWidth:\s*([\d.]+)/)?.[1] ?? strokeDefault);

  const glyph = (
    await import(`@hugeicons/core-free-icons/${glyphName}`)
  ).default;
  if (!Array.isArray(glyph) || glyph.length === 0) {
    throw new Error(`${name}: ${glyphName} is not a glyph`);
  }

  const markup = glyph
    .map(([tag, attrs]) => {
      const pairs = Object.entries(attrs)
        .filter(([key]) => !GLYPH_DROP.has(key))
        // The library overrides the drawing's own weight; see the note on
        // weight in the icon set. Doing it here too is what keeps the gallery
        // and the app the same picture.
        .map(([key, value]) => [ATTR[key] ?? key, key === 'strokeWidth' ? strokeWidth : value])
        .map(([key, value]) => `${key}="${value}"`);
      return `<${tag.toLowerCase()} ${pairs.join(' ')} />`;
    })
    .join('');

  icons.push({
    name,
    size,
    viewBox: '0 0 24 24',
    // A fillable glyph is drawn in its resting state, which is unfilled — the
    // same rule the hand-drawn pass applies to a toggle's ternary.
    fill: 'none',
    markup,
    brand: false,
  });
}


// The four drawn by hand are the only `export function` icons left in the
// file, so this matches exactly them.
const bodies = [
  ...src.matchAll(
    /export function (\w+Icon)\s*\(([\s\S]*?)\)\s*(?::[^{]*?)?\{([\s\S]*?)\n\}/g
  ),
];

for (const match of bodies) {
  const [, name, signature, body] = match;
  const defaults = parseDefaults(signature);

  const svg = body.match(/<Svg([^>]*?)>([\s\S]*)<\/Svg>/);
  if (!svg) throw new Error(`${name}: no <Svg> element found`);

  const rootAttrs = parseAttrs(svg[1], defaults);
  const viewBox = rootAttrs.find(([key]) => key === 'viewBox')?.[1] ?? '0 0 24 24';
  const rootFill = rootAttrs.find(([key]) => key === 'fill')?.[1];

  const children = [];
  const shapeRe = new RegExp(`<(${SHAPES.join('|')})\\b([\\s\\S]*?)/>`, 'g');
  let shape;
  while ((shape = shapeRe.exec(svg[2])) !== null) {
    const [, tag, attrChunk] = shape;
    const attrs = parseAttrs(attrChunk, defaults);
    children.push(
      `<${tag.toLowerCase()} ${attrs
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ')} />`
    );
  }

  if (children.length === 0) throw new Error(`${name}: no shapes found`);

  const markup = children.join('');
  const fill = rootFill ?? 'none';

  icons.push({
    name,
    size: defaults.size ?? 16,
    viewBox,
    fill,
    markup,
    /*
     * A brand mark carries its own palette and ignores the colour context, so
     * the gallery must not claim it can be tinted — it is the one rule the set
     * does not apply evenly, and a reader should be told which icons it misses.
     *
     * Both the root and the shapes are checked, because the set puts the
     * colour in either place: a stroked glyph carries it per path, while the
     * filled status icons set it once on the <Svg> and let the paths inherit.
     * Testing only the shapes marked those three as brands, which they are not.
     */
    brand: !/currentColor/.test(fill + markup),
  });
}

// Sorted here rather than in the page: the file order is roughly the order
// they were added, which is meaningless to somebody hunting for a name.
icons.sort((a, b) => a.name.localeCompare(b.name));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(icons, null, 2)}\n`);
console.log(`icons: ${icons.length} -> lib/icons.generated.json`);
