'use client';

import { TiltCard } from 'panelui-web/tilt-card';
import { Stat } from 'panelui-web/stat';

export default function TiltCardPlain() {
  return (
    <TiltCard tilt={12} glare={false} className="w-full max-w-xs" cardClassName="p-5">
      <Stat.Content>
        <Stat.Label>Team plan</Stat.Label>
        <Stat.Value size="md">
          €12 <Stat.Unit className="ms-0">a seat, monthly</Stat.Unit>
        </Stat.Value>
      </Stat.Content>
      <TiltCard.Description className="mt-3">
        Shared notebooks, version history for a year, and single sign-on.
      </TiltCard.Description>
    </TiltCard>
  );
}
