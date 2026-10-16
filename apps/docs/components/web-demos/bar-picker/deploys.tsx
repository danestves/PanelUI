'use client';

import { useState } from 'react';
import { BarPicker, type BarPickerBar } from 'panelui-web/bar-picker';
import { Frame } from 'panelui-web/frame';
import { Stat } from 'panelui-web/stat';

/** Deploys to production on each day of one week. */
const WEEK: BarPickerBar[] = [
  { label: 'Mon', name: 'Monday', value: 9 },
  { label: 'Tue', name: 'Tuesday', value: 14 },
  { label: 'Wed', name: 'Wednesday', value: 11 },
  { label: 'Thu', name: 'Thursday', value: 17 },
  { label: 'Fri', name: 'Friday', value: 6 },
  { label: 'Sat', name: 'Saturday', value: 0 },
  { label: 'Sun', name: 'Sunday', value: 2 },
];

const TOTAL = WEEK.reduce((sum, day) => sum + day.value, 0);

export default function BarPickerDeploys() {
  const [day, setDay] = useState(3);
  const picked = WEEK[day];
  const share = Math.round((picked.value / TOTAL) * 100);

  return (
    <Frame variant="band" className="w-full max-w-sm">
      <Frame.Header>
        <Frame.Title>Deploys</Frame.Title>
        <Frame.Action>This week · {TOTAL}</Frame.Action>
      </Frame.Header>

      <Frame.Panel className="gap-6 p-5">
        <Stat aria-live="polite">
          <Stat.Content>
            <Stat.Label>{picked.name}</Stat.Label>
            <Stat.Value>{picked.value}</Stat.Value>
          </Stat.Content>
          <Stat.Badge>{share}% of the week</Stat.Badge>
        </Stat>

        <BarPicker
          data={WEEK}
          value={day}
          onValueChange={setDay}
          color="info"
          label="Deploys by day"
          formatValue={(value) => `${value} deploys`}
        />
      </Frame.Panel>
    </Frame>
  );
}
