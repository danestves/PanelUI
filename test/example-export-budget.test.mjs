import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  EXAMPLE_EXPORT_BUDGETS,
  assertExampleExportBudgets,
  measureExampleExport,
} from '../scripts/verify-example-export.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-export-budget-'));
  const output = path.join(root, 'output');
  const app = path.join(root, 'example');
  const write = (file, bytes) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.alloc(bytes));
  };
  write(path.join(output, 'bundle.hbc'), 10);
  write(path.join(output, 'assets/a'), 4);
  write(path.join(output, 'assets/b'), 6);
  write(path.join(output, 'metadata.json'), 1);
  write(path.join(app, 'app/_layout.tsx'), 0);
  write(path.join(app, 'app/index.tsx'), 0);
  write(path.join(app, 'app/item/[id].tsx'), 0);
  fs.writeFileSync(
    path.join(output, 'metadata.json'),
    JSON.stringify({
      fileMetadata: {
        android: {
          bundle: 'bundle.hbc',
          assets: [{ path: 'assets/a' }, { path: 'assets/b' }],
        },
      },
    }),
  );
  return { root, output, app };
}

test('measures the exported artifact and route surface deterministically', (t) => {
  const { root, output, app } = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = measureExampleExport(output, 'Android Bundled (4,161 modules)', app);
  const second = measureExampleExport(output, 'Android Bundled (4,161 modules)', app);
  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    modules: 4161,
    bundle: 'bundle.hbc',
    bundleBytes: 10,
    assets: 2,
    assetBytes: 10,
    routes: 2,
    files: 4,
    totalBytes: 123,
  });
});

test('reports every exceeded capacity in one actionable failure', () => {
  const metrics = Object.fromEntries(
    Object.entries(EXAMPLE_EXPORT_BUDGETS).map(([key, value]) => [key, value + 1]),
  );
  assert.throws(
    () => assertExampleExportBudgets(metrics),
    (error) =>
      Object.keys(EXAMPLE_EXPORT_BUDGETS).every((key) =>
        error.message.includes(`${key}:`),
      ),
  );
});

test('CI runs the production export gate by its public command', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(
    packageJson.scripts['performance:example'],
    'node scripts/verify-example-export.mjs',
  );
  assert.equal(workflow.match(/run: npm run performance:example/g)?.length, 1);
});
