import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { installDependencies } from '../src/patch.mjs';
import { CliError } from '../src/ui.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-cli-install-safety-'));
after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

/*
 * Package names reach a shell on Windows, because `npm` is a `.cmd` shim there
 * and a shim cannot be spawned without one. These are the shapes that would
 * carry their own command across that boundary if the names were pasted into a
 * command string instead of passed as an argument vector.
 */
const HOSTILE = [
  'lodash&&calc',
  'lodash & calc',
  'lodash|calc',
  'lodash;calc',
  'lodash`calc`',
  'lodash$(calc)',
  'lodash\ncalc',
  '../../etc/passwd',
  '--registry=http://evil.test',
  '',
];

for (const name of HOSTILE) {
  test(`installDependencies refuses ${JSON.stringify(name)}`, async () => {
    await assert.rejects(
      installDependencies(tempDir, [name], { assumeYes: true, dryRun: false, isExpo: false }),
      CliError
    );
  });
}

test('installDependencies accepts the package shapes the registry actually ships', async () => {
  const allowed = [
    'clsx',
    'expo-haptics',
    '@expo/ui',
    '@react-native-masked-view/masked-view',
    'react-native-reanimated@3.16.1',
  ];

  // dryRun stops before spawning, so this asserts the names survive validation
  // rather than asserting anything about the installer itself.
  await installDependencies(tempDir, allowed, {
    assumeYes: true,
    dryRun: true,
    isExpo: false,
  });
});
