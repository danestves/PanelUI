import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { avatarSourceIdentity } from '../src/components/avatar/avatar-source.ts';

test('equivalent inline image sources retain one failure identity', () => {
  assert.equal(
    avatarSourceIdentity({ uri: 'https://example.test/avatar', headers: { b: '2', a: '1' } }),
    avatarSourceIdentity({ headers: { a: '1', b: '2' }, uri: 'https://example.test/avatar' })
  );
  assert.equal(avatarSourceIdentity(42), '42');
});

test('request-affecting source changes clear the old failure identity', () => {
  const first = avatarSourceIdentity({ uri: 'https://example.test/one' });
  assert.notEqual(first, avatarSourceIdentity({ uri: 'https://example.test/two' }));
  assert.notEqual(
    first,
    avatarSourceIdentity({ uri: 'https://example.test/one', headers: { authorization: 'new' } })
  );
  assert.equal(avatarSourceIdentity(undefined), undefined);
});

test('Avatar owns fallback state while composing the consumer error handler', async () => {
  const source = await readFile(
    new URL('../src/components/avatar/index.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /setFailedSource\(sourceIdentity\);[\s\S]{0,100}imageProps\?\.onError\?\.\(event\)/);
  assert.match(source, /\{\.\.\.imageProps\}[\s\S]{0,100}onError=/);
  assert.match(source, /failedSource !== sourceIdentity/);
});
