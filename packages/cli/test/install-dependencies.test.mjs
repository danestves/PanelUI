import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-cli-install-failure-'));
after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

const here = path.dirname(fileURLToPath(import.meta.url));
/*
 * The templates as they are in this checkout. Without this the scaffold falls
 * back to cloning the repository, so a test of a local code path would need
 * the network and would build its project from whatever is on main rather
 * than from the branch under test.
 */
const templates = path.resolve(here, '../../../templates');

test('init exits without readiness output when dependency installation fails', { skip: process.platform === 'win32' }, () => {
  const binDir = path.join(tempDir, 'bin');
  fs.mkdirSync(binDir);
  const fakeNpm = path.join(binDir, 'npm');
  fs.writeFileSync(fakeNpm, '#!/bin/sh\necho forced installer failure >&2\nexit 23\n');
  fs.chmodSync(fakeNpm, 0o755);

  const cli = path.resolve(here, '../bin/panelui.mjs');
  const result = spawnSync(
    process.execPath,
    [
      cli,
      'init',
      '--cwd',
      tempDir,
      '--yes',
      '--template',
      'minimal',
      '--name',
      'failing-app',
      '--theme',
      'panel',
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
        PANELUI_TEMPLATE_DIR: templates,
      },
    }
  );

  const output = `${result.stdout}${result.stderr}`;
  assert.equal(result.status, 1);
  assert.match(output, /Dependency installation failed\./);
  assert.doesNotMatch(output, /failing-app is ready\./);
  assert.doesNotMatch(output, /Dependencies installed/);
});
