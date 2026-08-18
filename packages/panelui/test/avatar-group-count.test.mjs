import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  AVATAR_SIZE_POINTS,
  avatarGroupCount,
  avatarGroupOverlap,
} from '../src/components/avatar/avatar-group.ts';

const sourceAvatar = await readFile(
  new URL('../src/components/avatar/index.tsx', import.meta.url),
  'utf8'
);


test('an unusable cap shows everybody rather than nobody', () => {
  assert.deepEqual(avatarGroupCount(5), { visible: 5, overflow: 0 });
  assert.deepEqual(avatarGroupCount(5, 0), { visible: 5, overflow: 0 });
  assert.deepEqual(avatarGroupCount(5, -3), { visible: 5, overflow: 0 });
  assert.deepEqual(avatarGroupCount(5, Number.NaN), { visible: 5, overflow: 0 });
  assert.deepEqual(avatarGroupCount(5, Number.POSITIVE_INFINITY), {
    visible: 5,
    overflow: 0,
  });
});

test('the cap counts faces, and the rest are counted behind them', () => {
  assert.deepEqual(avatarGroupCount(5, 3), { visible: 3, overflow: 2 });
  assert.deepEqual(avatarGroupCount(3, 3), { visible: 3, overflow: 0 });
  assert.deepEqual(avatarGroupCount(2, 3), { visible: 2, overflow: 0 });
  assert.deepEqual(avatarGroupCount(5, 2.7), { visible: 2, overflow: 3 });
});

test('a total only ever adds to the count', () => {
  assert.deepEqual(avatarGroupCount(3, 3, 40), { visible: 3, overflow: 37 });
  assert.deepEqual(avatarGroupCount(3, undefined, 40), {
    visible: 3,
    overflow: 37,
  });
  // Stale or nonsensical totals never claim there are fewer people than the
  // row is already showing.
  assert.deepEqual(avatarGroupCount(5, undefined, 2), { visible: 5, overflow: 0 });
  assert.deepEqual(avatarGroupCount(5, 3, -10), { visible: 3, overflow: 2 });
  assert.deepEqual(avatarGroupCount(5, 3, Number.NaN), { visible: 3, overflow: 2 });
});

test('an empty stack stays empty', () => {
  assert.deepEqual(avatarGroupCount(0, 3), { visible: 0, overflow: 0 });
  assert.deepEqual(avatarGroupCount(Number.NaN, 3), { visible: 0, overflow: 0 });
  assert.deepEqual(avatarGroupCount(0, 3, 4), { visible: 0, overflow: 4 });
});

test('the slide scales with the size and never opens a gap', () => {
  for (const size of Object.keys(AVATAR_SIZE_POINTS)) {
    const slide = avatarGroupOverlap(size);
    assert.ok(slide > 0 && slide < AVATAR_SIZE_POINTS[size]);
  }
  assert.ok(avatarGroupOverlap('xl') > avatarGroupOverlap('sm'));

  assert.equal(avatarGroupOverlap('md', 0), 0);
  assert.equal(avatarGroupOverlap('md', 6), 6);
  assert.equal(avatarGroupOverlap('md', -6), 0);
  assert.equal(avatarGroupOverlap('md', 999), AVATAR_SIZE_POINTS.md);
  assert.equal(
    avatarGroupOverlap('md', Number.NaN),
    avatarGroupOverlap('md')
  );
});

test('the copied Avatar ships the stack arithmetic', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/avatar.json', import.meta.url),
      'utf8'
    )
  );
  assert.ok(item.files.some((file) => file.path === 'ui/avatar-group.ts'));
  assert.match(
    item.files.find((file) => file.path === 'ui/avatar.tsx').content,
    /avatarGroupCount\(faces\.length, max, total\)/
  );
});

test('Avatar.Group keeps visual stacking independent from logical list order', () => {
  const group = sourceAvatar.slice(sourceAvatar.indexOf('const AvatarGroup ='));
  assert.match(group, /for \(let index = 0; index < visible; index \+= 1\)/);
  assert.ok(group.indexOf("key: 'overflow'") > group.indexOf('index < visible'));
  assert.match(group, /className=\{cn\('flex-row self-start'/);
  assert.doesNotMatch(group, /flex-row-reverse/);
  assert.match(group, /role="listitem"/);
  assert.match(group, /zIndex: stack\.length - index/);
  assert.match(group, /marginStart: index === 0 \? 0 : -slide/);
  assert.ok(group.indexOf('{...props}') < group.indexOf('accessibilityRole="list"'));
});
