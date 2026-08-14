import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

test('component and hook subpaths cover every public source module', async () => {
  assert.deepEqual(json.exports['./components/*'], {
    types: './lib/typescript/src/components/*/index.d.ts',
    'react-native': './src/components/*/index.tsx',
    default: './lib/module/components/*/index.js',
  });
  assert.deepEqual(json.exports['./hooks/*'], {
    types: './lib/typescript/src/hooks/*.d.ts',
    'react-native': './src/hooks/*.ts',
    default: './lib/module/hooks/*.js',
  });

  const componentNames = (await readdir(resolve(root, 'src/components'), {
    withFileTypes: true,
  }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const rootBarrel = await readFile(resolve(root, 'src/index.ts'), 'utf8');
  for (const name of componentNames) {
    assert.match(rootBarrel, new RegExp(`from './components/${name}'`), name);
  }

  // A hook is a `use-` module. Anything else in the folder supports one —
  // `breakpoint-contract` is the type the breakpoint hook is configured with —
  // and is reached through the hook that uses it, not on its own.
  const hookNames = (await readdir(resolve(root, 'src/hooks')))
    .filter((name) => name.startsWith('use-') && name.endsWith('.ts'))
    .map((name) => name.slice(0, -3))
    .sort();
  const hookBarrel = await readFile(resolve(root, 'src/hooks/index.ts'), 'utf8');
  for (const name of hookNames) {
    if (name === 'use-direction') {
      assert.match(rootBarrel, /from '.\/components\/direction'/, name);
    } else {
      assert.match(hookBarrel, new RegExp(`from './${name}'`), name);
    }
  }
});

test('only root-public utilities receive subpaths', () => {
  const utilityNames = Object.keys(json.exports)
    .filter((key) => key.startsWith('./utils/'))
    .map((key) => key.slice('./utils/'.length))
    .sort();
  assert.deepEqual(utilityNames, ['cn', 'color', 'time']);

  for (const name of utilityNames) {
    assert.deepEqual(json.exports[`./utils/${name}`], {
      types: `./lib/typescript/src/utils/${name}.d.ts`,
      'react-native': `./src/utils/${name}.ts`,
      default: `./lib/module/utils/${name}.js`,
    });
  }
});
