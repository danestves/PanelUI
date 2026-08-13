import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  flowConnectionActionName,
  getFlowConnectionActions,
  moveNodePosition,
} from '../src/components/flow/flow-accessibility.ts';
import {
  encodeFlowHandleKey,
} from '../src/components/flow/flow-identifiers.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

test('accessible movement uses the drag coordinate system and group bounds', () => {
  const rect = { x: 10, y: 20, width: 40, height: 30 };

  assert.deepEqual(moveNodePosition(rect, undefined, 'flow-move-right', 24), {
    x: 34,
    y: 20,
  });
  assert.deepEqual(
    moveNodePosition(rect, { x: 0, y: 0, width: 60, height: 50 }, 'flow-move-down', 24),
    { x: 10, y: 20 }
  );
  assert.equal(moveNodePosition(rect, undefined, 'unknown', 24), undefined);
});

test('connection actions use registered source and target handles', () => {
  const nodes = [
    { id: 'router', label: 'Router' },
    { id: 'database', label: 'Database' },
    { id: 'logs', label: 'Logs' },
  ];
  const handles = [
    {
      key: encodeFlowHandleKey('router', 'out'),
      node: 'router',
      id: 'out',
      label: 'output',
      type: 'source',
    },
    {
      key: encodeFlowHandleKey('database', 'in'),
      node: 'database',
      id: 'in',
      label: 'input',
      type: 'target',
    },
    {
      key: encodeFlowHandleKey('logs', 'out'),
      node: 'logs',
      id: 'out',
      label: 'output',
      type: 'source',
    },
  ];

  assert.deepEqual(getFlowConnectionActions('router', nodes, handles), [
    {
      name: flowConnectionActionName(
        { node: 'router', handle: 'out' },
        { node: 'database', handle: 'in' }
      ),
      label: 'Connect output to Database, input',
      connection: {
        source: 'router',
        sourceHandle: 'out',
        target: 'database',
        targetHandle: 'in',
      },
    },
    {
      name: flowConnectionActionName(
        { node: 'router', handle: 'out' },
        { node: 'logs' }
      ),
      label: 'Connect output to Logs',
      connection: { source: 'router', sourceHandle: 'out', target: 'logs' },
    },
  ]);
});

test('connection actions preserve punctuated and Unicode endpoint ids', () => {
  const handles = [
    {
      key: encodeFlowHandleKey('source.v2.😀', 'out.primary'),
      node: 'source.v2.😀',
      id: 'out.primary',
      label: 'output',
      type: 'source',
    },
    {
      key: encodeFlowHandleKey('target..节点', ''),
      node: 'target..节点',
      id: '',
      label: 'input',
      type: 'target',
    },
  ];
  const [action] = getFlowConnectionActions(
    'source.v2.😀',
    [
      { id: 'source.v2.😀', label: 'Source' },
      { id: 'target..节点', label: 'Target' },
    ],
    handles
  );

  assert.deepEqual(action.connection, {
    source: 'source.v2.😀',
    sourceHandle: 'out.primary',
    target: 'target..节点',
    targetHandle: '',
  });
});

test('the node owns actions and visual handles no longer claim button behavior', () => {
  const source = fs.readFileSync(
    path.resolve(here, '../src/components/flow/index.tsx'),
    'utf8'
  );

  assert.match(source, /accessibilityActions=\{nodeActions\}/);
  assert.match(source, /onAccessibilityAction=\{handleAccessibilityAction\}/);
  assert.match(source, /<View\s+collapsable=\{false\}\s+hitSlop=\{12\}\s+accessible=\{false\}/);
});
