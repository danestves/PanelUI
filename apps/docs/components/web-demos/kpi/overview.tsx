import { Kpi } from 'panelui-web/kpi';
import { Frame } from 'panelui-web/frame';

/** Each figure over the last thirty days, oldest first. */
const SUBSCRIBERS = [152, 154, 153, 157, 161, 160, 164, 169, 168, 172, 176, 175, 179, 182];
const UNSUBSCRIBES = [14, 13, 13, 12, 12, 11, 12, 10, 10, 9, 9, 8, 8, 7];
const OPENS = [41, 42, 44, 43, 45, 44, 46, 45, 47, 46, 46, 48, 47, 47];

export default function KpiOverview() {
  return (
    <Frame variant="band" className="w-full max-w-md">
      <Frame.Header>
        <Frame.Title>Newsletter</Frame.Title>
        <Frame.Action>Last 30 days</Frame.Action>
      </Frame.Header>

      <Frame.Panel className="p-5">
        <Kpi.Group orientation="vertical">
          <Kpi>
            <Kpi.Content layout="inline">
              <Kpi.Stat>
                <Kpi.Title>Subscribers</Kpi.Title>
                <Kpi.Value>18,240</Kpi.Value>
                <Kpi.Trend value={6.4} caption="this month" />
              </Kpi.Stat>
              <Kpi.Chart data={SUBSCRIBERS} inline />
            </Kpi.Content>
          </Kpi>
          <Kpi>
            <Kpi.Content layout="inline">
              <Kpi.Stat>
                <Kpi.Title>Unsubscribe rate</Kpi.Title>
                <Kpi.Value>0.8%</Kpi.Value>
                <Kpi.Trend value={-12.5} goodDirection="down" caption="on last month" />
              </Kpi.Stat>
              <Kpi.Chart data={UNSUBSCRIBES} color="success" inline />
            </Kpi.Content>
          </Kpi>
          <Kpi>
            <Kpi.Content layout="inline">
              <Kpi.Stat>
                <Kpi.Title>Open rate</Kpi.Title>
                <Kpi.Value>47.3%</Kpi.Value>
                <Kpi.Trend value={1.9} caption="last 7 issues" />
              </Kpi.Stat>
              <Kpi.Chart data={OPENS} color="info" inline />
            </Kpi.Content>
          </Kpi>
        </Kpi.Group>
      </Frame.Panel>
    </Frame>
  );
}
