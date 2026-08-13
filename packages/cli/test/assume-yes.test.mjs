import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-cli-assume-yes-'));
after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '../bin/panelui.mjs');

function waitForLine(stream) {
  return new Promise((resolve, reject) => {
    let output = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      output += chunk;
      const newline = output.indexOf('\n');
      if (newline >= 0) resolve(output.slice(0, newline).trim());
    });
    stream.on('error', reject);
  });
}

function runInTty(args) {
  if (process.platform === 'win32' || !fs.existsSync('/usr/bin/expect')) return null;
  const command = [process.execPath, cli, ...args]
    .map((part) => `{${String(part).replaceAll('}', '\\}')}}`)
    .join(' ');
  const script = [
    'log_user 1',
    'set timeout 4',
    `spawn ${command}`,
    'expect {',
    '  timeout { puts \"PROMPT_TIMEOUT\"; exit 124 }',
    '  eof { catch wait result; exit [lindex $result 3] }',
    '}',
  ].join('\n');
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/expect', ['-c', script], {
      env: { ...process.env, NO_COLOR: '1' },
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, output }));
  });
}

test('--yes crosses init, patch, and add boundaries without opening a prompt', {
  skip: process.platform === 'win32',
}, async () => {
  const registryDir = path.join(tempDir, 'registry');
  const projectDir = path.join(tempDir, 'project');
  fs.mkdirSync(registryDir);
  fs.mkdirSync(projectDir);
  fs.writeFileSync(
    path.join(registryDir, 'theme.json'),
    JSON.stringify({ name: 'theme', files: [{ path: 'theme.css', content: '/* tokens */\n' }] })
  );
  fs.writeFileSync(
    path.join(registryDir, 'button.json'),
    JSON.stringify({
      name: 'button',
      files: [{ path: 'ui/button.tsx', content: 'export const Button = true;\n' }],
    })
  );

  const dependencies = Object.fromEntries(
    [
      'expo',
      'uniwind',
      'tailwindcss',
      'tailwind-variants',
      'clsx',
      'tailwind-merge',
      'react-native-reanimated',
      'react-native-safe-area-context',
      'react-native-gesture-handler',
    ].map((name) => [name, '*'])
  );
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ name: 'fixture', dependencies })
  );
  fs.writeFileSync(path.join(projectDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));

  const server = spawn(
    process.execPath,
    [
      '-e',
      `const http=require('node:http'),fs=require('node:fs'),path=require('node:path');const root=process.argv[1];const server=http.createServer((req,res)=>{const file=path.join(root,req.url);if(!fs.existsSync(file)){res.writeHead(404).end();return}res.setHeader('content-type','application/json');res.end(fs.readFileSync(file))});server.listen(0,'127.0.0.1',()=>console.log(server.address().port));`,
      registryDir,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] }
  );

  try {
    const port = await waitForLine(server.stdout);
    const result = await runInTty([
      'init',
      '--cwd',
      projectDir,
      '--registry',
      `http://127.0.0.1:${port}`,
      '--yes',
    ]);

    if (!result) return;
    assert.equal(result.status, 0, result.output);
    assert.doesNotMatch(result.output, /\? .*\((?:Y\/n|y\/N)\)/, result.output);
    for (const file of [
      'panelui.json',
      'theme.css',
      'global.css',
      'metro.config.js',
      'uniwind-env.d.ts',
      'css.d.ts',
    ]) {
      assert.equal(fs.existsSync(path.join(projectDir, file)), true, `${file} was not written`);
    }

    const addResult = await runInTty([
      'add',
      'button',
      '--cwd',
      projectDir,
      '--registry',
      `http://127.0.0.1:${port}`,
      '--yes',
    ]);
    if (!addResult) return;
    assert.equal(addResult.status, 0, addResult.output);
    assert.doesNotMatch(addResult.output, /\? .*\((?:Y\/n|y\/N)\)/, addResult.output);
    assert.equal(fs.existsSync(path.join(projectDir, 'components/ui/button.tsx')), true);
  } finally {
    server.kill();
  }
});
