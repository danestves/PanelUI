import { useEffect, useState } from "react";
import { View } from "react-native";
import { Accordion, Alert, Attachment, Avatar, AreaChart, Badge, BarChart, Button, CandlestickChart, FileIcon, Frame, ImageIcon, Item, Text, Textarea, XIcon, Tooltip } from "panelui-native";
import type { ComponentEntry } from '../component-types';

/** Stable remote portraits for the Avatar demos. */
const AVATARS = [
  'https://i.pravatar.cc/150?img=12',
  'https://i.pravatar.cc/150?img=32',
  'https://i.pravatar.cc/150?img=47',
];

function AttachmentStatesDemo() {
  const states = [
    { state: 'uploading' as const, desc: 'Uploading…' },
    { state: 'processing' as const, desc: 'Processing…' },
    { state: 'error' as const, desc: 'Upload failed — tap to retry' },
    { state: 'done' as const, desc: 'PDF · 2.4 MB' },
  ];

  return (
    <View className="w-full gap-3">
      {states.map(({ state, desc }) => (
        <Attachment key={state} state={state}>
          <Attachment.Media>
            <FileIcon size={18} />
          </Attachment.Media>
          <Attachment.Content>
            <Attachment.Title>report.pdf</Attachment.Title>
            <Attachment.Description>{desc}</Attachment.Description>
          </Attachment.Content>
          <Attachment.Actions>
            <Attachment.Action accessibilityLabel={`Remove report.pdf (${state})`}>
              <XIcon size={16} />
            </Attachment.Action>
          </Attachment.Actions>
        </Attachment>
      ))}
    </View>
  );
}

function AttachmentUploadDemo() {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  const start = () => {
    if (running) return;
    setRunning(true);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((current) => {
        const next = current + 0.08;
        if (next >= 1) {
          clearInterval(timer);
          setRunning(false);
          return 1;
        }
        return next;
      });
    }, 160);
  };

  const state = running ? 'uploading' : progress >= 1 ? 'done' : 'idle';

  return (
    <View className="w-full gap-3">
      <Attachment state={state} progress={progress}>
        <Attachment.Media>
          <ImageIcon size={18} />
        </Attachment.Media>
        <Attachment.Content>
          <Attachment.Title>screenshot.png</Attachment.Title>
          <Attachment.Description>
            {running
              ? `Uploading — ${Math.round(progress * 100)}%`
              : progress >= 1
                ? 'PNG · 1.1 MB'
                : 'Ready to upload'}
          </Attachment.Description>
        </Attachment.Content>
      </Attachment>

      <Button variant="outline" onPress={start} loading={running}>
        {progress >= 1 ? 'Upload again' : 'Start upload'}
      </Button>
    </View>
  );
}

const FAQ_DATA = [
  {
    value: 'shipping',
    question: 'How long does shipping take?',
    answer: 'Standard delivery arrives in three to five working days.',
  },
  {
    value: 'returns',
    question: 'What is your returns policy?',
    answer: 'Send anything back within 30 days for a full refund.',
  },
  {
    value: 'support',
    question: 'How do I contact support?',
    answer: 'Reply to your order email and a person will answer.',
  },
];

/** Renders the shared FAQ data in whichever accordion variant is asked for. */
function AccordionDemo({
  variant,
  selectionMode = 'single',
}: {
  variant: 'default' | 'surface' | 'separated' | 'bordered' | 'ghost';
  selectionMode?: 'single' | 'multiple';
}) {
  return (
    <Accordion
      variant={variant}
      selectionMode={selectionMode}
      defaultValue={selectionMode === 'multiple' ? ['shipping', 'returns'] : 'shipping'}
      className="w-full"
    >
      {FAQ_DATA.map((entry) => (
        <Accordion.Item key={entry.value} value={entry.value}>
          <Accordion.Trigger>
            <Accordion.Title>{entry.question}</Accordion.Title>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content>{entry.answer}</Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

/**
 * The demo `keepMounted` exists for: a body with something in it worth losing.
 * Type into the field, collapse the section, open it again — the text is still
 * there, because the body was hidden rather than unmounted.
 */
function AccordionKeepMountedDemo() {
  return (
    <View className="w-full gap-3">
      <Accordion variant="surface" keepMounted defaultValue="note" className="w-full">
        <Accordion.Item value="note">
          <Accordion.Trigger>
            <Accordion.Title>Delivery note</Accordion.Title>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content>
            <Textarea placeholder="Leave it with a neighbour…" />
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="gift">
          <Accordion.Trigger>
            <Accordion.Title>Gift message</Accordion.Title>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content>
            <Textarea placeholder="Happy birthday…" />
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>

      <Text size="xs" muted>
        Type into a field, collapse the section, then open it again.
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Bar, area and ring charts                                                  */
/* -------------------------------------------------------------------------- */

const BAR_REVENUE = [
  { month: 'Jan', revenue: 12000, costs: 7400 },
  { month: 'Feb', revenue: 15500, costs: 8100 },
  { month: 'Mar', revenue: 14200, costs: 8800 },
  { month: 'Apr', revenue: 18900, costs: 9200 },
  { month: 'May', revenue: 21400, costs: 10100 },
  { month: 'Jun', revenue: 19800, costs: 11300 },
  { month: 'Jul', revenue: 24600, costs: 11900 },
  { month: 'Aug', revenue: 26100, costs: 12400 },
];

const AREA_TRAFFIC = Array.from({ length: 24 }, (_unused, hour) => {
  const shape = Math.sin(((hour - 4) / 24) * Math.PI * 2) * 0.5 + 0.5;
  return {
    hour: `${String(hour).padStart(2, '0')}:00`,
    direct: Math.round(120 + shape * 380),
    search: Math.round(80 + shape * 520),
    social: Math.round(40 + shape * 190),
  };
});

const CHANNELS = [
  { name: 'Email', sent: 4820 },
  { name: 'Push', sent: 3140 },
  { name: 'SMS', sent: 1960 },
  { name: 'In-app', sent: 1420 },
  { name: 'Web', sent: 880 },
];

/** Two series side by side, which is what a bar chart is for. */
/** Padding the header needs to line up inside a `Frame.Panel`, which has none. */
const CHART_HEADER = 'px-4 pt-3.5';

const BAR_TOTALS = BAR_REVENUE.reduce(
  (running, month) => ({
    revenue: running.revenue + month.revenue,
    costs: running.costs + month.costs,
  }),
  { revenue: 0, costs: 0 }
);

const money = (value: number) => `£${value.toLocaleString()}`;

/**
 * Thirty sessions of a share price, walked from an opening number.
 *
 * Generated rather than typed out so the shape is a plausible one — a real
 * series wanders, and a handwritten one either trends too cleanly or jitters
 * in a way no instrument does.
 */
const CANDLE_SESSIONS = (() => {
  const rows: {
    day: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }[] = [];
  let previous = 182.4;

  for (let index = 0; index < 30; index += 1) {
    // A fixed wobble per index rather than Math.random, so the chart is the
    // same every time the screen is opened and a screenshot stays comparable.
    const drift = Math.sin(index * 0.7) * 2.4 + Math.cos(index * 1.9) * 1.3;
    const open = previous;
    const close = Math.max(1, open + drift);
    const spread = 0.8 + Math.abs(Math.sin(index * 2.3)) * 2.2;
    rows.push({
      day: `${((index % 28) + 1).toString()} Sep`,
      open: Number(open.toFixed(2)),
      close: Number(close.toFixed(2)),
      high: Number((Math.max(open, close) + spread).toFixed(2)),
      low: Number((Math.min(open, close) - spread).toFixed(2)),
    });
    previous = close;
  }

  return rows;
})();

const CANDLE_LAST = CANDLE_SESSIONS[CANDLE_SESSIONS.length - 1]!;

const CANDLE_FIRST = CANDLE_SESSIONS[0]!;

const price = (value: number) => `$${value.toFixed(2)}`;

/** How a session, or the whole run, moved — the line under the readout. */
function candleChange(from: number, to: number) {
  const delta = to - from;
  const percent = from === 0 ? 0 : (delta / from) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%)`;
}

/** The whole run, with a readout that follows the finger. */
function CandlestickChartSessionsVersion() {
  const [active, setActive] = useState<(typeof CANDLE_SESSIONS)[number] | null>(null);
  const shown = active ?? CANDLE_LAST;

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Northwind Materials</Frame.Title>
          <Frame.Action>Drag to inspect</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <CandlestickChart
            data={CANDLE_SESSIONS}
            xDataKey="day"
            aspectRatio={1.5}
            onActiveIndexChange={(_index, datum) =>
              setActive(datum as (typeof CANDLE_SESSIONS)[number] | null)
            }
          >
            {/* The value is passed in rather than derived, so the header can
                show the last close when nothing is pressed and a session's
                close when something is. */}
            <CandlestickChart.Header
              className={CHART_HEADER}
              title="NWM · Daily"
              value={price(shown.close)}
              caption={
                active
                  ? `${active.day} · ${candleChange(active.open, active.close)}`
                  : `30 sessions · ${candleChange(CANDLE_FIRST.open, CANDLE_LAST.close)}`
              }
              legend
            />
            <CandlestickChart.Grid />
            <CandlestickChart.Candles />
            <CandlestickChart.YAxis />
            <CandlestickChart.XAxis />
            <CandlestickChart.Tooltip formatValue={price} />
          </CandlestickChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** The same data with the axes off, which is what a card-sized chart wants. */
function CandlestickChartBareVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Last ten sessions</Frame.Title>
          <Frame.Action>No axes</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <CandlestickChart
            data={CANDLE_SESSIONS.slice(-10)}
            xDataKey="day"
            aspectRatio={1.9}
            candleGap={0.42}
          >
            <CandlestickChart.Header
              className={CHART_HEADER}
              value={price(CANDLE_LAST.close)}
              caption={candleChange(
                CANDLE_SESSIONS[CANDLE_SESSIONS.length - 10]!.open,
                CANDLE_LAST.close
              )}
            />
            <CandlestickChart.Candles cornerRadius={2} />
            <CandlestickChart.XAxis />
          </CandlestickChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** Waiting for the series, and the same component throughout. */
function CandlestickChartLoadingVersion() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('ready'), 1400);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <View className="flex-1 justify-center gap-3 p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Fetching sessions</Frame.Title>
          <Frame.Action>{status === 'loading' ? 'Loading' : 'Ready'}</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <CandlestickChart
            data={CANDLE_SESSIONS.slice(-16)}
            xDataKey="day"
            aspectRatio={1.6}
            status={status}
          >
            <CandlestickChart.Header
              className={CHART_HEADER}
              title="NWM · Daily"
              value={status === 'loading' ? '—' : price(CANDLE_LAST.close)}
            />
            <CandlestickChart.Grid />
            <CandlestickChart.Candles />
            <CandlestickChart.XAxis />
            <CandlestickChart.Tooltip formatValue={price} />
          </CandlestickChart>
        </Frame.Panel>
      </Frame>
      <Button variant="outline" onPress={() => setStatus('loading')}>
        Load again
      </Button>
    </View>
  );
}

/*
 * One chart per version, not two in a scroller.
 *
 * These are pages now, and a page is a fixed height — a demo that brought its
 * own vertical ScrollView both fought the pager for the drag and stacked its
 * two charts into the space meant for one.
 */
function BarChartGroupedVersion() {
  const [active, setActive] = useState<(typeof BAR_REVENUE)[number] | null>(null);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Revenue and costs</Frame.Title>
          <Frame.Action>Drag to inspect</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <BarChart
            data={BAR_REVENUE}
            xDataKey="month"
            aspectRatio={2}
            onActiveIndexChange={(_index, datum) =>
              setActive(datum as (typeof BAR_REVENUE)[number] | null)
            }
          >
            {/* The value follows the finger and falls back to the total, which
                is why it is passed in rather than derived by the header. */}
            <BarChart.Header
              className={CHART_HEADER}
              value={money(active ? active.revenue : BAR_TOTALS.revenue)}
              caption={
                active
                  ? `${active.month} · ${money(active.costs)} out`
                  : `8 months · ${money(BAR_TOTALS.costs)} out`
              }
              labels={{ revenue: 'Revenue', costs: 'Costs' }}
              legend
            />
            <BarChart.Grid />
            <BarChart.Bar dataKey="revenue" />
            <BarChart.Bar dataKey="costs" colorIndex={2} />
            <BarChart.XAxis />
            <BarChart.Tooltip formatValue={money} />
          </BarChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** The same two series read as a total instead of as a comparison. */
function BarChartStackedVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Stacked</Frame.Title>
          <Frame.Action>Same two series</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <BarChart data={BAR_REVENUE} xDataKey="month" stacked stackGap={2} aspectRatio={2}>
            <BarChart.Header
              className={CHART_HEADER}
              value={money(BAR_TOTALS.revenue + BAR_TOTALS.costs)}
              caption="A total, not a comparison"
              labels={{ revenue: 'Revenue', costs: 'Costs' }}
              legend
            />
            <BarChart.Grid />
            <BarChart.Bar dataKey="costs" colorIndex={2} />
            <BarChart.Bar dataKey="revenue" />
            <BarChart.XAxis />
          </BarChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** Sideways, which is what long category names need. */
function BarChartHorizontalVersion() {
  const sent = CHANNELS.reduce((total, channel) => total + channel.sent, 0);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Messages sent</Frame.Title>
          <Frame.Action>Last 30 days</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <BarChart
            data={CHANNELS}
            xDataKey="name"
            orientation="horizontal"
            aspectRatio={1.7}
            barGap={0.35}
          >
            <BarChart.Header
              className={CHART_HEADER}
              value={sent.toLocaleString()}
              caption="Sideways · names have room"
            />
            <BarChart.Grid />
            <BarChart.Bar dataKey="sent" colorIndex={3} />
            <BarChart.YAxis />
            <BarChart.Tooltip />
          </BarChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** Stacked areas, where the top edge is the whole and each band is a share. */
function AreaChartStackedVersion() {
  const [active, setActive] = useState<(typeof AREA_TRAFFIC)[number] | null>(null);
  const day = AREA_TRAFFIC.reduce(
    (total, hour) => total + hour.direct + hour.search + hour.social,
    0
  );
  const total = active ? active.direct + active.search + active.social : day;

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Sessions by channel</Frame.Title>
          <Frame.Action>Drag to inspect</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <AreaChart
            data={AREA_TRAFFIC}
            xDataKey="hour"
            stacked
            aspectRatio={1.9}
            onActiveIndexChange={(_index, datum) =>
              setActive(datum as (typeof AREA_TRAFFIC)[number] | null)
            }
          >
            <AreaChart.Header
              className={CHART_HEADER}
              value={total.toLocaleString()}
              caption={
                active
                  ? `${active.hour} · this hour`
                  : 'Across the day'
              }
              labels={{ direct: 'Direct', search: 'Search', social: 'Social' }}
              legend
            />
            <AreaChart.Grid />
            <AreaChart.Area dataKey="direct" />
            <AreaChart.Area dataKey="search" colorIndex={2} />
            <AreaChart.Area dataKey="social" colorIndex={3} />
            <AreaChart.XAxis ticks={5} />
            <AreaChart.Tooltip />
          </AreaChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** Overlaid instead, for series that are alternatives rather than parts. */
function AreaChartOverlaidVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Two plans compared</Frame.Title>
          <Frame.Action>Peak hour</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <AreaChart data={AREA_TRAFFIC} xDataKey="hour" aspectRatio={1.9}>
            <AreaChart.Header
              className={CHART_HEADER}
              value="600"
              caption="Unstacked · bands overlay"
              labels={{ direct: 'Direct', search: 'Search' }}
              legend
            />
            <AreaChart.Grid />
            <AreaChart.Area dataKey="search" colorIndex={2} />
            <AreaChart.Area dataKey="direct" />
            <AreaChart.XAxis ticks={5} />
            <AreaChart.YAxis />
            <AreaChart.Tooltip />
          </AreaChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

export const ENTRIES: ComponentEntry[] = [
{
    slug: 'accordion',
    name: 'Accordion',
    summary: 'Collapsible sections, single or multiple',
    demos: [
      { label: 'Default', render: () => <AccordionDemo variant="default" /> },
      { label: 'Surface', render: () => <AccordionDemo variant="surface" /> },
      { label: 'Separated', render: () => <AccordionDemo variant="separated" /> },
      { label: 'Bordered', render: () => <AccordionDemo variant="bordered" /> },
      { label: 'Ghost', render: () => <AccordionDemo variant="ghost" /> },
      {
        label: 'Multiple open',
        render: () => <AccordionDemo variant="surface" selectionMode="multiple" />,
      },
      { label: 'Keeps its state', render: () => <AccordionKeepMountedDemo /> },
    ],
  },
{
    slug: 'alert',
    name: 'Alert',
    summary: 'Status message with an icon',
    demos: [
      {
        label: 'Variants',
        render: () => (
          <View className="w-full gap-3">
            {(['info', 'success', 'warning', 'destructive'] as const).map((variant) => (
              <Alert key={variant} variant={variant}>
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>
                    {variant === 'info'
                      ? 'Heads up'
                      : variant === 'success'
                        ? 'Payment received'
                        : variant === 'warning'
                          ? 'Storage almost full'
                          : 'Something went wrong'}
                  </Alert.Title>
                  <Alert.Description>
                    {variant === 'info'
                      ? 'A new version of PanelUI is available.'
                      : variant === 'success'
                        ? 'Your invoice has been paid.'
                        : variant === 'warning'
                          ? "You've used 92% of your quota."
                          : 'Your session has expired.'}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ))}
          </View>
        ),
      },
      {
        label: 'Title only',
        render: () => (
          <Alert variant="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Changes saved</Alert.Title>
            </Alert.Content>
          </Alert>
        ),
      },
      {
        label: 'No icon',
        render: () => (
          <Alert>
            <Alert.Content>
              <Alert.Title>Plain alert</Alert.Title>
              <Alert.Description>
                Omit Alert.Indicator for a text-only alert.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ),
      },
    ],
  },
{
    slug: 'area-chart',
    name: 'AreaChart',
    summary: 'Filled bands over time, stacked or overlaid',
    layout: 'pager',
    demos: [
      {
        label: 'Stacked',
        id: 'stacked',
        fullPage: true,
        description: 'The top edge is the total; each band is its share of it.',
        render: () => <AreaChartStackedVersion />,
      },
      {
        label: 'Overlaid',
        id: 'overlaid',
        fullPage: true,
        description: 'Alternatives rather than parts, so the fills go translucent.',
        render: () => <AreaChartOverlaidVersion />,
      },
    ],
  },
{
    slug: 'avatar',
    name: 'Avatar',
    summary: 'User image with initials fallback',
    demos: [
      {
        label: 'Sizes',
        render: () => (
          <View className="flex-row items-end gap-3">
            <Avatar size="sm" fallback="KA" />
            <Avatar fallback="KA" />
            <Avatar size="lg" fallback="PU" />
            <Avatar size="xl" fallback="P" />
          </View>
        ),
      },
      {
        label: 'With image',
        render: () => (
          <View className="flex-row items-end gap-3">
            <Avatar size="sm" source={{ uri: AVATARS[0] }} fallback="AB" />
            <Avatar source={{ uri: AVATARS[1] }} fallback="CD" />
            <Avatar size="lg" source={{ uri: AVATARS[2] }} fallback="EF" />
          </View>
        ),
      },
      {
        label: 'With notification badge',
        render: () => (
          <View className="flex-row items-center gap-6">
            <Avatar size="lg" source={{ uri: AVATARS[0] }} fallback="AB">
              <Avatar.Badge>
                <Badge variant="destructive" count={5} />
              </Avatar.Badge>
            </Avatar>
            <Avatar size="lg" source={{ uri: AVATARS[1] }} fallback="CD">
              <Avatar.Badge>
                <Badge variant="destructive" count={128} />
              </Avatar.Badge>
            </Avatar>
            <Avatar size="lg" fallback="EF">
              <Avatar.Badge>
                <Badge variant="success" shape="dot" />
              </Avatar.Badge>
            </Avatar>
          </View>
        ),
      },
      {
        label: 'Stacked group',
        render: () => (
          <Avatar.Group>
            {AVATARS.map((uri, index) => (
              <Avatar key={uri} source={{ uri }} fallback={String.fromCharCode(65 + index)} />
            ))}
          </Avatar.Group>
        ),
      },
      {
        label: 'A capped group',
        render: () => (
          <View className="w-full gap-5">
            {/* Three of the three, and thirty-seven more behind them. */}
            <Avatar.Group size="sm" max={3} total={40}>
              {AVATARS.map((uri, index) => (
                <Avatar key={uri} source={{ uri }} fallback={String.fromCharCode(65 + index)} />
              ))}
            </Avatar.Group>
            {/* The cap counts faces: two shown, one counted. */}
            <Avatar.Group max={2}>
              {AVATARS.map((uri, index) => (
                <Avatar key={uri} source={{ uri }} fallback={String.fromCharCode(65 + index)} />
              ))}
            </Avatar.Group>
            {/* `overlap={0}` closes the stack up into a plain row. */}
            <Avatar.Group size="lg" overlap={0} className="gap-2">
              {AVATARS.map((uri, index) => (
                <Avatar key={uri} source={{ uri }} fallback={String.fromCharCode(65 + index)} />
              ))}
            </Avatar.Group>
          </View>
        ),
      },
    ],
  },
{
    slug: 'attachment',
    name: 'Attachment',
    summary: 'File row with upload states, built on Item',
    demos: [
      {
        label: 'Done',
        render: () => (
          <Attachment className="w-full">
            <Attachment.Media>
              <FileIcon size={18} />
            </Attachment.Media>
            <Attachment.Content>
              <Attachment.Title>sales-dashboard.pdf</Attachment.Title>
              <Attachment.Description>PDF · 2.4 MB</Attachment.Description>
            </Attachment.Content>
            <Attachment.Actions>
              <Attachment.Action accessibilityLabel="Remove sales-dashboard.pdf">
                <XIcon size={16} />
              </Attachment.Action>
            </Attachment.Actions>
          </Attachment>
        ),
      },
      { label: 'Upload states', render: () => <AttachmentStatesDemo /> },
      { label: 'A live upload', render: () => <AttachmentUploadDemo /> },
      {
        label: 'A group of thumbnails',
        render: () => (
          <Attachment.Group orientation="horizontal" className="w-full">
            {['cover.png', 'hero.jpg', 'logo.svg'].map((name) => (
              <Attachment key={name} orientation="vertical" className="w-32">
                <Attachment.Media variant="icon">
                  <ImageIcon size={18} />
                </Attachment.Media>
                <Attachment.Content>
                  <Attachment.Title className="text-sm">{name}</Attachment.Title>
                  <Attachment.Description>Image</Attachment.Description>
                </Attachment.Content>
              </Attachment>
            ))}
          </Attachment.Group>
        ),
      },
    ],
  },
{
    slug: 'badge',
    name: 'Badge',
    summary: 'Compact status label',
    demos: [
      {
        label: 'Variants',
        render: () => (
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="destructive">Error</Badge>
            <Badge variant="info">Info</Badge>
          </View>
        ),
      },
      {
        label: 'With status dot',
        render: () => (
          <View className="gap-2">
            {([
              ['success', '#10b981', 'Operational'],
              ['warning', '#f59e0b', 'Degraded'],
              ['destructive', '#ef4444', 'Outage'],
            ] as const).map(([variant, dot, text]) => (
              <Badge key={variant} variant={variant}>
                <View
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: dot }}
                />
                <Text size="xs" weight="medium">
                  {text}
                </Text>
              </Badge>
            ))}
          </View>
        ),
      },
    ],
  },
{
    slug: 'bar-chart',
    name: 'BarChart',
    summary: 'Categories compared by length, grouped or stacked',
    layout: 'pager',
    demos: [
      {
        label: 'Grouped',
        id: 'grouped',
        fullPage: true,
        description: 'Two series side by side, compared by length.',
        render: () => <BarChartGroupedVersion />,
      },
      {
        label: 'Stacked',
        id: 'stacked',
        fullPage: true,
        description: 'The same two series read as a total instead of as a comparison.',
        render: () => <BarChartStackedVersion />,
      },
      {
        label: 'Sideways',
        id: 'horizontal',
        fullPage: true,
        description: 'Horizontal bars, for category names that need the room.',
        render: () => <BarChartHorizontalVersion />,
      },
    ],
  },
{
    slug: 'candlestick-chart',
    name: 'CandlestickChart',
    summary: 'Open, high, low and close for a period, drawn as one mark',
    layout: 'pager',
    demos: [
      {
        label: 'Sessions',
        id: 'sessions',
        fullPage: true,
        description: 'Thirty sessions, with a readout that follows the finger.',
        render: () => <CandlestickChartSessionsVersion />,
      },
      {
        label: 'No axes',
        id: 'bare',
        fullPage: true,
        description: 'The last ten, sized for a card rather than for a screen.',
        render: () => <CandlestickChartBareVersion />,
      },
      {
        label: 'Loading',
        id: 'loading',
        fullPage: true,
        description: 'Placeholder candles growing into the real ones.',
        render: () => <CandlestickChartLoadingVersion />,
      },
    ],
  }
];
export const ENTRIES_BY_SLUG = Object.fromEntries(ENTRIES.map((entry) => [entry.slug, entry]));
