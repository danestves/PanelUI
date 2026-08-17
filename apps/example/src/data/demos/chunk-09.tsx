import { useEffect, useRef, useState } from "react";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import { ScrollView, View } from "react-native";
import { Button, Frame, FunnelChart, type FunnelDatum, LiveLineChart, PieChart, Plot, usePlot, yOf, PolarAreaChart, type PieDatum, type PolarAreaDatum, type LiveLinePoint, RingChart, type RingDatum, ScrollProgress, ScrollText, Skeleton, Text, Tooltip, TreemapChart, type TreemapDatum } from "panelui-native";
import { Path as SvgPath } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import type { ComponentEntry } from '../component-types';

/** For the custom `Plot` mark below — an SVG path whose `d` is set on the UI thread. */
const AnimatedPath = Animated.createAnimatedComponent(SvgPath);

/* -------------------------------------------------------------------------- */
/* ScrollText and ScrollCanvas                                                */
/* -------------------------------------------------------------------------- */

const SCROLL_LINES = [
  'Every control ships with its accessibility wiring already done.',
  'Animations run on the UI thread, so a busy list never drops them.',
  'Semantic tokens mean a theme swap moves every component at once.',
  'Overlays mount lazily and unmount once they have finished leaving.',
];

/** Spacers, so each block gets a screen of scroll to resolve across. */
function ScrollGap({ label }: { label?: string }) {
  return (
    <View className="h-72 items-center justify-center">
      {label ? (
        <Text size="xs" muted className="uppercase tracking-wider">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

function ScrollTextVersion({ effect }: { effect: 'color' | 'fade' | 'rise' | 'highlight' }) {
  return (
    <ScrollProgress className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollGap label={`scroll down — ${effect}`} />
        {SCROLL_LINES.map((line) => (
          <View key={line} className="px-6">
            <ScrollText effect={effect} size="2xl" weight="semibold">
              {line}
            </ScrollText>
            <ScrollGap />
          </View>
        ))}
        <ScrollGap label="that is all of them" />
      </ScrollView>
    </ScrollProgress>
  );
}

/** Character-by-character, which reads as typing rather than as reading. */
function ScrollTextCharactersVersion() {
  return (
    <ScrollProgress className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollGap label="scroll down" />
        <View className="px-6">
          <ScrollText by="character" stagger={0.12} size="3xl" weight="bold">
            One character at a time.
          </ScrollText>
        </View>
        <ScrollGap />
        <View className="px-6">
          {/* A wide stagger brightens the whole line together instead of
              running an edge along it. */}
          <ScrollText stagger={0.9} size="3xl" weight="bold">
            And one where the whole line arrives at once.
          </ScrollText>
        </View>
        <ScrollGap label="that is all of them" />
      </ScrollView>
    </ScrollProgress>
  );
}

const GOALS: RingDatum[] = [
  { label: 'Move', value: 486, maxValue: 600 },
  { label: 'Exercise', value: 24, maxValue: 30 },
  { label: 'Stand', value: 9, maxValue: 12 },
];

/** Two series side by side, which is what a bar chart is for. */
/** Padding the header needs to line up inside a `Frame.Panel`, which has none. */
const CHART_HEADER = 'px-4 pt-3.5';

const money = (value: number) => `£${value.toLocaleString()}`;

const percentOf = (ring: RingDatum) =>
  ring.maxValue > 0 ? Math.round((ring.value / ring.maxValue) * 100) : 0;

/**
 * Side of the plot on the ring versions. A ring is square, so left to take the
 * width it stands twice as tall as the bar and area plots beside it at
 * `aspectRatio={2}` — this is those, and a little over.
 */
const RING_SIZE = 208;

/** Three targets, each read against its own. */
function RingChartGoalsVersion() {
  const [active, setActive] = useState(-1);
  const ring = active >= 0 ? GOALS[active] : null;

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Today</Frame.Title>
          <Frame.Action>Tap a ring</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          {/* Sized rather than measured. Left to take the width the square
              would be twice the height the other charts stand at. */}
          <RingChart
            data={GOALS}
            size={RING_SIZE}
            strokeWidth={16}
            ringGap={6}
            className="pb-4"
            activeIndex={active}
            onActiveIndexChange={setActive}
          >
            {/* The value follows the selection and falls back to the headline
                ring, which is why it is passed in rather than derived — there
                is no total to derive from three unrelated targets. */}
            <RingChart.Header
              className={CHART_HEADER}
              value={`${percentOf(ring ?? GOALS[0]!)}%`}
              caption={
                ring
                  ? `${ring.label} · ${ring.value} of ${ring.maxValue}`
                  : 'Each ring against its own target'
              }
              legend
            />
            {GOALS.map((goal, index) => (
              <RingChart.Ring key={goal.label} index={index} />
            ))}
            <RingChart.Center defaultLabel="Move" />
          </RingChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

const HEALTH: RingDatum[] = [{ label: 'Health', value: 82, maxValue: 100 }];

/**
 * The ring opened into a gauge. Three quarters of a turn with the notch at the
 * bottom, which is where a dial has always had it.
 */
function RingChartGaugeVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Index health</Frame.Title>
          <Frame.Action>Last run 4m ago</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <RingChart
            data={HEALTH}
            size={RING_SIZE}
            startAngle={-135}
            endAngle={135}
            strokeWidth={18}
            className="pb-4"
          >
            <RingChart.Header
              className={CHART_HEADER}
              title="Score"
              value="82 of 100"
              caption="Above the 75 the alerting is set at"
            />
            <RingChart.Ring index={0} colorIndex={2} />
            <RingChart.Center
              formatValue={(value) => `${value}`}
              defaultLabel="Healthy"
            />
          </RingChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

const COURSE_SESSIONS: RingDatum[] = [{ label: 'Sessions', value: 8, maxValue: 12 }];

/**
 * Ticks instead of an arc, for a target made of countable things. Eight of
 * twelve reads off ticks you can count, and off a smooth arc only as "about
 * two thirds".
 */
function RingChartSegmentedVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Course progress</Frame.Title>
          <Frame.Action>Spring cohort</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <RingChart data={COURSE_SESSIONS} size={RING_SIZE} strokeWidth={16} className="pb-4">
            <RingChart.Header
              className={CHART_HEADER}
              title="Sessions attended"
              value="8 of 12"
              caption="Four left before the assessment"
            />
            <RingChart.Ring index={0} segments={12} segmentGap={6} colorIndex={4} />
            <RingChart.Center formatValue={(value) => `${value}`} />
          </RingChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

const BUDGETS: RingDatum[] = [
  { label: 'Compute', value: 412, maxValue: 500 },
  { label: 'Storage', value: 96, maxValue: 400 },
  { label: 'Egress', value: 268, maxValue: 300 },
];

/**
 * Three charts rather than three rings. Separate targets that are not read
 * against each other belong on separate dials — concentric, the outer ring is
 * longer than the inner one at the same percentage, and the eye reads the
 * length.
 */
function RingChartTilesVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Monthly budgets</Frame.Title>
          <Frame.Action>8 days left</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <View className="flex-row items-start justify-around p-4">
            {BUDGETS.map((budget, index) => (
              <View key={budget.label} className="items-center gap-1.5">
                <RingChart
                  data={[budget]}
                  size={92}
                  strokeWidth={9}
                  startAngle={-120}
                  endAngle={120}
                >
                  <RingChart.Ring
                    index={0}
                    colorIndex={((index % 5) + 1) as 1 | 2 | 3 | 4 | 5}
                  />
                  <RingChart.Center formatValue={() => `${percentOf(budget)}%`} />
                </RingChart>
                <Text size="xs" weight="medium">
                  {budget.label}
                </Text>
                <Text size="xs" muted>
                  {budget.value} of {budget.maxValue}
                </Text>
              </View>
            ))}
          </View>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* PieChart                                                                   */
/* -------------------------------------------------------------------------- */

/** One month's spend, split between the things it went on. */
const SPEND: PieDatum[] = [
  { label: 'Rent', value: 1450 },
  { label: 'Food', value: 620 },
  { label: 'Transport', value: 210 },
  { label: 'Utilities', value: 185 },
  { label: 'Everything else', value: 240 },
];

/** A split with a long tail, which is what `minAngle` is for. */
const TRAFFIC_SOURCES: PieDatum[] = [
  { label: 'Organic', value: 41800 },
  { label: 'Direct', value: 18400 },
  { label: 'Referral', value: 6300 },
  { label: 'Social', value: 2100 },
  { label: 'Email', value: 240 },
];

const SPEND_TOTAL = SPEND.reduce((sum, slice) => sum + slice.value, 0);

const PIE_SIZE = 208;

/** The plain pie: five parts of one obvious whole, with a key beside it. */
function PieBasicVersion() {
  const [active, setActive] = useState(-1);
  const slice = active >= 0 ? SPEND[active] : null;

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Where it went</Frame.Title>
          <Frame.Action>Tap a slice</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <PieChart
            data={SPEND}
            size={PIE_SIZE}
            className="pb-4"
            activeIndex={active}
            onActiveIndexChange={setActive}
          >
            <PieChart.Header
              className={CHART_HEADER}
              value={money(slice ? slice.value : SPEND_TOTAL)}
              caption={
                slice
                  ? `${slice.label} · ${Math.round((slice.value / SPEND_TOTAL) * 100)}% of the month`
                  : 'August, across five categories'
              }
            />
            <PieChart.Slices />
            <PieChart.Legend className="px-4" />
          </PieChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/**
 * The donut, which is the pie with somewhere to put the number.
 *
 * The total is the one figure a reader of a pie can actually use — the angles
 * say roughly how the parts compare and the middle says what they came to.
 */
function PieDonutVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Monthly spend</Frame.Title>
          <Frame.Action>Tap for a category</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <PieChart data={SPEND} size={PIE_SIZE} innerRadius={0.62} className="pb-4">
            <PieChart.Header className={CHART_HEADER} title="August" />
            <PieChart.Slices />
            <PieChart.Center formatValue={(value) => money(value)} />
            <PieChart.Legend className="px-4" />
          </PieChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/**
 * Padded, rounded and floored.
 *
 * `minAngle` is the one doing the work here: email is a third of a percent of
 * the traffic, and without a floor it is a hairline nobody can see or press —
 * which reads as absent rather than as tiny.
 */
function PieSegmentsVersion() {
  const [active, setActive] = useState(-1);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Traffic by source</Frame.Title>
          <Frame.Action>Last 30 days</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <PieChart
            data={TRAFFIC_SOURCES}
            size={PIE_SIZE}
            innerRadius={0.58}
            padAngle={3}
            minAngle={6}
            className="pb-4"
            activeIndex={active}
            onActiveIndexChange={setActive}
          >
            <PieChart.Header className={CHART_HEADER} title="Sessions" />
            <PieChart.Slices cornerRadius={6} />
            <PieChart.Center defaultLabel="Sessions" />
            <PieChart.Legend className="px-4" />
          </PieChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** What is on the disk, on a dial that stops short of a full turn. */
const STORAGE: PieDatum[] = [
  { label: 'Photos', value: 684 },
  { label: 'Video', value: 412 },
  { label: 'Backups', value: 233 },
  { label: 'Free', value: 719 },
];

/** The dial: three quarters of a turn, with the notch at the bottom. */
function PieDialVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Storage</Frame.Title>
          <Frame.Action>2 TB plan</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <PieChart
            data={STORAGE}
            size={PIE_SIZE}
            innerRadius={0.66}
            startAngle={-135}
            endAngle={135}
            padAngle={2}
            className="pb-4"
          >
            <PieChart.Header className={CHART_HEADER} title="In use" />
            <PieChart.Slices cornerRadius={4} />
            <PieChart.Center
              defaultLabel="Used"
              formatValue={(value) => `${value.toFixed(0)} GB`}
            />
            <PieChart.Legend className="px-4" />
          </PieChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** Loading, and the one thing a pie must not invent while it waits: a split. */
function PieLoadingVersion() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('ready'), 1400);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Monthly spend</Frame.Title>
          <Frame.Action>
            <Button size="sm" variant="ghost" onPress={() => setStatus('loading')}>
              Reload
            </Button>
          </Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <PieChart
            data={SPEND}
            size={PIE_SIZE}
            innerRadius={0.62}
            status={status}
            className="pb-4"
          >
            <PieChart.Header className={CHART_HEADER} title="August" />
            <PieChart.Skeleton />
            <PieChart.Slices />
            {status === 'ready' ? (
              <PieChart.Center formatValue={(value) => money(value)} />
            ) : null}
            {status === 'ready' ? <PieChart.Legend className="px-4" /> : null}
          </PieChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* LiveLineChart                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A stand-in for a socket. Readings wander rather than jump, so the line has a
 * shape — a random value per tick is noise, and noise has no direction for the
 * momentum colours to find.
 */
function useLiveFeed(interval = 400, start = 240) {
  const [points, setPoints] = useState<LiveLinePoint[]>([]);
  const last = useRef(start);

  useEffect(() => {
    const tick = setInterval(() => {
      const drift = (Math.random() - 0.48) * 26;
      last.current = Math.max(40, Math.min(460, last.current + drift));
      setPoints((current) => [
        ...current.slice(-400),
        { time: Date.now(), value: Math.round(last.current) },
      ]);
    }, interval);
    return () => clearInterval(tick);
  }, [interval]);

  return points;
}

/** The plain live chart: a window sliding against the clock. */
function LiveLineBasicVersion() {
  const points = useLiveFeed();

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Requests / sec</Frame.Title>
          <Frame.Action>Live</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <LiveLineChart data={points} window={30} className="pb-2">
            <LiveLineChart.Header className={CHART_HEADER} title="Right now" />
            <LiveLineChart.Grid />
            <LiveLineChart.Area />
            <LiveLineChart.Line />
            <LiveLineChart.Tip />
            <LiveLineChart.XAxis />
          </LiveLineChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** Colour taken from the direction of travel rather than from one hue. */
function LiveLineMomentumVersion() {
  const points = useLiveFeed(320, 180);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Momentum</Frame.Title>
          <Frame.Action>Up, down, flat</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <LiveLineChart
            data={points}
            window={24}
            momentumColors={{}}
            className="pb-2"
          >
            <LiveLineChart.Header
              className={CHART_HEADER}
              title="Throughput"
              caption="The colour is the last few readings, not the value"
            />
            <LiveLineChart.Grid />
            <LiveLineChart.YAxis />
            <LiveLineChart.Area />
            <LiveLineChart.Line />
            <LiveLineChart.Tip />
            <LiveLineChart.XAxis />
          </LiveLineChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** Drag back through the window, and hold the window still. */
function LiveLineReadbackVersion() {
  const points = useLiveFeed();
  const [held, setHeld] = useState(false);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Read it back</Frame.Title>
          <Frame.Action>
            <Button size="sm" variant="ghost" onPress={() => setHeld((value) => !value)}>
              {held ? 'Resume' : 'Hold'}
            </Button>
          </Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <LiveLineChart data={points} window={30} paused={held} className="pb-2">
            <LiveLineChart.Header
              className={CHART_HEADER}
              title="Requests / sec"
              caption="Drag across the plot"
            />
            <LiveLineChart.Grid />
            <LiveLineChart.YAxis />
            <LiveLineChart.Area />
            <LiveLineChart.Line />
            <LiveLineChart.Tip />
            <LiveLineChart.Tooltip />
            <LiveLineChart.XAxis />
          </LiveLineChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* PolarAreaChart                                                             */
/* -------------------------------------------------------------------------- */

/** p95 response time by region, in milliseconds. Six readings on one scale. */
const LATENCY: PolarAreaDatum[] = [
  { label: 'Frankfurt', value: 120 },
  { label: 'Dublin', value: 98 },
  { label: 'Virginia', value: 86 },
  { label: 'São Paulo', value: 140 },
  { label: 'Singapore', value: 75 },
  { label: 'Sydney', value: 65 },
];

const POLAR_SIZE = 232;

/** The plain dial: equal angles, the radius carrying the reading. */
function PolarAreaBasicVersion() {
  const [active, setActive] = useState(-1);
  const region = active >= 0 ? LATENCY[active] : null;

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Response times</Frame.Title>
          <Frame.Action>Tap a wedge</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <PolarAreaChart
            data={LATENCY}
            size={POLAR_SIZE}
            className="pb-4"
            activeIndex={active}
            onActiveIndexChange={setActive}
          >
            <PolarAreaChart.Header
              className={CHART_HEADER}
              value={`${region ? region.value : 97} ms`}
              caption={region ? `${region.label}, p95` : 'Median across six regions, p95'}
            />
            <PolarAreaChart.Grid />
            <PolarAreaChart.Wedges cornerRadius={4} />
            <PolarAreaChart.Labels />
            <PolarAreaChart.Legend className="px-4" />
          </PolarAreaChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** The same readings with the area carrying them, which flattens the dial. */
function PolarAreaScaleVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Area, not radius</Frame.Title>
          <Frame.Action>scale=&quot;area&quot;</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <PolarAreaChart data={LATENCY} size={POLAR_SIZE} scale="area" className="pb-4">
            <PolarAreaChart.Header
              className={CHART_HEADER}
              title="Same six readings"
              caption="The ink is proportional to the value, so the rings bunch outwards"
            />
            <PolarAreaChart.Grid rings={5} />
            <PolarAreaChart.Wedges cornerRadius={4} />
            <PolarAreaChart.Labels />
            <PolarAreaChart.Legend className="px-4" />
          </PolarAreaChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** Undivided while it waits, because an invented set of readings is a lie. */
function PolarAreaLoadingVersion() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('ready'), 1500);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Waiting for readings</Frame.Title>
          <Frame.Action>
            <Button size="sm" variant="ghost" onPress={() => setStatus('loading')}>
              Reload
            </Button>
          </Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <PolarAreaChart data={LATENCY} size={POLAR_SIZE} status={status} className="pb-4">
            <PolarAreaChart.Header className={CHART_HEADER} title="Response times" />
            <PolarAreaChart.Grid />
            <PolarAreaChart.Skeleton />
            <PolarAreaChart.Wedges cornerRadius={4} />
            <PolarAreaChart.Labels />
            {status === 'ready' ? <PolarAreaChart.Legend className="px-4" /> : null}
          </PolarAreaChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* FunnelChart                                                                */
/* -------------------------------------------------------------------------- */

/** A week of checkout, from the people who saw a product to the ones who paid. */
/**
 * A week of checkout, from the people who saw a product to the ones who paid.
 *
 * The names are short because a stage gets a column of the card's width and no
 * more: five of them across a phone is about seventy points each, and a name
 * that does not fit under one is a name the reader never gets to read.
 */
const CHECKOUT: FunnelDatum[] = [
  { label: 'Viewed', value: 41800 },
  { label: 'Basket', value: 18240 },
  { label: 'Checkout', value: 9420 },
  { label: 'Payment', value: 6180 },
  { label: 'Paid', value: 5240 },
];

/** A hiring pipeline, which drops far harder and is the case for a floor. */
const PIPELINE: FunnelDatum[] = [
  { label: 'Applied', value: 1240 },
  { label: 'Screened', value: 420 },
  { label: 'Phone', value: 96 },
  { label: 'Offer', value: 18 },
  { label: 'Hired', value: 11 },
];

/** A signup run of four steps, for the chart drawn without its labels. */
const SIGNUP: FunnelDatum[] = [
  { label: 'Visited', value: 24600 },
  { label: 'Signed up', value: 8400 },
  { label: 'Activated', value: 3900 },
  { label: 'Paid', value: 1120 },
];

/** Funnel stages are counts of people, and a count reads with its separators. */
const people = (value: number) => value.toLocaleString();

/** The plain funnel: five steps, each labelled with what it converted at. */
function FunnelBasicVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Checkout</Frame.Title>
          <Frame.Action>Last 7 days</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <FunnelChart data={CHECKOUT} className="px-2 pb-4">
            <FunnelChart.Header
              className={CHART_HEADER}
              title="Product viewed"
              value={people(CHECKOUT[0]!.value)}
              caption="13% of them placed an order"
            />
            <FunnelChart.Stages />
            <FunnelChart.Labels />
          </FunnelChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/**
 * The same run read the other way: every stage against the step above it
 * rather than against the top of the funnel.
 *
 * Both readings are true and they answer different questions. "Ninety percent
 * of the people who entered a card placed the order" is about that one step;
 * "thirteen percent of everyone who looked bought something" is about the
 * whole thing. Selecting a stage puts both in the header.
 */
function FunnelConversionVersion() {
  const [active, setActive] = useState(-1);
  const stage = active >= 0 ? CHECKOUT[active] : null;
  const previous = active > 0 ? CHECKOUT[active - 1] : null;
  const share = stage ? stage.value / CHECKOUT[0]!.value : 1;

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Where they go</Frame.Title>
          <Frame.Action>Tap a stage</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <FunnelChart
            data={CHECKOUT}
            className="px-2 pb-4"
            gap={6}
            activeIndex={active}
            onActiveIndexChange={setActive}
          >
            <FunnelChart.Header
              className={CHART_HEADER}
              title={stage ? stage.label : 'Everyone who looked'}
              value={people(stage ? stage.value : CHECKOUT[0]!.value)}
              caption={
                previous && stage
                  ? `${Math.round((stage.value / previous.value) * 100)}% of ${previous.label.toLowerCase()} · ${Math.round(share * 100)}% of all`
                  : 'Five steps, 13% of the way through'
              }
            />
            <FunnelChart.Stages />
            <FunnelChart.Labels share="previous" />
          </FunnelChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/**
 * A pipeline that ends at eleven out of twelve hundred, which is what the floor
 * under the narrow stages is for: at true height the last two are hairlines,
 * and a hairline reads as nothing happening rather than as something rare.
 *
 * Drawn flat, with straight sides and a single ring. A drop this hard is the
 * whole point of the chart, and the curve softens exactly the corner worth
 * seeing.
 */
function FunnelPipelineVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Hiring</Frame.Title>
          <Frame.Action>This quarter</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <FunnelChart
            data={PIPELINE}
            minWidth={0.16}
            edges="straight"
            layers={1}
            className="px-2 pb-4"
          >
            <FunnelChart.Header
              className={CHART_HEADER}
              title="Applications"
              value={people(PIPELINE[0]!.value)}
              caption="11 hires, from 1,240 applications"
            />
            <FunnelChart.Stages />
            <FunnelChart.Labels />
          </FunnelChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/**
 * More rings, more room, and one stage pulled out of the fade.
 *
 * `layers` is the depth of the halo — at five the edge falls off over most of
 * the band and the ribbon reads as light rather than as a shape. Giving a stage
 * its own `color` takes it out of the run's fade at full strength, which is how
 * you point at the step the report is actually about.
 */
function FunnelGlowVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Checkout</Frame.Title>
          <Frame.Action>The step that pays</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <FunnelChart
            data={CHECKOUT.map((stage) =>
              stage.label === 'Paid' ? { ...stage, color: '#34d399' } : stage
            )}
            layers={5}
            height={230}
            className="px-2 pb-4"
          >
            <FunnelChart.Header
              className={CHART_HEADER}
              title="Order placed"
              value={people(CHECKOUT[4]!.value)}
              caption="The one stage worth its own colour"
            />
            <FunnelChart.Stages />
            <FunnelChart.Labels />
          </FunnelChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/**
 * The compact card: the run is the shape and the reading is underneath it.
 *
 * For a dashboard tile where the funnel is one of six things on the screen and
 * a reading around every stage would be more text than tile.
 */
function FunnelCompactVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Signup</Frame.Title>
        </Frame.Header>
        <Frame.Panel>
          <FunnelChart data={SIGNUP} height={120} gap={3} className="p-4">
            <FunnelChart.Stages />
            <FunnelChart.Legend />
          </FunnelChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** The waiting state: one plain ribbon, with no invented drop-off in it. */
function FunnelLoadingVersion() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('ready'), 1500);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Checkout</Frame.Title>
          <Frame.Action>
            <Button size="sm" variant="ghost" onPress={() => setStatus('loading')}>
              Reload
            </Button>
          </Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <FunnelChart
            data={status === 'loading' ? [] : CHECKOUT}
            status={status}
            className="px-2 pb-4"
          >
            <FunnelChart.Header
              className={CHART_HEADER}
              title="Product viewed"
              value={status === 'loading' ? '—' : people(CHECKOUT[0]!.value)}
            />
            <FunnelChart.Skeleton />
            <FunnelChart.Stages />
            <FunnelChart.Labels />
          </FunnelChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* TreemapChart                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A month of cloud spend, which is the case treemaps are for: eight parts, one
 * of them most of the bill, and the rest worth knowing the order of.
 */
const CLOUD_SPEND: TreemapDatum[] = [
  { label: 'Compute', value: 18400 },
  { label: 'Storage', value: 9250 },
  { label: 'Bandwidth', value: 6100 },
  { label: 'Database', value: 5480 },
  { label: 'Logging', value: 3120 },
  { label: 'Queues', value: 2640 },
  { label: 'Email', value: 1810 },
  { label: 'CDN', value: 1400 },
];

/**
 * Traffic by country: a long tail on purpose, so `maxTiles` has something to
 * gather. Twenty-two rows is past what a phone-width box can label.
 */
const TRAFFIC_BY_COUNTRY: TreemapDatum[] = [
  { label: 'United States', value: 48200 },
  { label: 'Germany', value: 21400 },
  { label: 'India', value: 18900 },
  { label: 'Brazil', value: 12600 },
  { label: 'France', value: 9800 },
  { label: 'Japan', value: 8400 },
  { label: 'Canada', value: 7200 },
  { label: 'Australia', value: 5100 },
  ...[
    'Spain',
    'Italy',
    'Netherlands',
    'Sweden',
    'Poland',
    'Mexico',
    'Norway',
    'Denmark',
    'Portugal',
    'Ireland',
    'Finland',
    'Austria',
    'Belgium',
    'Chile',
  ].map((label, index) => ({ label, value: 4200 - index * 260 })),
];

/** A team's budget, with the one line that has gone over pulled out of the ramp. */
const BUDGET: TreemapDatum[] = [
  { label: 'Salaries', value: 412000 },
  { label: 'Contractors', value: 96000, color: '#ef4444' },
  { label: 'Tooling', value: 58000 },
  { label: 'Travel', value: 31000 },
  { label: 'Training', value: 18500 },
  { label: 'Events', value: 12400 },
];

/**
 * `activeIndex` counts the tiles as they are laid out, which is largest first
 * — so anything reading the selection back has to look it up in that order
 * rather than in the order the rows were written.
 */
const BUDGET_SORTED = [...BUDGET].sort((a, b) => b.value - a.value);

const CLOUD_TOTAL = CLOUD_SPEND.reduce((sum, part) => sum + part.value, 0);

/** The plain case: eight parts of one bill, each labelled with what it cost. */
function TreemapBasicVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Cloud spend</Frame.Title>
          <Frame.Action>March</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <TreemapChart data={CLOUD_SPEND} className="px-3 pb-4">
            <TreemapChart.Header
              className={CHART_HEADER}
              title="Total this month"
              value={money(CLOUD_TOTAL)}
              caption="Compute is 38% of it"
            />
            <TreemapChart.Tiles />
            <TreemapChart.Labels formatValue={money} />
            <TreemapChart.Tooltip formatValue={money} />
          </TreemapChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/**
 * Twenty-two countries, eight of them named. The rest are one tile, so the tail
 * keeps its share of the total without keeping twenty unreadable slivers.
 */
function TreemapLongTailVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Sessions by country</Frame.Title>
          <Frame.Action>Last 30 days</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <TreemapChart
            data={TRAFFIC_BY_COUNTRY}
            maxTiles={9}
            otherLabel="Rest of world"
            className="px-3 pb-4"
          >
            <TreemapChart.Header
              className={CHART_HEADER}
              title="Sessions"
              value="196,320"
            />
            <TreemapChart.Tiles />
            <TreemapChart.Labels showShare />
            <TreemapChart.Tooltip />
            <TreemapChart.Legend className="px-1" limit={6} />
          </TreemapChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/**
 * One tile in its own colour, and the selection driven from outside so the
 * header can read whichever line is picked.
 */
function TreemapSelectionVersion() {
  const [selected, setSelected] = useState(-1);
  const picked = selected >= 0 ? BUDGET_SORTED[selected] : null;
  const total = BUDGET.reduce((sum, part) => sum + part.value, 0);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Budget</Frame.Title>
          <Frame.Action>FY26</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <TreemapChart
            data={BUDGET}
            activeIndex={selected}
            onActiveIndexChange={setSelected}
            className="px-3 pb-4"
          >
            <TreemapChart.Header
              className={CHART_HEADER}
              title={picked ? picked.label : 'Committed'}
              value={money(picked ? picked.value : total)}
              caption={picked ? 'Tap it again to clear' : 'Tap a tile to pick one out'}
            />
            <TreemapChart.Tiles dimOpacity={0.2} />
            <TreemapChart.Labels formatValue={money} />
            <TreemapChart.Legend className="px-1" />
          </TreemapChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** The waiting state: one plain box, with no invented split in it. */
function TreemapLoadingVersion() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('ready'), 1500);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Cloud spend</Frame.Title>
          <Frame.Action>
            <Button size="sm" variant="ghost" onPress={() => setStatus('loading')}>
              Reload
            </Button>
          </Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <TreemapChart
            data={status === 'loading' ? [] : CLOUD_SPEND}
            status={status}
            className="px-3 pb-4"
          >
            <TreemapChart.Header
              className={CHART_HEADER}
              title="Total this month"
              value={status === 'loading' ? '—' : money(CLOUD_TOTAL)}
            />
            <TreemapChart.Skeleton />
            <TreemapChart.Tiles />
            <TreemapChart.Labels formatValue={money} />
          </TreemapChart>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Plot                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Half a year of trading.
 *
 * Revenue and costs are both money, which is what makes them worth drawing on
 * one axis: the gap between the two marks is the margin, and reading it off the
 * chart is the whole reason to combine them. `orders` is here for a caption to
 * quote and is deliberately *not* drawn — a count and a currency share no scale,
 * and a line of hundreds under columns of tens of thousands is a line lying flat
 * on the floor of the plot.
 */
const PLOT_QUARTER = [
  { month: 'Jan', revenue: 18400, costs: 13100, orders: 310 },
  { month: 'Feb', revenue: 21200, costs: 14600, orders: 352 },
  { month: 'Mar', revenue: 19800, costs: 15200, orders: 341 },
  { month: 'Apr', revenue: 26100, costs: 17400, orders: 418 },
  { month: 'May', revenue: 24700, costs: 18100, orders: 402 },
  { month: 'Jun', revenue: 31500, costs: 19300, orders: 486 },
];

const PLOT_TARGET = 28000;

/**
 * The combination: columns and a line over them, on one scale.
 *
 * Nothing in the library ships this as a component of its own, which is the
 * point — it is two marks written one after the other, and the order they are
 * written is the order they are drawn.
 *
 * Costs are the columns and revenue is the line, rather than the other way
 * round, because revenue is the larger of the two every month. Drawn the other
 * way the line runs through the middle of the bars and the chart has to be
 * decoded; drawn this way the line clears them and the gap underneath it is the
 * margin, which is the only reason to put both on one axis.
 */
function PlotCombinationVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Trading</Frame.Title>
          <Frame.Action>First half</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <Plot
            data={PLOT_QUARTER}
            xDataKey="month"
            aspectRatio={1.7}
            className="px-3 pb-3"
          >
            <Plot.Header
              className={CHART_HEADER}
              title="Revenue"
              value={money(PLOT_QUARTER.reduce((sum, row) => sum + row.revenue, 0))}
            />
            <Plot.Legend
              className={CHART_HEADER}
              labels={{ costs: 'Costs', revenue: 'Revenue' }}
            />
            <Plot.Grid />
            <Plot.Bars dataKey="costs" colorIndex={2} />
            <Plot.Line dataKey="revenue" colorIndex={1} />
            <Plot.Dots dataKey="revenue" colorIndex={1} />
            <Plot.YAxis />
            <Plot.XAxis ticks={6} />
          </Plot>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/**
 * A baseline pinned at zero, and a reference line across it.
 *
 * `yDomain={[0, 'auto']}` is the case the fixed pair cannot express: the bottom
 * is held where a length has to start, and the top still follows whatever the
 * data does. `nice` then rounds that top out, so the axis is labelled in
 * numbers the target can be measured against rather than wherever June landed.
 *
 * The rule is dashed rather than faint. It is the number every column here is
 * being judged against, so it has to be readable over them — what keeps it from
 * being mistaken for a series is that it is neutral and broken, not that it is
 * hard to see.
 */
function PlotPinnedVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Against target</Frame.Title>
          <Frame.Action>{money(PLOT_TARGET)}</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <Plot
            data={PLOT_QUARTER}
            xDataKey="month"
            yDomain={[0, 'auto']}
            nice
            aspectRatio={1.7}
            className="px-3 pb-3"
          >
            <Plot.Header className={CHART_HEADER} title="Revenue by month" />
            <Plot.Grid />
            <Plot.Bars dataKey="revenue" colorIndex={2} />
            <Plot.Rule y={PLOT_TARGET} label="Target" dashed />
            <Plot.YAxis format={(value) => money(Math.round(value))} />
            <Plot.XAxis ticks={6} />
          </Plot>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/**
 * A mark the library does not ship, drawn on the chart's own geometry.
 *
 * `Plot.Layer` puts it in the SVG tree and `usePlot` hands it the box and the
 * tweening domain, so it is rebuilt on the UI thread on the frames the built-in
 * marks are — not laid over them a frame late.
 */
function BandBetween({ low, high }: { low: number; high: number }) {
  const { plot, domainMin, domainMax } = usePlot();
  const tint = useCSSVariable('--color-chart-3');

  const animatedProps = useAnimatedProps(() => {
    const min = domainMin.value;
    const max = domainMax.value;
    if (max === min) return { d: '' };
    const top = yOf(high, plot, min, max);
    const bottom = yOf(low, plot, min, max);
    return {
      d: `M${plot.left},${top}H${plot.left + plot.width}V${bottom}H${plot.left}Z`,
    };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill={typeof tint === 'string' ? tint : '#34d399'}
      fillOpacity={0.14}
    />
  );
}

function PlotCustomMarkVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Inside the band</Frame.Title>
          <Frame.Action>A mark of your own</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <Plot
            data={PLOT_QUARTER}
            xDataKey="month"
            aspectRatio={1.7}
            className="px-3 pb-3"
          >
            <Plot.Header
              className={CHART_HEADER}
              title="Revenue"
              caption="Shaded where the month was within the plan"
            />
            <Plot.Grid />
            {/* Written first, so it is drawn under the series. */}
            <Plot.Layer>
              <BandBetween low={20000} high={28000} />
            </Plot.Layer>
            <Plot.Area dataKey="revenue" />
            <Plot.Line dataKey="revenue" />
            <Plot.YAxis />
            <Plot.XAxis ticks={6} />
          </Plot>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** The cursor, and a readout in the card's header rather than over the plot. */
function PlotCursorVersion() {
  const [active, setActive] = useState(-1);
  const row = active >= 0 ? PLOT_QUARTER[active] : null;

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Drag across it</Frame.Title>
          <Frame.Action>{row ? row.month : 'First half'}</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <Plot
            data={PLOT_QUARTER}
            xDataKey="month"
            aspectRatio={1.7}
            className="px-3 pb-3"
            onActiveIndexChange={setActive}
          >
            <Plot.Header
              className={CHART_HEADER}
              title={row ? `${row.orders} orders` : 'Revenue'}
              value={money(row ? row.revenue : PLOT_QUARTER[PLOT_QUARTER.length - 1]!.revenue)}
            />
            <Plot.Grid />
            <Plot.Area dataKey="revenue" />
            <Plot.Line dataKey="revenue" />
            <Plot.Dots dataKey="revenue" />
            <Plot.YAxis />
            <Plot.XAxis ticks={6} />
            <Plot.Cursor />
            <Plot.Tooltip formatValue={(value) => money(value)} />
          </Plot>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

export const ENTRIES: ComponentEntry[] = [
{
    slug: 'scroll-text',
    name: 'ScrollText',
    summary: 'Text that resolves word by word as you scroll',
    demos: [
      {
        label: 'Colour',
        id: 'color',
        fullPage: true,
        description: 'Each word crossfades from muted to foreground as the line passes.',
        render: () => <ScrollTextVersion effect="color" />,
      },
      {
        label: 'Fade',
        id: 'fade',
        fullPage: true,
        description: 'Words come up from nearly transparent, without reflowing the line.',
        render: () => <ScrollTextVersion effect="fade" />,
      },
      {
        label: 'Rise',
        id: 'rise',
        fullPage: true,
        description: 'Words lift into place — a wrapping row, since nested text cannot transform.',
        render: () => <ScrollTextVersion effect="rise" />,
      },
      {
        label: 'Highlight',
        id: 'highlight',
        fullPage: true,
        description: 'A background sweeps behind the line as it resolves.',
        render: () => <ScrollTextVersion effect="highlight" />,
      },
      {
        label: 'Splitting and stagger',
        id: 'splitting',
        fullPage: true,
        description: 'By character, and with a stagger wide enough to arrive all at once.',
        render: () => <ScrollTextCharactersVersion />,
      },
    ],
  },
{
    slug: 'funnel-chart',
    name: 'FunnelChart',
    summary: 'Where a population drained away, one step at a time',
    layout: 'pager',
    demos: [
      {
        label: 'Basic',
        id: 'basic',
        fullPage: true,
        description: 'Five steps of a checkout, each labelled with what it converted at.',
        render: () => <FunnelBasicVersion />,
      },
      {
        label: 'Conversion',
        id: 'conversion',
        fullPage: true,
        description: 'Each step against the one above it, and both readings in the header.',
        render: () => <FunnelConversionVersion />,
      },
      {
        label: 'Pipeline',
        id: 'pipeline',
        fullPage: true,
        description: 'A hard drop-off, drawn flat, with a floor under the stages too small to see.',
        render: () => <FunnelPipelineVersion />,
      },
      {
        label: 'Glow',
        id: 'glow',
        fullPage: true,
        description: 'A deeper halo, and one stage pulled out of the fade into its own colour.',
        render: () => <FunnelGlowVersion />,
      },
      {
        label: 'Compact',
        id: 'compact',
        fullPage: true,
        description: 'The run as a shape, with the reading in a key underneath it.',
        render: () => <FunnelCompactVersion />,
      },
      {
        label: 'Loading',
        id: 'loading',
        fullPage: true,
        description: 'One plain taper while it waits, because an invented drop-off is a lie.',
        render: () => <FunnelLoadingVersion />,
      },
    ],
  },
{
    slug: 'treemap-chart',
    name: 'TreemapChart',
    summary: 'A total, cut into the parts it is made of, sized by area',
    layout: 'pager',
    demos: [
      {
        label: 'Basic',
        id: 'basic',
        fullPage: true,
        description: 'Eight parts of one bill, each labelled with what it cost.',
        render: () => <TreemapBasicVersion />,
      },
      {
        label: 'Long tail',
        id: 'long-tail',
        fullPage: true,
        description: 'Twenty-two countries, eight named and the rest gathered into one tile.',
        render: () => <TreemapLongTailVersion />,
      },
      {
        label: 'Selection',
        id: 'selection',
        fullPage: true,
        description: 'One line in its own colour, and the header reading whichever tile is picked.',
        render: () => <TreemapSelectionVersion />,
      },
      {
        label: 'Loading',
        id: 'loading',
        fullPage: true,
        description: 'One plain box while it waits, because an invented split is a lie.',
        render: () => <TreemapLoadingVersion />,
      },
    ],
  },
{
    slug: 'plot',
    name: 'Plot',
    summary: 'A chart you assemble out of its marks',
    layout: 'pager',
    demos: [
      {
        label: 'Combination',
        id: 'combination',
        fullPage: true,
        description: 'Columns and a line over them, on one shared scale.',
        render: () => <PlotCombinationVersion />,
      },
      {
        label: 'A pinned baseline',
        id: 'pinned',
        fullPage: true,
        description: 'Zero held at the bottom, the top left to follow the data, and a target across it.',
        render: () => <PlotPinnedVersion />,
      },
      {
        label: 'A mark of your own',
        id: 'custom-mark',
        fullPage: true,
        description: 'A shaded band nothing here ships, drawn on the chart’s own geometry.',
        render: () => <PlotCustomMarkVersion />,
      },
      {
        label: 'Cursor and readout',
        id: 'cursor',
        fullPage: true,
        description: 'A drag resolves the row under the finger; the card’s header reads it.',
        render: () => <PlotCursorVersion />,
      },
    ],
  },
{
    slug: 'pie-chart',
    name: 'PieChart',
    summary: 'One whole, divided between its parts',
    layout: 'pager',
    demos: [
      {
        label: 'Basic',
        id: 'basic',
        fullPage: true,
        description: 'Five parts of one obvious total, with a key beside them.',
        render: () => <PieBasicVersion />,
      },
      {
        label: 'Donut',
        id: 'donut',
        fullPage: true,
        description: 'The hole is where the total goes — the one figure a pie can be read for.',
        render: () => <PieDonutVersion />,
      },
      {
        label: 'Segments',
        id: 'segments',
        fullPage: true,
        description: 'Padded and rounded, with a floor under the slices too small to see.',
        render: () => <PieSegmentsVersion />,
      },
      {
        label: 'Dial',
        id: 'dial',
        fullPage: true,
        description: 'Three quarters of a turn rather than all of it, notch at the bottom.',
        render: () => <PieDialVersion />,
      },
      {
        label: 'Loading',
        id: 'loading',
        fullPage: true,
        description: 'One undivided band while it waits, because an invented split is a lie.',
        render: () => <PieLoadingVersion />,
      },
    ],
  },
{
    slug: 'live-line-chart',
    name: 'LiveLineChart',
    summary: 'A reading that keeps arriving, against a window that keeps moving',
    layout: 'pager',
    demos: [
      {
        label: 'Live',
        id: 'live',
        fullPage: true,
        description: 'A window sliding against the clock, with the tip riding the newest reading.',
        render: () => <LiveLineBasicVersion />,
      },
      {
        label: 'Momentum',
        id: 'momentum',
        fullPage: true,
        description: 'Colour taken from the direction of travel rather than from one fixed hue.',
        render: () => <LiveLineMomentumVersion />,
      },
      {
        label: 'Read back',
        id: 'read-back',
        fullPage: true,
        description: 'Drag back through the window, and hold the window still to talk about it.',
        render: () => <LiveLineReadbackVersion />,
      },
    ],
  },
{
    slug: 'polar-area-chart',
    name: 'PolarAreaChart',
    summary: 'Several readings on one scale, compared as wedges',
    layout: 'pager',
    demos: [
      {
        label: 'Basic',
        id: 'basic',
        fullPage: true,
        description: 'Equal angles, and the radius carrying the reading.',
        render: () => <PolarAreaBasicVersion />,
      },
      {
        label: 'Area scale',
        id: 'area',
        fullPage: true,
        description: 'The ink proportional to the value, which flattens the dial.',
        render: () => <PolarAreaScaleVersion />,
      },
      {
        label: 'Loading',
        id: 'loading',
        fullPage: true,
        description: 'One plain disc while it waits, because invented readings are a lie.',
        render: () => <PolarAreaLoadingVersion />,
      },
    ],
  },
{
    slug: 'ring-chart',
    name: 'RingChart',
    summary: 'Concentric arcs, each against its own target',
    // One chart per version, none of them bringing a scroller of its own, so
    // the versions can be the pages and the rail can index them.
    layout: 'pager',
    demos: [
      {
        label: "Today's goals",
        id: 'goals',
        fullPage: true,
        description: 'Three targets, each read against its own rather than each other.',
        render: () => <RingChartGoalsVersion />,
      },
      {
        label: 'Gauge',
        id: 'gauge',
        fullPage: true,
        description: 'The ring opened to three quarters of a turn, notch at the bottom.',
        render: () => <RingChartGaugeVersion />,
      },
      {
        label: 'Segmented',
        id: 'segmented',
        fullPage: true,
        description: 'Ticks rather than an arc, for a target made of countable things.',
        render: () => <RingChartSegmentedVersion />,
      },
      {
        label: 'Separate dials',
        id: 'tiles',
        fullPage: true,
        description: 'Three charts rather than three rings, when nothing is read against anything.',
        render: () => <RingChartTilesVersion />,
      },
    ],
  }
];
export const ENTRIES_BY_SLUG = Object.fromEntries(ENTRIES.map((entry) => [entry.slug, entry]));
