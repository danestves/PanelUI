import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/breadcrumb/index.tsx', import.meta.url), 'utf8');

function assertEllipsisContracts(content) {
  assert.match(content, /<View\s*ref=\{ref\}\s*\{\.\.\.\(props as ViewProps\)\}\s*accessibilityLabel="More"/);
  assert.match(content, /<AnimatedPressable\s*ref=\{ref\}\s*\{\.\.\.props\}\s*accessibilityRole="button"\s*accessibilityLabel="Show more"[\s\S]*onPress=\{onPress\}/);
}

test('Breadcrumb.Ellipsis forwards static props and owns both branch contracts', () => assertEllipsisContracts(source));

test('the copied Breadcrumb source retains both ellipsis contracts', async () => {
  const item = JSON.parse(await readFile(new URL('../../../apps/docs/public/r/breadcrumb.json', import.meta.url), 'utf8'));
  assertEllipsisContracts(item.files.find((file) => file.path === 'ui/breadcrumb.tsx').content);
});
