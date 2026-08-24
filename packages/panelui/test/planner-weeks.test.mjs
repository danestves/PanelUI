import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDaysLocal,
  startOfWeek,
  weekAnchor,
  weekDays,
  weekIndex,
  weekRange,
} from '../src/components/planner/planner-weeks.ts';

const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

test('a week starts on the day the locale says it does', () => {
  // 2026-01-16 is a Friday.
  const friday = new Date(2026, 0, 16);
  assert.equal(iso(startOfWeek(friday, 1)), '2026-01-12'); // Monday
  assert.equal(iso(startOfWeek(friday, 0)), '2026-01-11'); // Sunday
  assert.equal(iso(startOfWeek(friday, 6)), '2026-01-10'); // Saturday
});

test('a day already on the week start stays put', () => {
  assert.equal(iso(startOfWeek(new Date(2026, 0, 12), 1)), '2026-01-12');
});

test('out-of-range week starts normalise instead of throwing', () => {
  const friday = new Date(2026, 0, 16);
  assert.equal(iso(startOfWeek(friday, 8)), iso(startOfWeek(friday, 1)));
  assert.equal(iso(startOfWeek(friday, -6)), iso(startOfWeek(friday, 1)));
});

test('a week belongs to the month holding most of it', () => {
  // The week of Mon 2025-12-29 runs to Sun 2026-01-04: four days in January.
  const straddling = startOfWeek(new Date(2025, 11, 31), 1);
  assert.equal(weekAnchor(straddling).getMonth(), 0);
  assert.equal(weekAnchor(straddling).getFullYear(), 2026);
});

test('a week is seven consecutive days', () => {
  const days = weekDays(new Date(2026, 0, 12));
  assert.equal(days.length, 7);
  assert.equal(iso(days[0]), '2026-01-12');
  assert.equal(iso(days[6]), '2026-01-18');
});

test('the range is bounded, ordered and centred on the anchor', () => {
  const weeks = weekRange(new Date(2026, 0, 16), 1, 2, 3);
  assert.equal(weeks.length, 6);
  assert.equal(iso(weeks[0]), '2025-12-29');
  assert.equal(iso(weeks[2]), '2026-01-12'); // the anchor's own week
  assert.equal(iso(weeks[5]), '2026-02-02');
  for (let i = 1; i < weeks.length; i += 1) {
    assert.equal(weeks[i].getTime() - weeks[i - 1].getTime() > 0, true);
  }
});

test('a negative or fractional span is treated as none', () => {
  assert.equal(weekRange(new Date(2026, 0, 16), 1, -5, 0).length, 1);
  assert.equal(weekRange(new Date(2026, 0, 16), 1, 1.9, 0).length, 2);
});

test('a week is located by arithmetic, and misses report -1', () => {
  const weeks = weekRange(new Date(2026, 0, 16), 1, 4, 4);
  assert.equal(weekIndex(weeks, new Date(2026, 0, 16), 1), 4);
  assert.equal(weekIndex(weeks, new Date(2026, 0, 12), 1), 4);
  assert.equal(weekIndex(weeks, new Date(2027, 0, 16), 1), -1);
  assert.equal(weekIndex([], new Date(2026, 0, 16), 1), -1);
});

test('stepping days survives a daylight-saving change', () => {
  // Europe/London springs forward on 2026-03-29.
  const before = new Date(2026, 2, 28);
  const after = addDaysLocal(before, 2);
  assert.equal(iso(after), '2026-03-30');
  assert.equal(after.getHours(), 0);
});
