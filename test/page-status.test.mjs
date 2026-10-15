/**
 * The sidebar's "new" dot and "Updated" pill are derived from versions, so
 * nobody has to remember to take them off. That only works while the windows
 * are what the docs say they are — three minor releases for a component that
 * arrived, one for a component that changed — and while each collection is
 * measured against its own package: the web collection's 0.1.0 is not a hundred
 * releases old because the library is at 0.112.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { statusOf } from '../apps/docs/scripts/page-status.mjs';

test('"new" lasts three minor releases of the package being documented', () => {
  assert.equal(statusOf({ addedIn: '0.110.0' }, '0.110.0'), 'new');
  assert.equal(statusOf({ addedIn: '0.110.0' }, '0.112.4'), 'new');
  assert.equal(statusOf({ addedIn: '0.110.0' }, '0.113.0'), null);
});

test('"updated" lasts one minor release', () => {
  assert.equal(statusOf({ addedIn: '0.40.0', updatedIn: '0.112.0' }, '0.112.0'), 'updated');
  assert.equal(statusOf({ addedIn: '0.40.0', updatedIn: '0.112.0' }, '0.112.3'), 'updated');
  assert.equal(statusOf({ addedIn: '0.40.0', updatedIn: '0.112.0' }, '0.113.0'), null);
});

test('a component added in the release about to ship is already new', () => {
  // addedIn is set to the coming version before the bump, so the page has its
  // dot from the moment it is generated.
  assert.equal(statusOf({ addedIn: '0.2.0' }, '0.1.0'), 'new');
});

test('one mark per row, in a fixed order', () => {
  assert.equal(statusOf({ addedIn: '0.112.0', updatedIn: '0.112.0' }, '0.112.0'), 'new');
  assert.equal(statusOf({ alpha: true, addedIn: '0.112.0' }, '0.112.0'), 'alpha');
  assert.equal(statusOf({ beta: true, alpha: true }, '0.112.0'), 'alpha');
  assert.equal(statusOf({ beta: true, updatedIn: '0.112.0' }, '0.112.0'), 'beta');
  assert.equal(statusOf({}, '0.112.0'), null);
});

test('a new major starts every window again', () => {
  assert.equal(statusOf({ addedIn: '0.112.0' }, '1.0.0'), null);
  assert.equal(statusOf({ addedIn: '1.0.0' }, '1.2.0'), 'new');
});

test('the web collection is measured against its own version', () => {
  // The eleven components of panelui-web 0.1.0 keep their dots through web 0.3.0
  // and lose them at 0.4.0, however far the library has moved.
  assert.equal(statusOf({ addedIn: '0.1.0' }, '0.1.0'), 'new');
  assert.equal(statusOf({ addedIn: '0.1.0' }, '0.3.0'), 'new');
  assert.equal(statusOf({ addedIn: '0.1.0' }, '0.4.0'), null);
  assert.equal(statusOf({ addedIn: '0.1.0', updatedIn: '0.4.0' }, '0.4.0'), 'updated');
});

test('a mistyped mark fails the generator instead of mis-marking the page', () => {
  assert.throws(() => statusOf({ addedIn: '0.2' }, '0.2.0', 'web-meta.json sheet'), /web-meta\.json sheet: addedIn "0\.2"/);
  assert.throws(() => statusOf({ updatedIn: 'v0.2.0' }, '0.2.0'), /updatedIn "v0\.2\.0"/);
  assert.throws(
    () => statusOf({ addedIn: '0.110.0', updatedIn: '0.90.0' }, '0.112.0', 'meta.json map'),
    /meta\.json map: updatedIn 0\.90\.0 is older than addedIn 0\.110\.0/
  );
});
