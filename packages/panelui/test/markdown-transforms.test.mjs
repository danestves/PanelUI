/**
 * What a formatting toolbar cannot get wrong.
 *
 * Every one of these is about where the caret ends up, because that is what
 * makes a toolbar feel broken — not the characters it inserts. A button that
 * only ever adds is a button you can press once; a block action that hands
 * back the whole block selected is a list the next keystroke deletes.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  continueList,
  hasFence,
  hasLinePrefix,
  hasOrderedList,
  hasWrap,
  insertImage,
  toggleFence,
  toggleLinePrefix,
  toggleWrap,
} from '../src/components/markdown-editor/markdown-transforms.ts';

const caret = (at) => ({ start: at, end: at });

test('an inline marker never spans a line break', () => {
  // `**one\ntwo**` is bold in no reader at all, so each line gets its own pair
  // and the writer gets the emphasis they asked for.
  const text = 'one\ntwo';
  const { text: next } = toggleWrap(text, { start: 0, end: text.length }, '**');
  assert.equal(next, '**one**\n**two**');
});

test('and a blank line in the middle of a selection is left alone', () => {
  const text = 'one\n\ntwo';
  const { text: next } = toggleWrap(text, { start: 0, end: text.length }, '**');
  assert.equal(next, '**one**\n\n**two**');
});

test('a line action leaves the caret where the writer had it', () => {
  const text = 'alpha\nbeta';
  // Caret after the `b` of `beta`, offset 7. A caret touches one line, so one
  // line is what gets the prefix.
  const { text: next, selection } = toggleLinePrefix(text, caret(7), '- ');
  assert.equal(next, 'alpha\n- beta');
  // Still after the `b`, now two characters further along its own line — not
  // at the end of the block, and not a selection over the whole of it.
  assert.equal(next.slice(0, selection.start), 'alpha\n- b');
  assert.equal(selection.start, selection.end, 'a caret must not become a selection');
});

test('a real selection stays a selection over the same lines', () => {
  const text = 'alpha\nbeta';
  const { selection } = toggleLinePrefix(text, { start: 0, end: text.length }, '- ');
  assert.notEqual(selection.start, selection.end);
});

test('removing a prefix cannot push the caret past the end of its line', () => {
  const text = '- a';
  const { text: next, selection } = toggleLinePrefix(text, caret(3), '- ');
  assert.equal(next, 'a');
  assert.ok(selection.start <= next.length);
});

test('a fence puts the caret on the code line, wherever the opener starts', () => {
  const text = 'print()';
  const { text: next, selection } = toggleFence(text, { start: 0, end: text.length });
  assert.equal(next, '```\nprint()\n```');
  assert.equal(next.slice(selection.start, selection.end), 'print()');
});

test('and it closes the paragraph after itself', () => {
  const text = 'code\nafter';
  const { text: next } = toggleFence(text, caret(0));
  // A paragraph butted against a closing fence is one some readers swallow.
  assert.match(next, /```\n\nafter$/);
});

test('an image asks for its description first', () => {
  const { text: next, selection } = insertImage('', caret(0));
  assert.equal(next, '![description](url)');
  // The alt text is the thing that actually goes missing, and the URL is the
  // half already on the clipboard.
  assert.equal(next.slice(selection.start, selection.end), 'description');
});

test('and takes a written description as the description', () => {
  const text = 'a chart';
  const { text: next, selection } = insertImage(text, { start: 0, end: text.length });
  assert.equal(next, '![a chart](url)');
  assert.equal(next.slice(selection.start, selection.end), 'url');
});

test('Return inside a list starts the next item', () => {
  const text = '- milk';
  const result = continueList(text, caret(text.length));
  assert.ok(result);
  assert.equal(result.text, '- milk\n- ');
  assert.equal(result.selection.start, result.text.length);
});

test('a numbered list counts on', () => {
  const text = '1. one\n2. two';
  const result = continueList(text, caret(text.length));
  assert.ok(result);
  assert.equal(result.text, '1. one\n2. two\n3. ');
});

test('and nesting is kept', () => {
  const text = '- one\n   - two';
  const result = continueList(text, caret(text.length));
  assert.ok(result);
  assert.equal(result.text, '- one\n   - two\n   - ');
});

test('Return on an empty item ends the list', () => {
  // Otherwise the writer gets a trail of empty bullets to delete by hand.
  const text = '- milk\n- ';
  const result = continueList(text, caret(text.length));
  assert.ok(result);
  assert.equal(result.text, '- milk\n');
  assert.equal(result.selection.start, result.text.length);
});

test('Return outside a list is left to the field', () => {
  assert.equal(continueList('a paragraph', caret(11)), null);
  // A range selected is a Return that replaces it, and guessing which end the
  // writer meant is worse than not guessing.
  assert.equal(continueList('- milk', { start: 2, end: 6 }), null);
});

test('the toolbar can tell what is already applied', () => {
  assert.equal(hasWrap('**bold**', { start: 0, end: 8 }, '**'), true);
  // The markers just outside the selection count too: the writer selected the
  // word, not the asterisks.
  assert.equal(hasWrap('**bold**', { start: 2, end: 6 }, '**'), true);
  assert.equal(hasWrap('plain', { start: 0, end: 5 }, '**'), false);

  assert.equal(hasLinePrefix('- a\n- b', { start: 0, end: 7 }, '- '), true);
  // Every line, not any line — a mixed block is one somebody is making uniform.
  assert.equal(hasLinePrefix('- a\nb', { start: 0, end: 5 }, '- '), false);

  assert.equal(hasOrderedList('1. a\n2. b', { start: 0, end: 9 }), true);
  // A caret on a line of code, which touches one line and says nothing about
  // the fence around it — so this has to be found by looking outward.
  assert.equal(hasFence('```\ncode\n```', caret(5)), true);
  assert.equal(hasFence('code', caret(0)), false);
  assert.equal(hasFence('```\ncode\n```\nafter', caret(15)), false);
});

test('the code button un-fences from inside the fence', () => {
  // Reading only the caret's own line, it used to wrap the fence in a second
  // one — the button stopped being a toggle exactly where it mattered.
  const text = '```\ncode\n```';
  const { text: next } = toggleFence(text, caret(5));
  assert.equal(next, 'code');
});

test('what is applied is what pressing again would undo', () => {
  // The two have to agree, or the toolbar marks a button whose press adds a
  // second pair of markers.
  const cases = [
    ['**bold**', { start: 0, end: 8 }, '**'],
    ['_it_', { start: 0, end: 4 }, '_'],
  ];
  for (const [text, selection, marker] of cases) {
    assert.equal(hasWrap(text, selection, marker), true);
    const { text: next } = toggleWrap(text, selection, marker);
    assert.ok(next.length < text.length, 'pressing again must remove, not add');
  }
});
