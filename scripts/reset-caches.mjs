/**
 * Delete every cache that outlives a change to the dependency tree.
 *
 * Metro's transform cache and its resolution map are keyed on file contents and
 * paths, not on the versions of the Babel plugins that produced them or on
 * where a package was resolved from last time. So moving a package — a
 * reinstall that hoists it, a version pin that changes, a nested
 * `node_modules` that goes away — leaves a cache describing a tree that no
 * longer exists. What comes out is not a stale build but two errors that look
 * like something else entirely:
 *
 *   Unable to resolve "react-native-safe-area-context" from expo-router
 *   [Worklets] Mismatch between JavaScript code version and Worklets Babel
 *   plugin version (0.10.1 vs. 0.10.0)
 *
 * The first is a path cached from before the package moved; the second is
 * transformed output stamped by the plugin version that was installed when it
 * was cached. Neither says "cache" anywhere in it.
 *
 * This used to be a shell one-liner in package.json, which meant it did nothing
 * at all on Windows — `rm -rf` is not a command there and `$TMPDIR` is not a
 * variable — and Windows is where the recovery is most needed, because that is
 * where nobody can fall back to the shell equivalent.
 */
import { rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Caches that live in the repository. */
const IN_REPO = [
  'apps/example/.expo',
  'apps/example/node_modules/.cache',
  'apps/docs/.next',
  'node_modules/.cache',
];

/** Metro and Jest leave these in the system temp directory, one per project. */
const TEMP_PREFIXES = ['metro-', 'haste-map-'];

let removed = 0;

for (const relative of IN_REPO) {
  const path = join(REPO_ROOT, relative);
  try {
    await rm(path, { recursive: true, force: true });
    removed += 1;
  } catch {
    // Never existed, or is held open by a running dev server. Neither is worth
    // failing a cleanup over.
  }
}

const temp = tmpdir();
let entries = [];
try {
  entries = await readdir(temp);
} catch {
  entries = [];
}

for (const entry of entries) {
  if (!TEMP_PREFIXES.some((prefix) => entry.startsWith(prefix))) continue;
  try {
    await rm(join(temp, entry), { recursive: true, force: true });
    removed += 1;
  } catch {
    // Another project's dev server is using it.
  }
}

console.log(`caches cleared (${removed} locations)`);
console.log('The next start still needs --clear: `npm run example:go:clear`.');
