import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bucketByDay,
  dayAccessibilityLabel,
  dayKey,
  entriesOn,
  entryTimeMinutes,
  sortByTime,
  summariseMonth,
  visibleEntries,
} from '../src/components/planner/planner-entries.ts';

const at = (day, hour = 0) => new Date(2026, 0, day, hour);
const januaryGrid = Array.from({ length: 6 }, (_, week) =>
  Array.from({ length: 7 }, (_, day) => new Date(2025, 11, 28 + week * 7 + day))
);

test('two times on the same day land in the same bucket', () => {
  const morning = { date: at(7, 9) };
  const evening = { date: at(7, 21) };
  const other = { date: at(8) };

  const days = bucketByDay([morning, evening, other]);
  assert.equal(days.size, 2);
  assert.deepEqual(entriesOn(days, at(7, 13)), [morning, evening]);
  assert.deepEqual(entriesOn(days, at(8, 23)), [other]);
  assert.equal(dayKey(at(7, 9)), dayKey(at(7, 21)));
});

test('a day with nothing on it returns the same empty array every time', () => {
  const days = bucketByDay([{ date: at(3) }]);
  const first = entriesOn(days, at(20));
  const second = entriesOn(days, at(21));
  assert.deepEqual(first, []);
  // A fresh array per empty cell would defeat every memo below it, and a
  // month is mostly empty cells.
  assert.equal(first, second);
});

test('entries keep the order they were given', () => {
  const a = { date: at(4), id: 'a' };
  const b = { date: at(4), id: 'b' };
  const c = { date: at(4), id: 'c' };
  assert.deepEqual(entriesOn(bucketByDay([c, a, b]), at(4)), [c, a, b]);
});

test('a cell draws up to its limit and counts the rest', () => {
  const items = [1, 2, 3, 4, 5];
  assert.deepEqual(visibleEntries(items, 2), { shown: [1, 2], overflow: 3 });
  assert.deepEqual(visibleEntries(items, 5), { shown: items, overflow: 0 });
  assert.deepEqual(visibleEntries(items, 9), { shown: items, overflow: 0 });
  assert.deepEqual(visibleEntries(items, 0), { shown: [], overflow: 5 });
  assert.deepEqual(visibleEntries(items, -3), { shown: [], overflow: 5 });
  assert.deepEqual(visibleEntries([], 3), { shown: [], overflow: 0 });
});

test('visibleEntries does not hand back the caller its own array', () => {
  const items = [1, 2];
  const { shown } = visibleEntries(items, 5);
  shown.push(3);
  assert.deepEqual(items, [1, 2]);
});

test('a day is spoken by what is on it, not only by its date', () => {
  const labels = new Map([
    ['monthly', 'Monthly'],
    ['yearly', 'Yearly'],
  ]);

  assert.equal(
    dayAccessibilityLabel('16 January 2026', [], labels),
    '16 January 2026, nothing planned'
  );
  assert.equal(
    dayAccessibilityLabel('16 January 2026', [{ date: at(16), category: 'monthly' }], labels),
    '16 January 2026, 1 entry: Monthly'
  );
  assert.equal(
    dayAccessibilityLabel(
      '16 January 2026',
      [
        { date: at(16), category: 'monthly' },
        { date: at(16), category: 'yearly' },
        // The same category twice is named once — a list that repeats itself
        // takes longer to hear and says nothing more.
        { date: at(16), category: 'monthly' },
      ],
      labels
    ),
    '16 January 2026, 3 entries: Monthly, Yearly'
  );
});

test('an uncategorised day is counted without inventing a category for it', () => {
  assert.equal(
    dayAccessibilityLabel('2 January 2026', [{ date: at(2) }], new Map()),
    '2 January 2026, 1 entry'
  );
  assert.equal(
    dayAccessibilityLabel(
      '2 January 2026',
      [{ date: at(2), category: 'gone' }],
      new Map([['monthly', 'Monthly']])
    ),
    '2 January 2026, 1 entry'
  );
});

test('the month total counts the month, not the days either side of it', () => {
  const inJanuary = (date) => date.getMonth() === 0;
  const entries = [
    { date: at(5), category: 'monthly' },
    { date: at(12), category: 'monthly' },
    { date: at(25), category: 'yearly' },
    { date: at(30) },
    // December and February, drawn in the grid but not part of the total.
    { date: new Date(2025, 11, 29), category: 'monthly' },
    { date: new Date(2026, 1, 1), category: 'yearly' },
  ];

  assert.deepEqual(
    summariseMonth(bucketByDay(entries), januaryGrid, [
      { id: 'monthly', label: 'Monthly' },
      { id: 'yearly', label: 'Yearly' },
    ], inJanuary),
    {
      total: 4,
      categories: [
        { id: 'monthly', label: 'Monthly', count: 2 },
        { id: 'yearly', label: 'Yearly', count: 1 },
      ],
    }
  );
});

test('a declared category with nothing in it still appears, at zero', () => {
  const entries = [{ date: at(5), category: 'monthly' }];
  const { categories } = summariseMonth(
    bucketByDay(entries),
    januaryGrid,
    [
      { id: 'monthly', label: 'Monthly' },
      { id: 'weekly', label: 'Weekly' },
    ],
    () => true
  );
  // The legend is the key to the colours, so it has to list every colour the
  // reader might be looking for — including the one that happens to be unused
  // this month.
  assert.deepEqual(categories, [
    { id: 'monthly', label: 'Monthly', count: 1 },
    { id: 'weekly', label: 'Weekly', count: 0 },
  ]);
});

test('month summaries inspect the fixed grid, not every entry in other months', () => {
  const entries = [
    ...Array.from({ length: 10_000 }, (_, day) => ({
      date: new Date(2020, 0, (day % 28) + 1),
      category: 'old',
    })),
    { date: at(7), category: 'current' },
  ];
  let monthChecks = 0;
  let dayLookups = 0;
  class CountingDays extends Map {
    get(key) {
      dayLookups += 1;
      return super.get(key);
    }
  }
  const indexed = new CountingDays(bucketByDay(entries));

  const result = summariseMonth(
    indexed,
    januaryGrid,
    [{ id: 'current', label: 'Current' }],
    (date) => {
      monthChecks += 1;
      return date.getFullYear() === 2026 && date.getMonth() === 0;
    }
  );

  assert.equal(monthChecks, 42);
  assert.equal(dayLookups, 31);
  assert.deepEqual(result, {
    total: 1,
    categories: [{ id: 'current', label: 'Current', count: 1 }],
  });
});

test('midnight reads as all-day, any other time as a point in the day', () => {
  assert.equal(entryTimeMinutes(new Date(2026, 0, 16)), null);
  assert.equal(entryTimeMinutes(new Date(2026, 0, 16, 0, 0, 30)), null);
  assert.equal(entryTimeMinutes(new Date(2026, 0, 16, 9, 0)), 540);
  assert.equal(entryTimeMinutes(new Date(2026, 0, 16, 23, 59)), 1439);
});

test('a day sorts all-day first, then by time, stably', () => {
  const at = (hour, minute, id) => ({ id, date: new Date(2026, 0, 16, hour, minute) });
  const sorted = sortByTime([
    at(16, 0, 'one-to-one'),
    at(0, 0, 'leave'),
    at(9, 0, 'standup'),
    at(0, 0, 'holiday'),
    at(9, 0, 'sync'),
  ]);
  assert.deepEqual(
    sorted.map((entry) => entry.id),
    ['leave', 'holiday', 'standup', 'sync', 'one-to-one']
  );
});

test('sorting leaves the caller its own array', () => {
  const entries = [{ id: 'b', date: new Date(2026, 0, 16, 9) }, { id: 'a', date: new Date(2026, 0, 16) }];
  const sorted = sortByTime(entries);
  assert.notEqual(sorted, entries);
  assert.equal(entries[0].id, 'b');
});
