/**
 * The pinned versions are the SDK's versions, and nobody gets to copy them by
 * hand.
 *
 * `overrides` in the root package.json is what forces one copy of every package
 * that reaches the native bundle. Which version it forces is not a free choice:
 * Expo Go is a prebuilt binary whose native side is built against exact
 * versions, so JavaScript from a different one is handed to native code that
 * does not match it. For most packages that is a broken feature. For
 * `react-native-worklets` and `react-native-reanimated` it is fatal and silent
 * — they install a runtime before the LogBox exists, so the process goes down
 * with nothing in the terminal and nothing on the screen.
 *
 * This has already happened once, from pinning against a copy of `expo` that a
 * later install replaced. So the versions are checked against
 * `expo/bundledNativeModules.json` — the same file `expo install --check`
 * reads — rather than trusted.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { satisfies } from 'semver';
import test from 'node:test';

const require = createRequire(import.meta.url);
const REPO_ROOT = new URL('../', import.meta.url);

const root = JSON.parse(await readFile(new URL('package.json', REPO_ROOT), 'utf8'));
const example = JSON.parse(
  await readFile(new URL('apps/example/package.json', REPO_ROOT), 'utf8')
);

let sdk;
try {
  sdk = require('expo/bundledNativeModules.json');
} catch {
  sdk = null;
}

/** `~5.7.0` and `5.7.0` are the same answer to "which version". */
const bare = (version) => version.replace(/^[~^]/, '');

test('the root overrides match the Expo SDK', { skip: sdk ? false : 'expo not installed' }, () => {
  const wrong = [];

  for (const [name, pinned] of Object.entries(root.overrides ?? {})) {
    const expected = sdk[name];
    if (!expected) continue;
    if (bare(pinned) !== bare(expected)) {
      wrong.push(`${name}: pinned ${pinned}, SDK expects ${expected}`);
    }
    // A range would let npm resolve two versions that both satisfy it, which is
    // the whole thing an override is here to prevent.
    assert.equal(pinned, bare(pinned), `${name} must be pinned exactly, not as a range`);
  }

  assert.deepEqual(
    wrong,
    [],
    'Pinned versions disagree with the installed Expo SDK:\n' +
      `${wrong.join('\n')}\n\n` +
      'Take the SDK\'s answer from node_modules/expo/bundledNativeModules.json, ' +
      'then delete package-lock.json and reinstall — npm reuses a stale lockfile ' +
      'rather than re-resolving when only the overrides change.'
  );
});

test('every installed native package satisfies the SDK', { skip: sdk ? false : 'expo not installed' }, () => {
  const wrong = [];

  /*
   * The installed version, not the declared range. `~57.0.7` resolving to
   * 57.0.14 is fine and is what `expo install --check` accepts; what it refuses
   * — and what breaks Expo Go — is a version outside the range the SDK names.
   */
  for (const name of Object.keys(example.dependencies)) {
    const expected = sdk[name];
    if (!expected) continue;

    let installed;
    try {
      installed = require(`${name}/package.json`).version;
    } catch {
      continue;
    }

    if (!satisfies(installed, expected)) {
      wrong.push(`${name}: installed ${installed}, SDK expects ${expected}`);
    }
  }

  assert.deepEqual(
    wrong,
    [],
    'Installed versions are outside what the Expo SDK expects — this is what ' +
      `\`npx expo install --check\` reports:\n${wrong.join('\n')}`
  );
});
