import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function packageVersion(packageRoot) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version;
}

function pack(directory, destination) {
  const output = execFileSync(
    npm,
    ['pack', '--json', '--ignore-scripts', '--pack-destination', destination],
    { cwd: directory, encoding: 'utf8' }
  );
  const parsed = JSON.parse(output);
  const [manifest] = Array.isArray(parsed) ? parsed : Object.values(parsed);
  if (!manifest?.filename) throw new Error(`npm pack returned no archive for ${directory}`);
  return { manifest, archive: path.join(destination, manifest.filename) };
}

function verifyManifest(packageRoot, manifest) {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  const files = new Set(manifest.files.map(({ path: file }) => file));
  assert.ok(files.has('package.json'), `${pkg.name} omitted package.json`);
  assert.ok(files.has('README.md'), `${pkg.name} omitted README.md`);
  for (const target of Object.values(pkg.bin ?? {})) {
    assert.ok(files.has(target), `${pkg.name} omitted bin target ${target}`);
  }
  for (const target of Object.values(pkg.exports ?? {})) {
    if (typeof target === 'string') {
      assert.ok(files.has(target.replace(/^\.\//, '')), `${pkg.name} omitted export ${target}`);
    }
  }
  const forbidden = [...files].filter((file) =>
    file.includes('/test/') || file.includes('.test.') || file.endsWith('.tsbuildinfo')
  );
  assert.deepEqual(forbidden, [], `${pkg.name} packed development files`);
}

function runBinary(bin, args, expected) {
  const output = execFileSync(process.execPath, [bin, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  assert.match(output, expected);
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-packed-cli-'));
try {
  const cliRoot = path.join(ROOT, 'packages/cli');
  const createRoot = path.join(ROOT, 'packages/create-panelui-app');
  const cli = pack(cliRoot, temporary);
  const create = pack(createRoot, temporary);
  verifyManifest(cliRoot, cli.manifest);
  verifyManifest(createRoot, create.manifest);

  const consumer = path.join(temporary, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, 'package.json'), '{"private":true}');
  execFileSync(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', cli.archive], {
    cwd: consumer,
    stdio: 'inherit',
  });
  execFileSync(
    npm,
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--force', create.archive],
    { cwd: consumer, stdio: 'inherit' }
  );

  runBinary(path.join(consumer, 'node_modules/panelui-cli/bin/panelui.mjs'), ['--help'], /Commands/);
  runBinary(
    path.join(consumer, 'node_modules/panelui-cli/bin/panelui.mjs'),
    ['--version'],
    new RegExp(packageVersion(cliRoot).replaceAll('.', '\\.'))
  );
  runBinary(path.join(consumer, 'node_modules/create-panelui-app/index.mjs'), ['--help'], /new Expo app/);
  runBinary(
    path.join(consumer, 'node_modules/create-panelui-app/index.mjs'),
    ['--version'],
    new RegExp(packageVersion(createRoot).replaceAll('.', '\\.'))
  );
  console.log(
    `Verified packed CLI surfaces: ${cli.manifest.entryCount} panelui-cli files, ` +
      `${create.manifest.entryCount} create-panelui-app files.`
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
