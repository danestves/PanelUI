import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { patchMetro } from '../src/patch.mjs';

async function runPatch(contents) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-cli-metro-'));
  fs.writeFileSync(path.join(cwd, 'metro.config.js'), contents);

  const output = [];
  const originalLog = console.log;
  console.log = (...args) => output.push(args.join(' '));
  try {
    await patchMetro(cwd, {}, { assumeYes: true, dryRun: false });
  } finally {
    console.log = originalLog;
    fs.rmSync(cwd, { recursive: true, force: true });
  }
  return output.join('\n');
}

for (const [label, contents] of [
  [
    'CommonJS',
    `const { withUniwindConfig } = require('uniwind/metro');
const config = {};
module.exports = withUniwindConfig(config, { cssEntryFile: './global.css' });
`,
  ],
  [
    'ES modules',
    `import { withUniwindConfig } from 'uniwind/metro';
const config = {};
export default withUniwindConfig(config, { cssEntryFile: './global.css' });
`,
  ],
  [
    'named CommonJS',
    `const { withUniwindConfig } = require('uniwind/metro');
const config = {};
const wrappedConfig = withUniwindConfig(config, { cssEntryFile: './global.css' });
module.exports = wrappedConfig
`,
  ],
]) {
  test(`patchMetro accepts a wrapped ${label} export`, async () => {
    const output = await runPatch(contents);
    assert.match(output, /already wraps withUniwindConfig/);
    assert.doesNotMatch(output, /does not use Uniwind/);
  });
}

for (const [label, contents] of [
  [
    'comment',
    `const config = {};
// module.exports = withUniwindConfig(config);
module.exports = config;
`,
  ],
  [
    'unused import',
    `import { withUniwindConfig } from 'uniwind/metro';
const config = {};
export default config;
`,
  ],
]) {
  test(`patchMetro rejects a withUniwindConfig ${label} outside the export`, async () => {
    const output = await runPatch(contents);
    assert.match(output, /does not use Uniwind/);
    assert.doesNotMatch(output, /already wraps withUniwindConfig/);
  });
}
