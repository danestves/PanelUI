import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const glassSource = await readFile(
  new URL('../src/primitives/glass.tsx', import.meta.url),
  'utf8'
);
const inputSource = await readFile(
  new URL('../src/components/ai-input/index.tsx', import.meta.url),
  'utf8'
);

function assertGlassGates(content) {
  // Optional, so the require can fail and the component still has to work.
  assert.match(content, /try \{[\s\S]{0,200}?require\('expo-glass-effect'\)/);
  assert.match(content, /\} catch \{\s*return null;\s*\}/);

  // Three gates, all of them load-bearing. `isGlassEffectAPIAvailable` is not
  // decoration: some iOS 26 builds ship without the API and reaching for it
  // there crashes, which a try/catch in JavaScript cannot catch.
  assert.match(content, /Platform\.OS !== 'ios'/);
  assert.match(content, /isGlassEffectAPIAvailable/);
  assert.match(content, /isLiquidGlassAvailable/);

  // Nothing is faked where the material does not exist — the fallback is a
  // token surface, not a hand-drawn approximation of a system material.
  assert.match(content, /fallbackClassName/);
}

test('the material is reached lazily and behind every availability gate', () => {
  assertGlassGates(glassSource);
});

test('Reduce Transparency is asked once, in one place', () => {
  // Two materials querying the platform separately is two answers to one
  // question, and the one that answers first wins the flash.
  assert.match(glassSource, /import \{ useReduceTransparency \} from '\.\/scrim'/);
  assert.doesNotMatch(glassSource, /AccessibilityInfo/);
  // Not knowing yet counts as "do not draw it": a material arriving a frame
  // late is invisible, one flashing at somebody who opted out is not.
  assert.match(glassSource, /reduceTransparency === false/);
});

/** Every `<Glass …>` opening tag in a source file, attributes and all. */
function glassTags(content) {
  const tags = [];
  for (let at = content.indexOf('<Glass'); at !== -1; at = content.indexOf('<Glass', at + 1)) {
    const end = content.indexOf('>', at);
    tags.push(content.slice(at, end + 1));
  }
  return tags;
}

test('the material is never faded, only moved or unmounted', () => {
  // Setting opacity to 0 on the material or on any view above it stops it
  // rendering at all, and it does not come back when the opacity does. So the
  // material itself animates nothing.
  assert.doesNotMatch(glassSource, /withTiming|withSpring|FadeIn|FadeOut/);

  // And nothing hands one an entering, exiting or opacity animation. The
  // screen slide fades a plain view *inside* the material, which is a
  // different thing and is why this checks the tags rather than the file.
  const tags = glassTags(inputSource);
  assert.ok(tags.length > 0, 'AI Input should draw its surfaces with Glass');
  for (const tag of tags) {
    // Not just animated opacity: a static dim degrades a system material
    // too, so a disabled control dims its glyph and leaves the glass alone.
    assert.doesNotMatch(tag, /entering=|exiting=|opacity/, tag);
  }

  // The slide itself is a translation, with its distance chosen rather than
  // inherited from a preset that does not expose one.
  assert.match(inputSource, /translateX: direction \* offset/);
});

test('the copied AI Input ships the same gates', async () => {
  const item = JSON.parse(
    await readFile(new URL('../../../apps/docs/public/r/glass.json', import.meta.url), 'utf8')
  );
  const copied = item.files.find((file) => file.path === 'ui/glass.tsx').content;
  assertGlassGates(copied);

  // And it is reported as optional rather than installed on anybody's behalf.
  assert.deepEqual(item.optionalDependencies, ['expo-glass-effect']);
  assert.ok(!(item.dependencies ?? []).includes('expo-glass-effect'));
});

test('the composer draws no waveform of its own', () => {
  // Soundwave already solves this, and a second meter drawn here would be a
  // second set of smoothing constants to keep in step with the first.
  assert.match(inputSource, /import \{ Soundwave \} from '\.\.\/soundwave'/);
  assert.doesNotMatch(inputSource, /<Svg/);
  assert.doesNotMatch(inputSource, /useFrameCallback/);
});

test('the composer never touches the microphone', () => {
  // The app owns the recorder — the permission prompt, the session, the
  // platform quirks — which is what keeps this free of an audio dependency.
  assert.doesNotMatch(inputSource, /expo-audio|Audio\.|getPermissions|requestPermissions/);
  assert.match(inputSource, /onRecordCancel/);
  assert.match(inputSource, /onRecordConfirm/);
});

test('every circular control is a sized box with the pressable filling it', () => {
  /*
   * A pressable that sizes itself and centres its own glyph put the glyph off
   * centre; the same button built as a sized View with the pressable stretched
   * inside it did not. So the size lives on a wrapper and the pressable always
   * fills it, everywhere, rather than only where somebody noticed.
   */
  const sized = [...inputSource.matchAll(/style=\{\{ width: [^}]+height: [^}]+\}\}/g)];
  assert.ok(sized.length >= 4, 'the circular controls should still be explicitly sized');

  for (const match of [...inputSource.matchAll(/<AnimatedPressable[\s\S]{0,600}?>/g)]) {
    const tag = match[0];
    assert.doesNotMatch(tag, /style=\{\{ width/, `a pressable sizes itself:\n${tag}`);
  }

  // And nothing hosts a platform symbol in one. A hosted view reports a box
  // with the symbol's font metrics in it, which is not the box it draws in.
  assert.doesNotMatch(inputSource, /getNativeUI|matchContents/);
});

test('every control that hands over still carries its press handler', () => {
  /*
   * A native control is drawn by the platform, so a dropped `onPress` looks
   * exactly like a working button — there is no visual tell at all. Each
   * handoff is checked for the handler it was given rather than trusted.
   */
  for (const match of [...inputSource.matchAll(/<Button\b[\s\S]{0,500}?>/g)]) {
    const tag = match[0];
    assert.match(tag, /\bnative\b/, `a Button here should hand over:\n${tag}`);
    assert.match(tag, /onPress=\{/, `a handed-over control lost its handler:\n${tag}`);
    assert.match(tag, /accessibilityLabel=\{/, `the platform draws no label of its own:\n${tag}`);
  }
});
