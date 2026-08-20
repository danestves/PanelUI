import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import {
  asMapLayer,
  isMapLayer,
  partitionMapChildren,
} from '../src/components/map/map-children.ts';

const Marker = asMapLayer(function Marker() {
  return null;
});
const Controls = function Controls() {
  return null;
};

test('only tagged parts are handed to the renderer', () => {
  assert.equal(isMapLayer(Marker), true);
  assert.equal(isMapLayer(Controls), false);
  assert.equal(isMapLayer('div'), false);
  assert.equal(isMapLayer(null), false);
});

test('chrome is kept out of the native map view', () => {
  const marker = createElement(Marker, { key: 'a' });
  const controls = createElement(Controls, { key: 'b' });

  const { layers, overlay } = partitionMapChildren([marker, controls]);

  assert.equal(layers.length, 1);
  assert.equal(layers[0].type, Marker);
  assert.equal(overlay.length, 1);
  assert.equal(overlay[0].type, Controls);
});

test('a host element is chrome, not a layer', () => {
  const { layers, overlay } = partitionMapChildren(createElement('View', null));
  assert.equal(layers.length, 0);
  assert.equal(overlay.length, 1);
});

test('empty branches reach neither side', () => {
  const { layers, overlay } = partitionMapChildren([null, undefined, false]);
  assert.deepEqual(layers, []);
  assert.deepEqual(overlay, []);
});

test('a bare string is chrome rather than something the renderer drops', () => {
  const { layers, overlay } = partitionMapChildren(['Loading', createElement(Marker)]);
  assert.equal(layers.length, 1);
  assert.deepEqual(overlay, ['Loading']);
});
