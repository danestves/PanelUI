/**
 * One value owns the sheet's travel, and the backdrop is derived from it.
 *
 * Reported as a sheet that never appeared on a later open while the scrim went
 * fully opaque — a greyed screen with nothing on it, and no way back. The
 * backdrop's opacity is interpolated from `translateY`, so a fully opaque scrim
 * proves the sheet is at its rest position; what held it off screen was the
 * entrance, which had been handed to a `SlideInDown` layout animation instead.
 * That is a second mechanism with its own state, and it does not replay
 * reliably when the view remounts inside the portal — two sheets sharing a
 * screen is enough — so the view stayed parked at that animation's initial
 * offset while `translateY` read zero and the two disagreed for good.
 *
 * The entrance is `translateY` moving to zero. Nothing here can be restored by
 * looking at the sheet on its own: it takes a second sheet on the same screen
 * to see it fail.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sheet = await readFile(
  new URL('../src/components/bottom-sheet/index.tsx', import.meta.url),
  'utf8'
);

test('the sheet starts off screen rather than at rest', () => {
  assert.match(sheet, /useSharedValue\(reducedMotion \? 0 : screenHeight\)/);
});

test('no entering layout animation owns the travel', () => {
  // Reduced motion keeps a fade, which moves nothing and cannot disagree with
  // `translateY`. Anything else on this prop is a second owner of the position.
  assert.match(sheet, /entering=\{reducedMotion \? FadeIn\.duration\(150\) : undefined\}/);
  // The name survives in a comment explaining why it went; the import and any
  // use of it are what must not come back.
  assert.doesNotMatch(sheet, /^\s*SlideInDown,$/m);
  assert.doesNotMatch(sheet, /SlideInDown\./);
});

test('the backdrop and the sheet read the same value', () => {
  assert.match(sheet, /transform: \[\{ translateY: translateY\.value \}\]/);
  assert.match(sheet, /opacity: interpolate\(\s*translateY\.value/);
});
