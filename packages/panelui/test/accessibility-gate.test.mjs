import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ACCESSIBILITY_SUITES,
  CHECKLIST,
  validateAccessibilityGate,
} from '../../../scripts/accessibility-gate.mjs';

const root = path.resolve(import.meta.dirname, '../../..');

test('the accessibility gate covers every required class and contract suite', () => {
  assert.deepEqual(validateAccessibilityGate({ root }), []);
});

test('the accessibility gate rejects a removed class, suite, required test, or count drift', () => {
  const withoutClass = ACCESSIBILITY_SUITES.filter((suite) => suite.class !== 'chart-semantics');
  assert.ok(validateAccessibilityGate({ root, suites: withoutClass })
    .some((error) => error.includes('Missing required accessibility class: chart-semantics')));

  const missingSuite = ACCESSIBILITY_SUITES.map((suite) =>
    suite.class === 'chart-semantics'
      ? { ...suite, file: 'packages/panelui/test/renamed.test.mjs' }
      : suite
  );
  assert.ok(validateAccessibilityGate({ root, suites: missingSuite })
    .some((error) => error.includes('Missing accessibility suite')));

  const missingTest = ACCESSIBILITY_SUITES.map((suite) =>
    suite.class === 'chart-semantics'
      ? { ...suite, anchor: 'renamed required contract' }
      : suite
  );
  assert.ok(validateAccessibilityGate({ root, suites: missingTest })
    .some((error) => error.includes('is missing required test')));

  const staleCount = ACCESSIBILITY_SUITES.map((suite) =>
    suite.class === 'chart-semantics' ? { ...suite, count: suite.count + 1 } : suite
  );
  assert.ok(validateAccessibilityGate({ root, suites: staleCount })
    .some((error) => error.includes('must contain 5 tests; found 4')));
});

test('the accessibility gate rejects an incomplete manual checklist', (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-a11y-gate-'));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const checklistPath = path.join(temporaryRoot, CHECKLIST);
  fs.mkdirSync(path.dirname(checklistPath), { recursive: true });
  const manual = fs.readFileSync(path.join(root, CHECKLIST), 'utf8');
  fs.writeFileSync(checklistPath, manual.replace('## TalkBack — Android', '## Android'));
  const errors = validateAccessibilityGate({ root: temporaryRoot, suites: [], checklist: CHECKLIST });
  assert.ok(errors.some((error) => error.includes('Manual checklist is missing section')));
});
