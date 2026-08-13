import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..');
const IGNORED_DIRECTORIES = new Set([
  '.codegraph', '.git', '.next', '.expo', 'coverage', 'lib', 'node_modules',
]);
const TEST_FILE = /(?:^|\/)test\/[^/]+\.test\.mjs$/;
const FOCUSED_TEST = /\b(?:test|it|describe)\.only\s*\(/;

export async function discoverContractTests(root = REPO_ROOT) {
  const found = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await visit(resolve(directory, entry.name));
        }
        return;
      }
      const path = resolve(directory, entry.name);
      const local = relative(root, path).replaceAll('\\', '/');
      if (TEST_FILE.test(local)) found.push(local);
    }));
  }

  await visit(root);
  return found.sort();
}

export async function findFocusedTests(files, root = REPO_ROOT) {
  const focused = [];
  for (const file of files) {
    if (FOCUSED_TEST.test(await readFile(resolve(root, file), 'utf8'))) {
      focused.push(file);
    }
  }
  return focused;
}

export async function runContractTests(root = REPO_ROOT) {
  const files = await discoverContractTests(root);
  if (files.length === 0) throw new Error('No contract tests found; discovery is broken.');

  const focused = await findFocusedTests(files, root);
  if (focused.length > 0) {
    throw new Error(`Focused tests are not allowed:\n${focused.join('\n')}`);
  }

  console.log(`Running ${files.length} contract test files:`);
  console.log(files.join('\n'));
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--test', ...files],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Contract tests exited with status ${result.status ?? 'unknown'}.`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runContractTests().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
