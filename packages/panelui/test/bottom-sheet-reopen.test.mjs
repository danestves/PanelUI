/**
 * The sheet has to survive being closed and reopened straight away.
 *
 * Reported as a pause of a second or two before the second sheet appeared. The
 * cause was structural rather than a timer: the subtree was removed from React
 * in the same commit `open` flipped, while an `exiting` layout animation was
 * still declared on it, so Reanimated held the detached views until that spring
 * settled and a reopen inside that window raced it.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sheet = await readFile(
  new URL('../src/components/bottom-sheet/index.tsx', import.meta.url),
  'utf8'
);
const portal = await readFile(
  new URL('../src/primitives/portal.tsx', import.meta.url),
  'utf8'
);

test('the sheet is unmounted by its own exit, not alongside it', () => {
  // The tree comes down when the movement is finished, not when `open` flips.
  assert.match(sheet, /if \(!presented\) return null;/);
  assert.doesNotMatch(sheet, /if \(!open\) return null;/);
});

test('no exit layout animation is left running on a detached tree', () => {
  assert.doesNotMatch(sheet, /exiting=\{/);
  assert.doesNotMatch(sheet, /SlideOutDown/);
});

test('the exit clears the mount from its own completion callback', () => {
  assert.match(sheet, /if \(finished\) runOnJS\(setPresented\)\(false\);/);
  assert.match(sheet, /withSpring\(screenHeight, EXIT_SPRING, land\)/);
});

test('reduced motion still puts the sheet away rather than stranding it', () => {
  // Without a branch here the exit is a spring under a setting that asks for
  // none — and worse, the completion callback is what unmounts the tree, so
  // losing it would leave the sheet mounted for ever.
  assert.match(sheet, /withTiming\(screenHeight, \{ duration: 150 \}, land\)/);
});

test('reopening mid-exit catches the same sheet', () => {
  // `cancelAnimation` before the spring home, and the remount branch guarded on
  // `!presented`, are together what stop a second sheet being scheduled over
  // one that is still leaving.
  assert.match(sheet, /if \(open\) \{\s*cancelAnimation\(translateY\);/);
  assert.match(sheet, /if \(!presented\) \{[\s\S]*?translateY\.value = 0;[\s\S]*?setPresented\(true\);/);
});

/*
 * The platform's own queue, which does not exist. UIKit drops a present that
 * arrives while it is still dismissing, so the request is held and replayed
 * from `onDismiss` — the only signal that says the previous sheet has gone.
 */
test('the native sheet holds a present that arrives mid-dismissal', () => {
  assert.match(sheet, /isPresented=\{nativePresented\}/);
  assert.match(sheet, /onDismiss=\{onNativeDismiss\}/);
  assert.match(sheet, /if \(nativeDismissing\.current\) return;/);
  assert.match(
    sheet,
    /if \(wasOurs\) \{\s*if \(openRef\.current\) \{\s*nativeOnScreen\.current = true;\s*setNativePresented\(true\);/
  );
});

test('a dismissal the reader performed is still reported as a close', () => {
  assert.match(sheet, /if \(dismissible\) close\(\);/);
});

/*
 * Reported as a native sheet that opened once and then never again.
 *
 * The queue waits for `onDismiss` before it lets the next present through, and
 * that report only ever comes for a sheet the platform still had on screen.
 * Arming the wait from `nativePresented` — our record of what we last asked
 * for — caught the reader's own swipe: the platform reported the sheet gone,
 * `close` flipped `open`, and the effect then began waiting for a second
 * report of a dismissal that had already finished. None came, the flag stayed
 * up, and every present after the first was held for ever.
 *
 * The four paths this has to keep straight, all of which end with the flag
 * down and nothing held:
 *
 *   reader swipes    onDismiss (not ours) -> close -> open false, never armed
 *   Close button     open false -> armed -> onDismiss (ours) -> flag down
 *   close, reopen    present held while armed, replayed from onDismiss
 *   reopen after     flag already down, presents straight away
 */
test('a sheet the reader swiped away leaves nothing for the queue to wait for', () => {
  // Armed from the platform's account of what is on screen...
  assert.match(sheet, /if \(nativeOnScreen\.current\) nativeDismissing\.current = true;/);
  // ...and never from our own record of what we last asked for.
  assert.doesNotMatch(sheet, /if \(nativePresented\) nativeDismissing\.current = true;/);

  // `onDismiss` is the platform saying the sheet has gone, whoever asked for
  // it — so it is cleared there before the question of whose dismissal it was.
  const dismiss = sheet.slice(
    sheet.indexOf('const onNativeDismiss = useCallback('),
    sheet.indexOf('const pan = useMemo(')
  );
  assert.ok(
    dismiss.indexOf('nativeOnScreen.current = false;') <
      dismiss.indexOf('const wasOurs = nativeDismissing.current;'),
    'the platform report has to land before the queue reads the flag'
  );

  // And the effect no longer re-runs on our own bookkeeping, which is what
  // gave the stale flag a second chance to be set.
  const queue = sheet.slice(
    sheet.indexOf('const [nativePresented, setNativePresented] = useState(open);'),
    sheet.indexOf('const onNativeDismiss = useCallback(')
  );
  assert.match(queue, /\}, \[nativeSheet, open\]\);/);
});

/*
 * `children` is a new element on every render of whatever owns the portal, so
 * one effect doing both jobs deleted the key from the store and put it back on
 * every one of those renders — two emits, two new Maps and a full host
 * re-render each time, for an overlay that re-renders while it is open.
 */
test('the portal does not tear itself down on every render', () => {
  assert.match(portal, /useEffect\(\(\) => \{\s*store\.mount\(key, children\);\s*\}, \[store, key, children\]\);/);
  assert.match(portal, /useEffect\(\(\) => \(\) => store\.unmount\(key\), \[store, key\]\);/);
});
