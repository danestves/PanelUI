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
  assert.match(source, /transform: \[\{ scaleX: rtl \? -1 : 1 \}\]/);
});

/*
 * And it is applied by a view, not handed to the drawing component.
 *
 * `@hugeicons/react-native` destructures `style` out of its props and never
 * puts it back; the interop layer that would otherwise have carried it is a
 * package this library does not use. So a transform passed to it as a style is
 * discarded in silence — every other prop on the same element still arrives,
 * which is why it went unnoticed for a release. A plain view cannot lose it.
 */
test('the mirror sits on a view rather than on the drawing component', () => {
  assert.match(
    source,
    /<View style=\{\[\{ transform: \[\{ scaleX: rtl \? -1 : 1 \}\] \}, style\]\}>\{drawing\}<\/View>/
  );
  const element = source.match(/<HugeiconsIcon[\s\S]*?\/>/);
  assert.ok(element, 'the factory draws through HugeiconsIcon');
  assert.doesNotMatch(element[0], /transform:/);
});

test('a non-mirroring icon is given no wrapper of its own', () => {
  // It returns the glyph itself, so nothing the library did not ask for ends
  // up in the tree around an icon that never turns around.
  assert.match(source, /if \(!defaults\.flip\) return drawing;/);
  assert.match(source, /style=\{defaults\.flip \? undefined : style\}/);
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
