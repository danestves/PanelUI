import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/accordion/index.tsx', import.meta.url),
  'utf8'
);

// The shared value is seeded from `isExpanded`, so a mount-time `withTiming`
// would animate from a value to itself. One indicator hides that cost; a list
// of them pays it before the screen can draw.
const MOUNT_GUARD = /const first = useRef\(true\);[\s\S]*?if \(first\.current\) \{\s*first\.current = false;\s*return;\s*\}\s*progress\.value =/;

test('Accordion.Indicator does not animate on mount', () => {
  assert.match(source, /const progress = useSharedValue\(isExpanded \? 1 : 0\)/);
  assert.match(source, MOUNT_GUARD);
});

test('the copied Accordion source retains the mount guard', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/accordion.json', import.meta.url),
      'utf8'
    )
  );
  const copied = item.files.find((file) => file.path === 'ui/accordion.tsx').content;
  assert.match(copied, MOUNT_GUARD);
});
