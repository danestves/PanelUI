/**
 * The reveal clip has to declare a width, not only animate one.
 *
 * Every chart that uncovers itself on mount does it with a `<Rect>` inside a
 * `<ClipPath>` whose width is driven by the reveal. Animated props on an
 * element inside `<Defs>` do not reach the native clip on every platform, and
 * where they do not, a rect whose width comes *only* from the animation has no
 * width at all — an empty clip, and every mark inside it invisible while the
 * axes and labels draw normally, because those sit outside the clip.
 *
 * That is a blank chart with no error, on one platform, that nobody sees in
 * review. So the static attribute is a contract rather than a belt-and-braces:
 * with it the worst case is the reveal not playing.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/** Component, and the geometry its clip spans. */
const CLIPPED = [
  ['plot', 'plot.width'],
  ['line-chart', 'plot.width'],
  ['area-chart', 'plot.width'],
  ['heatmap-chart', 'grid.width'],
  ['hex-chart', 'width'],
];

/** Every `<AnimatedRect …/>` element in a source file, as its raw text. */
function animatedRects(source) {
  const found = [];
  const opener = /<AnimatedRect\b/g;
  let match;
  while ((match = opener.exec(source)) !== null) {
    const end = source.indexOf('/>', match.index);
    if (end === -1) continue;
    found.push(source.slice(match.index, end + 2));
  }
  return found;
}

for (const [slug, extent] of CLIPPED) {
  test(`${slug} declares a static width on its reveal clip`, async () => {
    const source = await readFile(
      new URL(`../src/components/${slug}/index.tsx`, import.meta.url),
      'utf8'
    );

    const rects = animatedRects(source);
    assert.ok(
      rects.length > 0,
      `expected ${slug} to draw its reveal clip with an AnimatedRect`
    );

    for (const rect of rects) {
      assert.match(
        rect,
        /\bwidth=\{/,
        `an AnimatedRect in ${slug} has no static width, so the clip collapses ` +
          `to nothing wherever animated props do not reach it:\n${rect}`
      );
      assert.ok(
        rect.includes(`width={${extent}}`),
        `expected the clip in ${slug} to span ${extent}:\n${rect}`
      );
    }
  });
}
