import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/drawer/index.tsx', import.meta.url),
  'utf8'
);

test('a dismissed panel leaves once, from wherever the finger left it', () => {
  // The exit is written rather than taken from a preset. A preset animates from
  // the view's layout position and applies its own transform, which overrides
  // the drag's — so the panel was put back at zero and slid out a second time.
  assert.doesNotMatch(source, /SlideOut(?:Left|Right|Up|Down)/);
  assert.match(source, /const from = travel\.value \* outward;/);
  assert.match(source, /initialValues: \{[\s\S]{0,200}?translateX: from/);

  // And the drag hands the panel straight over rather than finishing the slide
  // itself, which would be the same distance animated twice.
  const release = source.slice(source.indexOf('.onEnd((event)'));
  assert.match(
    release.slice(0, 600),
    /DISMISS_VELOCITY\) \{[\s\S]{0,320}?runOnJS\(close\)\(\);/
  );
  assert.doesNotMatch(release.slice(0, 600), /travel\.value = withTiming\(extent/);
});

test('the copied Drawer ships the same exit', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/drawer.json', import.meta.url),
      'utf8'
    )
  );
  const copied = item.files.find((file) => file.path === 'ui/drawer.tsx').content;
  assert.match(copied, /const from = travel\.value \* outward;/);
  assert.doesNotMatch(copied, /SlideOut(?:Left|Right|Up|Down)/);
});
