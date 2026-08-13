import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertRegistryBudgets,
  measureRegistry,
} from '../../../scripts/verify-registry-budgets.mjs';

function fixture(t, sizes) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-registry-budget-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  sizes.forEach((size, index) =>
    fs.writeFileSync(path.join(root, `${index}.json`), 'x'.repeat(size))
  );
  return measureRegistry(root);
}

test('measures generated registry responses deterministically', (t) => {
  assert.deepEqual(fixture(t, [5, 12, 3]), {
    files: 3,
    totalBytes: 20,
    largest: { file: '1.json', bytes: 12 },
  });
});

test('accepts metrics at every declared ceiling', () => {
  assert.doesNotThrow(() =>
    assertRegistryBudgets(
      { files: 2, totalBytes: 20, largest: { file: 'large.json', bytes: 12 } },
      { files: 2, totalBytes: 20, itemBytes: 12 }
    )
  );
});

test('reports seeded file, aggregate, and individual-item regressions together', () => {
  assert.throws(
    () =>
      assertRegistryBudgets(
        { files: 3, totalBytes: 21, largest: { file: 'large.json', bytes: 13 } },
        { files: 2, totalBytes: 20, itemBytes: 12 }
      ),
    /files: 3 > 2[\s\S]*total bytes: 21 > 20[\s\S]*large\.json is 13 bytes > 12/
  );
});
