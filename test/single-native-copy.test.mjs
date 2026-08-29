/**
 * One copy of every package that ends up in the native bundle.
 *
 * Metro resolves from the requesting file upward, and `packages/panelui` has no
 * `node_modules` of its own — so the library's source reaches the hoisted copy
 * at the repository root while an app with its own nested pin reaches that one
 * instead. Both then go into a single bundle.
 *
 * That is not a warning anywhere. Reanimated aborts on a second instance during
 * module init, before the LogBox exists, so the app closes with nothing in the
 * terminal and nothing in the Metro log; two copies of React break every
 * context and every hook. The versions are held to one each by `overrides` in
 * the root package.json, and this is what says so out loud when a new
 * dependency or a regenerated lockfile quietly undoes it.
 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The packages that must be singular. Every one of them either ships native
 * code, installs a runtime, or holds module-level state that a second copy
 * silently forks.
 */
const SINGULAR = [
  'react',
  'react-dom',
  'react-native',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-svg',
  'react-native-worklets',
];

/**
 * The roots whose `node_modules` share one Metro graph: the workspace itself.
 *
 * `templates/` is deliberately not among them. Those are standalone projects a
 * user installs on their own machine, with their own lockfiles and their own
 * SDK pins; a copy under one of them never reaches this repository's bundle,
 * and folding them in here would make the check fail for everybody who has ever
 * run the template preview.
 */
const WORKSPACE_ROOTS = ['.', 'apps', 'packages'];

/** Every `node_modules` directory inside the workspace, nested ones included. */
async function nodeModulesDirectories() {
  const found = [];

  async function descend(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Only scoped directories hold packages; everything else inside
      // node_modules is a package, and packages do not nest except through
      // their own node_modules, which is caught below.
      if (entry.name.startsWith('.')) continue;

      const path = resolve(directory, entry.name);
      if (entry.name === 'node_modules') {
        found.push(path);
        await descend(path);
      } else if (directory.includes(`${sep}node_modules`)) {
        // Inside node_modules, descend only far enough to reach a package's
        // own nested node_modules.
        await descend(path);
      }
    }
  }

  for (const root of WORKSPACE_ROOTS) {
    const base = resolve(REPO_ROOT, root);
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules') {
        const path = resolve(base, entry.name);
        found.push(path);
        await descend(path);
      } else if (root !== '.') {
        // apps/<name> and packages/<name>
        const workspace = resolve(base, entry.name, 'node_modules');
        try {
          await readdir(workspace);
          found.push(workspace);
          await descend(workspace);
        } catch {
          // No nested node_modules, which is the state this test wants.
        }
      }
    }
  }

  return found;
}

async function versionAt(path) {
  try {
    return JSON.parse(await readFile(resolve(path, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

test('every package that reaches the native bundle resolves to one version', async () => {
  const directories = await nodeModulesDirectories(REPO_ROOT);
  assert.ok(directories.length > 0, 'no node_modules found; run npm install first');

  const problems = [];

  for (const name of SINGULAR) {
    const copies = [];
    for (const directory of directories) {
      const path = resolve(directory, name);
      const version = await versionAt(path);
      if (version !== null) copies.push({ path: relative(REPO_ROOT, path), version });
    }

    const versions = new Set(copies.map((copy) => copy.version));
    if (versions.size > 1) {
      problems.push(
        `${name} resolves to ${versions.size} versions:\n` +
          copies.map((copy) => `    ${copy.version}  ${copy.path}`).join('\n')
      );
    }
  }

  assert.deepEqual(
    problems,
    [],
    'More than one copy of a package that ends up in the native bundle:\n\n' +
      `${problems.join('\n\n')}\n\n` +
      'Pin it in "overrides" in the root package.json, delete package-lock.json ' +
      'and reinstall — npm reuses a stale lockfile rather than re-resolving when ' +
      'only the overrides change.'
  );
});
