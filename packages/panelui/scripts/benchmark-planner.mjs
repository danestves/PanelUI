import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  bucketByDay,
  dayAccessibilityLabel,
  entriesOn,
  summariseMonth,
  visibleEntries,
} from '../src/components/planner/planner-entries.ts';

export const PLANNER_BUDGET = Object.freeze({
  entries: 50_000,
  gridCells: 42,
  entryLimit: 2,
  maxMedianMs: 250,
});

const grid = Array.from({ length: 6 }, (_, week) =>
  Array.from({ length: 7 }, (_, day) => new Date(2025, 11, 28 + week * 7 + day))
);

function fixture(size) {
  return Array.from({ length: size }, (_, index) => ({
    id: String(index),
    date: new Date(2026, 0, 15, index % 24),
    category: `category-${index}`,
  }));
}

function exercise(entries, labels) {
  let monthChecks = 0;
  let dayLookups = 0;
  class CountingDays extends Map {
    get(key) {
      dayLookups += 1;
      return super.get(key);
    }
  }
  const days = new CountingDays(bucketByDay(entries));
  const summary = summariseMonth(days, grid, [], (date) => {
    monthChecks += 1;
    return date.getFullYear() === 2026 && date.getMonth() === 0;
  });

  let mountedEntries = 0;
  let spokenBytes = 0;
  for (const week of grid) {
    for (const date of week) {
      const onDay = entriesOn(days, date);
      mountedEntries += visibleEntries(onDay, PLANNER_BUDGET.entryLimit).shown.length;
      spokenBytes += dayAccessibilityLabel('', onDay, labels).length;
    }
  }
  return { dayLookups, monthChecks, mountedEntries, spokenBytes, total: summary.total };
}

function median(values) {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

function benchmark(size) {
  const entries = fixture(size);
  const labels = new Map(entries.map((entry) => [entry.category, entry.category]));
  for (let warmup = 0; warmup < 3; warmup += 1) exercise(entries, labels);
  const samples = [];
  let work;
  for (let sample = 0; sample < 7; sample += 1) {
    const start = performance.now();
    work = exercise(entries, labels);
    samples.push(performance.now() - start);
  }
  return { medianMs: median(samples), ...work };
}

function main() {
  console.log('entries\tmonth checks\tday lookups\tmounted entries\tmedian ms');
  for (const size of [1_000, 10_000, PLANNER_BUDGET.entries]) {
    const result = benchmark(size);
    console.log(
      `${size}\t${result.monthChecks}\t${result.dayLookups}\t${result.mountedEntries}\t${result.medianMs.toFixed(3)}`
    );
    if (result.monthChecks !== PLANNER_BUDGET.gridCells) {
      throw new Error(`Planner month work exceeded ${PLANNER_BUDGET.gridCells} cell checks`);
    }
    if (result.mountedEntries > PLANNER_BUDGET.gridCells * PLANNER_BUDGET.entryLimit) {
      throw new Error('Planner mounted more entry nodes than its entryLimit permits');
    }
    if (size === PLANNER_BUDGET.entries && result.medianMs > PLANNER_BUDGET.maxMedianMs) {
      throw new Error(
        `Planner ${size}-entry median ${result.medianMs.toFixed(1)}ms exceeded ${PLANNER_BUDGET.maxMedianMs}ms`
      );
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
