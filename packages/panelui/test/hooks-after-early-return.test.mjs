import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const COMPONENTS = new URL('../src/components/', import.meta.url);

/** A hook call, not a property access or a definition in a comment. */
const HOOK = /(?<![.\w])(use[A-Z]\w*)\s*\(/;

/** `if (…) return` at the top level of a component body. */
const EARLY_RETURN = /^\s{2}if\s*\(.*\)\s*return\b/;

/**
 * No component may call a hook after an early return.
 *
 * The overlays all have one — `if (!open) return null` is how a panel that is
 * not on screen costs nothing — and a hook written below it runs on an open
 * component and not on a closed one. React counts hooks by position, so the
 * next render finds one more than the last and throws, which is a component
 * that works until the first time somebody opens it.
 *
 * This is what `react-hooks/rules-of-hooks` is for, and there is no ESLint in
 * this repository to run it. Until there is, this walks the same ground for the
 * one shape that has actually cost us something.
 */
test('no component calls a hook after an early return', () => {
  const offences = [];

  for (const dir of fs.readdirSync(COMPONENTS).sort()) {
    const file = path.join(COMPONENTS.pathname, dir, 'index.tsx');
    if (!fs.existsSync(file)) continue;

    const lines = fs.readFileSync(file, 'utf8').split('\n');
    let depth = 0;
    let guarded = false;

    lines.forEach((line, index) => {
      const opening = depth;
      for (const character of line) {
        if (character === '{') depth += 1;
        else if (character === '}') depth -= 1;
      }

      // A new top-level declaration starts its own accounting.
      if (opening === 0 && depth > 0) guarded = false;
      if (depth === 1 && EARLY_RETURN.test(line)) guarded = true;

      if (guarded && depth >= 1 && !/^\s*(?:\*|\/\/)/.test(line)) {
        const hook = line.match(HOOK);
        if (hook) offences.push(`${dir}/index.tsx:${index + 1} calls ${hook[1]}`);
      }

      if (depth === 0) guarded = false;
    });
  }

  assert.deepEqual(
    offences,
    [],
    `A hook below an early return runs on some renders and not others:\n${offences.join('\n')}`
  );
});
