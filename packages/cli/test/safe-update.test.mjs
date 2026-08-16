import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { writeLock } from '../src/lock.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-safe-update-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const cli = fileURLToPath(new URL('../bin/panelui.mjs', import.meta.url));

function waitForLine(stream) {
  return new Promise((resolve) => {
    let output = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      output += chunk;
      if (output.includes('\n')) resolve(output.split('\n')[0].trim());
    });
  });
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', ...env },
  });
}

test('update writes only digest-matching files and reports modified files', async () => {
  const registry = path.join(root, 'registry');
  const project = path.join(root, 'project');
  fs.mkdirSync(registry);
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ dependencies: {} }));
  fs.writeFileSync(
    path.join(project, 'panelui.json'),
    JSON.stringify({
      registry: 'https://panelui.dev/r',
      aliases: { components: '@/components/ui', lib: '@/lib', hooks: '@/hooks' },
    })
  );

  const writeRegistry = (first, second, extra = [], dependencies = [], registryDependencies = []) =>
    fs.writeFileSync(
      path.join(registry, 'card.json'),
      JSON.stringify({
        name: 'card',
        files: [
          { path: 'ui/card.tsx', content: first },
          { path: 'ui/card-style.ts', content: second },
          ...extra,
        ],
        dependencies,
        registryDependencies,
      })
    );
  writeRegistry('card v1\n', 'style v1\n', [{ path: 'ui/removed.ts', content: 'old\n' }]);

  const server = spawn(
    process.execPath,
    [
      '-e',
      `const http=require('node:http'),fs=require('node:fs'),path=require('node:path');const root=process.argv[1];const server=http.createServer((req,res)=>{const file=path.join(root,req.url);if(!fs.existsSync(file)){res.writeHead(404).end();return}res.end(fs.readFileSync(file))});server.listen(0,'127.0.0.1',()=>console.log(server.address().port));`,
      registry,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] }
  );

  try {
    const port = await waitForLine(server.stdout);
    const common = ['--cwd', project, '--registry', `http://127.0.0.1:${port}`, '--yes'];
    const added = run(['add', 'card', ...common]);
    assert.equal(added.status, 0, `${added.stdout}${added.stderr}`);
    const lock = JSON.parse(fs.readFileSync(path.join(project, 'panelui-lock.json'), 'utf8'));
    assert.equal(lock.version, 1);
    assert.equal(lock.files['components/ui/card.tsx'].item, 'card');
    const unchanged = run(['update', ...common]);
    assert.equal(unchanged.status, 0, `${unchanged.stdout}${unchanged.stderr}`);

    fs.writeFileSync(path.join(project, 'components/ui/card-style.ts'), 'local style\n');
    fs.writeFileSync(
      path.join(registry, 'helper.json'),
      JSON.stringify({ name: 'helper', files: [{ path: 'lib/helper.ts', content: 'helper\n' }] })
    );
    writeRegistry('card v2\n', 'style v2\n', [], ['safe-update-fixture'], ['helper']);
    const bin = path.join(root, 'bin');
    const marker = path.join(root, 'installed');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\necho called >> "$PANELUI_MARKER"\n');
    fs.chmodSync(path.join(bin, 'npm'), 0o755);
    const installEnv = { PATH: `${bin}:${process.env.PATH}`, PANELUI_MARKER: marker };
    const beforeCheck = fs.readFileSync(path.join(project, 'components/ui/card.tsx'), 'utf8');
    const lockBeforeCheck = fs.readFileSync(path.join(project, 'panelui-lock.json'), 'utf8');
    const checked = run(['update', '--check', ...common], installEnv);
    assert.equal(checked.status, 1, `${checked.stdout}${checked.stderr}`);
    assert.match(checked.stdout, /--- a\/components\/ui\/card\.tsx\n\+\+\+ b\/components\/ui\/card\.tsx/);
    assert.match(checked.stdout, /--- \/dev\/null\n\+\+\+ b\/lib\/helper\.ts/);
    assert.match(checked.stdout, /--- a\/components\/ui\/removed\.ts\n\+\+\+ \/dev\/null/);
    assert.doesNotMatch(checked.stdout, /--- a\/components\/ui\/card-style\.ts/);
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.readFileSync(path.join(project, 'components/ui/card.tsx'), 'utf8'), beforeCheck);
    assert.equal(fs.readFileSync(path.join(project, 'panelui-lock.json'), 'utf8'), lockBeforeCheck);
    const dryRun = run(['update', '--dry-run', ...common], installEnv);
    assert.equal(dryRun.status, 1);
    assert.match(dryRun.stdout, /@@ -1 \+1 @@\n-card v1\n\+card v2/);
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.readFileSync(path.join(project, 'panelui-lock.json'), 'utf8'), lockBeforeCheck);

    const updated = run(['update', ...common], installEnv);
    const output = `${updated.stdout}${updated.stderr}`;
    assert.equal(updated.status, 1, output);
    assert.match(output, /@@ -1 \+1 @@\n-card v1\n\+card v2/);
    assert.equal(fs.readFileSync(path.join(project, 'components/ui/card.tsx'), 'utf8'), 'card v2\n');
    assert.equal(
      fs.readFileSync(path.join(project, 'components/ui/card-style.ts'), 'utf8'),
      'local style\n'
    );
    assert.match(output, /1 modified or untracked file left alone/);
    assert.equal(fs.readFileSync(marker, 'utf8'), 'called\n');
    assert.equal(fs.existsSync(path.join(project, 'components/ui/removed.ts')), false);
    assert.equal(fs.readFileSync(path.join(project, 'lib/helper.ts'), 'utf8'), 'helper\n');

    fs.writeFileSync(
      path.join(registry, 'bad.json'),
      JSON.stringify({ name: 'bad', files: [{ path: 'ui/bad.ts', content: 'safe\n' }] })
    );
    assert.equal(run(['add', 'bad', ...common]).status, 0);
    fs.writeFileSync(
      path.join(registry, 'bad.json'),
      JSON.stringify({ name: 'bad', files: [{ path: '../escape.ts', content: 'nope\n' }] })
    );
    const traversal = run(['update', 'bad', ...common]);
    assert.equal(traversal.status, 1);
    assert.equal(fs.existsSync(path.join(project, '..', 'escape.ts')), false);
  } finally {
    server.kill();
  }
});

test('lockfile replacement is atomic when rename is interrupted', () => {
  const project = path.join(root, 'atomic');
  fs.mkdirSync(project);
  const file = path.join(project, 'panelui-lock.json');
  fs.writeFileSync(file, '{"version":1,"files":{}}\n');
  const rename = fs.renameSync;
  fs.renameSync = () => {
    throw new Error('interrupted');
  };
  try {
    assert.throws(() => writeLock(project, { version: 1, files: { changed: {} } }), /interrupted/);
  } finally {
    fs.renameSync = rename;
  }
  assert.equal(fs.readFileSync(file, 'utf8'), '{"version":1,"files":{}}\n');
  assert.deepEqual(fs.readdirSync(project), ['panelui-lock.json']);
});

test('legacy projects without digests are refused without touching files', () => {
  const project = path.join(root, 'legacy');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'panelui.json'), '{}');
  const result = run(['update', '--cwd', project]);
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, /cannot be proven unchanged/);
});
