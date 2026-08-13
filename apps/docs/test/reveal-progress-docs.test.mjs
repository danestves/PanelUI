import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(docs, '../..');

test('the public useRevealProgress export has a hook page and navigation entry', () => {
  const publicIndex = fs.readFileSync(path.join(root, 'packages/panelui/src/index.ts'), 'utf8');
  const hooksIndex = fs.readFileSync(
    path.join(root, 'packages/panelui/src/hooks/index.ts'),
    'utf8'
  );
  const hookPage = path.join(docs, 'content/docs/hooks/use-reveal-progress.mdx');
  const hooksMeta = JSON.parse(
    fs.readFileSync(path.join(docs, 'content/docs/hooks/meta.json'), 'utf8')
  );

  assert.match(publicIndex, /export \* from ['"]\.\/hooks['"]/);
  assert.match(hooksIndex, /\buseRevealProgress,/);
  assert.equal(fs.existsSync(hookPage), true);
  assert.equal(hooksMeta.pages.includes('use-reveal-progress'), true);
});
