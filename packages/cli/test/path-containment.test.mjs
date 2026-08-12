import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  defaultConfig,
  targetPath,
  validateConfigPaths,
  validateProjectName,
} from '../src/config.mjs';
import { create } from '../src/init.mjs';
import { CliError } from '../src/ui.mjs';

function temporaryProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-cli-path-'));
}

test('keeps valid registry destinations inside the project', () => {
  const cwd = temporaryProject();
  const config = {
    ...defaultConfig(),
    aliases: { components: '@/src/components', lib: '~/src/lib', hooks: './src/hooks' },
    css: 'src/global.css',
    theme: 'src/theme.css',
  };

  try {
    validateConfigPaths(config);
    assert.equal(
      targetPath(cwd, config, 'ui/button.tsx'),
      path.join(cwd, 'src/components/button.tsx')
    );
    assert.equal(targetPath(cwd, config, 'theme.css'), path.join(cwd, 'src/theme.css'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('rejects registry and configured paths that can escape a project', () => {
  const cwd = temporaryProject();
  const config = defaultConfig();

  try {
    for (const registryPath of [
      '/tmp/victim.ts',
      '../victim.ts',
      'ui/../../victim.ts',
      'C:\\victim.ts',
      '\\victim.ts',
      '\\\\server\\share\\victim.ts',
    ]) {
      assert.throws(() => targetPath(cwd, config, registryPath), CliError);
    }

    assert.throws(
      () => validateConfigPaths({ ...config, aliases: { components: '@/../../victim' } }),
      CliError
    );
    assert.throws(() => validateConfigPaths({ ...config, css: '..\\victim.css' }), CliError);
    assert.throws(() => validateConfigPaths({ ...config, theme: 'C:\\victim.css' }), CliError);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('rejects unsafe scaffold names before any project files are created', async () => {
  const cwd = temporaryProject();
  const victim = path.resolve(cwd, '..', 'victim');

  try {
    for (const name of ['../victim', '/victim', 'C:\\victim', '\\victim', '\\\\server\\share']) {
      await assert.rejects(create({ cwd, name, yes: true }), CliError);
    }

    assert.equal(validateProjectName('valid-app'), 'valid-app');
    assert.equal(fs.existsSync(victim), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
