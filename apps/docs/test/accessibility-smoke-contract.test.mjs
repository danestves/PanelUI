import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../../..');
const source = fs.readFileSync(path.join(import.meta.dirname, 'accessibility-smoke.mjs'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('the browser smoke stays bounded to representative production routes', () => {
  assert.match(source, /const ROUTES = \['\/', '\/docs', '\/docs\/components\/button'\]/);
  assert.match(source, /withTags\(WCAG_TAGS\)/);
  assert.match(source, /results\.violations\.length/);
});

test('CI builds docs, installs only Chromium, and runs the browser gate in order', () => {
  const build = workflow.indexOf('run: npm run build --workspace=docs');
  const install = workflow.indexOf('run: npx playwright install --with-deps chromium');
  const smoke = workflow.indexOf('run: npm run test:a11y:browser');
  assert.ok(build >= 0 && build < install && install < smoke);
  assert.equal(rootPackage.scripts['test:a11y:browser'], 'npm run test:a11y:browser --workspace=docs');
});
