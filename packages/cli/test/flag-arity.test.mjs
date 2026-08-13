import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const executables = [
  {
    name: 'panelui-cli',
    file: path.resolve(here, '../bin/panelui.mjs'),
    flags: [
      ['--cwd', '<dir>'],
      ['--registry', '<url>'],
      ['--template', '<name>'],
      ['--name', '<name>'],
      ['--theme', '<name>'],
    ],
  },
  {
    name: 'create-panelui-app',
    file: path.resolve(here, '../../create-panelui-app/index.mjs'),
    flags: [
      ['--template', '<name>'],
      ['--theme', '<name>'],
      ['--name', '<name>'],
    ],
  },
];

for (const executable of executables) {
  test(`${executable.name} rejects value flags at the end of argv`, () => {
    for (const [flag, placeholder] of executable.flags) {
      const result = spawnSync(process.execPath, [executable.file, flag], {
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
      });
      const output = `${result.stdout}${result.stderr}`;

      assert.equal(result.status, 1, `${executable.name} ${flag}`);
      assert.match(output, new RegExp(`Missing value for ${flag}\\.`));
      assert.match(output, new RegExp(`Usage: ${flag} ${placeholder.replace(/[<>]/g, '\\$&')}`));
      assert.doesNotMatch(output, /Unexpected error:/);
    }
  });

  test(`${executable.name} does not consume another flag as a value`, () => {
    const [flag, placeholder] = executable.flags[0];
    const result = spawnSync(process.execPath, [executable.file, flag, '--help'], {
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    const output = `${result.stdout}${result.stderr}`;

    assert.equal(result.status, 1);
    assert.match(output, new RegExp(`Usage: ${flag} ${placeholder.replace(/[<>]/g, '\\$&')}`));
  });
}
