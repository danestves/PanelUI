'use client';

import { useState } from 'react';
import { RangeMeter, type RangeMeterColor } from 'panelui-web/range-meter';
import { Frame } from 'panelui-web/frame';
import { Stat } from 'panelui-web/stat';

const FASTEST = 80;
const SLOWEST = 600;
/** What the team has agreed a page may take. */
const BUDGET = 300;

/** Fine under the budget, a warning up to half as much again, a problem past that. */
const colorOf = (time: number): RangeMeterColor =>
  time <= BUDGET ? 'success' : time <= BUDGET * 1.5 ? 'warning' : 'destructive';

const verdictOf = (time: number) =>
  time <= BUDGET ? `${BUDGET - time} ms inside budget` : `${time - BUDGET} ms over budget`;

export default function RangeMeterResponseTime() {
  const [time, setTime] = useState(240);

  return (
    <Frame variant="band" className="w-full max-w-sm">
      <Frame.Header>
        <Frame.Title>Checkout page</Frame.Title>
        <Frame.Action>Budget {BUDGET} ms</Frame.Action>
      </Frame.Header>

      <Frame.Panel className="gap-4 p-5">
        <Stat aria-live="polite">
          <Stat.Content>
            <Stat.Label>Response time</Stat.Label>
            <Stat.Value>
              {time}
              <Stat.Unit>ms</Stat.Unit>
            </Stat.Value>
          </Stat.Content>
          <Stat.Badge>{verdictOf(time)}</Stat.Badge>
        </Stat>

        <div className="flex flex-col gap-2">
          <RangeMeter
            min={FASTEST}
            max={SLOWEST}
            step={10}
            value={time}
            onValueChange={setTime}
            marker={BUDGET}
            color={colorOf(time)}
            label="Response time"
            valueText={`${time} milliseconds`}
          />
          <RangeMeter.Scale start={`${FASTEST} ms`} end={`${SLOWEST} ms`} />
        </div>
      </Frame.Panel>
    </Frame>
  );
}
