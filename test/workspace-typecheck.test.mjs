import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TSC = join(ROOT, 'node_modules', '.bin', 'tsc');

async function write(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

function typecheck(root) {
  try {
    execFileSync(TSC, ['--project', 'apps/example/tsconfig.json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { ok: true, output: '' };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}`,
    };
  }
}

test('workspace typecheck ignores missing and stale publish declarations', async () => {
  const exampleConfig = JSON.parse(
    await readFile(join(ROOT, 'apps/example/tsconfig.json'), 'utf8'),
  );
  const paths = exampleConfig.compilerOptions?.paths;
  assert.deepEqual(exampleConfig.compilerOptions?.types, ['expo/types']);
  assert.deepEqual(paths?.['panelui-native'], [
    '../../packages/panelui/src/index.ts',
  ]);

  const fixture = await mkdtemp(join(tmpdir(), 'panelui-workspace-types-'));
  try {
    await write(
      join(fixture, 'packages/panelui/src/index.ts'),
      'export interface CurrentApi { current: true }\n',
    );
    await write(
      join(fixture, 'node_modules/panelui-native/package.json'),
      JSON.stringify({
        name: 'panelui-native',
        exports: {
          '.': {
            types: './lib/index.d.ts',
            'react-native': './src/index.ts',
          },
        },
      }),
    );
    await write(
      join(fixture, 'node_modules/panelui-native/src/index.ts'),
      'export interface CurrentApi { current: true }\n',
    );
    await write(
      join(fixture, 'apps/example/index.ts'),
      "import type { CurrentApi } from 'panelui-native';\n" +
        'const value: CurrentApi = { current: true };\nvoid value;\n',
    );

    const config = {
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        paths,
      },
      include: ['index.ts'],
    };
    await write(
      join(fixture, 'apps/example/tsconfig.json'),
      JSON.stringify(config),
    );

    assert.equal(typecheck(fixture).ok, true, 'missing lib must use source');

    await write(
      join(fixture, 'node_modules/panelui-native/lib/index.d.ts'),
      'export interface PreviousApi { previous: true }\n',
    );
    assert.equal(typecheck(fixture).ok, true, 'stale lib must not shadow source');

    delete config.compilerOptions.paths;
    await write(
      join(fixture, 'apps/example/tsconfig.json'),
      JSON.stringify(config),
    );
    const control = typecheck(fixture);
    assert.equal(control.ok, false, 'fixture must reproduce stale-lib failure');
    assert.match(control.output, /CurrentApi/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
