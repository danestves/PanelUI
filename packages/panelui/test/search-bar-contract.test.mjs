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

test('a disabled SearchBar rejects clear, cancel, and submit at their boundaries', async () => {
  const source = await component('search-bar');

  for (const handler of ['handleSubmit', 'handleClear', 'handleCancel']) {
    const body = source.slice(source.indexOf(`const ${handler}`));
    assert.match(body.slice(0, 260), /if \(disabled\) return;/);
  }

  const cancel = source.slice(source.indexOf('onLayout={handleCancelLayout}'));
  assert.match(cancel.slice(0, 500), /disabled=\{disabled\}/);
  assert.match(cancel.slice(0, 500), /focusable=\{!disabled\}/);
  assert.match(cancel.slice(0, 500), /accessibilityState=\{\{ disabled: !!disabled \}\}/);
});

test('SearchBar debounces the query without debouncing the field', async () => {
  const source = await component('search-bar');

  // onChangeText is handed straight on — a controlled field that lags its own
  // keystrokes is unusable.
  assert.match(source, /onChangeText\?\.\(next\)/);

  // The callback is read through a ref, so an inline arrow function does not
  // restart the timer on every render and push the pause out forever.
  assert.match(source, /const debouncedRef = useRef\(onDebouncedChange\)/);
  assert.match(source, /scheduleSearchBarDebounce\(debounceTimerRef, debouncedRef\.current, text, debounce\)/);
  assert.match(source, /cancelSearchBarDebounce\(debounceTimerRef\)/);

  // Submitting spends the pending pause rather than waiting it out.
  const submit = source.slice(source.indexOf('const handleSubmit'));
  assert.match(submit.slice(0, 500), /flushSearchBarDebounce\(debounceTimerRef, debouncedRef\.current, text\)[\s\S]*onSubmit\?\.\(text\)/);
});

test('the Cancel button is measured once and animated on the UI thread', async () => {
  const source = await component('search-bar');

  assert.match(source, /const cancelWidth = useSharedValue\(0\)/);
  assert.match(source, /cancelWidth\.value = event\.nativeEvent\.layout\.width/);
  assert.match(source, /useAnimatedStyle\(\(\) => \(\{\s*width: \(cancelWidth\.value \+ CANCEL_GAP\) \* cancelProgress\.value/);

  // Hidden from touch and from assistive technology while it is folded away.
  assert.match(source, /pointerEvents=\{cancelOut \? 'auto' : 'none'\}/);
  assert.match(source, /accessibilityElementsHidden=\{!cancelOut\}/);
});

test('a bare SearchBar stays a bare field', async () => {
  const source = await component('search-bar');

  // Nothing beside it and nothing under it: no anchor, no keyboard wrapper, no
  // row — a box around it is only something for the caller's layout to fight.
  assert.match(
    source,
    /if \(cancel === 'never' && !avoidKeyboard && !hasPanel\) \{/
  );
});

test('the results panel opens away from the keyboard and keeps its taps', async () => {
  const source = await component('search-bar');

  // Upward by default: the space under a focused field belongs to the keyboard.
  assert.match(source, /panelPlacement = 'top'/);

  // Absolute, so opening the panel never moves the page under the field.
  assert.match(source, /const CARD_ABOVE: ViewStyle = \{ position: 'absolute', bottom: 0/);

  // One box around the results and the field, so the card has one outline. Two
  // would disagree: a field with a panel open is a focused field, and its own
  // edge is the focus ring rather than the border the panel draws.
  assert.match(source, /panel: 'overflow-hidden rounded-2xl border border-border/);
  assert.match(source, /top: \{ field: 'rounded-t-none rounded-b-2xl border-0' \}/);

  // Android draws siblings in tree order, so the field's box needs both.
  assert.match(source, /const RAISED: ViewStyle = \{ zIndex: 20, elevation: 20 \}/);

  // `always`, not `handled`: everything in the panel that is not itself a
  // button — the padding, the gaps between rows, a section heading, the whole
  // of Status — would otherwise spend the first tap dismissing the keyboard,
  // and a blurred field closes the panel around whatever was pressed.
  assert.match(source, /keyboardShouldPersistTaps="always"/);
  assert.doesNotMatch(source, /keyboardShouldPersistTaps="handled"/);

  // The panel is capped by the room it actually has, not by a constant.
  assert.match(source, /const PANEL_MIN_HEIGHT = 160/);
  assert.match(source, /maxHeight: resolvedMaxHeight/);
});

test('SearchBar lifts the whole row, behind a component boundary', async () => {
  const source = await component('search-bar');

  // A flag would call the keyboard hook on every search bar in the app, which
  // takes Android out of adjustResize for all of them.
  assert.match(
    source,
    /if \(avoidKeyboard\) \{\s*return \(\s*<SearchBarContext\.Provider value=\{context\}>\s*<KeyboardAvoider/
  );
  assert.match(source, /active=\{focused\}/);
  assert.match(source, /mode="lift"/);

  // Input's own keyboard props are dropped: they would move the field and
  // leave the Cancel button and the panel behind.
  for (const prop of [
    "| 'avoidKeyboard'",
    "| 'keyboardBottomInset'",
    "| 'keyboardMode'",
    "| 'keyboardOffset'",
  ]) {
    assert.ok(source.includes(prop), `expected InheritedInputProps to omit ${prop}`);
  }
});

test('SearchBar exposes the panel parts', async () => {
  const source = await component('search-bar');

  assert.match(
    source,
    /export const SearchBar = Object\.assign\(SearchBarRoot, \{\s*Section: SearchBarSection,\s*Item: SearchBarItem,\s*Action: SearchBarAction,\s*Token: SearchBarToken,\s*Status: SearchBarStatus,\s*\}\)/
  );

  // A row is a wide target; one that shrinks under the finger reads as a card.
  const item = source.slice(source.indexOf('function SearchBarItem'));
  assert.match(item.slice(0, 1400), /pressScale=\{1\}/);
});

test('a press inside the panel holds the field rather than ending the search', async () => {
  const source = await component('search-bar');

  // The guard is set before the press is served, not after: the blur it may
  // cause is what unmounts the row the press is still travelling through.
  const item = source.slice(source.indexOf('function SearchBarItem'));
  assert.match(item.slice(0, 1400), /onPressIn=\{\(event\) => \{\s*search\?\.retainFocus\(\);/);

  const action = source.slice(source.indexOf('function SearchBarAction'));
  assert.match(action.slice(0, 900), /onPressIn=\{\(event\) => \{\s*search\?\.retainFocus\(\);/);

  // A blur arriving under the guard asks for focus back instead of closing.
  const blur = source.slice(source.indexOf('const handleBlur'));
  assert.match(blur.slice(0, 400), /if \(guarded\.current\) \{\s*inputRef\.current\?\.focus\(\);\s*return;/);

  // The timer is cleared on unmount, so a press on the way out cannot fire
  // into a component that has gone.
  assert.match(source, /if \(guardTimer\.current\) clearTimeout\(guardTimer\.current\)/);
});

test('the slot the panel keeps for the field is never zero', async () => {
  const source = await component('search-bar');

  // Measured height, or the field's known height until the measurement lands.
  // Zero puts the last row under the field, which is painted over the card and
  // takes the touch — the press then reads as a tap on the input.
  assert.match(source, /const FIELD_HEIGHT = \{ sm: 40, md: 48, lg: 56 \} as const/);
  assert.match(source, /height: anchorBox\?\.height \?\? FIELD_HEIGHT\[size\]/);
});

test('tokens sit inside the field and come off with backspace', async () => {
  const source = await component('search-bar');

  // In the field's start content, which Input measures into the text's padding
  // — so the caret starts after the chips however many there are.
  assert.match(source, /const startContent = tokenRow \? \(/);
  assert.match(source, /const TOKEN_MAX_SHARE = 0\.6/);
  assert.match(source, /maxWidth: anchorBox \? anchorBox\.width \* TOKEN_MAX_SHARE : undefined/);

  // Only on an empty field: while there is a query, backspace is editing it.
  const keyPress = source.slice(source.indexOf('const handleKeyPress'));
  assert.match(
    keyPress.slice(0, 500),
    /event\.nativeEvent\.key === 'Backspace' && text\.length === 0/
  );
});

test('nothing the card draws over the field can take a touch', async () => {
  const source = await component('search-bar');

  /*
   * The card is one box around the results and the field, so it carries a
   * spacer where the field sits. A plain view drawn over a focused field is
   * the platform's cue to dismiss the keyboard, so a touch it wins blurs the
   * field and closes the panel drawn out of that focus — tapping the search
   * box shuts the results. This shipped once.
   */
  assert.match(
    source,
    /const fieldSlot = \(\s*<View\s*key="slot"\s*pointerEvents="none"/
  );
  assert.match(source, /key="divider"\s*pointerEvents="none"/);

  // The card is a surface, not a target: only its rows answer a touch.
  const card = source.slice(source.indexOf('exiting={FadeOut.duration(PANEL_OUT)}'));
  assert.match(card.slice(0, 600), /pointerEvents="box-none"/);
});

test('a blur while the keyboard is up is answered, not believed', async () => {
  const source = await component('search-bar');

  // The guard only covers this component's own parts; a caller's Pressable in
  // a row takes the touch itself and is never seen. The keyboard is the
  // catch-all: still up means the search is still on screen.
  assert.match(source, /const BLUR_GRACE = 220;/);
  const blur = source.slice(source.indexOf('const handleBlur'));
  assert.match(
    blur.slice(0, 1200),
    /if \(!ending\.current && keyboardUp\.current\) \{\s*\/\/[\s\S]{0,200}inputRef\.current\?\.focus\(\);/
  );

  // Cancel is deliberate and must not have its focus handed back.
  const cancel = source.slice(source.indexOf('const handleCancel'));
  assert.match(cancel.slice(0, 600), /ending\.current = true;/);
});
