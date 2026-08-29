/**
 * The pinned versions are the ones the Expo Go client was built against.
 *
 * `overrides` in the root package.json forces one copy of every package that
 * reaches the native bundle. Which version it forces is not a free choice:
 * Expo Go is a prebuilt binary whose native side is compiled against exact
 * versions, and JavaScript from a different one is handed to native code that
 * does not match it. There is no error for this. It is a segmentation fault on
 * the JavaScript thread — a JSI value read in a layout the native side does not
 * agree with — so nothing reaches LogBox and nothing reaches the Metro
 * terminal, and the app simply closes.
 *
 * **Two files have been mistaken for the authority on this, and both are the
 * wrong question.**
 *
 * - `expo/bundledNativeModules.json` says what a *development build* would
 *   compile with the installed `expo` package. `expo install --check` reads it,
 *   which is why that check agrees with a pin that breaks every Expo Go launch.
 * - `templates/expo-app` is a starter project this repository hands somebody.
 *   That its numbers usually run in Expo Go is a consequence, not a promise,
 *   and pinning to it once put `react-native` on 0.86.2 when the client
 *   contains 0.86.3.
 *
 * The authority is Expo's own version manifest, recorded in
 * `test/expo-go-client.json` by `scripts/expo-client-versions.mjs`. That is
 * what `expo.dev/go` and `eas go` build from.
 *
 * **The client is a build, and it has a date.** A simulator gets whatever
 * `expo start --go` fetches today; a physical iPhone keeps whichever client was
 * installed on it, and for SDK 55 and later that is a `sign.expo.dev` or
 * `eas go` build that ages in place. Nothing here can see that, so a tree that
 * passes every check below still fails on a device whose client is months
 * behind — which is the other half of the same mistake, and belongs to the
 * Troubleshooting page rather than to a test.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const REPO_ROOT = new URL('../', import.meta.url);

const read = async (path) => JSON.parse(await readFile(new URL(path, REPO_ROOT), 'utf8'));

const root = await read('package.json');
const example = await read('apps/example/package.json');
const client = await read('test/expo-go-client.json');
const templates = {
  'templates/expo-app': (await read('templates/expo-app/package.json')).dependencies,
  'templates/expo-starter': (await read('templates/expo-starter/package.json')).dependencies,
};

/** `~5.7.0` and `5.7.0` are the same answer to "which version". */
const bare = (version) => version.replace(/^[~^]/, '');

const REFRESH =
  'Run `node scripts/expo-client-versions.mjs` to see whether the client has moved, ' +
  'then `--update` to record it.';

/**
 * Deleting the lockfile is not enough on its own, and this is the sentence that
 * gets skipped: npm reuses whatever already satisfies a slot in `node_modules`,
 * so an install on top of the old tree can leave the hoisted copy behind while
 * a workspace gets the new one. That is two copies, from the documented fix for
 * having two copies.
 */
const REINSTALL =
  'Then `rm -rf node_modules apps/*/node_modules packages/*/node_modules package-lock.json` ' +
  'and reinstall — npm reuses both a stale lockfile and a stale tree rather than re-resolving ' +
  'when only the overrides change.';

test('every override is an exact version', () => {
  for (const [name, pinned] of Object.entries(root.overrides ?? {})) {
    // A range lets npm resolve two versions that both satisfy it, which is the
    // whole thing an override is here to prevent.
    assert.equal(pinned, bare(pinned), `${name} must be pinned exactly, not as a range`);
  }
});

test('react and react-native match the Expo Go client', () => {
  const wrong = [];
  const expected = {
    react: client.client.react,
    'react-native': client.client.reactNative,
  };

  for (const [name, version] of Object.entries(expected)) {
    const pinned = root.overrides?.[name];
    if (pinned !== version) {
      wrong.push(`${name}: pinned ${pinned}, Expo Go ${client.client.ios} contains ${version}`);
    }
  }

  assert.deepEqual(
    wrong,
    [],
    `The overrides disagree with the Expo Go client for SDK ${client.sdk}:\n` +
      `${wrong.join('\n')}\n\n${REFRESH}\n${REINSTALL}`
  );
});

test('the example and the templates declare what the overrides force', () => {
  const wrong = [];
  const manifests = { 'apps/example': example.dependencies, ...templates };

  for (const [where, dependencies] of Object.entries(manifests)) {
    for (const [name, pinned] of Object.entries(root.overrides ?? {})) {
      const declared = dependencies[name];
      if (!declared) continue;
      if (bare(declared) !== pinned) wrong.push(`${where} ${name}: declares ${declared}, pinned to ${pinned}`);
    }
  }

  // An override silently outranks a declaration, so a disagreement here is a
  // manifest that lies about what the app is actually built against — and it is
  // invisible to `expo install --check`, which only reads the declaration.
  // The templates carry no override at all: what they declare is what somebody
  // starting an app installs.
  assert.deepEqual(wrong, [], `Declared versions disagree with the overrides:\n${wrong.join('\n')}`);
});

test('the JSI bridge has not moved underneath the client', () => {
  const wrong = [];

  /*
   * Resolved versions, not declared ranges. `expo` and `expo-modules-core` are
   * declared as `~57.0.x` and every `expo-*` module talks to native through
   * them, so a regenerated lockfile walks them forward on its own and no diff
   * shows it. That is how `expo-modules-core` moved from 57.0.6 to 57.0.14
   * inside a commit about de-duplicating four unrelated packages.
   */
  for (const [name, recorded] of Object.entries(client.resolved)) {
    let installed;
    try {
      installed = require(`${name}/package.json`).version;
    } catch {
      continue;
    }
    if (installed !== recorded) wrong.push(`${name}: installed ${installed}, recorded ${recorded}`);
  }

  assert.deepEqual(
    wrong,
    [],
    `Installed versions have drifted from test/expo-go-client.json:\n${wrong.join('\n')}\n\n` +
      'If this followed an intentional upgrade, record it and check the device still boots. ' +
      `If it followed an ordinary install, that is the drift this test exists to catch.\n${REFRESH}`
  );
});
