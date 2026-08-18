import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marqueeCopyCount } from '../src/components/marquee/marquee-math.ts';
import { RULER_WINDOW_SIZE, rulerWindow } from '../src/components/time-picker/ruler-window.ts';
import { BAR_CHART_BUDGET, barChartOperationCounts } from './benchmark-bar-chart.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const COMPONENT_SCALE_BUDGETS = Object.freeze({
  marqueeCopies: 40,
  timelineCompoundItems: 40,
  barChartUpdateVisits: 5_000,
  barChartFrameVisits: 4_000,
  messageInitialRows: 12,
  messageBatchRows: 8,
  messageWindowScreens: 7,
  timePickerTicks: RULER_WINDOW_SIZE,
});

export const timelineCompoundMounts = (items) => Math.max(0, Math.floor(items));

const numberFrom = (source, pattern, label) => {
  const match = source.match(pattern);
  if (!match) throw new Error(`Missing component scale contract: ${label}`);
  return Number(match[1]);
};

export function componentScaleReport({ root = ROOT, budgets = COMPONENT_SCALE_BUDGETS } = {}) {
  const message = fs.readFileSync(path.join(root, 'packages/panelui/src/components/message-scroller/index.tsx'), 'utf8');
  const timeline = fs.readFileSync(path.join(root, 'packages/panelui/src/components/timeline/index.tsx'), 'utf8');
  if (!/<AnimatedScrollView[\s\S]*\{textChildren\(children\)\}/.test(timeline)) {
    throw new Error('Missing component scale contract: Timeline compound mount model');
  }
  const marquee = marqueeCopyCount(390, 12, 0);
  const bar = barChartOperationCounts(
    BAR_CHART_BUDGET.recommended.points,
    BAR_CHART_BUDGET.recommended.series,
    true
  );
  const ruler = rulerWindow(1_440, 720);
  const rows = [
    ['Marquee repeated subtrees', '390pt / 12pt content', marquee.count, budgets.marqueeCopies],
    ['Timeline compound items', '40-event short horizontal history', timelineCompoundMounts(40), budgets.timelineCompoundItems],
    ['BarChart update visits', '500 rows × 4 stacked series', bar.updateVisits, budgets.barChartUpdateVisits],
    ['BarChart frame visits', '500 rows × 4 series', bar.frameVisits, budgets.barChartFrameVisits],
    ['MessageScroller initial rows', 'virtualized transcript', numberFrom(message, /initialNumToRender = (\d+)/, 'MessageScroller initial rows'), budgets.messageInitialRows],
    ['MessageScroller batch rows', 'virtualized transcript', numberFrom(message, /maxToRenderPerBatch = (\d+)/, 'MessageScroller batch rows'), budgets.messageBatchRows],
    ['MessageScroller window screens', 'virtualized transcript', numberFrom(message, /windowSize = (\d+)/, 'MessageScroller window screens'), budgets.messageWindowScreens],
    ['TimePicker mounted ticks', '1-minute ruler / 1,440 values', ruler.end - ruler.start, budgets.timePickerTicks],
  ].map(([component, workload, measured, budget]) => ({ component, workload, measured, budget }));
  return rows;
}

export function formatComponentScaleReport(rows) {
  return [
    'component\tworkload\tmeasured\tbudget\theadroom',
    ...rows.map((row) => `${row.component}\t${row.workload}\t${row.measured}\t${row.budget}\t${row.budget - row.measured}`),
  ].join('\n');
}

function main() {
  const rows = componentScaleReport();
  console.log(formatComponentScaleReport(rows));
  const failures = rows.filter((row) => row.measured > row.budget);
  if (failures.length) {
    throw new Error(failures.map((row) => `${row.component}: ${row.measured} > ${row.budget}`).join('\n'));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
