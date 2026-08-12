import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { aliasToDir, applyAliases, defaultConfig, validateAlias } from '../src/config.mjs';
import { CliError } from '../src/ui.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function temporaryProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-cli-alias-'));
}

test('rewrites imports to the aliases a project actually uses', () => {
  const source = "import { Button } from '@/components/ui/button';\n";

  assert.equal(
    applyAliases(source, { ...defaultConfig(), aliases: { components: '@/src/ui' } }),
    "import { Button } from '@/src/ui/button';\n"
  );

  // A trailing slash is a typo with one obvious reading, not a refusal.
  assert.equal(
    applyAliases(source, { ...defaultConfig(), aliases: { components: '@/src/ui/' } }),
    "import { Button } from '@/src/ui/button';\n"
  );

  assert.equal(validateAlias('  ~/lib  '), '~/lib');
  assert.equal(aliasToDir('./hooks'), 'hooks');
});

test('refuses an alias that would not stay inside the import it is written into', () => {
  const source = "import { Button } from '@/components/ui/button';\n";

  for (const components of [
    "@/ui'; import 'backdoor",
    '@/ui";\nimport "backdoor',
    '@/ui`;\nrequire("backdoor")',
    '@/ui with spaces',
    '@/../../victim',
    '/abs/ui',
    'C:\\ui',
  ]) {
    const config = { ...defaultConfig(), aliases: { components } };
    assert.throws(() => applyAliases(source, config), CliError, components);
    assert.throws(() => aliasToDir(components), CliError, components);
  }
});

test('the MCP project report does not list a directory outside the project', () => {
  const root = temporaryProject();
  const project = path.join(root, 'app');
  const victim = path.join(root, 'victim');

  try {
    fs.mkdirSync(project);
    fs.mkdirSync(victim);
    fs.writeFileSync(path.join(victim, 'secret.tsx'), 'export const secret = 1;\n');
    fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'app' }));
    fs.writeFileSync(
      path.join(project, 'panelui.json'),
      JSON.stringify({ ...defaultConfig(), aliases: { components: '@/../victim' } })
    );

    const cli = path.resolve(here, '../bin/panelui.mjs');
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'panelui_get_project_info', arguments: {} },
    };
    const server = spawnSync(process.execPath, [cli, 'mcp', '--cwd', project], {
      encoding: 'utf8',
      input: `${JSON.stringify(request)}\n`,
    });

    const reply = JSON.parse(server.stdout.trim().split('\n').at(-1));
    const info = JSON.parse(reply.result.content[0].text);

    assert.equal(info.componentsDir, null);
    assert.deepEqual(info.addedComponents, []);
    // The report still answers everything it can rather than failing whole.
    assert.equal(info.usesCopiedSource, true);
    assert.doesNotMatch(server.stdout, /secret/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
