import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  decodeFlowEdgeKey,
  decodeFlowHandleKey,
  encodeFlowEdgeKey,
  encodeFlowHandleKey,
  resolveFlowEndpoint,
} from '../src/components/flow/flow-identifiers.ts';

test('handle identities round trip punctuation, empty handles, and Unicode', () => {
  const endpoints = [
    { node: 'router.v1', handle: 'out.main' },
    { node: '...node...', handle: '..' },
    { node: 'node', handle: '' },
    { node: '节点.😀', handle: '出口.🔌' },
  ];
  const keys = endpoints.map(({ node, handle }) => encodeFlowHandleKey(node, handle));

  assert.equal(new Set(keys).size, endpoints.length);
  assert.deepEqual(keys.map(decodeFlowHandleKey), endpoints);
  assert.notEqual(encodeFlowHandleKey('a.b', 'c'), encodeFlowHandleKey('a', 'b.c'));
});

test('edge identities preserve source and target references symmetrically', () => {
  const from = { node: 'source.v1', handle: 'out.😀' };
  const to = { node: 'target..', handle: '' };
  const forward = encodeFlowEdgeKey(from, to);
  const reverse = encodeFlowEdgeKey(to, from);

  assert.notEqual(forward, reverse);
  assert.deepEqual(decodeFlowEdgeKey(forward), { from, to });
  assert.deepEqual(decodeFlowEdgeKey(encodeFlowEdgeKey('router.out', 'database.in')), {
    from: 'router.out',
    to: 'database.in',
  });
  assert.notEqual(encodeFlowEdgeKey('a->b', 'c'), encodeFlowEdgeKey('a', 'b->c'));
});

test('malformed internal tokens are refused rather than partially decoded', () => {
  for (const token of [
    '',
    'router.out',
    'panelui-flow:not-json',
    'panelui-flow:{}',
    'panelui-flow:["handle","node"]',
    'panelui-flow:["handle","node",3]',
    'panelui-flow:["edge",["legacy","a"]]',
    'panelui-flow:["edge",["endpoint",3],["legacy","b"]]',
  ]) {
    assert.equal(decodeFlowHandleKey(token), undefined, token);
    assert.equal(decodeFlowEdgeKey(token), undefined, token);
  }
});

test('endpoint resolution preserves dotted nodes and existing simple handle references', () => {
  const nodes = ['router', 'router.v1', '节点.😀'];
  const handles = [
    { node: 'router', id: 'out' },
    { node: 'router.v1', id: 'out.main' },
    { node: '节点.😀', id: '' },
  ];

  assert.deepEqual(resolveFlowEndpoint('router.v1', nodes, handles), { node: 'router.v1' });
  assert.deepEqual(resolveFlowEndpoint('router.out', nodes, handles), {
    node: 'router',
    handle: 'out',
  });
  assert.deepEqual(resolveFlowEndpoint('router.v1.out.main', nodes, handles), {
    node: 'router.v1',
    handle: 'out.main',
  });
  assert.deepEqual(resolveFlowEndpoint({ node: '节点.😀', handle: '' }, nodes, handles), {
    node: '节点.😀',
    handle: '',
  });
  assert.deepEqual(resolveFlowEndpoint('节点.😀.', nodes, handles), {
    node: '节点.😀',
    handle: '',
  });
});

test('the copied-source registry ships the canonical identifier codec', () => {
  const registry = JSON.parse(
    readFileSync(new URL('../../../apps/docs/public/r/flow.json', import.meta.url), 'utf8')
  );
  const files = new Map(registry.files.map((file) => [file.path, file.content]));
  const source = readFileSync(
    new URL('../src/components/flow/flow-identifiers.ts', import.meta.url),
    'utf8'
  );

  assert.equal(files.get('ui/flow-identifiers.ts'), source);
  assert.match(files.get('ui/flow.tsx'), /from '@\/components\/ui\/flow-identifiers'/);
});
