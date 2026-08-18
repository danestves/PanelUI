import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  MANIFEST,
  receiptTemplate,
  validateJourneyManifest,
  validateNativeReceipt,
} from '../scripts/accessibility-native-receipt.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf8'));

test('native accessibility journeys cover the bounded release matrix', () => {
  assert.deepEqual(validateJourneyManifest(manifest), []);
});

test('native accessibility receipts require both platforms and every journey', () => {
  const receipt = receiptTemplate(manifest, '1234567');
  receipt.runs.pop();
  receipt.runs[0].results['overlay-focus'] = { status: 'pending', evidence: '' };
  const errors = validateNativeReceipt(receipt, manifest);
  assert.ok(errors.some((error) => error.includes('exactly one android run')));
  assert.ok(errors.some((error) => error.includes('ios/overlay-focus needs pass or fail')));
  assert.ok(errors.some((error) => error.includes('ios/overlay-focus needs linked or local evidence')));
});

test('a complete passing native accessibility receipt is accepted', () => {
  const receipt = receiptTemplate(manifest, '1234567');
  for (const run of receipt.runs) {
    Object.assign(run, {
      osVersion: 'current',
      device: 'release device',
      build: 'release candidate',
      tester: 'tester',
    });
    for (const result of Object.values(run.results)) {
      Object.assign(result, { status: 'pass', evidence: `artifacts/${run.platform}.mp4` });
    }
  }
  assert.deepEqual(validateNativeReceipt(receipt, manifest), []);
});
