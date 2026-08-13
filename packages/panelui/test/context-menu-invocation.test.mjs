import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  contextMenuAccessibilityInvocation,
  contextMenuKeyInvocation,
} from '../src/components/context-menu/context-menu-invocation.ts';

test('ContextMenu accessibility actions preserve menu and primary activation semantics', () => {
  assert.equal(contextMenuAccessibilityInvocation('showMenu', false, false), 'menu');
  assert.equal(contextMenuAccessibilityInvocation('showMenu', true, false), 'menu');
  assert.equal(contextMenuAccessibilityInvocation('activate', false, false), 'menu');
  assert.equal(contextMenuAccessibilityInvocation('activate', true, false), 'press');
  assert.equal(contextMenuAccessibilityInvocation('escape', false, false), undefined);
  assert.equal(contextMenuAccessibilityInvocation('showMenu', false, true), undefined);
});

test('ContextMenu keyboard invocation follows platform context-menu and activation keys', () => {
  assert.equal(contextMenuKeyInvocation({ key: 'ContextMenu' }, true, false), 'menu');
  assert.equal(contextMenuKeyInvocation({ key: 'F10', shiftKey: true }, true, false), 'menu');
  assert.equal(contextMenuKeyInvocation({ key: 'F10' }, false, false), undefined);
  assert.equal(contextMenuKeyInvocation({ key: 'Enter' }, false, false), 'menu');
  assert.equal(contextMenuKeyInvocation({ key: ' ' }, true, false), 'press');
  assert.equal(contextMenuKeyInvocation({ key: 'Enter', metaKey: true }, false, false), undefined);
  assert.equal(contextMenuKeyInvocation({ key: 'ContextMenu', repeat: true }, false, false), undefined);
  assert.equal(contextMenuKeyInvocation({ key: 'ContextMenu' }, false, true), undefined);
});

test('ContextMenu.Trigger wires semantic actions and keyboard events to target anchoring', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../src/components/context-menu/index.tsx', import.meta.url)),
    'utf8'
  );

  assert.match(source, /name: 'showMenu', label: 'Show menu'/);
  assert.match(source, /onAccessibilityAction=\{handleAccessibilityAction\}/);
  assert.match(source, /onKeyDown: handleKeyDown/);
  assert.match(source, /openFromTarget/);
  assert.match(source, /accessibilityState=.*disabled/s);
});
