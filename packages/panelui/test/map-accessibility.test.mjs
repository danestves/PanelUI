import assert from 'node:assert/strict';
import test from 'node:test';
import { describeMapFeatures } from '../src/components/map/map-accessibility.ts';

const alpha = {
  type: 'Feature',
  properties: { name: 'Alpha', selected: true },
};
const beta = { type: 'Feature', properties: { name: 'Beta', selected: false } };

test('describes every feature from the same FeatureCollection used by the layer', () => {
  const described = describeMapFeatures(
    { type: 'FeatureCollection', features: [alpha, beta] },
    (feature, index) => ({
      label: `${index + 1}. ${feature.properties.name}`,
      hint: 'Show details',
      state: { selected: feature.properties.selected },
    })
  );

  assert.deepEqual(described, [
    {
      feature: alpha,
      label: '1. Alpha',
      hint: 'Show details',
      state: { selected: true },
    },
    {
      feature: beta,
      label: '2. Beta',
      hint: 'Show details',
      state: { selected: false },
    },
  ]);
});

test('describes a single Feature and keeps its identity for activation', () => {
  const [described] = describeMapFeatures(alpha, (feature) => ({
    label: feature.properties.name,
  }));

  assert.equal(described.feature, alpha);
  assert.equal(described.label, 'Alpha');
});

test('does not invent a second representation for URL or invalid data', () => {
  const describe = () => ({ label: 'unreachable' });

  assert.deepEqual(describeMapFeatures('https://example.com/places.geojson', describe), []);
  assert.deepEqual(describeMapFeatures({ type: 'FeatureCollection' }, describe), []);
  assert.deepEqual(describeMapFeatures(null, describe), []);
});
