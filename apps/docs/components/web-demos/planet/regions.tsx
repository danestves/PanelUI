'use client';

import { useRef, useState } from 'react';
import { Planet, type PlanetHandle, type PlanetMarkerColor } from 'panelui-web/planet';
import { Frame } from 'panelui-web/frame';
import { Stat } from 'panelui-web/stat';

type Health = 'healthy' | 'slow' | 'down';

/** The data centres a service runs in, and how each is answering. */
const REGIONS: { city: string; lat: number; lng: number; health: Health; ms: number | null }[] = [
  { city: 'Dublin', lat: 53.35, lng: -6.26, health: 'healthy', ms: 38 },
  { city: 'Warsaw', lat: 52.23, lng: 21.01, health: 'healthy', ms: 44 },
  { city: 'Johannesburg', lat: -26.2, lng: 28.05, health: 'slow', ms: 412 },
  { city: 'Mumbai', lat: 19.08, lng: 72.88, health: 'healthy', ms: 61 },
  { city: 'Singapore', lat: 1.35, lng: 103.82, health: 'healthy', ms: 52 },
  { city: 'Sydney', lat: -33.87, lng: 151.21, health: 'down', ms: null },
  { city: 'Seoul', lat: 37.57, lng: 126.98, health: 'healthy', ms: 47 },
  { city: 'São Paulo', lat: -23.55, lng: -46.63, health: 'healthy', ms: 73 },
  { city: 'Montreal', lat: 45.5, lng: -73.57, health: 'healthy', ms: 41 },
  { city: 'Portland', lat: 45.52, lng: -122.68, health: 'slow', ms: 286 },
];

const COLOUR: Record<Health, PlanetMarkerColor> = {
  healthy: 'success',
  slow: 'warning',
  down: 'destructive',
};

const SAYS: Record<Health, string> = {
  healthy: 'Answering normally',
  slow: 'Answering slowly',
  down: 'Not answering',
};

export default function PlanetRegions() {
  const planet = useRef<PlanetHandle>(null);
  const [picked, setPicked] = useState('Singapore');
  const region = REGIONS.find((entry) => entry.city === picked) ?? REGIONS[0];
  const healthy = REGIONS.filter((entry) => entry.health === 'healthy').length;

  const pick = (city: string) => {
    const next = REGIONS.find((entry) => entry.city === city);
    if (!next) return;
    setPicked(city);
    // Turned so the region faces you, a little short of its latitude so a
    // place far north or south is seen from the side.
    planet.current?.rotateTo([next.lng, next.lat * 0.5]);
  };

  return (
    <Frame variant="band" className="w-full max-w-2xl">
      <Frame.Header>
        <Frame.Title>Regions</Frame.Title>
        <Frame.Action>{healthy} of {REGIONS.length} healthy</Frame.Action>
      </Frame.Header>

      {/* The globe beside the list on a wide screen, over it on a narrow one. */}
      <Frame.Panel className="grid gap-5 p-5 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] sm:items-center">
        <Planet ref={planet} defaultRotation={[103.82, 4]} className="mx-auto max-w-64 gap-3">
          <Planet.Globe label="Regions" color="info">
            {REGIONS.map((entry) => (
              <Planet.Marker
                key={entry.city}
                lat={entry.lat}
                lng={entry.lng}
                color={COLOUR[entry.health]}
                pulse={entry.health !== 'healthy'}
                selected={entry.city === picked}
                label={entry.city === picked ? entry.city : undefined}
                name={entry.city}
                onClick={() => pick(entry.city)}
              />
            ))}
          </Planet.Globe>
          <Planet.Controls />
        </Planet>

        <div className="flex min-w-0 flex-col gap-3">
          <Stat aria-live="polite">
            <Stat.Content>
              <Stat.Label>{region.city}</Stat.Label>
              <Stat.Description>{SAYS[region.health]}</Stat.Description>
            </Stat.Content>
            <Stat.Value size="md">
              {region.ms === null ? '\u2014' : region.ms}
              {region.ms === null ? null : <Stat.Unit>ms</Stat.Unit>}
            </Stat.Value>
          </Stat>

          <Planet.List>
            {REGIONS.map((entry) => (
              <Planet.ListItem
                key={entry.city}
                color={COLOUR[entry.health]}
                selected={entry.city === picked}
                onClick={() => pick(entry.city)}
              >
                {entry.city}
              </Planet.ListItem>
            ))}
          </Planet.List>
        </div>
      </Frame.Panel>
    </Frame>
  );
}
