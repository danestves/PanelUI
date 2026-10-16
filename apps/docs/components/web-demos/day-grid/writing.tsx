'use client';

import { DayGrid, type DayCell, type DayLevel } from 'panelui-web/day-grid';
import { Frame } from 'panelui-web/frame';
import { Stat } from 'panelui-web/stat';

/** Words written on each of the last 112 days, oldest first, starting on a Monday. */
const WORDS = [
  0, 420, 1310, 880, 0, 0, 240, 1650, 1920, 760, 0, 310, 0, 0, 980, 1440, 2210, 1180, 640, 0, 0,
  1890, 2460, 1730, 920, 0, 150, 0, 2050, 1380, 0, 1120, 1960, 0, 0, 870, 2320, 1610, 1240, 2580,
  430, 0, 0, 0, 760, 1340, 0, 0, 280, 1470, 1980, 2240, 640, 1010, 0, 0, 2120, 940, 1760, 0, 520, 0,
  190, 1560, 2380, 1820, 2050, 1290, 0, 0, 0, 610, 1430, 1070, 0, 0, 0, 2290, 2510, 1940, 1680, 730,
  0, 360, 1210, 0, 1850, 2400, 1530, 0, 0, 990, 1720, 2160, 0, 1340, 220, 0, 2070, 2450, 1890, 2630,
  1160, 0, 0, 1480, 2220, 1960, 2540, 870, 410, 0,
];

/** A day's count as one of the five sizes. */
const levelOf = (words: number): DayLevel =>
  words === 0 ? 0 : words < 600 ? 1 : words < 1300 ? 2 : words < 2000 ? 3 : 4;

const START = new Date(2026, 5, 22);

const CELLS: DayCell[] = WORDS.map((words, index) => {
  const day = new Date(START);
  day.setDate(START.getDate() + index);
  const date = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return {
    level: levelOf(words),
    label: words === 0 ? `${date}, nothing written` : `${date}, ${words.toLocaleString('en-GB')} words`,
  };
});

export default function DayGridWriting() {
  const total = WORDS.reduce((sum, words) => sum + words, 0);
  const written = WORDS.filter((words) => words > 0).length;

  return (
    <Frame variant="band" className="w-full max-w-2xl">
      <Frame.Header>
        <Frame.Title>Words written</Frame.Title>
        <Frame.Action>Last 16 weeks</Frame.Action>
      </Frame.Header>

      <Frame.Panel className="gap-4 p-5">
        <Stat>
          <Stat.Content>
            <Stat.Label>In total</Stat.Label>
            <Stat.Value>{total.toLocaleString('en-GB')}</Stat.Value>
          </Stat.Content>
          <Stat.Badge>
            {written} of {WORDS.length} days
          </Stat.Badge>
        </Stat>

        {/* A week to a column: `rows` runs the days downwards. */}
        <div className="flex gap-2">
          <DayGrid.Weekdays />
          <DayGrid cells={CELLS} rows={7} color="success" label="Words written" />
        </div>

        <DayGrid.Legend color="success" className="self-end" />
      </Frame.Panel>
    </Frame>
  );
}
