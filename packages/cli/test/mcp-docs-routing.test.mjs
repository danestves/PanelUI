import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const cli = path.resolve(here, '../bin/panelui.mjs');
const registryIndex = path.join(root, 'apps/docs/public/r/index.json');
const docsRoot = path.join(root, 'apps/docs/content/docs');

const server = spawn(
  process.execPath,
  [
    '-e',
    `const http=require('node:http'),fs=require('node:fs'),path=require('node:path');const index=process.argv[1],docs=process.argv[2];const server=http.createServer((req,res)=>{if(req.url==='/r/index.json'){res.setHeader('content-type','application/json');res.end(fs.readFileSync(index));return}const prefix='/llms.mdx/';if(req.url.startsWith(prefix)){const route=req.url.slice(prefix.length),file=path.join(docs,route+'.mdx');if(fs.existsSync(file)){res.end('docs:'+route);return}}res.writeHead(404).end()});server.listen(0,'127.0.0.1',()=>console.log(server.address().port));`,
    registryIndex,
    docsRoot,
  ],
  { stdio: ['ignore', 'pipe', 'inherit'] }
);
after(() => server.kill());

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

test('registry docsPath metadata matches real docs and routes every supported kind', async () => {
  const port = await waitForLine(server.stdout);
  const expected = new Map([
    ['button', 'components/button'],
    ['area-chart', 'charts/area-chart'],
    ['reasoning', 'ai-components/reasoning'],
    ['form', 'form/form'],
    ['use-theme', 'hooks/use-theme'],
    ['cn', 'utilities/cn'],
  ]);

  const index = JSON.parse(fs.readFileSync(registryIndex, 'utf8'));
  for (const item of index.filter((candidate) => candidate.docsPath)) {
    assert.equal(
      fs.existsSync(path.join(docsRoot, `${item.docsPath}.mdx`)),
      true,
      `${item.name}: ${item.docsPath}`
    );
  }
  for (const [name, docsPath] of expected) {
    const item = index.find((candidate) => candidate.name === name);
    assert.equal(item?.docsPath, docsPath, name);
    assert.equal(fs.existsSync(path.join(docsRoot, `${docsPath}.mdx`)), true, docsPath);
  }

  const names = [...expected.keys(), 'not-real'];
  const input = names
    .map((name, offset) =>
      JSON.stringify({
        jsonrpc: '2.0',
        id: offset + 1,
        method: 'tools/call',
        params: { name: 'panelui_get_component_docs', arguments: { name } },
      })
    )
    .join('\n');
  const result = spawnSync(
    process.execPath,
    [cli, 'mcp', '--registry', `http://127.0.0.1:${port}/r`],
    { encoding: 'utf8', input: `${input}\n` }
  );
  assert.equal(result.status, 0, result.stderr);

  const replies = result.stdout.trim().split('\n').map(JSON.parse);
  for (const [offset, docsPath] of [...expected.values()].entries()) {
    assert.equal(replies[offset].result.content[0].text, `docs:${docsPath}`);
  }
  assert.match(replies.at(-1).result.content[0].text, /No documentation page at .*not-real/);
  assert.match(replies.at(-1).result.content[0].text, /try panelui_view_component instead/);
});
