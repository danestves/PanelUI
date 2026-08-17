import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const docs = new URL('../', import.meta.url);

test('docs use the supported Next proxy convention', async () => {
  const source = await readFile(new URL('proxy.ts', docs), 'utf8');
  await assert.rejects(access(new URL('middleware.ts', docs)));
  assert.match(source, /export function proxy\(request: NextRequest\): NextResponse/);
  assert.match(source, /matcher: \['\/', '\/docs\/:path\*'\]/);
});
