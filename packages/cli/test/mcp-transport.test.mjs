import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '../bin/panelui.mjs');

function request(id, method, params) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
}

function run(input) {
  const server = spawnSync(process.execPath, [cli, 'mcp'], { encoding: 'utf8', input });
  assert.equal(server.status, 0, server.stderr);
  assert.equal(server.stderr, '');
  return server.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('initialization negotiates unsupported versions to the server version', () => {
  const [reply] = run(
    `${request(1, 'initialize', {
      protocolVersion: '2099-01-01',
      capabilities: {},
      clientInfo: { name: 'transport-test', version: '1.0.0' },
    })}\n`
  );

  assert.equal(reply.id, 1);
  assert.equal(reply.result.protocolVersion, '2025-06-18');
});

test('initialization accepts the protocol version the server implements', () => {
  const [reply] = run(
    `${request(2, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'transport-test', version: '1.0.0' },
    })}\n`
  );

  assert.equal(reply.id, 2);
  assert.equal(reply.result.protocolVersion, '2025-06-18');
});

test('initialization rejects missing and non-string protocol versions', () => {
  for (const protocolVersion of [undefined, null, 20250618]) {
    const params = {
      capabilities: {},
      clientInfo: { name: 'transport-test', version: '1.0.0' },
      ...(protocolVersion === undefined ? {} : { protocolVersion }),
    };
    const [reply] = run(`${request(8, 'initialize', params)}\n`);

    assert.deepEqual(reply, {
      jsonrpc: '2.0',
      id: 8,
      error: { code: -32602, message: 'Invalid params: protocolVersion must be a string' },
    });
  }
});

test('processes a complete final message when stdin ends without a newline', () => {
  assert.deepEqual(run(request(3, 'ping')), [{ jsonrpc: '2.0', id: 3, result: {} }]);
});

test('keeps newline-delimited messages ordered and reports malformed messages', () => {
  const replies = run(
    `${request(4, 'ping')}\nnot-json\n${request(5, 'ping')}\n${request(6, 'ping')}`
  );

  assert.deepEqual(replies, [
    { jsonrpc: '2.0', id: 4, result: {} },
    { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
    { jsonrpc: '2.0', id: 5, result: {} },
    { jsonrpc: '2.0', id: 6, result: {} },
  ]);
});

test('buffers a message split across stdin chunks', async () => {
  const server = spawn(process.execPath, [cli, 'mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  server.stdout.setEncoding('utf8');
  server.stderr.setEncoding('utf8');
  server.stdout.on('data', (chunk) => (stdout += chunk));
  server.stderr.on('data', (chunk) => (stderr += chunk));

  const message = request(7, 'ping');
  server.stdin.write(message.slice(0, 12));
  await new Promise((resolve) => setImmediate(resolve));
  server.stdin.end(message.slice(12));

  const exitCode = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('close', resolve);
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr, '');
  assert.deepEqual(JSON.parse(stdout.trim()), { jsonrpc: '2.0', id: 7, result: {} });
});
