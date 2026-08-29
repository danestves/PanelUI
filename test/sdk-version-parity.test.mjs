/**
 * The pinned versions are the ones Expo Go was built against.
 *
 * `overrides` in the root package.json forces one copy of every package that
 * reaches the native bundle. Which version it forces is not a free choice, and
 * it is not the newest one either: Expo Go is a prebuilt binary whose native
 * side is compiled against exact versions, and JavaScript from a different one
 * is handed to native code that does not match it. `react-native` itself is the
 * worst case — a mismatch there is a black screen or a crash on launch, with
 * nothing to read.
 *
 * **`expo/bundledNativeModules.json` is not that answer.** It says what a
 * *development build* using the installed `expo` package would compile, and the
 * two drift: at the time of writing it names react-native 0.86.3 while the
 * current Expo Go client contains 0.86.2. Pinning to it broke every Expo Go
 * launch, which is the mistake this file exists to stop repeating.
 *
 * The answer is `templates/expo-app`. Those are the versions this repository
 * ships to people starting an app, they are already held in step with
 * `templates/expo-starter` by `scripts/template-parity.mjs`, and they are
 * chosen to run in Expo Go. If Expo Go moves, the templates move first and
 * everything here follows.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const REPO_ROOT = new URL('../', import.meta.url);

const read = async (path) => JSON.parse(await readFile(new URL(path, REPO_ROOT), 'utf8'));

const root = await read('package.json');
const example = await read('apps/example/package.json');
const template = (await read('templates/expo-app/package.json')).dependencies;

/** `~5.7.0` and `5.7.0` are the same answer to "which version". */
const bare = (version) => version.replace(/^[~^]/, '');

test('every override is an exact version', () => {
  for (const [name, pinned] of Object.entries(root.overrides ?? {})) {
    // A range lets npm resolve two versions that both satisfy it, which is the
    // whole thing an override is here to prevent.
    assert.equal(pinned, bare(pinned), `${name} must be pinned exactly, not as a range`);
  }
});

test('the overrides match the versions the templates ship', () => {
  const wrong = [];

  for (const [name, pinned] of Object.entries(root.overrides ?? {})) {
    const expected = template[name];
    if (!expected) continue;
    if (pinned !== bare(expected)) {
      wrong.push(`${name}: pinned ${pinned}, templates ship ${expected}`);
    }
  }

  assert.deepEqual(
    wrong,
    [],
    'Pinned versions disagree with templates/expo-app:\n' +
      `${wrong.join('\n')}\n\n` +
      'The templates are the versions that run in Expo Go. Change them first if ' +
      'Expo Go has moved, then match them here, then delete package-lock.json and ' +
      'reinstall — npm reuses a stale lockfile rather than re-resolving when only ' +
      'the overrides change.'
  );
});

test('the example declares the same versions it is pinned to', () => {
  const wrong = [];

  for (const [name, pinned] of Object.entries(root.overrides ?? {})) {
    const declared = example.dependencies[name];
    if (!declared) continue;
    if (bare(declared) !== pinned) {
      wrong.push(`${name}: declares ${declared}, pinned to ${pinned}`);
    }
  }

  // An override silently outranks a declaration, so a disagreement here is a
  // manifest that lies about what the app is actually built against — and it is
  // invisible to `expo install --check`, which only reads the declaration.
  assert.deepEqual(wrong, [], `apps/example disagrees with the overrides:\n${wrong.join('\n')}`);
});
