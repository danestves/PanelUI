import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-cli-dependency-repair-'));
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

test('add repairs dependencies when every resolved component file already exists', {
  skip: process.platform === 'win32',
}, async () => {
  const registryDir = path.join(tempDir, 'registry');
  const projectDir = path.join(tempDir, 'project');
  const binDir = path.join(tempDir, 'bin');
  const installLog = path.join(tempDir, 'install.log');
  fs.mkdirSync(registryDir);
  fs.mkdirSync(path.join(projectDir, 'components/ui'), { recursive: true });
  fs.mkdirSync(binDir);

  fs.writeFileSync(
    path.join(registryDir, 'button.json'),
    JSON.stringify({
      name: 'button',
      registryDependencies: ['helper'],
      files: [{ path: 'ui/button.tsx', content: 'registry button\n' }],
    })
  );
  fs.writeFileSync(
    path.join(registryDir, 'helper.json'),
    JSON.stringify({
      name: 'helper',
      dependencies: ['repair-package'],
      files: [{ path: 'ui/helper.tsx', content: 'registry helper\n' }],
    })
  );
  fs.writeFileSync(
    path.join(projectDir, 'panelui.json'),
    JSON.stringify({
      registry: 'https://panelui.dev/r',
      aliases: {
        components: '@/components/ui',
        lib: '@/lib',
        hooks: '@/hooks',
      },
      theme: 'theme.css',
    })
  );
  fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({ dependencies: {} }));
  fs.writeFileSync(path.join(projectDir, 'components/ui/button.tsx'), 'owned button\n');
  fs.writeFileSync(path.join(projectDir, 'components/ui/helper.tsx'), 'owned helper\n');

  const fakeNpm = path.join(binDir, 'npm');
  fs.writeFileSync(fakeNpm, '#!/bin/sh\nprintf "%s\\n" "$@" > "$PANELUI_INSTALL_LOG"\n');
  fs.chmodSync(fakeNpm, 0o755);

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
    const result = spawnSync(
      process.execPath,
      [
        cli,
        'add',
        'button',
        '--cwd',
        projectDir,
        '--registry',
        `http://127.0.0.1:${port}`,
        '--yes',
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          NO_COLOR: '1',
          PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
          PANELUI_INSTALL_LOG: installLog,
        },
      }
    );

    const output = `${result.stdout}${result.stderr}`;
    assert.equal(result.status, 0, output);
    assert.equal(fs.readFileSync(path.join(projectDir, 'components/ui/button.tsx'), 'utf8'), 'owned button\n');
    assert.equal(fs.readFileSync(path.join(projectDir, 'components/ui/helper.tsx'), 'utf8'), 'owned helper\n');
    assert.equal(fs.readFileSync(installLog, 'utf8'), 'install\nrepair-package\n');
    assert.match(output, /Component files are already installed\./);
    assert.match(output, /Dependencies installed/);
  } finally {
    server.kill();
  }
});
