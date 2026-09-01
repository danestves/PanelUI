/**
 * Nothing measures a view the layout engine has no metrics for.
 *
 * Reanimated's `measure` prints a warning in that case — "The view has some
 * undefined, not-yet-computed or meaningless value of `LayoutMetrics` type" —
 * and it prints it *before* returning the `null` a caller could have noticed.
 * So the `if (!frame) return` every one of these already had was never enough:
 * the warning had already gone out.
 *
 * It matters because both of these run on a clock. One measures every frame
 * while the keyboard is up; the other measures on every scroll frame, once per
 * element. A single view that has mounted but not laid out — which is every
 * view for a frame or two, and every off-screen row of a list — fills the log
 * on its own.
 *
 * The fix in both is the same: a layout pass is what says the view can be
 * measured, and unmounting takes it back.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file) =>
  readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');

const GUARDED = [
  ['hooks/use-keyboard-avoidance.ts', 'if (!laidOut.value) return;'],
  ['hooks/use-reveal-progress.ts', 'if (!laidOut.value) return 0;'],
];

for (const [file, guard] of GUARDED) {
  test(`${file} does not measure a view it has no metrics for`, async () => {
    const source = await read(file);

    const at = source.indexOf('measure(ref)');
    assert.ok(at > 0, `${file} no longer calls measure(ref) — has it moved?`);

    // The guard has to come first. After the call it is only reading a null
    // the warning has already been printed for.
    const before = source.slice(0, at);
    assert.ok(
      before.includes(guard),
      `${file} calls measure(ref) without \`${guard}\` ahead of it`
    );

    // A layout pass sets it and an unmount clears it, so a view torn down
    // while the clock is still running is not measured on the way out.
    assert.match(source, /laidOut\.value = true;/);
    assert.match(source, /\(\) => \{\s*laidOut\.value = false;\s*\},/);
  });
}

test('every consumer of useRevealProgress wires the layout pass', async () => {
  // The hook cannot set the flag itself — only the element it is attached to
  // knows when it has been laid out. A consumer that takes `ref` and leaves
  // `onLayout` behind gets the warning back.
  for (const file of [
    'components/scroll-text/index.tsx',
    'components/scroll-canvas/index.tsx',
  ]) {
    const source = await read(file);
    assert.match(
      source,
      /const \{ ref, onLayout, progress \} = useRevealProgress\(/,
      `${file} does not take onLayout from useRevealProgress`
    );
    const refs = [...source.matchAll(/ref=\{ref\}/g)].length;
    const layouts = [...source.matchAll(/onLayout=\{onLayout\}/g)].length;
    assert.equal(
      layouts,
      refs,
      `${file} attaches ref in ${refs} place(s) but onLayout in ${layouts}`
    );
  }
});
