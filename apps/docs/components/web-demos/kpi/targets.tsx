import { BanknoteIcon, TargetIcon } from 'lucide-react';
import { Kpi } from 'panelui-web/kpi';
import { Frame } from 'panelui-web/frame';

export default function KpiTargets() {
  return (
    <Frame variant="band" className="w-full max-w-md">
      <Frame.Header>
        <Frame.Title>Targets</Frame.Title>
        <Frame.Action>This quarter</Frame.Action>
      </Frame.Header>

      <Frame.Panel className="p-5">
        <Kpi.Group orientation="vertical">
          <Kpi>
            <Kpi.Header>
              <Kpi.Icon tone="good">
                <TargetIcon />
              </Kpi.Icon>
              <Kpi.Title>Paid members</Kpi.Title>
              <Kpi.Actions>
                <Kpi.Trend value={5.1} variant="badge" />
              </Kpi.Actions>
            </Kpi.Header>
            <Kpi.Value>1,463</Kpi.Value>
            <Kpi.Progress value={1463} maxValue={2000} label="of 2,000" showValueLabel />
            <Kpi.Footer>38 days left in the quarter</Kpi.Footer>
          </Kpi>
          <Kpi>
            <Kpi.Header>
              <Kpi.Icon>
                <BanknoteIcon />
              </Kpi.Icon>
              <Kpi.Title>Sponsorship</Kpi.Title>
              <Kpi.Actions>
                <Kpi.Trend value={-3.4} variant="badge" />
              </Kpi.Actions>
            </Kpi.Header>
            <Kpi.Value>€9,800</Kpi.Value>
            <Kpi.Progress
              value={9800}
              maxValue={24000}
              label="of €24,000"
              showValueLabel
              color="warning"
            />
          </Kpi>
        </Kpi.Group>
      </Frame.Panel>
    </Frame>
  );
}
