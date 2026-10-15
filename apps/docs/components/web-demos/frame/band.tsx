import { Kpi } from 'panelui-web/kpi';
import { Frame } from 'panelui-web/frame';

const SIGNUPS = [62, 71, 58, 80, 77, 94, 88, 91, 103, 98, 112, 107, 121, 126];

export default function FrameBand() {
  return (
    <Frame variant="band" className="w-full max-w-sm">
      <Frame.Header>
        <Frame.Title>Sign-ups</Frame.Title>
        <Frame.Action>Last 14 days</Frame.Action>
      </Frame.Header>
      <Frame.Panel className="p-5">
        <Kpi>
          <Kpi.Header>
            <Kpi.Title>New workspaces</Kpi.Title>
            <Kpi.Actions>
              <Kpi.Trend value={18.4} variant="badge" />
            </Kpi.Actions>
          </Kpi.Header>
          <Kpi.Value>1,288</Kpi.Value>
          <Kpi.Chart data={SIGNUPS} color="primary" filled height={64} />
        </Kpi>
      </Frame.Panel>
    </Frame>
  );
}
