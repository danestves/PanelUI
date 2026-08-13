import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React, { Children, Fragment, isValidElement } from 'react';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/components/carousel/index.tsx', import.meta.url),
  'utf8'
);

function sourceFunction(name) {
  const match = source.match(new RegExp(`function ${name}[^]*?\\n\\}`));
  assert.ok(match, `${name} helper is present`);
  return ts.transpileModule(match[0], {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const renderableChildren = new Function(
  'Children',
  `${sourceFunction('renderableChildren')}; return renderableChildren;`
)(Children);
const renderableChildKey = new Function(
  'isValidElement',
  `${sourceFunction('renderableChildKey')}; return renderableChildKey;`
)(isValidElement);

function slide(key) {
  return React.createElement('slide', { key });
}

test('empty conditional children do not occupy slide indices', () => {
  const children = [slide('first'), null, false, undefined, slide('last')];
  const slides = renderableChildren(children);

  assert.equal(Children.count(children), 5, 'reproduces the raw-count bug');
  assert.equal(slides.length, 2);
  assert.deepEqual(
    slides.map((_child, index) => index),
    [0, 1]
  );
  assert.deepEqual(
    slides.map((_child, index) => `Slide ${index + 1} of ${slides.length}`),
    ['Slide 1 of 2', 'Slide 2 of 2']
  );
});

test('keyed elements and fragments keep their React child identity', () => {
  const group = React.createElement(Fragment, { key: 'group' }, slide('a'), slide('b'));
  const slides = renderableChildren([slide('first'), false, group, null, slide('last')]);

  assert.equal(slides.length, 3);
  assert.equal(slides[1].type, Fragment);
  assert.equal(Children.count(slides[1].props.children), 2);
  assert.deepEqual(
    slides.map(renderableChildKey),
    slides.map((child) => child.key)
  );
  assert.equal(new Set(slides.map(renderableChildKey)).size, 3);
});

test('content derives count, item positions, keys, and dot labels from the same list', () => {
  assert.match(source, /const slides = renderableChildren\(children\);/);
  assert.match(source, /setCount\(slides\.length\);/);
  assert.match(source, /slides\.map\(\(child, index\) => \(/);
  assert.match(
    source,
    /ItemIndexContext\.Provider key=\{renderableChildKey\(child, index\)\} value=\{index\}/
  );
  assert.match(source, /Array\.from\(\{ length: count \}/);
  assert.match(source, /accessibilityLabel=\{`Slide \$\{dot \+ 1\} of \$\{count\}`\}/);
});
