#!/usr/bin/env node
/**
 * Refresh the record of what the Expo Go client contains.
 *
 * The pinned versions are not a free choice and they are not the newest ones
 * either. Expo Go is a prebuilt binary whose native side is compiled against
 * exact versions, and JavaScript from a different one is handed to native code
 * that does not match it — which is a segmentation fault on the JavaScript
 * thread, with nothing on the screen and nothing in the terminal.
 *
 * The authority on what is inside that binary is Expo's own version manifest,
 * which is what `expo.dev/go` and `eas go` build from. Not
 * `expo/bundledNativeModules.json`, which answers a different question — what a
 * *development build* would compile with the installed `expo` package — and not
 * `templates/expo-app`, which is a starter project rather than a statement
 * about any client. Both have been mistaken for it, and both were wrong.
 *
 * Tests must not reach the network, so this writes the answer down and
 * `test/sdk-version-parity.test.mjs` reads the file. Refreshing it is then a
 * commit somebody looked at, rather than something an install did quietly.
 *
 *     node scripts/expo-client-versions.mjs            # report drift, exit 1
 *     node scripts/expo-client-versions.mjs --update   # rewrite the snapshot
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO_ROOT = new URL('../', import.meta.url);
const SNAPSHOT = new URL('test/expo-go-client.json', REPO_ROOT);
const MANIFEST = 'https://api.expo.dev/v2/versions/latest';

/**
 * The packages whose *resolved* version is recorded, rather than the range they
 * are declared with.
 *
 * `expo` and `expo-modules-core` are the JSI bridge every `expo-*` module talks
 * through, and they are declared as `~57.0.x` ranges — so a regenerated
 * lockfile walks them forward on its own, with nothing to see in any diff. That
 * is how `expo-modules-core` went from 57.0.6 to 57.0.14 in a commit about
 * de-duplicating four other packages.
 */
const RESOLVED = ['expo', 'expo-modules-core'];

/** `~57.0.7` and `57.0.18` are both the 57 SDK; the manifest is keyed `57.0.0`. */
function sdkKey(range) {
  const major = range.replace(/^[~^]/, '').split('.')[0];
  return `${major}.0.0`;
}

async function currentState() {
  const example = JSON.parse(
    await readFile(new URL('apps/example/package.json', REPO_ROOT), 'utf8')
  );
  const sdk = sdkKey(example.dependencies.expo);

  const response = await fetch(MANIFEST);
  if (!response.ok) throw new Error(`${MANIFEST} returned ${response.status}`);

  const { data } = await response.json();
  const entry = data?.sdkVersions?.[sdk];
  if (!entry) throw new Error(`The manifest has no entry for SDK ${sdk}`);

  const resolved = {};
  for (const name of RESOLVED) resolved[name] = require(`${name}/package.json`).version;

  return {
    sdk,
    client: {
      ios: entry.iosClientVersion,
      android: entry.androidClientVersion,
      reactNative: entry.facebookReactNativeVersion,
      react: entry.facebookReactVersion,
    },
    resolved,
  };
}

const state = await currentState();
const serialised = `${JSON.stringify(state, null, 2)}\n`;

if (process.argv.includes('--update')) {
  await writeFile(SNAPSHOT, serialised);
  console.log(`Expo Go ${state.client.ios} for SDK ${state.sdk}:`);
  console.log(`  react-native ${state.client.reactNative}, react ${state.client.react}`);
  for (const [name, version] of Object.entries(state.resolved)) {
    console.log(`  ${name} ${version} (resolved)`);
  }
  process.exit(0);
}

const recorded = await readFile(SNAPSHOT, 'utf8').catch(() => null);
if (recorded === serialised) {
  console.log(`test/expo-go-client.json is current: Expo Go ${state.client.ios}.`);
  process.exit(0);
}

console.error('test/expo-go-client.json no longer describes the client or the tree.\n');
console.error(`recorded:\n${recorded ?? '(missing)'}`);
console.error(`current:\n${serialised}`);
console.error(
  'Run `node scripts/expo-client-versions.mjs --update` and read the diff before committing it:\n' +
    'a change to `client` means Expo Go moved and the pins must follow, while a change to\n' +
    '`resolved` means an install moved the JSI bridge underneath a client that did not move.'
);
process.exit(1);
