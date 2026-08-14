import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  breakpointAt,
  breakpointEntries,
} from '../src/hooks/breakpoint-contract.ts';

test('default breakpoints keep exact legacy boundaries', () => {
  const entries = breakpointEntries({ sm: 640, md: 768, lg: 1024, xl: 1280 });
  assert.equal(breakpointAt(entries, 639), 'base');
  assert.equal(breakpointAt(entries, 640), 'sm');
  assert.equal(breakpointAt(entries, 767), 'sm');
  assert.equal(breakpointAt(entries, 768), 'md');
  assert.equal(breakpointAt(entries, 1280), 'xl');
});

test('custom compact, medium and expanded semantics resolve every boundary', () => {
  const entries = breakpointEntries({ compact: 0, medium: 600, expanded: 900 });
  assert.equal(breakpointAt(entries, 0), 'compact');
  assert.equal(breakpointAt(entries, 599), 'compact');
  assert.equal(breakpointAt(entries, 600), 'medium');
  assert.equal(breakpointAt(entries, 899), 'medium');
  assert.equal(breakpointAt(entries, 900), 'expanded');
});

test('invalid definitions fail once and below-range widths fall back to base', () => {
  assert.throws(() => breakpointEntries({}), /at least one/);
  assert.throws(() => breakpointEntries({ compact: -1 }), /finite, non-negative/);
  assert.throws(() => breakpointEntries({ compact: 400, medium: 400 }), /strictly ascending/);
  assert.throws(() => breakpointEntries({ compact: 600, medium: 500 }), /strictly ascending/);
  assert.throws(() => breakpointEntries({ compact: Number.NaN }), /finite, non-negative/);
  assert.equal(breakpointAt(breakpointEntries({ medium: 600 }), 599), 'base');
});

test('the custom provider owns dimensions and bound consumers only read context', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../src/hooks/use-breakpoint.ts', import.meta.url)),
    'utf8'
  );
  const provider = source.match(/function Provider[\s\S]*?function useBoundBreakpoint/)?.[0];
  assert.match(provider ?? '', /useWindowDimensions\(\)/);
  assert.match(provider ?? '', /Context\.Provider/);
  const bound = source.match(/function useBoundBreakpoint[\s\S]*?return \{ Provider/)?.[0];
  assert.match(bound ?? '', /useContext\(Context\)/);
  assert.doesNotMatch(bound ?? '', /useWindowDimensions/);
});
