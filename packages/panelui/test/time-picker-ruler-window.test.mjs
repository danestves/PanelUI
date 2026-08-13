import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  RULER_WINDOW_SIZE,
  rulerWindow,
} from '../src/components/time-picker/ruler-window.ts';

test('minuteStep=1 mounts a bounded window instead of all 1,440 ticks', () => {
  for (const index of [0, 1, 719, 720, 1438, 1439]) {
    const window = rulerWindow(1440, index);
    assert.equal(window.end - window.start, RULER_WINDOW_SIZE);
    assert.ok(window.start <= index && index < window.end, `${index} remains reachable`);
  }
});

test('ordinary steps and bounds keep every value reachable', () => {
  for (const count of [1, 24, 48, 96, 288]) {
    for (let index = 0; index < count; index += 1) {
      const window = rulerWindow(count, index);
      assert.ok(window.start <= index && index < window.end, `${count}:${index}`);
      assert.ok(window.end - window.start <= RULER_WINDOW_SIZE, `${count} is bounded`);
    }
  }
  assert.equal(rulerWindow(96, 48).end - rulerWindow(96, 48).start, 96);
});

test('window inputs are normalized and registry copy stays canonical', () => {
  assert.deepEqual(rulerWindow(1440, -10), rulerWindow(1440, 0));
  assert.deepEqual(rulerWindow(1440, 5000), rulerWindow(1440, 1439));
  assert.deepEqual(rulerWindow(-1, 0), { start: 0, end: 0 });

  const registry = JSON.parse(
    readFileSync(new URL('../../../apps/docs/public/r/time-picker.json', import.meta.url), 'utf8')
  );
  const files = new Map(registry.files.map((file) => [file.path, file.content]));
  const source = readFileSync(
    new URL('../src/components/time-picker/ruler-window.ts', import.meta.url),
    'utf8'
  );
  assert.equal(files.get('ui/ruler-window.ts'), source);
});
