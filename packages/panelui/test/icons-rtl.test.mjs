import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/icons/index.tsx', import.meta.url), 'utf8');

/*
 * The only glyphs whose meaning is a horizontal direction.
 *
 * Two side chevrons, the arrow that leaves the app, and the send plane. An
 * icon that is merely asymmetric — a magnifier, a pencil, a play triangle —
 * means the same thing either way round, and mirroring it is a wrong drawing
 * rather than a translation. The vertical axis does not mirror at all, which
 * is why the up and down chevrons are not on this list.
 */
const MIRRORS = ['ArrowUpRightIcon', 'ChevronLeftIcon', 'ChevronRightIcon', 'SendIcon'];

/** Every icon declaration, as `[name, the options object's text]`. */
function declarations() {
  return [...source.matchAll(/export const (\w+Icon) = icon\(\w+, \{([^}]*)\}\);/g)];
}

function flagged() {
  return declarations()
    .filter(([, , options]) => /flip: true/.test(options))
    .map(([, name]) => name)
    .sort();
}

test('exactly the direction-meaning glyphs mirror', () => {
  assert.deepEqual(flagged(), [...MIRRORS].sort());
});

test('the vertical chevrons do not mirror', () => {
  const options = new Map(declarations().map(([, name, text]) => [name, text]));
  for (const name of ['ChevronUpIcon', 'ChevronDownIcon', 'ArrowUpIcon', 'ArrowDownIcon']) {
    assert.ok(options.has(name), `${name} is not declared`);
    assert.doesNotMatch(
      options.get(name),
      /flip: true/,
      `${name} must not mirror: the vertical axis does not`
    );
  }
});

/*
 * A mirroring icon carries a transform in both directions.
 *
 * Dropping the prop leaves the last matrix the view was given in place, so a
 * glyph mirrored once stays mirrored when the direction flips back — the
 * arrows in an app that can switch direction at runtime end up pointing at the
 * text one toggle in, and never recover. The identity branch is what stops it.
 */
test('the mirror is applied as a transform with an identity branch', () => {
  assert.match(source, /const rtl = useDirection\(\) === 'rtl';/);
  assert.match(
    source,
    /defaults\.flip\s*\?\s*\[\{ transform: \[\{ scaleX: rtl \? -1 : 1 \}\] \}, style\]\s*:\s*style/
  );
});

test('a non-mirroring icon is given no transform of its own', () => {
  // The false branch passes the caller's style straight through, so nothing
  // the library did not ask for ends up on a glyph that never turns around.
  assert.match(source, /\}\] \}, style\]\s*:\s*style\}/);
});

test('Menu leans on the icon mirroring rather than swapping the glyph', async () => {
  const menu = await readFile(
    new URL('../src/components/menu/index.tsx', import.meta.url),
    'utf8'
  );
  // The rotation is on the wrapping view and the mirror on the Svg inside it,
  // so the two compose. Picking the opposite glyph under RTL as well would
  // mirror it twice and point the chevron back at the row.
  assert.match(menu, /<Animated\.View style=\{chevronStyle\}>[\s\S]*?<ChevronRightIcon/);
  assert.doesNotMatch(menu, /const Chevron =/);
});
