import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = (name) =>
  readFile(new URL(`../src/components/${name}/index.tsx`, import.meta.url), 'utf8');

test('SearchBar owns the clear control instead of the platform one', async () => {
  const source = await component('search-bar');

  // Both would be drawn at once on iOS, and only one of them can be labelled.
  assert.match(source, /clearButtonMode="never"/);
  assert.match(source, /accessibilityLabel=\{clearLabel\}/);
  assert.match(source, /accessibilityRole="search"/);
  assert.match(source, /returnKeyType="search"/);

  // Slop rather than a sized box: a 48-point circle does not fit a 40-point
  // field, and growing the field would change every row it has been put in.
  assert.match(source, /const CLEAR_HIT_SLOP = 12/);
  assert.match(source, /hitSlop=\{CLEAR_HIT_SLOP\}/);

  // The spinner replaces the clear button rather than joining it.
  assert.match(source, /loading \? \(\s*<Spinner/);
});

test('SearchBar keeps focus after clearing and drops it after cancelling', async () => {
  const source = await component('search-bar');

  const clear = source.slice(source.indexOf('const handleClear'));
  assert.match(clear.slice(0, 400), /inputRef\.current\?\.focus\(\)/);

  const cancel = source.slice(source.indexOf('const handleCancel'));
  assert.match(cancel.slice(0, 400), /inputRef\.current\?\.blur\(\)/);
});

test('SearchBar debounces the query without debouncing the field', async () => {
  const source = await component('search-bar');

  // onChangeText is handed straight on — a controlled field that lags its own
  // keystrokes is unusable.
  assert.match(source, /onChangeText\?\.\(next\)/);

  // The callback is read through a ref, so an inline arrow function does not
  // restart the timer on every render and push the pause out forever.
  assert.match(source, /const debouncedRef = useRef\(onDebouncedChange\)/);
  assert.match(source, /debouncedRef\.current\?\.\(text\)/);
  assert.match(source, /return \(\) => clearTimeout\(timer\)/);

  // Submitting spends the pending pause rather than waiting it out.
  const submit = source.slice(source.indexOf('const handleSubmit'));
  assert.match(submit.slice(0, 400), /debouncedRef\.current\?\.\(text\)[\s\S]*onSubmit\?\.\(text\)/);
});

test('the Cancel button is measured once and animated on the UI thread', async () => {
  const source = await component('search-bar');

  assert.match(source, /const cancelWidth = useSharedValue\(0\)/);
  assert.match(source, /cancelWidth\.value = event\.nativeEvent\.layout\.width/);
  assert.match(source, /useAnimatedStyle\(\(\) => \(\{\s*width: \(cancelWidth\.value \+ CANCEL_GAP\) \* cancelProgress\.value/);

  // Always mounted, so the first slide has the measurement the tenth has.
  assert.match(source, /if \(cancel === 'never'\) return field;/);

  // Hidden from touch and from assistive technology while it is folded away.
  assert.match(source, /pointerEvents=\{cancelOut \? 'auto' : 'none'\}/);
  assert.match(source, /accessibilityElementsHidden=\{!cancelOut\}/);
});
