import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  signatureAccessibilityActions,
  signatureAccessibilityValue,
  signatureAnnouncement,
} from '../src/components/signature/signature-accessibility.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

test('signature value distinguishes empty and completed state', () => {
  assert.deepEqual(signatureAccessibilityValue(0), { text: 'Empty signature' });
  assert.deepEqual(signatureAccessibilityValue(1), {
    text: 'Signature complete, 1 stroke',
  });
  assert.deepEqual(signatureAccessibilityValue(3), {
    text: 'Signature complete, 3 strokes',
  });
});

test('only currently usable signature actions are exposed', () => {
  assert.deepEqual(signatureAccessibilityActions(0, 0, false, false), []);
  assert.deepEqual(signatureAccessibilityActions(2, 0, false, false), [
    { name: 'signature-undo', label: 'Undo last stroke' },
    { name: 'signature-clear', label: 'Clear signature' },
  ]);
  assert.deepEqual(signatureAccessibilityActions(0, 1, true, false), [
    { name: 'signature-redo', label: 'Redo last stroke' },
    { name: 'signature-alternative', label: 'Use another signature method' },
  ]);
  assert.deepEqual(signatureAccessibilityActions(2, 1, true, true), []);
});

test('state transitions announce completion, empty, and explicit clearing', () => {
  assert.equal(signatureAnnouncement(0, 1, 'draw'), 'Signature completed.');
  assert.equal(signatureAnnouncement(1, 0, 'undo'), 'Signature is empty.');
  assert.equal(
    signatureAnnouncement(3, 0, 'clear'),
    'Signature cleared. Signature is empty.'
  );
  assert.equal(signatureAnnouncement(1, 2, 'draw'), null);
  assert.equal(signatureAnnouncement(0, 0, 'clear'), null);
});

test('the pad wires actions and an honest alternative-method hook', () => {
  const source = fs.readFileSync(
    path.resolve(here, '../src/components/signature/index.tsx'),
    'utf8'
  );

  assert.match(source, /accessibilityValue=\{signatureAccessibilityValue\(strokes\.length\)\}/);
  assert.match(source, /accessibilityActions=\{padActions\}/);
  assert.match(source, /onAccessibilityAction=\{handleAccessibilityAction\}/);
  assert.match(source, /alternativeRef\.current\?\.\(\)/);
  assert.match(source, /Direct touch drawing requires tracing a path/);
});
