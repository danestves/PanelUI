import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const SRC = new URL('../src/', import.meta.url);

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

/** Every `<Host …>` opening tag in a source file, attributes and all. */
function hostTags(content) {
  const tags = [];
  for (let at = content.indexOf('<Host'); at !== -1; at = content.indexOf('<Host', at + 1)) {
    // `<HostView` and the like are other components that merely start the same.
    if (/[A-Za-z]/.test(content[at + 5])) continue;
    tags.push(content.slice(at, content.indexOf('>', at) + 1));
  }
  return tags;
}

test('every SwiftUI host refuses the keyboard safe area', async () => {
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
    for (const tag of hostTags(await readFile(file, 'utf8'))) {
      checked += 1;
      assert.match(
        tag,
        /ignoreSafeArea="keyboard"/,
        `${file.pathname.split('/src/')[1]}: ${tag} must pass ignoreSafeArea="keyboard"`
      );
    }
  }

  // A test that stops finding hosts is a test that stopped testing anything.
  assert.ok(checked >= 5, `expected the library's native hosts, found ${checked}`);
});
