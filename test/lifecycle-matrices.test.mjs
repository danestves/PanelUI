import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { LIFECYCLE_CASES, loadLifecycleMatrices, validateLifecycleMatrices } from '../scripts/lifecycle-matrices.mjs';

const root = path.resolve(import.meta.dirname, '..');
const matrices = loadLifecycleMatrices(root);

test('stateful component lifecycle matrices cover every required case with executable evidence', () => {
  assert.deepEqual(Object.keys(matrices).sort(), ['carousel', 'live-line-chart', 'planner', 'toast']);
  for (const matrix of Object.values(matrices)) assert.deepEqual(Object.keys(matrix.cases), LIFECYCLE_CASES);
  assert.deepEqual(validateLifecycleMatrices(root, matrices), []);
});

test('lifecycle validation rejects missing cases, files, and test titles together', () => {
  const broken = structuredClone(matrices);
  delete broken.carousel.cases['controlled rejection'];
  broken.planner.evidence[0].file = 'missing.test.mjs';
  broken.toast.evidence[0].tests[0] = 'renamed test';
  assert.deepEqual(validateLifecycleMatrices(root, broken), [
    'carousel: missing lifecycle case controlled rejection',
    'planner: missing evidence missing.test.mjs',
    'toast: missing evidence test renamed test',
  ]);
});

test('generated pages publish the validated lifecycle matrices', () => {
  for (const slug of Object.keys(matrices)) {
    const group = slug === 'live-line-chart' ? 'charts' : 'components';
    const page = fs.readFileSync(path.join(root, `apps/docs/content/docs/${group}/${slug}.mdx`), 'utf8');
    assert.match(page, /## Lifecycle contract/);
    for (const name of LIFECYCLE_CASES) assert.ok(page.includes(`| ${name} |`), `${slug}: ${name}`);
  }
});
