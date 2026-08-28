import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const SRC = new URL('../src/', import.meta.url);

/** The one file allowed to render the toolkit's `Host` directly. */
const WRAPPER = 'native/native-host.tsx';

/** Every `.tsx` under `src/`, so a new component cannot opt out by being new. */
async function sources(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const at = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) found.push(...(await sources(at)));
    else if (entry.name.endsWith('.tsx')) found.push(at);
  }
  return found;
}

/** Every opening tag for `name` in a source file, attributes and all. */
function openingTags(content, name) {
  const open = `<${name}`;
  const tags = [];
  for (let at = content.indexOf(open); at !== -1; at = content.indexOf(open, at + 1)) {
    // `<HostView` and the like are other components that merely start the same.
    if (/[A-Za-z]/.test(content[at + open.length])) continue;
    tags.push(content.slice(at, content.indexOf('>', at) + 1));
  }
  return tags;
}

function relative(file) {
  return file.pathname.split('/src/')[1];
}

test('every native host refuses the keyboard safe area', async () => {
  /*
   * A host is a hosting controller, and a hosting controller insets its
   * content for the keyboard unless told not to. React Native owns the layout
   * of everything here, so a control docked above the keyboard gets its
   * content moved *inside* the box React Native gave it — over whatever is
   * above it — while React Native's own layout says nothing has moved.
   *
   * That is what put the composer's buttons on its text, it survived three
   * fixes aimed at the layout, and nothing in a React Native tree can show it.
   * So it is asserted here instead: a new native control that forgets this
   * fails the build rather than shipping and being rediscovered.
   */
  const files = await sources(SRC);
  assert.ok(files.length > 0, 'no sources found to check');

  let checked = 0;
  for (const file of files) {
    for (const tag of openingTags(await readFile(file, 'utf8'), 'NativeHost')) {
      checked += 1;
      assert.match(
        tag,
        /ignoreSafeArea="keyboard"/,
        `${relative(file)}: ${tag} must pass ignoreSafeArea="keyboard"`
      );
    }
  }

  // A test that stops finding hosts is a test that stopped testing anything.
  assert.ok(checked >= 5, `expected the library's native hosts, found ${checked}`);
});

test('the toolkit host is only ever reached through NativeHost', async () => {
  /*
   * `NativeHost` is where the app's theme is handed to the platform as
   * `colorScheme`, and it is the only signal the toolkit accepts. A control
   * that renders `Host` itself resolves its appearance from the *system*
   * instead — which is a different question, whose answer does not change when
   * the theme does, and which looks exactly like the theme working until
   * somebody runs a dark app on a light phone.
   *
   * There is no way to see that from a React Native tree either, so the rule
   * is asserted rather than remembered.
   */
  const files = await sources(SRC);

  const offenders = [];
  let wrapperTags = 0;

  for (const file of files) {
    const tags = openingTags(await readFile(file, 'utf8'), 'Host');
    if (!tags.length) continue;
    if (relative(file) === WRAPPER) {
      wrapperTags = tags.length;
      for (const tag of tags) {
        assert.match(
          tag,
          /colorScheme=\{mode\}/,
          `${WRAPPER}: ${tag} must pass the resolved theme mode as colorScheme`
        );
        assert.match(
          tag,
          /\{\.\.\.props\}/,
          `${WRAPPER}: ${tag} must forward the rest of its props, ignoreSafeArea included`
        );
      }
      continue;
    }
    offenders.push(`${relative(file)}: ${tags.join(', ')}`);
  }

  assert.deepEqual(
    offenders,
    [],
    `these render the toolkit host directly instead of <NativeHost host={Host} …>:\n  ${offenders.join('\n  ')}`
  );
  assert.equal(wrapperTags, 1, `expected exactly one host in ${WRAPPER}, found ${wrapperTags}`);
});

test('a native host never hands over an axis whose size we already know', async () => {
  /*
   * `matchContents` is not a one-off measurement. The axis it is given is
   * written back into the layout on every platform geometry change, and the
   * layout is dirtied each time — so a control that lays itself out again
   * under a press moves its own box, and everything below it moves with it.
   *
   * Three fixes went at this from the other end before the mechanism was read
   * out of the platform source, so the rule is pinned here rather than left in
   * a comment: where the height is a number we can state, it is stated, and
   * only what is genuinely the platform's is matched.
   *
   * The exceptions are listed rather than assumed. A picker's height is a menu
   * or a rotor and only the platform knows which; a popover's host wraps a
   * trigger we did not draw; the sheet is positioned absolutely, so a size it
   * writes cannot move anything else.
   */
  const stateTheHeight = [
    'components/button/index.tsx',
    'components/switch/index.tsx',
    'components/slider/index.tsx',
  ];

  for (const file of stateTheHeight) {
    const content = await readFile(new URL(file, SRC), 'utf8');
    const tags = openingTags(content, 'NativeHost');
    assert.ok(tags.length > 0, `${file}: expected a native host`);

    for (const tag of tags) {
      assert.doesNotMatch(
        tag,
        /matchContents(\s|>)|matchContents=\{true\}|vertical:\s*true/,
        `${file}: ${tag} hands the vertical axis to the platform — state the height instead`
      );
      assert.match(
        tag,
        /style=\{/,
        `${file}: ${tag} must state its own box, or the platform's writeback owns it`
      );
    }
  }
});
