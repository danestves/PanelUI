import assert from 'node:assert/strict';
import http from 'node:http';
import { after, test } from 'node:test';

import { fetchIndex } from '../src/registry.mjs';
import { CliError } from '../src/ui.mjs';

/*
 * Registry files are written into the project as source, so the transport is
 * the only thing standing between a component and an edit of it in flight.
 */
test('a cleartext registry on a remote host is refused', async () => {
  await assert.rejects(fetchIndex('http://registry.example.com/r'), CliError);
});

test('other schemes are refused rather than attempted', async () => {
  for (const registry of ['file:///etc', 'ftp://registry.example.com', 'not-a-url']) {
    await assert.rejects(fetchIndex(registry), CliError);
  }
});

test('https is allowed through to the network layer', async () => {
  // Resolution is expected to fail; what matters is that it failed at the
  // fetch rather than at the transport check.
  await assert.rejects(fetchIndex('https://registry.invalid/r'), (error) => {
    assert.ok(error instanceof CliError);
    assert.match(error.message, /Could not reach the registry/);
    return true;
  });
});

test('an https registry cannot redirect source to remote cleartext', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => ({
    url: 'http://registry.example.com/r/index.json',
    status: 200,
    ok: true,
    async json() {
      return [{ name: 'button' }];
    },
  }));

  await assert.rejects(fetchIndex('https://registry.example.com/r'), (error) => {
    assert.ok(error instanceof CliError);
    assert.match(error.message, /Refusing to fetch components over http/);
    return true;
  });
});

test('loopback over http still works, so local development is not blocked', async () => {
  const server = http.createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify([{ name: 'button' }]));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  after(() => server.close());

  const index = await fetchIndex(`http://127.0.0.1:${server.address().port}`);
  assert.deepEqual(index, [{ name: 'button' }]);
});
