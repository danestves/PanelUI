import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { digest, writeLock } from '../src/lock.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-root-closures-'));
const cli = fileURLToPath(new URL('../bin/panelui.mjs', import.meta.url));
after(() => fs.rmSync(root, { recursive: true, force: true }));

function item(registry, name, file, dependencies = []) {
  fs.writeFileSync(
    path.join(registry, `${name}.json`),
    JSON.stringify({ name, files: [{ path: file, content: `${name}\n` }], registryDependencies: dependencies })
  );
}

function project(name) {
  const directory = path.join(root, name);
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'package.json'), '{"dependencies":{}}');
  fs.writeFileSync(
    path.join(directory, 'panelui.json'),
    JSON.stringify({
      registry: 'https://panelui.dev/r',
      aliases: { components: '@/components/ui', lib: '@/lib', hooks: '@/hooks' },
    })
  );
  return directory;
}

async function registryServer(registry) {
  const server = spawn(
    process.execPath,
    [
      '-e',
      `const http=require('node:http'),fs=require('node:fs'),path=require('node:path');const root=process.argv[1];const server=http.createServer((req,res)=>{const file=path.join(root,req.url);if(!fs.existsSync(file)){res.writeHead(404).end();return}res.end(fs.readFileSync(file))});server.listen(0,'127.0.0.1',()=>console.log(server.address().port));`,
      registry,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] }
  );
  let output = '';
  for await (const chunk of server.stdout) {
    output += chunk;
    if (output.includes('\n')) break;
  }
  return { server, url: `http://127.0.0.1:${output.trim()}` };
}

function run(project, url, args) {
  return spawnSync(process.execPath, [cli, ...args, '--cwd', project, '--registry', url, '--yes'], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function lock(project) {
  return JSON.parse(fs.readFileSync(path.join(project, 'panelui-lock.json'), 'utf8'));
}

test('named updates prune only digest-matching dependencies orphaned by every root', async () => {
  const registry = path.join(root, 'shared-registry');
  fs.mkdirSync(registry);
  item(registry, 'alpha', 'ui/alpha.ts', ['shared', 'former']);
  item(registry, 'beta', 'ui/beta.ts', ['shared']);
  item(registry, 'shared', 'lib/shared.ts');
  item(registry, 'former', 'lib/former.ts');
  item(registry, 'gamma', 'ui/gamma.ts', ['edited']);
  item(registry, 'edited', 'lib/edited.ts');
  const app = project('shared-project');
  const { server, url } = await registryServer(registry);

  try {
    assert.equal(run(app, url, ['add', 'alpha', 'beta', 'gamma']).status, 0);
    assert.deepEqual(lock(app).roots, {
      alpha: ['alpha', 'shared', 'former'],
      beta: ['beta', 'shared'],
      gamma: ['gamma', 'edited'],
    });
    assert.deepEqual(lock(app).legacyFiles, []);
    const transitiveOnly = run(app, url, ['update', 'shared']);
    assert.equal(transitiveOnly.status, 1);
    assert.match(`${transitiveOnly.stdout}${transitiveOnly.stderr}`, /Not tracked as a requested root/);

    item(registry, 'alpha', 'ui/alpha.ts');
    const beforePreview = fs.readFileSync(path.join(app, 'panelui-lock.json'), 'utf8');
    assert.equal(run(app, url, ['update', 'alpha', '--dry-run']).status, 1);
    assert.equal(fs.readFileSync(path.join(app, 'panelui-lock.json'), 'utf8'), beforePreview);
    assert.equal(fs.existsSync(path.join(app, 'lib/former.ts')), true);

    assert.equal(run(app, url, ['update', 'alpha']).status, 0);
    assert.equal(fs.existsSync(path.join(app, 'lib/former.ts')), false);
    assert.equal(fs.existsSync(path.join(app, 'lib/shared.ts')), true);
    assert.deepEqual(lock(app).roots.alpha, ['alpha']);

    item(registry, 'beta', 'ui/beta.ts');
    assert.equal(run(app, url, ['update', 'beta']).status, 0);
    assert.equal(fs.existsSync(path.join(app, 'lib/shared.ts')), false);

    fs.writeFileSync(path.join(app, 'lib/edited.ts'), 'local edit\n');
    item(registry, 'gamma', 'ui/gamma.ts');
    const conflicted = run(app, url, ['update', 'gamma']);
    assert.equal(conflicted.status, 1, `${conflicted.stdout}${conflicted.stderr}`);
    assert.match(conflicted.stdout, /lib\/edited\.ts.*modified/);
    assert.equal(fs.readFileSync(path.join(app, 'lib/edited.ts'), 'utf8'), 'local edit\n');
    assert.deepEqual(lock(app).roots.gamma, ['gamma']);
    assert.equal(run(app, url, ['update', 'gamma']).status, 1);
  } finally {
    server.kill();
  }
});

test('v1 locks stay conservative until add records an explicit root closure', async () => {
  const registry = path.join(root, 'legacy-registry');
  fs.mkdirSync(registry);
  item(registry, 'legacy-root', 'ui/legacy.ts', ['legacy-dep']);
  item(registry, 'legacy-dep', 'lib/legacy-dep.ts');
  const app = project('legacy-project');
  fs.mkdirSync(path.join(app, 'components/ui'), { recursive: true });
  fs.mkdirSync(path.join(app, 'lib'));
  fs.writeFileSync(path.join(app, 'components/ui/legacy.ts'), 'legacy-root\n');
  fs.writeFileSync(path.join(app, 'lib/legacy-dep.ts'), 'legacy-dep\n');
  writeLock(app, {
    version: 1,
    files: {
      'components/ui/legacy.ts': { item: 'legacy-root', digest: digest('legacy-root\n') },
      'lib/legacy-dep.ts': { item: 'legacy-dep', digest: digest('legacy-dep\n') },
    },
  });
  const { server, url } = await registryServer(registry);

  try {
    const conservative = run(app, url, ['update', 'legacy-root']);
    assert.equal(conservative.status, 0, `${conservative.stdout}${conservative.stderr}`);
    assert.match(conservative.stdout, /v1 cannot prune former dependencies safely/);
    assert.equal(lock(app).version, 1);

    assert.equal(run(app, url, ['add', 'legacy-root']).status, 0);
    assert.equal(lock(app).version, 2);
    assert.deepEqual(lock(app).roots, { 'legacy-root': ['legacy-root', 'legacy-dep'] });
    assert.deepEqual(lock(app).legacyFiles, []);

    item(registry, 'legacy-root', 'ui/legacy.ts');
    assert.equal(run(app, url, ['update', 'legacy-root']).status, 0);
    assert.equal(fs.existsSync(path.join(app, 'lib/legacy-dep.ts')), false);
  } finally {
    server.kill();
  }
});

test('migrating to v2 keeps updating components installed before the lock had roots', async () => {
  const registry = path.join(root, 'adopted-registry');
  fs.mkdirSync(registry);
  item(registry, 'adopted', 'ui/adopted.ts');
  item(registry, 'newcomer', 'ui/newcomer.ts');
  const app = project('adopted-project');
  fs.mkdirSync(path.join(app, 'components/ui'), { recursive: true });
  fs.writeFileSync(path.join(app, 'components/ui/adopted.ts'), 'adopted\n');
  writeLock(app, {
    version: 1,
    files: { 'components/ui/adopted.ts': { item: 'adopted', digest: digest('adopted\n') } },
  });
  const { server, url } = await registryServer(registry);

  try {
    // Adding an unrelated component is what migrates the lock to v2.
    assert.equal(run(app, url, ['add', 'newcomer']).status, 0);
    assert.deepEqual(lock(app).roots, { newcomer: ['newcomer'] });
    assert.deepEqual(lock(app).legacyFiles, ['components/ui/adopted.ts']);

    // The component that predates the migration is still updated by name...
    fs.writeFileSync(
      path.join(registry, 'adopted.json'),
      JSON.stringify({
        name: 'adopted',
        files: [{ path: 'ui/adopted.ts', content: 'adopted v2\n' }],
        registryDependencies: [],
      })
    );
    const named = run(app, url, ['update', 'adopted']);
    assert.equal(named.status, 0, `${named.stdout}${named.stderr}`);
    assert.equal(fs.readFileSync(path.join(app, 'components/ui/adopted.ts'), 'utf8'), 'adopted v2\n');

    // ...and by a bare update, which must not quietly skip it.
    fs.writeFileSync(
      path.join(registry, 'adopted.json'),
      JSON.stringify({
        name: 'adopted',
        files: [{ path: 'ui/adopted.ts', content: 'adopted v3\n' }],
        registryDependencies: [],
      })
    );
    const bare = run(app, url, ['update']);
    assert.equal(bare.status, 0, `${bare.stdout}${bare.stderr}`);
    assert.match(bare.stdout, /adopted/);
    assert.equal(fs.readFileSync(path.join(app, 'components/ui/adopted.ts'), 'utf8'), 'adopted v3\n');
  } finally {
    server.kill();
  }
});
