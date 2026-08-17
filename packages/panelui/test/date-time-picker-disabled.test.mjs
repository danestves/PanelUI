import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/components/date-time-picker/index.tsx', import.meta.url),
  'utf8'
);
const registry = JSON.parse(
  readFileSync(new URL('../../../apps/docs/public/r/date-time-picker.json', import.meta.url), 'utf8')
);
const generated = registry.files.find((file) => file.path === 'ui/date-time-picker.tsx')?.content;

function assertDisabledContract(component) {
  assert.match(component, /const DISABLE_ALL_DATES = \(\) => true/);
  assert.match(component, /if \(disabled && next\) return;[\s\S]*?onOpenChange\?\.\(next\)/);
  assert.match(component, /if \(disabled\) return;[\s\S]*?onValueChange\?\.\(next\)/);
  assert.match(component, /disabled=\{disabled \? DISABLE_ALL_DATES : disabledDates\}/);
  assert.match(component, /<TimePicker[\s\S]*?disabled=\{disabled\}/);
}

test('disabled DateTimePicker blocks both value boundaries', () => {
  assertDisabledContract(source);
});

test('the generated registry preserves the disabled contract', () => {
  assert.equal(typeof generated, 'string');
  assertDisabledContract(generated);
});
