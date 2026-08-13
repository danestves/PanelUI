import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const source = new URL('../src/', import.meta.url);
const rootLucideImport =
  /\bfrom\s+['"]lucide-react-native['"]|^\s*import\s+['"]lucide-react-native['"]|\b(?:import|require)\(\s*['"]lucide-react-native['"]\s*\)/m;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
    })
  );
  return files.flat();
}

test('library icons do not import the lucide-react-native root', async () => {
  const offenders = [];

  for (const file of await sourceFiles(source)) {
    if (rootLucideImport.test(await readFile(file, 'utf8'))) {
      offenders.push(file.pathname.slice(source.pathname.length));
    }
  }

  assert.deepEqual(offenders, []);
});
