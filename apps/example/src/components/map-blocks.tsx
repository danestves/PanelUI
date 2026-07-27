/**
 * The Map blocks — eight worked screens, one per full-page demo.
 *
 * Each is a whole screen rather than a snippet, because that is the only
 * honest way to show a map: squeezed into a section between two dividers it
 * demonstrates nothing except that it does not fit. They live here rather than
 * in `components.tsx` so the demo index stays a list of demos instead of a
 * thousand lines of dashboard.
 *
 * Every one of them is built from the same components the library ships. There
 * is no map-specific styling anywhere below — the point of a token-built
 * basemap is that the map and the cards over it are already the same material.
 */
import { useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Avatar,
  Badge,
  Card,
  Chip,
  Frame,
  Item,
  LineChart,
  Map,
  Progress,
  Separator,
  Text,
  type LngLat,
  type MapHandle,
} from 'panelui-native';
import { useCSSVariable } from 'uniwind';
import { EUROPE_CODES, europeFeatures } from '../data/europe-outlines';

/** Reads a theme token for the style expressions the layers take. */
function useToken(name: string, fallback: string) {
  const value = useCSSVariable(name);
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/**
 * Deterministic pseudo-random numbers.
 *
 * The demos need figures that look measured rather than typed, but a real
 * random would reshuffle on every render and make the map twitch. Seeding it
 * from the key means the same country gets the same number every time.
 */
function seeded(key: string, min: number, max: number) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const unit = Math.abs(Math.sin(hash)) % 1;
  return Math.round(min + unit * (max - min));
}

const EUROPE_BOUNDS: [number, number, number, number] = [-11, 35, 31, 63];

/* -------------------------------------------------------------------------- */
/* 1. Analytics map                                                           */
/* -------------------------------------------------------------------------- */

const TRAFFIC = EUROPE_CODES.map((code) => ({
  code,
  visitors: seeded(`v${code}`, 400, 48000),
}));

const TRAFFIC_BY_CODE = Object.fromEntries(TRAFFIC.map((t) => [t.code, t.visitors]));
const TRAFFIC_PEAK = Math.max(...TRAFFIC.map((t) => t.visitors));

const SESSIONS = [
  { hour: '00', value: 1200 }, { hour: '03', value: 800 },
  { hour: '06', value: 1600 }, { hour: '09', value: 4200 },
  { hour: '12', value: 5100 }, { hour: '15', value: 4800 },
  { hour: '18', value: 6200 }, { hour: '21', value: 3400 },
];

/** Where each country's label sits. Roughly the centroid, by eye. */
const CAPITALS: Record<string, LngLat> = {
  GB: [-1.5, 52.8], FR: [2.3, 46.6], DE: [10.4, 51.1], ES: [-3.7, 40.2],
  IT: [12.6, 42.6], PL: [19.4, 52.1], SE: [15.5, 62.0], NL: [5.6, 52.2],
};

export function AnalyticsMapBlock() {
  const muted = useToken('--color-muted', 'rgba(0,0,0,0.06)');
  const primary = useToken('--color-primary', '#262626');

  const data = useMemo(() => europeFeatures(TRAFFIC_BY_CODE), []);
  const top = useMemo(
    () => [...TRAFFIC].sort((a, b) => b.visitors - a.visitors).slice(0, 5),
    []
  );

  return (
    <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
      <View className="gap-1">
        <Text size="lg" weight="semibold">Audience</Text>
        <Text size="sm" muted>
          Sessions in the last 24 hours, by country.
        </Text>
      </View>

      <Card className="overflow-hidden">
        <View className="h-72">
          {/* Blank: a choropleth supplies its own geography, and streets under
              it are noise rather than context. */}
          <Map blank bounds={EUROPE_BOUNDS}>
            <Map.GeoJSON
              data={data}
              fill={[
                'interpolate',
                ['linear'],
                ['get', 'value'],
                0,
                muted,
                TRAFFIC_PEAK,
                primary,
              ]}
              fillOpacity={0.9}
            />
            {Object.entries(CAPITALS).map(([code, lngLat]) => (
              <Map.Marker key={code} lngLat={lngLat}>
                <Map.Label>{code}</Map.Label>
              </Map.Marker>
            ))}
          </Map>
        </View>
      </Card>

      <View className="flex-row gap-3">
        <Card className="flex-1">
          <Card.Content className="items-start gap-1 p-4">
            <Text size="xs" muted>Sessions</Text>
            <Text size="xl" weight="semibold">128k</Text>
            <Badge variant="outline">+12.4%</Badge>
          </Card.Content>
        </Card>
        <Card className="flex-1">
          <Card.Content className="items-start gap-1 p-4">
            <Text size="xs" muted>Countries</Text>
            <Text size="xl" weight="semibold">{TRAFFIC.length}</Text>
            <Badge variant="outline">+3</Badge>
          </Card.Content>
        </Card>
      </View>

      <Card className="overflow-hidden">
        <Card.Content className="gap-3 p-4">
          <Text size="sm" weight="medium">By hour</Text>
          <LineChart data={SESSIONS} xDataKey="hour" aspectRatio={2.6}>
            <LineChart.Grid rows={3} opacity={0.4} />
            <LineChart.Area dataKey="value" />
            <LineChart.Line dataKey="value" />
            <LineChart.XAxis />
          </LineChart>
        </Card.Content>
      </Card>

      <Frame>
        <Frame.Header>
          <Frame.Title>Top countries</Frame.Title>
          <Frame.Action>Sessions</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          {top.map((row) => (
            <Frame.Row key={row.code}>
              <Frame.Content>
                <Frame.Title>{row.code}</Frame.Title>
              </Frame.Content>
              <Frame.Actions>
                <Text size="sm" muted>{row.visitors.toLocaleString()}</Text>
              </Frame.Actions>
            </Frame.Row>
          ))}
        </Frame.Panel>
      </Frame>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Choropleth                                                              */
/* -------------------------------------------------------------------------- */

const METRICS = [
  { id: 'revenue', label: 'Revenue', unit: '€', min: 40, max: 9800 },
  { id: 'customers', label: 'Customers', unit: '', min: 12, max: 4200 },
  { id: 'churn', label: 'Churn', unit: '%', min: 1, max: 14 },
] as const;

export function ChoroplethBlock() {
  const [metric, setMetric] = useState<(typeof METRICS)[number]>(METRICS[0]);
  const muted = useToken('--color-muted', 'rgba(0,0,0,0.06)');
  const primary = useToken('--color-primary', '#262626');

  const { data, peak } = useMemo(() => {
    const values = Object.fromEntries(
      EUROPE_CODES.map((code) => [code, seeded(metric.id + code, metric.min, metric.max)])
    );
    return { data: europeFeatures(values), peak: Math.max(...Object.values(values)) };
  }, [metric]);

  return (
    <View className="flex-1">
      <View className="gap-3 p-4">
        <View className="gap-1">
          <Text size="lg" weight="semibold">{metric.label} by country</Text>
          <Text size="sm" muted>
            One layer, shaded by a style expression — not one layer per bucket.
          </Text>
        </View>
        <View className="flex-row gap-2">
          {METRICS.map((option) => (
            <Chip
              key={option.id}
              selected={option.id === metric.id}
              onPress={() => setMetric(option)}
            >
              {option.label}
            </Chip>
          ))}
        </View>
      </View>

      <View className="flex-1">
        <Map blank bounds={EUROPE_BOUNDS}>
          <Map.GeoJSON
            data={data}
            fill={['interpolate', ['linear'], ['get', 'value'], 0, muted, peak, primary]}
            fillOpacity={0.9}
          />
          <Map.Controls position="top-right" />
        </Map>
      </View>

      {/* The ramp, as the thing it actually is: a strip of the same colours the
          layer uses, with only its ends labelled. */}
      <View className="gap-2 p-4">
        <View className="h-2 flex-row overflow-hidden rounded-full">
          {Array.from({ length: 12 }, (_, i) => (
            <View
              key={i}
              className="flex-1"
              style={{ backgroundColor: i === 0 ? muted : primary, opacity: 0.15 + (i / 11) * 0.85 }}
            />
          ))}
        </View>
        <View className="flex-row justify-between">
          <Text size="xs" muted>{metric.unit}0</Text>
          <Text size="xs" muted>
            {metric.unit}
            {peak.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Heatmap                                                                 */
/* -------------------------------------------------------------------------- */

/** Clustered around real city centres, so the density has somewhere to be. */
const HOTSPOTS: LngLat[] = [
  [-0.128, 51.507], [2.352, 48.857], [13.405, 52.520],
  [4.895, 52.370], [12.496, 41.903], [-3.703, 40.417],
];

function scatter() {
  const points: { lngLat: LngLat; weight: number }[] = [];
  HOTSPOTS.forEach(([lng, lat], city) => {
    const count = 40 + city * 8;
    for (let i = 0; i < count; i += 1) {
      const key = `${city}-${i}`;
      points.push({
        lngLat: [
          lng + (seeded(`x${key}`, -140, 140) / 100) * 0.9,
          lat + (seeded(`y${key}`, -140, 140) / 100) * 0.5,
        ],
        weight: seeded(`w${key}`, 10, 100) / 100,
      });
    }
  });
  return {
    type: 'FeatureCollection' as const,
    features: points.map((p, i) => ({
      type: 'Feature' as const,
      id: i,
      properties: { weight: p.weight },
      geometry: { type: 'Point' as const, coordinates: p.lngLat },
    })),
  };
}

export function HeatmapBlock() {
  const data = useMemo(scatter, []);

  return (
    <View className="flex-1">
      <View className="gap-1 p-4">
        <Text size="lg" weight="semibold">Reported outages</Text>
        <Text size="sm" muted>
          Where, rather than how many — zoom in and the layer gets out of the way.
        </Text>
      </View>
      <View className="flex-1">
        <Map bounds={[-10, 38, 20, 56]}>
          <Map.Heatmap data={data} weight="weight" radius={28} />
          <Map.Controls position="top-right" />
        </Map>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Delivery tracker                                                        */
/* -------------------------------------------------------------------------- */

const LEG_DONE: LngLat[] = [
  [-0.128, 51.507], [-0.09, 51.52], [-0.02, 51.54], [0.09, 51.56],
];
// Starts where the driven leg ends, so the join is a change of style rather
// than a gap.
const LEG_LEFT: LngLat[] = [
  [0.09, 51.56], [0.22, 51.575], [0.36, 51.585],
];

/** Each stop sits on the route rather than near it — the line joins them. */
const STOPS: {
  id: string; name: string; time: string; done: boolean; lngLat: LngLat;
}[] = [
  { id: '1', name: 'Depot — Southwark', time: '08:12', done: true, lngLat: [-0.128, 51.507] },
  { id: '2', name: 'Shoreditch High St', time: '09:40', done: true, lngLat: [-0.02, 51.54] },
  { id: '3', name: 'Hackney Wick', time: '10:25', done: true, lngLat: [0.09, 51.56] },
  { id: '4', name: 'Stratford', time: '11:05', done: false, lngLat: [0.22, 51.575] },
  { id: '5', name: 'Ilford', time: '11:50', done: false, lngLat: [0.36, 51.585] },
];

export function DeliveryTrackerBlock() {
  const done = STOPS.filter((s) => s.done).length;

  return (
    <View className="flex-1">
      <View className="flex-[3]">
        <Map center={[0.02, 51.545]} zoom={10.5}>
          <Map.Route id="done" coordinates={LEG_DONE} width={4} />
          <Map.Route id="left" coordinates={LEG_LEFT} width={4} dashed opacity={0.5} />
          {STOPS.map((stop) => (
            <Map.Marker key={stop.id} lngLat={stop.lngLat}>
              <View
                className={
                  stop.done
                    ? 'h-3 w-3 rounded-full border-2 border-background bg-primary'
                    : 'h-3 w-3 rounded-full border-2 border-background bg-muted-foreground'
                }
              />
            </Map.Marker>
          ))}
          <Map.Controls position="top-right" />
        </Map>
      </View>

      <Card className="max-h-[62%] rounded-b-none">
        <Card.Content className="gap-4 p-4">
          <View className="flex-row items-center gap-3">
            <Avatar size="sm" fallback="RA" />
            <View className="min-w-0 flex-1">
              <Text weight="medium" numberOfLines={1}>Rana A.</Text>
              <Text size="xs" muted numberOfLines={1}>Van 12 · LX21 KTF</Text>
            </View>
            <Badge>ETA 11:50</Badge>
          </View>

          <View className="gap-1.5">
            <View className="flex-row justify-between">
              <Text size="xs" muted>{done} of {STOPS.length} stops</Text>
              <Text size="xs" muted>{Math.round((done / STOPS.length) * 100)}%</Text>
            </View>
            <Progress value={(done / STOPS.length) * 100} />
          </View>

          <Separator />

          <ScrollView contentContainerClassName="gap-2">
            {STOPS.map((stop) => (
              <View key={stop.id} className="flex-row items-center gap-3">
                <View
                  className={
                    stop.done ? 'h-2 w-2 rounded-full bg-primary' : 'h-2 w-2 rounded-full bg-border'
                  }
                />
                <Text size="sm" className="min-w-0 flex-1" muted={!stop.done} numberOfLines={1}>
                  {stop.name}
                </Text>
                <Text size="xs" muted>{stop.time}</Text>
              </View>
            ))}
          </ScrollView>
        </Card.Content>
      </Card>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Store locator                                                           */
/* -------------------------------------------------------------------------- */

const STORES = [
  { id: 'sh', name: 'Shoreditch', address: '14 Rivington St', lngLat: [-0.081, 51.526] as LngLat, open: true },
  { id: 'so', name: 'Soho', address: '9 Berwick St', lngLat: [-0.135, 51.513] as LngLat, open: true },
  { id: 'kx', name: 'King’s Cross', address: 'Unit 3, Coal Drops', lngLat: [-0.126, 51.535] as LngLat, open: false },
  { id: 'br', name: 'Brixton', address: '22 Atlantic Rd', lngLat: [-0.114, 51.463] as LngLat, open: true },
];

export function StoreLocatorBlock() {
  const [selected, setSelected] = useState(STORES[0]);
  const map = useRef<MapHandle>(null);

  /*
   * `center` only seeds the camera — driving it from state would fight the
   * user's own panning, since every gesture would be undone on the next
   * render. Selecting a store is an explicit request to go somewhere, so it
   * goes through the ref instead.
   */
  const select = (store: (typeof STORES)[number]) => {
    setSelected(store);
    map.current?.flyTo({ center: store.lngLat, zoom: 14 });
  };

  return (
    <View className="flex-1">
      {/* Split by ratio rather than letting the list size itself: a list that
          grows with its content eventually pushes the map off the screen. */}
      <View className="flex-[3]">
        <Map ref={map} center={selected.lngLat} zoom={13}>
          {STORES.map((store) => (
            <Map.Marker
              key={store.id}
              lngLat={store.lngLat}
              onPress={() => select(store)}
            >
              <View
                className={
                  store.id === selected.id
                    ? 'h-5 w-5 rounded-full border-2 border-background bg-primary shadow-md'
                    : 'h-3.5 w-3.5 rounded-full border-2 border-background bg-muted-foreground'
                }
              />
            </Map.Marker>
          ))}
          <Map.Controls locate position="top-right" />
        </Map>
      </View>

      <View className="flex-[2]">
        <ScrollView contentContainerClassName="gap-2 p-4">
          {STORES.map((store) => (
            <Item
              key={store.id}
              onPress={() => select(store)}
              className={store.id === selected.id ? 'border-primary' : undefined}
            >
              <Item.Content>
                <Item.Title>{store.name}</Item.Title>
                <Item.Description>{store.address}</Item.Description>
              </Item.Content>
              <Item.Actions>
                <Chip size="sm" variant={store.open ? 'success' : 'outline'}>
                  {store.open ? 'Open' : 'Closed'}
                </Chip>
              </Item.Actions>
            </Item>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Logistics network                                                       */
/* -------------------------------------------------------------------------- */

const HUBS: { id: string; name: string; lngLat: LngLat; tier: 'hub' | 'spoke' }[] = [
  { id: 'ams', name: 'Amsterdam', lngLat: [4.895, 52.37], tier: 'hub' },
  { id: 'lon', name: 'London', lngLat: [-0.128, 51.507], tier: 'hub' },
  { id: 'ber', name: 'Berlin', lngLat: [13.405, 52.52], tier: 'spoke' },
  { id: 'par', name: 'Paris', lngLat: [2.352, 48.857], tier: 'spoke' },
  { id: 'mad', name: 'Madrid', lngLat: [-3.703, 40.417], tier: 'spoke' },
  { id: 'mil', name: 'Milan', lngLat: [9.19, 45.464], tier: 'spoke' },
  { id: 'cph', name: 'Copenhagen', lngLat: [12.568, 55.676], tier: 'spoke' },
];

const LANES = [
  { from: 'ams', to: 'ber' }, { from: 'ams', to: 'cph' },
  { from: 'ams', to: 'mil' }, { from: 'lon', to: 'par' },
  { from: 'lon', to: 'mad' }, { from: 'lon', to: 'ams' },
];

export function LogisticsNetworkBlock() {
  const [origin, setOrigin] = useState<string | null>(null);
  const byId = useMemo(() => Object.fromEntries(HUBS.map((h) => [h.id, h])), []);
  const lanes = origin ? LANES.filter((l) => l.from === origin || l.to === origin) : LANES;

  return (
    <View className="flex-1">
      <View className="gap-3 p-4">
        <View className="gap-1">
          <Text size="lg" weight="semibold">Network</Text>
          <Text size="sm" muted>
            {lanes.length} lanes across {HUBS.length} sites.
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            <Chip selected={origin === null} onPress={() => setOrigin(null)}>
              All
            </Chip>
            {HUBS.filter((h) => h.tier === 'hub').map((hub) => (
              <Chip
                key={hub.id}
                selected={origin === hub.id}
                onPress={() => setOrigin(hub.id)}
              >
                {hub.name}
              </Chip>
            ))}
          </View>
        </ScrollView>
      </View>

      <View className="flex-1">
        <Map blank bounds={[-12, 36, 26, 60]}>
          {lanes.map((lane) => (
            <Map.Arc
              key={`${lane.from}-${lane.to}`}
              id={`${lane.from}-${lane.to}`}
              from={byId[lane.from].lngLat}
              to={byId[lane.to].lngLat}
              curvature={0.18}
              opacity={0.8}
            />
          ))}
          {HUBS.map((site) => (
            <Map.Marker key={site.id} lngLat={site.lngLat}>
              <View
                className={
                  site.tier === 'hub'
                    ? 'h-3.5 w-3.5 rounded-full border-2 border-background bg-primary'
                    : 'h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground'
                }
              />
              <Map.Label>{site.name}</Map.Label>
            </Map.Marker>
          ))}
        </Map>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Uptime monitor                                                          */
/* -------------------------------------------------------------------------- */

const NODES: {
  id: string; city: string; lngLat: LngLat; state: 'up' | 'slow' | 'down'; ms: number;
}[] = [
  { id: 'lhr', city: 'London', lngLat: [-0.128, 51.507], state: 'up', ms: 24 },
  { id: 'fra', city: 'Frankfurt', lngLat: [8.682, 50.11], state: 'up', ms: 31 },
  { id: 'iad', city: 'Ashburn', lngLat: [-77.487, 39.043], state: 'slow', ms: 186 },
  { id: 'sfo', city: 'San Francisco', lngLat: [-122.419, 37.775], state: 'up', ms: 42 },
  { id: 'sin', city: 'Singapore', lngLat: [103.82, 1.352], state: 'down', ms: 0 },
  { id: 'syd', city: 'Sydney', lngLat: [151.209, -33.868], state: 'up', ms: 88 },
];

const NODE_CHIP = {
  up: 'success',
  slow: 'warning',
  down: 'destructive',
} as const;

export function UptimeMonitorBlock() {
  const down = NODES.filter((n) => n.state !== 'up').length;

  return (
    <View className="flex-1">
      <View className="flex-1">
        <Map blank center={[0, 25]} zoom={1.1}>
          {NODES.map((node) => (
            <Map.Marker key={node.id} lngLat={node.lngLat}>
              <View
                className={
                  node.state === 'up'
                    ? 'h-3 w-3 rounded-full border-2 border-background bg-success'
                    : node.state === 'slow'
                      ? 'h-3 w-3 rounded-full border-2 border-background bg-warning'
                      : 'h-3 w-3 rounded-full border-2 border-background bg-destructive'
                }
              />
              <Map.Label>{node.id.toUpperCase()}</Map.Label>
            </Map.Marker>
          ))}
        </Map>
      </View>

      <Frame className="rounded-b-none">
        <Frame.Header>
          <Frame.Title>Edge nodes</Frame.Title>
          <Frame.Action>
            <Chip size="sm" variant={down ? 'warning' : 'success'}>
              {down ? `${down} degraded` : 'All healthy'}
            </Chip>
          </Frame.Action>
        </Frame.Header>
        <Frame.Panel className="rounded-b-none">
          <ScrollView className="max-h-56">
            {NODES.map((node) => (
              <Frame.Row key={node.id}>
                <Frame.Content>
                  <Frame.Title>{node.city}</Frame.Title>
                  <Frame.Description>{node.id.toUpperCase()}</Frame.Description>
                </Frame.Content>
                <Frame.Actions>
                  <Text size="xs" muted>
                    {node.state === 'down' ? '—' : `${node.ms}ms`}
                  </Text>
                  <Chip size="sm" variant={NODE_CHIP[node.state]}>
                    {node.state}
                  </Chip>
                </Frame.Actions>
              </Frame.Row>
            ))}
          </ScrollView>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. Analytics card                                                          */
/* -------------------------------------------------------------------------- */

const WEEK = [
  { day: 'M', value: 320 }, { day: 'T', value: 410 }, { day: 'W', value: 380 },
  { day: 'T', value: 520 }, { day: 'F', value: 610 }, { day: 'S', value: 440 },
  { day: 'S', value: 390 },
];

/**
 * The small end of the range: a map as one element inside a card rather than
 * as the screen. `interactive={false}` because at this size a stray pan is an
 * accident rather than an intention — the card scrolls, the map does not.
 */
export function AnalyticsCardBlock() {
  const muted = useToken('--color-muted', 'rgba(0,0,0,0.06)');
  const primary = useToken('--color-primary', '#262626');
  const data = useMemo(() => europeFeatures(TRAFFIC_BY_CODE), []);

  return (
    <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
      <Card className="overflow-hidden">
        <View className="gap-1 p-4">
          <Text size="sm" muted>Weekly active</Text>
          <View className="flex-row items-end gap-2">
            <Text size="2xl" weight="semibold">3,072</Text>
            <Badge variant="outline" className="mb-1">+8.1%</Badge>
          </View>
        </View>
        <View className="px-2">
          <LineChart data={WEEK} xDataKey="day" aspectRatio={3}>
            <LineChart.Area dataKey="value" />
            <LineChart.Line dataKey="value" />
          </LineChart>
        </View>
        <Separator />
        <View className="h-44">
          <Map blank interactive={false} bounds={EUROPE_BOUNDS}>
            <Map.GeoJSON
              data={data}
              fill={['interpolate', ['linear'], ['get', 'value'], 0, muted, TRAFFIC_PEAK, primary]}
              fillOpacity={0.9}
            />
          </Map>
        </View>
        <View className="flex-row items-center justify-between p-4">
          <Text size="xs" muted>28 countries</Text>
          <Text size="xs" muted>Updated 4m ago</Text>
        </View>
      </Card>

      <View className="flex-row gap-3">
        {[
          { label: 'Sessions', value: '128k' },
          { label: 'Bounce', value: '32%' },
          { label: 'Avg. time', value: '4m 12s' },
        ].map((stat) => (
          // Three across a phone leaves ~80pt of content each, so these are
          // tighter than the two-up cards and hold one line apiece.
          <Card key={stat.label} className="flex-1">
            <Card.Content className="gap-1 p-3">
              <Text size="xs" muted numberOfLines={1}>{stat.label}</Text>
              <Text size="sm" weight="semibold" numberOfLines={1}>{stat.value}</Text>
            </Card.Content>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
