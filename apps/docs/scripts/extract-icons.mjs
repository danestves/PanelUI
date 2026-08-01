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
 * So the paths are extracted at build time and re-emitted as plain SVG. The
 * transform is small because the source is regular:
 *
 *   - `width`/`height` are dropped; the gallery sizes each icon itself.
 *   - `stroke={resolved}` and `fill={resolved}` become `currentColor`, which
 *     is how the same "inherit the surrounding colour" rule is spelled on the
 *     web. A brand mark's literal hexes are left alone, which is what keeps
 *     Google's four colours.
 *   - A prop-driven ternary resolves to its default branch, so a toggle icon
 *     shows its resting state.
 *   - `{...props}` and `{...flip}` are dropped: one is the caller's, and the
 *     other is a right-to-left mirror that has no meaning in a specimen sheet.
 *
 * Anything it cannot parse throws rather than being skipped. A gallery that
 * quietly omits an icon is worse than one that fails the build, because the
 * missing icon is exactly what a reader came to look for.
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

// Each icon is one exported function up to the next one, which is enough of a
// boundary because the file is a flat list of them.
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
