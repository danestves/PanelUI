import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

export const BAR_CHART_BUDGET = Object.freeze({
  recommended: Object.freeze({ points: 500, series: 4 }),
  testedCeiling: Object.freeze({ points: 1_000, series: 5 }),
});

/** Count loops whose size grows with points or series. */
export function barChartOperationCounts(points, series, stacked) {
  const domainVisits = points * series;
  const baselineVisits = stacked ? (points * series * (series - 1)) / 2 : 0;
  return {
    updateVisits: domainVisits + baselineVisits,
    frameVisits: 2 * points * series,
  };
}

function dataFor(points, series) {
  return Array.from({ length: points }, (_, point) =>
    Array.from({ length: series }, (_, index) => ((point + 1) * (index + 3)) % 97)
  );
}

function verticalBarPath(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = x + width;
  const bottom = y + height;
  return (
    `M${x},${bottom}L${x},${y + r}Q${x},${y} ${x + r},${y}` +
    `L${right - r},${y}Q${right},${y} ${right},${y + r}L${right},${bottom}Z`
  );
}

/** Pure model of the loops used to derive the domain, stacked baselines and paths. */
function exercise(data, series, stacked) {
  const points = data.length;
  const baselines = new Array(series).fill(null);
  let maximum = 0;

  for (const row of data) {
    let rowMaximum = 0;
    for (const value of row) {
      rowMaximum = stacked ? rowMaximum + value : Math.max(rowMaximum, value);
    }
    maximum = Math.max(maximum, rowMaximum);
  }

  if (stacked) {
    for (let current = 1; current < series; current += 1) {
      const baseline = [];
      for (const row of data) {
        let total = 0;
        for (let below = 0; below < current; below += 1) total += row[below];
        baseline.push(total);
      }
      baselines[current] = baseline;
    }
  }

  let checksum = maximum;
  const active = Math.floor(points / 2);
  for (let current = 0; current < series; current += 1) {
    for (const wantActive of [false, true]) {
      let path = '';
      for (let point = 0; point < points; point += 1) {
        if ((point === active) !== wantActive) continue;
        const base = baselines[current]?.[point] ?? 0;
        const value = data[point][current];
        const band = 600 / points;
        const width = Math.max(0.25, (band * 0.8) / (stacked ? 1 : series));
        const zero = 300 - (base / maximum) * 300;
        const tip = 300 - ((base + value) / maximum) * 300;
        path += verticalBarPath(point * band, tip, width, Math.abs(tip - zero), 4);
      }
      checksum += path.length;
    }
  }
  return checksum;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

let benchmarkSink = 0;

function benchmark(points, series, stacked) {
  const data = dataFor(points, series);
  const counts = barChartOperationCounts(points, series, stacked);
  const repetitions = Math.max(
    20,
    Math.ceil(500_000 / (counts.updateVisits + counts.frameVisits))
  );
  for (let warmup = 0; warmup < 10; warmup += 1) {
    benchmarkSink += exercise(data, series, stacked);
  }
  const samples = [];
  for (let sample = 0; sample < 11; sample += 1) {
    const start = performance.now();
    for (let repeat = 0; repeat < repetitions; repeat += 1) {
      benchmarkSink += exercise(data, series, stacked);
    }
    samples.push((performance.now() - start) / repetitions);
  }
  return median(samples);
}

function main() {
  console.log('mode\tpoints\tseries\tupdate visits\tframe visits\tmedian update+frame ms');
  for (const stacked of [false, true]) {
    for (const points of [100, 500, 1_000]) {
      for (const series of [1, 3, 5]) {
        const counts = barChartOperationCounts(points, series, stacked);
        console.log(
          `${stacked ? 'stacked' : 'grouped'}\t${points}\t${series}\t${counts.updateVisits}\t${counts.frameVisits}\t${benchmark(points, series, stacked).toFixed(3)}`
        );
      }
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
