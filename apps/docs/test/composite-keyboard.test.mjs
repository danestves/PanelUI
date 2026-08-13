import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  radioIndexForKey,
  tabIndexForKey,
} from '../components/composite-keyboard.ts';

test('horizontal tabs wrap and support Home and End without consuming vertical keys', () => {
  assert.equal(tabIndexForKey('ArrowRight', 3, 4), 0);
  assert.equal(tabIndexForKey('ArrowLeft', 0, 4), 3);
  assert.equal(tabIndexForKey('Home', 2, 4), 0);
  assert.equal(tabIndexForKey('End', 1, 4), 3);
  assert.equal(tabIndexForKey('ArrowDown', 1, 4), undefined);
  assert.equal(tabIndexForKey('Enter', 1, 4), undefined);
});

test('radio groups wrap on either arrow axis and support Home and End', () => {
  assert.equal(radioIndexForKey('ArrowRight', 2, 3), 0);
  assert.equal(radioIndexForKey('ArrowDown', 2, 3), 0);
  assert.equal(radioIndexForKey('ArrowLeft', 0, 3), 2);
  assert.equal(radioIndexForKey('ArrowUp', 0, 3), 2);
  assert.equal(radioIndexForKey('Home', 2, 3), 0);
  assert.equal(radioIndexForKey('End', 0, 3), 2);
  assert.equal(radioIndexForKey(' ', 1, 3), undefined);
});

test('InstallTabs links one roving tab to each hidden-capable panel', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../components/install-tabs.tsx', import.meta.url)),
    'utf8'
  );
  assert.match(source, /role="tablist"[\s\S]*aria-orientation="horizontal"/);
  assert.match(source, /aria-controls=\{`\$\{instanceId\}-panel-\$\{name\}`\}/);
  assert.match(source, /tabIndex=\{manager === name \? 0 : -1\}/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /aria-labelledby=\{`\$\{instanceId\}-tab-\$\{name\}`\}/);
  assert.match(source, /hidden=\{manager !== name\}/);
});

test('Themer exposes named, checked radios with selected-item roving focus', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../components/showcase/themer.tsx', import.meta.url)),
    'utf8'
  );
  assert.match(source, /role="radiogroup"[\s\S]*aria-label="Theme family"/);
  assert.match(source, /role="radio"[\s\S]*aria-label=\{name\}/);
  assert.match(source, /aria-checked=\{family === id\}/);
  assert.match(source, /tabIndex=\{family === id \? 0 : -1\}/);
  assert.match(source, /familyRefs\.current\[next\]\?\.focus\(\)/);
});
