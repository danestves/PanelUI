import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unifiedDiff } from '../src/diff.mjs';

test('unifiedDiff renders updates with three lines of context', () => {
  assert.equal(
    unifiedDiff(
      'components/ui/card.tsx',
      'one\ntwo\nthree\n',
      'one\nchanged\nthree\n',
    ),
    [
      '--- a/components/ui/card.tsx',
      '+++ b/components/ui/card.tsx',
      '@@ -1,3 +1,3 @@',
      ' one',
      '-two',
      '+changed',
      ' three',
    ].join('\n'),
  );
});

test('unifiedDiff uses dev/null and preserves missing-final-newline markers', () => {
  assert.equal(
    unifiedDiff('lib/helper.ts', null, 'first\nlast'),
    [
      '--- /dev/null',
      '+++ b/lib/helper.ts',
      '@@ -0,0 +1,2 @@',
      '+first',
      '+last',
      '\\ No newline at end of file',
    ].join('\n'),
  );
  assert.equal(
    unifiedDiff('lib/helper.ts', 'first\nlast', null),
    [
      '--- a/lib/helper.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-first',
      '-last',
      '\\ No newline at end of file',
    ].join('\n'),
  );
});

test('unifiedDiff separates distant changes into deterministic hunks', () => {
  const before = 'a\nb\nc\nd\ne\nf\ng\nh\ni\n';
  const output = unifiedDiff(
    'value.txt',
    before,
    before.replace('a\n', 'A\n').replace('i\n', 'I\n'),
  );
  assert.equal(output.match(/^@@ /gm)?.length, 2);
  assert.match(output, /@@ -1,4 \+1,4 @@/);
  assert.match(output, /@@ -6,4 \+6,4 @@/);
});

test('unifiedDiff handles large replacements without an unbounded edit trace', () => {
  const before = `${Array.from({ length: 251 }, (_, index) => `old ${index}`).join('\n')}\n`;
  const after = `${Array.from({ length: 251 }, (_, index) => `new ${index}`).join('\n')}\n`;
  const output = unifiedDiff('large.txt', before, after);
  assert.match(output, /@@ -1,251 \+1,251 @@/);
  assert.match(output, /-old 250\n\+new 0/);
});
