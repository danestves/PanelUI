import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { millisecondsUntilNextLocalDay } from '../src/components/planner/planner-today.ts';

test('Planner schedules today against the next local midnight', () => {
  assert.equal(millisecondsUntilNextLocalDay(new Date(2026, 0, 1, 23, 59, 59, 500)), 500);

  const midday = new Date(2026, 4, 12, 12, 30, 0, 0);
  const expected = new Date(2026, 4, 13, 0, 0, 0, 0).getTime() - midday.getTime();
  assert.equal(millisecondsUntilNextLocalDay(midday), expected);
});

test('Planner refreshes while active and resets its timer across app state changes', async () => {
  const source = await readFile(
    new URL('../src/components/planner/index.tsx', import.meta.url),
    'utf8'
  );
  const hook = source.slice(source.indexOf('function useToday'), source.indexOf('function usePalette'));

  assert.match(hook, /setTimeout\(refreshAndSchedule, millisecondsUntilNextLocalDay\(current\)\)/);
  assert.match(hook, /state === 'active'\) refreshAndSchedule\(\)[\s\S]*else clearTimer\(\)/);
  assert.match(hook, /return \(\) => \{[\s\S]*clearTimer\(\)[\s\S]*subscription\.remove\(\)/);
});
