import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fetchItem, resolve } from '../src/registry.mjs';
import { CliError } from '../src/ui.mjs';

function response(body, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return body;
    },
  };
}

function item(name, registryDependencies = []) {
  return { name, registryDependencies, files: [] };
}

function nameFrom(url) {
  return new URL(url).pathname.split('/').at(-1).replace(/\.json$/, '');
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail('scheduler did not reach the expected state');
}

test('dependency frontiers fetch six at a time and retain declaration order', async (context) => {
  const registry = 'https://bounded.test/r';
  const dependencies = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const waiting = new Map();
  const requests = [];
  let active = 0;
  let maximum = 0;

  context.mock.method(globalThis, 'fetch', async (url) => {
    const name = nameFrom(url);
    requests.push(name);
    if (name === 'root') return response(item('root', dependencies));

    active++;
    maximum = Math.max(maximum, active);
    await new Promise((release) => waiting.set(name, release));
    waiting.delete(name);
    active--;
    return response(item(name));
  });

  const resultPromise = resolve(registry, ['root']);
  await waitFor(() => waiting.size === 6);
  assert.equal(maximum, 6);
  assert.deepEqual(requests, ['root', 'a', 'b', 'c', 'd', 'e', 'f']);

  for (const name of [...waiting.keys()].reverse()) waiting.get(name)();
  await waitFor(() => requests.includes('g') && requests.includes('h'));
  for (const release of waiting.values()) release();

  const result = await resultPromise;
  assert.deepEqual(
    result.map((entry) => entry.name),
    ['root', ...dependencies]
  );
});

test('shared dependencies and cycles fetch once and keep depth-first output', async (context) => {
  const registry = 'https://dedupe.test/r';
  const graph = {
    root: item('root', ['left', 'right']),
    left: item('left', ['shared']),
    right: item('right', ['shared']),
    shared: item('shared', ['root']),
  };
  const requests = new Map();

  context.mock.method(globalThis, 'fetch', async (url) => {
    const name = nameFrom(url);
    requests.set(name, (requests.get(name) ?? 0) + 1);
    return response(graph[name]);
  });

  const result = await resolve(registry, ['root']);
  assert.deepEqual(
    result.map((entry) => entry.name),
    ['root', 'left', 'shared', 'right']
  );
  assert.deepEqual(Object.fromEntries(requests), { root: 1, left: 1, right: 1, shared: 1 });
});

test('concurrent and later item reads share one request', async (context) => {
  const registry = 'https://cache.test/r';
  let requests = 0;
  let release;
  context.mock.method(globalThis, 'fetch', async () => {
    requests++;
    await new Promise((resolve) => {
      release = resolve;
    });
    return response(item('shared'));
  });

  const first = fetchItem(registry, 'shared');
  const second = fetchItem(registry, 'shared');
  await waitFor(() => release !== undefined);
  assert.equal(requests, 1);
  release();

  const [firstItem, secondItem] = await Promise.all([first, second]);
  const laterItem = await fetchItem(registry, 'shared');
  assert.equal(firstItem, secondItem);
  assert.equal(firstItem, laterItem);
  assert.equal(requests, 1);
});

test('missing items retain the registry error and suggestion path', async (context) => {
  const registry = 'https://missing.test/r';
  context.mock.method(globalThis, 'fetch', async (url) => {
    const name = nameFrom(url);
    if (name === 'root') return response(item('root', ['buton']));
    if (name === 'index') return response([{ name: 'button' }]);
    return response(null, 404);
  });

  await assert.rejects(resolve(registry, ['root']), (error) => {
    assert.ok(error instanceof CliError);
    assert.match(error.message, /No component called "buton"/);
    assert.match(error.hint, /Did you mean "button"/);
    return true;
  });
});

test('empty and dependency-free requests do no extra work', async (context) => {
  const registry = 'https://empty.test/r';
  let requests = 0;
  context.mock.method(globalThis, 'fetch', async (url) => {
    requests++;
    return response(item(nameFrom(url)));
  });

  assert.deepEqual(await resolve(registry, []), []);
  assert.deepEqual(
    (await resolve(registry, ['standalone'])).map((entry) => entry.name),
    ['standalone']
  );
  assert.equal(requests, 1);
});
