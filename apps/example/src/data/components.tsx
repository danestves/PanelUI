/**
 * The component catalogue — the single source of truth for the showcase.
 *
 * Both the list screen and the detail screen read from here, and the home
 * screen derives its counts from it, so adding a component means adding one
 * entry and nothing else.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeOutDown,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import { DollarSign, Target } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Accordion,
  Alert,
  AppleIcon,
  Attachment,
  Avatar,
  AreaChart,
  Badge,
  BookmarkIcon,
  BarChart,
  BellIcon,
  BottomSheet,
  Breadcrumb,
  Button,
  Calendar,
  CalendarIcon,
  CodeBlock,
  Combobox,
  Card,
  Carousel,
  CardIcon,
  CheckIcon,
  Checkbox,
  ChevronLeftIcon,
  ChevronRightIcon,
  Chip,
  ColorPicker,
  DatePicker,
  DateTimePicker,
  type DateRange,
  Dialog,
  Direction,
  type DirectionValue,
  DownloadIcon,
  Drawer,
  EllipsisIcon,
  EyeIcon,
  EmptyState,
  FacebookIcon,
  Field,
  FileIcon,
  Flow,
  type FlowConnection,
  FolderIcon,
  FolderOpenIcon,
  Form,
  Frame,
  GoogleIcon,
  GridItem,
  HeartIcon,
  HeatmapChart,
  type HeatmapCell,
  type HeatmapColumn,
  buildHeatmapCalendar,
  InfoIcon,
  Input,
  InputGroup,
  ImageIcon,
  Item,
  KeyboardAvoider,
  Kpi,
  Label,
  ListChecksIcon,
  LockIcon,
  LineChart,
  type LineChartHandle,
  Loader,
  type LoaderVariant,
  Marker,
  MaximizeIcon,
  Menu,
  Message,
  MessageCircleIcon,
  MessageScroller,
  Plan,
  Reasoning,
  Response,
  MicIcon,
  MoonIcon,
  NumberInput,
  OtpInput,
  PackageIcon,
  Pagination,
  PauseIcon,
  PencilIcon,
  PieChart,
  type PieDatum,
  PlayIcon,
  PlusSquareIcon,
  Popover,
  Post,
  type PostVote,
  Portal,
  Progress,
  Questionnaire,
  type QuestionnaireAnswers,
  RadarChart,
  type RadarChartDatum,
  RadioGroup,
  Rating,
  RingChart,
  type RingDatum,
  ReceiptIcon,
  RepeatIcon,
  ScatterChart,
  Scrim,
  SearchIcon,
  SendIcon,
  ShareNodesIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Select,
  ScrollCanvas,
  ScrollFade,
  ScrollProgress,
  ScrollText,
  SectionRail,
  Separator,
  Shimmer,
  Sources,
  Signature,
  type SignatureHandle,
  Skeleton,
  Slider,
  Soundwave,
  Spinner,
  Steps,
  SunIcon,
  Surface,
  Swipe,
  Switch,
  Table,
  Tabs,
  Task,
  Text,
  TextAnimation,
  Textarea,
  ThinkingOrb,
  XIcon,
  TimePicker,
  type TimeValue,
  formatTime,
  Timeline,
  Toast,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  TrashIcon,
  Tree,
  Typography,
  hasNativeUI,
  useDirection,
  useForm,
  useScrollSections,
  useThemeMode,
  useToast,
} from 'panelui-native';
import { useCSSVariable } from 'uniwind';
import {
  formatClock,
  useVoiceRecorder,
  VoiceControls,
} from '../components/voice';
import {
  ChoroplethBlock,
  DeliveryTrackerBlock,
  HeatmapBlock,
  LogisticsNetworkBlock,
  PlacesBlock,
  StoreLocatorBlock,
  UptimeMonitorBlock,
} from '../components/map-blocks';
import {
  PanelsideAssistantBlock,
  PanelsideChatBlock,
  PanelsideCurveBlock,
  PanelsideDockedBlock,
  PanelsideNativeBlock,
  PanelsideNavigateBlock,
  PanelsideOverlayBlock,
} from '../components/panelside-blocks';

const PHOTO = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=60';

/** Stable remote portraits for the Avatar demos. */
const AVATARS = [
  'https://i.pravatar.cc/150?img=12',
  'https://i.pravatar.cc/150?img=32',
  'https://i.pravatar.cc/150?img=47',
];

/** Photographs for the Post demos, wide enough to crop to 16:10 without blur. */
const POST_PHOTOS = {
  savings: 'https://images.unsplash.com/photo-1579621970588-a35d0e7ab9b6?w=900&q=60',
  workshop: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900&q=60',
  coast: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=60',
};

export interface Demo {
  /** Label shown in the variant picker. */
  label: string;
  render: () => ReactNode;
  /**
   * Render on a screen of its own instead of inline, reached through a row on
   * the component's page. For anything whose behaviour only shows at full
   * height — a transcript, a scroller, an editor. Requires `id`.
   */
  fullPage?: boolean;
  /** URL segment for a `fullPage` demo: `/components/<slug>/<id>`. */
  id?: string;
  /** One line under the label on the row that opens a `fullPage` demo. */
  description?: string;
  /**
   * Drop the screen's header and description too, so the demo owns every
   * pixel. For the ones whose whole point is what they do with a *whole
   * screen* — a glow behind everything reads as a lit room at full bleed and
   * as a coloured box under a title bar. A demo that asks for this has to draw
   * its own way back.
   */
  fullBleed?: boolean;
}

/**
 * How a component's detail screen lays its demos out.
 *
 * `pager` is the default: each demo gets the screen, swiped vertically, with a
 * rail in the corner standing in for the scrollbar and naming what is where.
 *
 * `sections` stacks them down one scroll behind hairlines instead. It is worth
 * asking for when a demo brings its own vertical scroller — two of those
 * nested fight over the same drag — or when one is tall enough that a fixed
 * page would clip it.
 */
export type ComponentLayout = 'sections' | 'pager';

export interface ComponentEntry {
  slug: string;
  name: string;
  /** One-line summary, shown under the name in the list. */
  summary: string;
  /** Defaults to `pager`, and falls back to `sections` when there is one demo. */
  layout?: ComponentLayout;
  demos: Demo[];
}

/* -------------------------------------------------------------------------- */
/* Stateful demo wrappers                                                     */
/* -------------------------------------------------------------------------- */

function SwitchDemo() {
  const [enabled, setEnabled] = useState(true);
  const [push, setPush] = useState(false);

  return (
    <Card className="w-full">
      <Card.Content className="gap-5 p-4">
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1">
            <Text weight="medium">Email notifications</Text>
            <Text size="sm" muted>
              Receive updates and newsletters
            </Text>
          </View>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1">
            <Text weight="medium">Push notifications</Text>
            <Text size="sm" muted>
              Get instant alerts on your device
            </Text>
          </View>
          <Switch value={push} onValueChange={setPush} />
        </View>
      </Card.Content>
    </Card>
  );
}

function NumberInputDemo() {
  const [qty, setQty] = useState(1);

  return (
    <Card className="w-full">
      <Card.Content className="gap-4 p-4">
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1">
            <Text weight="medium">Wireless keyboard</Text>
            <Text size="sm" muted>
              {qty} × $49 = ${qty * 49}
            </Text>
          </View>
          <View className="w-32">
            <NumberInput value={qty} onValueChange={setQty} min={1} max={20} />
          </View>
        </View>
        <NumberInput
          label="Budget"
          defaultValue={40}
          min={0}
          max={1000}
          step={10}
          formatValue={(v) => `$${v}`}
        />
      </Card.Content>
    </Card>
  );
}

function HapticSwitchDemo() {
  const [wifi, setWifi] = useState(true);
  const [bluetooth, setBluetooth] = useState(false);

  return (
    <Card className="w-full">
      <Card.Content className="gap-5 p-4">
        <Text size="sm" muted>
          Each flip fires a light tick — install expo-haptics to feel it on a device.
        </Text>
        <View className="flex-row items-center justify-between gap-4">
          <Text weight="medium">Wi-Fi</Text>
          <Switch haptics value={wifi} onValueChange={setWifi} />
        </View>
        <View className="flex-row items-center justify-between gap-4">
          <Text weight="medium">Bluetooth</Text>
          <Switch haptics value={bluetooth} onValueChange={setBluetooth} />
        </View>
      </Card.Content>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* LineChart                                                                  */
/* -------------------------------------------------------------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Monthly revenue, a rising series with some wobble. */
const REVENUE = MONTHS.map((month, index) => ({
  month,
  revenue: [4200, 5800, 4900, 7100, 6100, 8300, 7800, 9500, 8900, 10400, 9900, 11600][index]!,
  target: [4400, 5100, 5800, 6500, 7200, 7900, 8300, 8800, 9200, 9700, 10100, 10600][index]!,
}));

/** Four traffic sources, orders of magnitude apart, sharing one axis. */
const TRAFFIC = MONTHS.map((month, index) => ({
  month,
  organic: [2100, 3400, 5200, 6100, 7300, 9800, 8900, 12400, 11800, 14200, 15600, 15100][index]!,
  paid: [1200, 2400, 3100, 4200, 4800, 5600, 6100, 7200, 7800, 8900, 9600, 9500][index]!,
  referral: [800, 1400, 1900, 2600, 3100, 3400, 3900, 4200, 4600, 4900, 5100, 5100][index]!,
  social: [600, 1100, 1500, 2100, 2400, 2600, 2900, 3200, 3400, 3700, 3900, 3800][index]!,
}));

/** Two sources for the basic linear example. */
const SESSIONS = MONTHS.map((month, index) => ({
  month,
  organic: [2000, 15000, 8000, 14000, 8000, 18000, 18000, 20000, 17000, 21000, 18000, 15000][index]!,
  paid: [1000, 10000, 8000, 15000, 8000, 12000, 11500, 5000, 15000, 10000, 18000, 9000][index]!,
}));

const RANGES: Record<string, { balance: number; delta: number; data: { t: string; v: number }[] }> = {
  '1D': { balance: 24801, delta: 1.2, data: spark([120, 118, 124, 121, 128, 126, 132, 130, 138]) },
  '1W': { balance: 24801, delta: 3.4, data: spark([90, 95, 92, 101, 108, 104, 118, 124, 132]) },
  '1M': { balance: 24801, delta: 5.32, data: spark([60, 66, 62, 78, 84, 80, 96, 104, 138]) },
  '1Y': { balance: 24801, delta: 42.8, data: spark([20, 34, 41, 55, 61, 78, 92, 110, 138]) },
};

function spark(values: number[]): { t: string; v: number }[] {
  return values.map((v, index) => ({ t: String(index), v }));
}

/** Centers a version's chart card in the screen, matching the reference shots. */
function ChartScreen({ children }: { children: ReactNode }) {
  return <View className="flex-1 justify-center px-4">{children}</View>;
}

/* -------------------------------------------------------------------------- */
/* ScatterChart                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Ad spend against the revenue it brought back, one row per campaign. Loosely
 * correlated with a couple of genuine outliers, because a scatter plot drawn
 * over a perfect line demonstrates nothing a line chart would not have shown.
 */
const CAMPAIGNS = [
  { name: 'Spring launch', spend: 4200, revenue: 11800, reach: 32000 },
  { name: 'Retargeting', spend: 1800, revenue: 7400, reach: 12000 },
  { name: 'Brand video', spend: 12400, revenue: 18200, reach: 148000 },
  { name: 'Search — brand', spend: 2600, revenue: 12900, reach: 9800 },
  { name: 'Search — generic', spend: 8900, revenue: 14100, reach: 61000 },
  { name: 'Podcast reads', spend: 6400, revenue: 6100, reach: 44000 },
  { name: 'Newsletter', spend: 900, revenue: 5200, reach: 6400 },
  { name: 'Display', spend: 7200, revenue: 4900, reach: 210000 },
  { name: 'Affiliate', spend: 3100, revenue: 9600, reach: 18000 },
  { name: 'Trade show', spend: 14800, revenue: 9200, reach: 3200 },
  { name: 'Social — paid', spend: 5600, revenue: 13400, reach: 88000 },
  { name: 'Social — organic', spend: 400, revenue: 3800, reach: 24000 },
  { name: 'Partner bundle', spend: 9600, revenue: 21400, reach: 37000 },
  { name: 'Referral bonus', spend: 2200, revenue: 8800, reach: 5600 },
  { name: 'Webinar', spend: 3800, revenue: 7900, reach: 4100 },
  { name: 'Print', spend: 6800, revenue: 2400, reach: 52000 },
];

/** A dose–response pair, for the two-series version. */
const TRIALS = Array.from({ length: 18 }, (_unused, index) => {
  const dose = 5 + index * 5;
  return {
    dose,
    control: 40 + ((index * 37) % 11) - 5,
    treated: 38 + dose * 0.42 + ((index * 53) % 13) - 6,
  };
});

/* --- Versions ------------------------------------------------------------- */

function ChartBasicVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Traffic Source</Frame.Title>
          <Frame.Action>Last 12 months</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <ChartStat value="292,000" caption="Sessions">
            <LegendDot colorIndex={1} label="Organic" />
            <LegendDot colorIndex={2} label="Paid Ads" />
          </ChartStat>
          <LineChart data={SESSIONS} xDataKey="month" curve="linear" aspectRatio={1.7}>
            <LineChart.Grid />
            <LineChart.Line dataKey="organic" colorIndex={1} />
            <LineChart.Line dataKey="paid" colorIndex={2} />
            <LineChart.XAxis ticks={5} />
            <LineChart.Tooltip
              formatValue={(v) => v.toLocaleString()}
              formatX={(d) => String(d.month)}
            />
          </LineChart>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function ChartBothAxesVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Monthly Revenue</Frame.Title>
          <Frame.Action>Both axes</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <LineChart data={REVENUE} xDataKey="month" aspectRatio={1.7}>
            {/* The grid's rows and the axis' ticks match, so every number
                names a line that is actually drawn. */}
            <LineChart.Grid rows={4} />
            <LineChart.Area dataKey="revenue" />
            <LineChart.Line dataKey="revenue" />
            <LineChart.XAxis ticks={5} />
            <LineChart.YAxis ticks={4} format={(v) => `$${Math.round(v / 1000)}k`} />
            <LineChart.Tooltip formatValue={(v) => `$${(v / 1000).toFixed(1)}k`} />
          </LineChart>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function ChartDotsVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Monthly Revenue</Frame.Title>
        </Frame.Header>
        <Frame.Panel>
          <LineChart data={REVENUE} xDataKey="month" aspectRatio={1.7}>
            <LineChart.Grid />
            <LineChart.Line dataKey="revenue" showMarkers />
            <LineChart.XAxis ticks={5} />
            <LineChart.Tooltip formatValue={(v) => `$${(v / 1000).toFixed(1)}k`} />
          </LineChart>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function ChartCrosshairVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Monthly Revenue</Frame.Title>
          <Frame.Action>Drag to inspect</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <ChartStat value="$317,904" caption="Last 12 months" />
          <LineChart data={REVENUE} xDataKey="month" aspectRatio={1.7}>
            <LineChart.Grid />
            <LineChart.Area dataKey="revenue" />
            <LineChart.Line dataKey="revenue" />
            <LineChart.XAxis ticks={5} />
            <LineChart.Tooltip formatValue={(v) => `$${v.toLocaleString()}`} />
          </LineChart>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function ChartAnimatedVersion() {
  const chart = useRef<LineChartHandle>(null);

  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Monthly Revenue</Frame.Title>
          <Frame.Action>
            <Button variant="ghost" size="sm" onPress={() => chart.current?.replay()}>
              Replay
            </Button>
          </Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <LineChart ref={chart} data={REVENUE} xDataKey="month" aspectRatio={1.7}>
            <LineChart.Grid />
            <LineChart.Area dataKey="revenue" />
            <LineChart.Line dataKey="revenue" />
            <LineChart.XAxis ticks={5} />
            <LineChart.Tooltip formatValue={(v) => `$${v.toLocaleString()}`} />
          </LineChart>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function ChartFinanceVersion() {
  const [range, setRange] = useState('1M');
  const current = RANGES[range]!;
  const up = current.delta >= 0;

  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Total balance</Frame.Title>
          <Frame.Action>{range}</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          {/* The delta rides beside the number rather than under it — three
              stacked lines is what made this header a wall of text. */}
          <ChartStat value={`$${current.balance.toLocaleString()}.32`}>
            <Text size="sm" className={up ? 'text-success' : 'text-destructive'}>
              {up ? '+' : ''}
              {current.delta}% this {range === '1D' ? 'day' : range === '1W' ? 'week' : 'period'}
            </Text>
          </ChartStat>
          <View className="gap-3 px-3 pb-3">
            <LineChart data={current.data} xDataKey="t" aspectRatio={1.9}>
              <LineChart.Grid rows={3} dashArray="" opacity={0.4} />
              <LineChart.Area dataKey="v" />
              <LineChart.Line dataKey="v" />
            </LineChart>
            <Tabs value={range} defaultValue={range} onValueChange={setRange}>
              <Tabs.List>
                {Object.keys(RANGES).map((key) => (
                  <Tabs.Trigger key={key} value={key}>
                    {key}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
          </View>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function ChartDashedVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Actual vs Target</Frame.Title>
          <Frame.Action>2026</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <ChartLegendRow>
            <LegendDot colorIndex={1} label="Actual" />
            <View className="flex-row items-center gap-1.5">
              <View className="h-0.5 w-4 rounded-full bg-muted-foreground" />
              <Text size="xs" muted>
                Target
              </Text>
            </View>
          </ChartLegendRow>
          <LineChart data={REVENUE} xDataKey="month" aspectRatio={1.7}>
            <LineChart.Grid />
            <LineChart.Line dataKey="revenue" colorIndex={1} />
            <LineChart.Line dataKey="target" colorIndex={2} dashArray="6,5" />
            <LineChart.XAxis ticks={5} />
            <LineChart.Tooltip formatValue={(v) => `$${(v / 1000).toFixed(1)}k`} />
          </LineChart>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function ChartMultiVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Traffic Sources</Frame.Title>
          <Frame.Action>Last 12 months</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          {/* Four keys wrap onto two rows on a narrow phone. In the header
              strip that pushed the chart down the card; in the panel it is
              simply part of the content. */}
          <ChartLegendRow>
            <LegendDot colorIndex={1} label="Organic" />
            <LegendDot colorIndex={2} label="Paid Ads" />
            <LegendDot colorIndex={3} label="Referral" />
            <LegendDot colorIndex={4} label="Social" />
          </ChartLegendRow>
          <LineChart data={TRAFFIC} xDataKey="month" aspectRatio={1.7}>
            <LineChart.Grid />
            <LineChart.Line dataKey="organic" colorIndex={1} />
            <LineChart.Line dataKey="paid" colorIndex={2} />
            <LineChart.Line dataKey="referral" colorIndex={3} />
            <LineChart.Line dataKey="social" colorIndex={4} />
            <LineChart.XAxis ticks={5} />
            <LineChart.Tooltip formatValue={(v) => `${(v / 1000).toFixed(1)}k`} />
          </LineChart>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

/** Padding a KPI row takes inside a Frame.Panel, matching Frame.Row. */
const KPI_ROW = 'px-4 py-3.5';

const RADAR_PROFILE = [
  { axis: 'Speed', you: 82, team: 64 },
  { axis: 'Accuracy', you: 71, team: 78 },
  { axis: 'Coverage', you: 55, team: 83 },
  { axis: 'Uptime', you: 94, team: 91 },
  { axis: 'Cost', you: 48, team: 62 },
  { axis: 'Support', you: 77, team: 58 },
];

const RADAR_SKILLS = [
  { axis: 'Design', score: 88 },
  { axis: 'Frontend', score: 94 },
  { axis: 'Backend', score: 62 },
  { axis: 'Infra', score: 45 },
  { axis: 'Testing', score: 71 },
];

/** One profile per quarter, on the same axes and the same scale. */
const RADAR_QUARTERS = {
  q1: [
    { axis: 'Speed', score: 54 },
    { axis: 'Accuracy', score: 61 },
    { axis: 'Coverage', score: 38 },
    { axis: 'Uptime', score: 72 },
    { axis: 'Cost', score: 44 },
    { axis: 'Support', score: 50 },
  ],
  q2: [
    { axis: 'Speed', score: 68 },
    { axis: 'Accuracy', score: 66 },
    { axis: 'Coverage', score: 57 },
    { axis: 'Uptime', score: 85 },
    { axis: 'Cost', score: 51 },
    { axis: 'Support', score: 63 },
  ],
  q3: [
    { axis: 'Speed', score: 82 },
    { axis: 'Accuracy', score: 71 },
    { axis: 'Coverage', score: 88 },
    { axis: 'Uptime', score: 94 },
    { axis: 'Cost', score: 48 },
    { axis: 'Support', score: 77 },
  ],
} satisfies Record<string, RadarChartDatum[]>;

const RADAR_PERIODS = [
  { value: 'q1', label: 'Q1' },
  { value: 'q2', label: 'Q2' },
  { value: 'q3', label: 'Q3' },
] as const;

function RadarSwitchVersion() {
  const [period, setPeriod] = useState<string>('q3');
  const data = RADAR_QUARTERS[period as keyof typeof RADAR_QUARTERS] ?? RADAR_QUARTERS.q3;
  const best = [...data].sort((a, b) => b.score - a.score)[0];

  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Service profile</Frame.Title>
          <Frame.Action>{best.axis} leads</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <View className="items-center px-4 pb-2 pt-2">
            {/* Changing the tab changes the data, and the outline travels to
                the new one a vertex at a time. That movement is the point: it
                is what says which axes moved and by how much, which a shape
                that simply appeared would not. The scale is fixed so the two
                profiles stay comparable. */}
            <RadarChart data={data} domain={[0, 100]}>
              <RadarChart.Grid />
              <RadarChart.Axis />
              <RadarChart.Series dataKey="score" colorIndex={1} showDots />
            </RadarChart>
          </View>
          <Frame.Section className="px-4 py-3">
            <Tabs value={period} onValueChange={setPeriod} defaultValue="q3">
              <Tabs.List>
                {RADAR_PERIODS.map((entry) => (
                  <Tabs.Trigger key={entry.value} value={entry.value}>
                    {entry.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
          </Frame.Section>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function RadarSingleVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Skills</Frame.Title>
          <Frame.Action>Self-assessed</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <View className="px-4 pb-4 pt-2">
            {/* One profile, filled. The scale is fixed at 0–100 rather than
                derived, because a shape only means anything against a known
                maximum. */}
            <RadarChart data={RADAR_SKILLS} domain={[0, 100]}>
              <RadarChart.Grid />
              <RadarChart.Axis />
              <RadarChart.Series dataKey="score" colorIndex={1} showDots />
            </RadarChart>
          </View>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function RadarComparisonVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>You vs the team</Frame.Title>
          <Frame.Action>This quarter</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <View className="px-4 pb-4 pt-2">
            {/* Two profiles over each other. Only the first is filled — two
                translucent fills make a third colour that means nothing. */}
            <RadarChart data={RADAR_PROFILE} domain={[0, 100]}>
              <RadarChart.Grid />
              <RadarChart.Axis />
              <RadarChart.Series dataKey="you" colorIndex={1} />
              <RadarChart.Series dataKey="team" colorIndex={2} fillOpacity={0} />
              <RadarChart.Legend />
            </RadarChart>
          </View>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function RadarOutlineVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Coverage</Frame.Title>
          <Frame.Action>Circular rings</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <View className="px-4 pb-4 pt-2">
            {/* Circular rings and no fill — for reading a value off a spoke
                rather than comparing two outlines. */}
            <RadarChart data={RADAR_PROFILE} domain={[0, 100]}>
              <RadarChart.Header title="Weakest axis" value="Cost" caption="48 of 100" />
              <RadarChart.Grid circular rings={5} />
              <RadarChart.Axis fontSize={10} />
              <RadarChart.Series
                dataKey="you"
                colorIndex={3}
                fillOpacity={0}
                strokeWidth={2.5}
                showDots
              />
            </RadarChart>
          </View>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function KpiDefaultVersion() {
  return (
    <ChartScreen>
      {/* Label, number and change on the left; a fixed sparkline column on
          the right, so the shapes line up down the edge of the stack whatever
          length the labels are. In a frame, with the rows divided by
          hairlines — three readings of one thing, not three loose cards. */}
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Overview</Frame.Title>
          <Frame.Action>Last 30 days</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <Frame.Section className={KPI_ROW}>
            <Kpi surface={false} colorIndex={1}>
              <Kpi.Content layout="inline">
                <Kpi.Stat>
                  <Kpi.Title>Total Revenue</Kpi.Title>
                  <Kpi.Value>$317,904</Kpi.Value>
                  <Kpi.Trend value={7.8} caption="last 30d" />
                </Kpi.Stat>
                <Kpi.Chart
                  data={spark([36, 39, 47, 44, 55, 63, 61, 76, 88])}
                  dataKey="v"
                  inline
                />
              </Kpi.Content>
            </Kpi>
          </Frame.Section>

          {/* A fall in bounce rate is the good news, so the change is green
              even though the number is negative. */}
          <Frame.Section className={KPI_ROW}>
            <Kpi surface={false} colorIndex={3} goodDirection="down">
              <Kpi.Content layout="inline">
                <Kpi.Stat>
                  <Kpi.Title>Bounce Rate</Kpi.Title>
                  <Kpi.Value>37.6%</Kpi.Value>
                  <Kpi.Trend value={-8.4} caption="vs last 7d" />
                </Kpi.Stat>
                <Kpi.Chart
                  data={spark([88, 85, 73, 76, 64, 59, 61, 48, 39])}
                  dataKey="v"
                  inline
                />
              </Kpi.Content>
            </Kpi>
          </Frame.Section>

          <Frame.Section className={KPI_ROW}>
            <Kpi surface={false} colorIndex={2}>
              <Kpi.Content layout="inline">
                <Kpi.Stat>
                  <Kpi.Title>New Customers</Kpi.Title>
                  <Kpi.Value>2,867</Kpi.Value>
                  <Kpi.Trend value={4.2} caption="this week" />
                </Kpi.Stat>
                <Kpi.Chart
                  data={spark([27, 35, 33, 46, 59, 55, 64, 79, 91])}
                  dataKey="v"
                  inline
                />
              </Kpi.Content>
            </Kpi>
          </Frame.Section>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function KpiSparklineVersion() {
  return (
    <ChartScreen>
      <View className="w-full gap-3">
        <Kpi colorIndex={1}>
          <Kpi.Header>
            <Kpi.Title>Total revenue</Kpi.Title>
          </Kpi.Header>
          <Kpi.Content>
            <Kpi.Value>$317,904</Kpi.Value>
            <Kpi.Trend value={7.8} />
          </Kpi.Content>
          <Kpi.Chart data={spark([36, 39, 47, 44, 55, 63, 61, 76, 88])} dataKey="v" />
        </Kpi>

        {/* The chart beside the number instead of under it, for a denser row. */}
        <Kpi colorIndex={2}>
          <Kpi.Header>
            <Kpi.Title>New customers</Kpi.Title>
          </Kpi.Header>
          <Kpi.Content layout="inline">
            <View>
              <Kpi.Value>2,867</Kpi.Value>
              <Kpi.Trend value={4.2} className="mt-1 self-start" />
            </View>
            <Kpi.Chart
              data={spark([27, 35, 33, 46, 59, 55, 64, 79, 91])}
              dataKey="v"
              inline
            />
          </Kpi.Content>
        </Kpi>
      </View>
    </ChartScreen>
  );
}

function KpiProgressVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Targets</Frame.Title>
          <Frame.Action>Q3</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <Frame.Section className={KPI_ROW}>
            <Kpi surface={false} colorIndex={4}>
              <Kpi.Header>
                <Kpi.Icon tone="good">
                  <Target size={16} color="#27a644" />
                </Kpi.Icon>
                <Kpi.Title>Quarterly revenue</Kpi.Title>
                <Kpi.Trend value={7.8} variant="badge" />
              </Kpi.Header>
              <Kpi.Value>$317k</Kpi.Value>
              <Kpi.Progress value={73} label="of $435k" showValueLabel />
              <Kpi.Footer>
                <Text size="xs" muted>
                  41 days left in the quarter
                </Text>
              </Kpi.Footer>
            </Kpi>
          </Frame.Section>
          <Frame.Section className={KPI_ROW}>
            <Kpi surface={false} colorIndex={2}>
              <Kpi.Header>
                <Kpi.Icon>
                  <DollarSign size={16} color="#8a8f98" />
                </Kpi.Icon>
                <Kpi.Title>New customers</Kpi.Title>
                <Kpi.Trend value={4.2} variant="badge" />
              </Kpi.Header>
              <Kpi.Value>2,867</Kpi.Value>
              <Kpi.Progress value={57} label="of 5,000" showValueLabel />
            </Kpi>
          </Frame.Section>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function KpiGroupVersion() {
  return (
    <ChartScreen>
      <View className="w-full gap-6">
        {/* Three metrics as one panel: a rule between them rather than space
            around them, so they read as one thing with three parts. */}
        <Surface variant="secondary" padding="lg">
          <Kpi.Group>
            <Kpi surface={false} colorIndex={1}>
              <Kpi.Title>Revenue</Kpi.Title>
              <Kpi.Value className="text-2xl">$317k</Kpi.Value>
              <Kpi.Trend value={7.8} className="self-start" />
            </Kpi>
            <Kpi surface={false} colorIndex={2}>
              <Kpi.Title>Orders</Kpi.Title>
              <Kpi.Value className="text-2xl">2,867</Kpi.Value>
              <Kpi.Trend value={4.2} className="self-start" />
            </Kpi>
            <Kpi surface={false} colorIndex={3} goodDirection="down">
              <Kpi.Title>Refunds</Kpi.Title>
              <Kpi.Value className="text-2xl">1.4%</Kpi.Value>
              <Kpi.Trend value={-0.3} className="self-start" />
            </Kpi>
          </Kpi.Group>
        </Surface>

        <Surface variant="secondary" padding="lg">
          <Kpi.Group orientation="vertical">
            <Kpi surface={false} colorIndex={1}>
              <Kpi.Content layout="inline">
                <View>
                  <Kpi.Title>Sessions</Kpi.Title>
                  <Kpi.Value className="text-2xl">48,201</Kpi.Value>
                </View>
                <Kpi.Trend value={12.4} />
              </Kpi.Content>
            </Kpi>
            <Kpi surface={false} colorIndex={3} goodDirection="down">
              <Kpi.Content layout="inline">
                <View>
                  <Kpi.Title>Latency p95</Kpi.Title>
                  <Kpi.Value className="text-2xl">312ms</Kpi.Value>
                </View>
                <Kpi.Trend value={-6.1} />
              </Kpi.Content>
            </Kpi>
          </Kpi.Group>
        </Surface>
      </View>
    </ChartScreen>
  );
}

/* -------------------------------------------------------------------------- */
/* Calendar and DatePicker                                                    */
/* -------------------------------------------------------------------------- */

const addDemoDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

function CalendarSingleDemo() {
  const [day, setDay] = useState<Date | undefined>(new Date());
  return (
    <View className="w-full gap-4">
      <Calendar selected={day} onSelect={setDay} />
      <Text size="sm" muted className="text-center">
        {day ? day.toDateString() : 'Nothing picked — tap the same day again to clear it.'}
      </Text>
    </View>
  );
}

function CalendarRangeDemo() {
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDemoDays(9),
  });
  return (
    <View className="w-full gap-4">
      <Calendar mode="range" selected={range} onSelect={setRange} />
      <Text size="sm" muted className="text-center">
        {range?.to
          ? `${range.from.toDateString()} → ${range.to.toDateString()}`
          : 'Pick the other end.'}
      </Text>
    </View>
  );
}

function CalendarMultipleDemo() {
  const [days, setDays] = useState<Date[]>([new Date(), addDemoDays(3), addDemoDays(4)]);
  return (
    <View className="w-full gap-4">
      <Calendar mode="multiple" selected={days} onSelect={setDays} />
      <Text size="sm" muted className="text-center">
        {days.length} {days.length === 1 ? 'date' : 'dates'} picked
      </Text>
    </View>
  );
}

/** Weekends and the past ruled out, which is what a booking screen needs. */
function CalendarDisabledDemo() {
  const [day, setDay] = useState<Date>();
  return (
    <View className="w-full gap-4">
      <Calendar
        selected={day}
        onSelect={setDay}
        minDate={new Date()}
        maxDate={addDemoDays(60)}
        disabled={(date) => date.getDay() === 0 || date.getDay() === 6}
      />
      <Text size="sm" muted className="text-center">
        Weekdays only, and nothing before today or more than two months out.
      </Text>
    </View>
  );
}

/** The caption as month and year pickers — four taps to a birthday. */
function CalendarDropdownDemo() {
  const [day, setDay] = useState<Date>();
  return (
    <View className="w-full gap-4">
      {/* A century of years on offer, and nothing after today selectable —
          the two bounds are separate questions. */}
      <Calendar
        selected={day}
        onSelect={setDay}
        captionLayout="dropdown"
        maxDate={new Date()}
        startMonth={new Date(1925, 0, 1)}
        endMonth={new Date()}
        defaultMonth={new Date(1996, 5, 1)}
      />
      <Text size="sm" muted className="text-center">
        Tap the month or the year to jump rather than paging.
      </Text>
    </View>
  );
}

/**
 * The cells at the ends of the grid belong to the months either side.
 *
 * They are drawn so the grid keeps its six rows and the columns stay under
 * their headings, but a tap on one is far more often a misfire than a real
 * attempt to reach into next month — so by default they do not answer.
 */
function CalendarOutsideDaysDemo() {
  const [day, setDay] = useState<Date | undefined>(new Date());
  const [reachable, setReachable] = useState(false);

  return (
    <View className="w-full gap-4">
      <Calendar
        selected={day}
        onSelect={setDay}
        selectOutsideDays={reachable}
      />
      <View className="flex-row items-center justify-between gap-3">
        <Text size="sm" muted className="flex-1">
          {reachable
            ? 'The greyed days at either end answer a tap.'
            : 'The greyed days at either end ignore a tap. Page to the month instead.'}
        </Text>
        <Switch value={reachable} onValueChange={setReachable} />
      </View>
    </View>
  );
}

/**
 * The same grid counted two ways.
 *
 * The calendar system is what the months and the day numbers are counted in,
 * and it moves the grid rather than only its labels — a Hijri month starts on
 * a different day and runs 29 or 30. The value picked is a plain `Date` either
 * way, so the choice is a presentation one and nothing downstream has to know.
 */
function CalendarSystemDemo() {
  const [system, setSystem] = useState<'gregory' | 'islamic'>('gregory');
  const [day, setDay] = useState<Date>();

  return (
    <View className="w-full gap-4">
      <Tabs
        defaultValue="gregory"
        value={system}
        onValueChange={(next) => setSystem(next as typeof system)}
      >
        <Tabs.List>
          <Tabs.Trigger value="gregory">Gregorian</Tabs.Trigger>
          <Tabs.Trigger value="islamic">Hijri</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      <Calendar selected={day} onSelect={setDay} calendar={system} />

      <Text size="sm" muted className="text-center">
        {day ? day.toDateString() : 'The value is a plain Date whichever is on screen.'}
      </Text>
    </View>
  );
}

function DatePickerDemo() {
  const [day, setDay] = useState<Date>();
  const [range, setRange] = useState<DateRange>();
  const [birthday, setBirthday] = useState<Date>();

  return (
    <View className="w-full gap-6">
      <View className="gap-2">
        <Label>Date</Label>
        <DatePicker selected={day} onSelect={setDay} />
      </View>

      <View className="gap-2">
        <Label>Stay</Label>
        {/* A range waits for its second end before it closes — shutting on the
            first tap would leave half a range on screen and no way back to it. */}
        <DatePicker
          mode="range"
          selected={range}
          onSelect={setRange}
          placeholder="Check in — check out"
          minDate={new Date()}
        />
      </View>

      <View className="gap-2">
        <Label>Date of birth</Label>
        <DatePicker
          selected={birthday}
          onSelect={setBirthday}
          captionLayout="dropdown"
          maxDate={new Date()}
          placeholder="Choose a date"
        />
      </View>
    </View>
  );
}

/** In a sheet instead, for a form with the keyboard already up. */
function DatePickerSheetDemo() {
  const [day, setDay] = useState<Date>();
  return (
    <View className="w-full gap-4">
      <DatePicker
        selected={day}
        onSelect={setDay}
        presentation="bottom-sheet"
        placeholder="Pick a date in a sheet"
      />
      <Text size="sm" muted>
        The anchored panel is the default: a month grid is a fixed size and fits
        beside its trigger. A sheet earns its place when the screen is busy.
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* DateTimePicker                                                             */
/* -------------------------------------------------------------------------- */

/** Both halves in one panel, and one Done that finishes them together. */
function DateTimePickerDemo() {
  const [when, setWhen] = useState<Date>();

  return (
    <View className="w-full gap-4">
      <DateTimePicker value={when} onValueChange={setWhen} />
      <Text size="sm" muted>
        {when
          ? when.toLocaleString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: 'numeric',
              minute: '2-digit',
            })
          : 'One value, filled in from either end — the day first or the time first.'}
      </Text>
    </View>
  );
}

/** In a sheet, which is where a panel this tall usually belongs on a phone. */
function DateTimePickerSheetDemo() {
  const [when, setWhen] = useState<Date>();

  return (
    <View className="w-full gap-4">
      <DateTimePicker
        value={when}
        onValueChange={setWhen}
        presentation="bottom-sheet"
        placeholder="Pick a moment in a sheet"
      />
      <Text size="sm" muted>
        A calendar and a scale stacked is a tall panel, and a sheet has the
        height to give it without the popover having to leave the screen.
      </Text>
    </View>
  );
}

/** The wheel face instead of the ruler, for a time down to the minute. */
function DateTimePickerWheelDemo() {
  const [when, setWhen] = useState<Date>();

  return (
    <View className="w-full gap-4">
      <DateTimePicker
        value={when}
        onValueChange={setWhen}
        layout="wheel"
        hourCycle={24}
        minuteStep={5}
        presentation="dialog"
        placeholder="Pick to the minute"
      />
      <Text size="sm" muted>
        The ruler is the default because it fits under a month grid. Where the
        exact minute matters more than the height, the wheel is a prop away.
      </Text>
    </View>
  );
}

/** A slot inside opening hours, on a day inside the booking window. */
function DateTimePickerSlotDemo() {
  const [when, setWhen] = useState<Date>();

  const today = new Date();
  const window = new Date(today);
  window.setDate(window.getDate() + 21);

  return (
    <View className="w-full gap-3">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Book a fitting</Frame.Title>
          <Frame.Action>30 minutes</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <View className="p-3">
            {/* Bounded on both axes: three weeks of days, and only the hours
                the shop is open. A picker that offers a slot nobody can be
                given is a picker that has to reject it later. */}
            <DateTimePicker
              presentation="inline"
              value={when}
              onValueChange={setWhen}
              minDate={today}
              maxDate={window}
              minTime={{ hour: 9, minute: 0 }}
              maxTime={{ hour: 17, minute: 30 }}
              minuteStep={30}
            />
          </View>
        </Frame.Panel>
      </Frame>
      <Text size="sm" muted className="text-center">
        {when
          ? when.toLocaleString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })
          : 'Next three weeks, 9:00 to 17:30'}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Input — content inside the field                                           */
/* -------------------------------------------------------------------------- */

/**
 * The case this is here to prove: an icon that stays put when a label lands
 * above the field. The content is positioned against the field box, so nothing
 * added around the field can move it.
 */
function InputContentDemo() {
  const [query, setQuery] = useState('');

  return (
    <View className="w-full gap-4">
      <Input
        label="Description"
        placeholder="A short description"
        description="Shown on your public profile."
        startContent={<PencilIcon size={18} />}
      />

      <Input
        placeholder="Find a project"
        value={query}
        onChangeText={setQuery}
        // Wrapped so the magnifier stays decoration while the ✕ beside it
        // stays a button: the field's own `interactiveContent` covers both
        // ends at once, and only one of these two is a control.
        startContent={
          <View pointerEvents="none">
            <SearchIcon size={18} />
          </View>
        }
        endContent={
          query ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <XIcon size={16} />
            </Pressable>
          ) : null
        }
      />

      <Input
        label="Amount"
        placeholder="0.00"
        keyboardType="decimal-pad"
        startContent={<Text muted>$</Text>}
        endContent={<Text muted>USD</Text>}
      />

      <Input
        label="Note"
        multiline
        placeholder="Anything worth remembering"
        startContent={<PencilIcon size={18} />}
      />

      <Text size="sm" muted>
        Every field here has a label, and the icons have not moved. That is the
        difference from wrapping the whole component — a label lands above the
        field, so anything centred on the component drifts up with it.
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* TimePicker                                                                 */
/* -------------------------------------------------------------------------- */

/** The same wheel behind each of the three overlays it can arrive in. */
function TimePickerPresentationsDemo() {
  const [popover, setPopover] = useState<TimeValue>();
  const [dialog, setDialog] = useState<TimeValue>();
  const [sheet, setSheet] = useState<TimeValue>();

  return (
    <View className="w-full gap-6">
      <View className="gap-2">
        <Label>Popover</Label>
        <TimePicker value={popover} onValueChange={setPopover} />
      </View>

      <View className="gap-2">
        <Label>Dialog</Label>
        <TimePicker presentation="dialog" value={dialog} onValueChange={setDialog} />
      </View>

      <View className="gap-2">
        <Label>Bottom sheet</Label>
        <TimePicker presentation="bottom-sheet" value={sheet} onValueChange={setSheet} />
      </View>
    </View>
  );
}

/** 24-hour, and a wheel narrowed to the slots actually on offer. */
function TimePickerWheelDemo() {
  const [any, setAny] = useState<TimeValue>();
  const [slot, setSlot] = useState<TimeValue>();

  return (
    <View className="w-full gap-6">
      <View className="gap-2">
        <Label>A 24-hour clock</Label>
        <TimePicker hourCycle={24} value={any} onValueChange={setAny} />
      </View>

      <View className="gap-2">
        <Label>Within opening hours</Label>
        {/* The bounds are applied to the value, not to the scroll: a face
            reports the row it landed on and the picker clamps it. */}
        <TimePicker
          value={slot}
          onValueChange={setSlot}
          minTime={{ hour: 9, minute: 0 }}
          maxTime={{ hour: 17, minute: 30 }}
          minuteStep={15}
          placeholder="Pick a slot"
        />
      </View>
    </View>
  );
}

/** The face beside its list, inline so both are on screen at once. */
function TimePickerClockDemo() {
  const [time, setTime] = useState<TimeValue>({ hour: 19, minute: 0 });

  return (
    <View className="w-full items-center gap-4">
      <TimePicker presentation="inline" layout="clock" value={time} onValueChange={setTime} />
      <Text size="sm" muted>
        The hands sweep rather than jump. The face is there to say when in the
        day the highlighted row is, and a hand that jumps gives that away one
        row at a time.
      </Text>
    </View>
  );
}

/** The ruler where it belongs — a sheet, with a thumb on it. */
function TimePickerRulerDemo() {
  const [time, setTime] = useState<TimeValue>({ hour: 0, minute: 0 });

  return (
    <View className="w-full gap-6">
      <View className="gap-2">
        <Text size="2xl" weight="semibold">
          Reminder
        </Text>
        <Text muted>
          The readout reads at arm's length, which is what makes this the layout
          for a sheet. Swipe the scale; it comes to rest on a step.
        </Text>
      </View>

      <TimePicker
        layout="ruler"
        presentation="bottom-sheet"
        value={time}
        onValueChange={setTime}
        placeholder="Set a reminder"
      />

      <Text size="sm" muted>
        Chosen: {formatTime(time)}
      </Text>
    </View>
  );
}

type TimeEdge = 'start' | 'end';

/**
 * One end of the span, in the header readout.
 *
 * The lit one is the end the face is editing. Nothing else marks it, and
 * nothing else needs to: the readout is already the only place both times are
 * written down, so the answer to "which of these am I turning the face for" is
 * the one that is brighter.
 */
function TimeEdgeButton({
  label,
  time,
  active,
  onPress,
}: {
  label: string;
  time: TimeValue;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${formatTime(time)}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`rounded-md px-2 py-1 ${active ? 'bg-accent' : ''}`}
    >
      <Text size="sm" weight={active ? 'medium' : 'normal'} muted={!active}>
        {formatTime(time)}
      </Text>
    </Pressable>
  );
}

/**
 * A picker composed into a card rather than hidden behind a trigger.
 *
 * Two independent times behind one face — which is what a "single time or a
 * range" control actually is, and why the picker does not need a range mode of
 * its own to build one.
 */
function TimePickerFrameDemo() {
  const { toast } = useToast();
  const [edge, setEdge] = useState<TimeEdge>('start');
  const [start, setStart] = useState<TimeValue>({ hour: 19, minute: 0 });
  const [end, setEnd] = useState<TimeValue>({ hour: 21, minute: 30 });

  const editing = edge === 'start' ? start : end;
  const setEditing = edge === 'start' ? setStart : setEnd;

  /*
   * Tapping a time is how you choose which one the face edits — so there is no
   * separate pair of buttons above the card saying the same thing twice. The
   * readout lights up, and a toast says what the face is now for, because the
   * highlight alone is a small change to notice on the far side of the header.
   */
  const edit = (next: TimeEdge) => {
    setEdge(next);
    toast.show({
      variant: 'info',
      label: next === 'start' ? 'Editing the start' : 'Editing the end',
      description: 'Turn the face to set it.',
      duration: 2000,
    });
  };

  return (
    <View className="w-full gap-3">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Time</Frame.Title>
          <Frame.Action className="gap-1">
            <TimeEdgeButton
              label="Starts"
              time={start}
              active={edge === 'start'}
              onPress={() => edit('start')}
            />
            <Text size="sm" muted>
              –
            </Text>
            <TimeEdgeButton
              label="Ends"
              time={end}
              active={edge === 'end'}
              onPress={() => edit('end')}
            />
          </Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <Frame.Section className="items-center">
            <TimePicker
              presentation="inline"
              layout="clock"
              value={editing}
              onValueChange={setEditing}
            />
          </Frame.Section>
        </Frame.Panel>
      </Frame>

      <Text size="sm" muted>
        Tap either time to point the face at it.
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Carousel                                                                   */
/* -------------------------------------------------------------------------- */

const SCENES = [
  { title: 'Desert dunes', uri: 'photo-1509316785289-025f5b846b35' },
  { title: 'Northern lights', uri: 'photo-1483347756197-71ef80e95f73' },
  { title: 'Still harbour', uri: 'photo-1502082553048-f009c37129b9' },
  { title: 'Canyon road', uri: 'photo-1469854523086-cc02fe5d8800' },
  { title: 'Alpine lake', uri: 'photo-1454391304352-2bf4678b1a7a' },
  { title: 'City at dusk', uri: 'photo-1493246507139-91e8fad9978e' },
].map((scene) => ({
  ...scene,
  uri: `https://images.unsplash.com/${scene.uri}?auto=format&fit=crop&w=600&q=70`,
}));

/** A full-width run of cards — the layout for content that is read. */
function CarouselTrackDemo() {
  return (
    <View className="w-full gap-4">
      <Carousel loop>
        <Carousel.Content className="h-56">
          {SCENES.map((scene) => (
            <Carousel.Item key={scene.title} className="px-2">
              <View className="h-full w-full overflow-hidden rounded-2xl">
                <Image source={{ uri: scene.uri }} className="h-full w-full" />
              </View>
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <Carousel.Controls className="mt-4" />
      </Carousel>
    </View>
  );
}

/** The fan. It opens wider while a finger is down, and settles when it lifts. */
function CarouselInteractiveDemo() {
  return (
    <View className="w-full gap-4">
      <Carousel variant="interactive" itemSize={160} defaultIndex={2}>
        <Carousel.Content className="h-56">
          {SCENES.map((scene) => (
            <Carousel.Item key={scene.title} className="items-center gap-2">
              <Carousel.Caption>{scene.title}</Carousel.Caption>
              <Image
                source={{ uri: scene.uri }}
                className="h-28 w-28 rounded-xl"
              />
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <Carousel.Controls className="mt-2" />
      </Carousel>
    </View>
  );
}

/**
 * The same fan with nothing under it.
 *
 * No arrows and no dots — the run is dragged and nothing else, which is the
 * right shape when the pictures are the whole point and a control bar would be
 * the only chrome on the screen.
 */
function CarouselBareDemo() {
  return (
    <View className="w-full gap-4">
      <Carousel variant="interactive" itemSize={160} defaultIndex={2}>
        <Carousel.Content className="h-56">
          {SCENES.map((scene) => (
            <Carousel.Item key={scene.title} className="items-center gap-2">
              <Carousel.Caption>{scene.title}</Carousel.Caption>
              <Image source={{ uri: scene.uri }} className="h-28 w-28 rounded-xl" />
            </Carousel.Item>
          ))}
        </Carousel.Content>
      </Carousel>
      <Text size="sm" muted className="text-center">
        Drag it. There is nothing else to press.
      </Text>
    </View>
  );
}

/** Neighbours turned away in perspective — the layout art wants. */
function CarouselCoverflowDemo() {
  return (
    <View className="w-full gap-4">
      <Carousel variant="coverflow" itemSize={150} defaultIndex={2}>
        <Carousel.Content className="h-48">
          {SCENES.map((scene) => (
            <Carousel.Item key={scene.title}>
              <Image
                source={{ uri: scene.uri }}
                className="h-32 w-24 rounded-xl"
              />
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <Carousel.Controls className="mt-4" />
      </Carousel>
    </View>
  );
}

const ROLES = [
  { title: 'Prompt Engineer', rate: '$120/hr', company: 'Northwind', field: 'AI Research' },
  { title: 'Design Engineer', rate: '$95/hr', company: 'Beacon', field: 'Product' },
  { title: 'Systems Architect', rate: '$140/hr', company: 'Halcyon', field: 'Infrastructure' },
  { title: 'Motion Designer', rate: '$88/hr', company: 'Fieldnote', field: 'Brand' },
];

/**
 * A deck. Dragging the top card takes it away and reveals the next.
 *
 * The pile is the point, so the cards are sized rather than full-width — a card
 * as wide as the screen has nothing to stack behind it.
 */
function CarouselStackDemo() {
  return (
    <View className="w-full items-center gap-6">
      <Carousel variant="stack" itemSize={260}>
        <Carousel.Content className="h-72">
          {ROLES.map((role) => (
            <Carousel.Item key={role.title}>
              <Card className="w-64 gap-0 overflow-hidden">
                <Card.Content className="gap-6 pb-4 pt-4">
                  <View className="flex-row items-start justify-between">
                    <Text size="sm" muted>
                      {role.rate}
                    </Text>
                    <BookmarkIcon size={16} />
                  </View>

                  <View className="flex-row items-end justify-between gap-3">
                    <Text size="2xl" weight="bold" className="flex-1">
                      {role.title}
                    </Text>
                    {/* The rail down the card's edge, standing in for a
                        scrollbar: the deck's own position, on the deck. */}
                    <Carousel.Dots orientation="vertical" className="pb-1" />
                  </View>
                </Card.Content>

                <Separator />

                <Card.Content className="flex-row items-center justify-between gap-3 py-3">
                  <View className="flex-1">
                    <Text size="sm" weight="semibold" numberOfLines={1}>
                      {role.company}
                    </Text>
                    <Text size="xs" muted numberOfLines={1}>
                      {role.field}
                    </Text>
                  </View>
                  <Button size="sm" className="rounded-full">
                    View
                  </Button>
                </Card.Content>
              </Card>
            </Carousel.Item>
          ))}
        </Carousel.Content>
      </Carousel>

      <Text size="sm" muted className="text-center">
        Drag the top card away to deal the next one.
      </Text>
    </View>
  );
}

/** Advancing on its own — until a finger lands, after which it stays put. */
function CarouselAutoplayDemo() {
  return (
    <View className="w-full gap-4">
      <Carousel loop autoplay autoplayInterval={2200}>
        <Carousel.Content className="h-40">
          {SCENES.map((scene) => (
            <Carousel.Item key={scene.title} className="px-2">
              <View className="h-full w-full overflow-hidden rounded-2xl">
                <Image source={{ uri: scene.uri }} className="h-full w-full" />
              </View>
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <Carousel.Dots className="mt-4 self-center" />
      </Carousel>
      <Text size="sm" muted className="text-center">
        It stops for good once you take hold of it, rather than starting again a
        moment later.
      </Text>
    </View>
  );
}

/**
 * The band above a chart, inside the panel: the headline reading on the left,
 * the legend on the right.
 *
 * It sits in the card rather than in `Frame.Header` because the header is a
 * caption on the tray the card sits in — one muted line. A title, a legend, a
 * 2xl number and a subtitle all crammed into that strip is four levels of
 * hierarchy in a space that has room for one, and the number, which is the
 * thing the card is actually about, ends up the hardest part to find.
 */
function ChartStat({
  value,
  caption,
  children,
}: {
  value: string;
  caption?: string;
  children?: ReactNode;
}) {
  return (
    <View className="flex-row items-start justify-between gap-3 px-4 pb-2 pt-3.5">
      <View className="gap-0.5">
        <Text size="2xl" weight="bold">
          {value}
        </Text>
        {caption ? (
          <Text size="sm" muted>
            {caption}
          </Text>
        ) : null}
      </View>
      {children ? (
        <View className="flex-row flex-wrap items-center justify-end gap-x-3 gap-y-1 pt-1.5">
          {children}
        </View>
      ) : null}
    </View>
  );
}

/** The legend on its own, for a chart with no headline number above it. */
function ChartLegendRow({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-1 pt-3">
      {children}
    </View>
  );
}

/** A coloured dot and a label, reading its colour from the chart token ramp. */
function LegendDot({
  colorIndex,
  label,
}: {
  colorIndex: 1 | 2 | 3 | 4;
  label: string;
}) {
  const color = useCSSVariable(`--color-chart-${colorIndex}`);
  return (
    <View className="flex-row items-center gap-1.5">
      <View
        style={{ backgroundColor: typeof color === 'string' ? color : undefined }}
        className="h-2.5 w-2.5 rounded-full"
      />
      <Text size="xs" muted>
        {label}
      </Text>
    </View>
  );
}

/* --- ScatterChart versions ------------------------------------------------ */

const thousands = (value: number) => `$${Math.round(value / 1000)}k`;

function ScatterBasicVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Spend vs Revenue</Frame.Title>
          <Frame.Action>{CAMPAIGNS.length} campaigns</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <ScatterChart data={CAMPAIGNS} xDataKey="spend" aspectRatio={1.2}>
            <ScatterChart.Grid />
            <ScatterChart.Points dataKey="revenue" />
            <ScatterChart.XAxis format={thousands} />
            <ScatterChart.YAxis format={thousands} />
            <ScatterChart.Tooltip
              formatTitle={(d) => String(d.name)}
              formatX={(v) => `${thousands(v)} spend`}
              formatY={(v) => `${thousands(v)} back`}
            />
          </ScatterChart>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function ScatterBubblesVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Spend, revenue and reach</Frame.Title>
          <Frame.Action>Size is reach</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <ScatterChart data={CAMPAIGNS} xDataKey="spend" aspectRatio={1.2}>
            <ScatterChart.Grid />
            {/* The third quantity rides each point's area, not its radius. */}
            <ScatterChart.Points dataKey="revenue" sizeKey="reach" sizeRange={[4, 18]} />
            <ScatterChart.XAxis format={thousands} />
            <ScatterChart.YAxis format={thousands} />
            <ScatterChart.Tooltip formatTitle={(d) => String(d.name)} />
          </ScatterChart>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function ScatterTwoSeriesVersion() {
  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Response by dose</Frame.Title>
        </Frame.Header>
        <Frame.Panel>
          <ChartLegendRow>
            <LegendDot colorIndex={1} label="Control" />
            <LegendDot colorIndex={2} label="Treated" />
          </ChartLegendRow>
          <ScatterChart data={TRIALS} xDataKey="dose" aspectRatio={1.2}>
            <ScatterChart.Grid />
            <ScatterChart.Points dataKey="control" colorIndex={1} />
            <ScatterChart.Points dataKey="treated" colorIndex={2} />
            <ScatterChart.XAxis format={(v) => `${Math.round(v)}mg`} />
            <ScatterChart.YAxis />
            <ScatterChart.Tooltip formatX={(v) => `${Math.round(v)}mg`} />
          </ScatterChart>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

function ScatterLoadingVersion() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  // Settles on its own so the transition is visible without a tap, and can be
  // run again from the button.
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('ready'), 1400);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <ChartScreen>
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Spend vs Revenue</Frame.Title>
          <Frame.Action>
            <Button variant="ghost" size="sm" onPress={() => setStatus('loading')}>
              Reload
            </Button>
          </Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <ScatterChart data={CAMPAIGNS} status={status} xDataKey="spend" aspectRatio={1.2}>
            <ScatterChart.Grid />
            <ScatterChart.Skeleton />
            <ScatterChart.Points dataKey="revenue" />
            <ScatterChart.XAxis format={thousands} />
            <ScatterChart.YAxis format={thousands} />
            <ScatterChart.Tooltip formatTitle={(d) => String(d.name)} />
          </ScatterChart>
        </Frame.Panel>
      </Frame>
    </ChartScreen>
  );
}

/* -------------------------------------------------------------------------- */
/* MessageScroller — full-screen demos                                        */
/* -------------------------------------------------------------------------- */

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const THREAD: Turn[] = [
  { id: 't1', role: 'user', text: 'Can you summarise last quarter?' },
  { id: 't2', role: 'assistant', text: 'Revenue was up 14% on the quarter before, driven mostly by renewals.' },
  { id: 't3', role: 'user', text: 'Which plan grew fastest?' },
  { id: 't4', role: 'assistant', text: 'Team. It roughly doubled its seat count, while Pro stayed flat.' },
  { id: 't5', role: 'user', text: 'And churn?' },
  { id: 't6', role: 'assistant', text: 'Down to 2.1% monthly, the lowest it has been all year.' },
  { id: 't7', role: 'user', text: 'What should I look at next?' },
  { id: 't8', role: 'assistant', text: 'Expansion revenue. It is the line that explains most of the growth, and it is the one nobody is tracking weekly.' },
];

/** One turn, rendered as a Message. Shared by all three scroller demos. */
function Turn({ turn }: { turn: Turn }) {
  return turn.role === 'user' ? (
    <Message align="end">
      <Message.Content>
        <Message.Bubble>
          <Message.BubbleContent>{turn.text}</Message.BubbleContent>
        </Message.Bubble>
      </Message.Content>
    </Message>
  ) : (
    <Message>
      <Message.Avatar>
        <Avatar size="sm" fallback="AI" />
      </Message.Avatar>
      <Message.Content>
        <Message.Bubble>
          <Message.BubbleContent>{turn.text}</Message.BubbleContent>
        </Message.Bubble>
      </Message.Content>
    </Message>
  );
}

const REPLY =
  'Looking at the numbers now. Expansion revenue came to $412k for the quarter, up from $290k. Most of it is seat growth inside accounts that were already on Team, which is the healthiest kind — nobody had to be sold anything twice.';

/**
 * Follow-output: the transcript pins to the bottom while the reply streams,
 * but only while the reader is already there. Scroll up mid-stream and it
 * stops chasing until the button is pressed.
 */
function StreamingTranscriptDemo() {
  const [turns, setTurns] = useState<Turn[]>(THREAD.slice(0, 4));
  const [streaming, setStreaming] = useState(false);
  const insets = useSafeAreaInsets();

  const send = () => {
    if (streaming) return;
    const askId = `ask-${Date.now()}`;
    const replyId = `reply-${Date.now()}`;
    setTurns((current) => [
      ...current,
      { id: askId, role: 'user', text: 'Break down expansion revenue.' },
      { id: replyId, role: 'assistant', text: '' },
    ]);
    setStreaming(true);

    const words = REPLY.split(' ');
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTurns((current) =>
        current.map((turn) =>
          turn.id === replyId ? { ...turn, text: words.slice(0, index).join(' ') } : turn
        )
      );
      if (index >= words.length) {
        clearInterval(timer);
        setStreaming(false);
      }
    }, 90);
  };

  return (
    <View className="flex-1">
      <MessageScroller autoScroll className="flex-1">
        <MessageScroller.Viewport>
          <MessageScroller.Content>
            {turns.map((turn) => (
              <MessageScroller.Item
                key={turn.id}
                messageId={turn.id}
                scrollAnchor={turn.role === 'user'}
              >
                <Turn turn={turn} />
              </MessageScroller.Item>
            ))}
            {streaming ? (
              <Marker>
                <Marker.Content shimmer>Generating…</Marker.Content>
              </Marker>
            ) : null}
          </MessageScroller.Content>
        </MessageScroller.Viewport>
        <MessageScroller.Button />
      </MessageScroller>

      {/* The full-page host reaches the screen edge, so the composer lifts
          itself clear of the home indicator. */}
      <View
        className="border-t border-border px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button onPress={send} loading={streaming} fullWidth>
          {streaming ? 'Streaming' : 'Send a message'}
        </Button>
      </View>
    </View>
  );
}

/**
 * Older turns are added above the reader. Without the correction this jumps a
 * screen backwards every time; with it the message they were reading does not
 * move at all.
 */
function HistoryTranscriptDemo() {
  const [turns, setTurns] = useState<Turn[]>(THREAD.slice(4));
  const [page, setPage] = useState(0);

  const loadOlder = () => {
    const older: Turn[] = Array.from({ length: 4 }, (_, index) => ({
      id: `old-${page}-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      text:
        index % 2 === 0
          ? `An older question, ${page * 4 + index + 1} turns back.`
          : 'And the answer that went with it, long enough to take a couple of lines on a phone.',
    }));
    setTurns((current) => [...older, ...current]);
    setPage((current) => current + 1);
  };

  return (
    <MessageScroller className="flex-1" defaultScrollPosition="end">
      <MessageScroller.Viewport>
        <MessageScroller.Content>
          <View className="items-center pb-1">
            <Button variant="ghost" size="sm" onPress={loadOlder}>
              Load older messages
            </Button>
          </View>
          {turns.map((turn) => (
            <MessageScroller.Item
              key={turn.id}
              messageId={turn.id}
              scrollAnchor={turn.role === 'user'}
            >
              <Turn turn={turn} />
            </MessageScroller.Item>
          ))}
        </MessageScroller.Content>
      </MessageScroller.Viewport>
      <MessageScroller.Button />
    </MessageScroller>
  );
}

/**
 * A saved thread opens on the last turn that started something, not at the
 * bottom of whatever the reply happened to be.
 */
function SavedThreadDemo() {
  return (
    <MessageScroller className="flex-1" defaultScrollPosition="last-anchor">
      <MessageScroller.Viewport>
        <MessageScroller.Content>
          <Marker variant="separator">
            <Marker.Content>Yesterday</Marker.Content>
          </Marker>
          {THREAD.map((turn) => (
            <MessageScroller.Item
              key={turn.id}
              messageId={turn.id}
              scrollAnchor={turn.role === 'user'}
            >
              <Turn turn={turn} />
            </MessageScroller.Item>
          ))}
        </MessageScroller.Content>
      </MessageScroller.Viewport>
      <MessageScroller.Button target="start" />
    </MessageScroller>
  );
}

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

function MessageLongPressDemo() {
  const [open, setOpen] = useState(false);

  return (
    <View className="w-full gap-3">
      <Text size="sm" muted className="text-center">
        Press and hold the bubble.
      </Text>

      <Message align="end" onLongPress={() => setOpen(true)}>
        <Message.Content>
          <Message.Bubble>
            <Message.BubbleContent>
              Ship it — long-press me for actions.
            </Message.BubbleContent>
          </Message.Bubble>
        </Message.Content>
      </Message>

      {/* The component only exposes the gesture; the menu is wired here. */}
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheet.Content>
          <Text size="lg" weight="semibold" className="mb-3">
            Message
          </Text>
          <View className="gap-1 pb-2">
            {[
              { label: 'Copy', icon: <PlusSquareIcon size={16} /> },
              { label: 'Reply', icon: <SendIcon size={16} /> },
              { label: 'Forward', icon: <ShareNodesIcon size={16} /> },
            ].map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="menuitem"
                onPress={() => setOpen(false)}
                className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-accent"
              >
                {action.icon}
                <Text>{action.label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => setOpen(false)}
              className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-accent"
            >
              <XIcon size={16} />
              <Text className="text-destructive">Delete</Text>
            </Pressable>
          </View>
        </BottomSheet.Content>
      </BottomSheet>
    </View>
  );
}

function PlacementPopover({
  placement,
}: {
  placement: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Popover>
      <Popover.Trigger>
        <Button variant="secondary" size="sm">
          {placement}
        </Button>
      </Popover.Trigger>
      <Popover.Content placement={placement} className="w-40">
        <Popover.Arrow />
        <Popover.Description>Opens {placement} of the trigger.</Popover.Description>
      </Popover.Content>
    </Popover>
  );
}

function PlacementTooltip({
  placement,
}: {
  placement: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Tooltip openOn="press" duration={0}>
      <Tooltip.Trigger>
        <Button variant="secondary" size="sm">
          {placement}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content placement={placement}>
        <Tooltip.Arrow />
        Opens {placement}
      </Tooltip.Content>
    </Tooltip>
  );
}

function PopoverFormDemo() {
  const [name, setName] = useState('Untitled board');
  const [open, setOpen] = useState(false);

  return (
    <View className="w-full py-4">
      <Popover open={open} onOpenChange={setOpen}>
        <Popover.Trigger>
          {/* A full-width trigger, because `width="trigger"` is only worth
              having when the trigger is wide enough to hold the content. */}
          <Button variant="outline" fullWidth>
            Rename board
          </Button>
        </Popover.Trigger>
        {/* The panel takes the trigger's width, so the two read as one control
            rather than as a panel floating over a button. `minWidth` is the
            floor for the day the trigger turns out narrower than the form. */}
        <Popover.Content width="trigger" minWidth={260} align="start" className="gap-3">
          <Popover.Title>Rename</Popover.Title>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Board name"
            accessibilityLabel="Board name"
            autoCorrect={false}
          />
          <View className="flex-row justify-end gap-2">
            <Popover.Close>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Popover.Close>
            <Popover.Close>
              <Button size="sm">Save</Button>
            </Popover.Close>
          </View>
        </Popover.Content>
      </Popover>
    </View>
  );
}

function MenuViewOptionsDemo() {
  const [density, setDensity] = useState('comfortable');
  const [showDone, setShowDone] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  return (
    <View className="w-full items-center py-4">
      <Menu haptics>
        <Menu.Trigger>
          <Button variant="outline">View options</Button>
        </Menu.Trigger>
        <Menu.Content align="start" width={248}>
          <Menu.Label>Density</Menu.Label>
          {/* One of these is always chosen, so the row states which — and a
              dot says so more quietly than a tick beside a list of nouns. */}
          <Menu.RadioGroup value={density} onValueChange={setDensity}>
            <Menu.RadioItem value="comfortable" indicator="dot">
              Comfortable
            </Menu.RadioItem>
            <Menu.RadioItem value="compact" indicator="dot">
              Compact
            </Menu.RadioItem>
          </Menu.RadioGroup>
          <Menu.Separator />
          <Menu.Label>Show</Menu.Label>
          {/* Checkbox rows keep the menu open, because a set of filters is
              nearly always changed more than one at a time. */}
          <Menu.CheckboxItem checked={showDone} onCheckedChange={setShowDone}>
            Completed
          </Menu.CheckboxItem>
          <Menu.CheckboxItem checked={showArchived} onCheckedChange={setShowArchived}>
            Archived
          </Menu.CheckboxItem>
        </Menu.Content>
      </Menu>
    </View>
  );
}

function MenuSubmenuDemo() {
  const [moved, setMoved] = useState<string | null>(null);

  return (
    <View className="w-full items-center gap-3 py-4">
      <Menu>
        <Menu.Trigger>
          <Button variant="outline">File actions</Button>
        </Menu.Trigger>
        <Menu.Content align="start" width={244}>
          <Menu.Item icon={<PencilIcon size={16} />} shortcut="⌘R">
            Rename
          </Menu.Item>
          {/* The submenu opens downwards into the panel rather than flying out
              sideways — a finger has no path across to a second panel. */}
          <Menu.Sub>
            <Menu.SubTrigger icon={<PackageIcon size={16} />}>Move to</Menu.SubTrigger>
            <Menu.SubContent>
              {['Inbox', 'Projects', 'Archive'].map((folder) => (
                <Menu.Item key={folder} onSelect={() => setMoved(folder)}>
                  {folder}
                </Menu.Item>
              ))}
            </Menu.SubContent>
          </Menu.Sub>
          <Menu.Separator />
          <Menu.Item
            variant="destructive"
            icon={<TrashIcon size={16} />}
            description="This cannot be undone"
          >
            Delete
          </Menu.Item>
        </Menu.Content>
      </Menu>
      <Text size="sm" muted>
        {moved ? `Moved to ${moved}` : 'Nothing moved yet'}
      </Text>
    </View>
  );
}

function CheckboxDemo() {
  const [marketing, setMarketing] = useState(true);
  const [updates, setUpdates] = useState(false);

  return (
    <View className="w-full gap-5">
      <Checkbox
        checked={marketing}
        onCheckedChange={setMarketing}
        label="Marketing & promotions"
        description="Special offers and exclusive deals"
      />
      <Checkbox
        checked={updates}
        onCheckedChange={setUpdates}
        label="Product updates"
        description="News about features and releases"
      />
    </View>
  );
}

/**
 * A parent checkbox that governs a group. It is `indeterminate` when the
 * children are partly on, and pressing it turns them all on or all off.
 */
function CheckboxSelectAllDemo() {
  const items = ['Email', 'Push', 'SMS'];
  const [on, setOn] = useState<string[]>(['Email']);

  const all = on.length === items.length;
  const some = on.length > 0 && !all;

  const toggle = (id: string) =>
    setOn((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );

  return (
    <View className="w-full gap-4">
      <Checkbox
        checked={all}
        indeterminate={some}
        onCheckedChange={(next) => setOn(next ? [...items] : [])}
        label={all ? 'Deselect all' : 'Select all'}
      />
      <View className="gap-3 pl-7">
        {items.map((id) => (
          <Checkbox
            key={id}
            checked={on.includes(id)}
            onCheckedChange={() => toggle(id)}
            label={id}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * A verification field: six digits, and the row confirms the moment the last
 * one lands. `onComplete` fires once on the transition to full — the moment to
 * submit — rather than on every keystroke that leaves the field full.
 */
function OtpVerifyDemo() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'bad'>('idle');

  return (
    <View className="w-full items-center gap-4">
      <OtpInput
        value={code}
        onChangeText={(next) => {
          setCode(next);
          if (status !== 'idle') setStatus('idle');
        }}
        // 123456 passes; anything else reads as a wrong code.
        onComplete={(value) => setStatus(value === '123456' ? 'ok' : 'bad')}
        isInvalid={status === 'bad'}
        accessibilityLabel="Verification code"
      />
      <Text className="text-sm text-muted-foreground">
        {status === 'ok'
          ? 'Verified — the code was 123456.'
          : status === 'bad'
            ? 'That code didn’t match. Try 123456.'
            : 'Type a six-digit code (123456).'}
      </Text>
    </View>
  );
}

/** A filter bar: any chip can be a filter, its `selected` state doing the work. */
function ChipFilterDemo() {
  const [tags, setTags] = useState<string[]>(['design']);

  const toggle = (id: string) =>
    setTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );

  return (
    <View className="w-full flex-row flex-wrap justify-center gap-2">
      {['design', 'code', 'research', 'ops'].map((id) => (
        <Chip
          key={id}
          selected={tags.includes(id)}
          onPress={() => toggle(id)}
          haptics
        >
          {id}
        </Chip>
      ))}
    </View>
  );
}

/** Removable tokens: the ✕ is its own hit target, so it never fires `onPress`. */
function ChipRemovableDemo() {
  const [people, setPeople] = useState(['Ada', 'Grace', 'Alan', 'Katherine']);

  return (
    <View className="w-full flex-row flex-wrap justify-center gap-2">
      {people.map((name) => (
        <Chip
          key={name}
          variant="outline"
          onClose={() => setPeople((p) => p.filter((n) => n !== name))}
        >
          {name}
        </Chip>
      ))}
      {people.length === 0 ? (
        <Text size="sm" muted>
          Everyone removed — reopen the screen to reset.
        </Text>
      ) : null}
    </View>
  );
}

/** Floating sheet inset from every edge, rather than docked to the bottom. */
function DetachedSheetDemo() {
  return (
    <BottomSheet>
      <BottomSheet.Trigger>
        <Button variant="outline">Open detached</Button>
      </BottomSheet.Trigger>
      <BottomSheet.Content detached>
        <Text size="lg" weight="semibold" className="mb-1">
          Rate your order
        </Text>
        <Text size="sm" muted className="mb-4">
          How was the delivery?
        </Text>
        <View className="flex-row gap-2 pb-2">
          <Button variant="outline" className="flex-1">
            Bad
          </Button>
          <Button variant="outline" className="flex-1">
            Fine
          </Button>
          <Button className="flex-1">Great</Button>
        </View>
      </BottomSheet.Content>
    </BottomSheet>
  );
}

/** Frosted backdrop rather than a dim — the screen behind recedes but stays. */
function BlurredSheetDemo() {
  return (
    <BottomSheet>
      <BottomSheet.Trigger>
        <Button variant="outline">Open over a frosted screen</Button>
      </BottomSheet.Trigger>
      <BottomSheet.Content detached blur>
        <Text size="lg" weight="semibold" className="mb-1">
          Move to trash
        </Text>
        <Text size="sm" muted className="mb-4">
          The file stays recoverable for 30 days.
        </Text>
        <View className="flex-row gap-2 pb-2">
          <Button variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button variant="destructive" className="flex-1">
            Move to trash
          </Button>
        </View>
      </BottomSheet.Content>
    </BottomSheet>
  );
}

/* Flow */

/** The node shape the canvas is built around: a Frame with a status row. */
function ServiceNode({
  title,
  subtitle,
  icon,
  status,
  volume,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  status: string;
  volume?: string;
}) {
  return (
    <Frame className="w-56">
      <Frame.Header className="flex-row items-center gap-3 pb-2 pt-3">
        <Frame.Media>{icon}</Frame.Media>
        <Frame.Content>
          <Text weight="semibold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text size="xs" muted numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </Frame.Content>
      </Frame.Header>
      <Frame.Panel>
        <Frame.Row>
          <Frame.Media>
            <View className="h-4 w-4 items-center justify-center rounded-full border border-success">
              <View className="h-1.5 w-1.5 rounded-full bg-success" />
            </View>
          </Frame.Media>
          <Frame.Content>
            <Text size="sm" muted>
              {status}
            </Text>
          </Frame.Content>
        </Frame.Row>
        {volume ? (
          <Frame.Row>
            <Frame.Media>
              <PackageIcon size={16} />
            </Frame.Media>
            <Frame.Content>
              <Text size="sm" muted numberOfLines={1}>
                {volume}
              </Text>
            </Frame.Content>
          </Frame.Row>
        ) : null}
      </Frame.Panel>
    </Frame>
  );
}

/**
 * The canvas in a fixed box rather than a whole screen. It fills whatever it
 * is given, so a bounded parent is all it takes — the graph still pans and
 * zooms inside it.
 */
function FlowInlineDemo() {
  return (
    <View className="h-64 w-full overflow-hidden rounded-2xl border border-border">
      <Flow defaultViewport={{ x: 10, y: 16, zoom: 0.78 }}>
        <Flow.Background variant="dots" gap={20} />
        <Flow.Node id="queue" position={{ x: 10, y: 10 }}>
          <View className="rounded-xl border border-border bg-card px-3 py-2">
            <Text size="sm" weight="medium">
              queue
            </Text>
          </View>
        </Flow.Node>
        <Flow.Node id="worker" position={{ x: 190, y: 110 }}>
          <View className="rounded-xl border border-border bg-card px-3 py-2">
            <Text size="sm" weight="medium">
              worker
            </Text>
          </View>
        </Flow.Node>
        <Flow.Node id="store" position={{ x: 30, y: 210 }}>
          <View className="rounded-xl border border-border bg-card px-3 py-2">
            <Text size="sm" weight="medium">
              store
            </Text>
          </View>
        </Flow.Node>
        <Flow.Edge from="queue" to="worker" animated arrow />
        <Flow.Edge from="worker" to="store" dashed animated arrow />
      </Flow>
    </View>
  );
}

/** The four routings, on the same pair of nodes. */
function FlowEdgeShapesDemo() {
  const [variant, setVariant] = useState('bezier');

  return (
    <View className="w-full gap-3">
      <View className="h-56 overflow-hidden rounded-2xl border border-border">
        <Flow defaultViewport={{ x: 20, y: 20, zoom: 0.9 }} panOnDrag={false}>
          <Flow.Background variant="dots" gap={20} />
          <Flow.Node id="a" position={{ x: 10, y: 10 }}>
            <View className="rounded-xl border border-border bg-card px-3 py-2">
              <Text size="sm">source</Text>
            </View>
          </Flow.Node>
          <Flow.Node id="b" position={{ x: 190, y: 150 }}>
            <View className="rounded-xl border border-border bg-card px-3 py-2">
              <Text size="sm">target</Text>
            </View>
          </Flow.Node>
          <Flow.Edge
            from="a"
            to="b"
            variant={variant as 'bezier' | 'smoothstep' | 'step' | 'straight'}
            arrow
            animated
          />
        </Flow>
      </View>
      <ToggleButtonGroup
        selectionMode="single"
        value={[variant]}
        onValueChange={(next) => setVariant(next[0] ?? 'bezier')}
      >
        <ToggleButton id="bezier">Bezier</ToggleButton>
        <ToggleButton id="smoothstep">Smooth</ToggleButton>
        <ToggleButton id="step">Step</ToggleButton>
        <ToggleButton id="straight">Line</ToggleButton>
      </ToggleButtonGroup>
    </View>
  );
}

/**
 * Frames bound together — three service cards and the dependencies between
 * them. Drag any of them and the edges re-route as they move.
 */
function FlowInfrastructureVersion() {
  return (
    // `fitViewOnMount` rather than a hand-tuned viewport: three stacked
    // frames are taller than a phone, and a guessed zoom leaves one off screen.
    <Flow fitViewOnMount minZoom={0.35}>
      <Flow.Background variant="dots" gap={22} />

      <Flow.Node id="db" position={{ x: 10, y: 20 }}>
        <ServiceNode icon={<PackageIcon size={20} />} title="blog-db" status="Online" />
      </Flow.Node>

      <Flow.Node id="ghost" position={{ x: 96, y: 250 }}>
        <ServiceNode
          icon={<ShareNodesIcon size={20} />}
          title="ghost-image"
          subtitle="blog.temetro.com"
          status="Online"
          volume="ghost-content"
        />
      </Flow.Node>

      <Flow.Node id="redis" position={{ x: 0, y: 470 }}>
        <ServiceNode icon={<SendIcon size={20} />} title="redis" status="Online" />
      </Flow.Node>

      {/* Named nodes rather than handles, so the faces are chosen from where
          the frames currently are — drag one and the edge picks a different
          side to leave from. */}
      <Flow.Edge from="ghost" to="db" variant="smoothstep" dashed animated arrow />
      <Flow.Edge from="ghost" to="redis" variant="smoothstep" arrow />

      <Flow.Controls />
    </Flow>
  );
}

/** A pipeline running top to bottom, with the live stage's edges marching. */
function FlowPipelineVersion() {
  const [stage, setStage] = useState(1);

  const stages = [
    { id: 'source', title: 'Source', detail: 'main@6d63e13' },
    { id: 'build', title: 'Build', detail: 'bob · 76 files' },
    { id: 'test', title: 'Test', detail: '412 assertions' },
    { id: 'publish', title: 'Publish', detail: 'npm · panelui-native' },
  ];

  return (
    <View className="flex-1">
      <Flow defaultViewport={{ x: 60, y: 24, zoom: 0.9 }} fitViewOnMount>
        <Flow.Background variant="lines" gap={28} />

        {stages.map((entry, index) => (
          <Flow.Node key={entry.id} id={entry.id} position={{ x: 40, y: index * 150 }}>
            <Frame className="w-52">
              <Frame.Header>
                <Frame.Title>{`Stage ${index + 1}`}</Frame.Title>
                <Frame.Action>
                  <Chip
                    size="sm"
                    variant={
                      index < stage ? 'success' : index === stage ? 'info' : 'outline'
                    }
                  >
                    {index < stage ? 'Done' : index === stage ? 'Running' : 'Queued'}
                  </Chip>
                </Frame.Action>
              </Frame.Header>
              <Frame.Panel>
                <Frame.Row>
                  <Frame.Content>
                    <Frame.Title>{entry.title}</Frame.Title>
                    <Frame.Description>{entry.detail}</Frame.Description>
                  </Frame.Content>
                </Frame.Row>
              </Frame.Panel>
            </Frame>
          </Flow.Node>
        ))}

        {stages.slice(0, -1).map((entry, index) => (
          <Flow.Edge
            key={`edge-${entry.id}`}
            from={entry.id}
            to={stages[index + 1]!.id}
            variant="smoothstep"
            arrow
            // Only the edge into the stage that is running moves. An animation
            // on every edge says nothing about which one is live.
            animated={index === stage - 1}
            dashed={index === stage - 1}
          />
        ))}

        <Flow.Controls />
      </Flow>

      <View className="flex-row gap-2 border-t border-border px-5 py-4">
        <Button
          variant="outline"
          className="flex-1"
          disabled={stage === 0}
          onPress={() => setStage((current) => current - 1)}
        >
          Back a stage
        </Button>
        <Button
          className="flex-1"
          disabled={stage === stages.length}
          onPress={() => setStage((current) => current + 1)}
        >
          Advance
        </Button>
      </View>
    </View>
  );
}

/** Drag from one port to another to wire the graph up. */
function FlowConnectVersion() {
  const [edges, setEdges] = useState<FlowConnection[]>([]);

  const nodes = [
    { id: 'webhook', title: 'Webhook', detail: 'POST /orders', x: 20, y: 40 },
    { id: 'enrich', title: 'Enrich', detail: 'Look up the customer', x: 40, y: 220 },
    { id: 'notify', title: 'Notify', detail: 'Send to Slack', x: 60, y: 400 },
  ];

  return (
    <View className="flex-1">
      <Flow
        defaultViewport={{ x: 24, y: 20, zoom: 0.95 }}
        onConnect={(connection) => {
          setEdges((current) =>
            // The canvas never adds the edge itself, so refusing a duplicate is
            // this screen's decision to make.
            current.some(
              (edge) => edge.source === connection.source && edge.target === connection.target
            )
              ? current
              : [...current, connection]
          );
        }}
        isValidConnection={(connection) => connection.source !== connection.target}
      >
        <Flow.Background variant="dots" />

        {nodes.map((node) => (
          <Flow.Node key={node.id} id={node.id} position={{ x: node.x, y: node.y }}>
            <Frame className="w-48">
              <Frame.Header>
                <Frame.Title>{node.title}</Frame.Title>
              </Frame.Header>
              <Frame.Panel>
                <Frame.Row>
                  <Frame.Content>
                    <Frame.Description>{node.detail}</Frame.Description>
                  </Frame.Content>
                </Frame.Row>
              </Frame.Panel>
            </Frame>
            <Flow.Handle id="in" position="top" type="target" />
            <Flow.Handle id="out" position="bottom" type="source" />
          </Flow.Node>
        ))}

        {edges.map((edge) => (
          <Flow.Edge
            key={`${edge.source}-${edge.target}`}
            from={edge.source}
            to={edge.target}
            variant="smoothstep"
            arrow
            animated
          />
        ))}

        <Flow.Controls />
      </Flow>

      <View className="border-t border-border px-5 py-4">
        <Text size="sm" muted>
          {edges.length === 0
            ? 'Drag from a node’s bottom port to another node’s top port.'
            : `${edges.length} connection${edges.length === 1 ? '' : 's'} — drag a node and the edges follow.`}
        </Text>
      </View>
    </View>
  );
}

/** Curved edges radiating from a centre, and a tap that reframes the graph. */
function FlowMindMapVersion() {
  const branches = [
    { id: 'tokens', label: 'Tokens', x: -180, y: -140 },
    { id: 'motion', label: 'Motion', x: 200, y: -160 },
    { id: 'a11y', label: 'Accessibility', x: -200, y: 140 },
    { id: 'docs', label: 'Documentation', x: 210, y: 150 },
  ];

  return (
    <Flow defaultViewport={{ x: 180, y: 300, zoom: 0.9 }} minZoom={0.4} maxZoom={2}>
      <Flow.Background variant="cross" gap={32} />

      <Flow.Node id="core" position={{ x: -60, y: -20 }}>
        <View className="rounded-2xl border border-border bg-card px-5 py-4">
          <Text weight="semibold">Design system</Text>
        </View>
      </Flow.Node>

      {branches.map((branch) => (
        <Flow.Node key={branch.id} id={branch.id} position={{ x: branch.x, y: branch.y }}>
          <View className="rounded-2xl border border-border bg-surface px-4 py-3">
            <Text size="sm">{branch.label}</Text>
          </View>
        </Flow.Node>
      ))}

      {branches.map((branch) => (
        <Flow.Edge key={`edge-${branch.id}`} from="core" to={branch.id} variant="bezier" />
      ))}

      <Flow.Controls zoom={false} />
    </Flow>
  );
}

/** A small service node, sized to sit inside a group without crowding it. */
function GroupedNode({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <View className="w-40 flex-row items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
      <View className="shrink-0">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text size="sm" weight="medium" numberOfLines={1}>
          {title}
        </Text>
        <Text size="xs" muted numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

/**
 * Nodes added at runtime — one button that drops a frame in, another that
 * drops one in already wired to the last.
 *
 * The canvas holds no list of its own: the screen owns the frames and the
 * links, and adding either is adding to an array.
 */
function FlowBuilderVersion() {
  const [nodes, setNodes] = useState([{ id: 'n1', x: 40, y: 40 }]);
  const [links, setLinks] = useState<{ from: string; to: string }[]>([]);

  const add = (linked: boolean) => {
    const previous = nodes[nodes.length - 1];
    const index = nodes.length;
    const id = `n${index + 1}`;
    // Wrapped into short columns rather than one long march downward. Each
    // frame offset from the last walks the graph off the canvas after a dozen
    // presses, and never shows you the first frames alongside the newest.
    const next = {
      id,
      x: 40 + Math.floor(index / 4) * 230,
      y: 40 + (index % 4) * 150,
    };
    setNodes((current) => [...current, next]);
    if (linked && previous) {
      setLinks((current) => [...current, { from: previous.id, to: id }]);
    }
  };

  return (
    <View className="flex-1">
      <Flow minZoom={0.35}>
        <Flow.Background variant="dots" />

        {nodes.map((node) => (
          <Flow.Node key={node.id} id={node.id} position={{ x: node.x, y: node.y }}>
            <Frame className="w-44">
              <Frame.Header>
                <Frame.Title>{node.id}</Frame.Title>
                <Frame.Action>
                  <Badge variant="secondary">node</Badge>
                </Frame.Action>
              </Frame.Header>
              <Frame.Panel>
                <Frame.Row>
                  <Frame.Content>
                    <Frame.Description>Drag me anywhere</Frame.Description>
                  </Frame.Content>
                </Frame.Row>
              </Frame.Panel>
            </Frame>
          </Flow.Node>
        ))}

        {links.map((link) => (
          <Flow.Edge
            key={`${link.from}-${link.to}`}
            from={link.from}
            to={link.to}
            variant="smoothstep"
            arrow
          />
        ))}

        <Flow.Controls />
      </Flow>

      <View className="gap-2 border-t border-border px-5 py-4">
        <View className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onPress={() => add(false)}>
            Add a frame
          </Button>
          <Button className="flex-1" onPress={() => add(true)}>
            Add and link
          </Button>
        </View>
        <Text size="xs" muted>
          {nodes.length} frame{nodes.length === 1 ? '' : 's'}, {links.length} link
          {links.length === 1 ? '' : 's'} — drag any of them and the edges re-route.
        </Text>
      </View>
    </View>
  );
}

/**
 * Edges pinned to named ports rather than routed automatically.
 *
 * Both are worth having: automatic routing keeps a graph readable while it is
 * being rearranged, but a diagram where the sides *mean* something — accepted
 * out of one port, rejected out of another — has to be able to say so.
 */
function FlowPortsVersion() {
  return (
    <Flow fitViewOnMount minZoom={0.35}>
      <Flow.Background variant="cross" gap={26} />

      <Flow.Node id="ingest" position={{ x: 0, y: 0 }}>
        <Frame className="w-44">
          <Frame.Header>
            <Frame.Title>ingest</Frame.Title>
          </Frame.Header>
          <Frame.Panel>
            <Frame.Row>
              <Frame.Content>
                <Frame.Description>Two named outputs</Frame.Description>
              </Frame.Content>
            </Frame.Row>
          </Frame.Panel>
        </Frame>
        {/* Two ports on one face, kept apart by their offsets. */}
        <Flow.Handle id="ok" position="right" type="source" offset={0.34} />
        <Flow.Handle id="fail" position="right" type="source" offset={0.78} />
      </Flow.Node>

      <Flow.Node id="index" position={{ x: 250, y: -70 }}>
        <Frame className="w-40">
          <Frame.Header>
            <Frame.Title>index</Frame.Title>
          </Frame.Header>
          <Frame.Panel>
            <Frame.Row>
              <Frame.Content>
                <Frame.Description>Accepted</Frame.Description>
              </Frame.Content>
            </Frame.Row>
          </Frame.Panel>
        </Frame>
        <Flow.Handle id="in" position="left" type="target" />
        <Flow.Handle id="out" position="right" type="source" />
      </Flow.Node>

      <Flow.Node id="deadletter" position={{ x: 250, y: 150 }}>
        <Frame className="w-40">
          <Frame.Header>
            <Frame.Title>dead-letter</Frame.Title>
          </Frame.Header>
          <Frame.Panel>
            <Frame.Row>
              <Frame.Content>
                <Frame.Description>Rejected</Frame.Description>
              </Frame.Content>
            </Frame.Row>
          </Frame.Panel>
        </Frame>
        <Flow.Handle id="in" position="left" type="target" />
        <Flow.Handle id="out" position="right" type="source" />
      </Flow.Node>

      {/* A frame with a port on every face. Four ports is where naming them
          starts to pay: `router.retry` says which one an edge means, and the
          two that nothing is wired to yet still read as somewhere to wire. */}
      <Flow.Node id="router" position={{ x: 520, y: 30 }}>
        <Frame className="w-44">
          <Frame.Header>
            <Frame.Title>router</Frame.Title>
            <Frame.Action>
              <Badge variant="secondary">4 ports</Badge>
            </Frame.Action>
          </Frame.Header>
          <Frame.Panel>
            <Frame.Row>
              <Frame.Content>
                <Frame.Title>in · retry</Frame.Title>
                <Frame.Description>Left face, two offsets</Frame.Description>
              </Frame.Content>
            </Frame.Row>
            <Frame.Row>
              <Frame.Content>
                <Frame.Title>metrics · logs</Frame.Title>
                <Frame.Description>Top and bottom, unwired</Frame.Description>
              </Frame.Content>
            </Frame.Row>
          </Frame.Panel>
        </Frame>
        <Flow.Handle id="in" position="left" type="target" offset={0.3} />
        <Flow.Handle id="retry" position="left" type="target" offset={0.78} />
        <Flow.Handle id="metrics" position="top" type="source" />
        <Flow.Handle id="logs" position="bottom" type="source" />
      </Flow.Node>

      {/* `nodeId.handleId` pins each end to a port, so the faces stay put
          however the frames are dragged. */}
      <Flow.Edge from="ingest.ok" to="index.in" variant="smoothstep" arrow />
      <Flow.Edge
        from="ingest.fail"
        to="deadletter.in"
        variant="smoothstep"
        dashed
        arrow
      />
      <Flow.Edge from="index.out" to="router.in" variant="smoothstep" arrow />
      <Flow.Edge
        from="deadletter.out"
        to="router.retry"
        variant="smoothstep"
        dashed
        arrow
      />

      <Flow.Controls />
    </Flow>
  );
}

/**
 * Two containers, the line between them, and a minimap.
 *
 * The containers are stacked rather than placed side by side: two 208-wide
 * boxes next to each other need 500 points of graph to breathe, and a phone
 * zoomed out far enough to show 500 points renders the labels too small to
 * read. Down the screen, each container gets the full width.
 *
 * The tiers are what is connected here, not the frames inside them. A
 * dependency between two tiers is a fact about the tiers — drawing it between
 * two of their contents says something narrower, and moves when the contents
 * are rearranged.
 */
function FlowGroupedVersion() {
  return (
    <Flow defaultViewport={{ x: 24, y: 24, zoom: 1 }} minZoom={0.4}>
      <Flow.Background variant="dots" gap={24} />

      <Flow.Group
        id="edge-tier"
        label="Edge"
        position={{ x: 0, y: 0 }}
        size={{ width: 196, height: 178 }}
      >
        {/* `pinned`: the tiers are what you rearrange, and what is in a tier is
            a fact about it rather than something to drag out of it. */}
        <Flow.Node id="cdn" pinned position={{ x: 14, y: 34 }}>
          <GroupedNode icon={<ShareNodesIcon size={16} />} title="cdn" detail="142 locations" />
        </Flow.Node>
        <Flow.Node id="waf" pinned position={{ x: 14, y: 110 }}>
          <GroupedNode icon={<ShieldCheckIcon size={16} />} title="waf" detail="Blocking 0.4%" />
        </Flow.Node>
      </Flow.Group>

      <Flow.Group
        id="core-tier"
        label="Core"
        position={{ x: 0, y: 248 }}
        size={{ width: 196, height: 178 }}
      >
        <Flow.Node id="api" pinned position={{ x: 14, y: 282 }}>
          <GroupedNode icon={<SendIcon size={16} />} title="api" detail="p95 84ms" />
        </Flow.Node>
        {/* `confine` instead: this one you can move, but not out of its tier. */}
        <Flow.Node id="pg" confine position={{ x: 14, y: 358 }}>
          <GroupedNode icon={<PackageIcon size={16} />} title="postgres" detail="2 replicas" />
        </Flow.Node>
      </Flow.Group>

      {/* Container to container. An edge names a group the same way it names a
          node, and stands off the border rather than landing under it. */}
      <Flow.Edge from="edge-tier" to="core-tier" variant="smoothstep" animated arrow />

      <Flow.MiniMap />
      <Flow.Controls />
    </Flow>
  );
}

/* Signature */

/** The pad on its own, with the controls it usually travels with. */
function SignatureDemo({ guideline = false }: { guideline?: boolean }) {
  const pad = useRef<SignatureHandle>(null);
  const [count, setCount] = useState(0);

  return (
    <View className="w-full gap-3">
      <Signature
        ref={pad}
        guideline={guideline}
        guidelineLabel={guideline ? 'Sign above the line' : undefined}
        onChange={setCount}
      />
      <Signature.Toolbar>
        <View className="flex-row gap-2">
          <Signature.Undo disabled={count === 0} onPress={() => pad.current?.undo()} />
          <Signature.Clear disabled={count === 0} onPress={() => pad.current?.clear()} />
        </View>
        <Text size="xs" muted>
          {count === 0 ? 'Nothing signed yet' : `${count} strokes`}
        </Text>
      </Signature.Toolbar>
    </View>
  );
}

/** How far the frame lifts to make room for the confirm button. */
const SIGNING_LIFT = 28;

/**
 * The frame version: the pad comes up as a framed panel over a frosted screen,
 * which is where a signature is usually asked for — over the thing being
 * signed, not instead of it.
 *
 * The confirm button is not in the frame. Inside it, it is a third control
 * competing with redo and close for a strip of chrome, and it is disabled for
 * as long as the pad is empty — which is a button asking to be pressed and
 * refusing. Outside and absent until there is a stroke, it appears exactly when
 * it means something, and the frame lifts to acknowledge it.
 */
function SignatureSheetVersion() {
  const [open, setOpen] = useState(false);
  const [signed, setSigned] = useState(false);

  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      {signed ? (
        <Alert variant="success" className="w-full">
          <Alert.Indicator />
          <Text size="sm">Signed. The agreement is on its way.</Text>
        </Alert>
      ) : (
        <Text size="sm" muted className="text-center">
          A signature is asked for over the thing being signed, so the pad comes
          up over the screen rather than taking you to another one.
        </Text>
      )}
      <Button onPress={() => setOpen(true)}>
        {signed ? 'Sign again' : 'Sign the agreement'}
      </Button>

      {/* Mounted only while open, so the pad starts empty every time and the
          frame plays its entrance rather than being revealed already there. */}
      {open ? (
        <Portal>
          <SigningFrame
            onClose={() => setOpen(false)}
            onFinish={() => {
              setSigned(true);
              setOpen(false);
            }}
          />
        </Portal>
      ) : null}
    </View>
  );
}

/**
 * The frame itself, and the backdrop it sits over. One shape for one job, so
 * signing feels the same wherever it is asked for — `onFinish` is handed the
 * pad so a caller that wants the drawing back can take it before it goes.
 */
function SigningFrame({
  guideline = false,
  onClose,
  onFinish,
}: {
  guideline?: boolean;
  onClose: () => void;
  onFinish: (pad: SignatureHandle | null) => void;
}) {
  const pad = useRef<SignatureHandle>(null);
  const [count, setCount] = useState(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withSpring(count > 0 ? -SIGNING_LIFT : 0, {
      damping: 22,
      stiffness: 240,
      mass: 0.8,
    });
  }, [count, lift]);

  const rise = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));

  return (
    <View className="absolute inset-0 items-center justify-center px-6">
      {/* Scrim frosts the screen and takes no touches of its own, so the
          dismiss Pressable goes over it rather than around it. */}
      <Scrim blur />
      <Pressable
        accessibilityLabel="Close"
        className="absolute inset-0"
        onPress={onClose}
      />

      {/* The entry animation and the lift are on separate views on purpose.
          A layout animation owns the transform of the view it is applied to,
          so an animated `translateY` on the same view is fought over and
          Reanimated warns about it — the wrapper enters, the child lifts. */}
      <Animated.View
        entering={ZoomIn.springify().damping(18).stiffness(250).mass(0.6)}
        className="w-full"
      >
        <Animated.View style={rise}>
          {/* The dashed edge says the whole panel is the thing being filled in,
              the way a form field does. */}
          <Frame className="rounded-[28px] border-2 border-dashed">
            <Frame.Header>
              {/* Clear rather than undo: at the size a signature is drawn, a
                  stroke is rarely the unit you want back — you either keep the
                  signature or start it again. It dims once there is nothing to
                  wipe, which is also when the confirm button is gone. */}
              <Signature.Clear
                accessibilityLabel="Start over"
                className="bg-transparent"
                disabled={count === 0}
                onPress={() => pad.current?.clear()}
              />
              {/* Two equal-width round buttons on either side, so a flexible
                  centred title lands in the middle of the strip. */}
              <Frame.Title weight="semibold" className="flex-1 text-center text-foreground">
                Sign
              </Frame.Title>
              <SigningCloseButton onPress={onClose} />
            </Frame.Header>
            {/* The shell's radius less its 2px border. The panel is clipped to
                the shell's *outer* rounded rect, so without its own bottom
                radius its opaque corners paint straight over the dashed edge. */}
            <Frame.Panel className="rounded-b-[26px]">
              {/* `bg-background` rather than a literal white: on a dark theme a
                  hardcoded white pad puts light-grey placeholder text on white. */}
              <Signature
                ref={pad}
                size="lg"
                guideline={guideline}
                onChange={setCount}
                className="rounded-none border-0 bg-background"
              />
            </Frame.Panel>
          </Frame>
        </Animated.View>
      </Animated.View>

      {count > 0 ? (
        <Animated.View
          entering={FadeInDown.springify().damping(18).stiffness(220).mass(0.6)}
          exiting={FadeOutDown.duration(150)}
          className="absolute inset-x-6 bottom-16 items-center"
        >
          {/* The label goes through `children` as a string and the icon
              through `startContent`. Passing both as children skips the
              button's own label styling, and a `py-` on top of its fixed
              height pushes the text into the pill's corner radius. */}
          <Button
            size="lg"
            startContent={<PencilIcon size={18} />}
            className="rounded-full px-8"
            onPress={() => onFinish(pad.current)}
          >
            Finish Signature
          </Button>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The round X in the signing frame's header. */
function SigningCloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full bg-muted active:opacity-70"
    >
      <XIcon size={16} />
    </Pressable>
  );
}

/** An agreement you scroll, with the signature landing back in the document. */
function SignatureDocumentVersion() {
  const [open, setOpen] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="gap-4 px-5 pb-10 pt-2">
        <Text size="lg" weight="semibold">
          Services agreement
        </Text>
        {Array.from({ length: 6 }, (_, index) => (
          <Text key={index} size="sm" muted>
            {index + 1}. This clause exists so the agreement is long enough to
            scroll, which is the point of signing at the bottom of one rather
            than on a screen of its own.
          </Text>
        ))}

        <Frame className="mt-2">
          <Frame.Header>
            <Frame.Title>Signature</Frame.Title>
            <Frame.Action>{signature ? 'Signed' : 'Required'}</Frame.Action>
          </Frame.Header>
          <Frame.Panel>
            <Frame.Row onPress={() => setOpen(true)} chevron>
              <Frame.Media>
                <PencilIcon size={18} />
              </Frame.Media>
              <Frame.Content>
                <Frame.Title>
                  {signature ? 'Signed by Khalid Abdi' : 'Tap to sign'}
                </Frame.Title>
                <Frame.Description>
                  {signature
                    ? 'Captured as an SVG, stored with the agreement.'
                    : 'Your signature is captured as vector paths, not a photo.'}
                </Frame.Description>
              </Frame.Content>
            </Frame.Row>
          </Frame.Panel>
        </Frame>

        {signature ? (
          <Text size="xs" muted numberOfLines={3}>
            {signature.slice(0, 180)}…
          </Text>
        ) : null}
      </ScrollView>

      {/* The same signing frame as the standalone version — one shape for one
          job, so signing feels the same wherever it is asked for. */}
      {open ? (
        <Portal>
          <SigningFrame
            guideline
            onClose={() => setOpen(false)}
            onFinish={(signed) => {
              setSignature(signed?.toSVG() ?? null);
              setOpen(false);
            }}
          />
        </Portal>
      ) : null}
    </View>
  );
}

/** Saving to a file — the part that needs the optional packages. */
function SignatureExportVersion() {
  const pad = useRef<SignatureHandle>(null);
  const [count, setCount] = useState(0);
  const [format, setFormat] = useState('svg');
  const [result, setResult] = useState<string | null>(null);

  return (
    <View className="flex-1 gap-4 px-5 pt-2">
      <Signature ref={pad} size="lg" guideline onChange={setCount} />

      <ToggleButtonGroup
        selectionMode="single"
        value={[format]}
        onValueChange={(next) => setFormat(next[0] ?? 'svg')}
      >
        <ToggleButton id="svg">SVG</ToggleButton>
        <ToggleButton id="png">PNG</ToggleButton>
      </ToggleButtonGroup>

      <View className="flex-row gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={count === 0}
          onPress={() => pad.current?.clear()}
        >
          Clear
        </Button>
        <Button
          className="flex-1"
          disabled={count === 0}
          onPress={async () => {
            try {
              const file = await pad.current?.save({
                filename: 'agreement',
                format: format as 'svg' | 'png',
              });
              setResult(file ? `${file.uri} (${file.width}×${file.height})` : null);
            } catch (error) {
              // The optional packages report themselves by name, so showing the
              // message is more useful than a generic failure.
              setResult(error instanceof Error ? error.message : String(error));
            }
          }}
        >
          Save
        </Button>
      </View>

      {result ? (
        <Text size="xs" muted>
          {result}
        </Text>
      ) : (
        <Text size="xs" muted>
          Saving writes to the app&apos;s document directory. PNG needs the
          optional raster package; SVG needs nothing.
        </Text>
      )}
    </View>
  );
}

/** The whole screen is the pad — for a form that signs and nothing else. */
function SignatureFullScreenVersion() {
  const pad = useRef<SignatureHandle>(null);
  const [count, setCount] = useState(0);

  return (
    <View className="flex-1">
      <Signature
        ref={pad}
        size="full"
        guideline
        guidelineLabel="Khalid Abdi"
        onChange={setCount}
        placeholder={
          <Text size="sm" muted>
            Turn the device sideways and sign across the screen
          </Text>
        }
      />
      <View className="flex-row items-center justify-between gap-2 border-t border-border px-5 py-4">
        <Signature.Clear disabled={count === 0} onPress={() => pad.current?.clear()} />
        <Button disabled={count === 0} className="flex-1">
          Accept and continue
        </Button>
      </View>
    </View>
  );
}

/** Proof of delivery — the shape a courier app actually asks for. */
function SignatureDeliveryVersion() {
  const pad = useRef<SignatureHandle>(null);
  const [count, setCount] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <ScrollView contentContainerClassName="gap-4 px-5 pb-10 pt-2">
      <Frame>
        <Frame.Header>
          <Frame.Title>Delivery 4821</Frame.Title>
          <Frame.Action>
            <Badge variant="secondary">2 parcels</Badge>
          </Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <Frame.Row>
            <Frame.Media>
              <PackageIcon size={18} />
            </Frame.Media>
            <Frame.Content>
              <Frame.Title>Khalid Abdi</Frame.Title>
              <Frame.Description>
                14 Cadogan Street · Handed to the recipient
              </Frame.Description>
            </Frame.Content>
          </Frame.Row>
          <Frame.Row>
            <Frame.Content>
              <Frame.Title>Received at</Frame.Title>
            </Frame.Content>
            <Frame.Actions>
              <Text size="sm" muted>
                14:32
              </Text>
            </Frame.Actions>
          </Frame.Row>
        </Frame.Panel>
      </Frame>

      <Text size="sm" muted>
        Recipient signature
      </Text>
      <Signature ref={pad} guideline onChange={setCount} />

      <View className="flex-row gap-2">
        <Signature.Clear disabled={count === 0} onPress={() => pad.current?.clear()} />
        <Button
          className="flex-1"
          disabled={count === 0 || confirmed}
          onPress={() => setConfirmed(true)}
        >
          {confirmed ? 'Confirmed' : 'Confirm delivery'}
        </Button>
      </View>

      {confirmed ? (
        <Alert variant="success">
          <Alert.Indicator />
          <Text size="sm">Delivery confirmed and the signature attached.</Text>
        </Alert>
      ) : null}
    </ScrollView>
  );
}

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'recent', label: 'Newest first' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
];

const BRANDS = [
  { id: 'aurora', name: 'Aurora', count: 128 },
  { id: 'basin', name: 'Basin', count: 94 },
  { id: 'cadence', name: 'Cadence', count: 61 },
  { id: 'dovetail', name: 'Dovetail', count: 47 },
  { id: 'ember', name: 'Ember', count: 33 },
  { id: 'fathom', name: 'Fathom', count: 21 },
];

/**
 * A full-height sheet, which is a shape rather than just a size: a heading
 * that stays put, a body that scrolls under it, and the action pinned where
 * it can always be reached. Filters are the honest example — there is more of
 * them than fits, and the thing you came to press is the last thing you want
 * to have to scroll to.
 */
function FullHeightSheetDemo() {
  const [sort, setSort] = useState('relevance');
  const [budget, setBudget] = useState(240);
  const [inStock, setInStock] = useState(true);
  const [freeReturns, setFreeReturns] = useState(false);
  const [brands, setBrands] = useState<string[]>(['aurora']);

  const toggleBrand = (id: string) =>
    setBrands((was) =>
      was.includes(id) ? was.filter((b) => b !== id) : [...was, id]
    );

  const active = brands.length + (inStock ? 1 : 0) + (freeReturns ? 1 : 0);

  return (
    <BottomSheet>
      <BottomSheet.Trigger>
        <Button variant="outline">Open filters</Button>
      </BottomSheet.Trigger>

      <BottomSheet.Content size="full">
        <BottomSheet.Header
          title="Filters"
          description={`${active} applied · 384 results`}
        />

        <BottomSheet.Body contentContainerClassName="gap-6 pb-6">
          <View className="gap-2">
            <Label>Sort by</Label>
            <RadioGroup value={sort} onValueChange={setSort}>
              {SORT_OPTIONS.map((option) => (
                <RadioGroup.Item
                  key={option.value}
                  value={option.value}
                  label={option.label}
                />
              ))}
            </RadioGroup>
          </View>

          <Separator />

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Label>Budget</Label>
              <Text size="sm" muted>
                Up to ${budget}
              </Text>
            </View>
            <Slider
              value={budget}
              onValueChange={setBudget}
              min={20}
              max={500}
              step={10}
            />
          </View>

          <Separator />

          <View className="gap-2">
            <Label>Brand</Label>
            {BRANDS.map((brand) => (
              <Item key={brand.id} onPress={() => toggleBrand(brand.id)}>
                <Item.Content>
                  <Item.Title>{brand.name}</Item.Title>
                  <Item.Description>{brand.count} items</Item.Description>
                </Item.Content>
                <Item.Actions>
                  <Checkbox checked={brands.includes(brand.id)} />
                </Item.Actions>
              </Item>
            ))}
          </View>

          <Separator />

          <View className="gap-2">
            <Label>Availability</Label>
            <Item>
              <Item.Content>
                <Item.Title>In stock only</Item.Title>
                <Item.Description>Hide anything on backorder</Item.Description>
              </Item.Content>
              <Item.Actions>
                <Switch value={inStock} onValueChange={setInStock} />
              </Item.Actions>
            </Item>
            <Item>
              <Item.Content>
                <Item.Title>Free returns</Item.Title>
                <Item.Description>Within 30 days of delivery</Item.Description>
              </Item.Content>
              <Item.Actions>
                <Switch value={freeReturns} onValueChange={setFreeReturns} />
              </Item.Actions>
            </Item>
          </View>
        </BottomSheet.Body>

        <BottomSheet.Footer className="flex-row">
          <Button
            variant="outline"
            className="flex-1"
            onPress={() => {
              setSort('relevance');
              setBudget(240);
              setInStock(true);
              setFreeReturns(false);
              setBrands([]);
            }}
          >
            Reset
          </Button>
          <Button className="flex-[2]">Show 384 results</Button>
        </BottomSheet.Footer>
      </BottomSheet.Content>
    </BottomSheet>
  );
}

/** Inputs inside a sheet, lifted clear of the keyboard. */
function FormSheetDemo() {
  const keyboard = useAnimatedKeyboard();
  const style = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));

  return (
    <BottomSheet>
      <BottomSheet.Trigger>
        <Button variant="outline">Open form</Button>
      </BottomSheet.Trigger>
      <BottomSheet.Content>
        <Animated.View style={style}>
          <Text size="lg" weight="semibold" className="mb-1">
            Invite a teammate
          </Text>
          <Text size="sm" muted className="mb-4">
            They will get an email with a join link.
          </Text>
          <View className="gap-3 pb-2">
            <Input label="Email" placeholder="teammate@example.com" />
            <Input label="Message" placeholder="Optional note" />
            <Button fullWidth>Send invite</Button>
          </View>
        </Animated.View>
      </BottomSheet.Content>
    </BottomSheet>
  );
}

/** A long list inside a sheet, scrolling independently of the drag gesture. */
function ScrollableSheetDemo() {
  return (
    <BottomSheet>
      <BottomSheet.Trigger>
        <Button variant="outline">Open list</Button>
      </BottomSheet.Trigger>
      <BottomSheet.Content style={{ maxHeight: 420 }}>
        {/* The heading names the behaviour, not just the task. Every version
            of this sheet looks much the same from the outside, so a sheet that
            only said "Choose a country" left nothing on screen to say which
            one you had opened. */}
        <BottomSheet.Header
          title="Choose a country"
          description="The list scrolls under the fixed heading. The sheet itself still drags."
        />
        <BottomSheet.Body contentContainerClassName="pb-4">
          {COUNTRIES.map((country, index) => (
            <View
              key={country}
              className={
                index > 0
                  ? 'flex-row items-center border-t border-border py-3.5'
                  : 'flex-row items-center py-3.5'
              }
            >
              <Text className="flex-1">{country}</Text>
              <ChevronRightIcon size={16} />
            </View>
          ))}
        </BottomSheet.Body>
      </BottomSheet.Content>
    </BottomSheet>
  );
}

const COUNTRIES = [
  'Somalia', 'Kenya', 'Ethiopia', 'Djibouti', 'Uganda', 'Tanzania',
  'Rwanda', 'Egypt', 'Morocco', 'Nigeria', 'Ghana', 'South Africa',
];

function CheckboxCardDemo() {
  const [picked, setPicked] = useState<string[]>(['pro']);
  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );

  return (
    <View className="w-full gap-3">
      {[
        ['starter', 'Starter', 'Everything you need to begin.'],
        ['pro', 'Pro', 'Advanced analytics and priority support.'],
        ['team', 'Team', 'Shared workspaces and audit logs.'],
      ].map(([id, label, description]) => (
        <Checkbox
          key={id}
          variant="card"
          checked={picked.includes(id!)}
          onCheckedChange={() => toggle(id!)}
          label={label}
          description={description}
        />
      ))}
    </View>
  );
}

function RadioGroupDemo() {
  const [plan, setPlan] = useState('pro');

  return (
    <RadioGroup value={plan} onValueChange={setPlan} className="w-full">
      <RadioGroup.Item value="free" label="Free — $0/month" />
      <RadioGroup.Item value="pro" label="Pro — $12/month" />
      <RadioGroup.Item value="team" label="Team — $36/month" />
    </RadioGroup>
  );
}

function RadioGroupRowDemo() {
  const [size, setSize] = useState('m');
  const [billing, setBilling] = useState('monthly');

  return (
    <View className="w-full gap-6">
      <View className="gap-2">
        <Label>Size</Label>
        {/* Short labels stacked one per line read as a longer list than they
            are. A wrapping row uses the width the choices actually need. */}
        <RadioGroup
          orientation="horizontal"
          value={size}
          onValueChange={setSize}
          className="w-full"
        >
          <RadioGroup.Item value="s" label="Small" />
          <RadioGroup.Item value="m" label="Medium" />
          <RadioGroup.Item value="l" label="Large" />
          <RadioGroup.Item value="xl" label="X-Large" />
        </RadioGroup>
      </View>

      <View className="gap-2">
        <Label>Billing</Label>
        {/* Cards share the row rather than filling it. */}
        <RadioGroup
          orientation="horizontal"
          variant="card"
          value={billing}
          onValueChange={setBilling}
          className="w-full"
        >
          <RadioGroup.Item value="monthly" label="Monthly" description="$12/mo" />
          <RadioGroup.Item value="yearly" label="Yearly" description="$120/yr" />
        </RadioGroup>
      </View>
    </View>
  );
}

function RadioGroupCardDemo() {
  const [plan, setPlan] = useState('pro');

  return (
    <RadioGroup value={plan} onValueChange={setPlan} variant="card" className="w-full">
      <RadioGroup.Item
        value="starter"
        label="Starter"
        description="For a side project — one seat, community support."
      />
      <RadioGroup.Item
        value="pro"
        label="Pro"
        description="For growing teams — five seats, priority support."
      />
      <RadioGroup.Item
        value="max"
        label="Max"
        description="Everything, uncapped — unlimited seats and SSO."
      />
    </RadioGroup>
  );
}

/** Enough of a list that typing beats scrolling, and short enough to read. */
const FRAMEWORKS = [
  { value: 'expo', label: 'Expo' },
  { value: 'react-native', label: 'React Native' },
  { value: 'next', label: 'Next.js' },
  { value: 'remix', label: 'Remix' },
  { value: 'astro', label: 'Astro' },
  { value: 'nuxt', label: 'Nuxt' },
  { value: 'svelte-kit', label: 'SvelteKit' },
  { value: 'solid-start', label: 'SolidStart' },
  { value: 'qwik', label: 'Qwik City' },
];

function ComboboxDemo() {
  const [framework, setFramework] = useState<string>();

  return (
    <View className="w-full gap-1.5">
      <Label>Framework</Label>
      <Combobox
        value={framework}
        onValueChange={setFramework}
        placeholder="Search frameworks"
        clearable
      >
        {FRAMEWORKS.map((item) => (
          <Combobox.Item key={item.value} value={item.value} label={item.label} />
        ))}
      </Combobox>
    </View>
  );
}

/** Headings make a long list scannable before the query narrows it. */
function ComboboxGroupedDemo() {
  const [framework, setFramework] = useState<string>();

  return (
    <View className="w-full gap-1.5">
      <Label>Framework</Label>
      <Combobox
        value={framework}
        onValueChange={setFramework}
        placeholder="Search frameworks"
        openOnFocus
      >
        <Combobox.Group label="Native">
          <Combobox.Item value="expo" label="Expo" />
          <Combobox.Item value="react-native" label="React Native" />
        </Combobox.Group>
        <Combobox.Group label="Web">
          <Combobox.Item value="next" label="Next.js" />
          <Combobox.Item value="remix" label="Remix" />
          <Combobox.Item value="astro" label="Astro" />
        </Combobox.Group>
      </Combobox>
    </View>
  );
}

function ComboboxMultipleDemo() {
  const [picked, setPicked] = useState<string[]>(['expo']);

  return (
    <View className="w-full gap-1.5">
      <Label>Stack</Label>
      <Combobox
        mode="multiple"
        value={picked}
        onValueChange={setPicked}
        placeholder="Add a framework"
        clearable
      >
        {FRAMEWORKS.map((item) => (
          <Combobox.Item key={item.value} value={item.value} label={item.label} />
        ))}
      </Combobox>
      <Text size="sm" muted>
        Each pick becomes a chip. Backspace on the empty field takes the last one
        back.
      </Text>
    </View>
  );
}

/** A tag field: the list suggests, it does not decide. */
function ComboboxTagsDemo() {
  const [tags, setTags] = useState<string[]>(['design']);

  return (
    <View className="w-full gap-1.5">
      <Label>Tags</Label>
      <Combobox
        mode="multiple"
        value={tags}
        onValueChange={setTags}
        allowCustomValue
        placeholder="Add a tag"
        emptyMessage="No tag by that name yet"
      >
        <Combobox.Item value="design" label="design" />
        <Combobox.Item value="engineering" label="engineering" />
        <Combobox.Item value="research" label="research" />
      </Combobox>
      <Text size="sm" muted>
        Type something that is not on the list and press return to keep it.
      </Text>
    </View>
  );
}

/**
 * Options fetched for the query. `filter={false}` because the matching already
 * happened somewhere else — filtering again here would only drop correct
 * answers the field cannot see the reasoning behind.
 */
function ComboboxAsyncDemo() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState<string>();

  useEffect(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    // Stands in for a request. The timer is cleared on the next keystroke, so
    // a fast typist makes one "call" rather than one per character.
    const timer = setTimeout(() => {
      setResults(
        TIMEZONES.filter((tz) => tz.label.toLowerCase().includes(needle)).slice(0, 6)
      );
      setLoading(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <View className="w-full gap-1.5">
      <Label>City</Label>
      <Combobox
        value={city}
        onValueChange={setCity}
        inputValue={query}
        onInputValueChange={setQuery}
        filter={false}
        loading={loading}
        loadingMessage="Looking up cities"
        emptyMessage="No city by that name"
        placeholder="Search cities"
        clearable
      >
        {results.map((item) => (
          <Combobox.Item key={item.value} value={item.value} label={item.label} />
        ))}
      </Combobox>
    </View>
  );
}

function ComboboxInlineDemo() {
  const [framework, setFramework] = useState<string>();

  return (
    <View className="w-full gap-4">
      <View className="w-full gap-1.5">
        <Label>Framework</Label>
        <Combobox
          presentation="inline"
          value={framework}
          onValueChange={setFramework}
          placeholder="Search frameworks"
        >
          {FRAMEWORKS.map((item) => (
            <Combobox.Item key={item.value} value={item.value} label={item.label} />
          ))}
        </Combobox>
      </View>
      <Text size="sm" muted>
        The list expands in layout flow, so this paragraph is pushed down by its
        height instead of being covered by it.
      </Text>
    </View>
  );
}

function SelectDemo() {
  const [fruit, setFruit] = useState<string>();

  return (
    <View className="w-full gap-1.5">
      <Label>Favorite fruit</Label>
      <Select
        value={fruit}
        onValueChange={setFruit}
        placeholder="Select a fruit"
        title="Favorite fruit"
      >
        <Select.Item value="apple" label="Apple" />
        <Select.Item value="banana" label="Banana" />
        <Select.Item value="cherry" label="Cherry" />
        <Select.Item value="mango" label="Mango" />
      </Select>
    </View>
  );
}

/** Long enough that scrolling it is not a way of finding anything. */
const TIMEZONES = [
  { value: 'utc', label: 'UTC' },
  { value: 'europe/london', label: 'London' },
  { value: 'europe/paris', label: 'Paris' },
  { value: 'europe/berlin', label: 'Berlin' },
  { value: 'europe/madrid', label: 'Madrid' },
  { value: 'europe/istanbul', label: 'Istanbul' },
  { value: 'africa/cairo', label: 'Cairo' },
  { value: 'africa/lagos', label: 'Lagos' },
  { value: 'africa/nairobi', label: 'Nairobi' },
  { value: 'asia/dubai', label: 'Dubai' },
  { value: 'asia/karachi', label: 'Karachi' },
  { value: 'asia/kolkata', label: 'Kolkata' },
  { value: 'asia/singapore', label: 'Singapore' },
  { value: 'asia/tokyo', label: 'Tokyo' },
  { value: 'australia/sydney', label: 'Sydney' },
  { value: 'america/sao_paulo', label: 'São Paulo' },
  { value: 'america/new_york', label: 'New York' },
  { value: 'america/chicago', label: 'Chicago' },
  { value: 'america/denver', label: 'Denver' },
  { value: 'america/los_angeles', label: 'Los Angeles' },
];

function SearchableSelectDemo({
  presentation = 'sheet',
}: {
  presentation?: 'sheet' | 'inline' | 'overlay';
}) {
  const [zone, setZone] = useState<string>();

  return (
    <View className="w-full gap-1.5">
      <Label>Time zone</Label>
      <Select
        searchable
        searchPlaceholder="Search cities"
        emptyMessage="No city by that name"
        presentation={presentation}
        value={zone}
        onValueChange={setZone}
        placeholder="Select a time zone"
        title="Time zone"
      >
        {TIMEZONES.map((tz) => (
          <Select.Item key={tz.value} value={tz.value} label={tz.label} />
        ))}
      </Select>
    </View>
  );
}

function DisabledOptionSelectDemo() {
  const [plan, setPlan] = useState<string>('starter');

  return (
    <View className="w-full gap-1.5">
      <Label>Plan</Label>
      <Select value={plan} onValueChange={setPlan} title="Plan">
        <Select.Item value="starter" label="Starter" />
        <Select.Item value="team" label="Team" />
        {/* Still listed, because an option that disappears reads as one that
            was never offered. */}
        <Select.Item value="enterprise" label="Enterprise — contact sales" disabled />
      </Select>
    </View>
  );
}

/**
 * Grouping is presentational — the value is still one flat string — and the
 * filter reaches through it, dropping any group the query empties rather than
 * leaving a heading standing over nothing.
 */
function GroupedSelectDemo() {
  const [zone, setZone] = useState<string>();

  return (
    <View className="w-full gap-1.5">
      <Label>Time zone</Label>
      <Select
        searchable
        searchPlaceholder="Search cities"
        emptyMessage="No city by that name"
        value={zone}
        onValueChange={setZone}
        placeholder="Select a time zone"
        title="Time zone"
      >
        <Select.Group label="Europe">
          <Select.Item value="europe/london" label="London" />
          <Select.Item value="europe/paris" label="Paris" />
          <Select.Item value="europe/berlin" label="Berlin" />
        </Select.Group>
        <Select.Group label="Asia">
          <Select.Item value="asia/dubai" label="Dubai" />
          <Select.Item value="asia/tokyo" label="Tokyo" />
          <Select.Item value="asia/singapore" label="Singapore" />
        </Select.Group>
        <Select.Group label="Americas">
          <Select.Item value="america/new_york" label="New York" />
          <Select.Item value="america/los_angeles" label="Los Angeles" />
        </Select.Group>
      </Select>
    </View>
  );
}

/**
 * Wraps a native-mode demo with a note about what is actually on screen —
 * without @expo/ui installed the `native` prop is a silent no-op, which is
 * otherwise indistinguishable from it not working.
 */
function NativeDemo({ children }: { children: ReactNode }) {
  return (
    <View className="w-full gap-5">
      <Alert variant={hasNativeUI() ? 'info' : 'warning'}>
        <Alert.Content>
          <Alert.Title>
            {hasNativeUI()
              ? 'Rendering the platform control'
              : '@expo/ui not available'}
          </Alert.Title>
          <Alert.Description>
            {hasNativeUI()
              ? 'Theme tokens do not apply here — the platform draws this.'
              : 'The `native` prop is a no-op, so the styled component renders instead.'}
          </Alert.Description>
        </Alert.Content>
      </Alert>
      {/* A rule between the note and the control, so a platform button
          sitting right under the alert does not read as part of it. */}
      <Separator />
      <View className="w-full gap-4">{children}</View>
    </View>
  );
}

/**
 * `glass` is the one native look with a floor under it: the material only
 * exists from iOS 26, so on anything earlier the modifier is inert and the
 * button keeps its ordinary platform style. That is indistinguishable from the
 * prop not working, which is exactly the confusion this demo exists to end —
 * it puts a glass button next to its non-glass twin, so "no glass" and "no
 * difference" are the same observation and both point at the OS.
 */
function GlassButtonDemo() {
  return (
    <NativeDemo>
      <View className="w-full gap-2">
        <Text size="sm" muted>
          Glass — needs iOS 26
        </Text>
        <View className="w-full flex-row items-center gap-3">
          <Button native glass onPress={() => {}}>
            Prominent
          </Button>
          <Button native glass variant="ghost" onPress={() => {}}>
            Plain
          </Button>
          <Button native glass size="icon" variant="ghost" onPress={() => {}}>
            <SearchIcon size={18} />
          </Button>
        </View>
      </View>

      <View className="w-full gap-2">
        <Text size="sm" muted>
          The same buttons without it
        </Text>
        <View className="w-full flex-row items-center gap-3">
          <Button native onPress={() => {}}>
            Prominent
          </Button>
          <Button native variant="ghost" onPress={() => {}}>
            Plain
          </Button>
          <Button native size="icon" variant="ghost" onPress={() => {}}>
            <SearchIcon size={18} />
          </Button>
        </View>
      </View>
    </NativeDemo>
  );
}

function NativeSliderDemo() {
  const [level, setLevel] = useState(40);

  return (
    <NativeDemo>
      <Slider
        native
        label="Brightness"
        showValue
        formatValue={(v) => `${Math.round(v)}%`}
        value={level}
        onValueChange={setLevel}
      />
      {/* The caption row is ours either way — only the control below it is
          handed to the platform. */}
      <Slider
        label="For comparison, the styled one"
        showValue
        formatValue={(v) => `${Math.round(v)}%`}
        value={level}
        onValueChange={setLevel}
      />
    </NativeDemo>
  );
}

function NativeWheelPickerDemo() {
  const [size, setSize] = useState('m');

  return (
    <NativeDemo>
      {/* `wheel` is the always-visible rotor on iOS; elsewhere it falls back
          to the compact menu. */}
      <Select native nativeAppearance="wheel" value={size} onValueChange={setSize}>
        <Select.Item value="s" label="Small" />
        <Select.Item value="m" label="Medium" />
        <Select.Item value="l" label="Large" />
        <Select.Item value="xl" label="X-Large" />
      </Select>
      <Text size="sm" muted>
        Selected: {size}
      </Text>
    </NativeDemo>
  );
}

function NativeSwitchDemo() {
  const [enabled, setEnabled] = useState(true);

  return (
    <NativeDemo>
      <Switch
        native
        label="Notifications"
        value={enabled}
        onValueChange={setEnabled}
      />
    </NativeDemo>
  );
}

function NativeSelectDemo() {
  const [fruit, setFruit] = useState('apple');

  return (
    <NativeDemo>
      <Select native value={fruit} onValueChange={setFruit}>
        <Select.Item value="apple" label="Apple" />
        <Select.Item value="banana" label="Banana" />
        <Select.Item value="cherry" label="Cherry" />
      </Select>
      <Text size="sm" muted>
        Selected: {fruit}
      </Text>
    </NativeDemo>
  );
}

function NativeBottomSheetDemo() {
  const [open, setOpen] = useState(false);

  return (
    <NativeDemo>
      <BottomSheet native snapPoints={['half']} open={open} onOpenChange={setOpen}>
        <BottomSheet.Trigger>
          <Button variant="outline" fullWidth>
            Open the platform sheet
          </Button>
        </BottomSheet.Trigger>
        <BottomSheet.Content className="gap-3">
          <Text size="lg" weight="semibold">
            Platform chrome, your content
          </Text>
          <Text size="sm" muted>
            The container, corner radius, grabber and dismiss gesture belong to
            the platform. Everything in here is still themed — and it starts at
            the top of the sheet rather than floating in the middle of it.
          </Text>
          <Item.Group className="mt-1">
            <Item size="sm">
              <Item.Content>
                <Item.Title>Detent</Item.Title>
                <Item.Description>Half height, set by snapPoints.</Item.Description>
              </Item.Content>
            </Item>
            <Item.Separator />
            <Item size="sm">
              <Item.Content>
                <Item.Title>Dismiss</Item.Title>
                <Item.Description>Swipe down, or the button below.</Item.Description>
              </Item.Content>
            </Item>
          </Item.Group>
          <Button fullWidth onPress={() => setOpen(false)}>
            Close
          </Button>
        </BottomSheet.Content>
      </BottomSheet>
    </NativeDemo>
  );
}

function RegionSelectDemo({
  presentation,
  contentWidth,
}: {
  presentation?: 'sheet' | 'inline' | 'overlay';
  contentWidth?: 'trigger' | 'content' | number;
}) {
  const [region, setRegion] = useState<string>();

  return (
    <View className="w-full gap-1.5">
      <Label>Region</Label>
      <Select
        value={region}
        onValueChange={setRegion}
        placeholder="Select a region"
        presentation={presentation}
        contentWidth={contentWidth}
      >
        <Select.Item value="us" label="United States" />
        <Select.Item value="eu" label="Europe" />
        <Select.Item value="apac" label="Asia Pacific" />
      </Select>
    </View>
  );
}

function LoadingButtonDemo() {
  const [saving, setSaving] = useState(false);

  return (
    <Button
      fullWidth
      loading={saving}
      onPress={() => {
        setSaving(true);
        setTimeout(() => setSaving(false), 1800);
      }}
    >
      {saving ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

function ProgressDemo() {
  const [uploaded, setUploaded] = useState(20);

  useEffect(() => {
    const id = setInterval(() => {
      setUploaded((current) => (current >= 100 ? 0 : current + 20));
    }, 1200);
    return () => clearInterval(id);
  }, []);

  return (
    <View className="w-full gap-4">
      <Progress value={uploaded} label="Uploading" showValueLabel />
      <Progress value={uploaded} color="success" size="sm" />
      <Progress value={70} color="warning" size="lg" />
      <Progress indeterminate color="info" />
    </View>
  );
}

function SliderDemo() {
  const [volume, setVolume] = useState(40);

  return (
    <View className="w-full gap-6">
      {/* `label` + `showValue` draw the caption row, so a controlled slider
          does not have to hand-build one to display what it is set to. */}
      <Slider
        label="Volume"
        showValue
        formatValue={(v) => `${Math.round(v)}%`}
        value={volume}
        onValueChange={setVolume}
      />
      <Slider defaultValue={70} color="success" size="sm" />
      <Slider defaultValue={5} min={0} max={10} step={1} color="warning" size="lg" />
      <Slider label="Locked" showValue defaultValue={30} disabled />
    </View>
  );
}

function RangeSliderDemo() {
  const [price, setPrice] = useState<[number, number]>([220, 680]);

  return (
    <View className="w-full gap-6">
      {/* Controlled through `range` + `onRangeChange`. The single-value props
          are untouched, so nothing here has to narrow a union to read a
          number. */}
      <Slider
        label="Price"
        showValue
        formatValue={(v) => `$${Math.round(v)}`}
        range={price}
        onRangeChange={setPrice}
        min={0}
        max={1000}
        step={20}
        color="success"
      />
      {/* `minStepsBetweenThumbs` keeps a gap the span can never close, which is
          what a filter wants: an empty range matches nothing and looks like a
          bug rather than a choice. */}
      <Slider
        label="Nights"
        showValue
        defaultRange={[2, 6]}
        min={1}
        max={14}
        step={1}
        minStepsBetweenThumbs={1}
      />
      <Slider label="Locked" showValue defaultRange={[30, 60]} disabled />
    </View>
  );
}

function ColorPickerDemo() {
  const [color, setColor] = useState('#22c55e');

  return (
    <View className="w-full gap-4">
      <ColorPicker value={color} onValueChange={setColor}>
        <ColorPicker.Area />
        <ColorPicker.Hue />
        <ColorPicker.Preview showValue />
      </ColorPicker>
      {/* The picked colour, applied to something — a swatch on its own says
          nothing about whether the value is usable. */}
      <Button className="w-full" style={{ backgroundColor: color }}>
        Save theme
      </Button>
    </View>
  );
}

function ColorPickerCardVersion() {
  const [color, setColor] = useState('#3b82f6');

  return (
    <View className="w-full gap-3 p-4">
      {/* The strip names what is being picked and prints what it currently is;
          the readout under the square names the track below it. Together they
          turn a set of controls into a labelled panel. */}
      <ColorPicker value={color} onValueChange={setColor}>
        <ColorPicker.Field label="Accent" />
        <Surface variant="secondary" padding="sm" className="gap-3 rounded-2xl">
          <ColorPicker.Area height={280} />
          <ColorPicker.Channel channel="hue" />
          <ColorPicker.Hue />
        </Surface>
      </ColorPicker>
    </View>
  );
}

function ColorPickerWheelVersion() {
  const [color, setColor] = useState('#f97316');

  return (
    <View className="w-full gap-4 p-4">
      {/* Hue runs around and saturation runs out, so brightness has nowhere
          left to go on the disc and takes a track of its own. */}
      <ColorPicker value={color} onValueChange={setColor}>
        <ColorPicker.Field label="Brand" />
        <View className="py-2">
          <ColorPicker.Wheel />
        </View>
        <ColorPicker.Channel channel="brightness" />
        <ColorPicker.Brightness />
        <ColorPicker.Channel channel="alpha" />
        <ColorPicker.Alpha />
      </ColorPicker>
    </View>
  );
}

function ColorPickerAlphaDemo() {
  const [color, setColor] = useState('rgba(59, 130, 246, 0.6)');

  return (
    <View className="w-full gap-4">
      <ColorPicker value={color} onValueChange={setColor} format="rgb">
        <ColorPicker.Area height={150} />
        <ColorPicker.Hue />
        <ColorPicker.Alpha />
        <ColorPicker.Preview showValue />
      </ColorPicker>
      <Card className="w-full">
        <Card.Content className="gap-2 p-4">
          <Text size="sm" muted>
            Overlay
          </Text>
          <View className="h-16 w-full rounded-lg" style={{ backgroundColor: color }} />
        </Card.Content>
      </Card>
    </View>
  );
}

function ColorPickerSwatchesDemo() {
  const [color, setColor] = useState('#f97316');

  return (
    <ColorPicker value={color} onValueCommit={setColor} size="sm">
      <ColorPicker.Swatches
        colors={[
          '#ef4444',
          '#f97316',
          '#eab308',
          '#22c55e',
          '#06b6d4',
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
          '#0f172a',
        ]}
      />
      <ColorPicker.Area height={120} />
      <ColorPicker.Hue />
      <ColorPicker.Preview showValue />
    </ColorPicker>
  );
}

function RatingDemo() {
  const [score, setScore] = useState(3);

  return (
    <View className="w-full gap-6">
      {/* Controlled, with the caption row showing what the taps have set. */}
      <Rating
        label="Rate your stay"
        showValue
        formatValue={(v) => `${v} / 5`}
        value={score}
        onValueChange={setScore}
      />
      {/* precision={0.5} lets the left half of a star mean a half. */}
      <Rating precision={0.5} defaultValue={2.5} color="primary" />
      {/* A read-only average renders any fraction at full precision. */}
      <Rating value={4.3} precision={0.5} readOnly size="sm" />
    </View>
  );
}

/**
 * Drag across the row to feel it: a tick fires each time the drag crosses onto
 * a new star, so the value can be set without watching the stars. Paired with
 * `allowClear`, which makes a second tap on the current value reset it to zero.
 */
function RatingHapticsDemo() {
  const [score, setScore] = useState(4);

  return (
    <View className="w-full gap-6">
      <Rating
        label="Drag across the stars"
        showValue
        haptics
        allowClear
        value={score}
        onValueChange={setScore}
      />
      {/* Half steps still tick once per whole star, so the feedback stays
          countable rather than firing twice as often. */}
      <Rating
        label="Half stars, same ticks"
        showValue
        haptics
        precision={0.5}
        defaultValue={2.5}
        color="primary"
      />
    </View>
  );
}

const RAIL_SECTIONS = [
  { id: 'intro', label: 'Introduction', level: 0 },
  { id: 'install', label: 'Installation', level: 0 },
  { id: 'expo', label: 'Expo', level: 1 },
  { id: 'bare', label: 'Bare React Native', level: 1 },
  { id: 'theming', label: 'Theming', level: 0 },
  { id: 'tokens', label: 'Design tokens', level: 1 },
  { id: 'dark', label: 'Dark mode', level: 1 },
  { id: 'faq', label: 'Frequently asked', level: 0 },
];

/** Shared body for the scrolling rail demos — only the rail's corner differs. */
function SectionRailVersion({
  placement = 'right',
  align = 'center',
  haptics,
}: {
  placement?: 'left' | 'right';
  align?: 'center' | 'top' | 'bottom';
  haptics?: boolean;
}) {
  // The hook owns the offsets, the reading line and the scroll-back — and the
  // end case, where the last section's top never reaches the reading line
  // because the page runs out first.
  const sections = useScrollSections({
    ids: RAIL_SECTIONS.map((section) => section.id),
  });

  return (
    <View className="flex-1">
      <ScrollView
        ref={sections.ref}
        {...sections.scrollProps}
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        {RAIL_SECTIONS.map((section) => (
          <View
            key={section.id}
            onLayout={sections.measure(section.id)}
            className="gap-3 px-6 py-10"
          >
            <Text size={section.level ? 'lg' : '2xl'} weight="semibold">
              {section.label}
            </Text>
            <Text size="sm" muted>
              Scroll and the bar for this section widens and brightens. Touch
              the rail to open the list and jump anywhere.
            </Text>
            <Skeleton className="h-24 w-full rounded-xl" />
          </View>
        ))}
      </ScrollView>

      <SectionRail
        placement={placement}
        align={align}
        haptics={haptics}
        value={sections.active}
        onValueChange={sections.scrollTo}
      >
        <SectionRail.Trigger>
          {RAIL_SECTIONS.map((section) => (
            <SectionRail.Bar key={section.id} value={section.id} level={section.level} />
          ))}
        </SectionRail.Trigger>
        <SectionRail.Content>
          {RAIL_SECTIONS.map((section) => (
            <SectionRail.Item key={section.id} value={section.id} level={section.level}>
              {section.label}
            </SectionRail.Item>
          ))}
        </SectionRail.Content>
      </SectionRail>
    </View>
  );
}

const PAGER_SECTIONS = [
  { id: 'welcome', label: 'Welcome', body: 'Swipe up to move through the deck.' },
  { id: 'tokens', label: 'Tokens', body: 'Every colour and radius comes from the theme.' },
  { id: 'motion', label: 'Motion', body: 'Animations run on the UI thread, never on JS.' },
  { id: 'native', label: 'Native', body: 'Some controls hand off to the platform entirely.' },
  { id: 'ship', label: 'Ship it', body: 'No native modules, so it runs in Expo Go.' },
];

/**
 * One section per screen. A pager needs no reading line — the active page is
 * the scroll offset over the viewport height — so this drives the rail
 * directly rather than through useScrollSections.
 */
function SectionRailPagerVersion() {
  const [page, setPage] = useState(0);
  const scroller = useRef<ScrollView>(null);

  /*
   * The page height is the scroll view's own, measured — not the window's.
   * Anything above the pager (a header, a caption) makes the viewport shorter
   * than the screen, and window-height pages then sit a little further out of
   * alignment with each snap position than the last, until one of them lands
   * entirely between two and never shows.
   */
  const [pageHeight, setPageHeight] = useState(0);

  return (
    <View className="flex-1">
      <ScrollView
        ref={scroller}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
        onScroll={(event) => {
          const { contentOffset, layoutMeasurement } = event.nativeEvent;
          if (!layoutMeasurement.height) return;
          const next = Math.round(contentOffset.y / layoutMeasurement.height);
          if (next !== page) setPage(next);
        }}
      >
        {PAGER_SECTIONS.map((section, index) => (
          <View
            key={section.id}
            // Nothing to lay out until the viewport has been measured; a page
            // of the wrong height would scroll to the wrong place first.
            style={{ height: pageHeight || undefined }}
            className="justify-center gap-4 px-8"
          >
            <Text size="sm" muted>
              {index + 1} of {PAGER_SECTIONS.length}
            </Text>
            <Text size="3xl" weight="semibold">
              {section.label}
            </Text>
            <Text size="base" muted>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <SectionRail
        placement="left"
        align="bottom"
        haptics
        value={PAGER_SECTIONS[page]?.id}
        onValueChange={(next) => {
          const index = PAGER_SECTIONS.findIndex((section) => section.id === next);
          if (index < 0 || !pageHeight) return;
          setPage(index);
          scroller.current?.scrollTo({ y: index * pageHeight, animated: true });
        }}
      >
        <SectionRail.Trigger>
          {PAGER_SECTIONS.map((section) => (
            <SectionRail.Bar key={section.id} value={section.id} />
          ))}
        </SectionRail.Trigger>
        <SectionRail.Content>
          {PAGER_SECTIONS.map((section) => (
            <SectionRail.Item key={section.id} value={section.id}>
              {section.label}
            </SectionRail.Item>
          ))}
        </SectionRail.Content>
      </SectionRail>
    </View>
  );
}

function ToggleButtonDemo() {
  const [liked, setLiked] = useState(false);

  return (
    <View className="w-full gap-3">
      {/* Uncontrolled — it holds its own state. */}
      <ToggleButton defaultSelected>Follow</ToggleButton>

      {/* Controlled, with an icon beside a label. ToggleButton.Label reads the
          selected state itself, so nothing has to be threaded through. */}
      <ToggleButton selected={liked} onSelectedChange={setLiked}>
        <BellIcon size={16} />
        <ToggleButton.Label>{liked ? 'Subscribed' : 'Subscribe'}</ToggleButton.Label>
      </ToggleButton>

      <ToggleButton variant="ghost" iconOnly accessibilityLabel="Save">
        <PlusSquareIcon size={18} />
      </ToggleButton>
    </View>
  );
}

function ToggleButtonToolbarDemo() {
  const [marks, setMarks] = useState<string[]>(['shield']);

  return (
    <View className="w-full gap-3">
      {/* `multiple`: independent marks, any number on at once. */}
      <ToggleButtonGroup
        selectionMode="multiple"
        variant="ghost"
        value={marks}
        onValueChange={setMarks}
      >
        <ToggleButton id="shield" iconOnly accessibilityLabel="Protected">
          <ShieldCheckIcon size={18} />
        </ToggleButton>
        <ToggleButton id="bell" iconOnly accessibilityLabel="Notify">
          <BellIcon size={18} />
        </ToggleButton>
        <ToggleButton id="share" iconOnly accessibilityLabel="Shared">
          <ShareNodesIcon size={18} />
        </ToggleButton>
      </ToggleButtonGroup>
      <Text size="sm" muted>
        On: {marks.length ? marks.join(', ') : 'nothing'}
      </Text>
    </View>
  );
}

function ToggleButtonSingleDemo() {
  const [view, setView] = useState<string[]>(['day']);

  return (
    <View className="w-full gap-3">
      {/* `single`: picking one clears the last, and pressing the selected one
          again clears it — a filter you cannot turn off is a trap. */}
      <ToggleButtonGroup selectionMode="single" value={view} onValueChange={setView}>
        <ToggleButton id="day">Day</ToggleButton>
        <ToggleButton id="week">Week</ToggleButton>
        <ToggleButton id="month">Month</ToggleButton>
      </ToggleButtonGroup>
      <Text size="sm" muted>
        Showing: {view[0] ?? 'nothing'}
      </Text>
    </View>
  );
}

const TAB_SECTIONS = [
  'Overview',
  'Activity',
  'Members',
  'Billing',
  'Integrations',
  'Security',
  'Audit log',
];

function ScrollableTabsDemo() {
  return (
    // More tabs than fit. A fixed row answers that by crushing every label to
    // an unreadable width; `scrollable` gives each one its natural width and
    // scrolls the active tab into view instead.
    <Tabs variant="underline" defaultValue="Overview" className="w-full">
      <Tabs.List scrollable>
        {TAB_SECTIONS.map((section) => (
          <Tabs.Trigger key={section} value={section}>
            {section}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {TAB_SECTIONS.map((section) => (
        <Tabs.Content key={section} value={section}>
          <Text size="sm" muted className="py-4">
            {section}
          </Text>
        </Tabs.Content>
      ))}
    </Tabs>
  );
}

function KeepMountedTabsDemo() {
  return (
    // Type into the field, switch away, come back: the text is still there.
    // Without `keepMounted` the panel is unmounted and the value goes with it.
    <Tabs keepMounted defaultValue="draft" className="w-full">
      <Tabs.List>
        <Tabs.Trigger value="draft">Draft</Tabs.Trigger>
        <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="draft">
        <Card>
          <Card.Content className="gap-3 p-4">
            <Input label="Title" placeholder="Type something, then switch tab" />
            <Text size="xs" muted>
              This panel stays mounted, so what you type survives the switch.
            </Text>
          </Card.Content>
        </Card>
      </Tabs.Content>
      <Tabs.Content value="settings">
        <Card>
          <Card.Content className="p-4">
            <Text size="sm" muted>
              Switch back to Draft — the title you typed is still in the field.
            </Text>
          </Card.Content>
        </Card>
      </Tabs.Content>
    </Tabs>
  );
}

function SwipeableTabsDemo() {
  const days = [
    { value: 'mon', label: 'Mon', body: 'Two runs and a swim. 14km total.' },
    { value: 'tue', label: 'Tue', body: 'Rest day. Nothing logged.' },
    { value: 'wed', label: 'Wed', body: 'One long ride, 62km, out to the coast.' },
    { value: 'thu', label: 'Thu', body: 'Intervals — 8 × 400m on the track.' },
  ];

  return (
    // Drag sideways on a card to move to the next day. The indicator follows,
    // and the row scrolls the tab into view when it lands off the end.
    <Tabs swipeable defaultValue="mon" className="w-full">
      <Tabs.List scrollable>
        {days.map((day) => (
          <Tabs.Trigger key={day.value} value={day.value}>
            {day.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {days.map((day) => (
        <Tabs.Content key={day.value} value={day.value}>
          <Card>
            <Card.Content className="gap-2 p-4">
              <Text weight="medium">{day.label}</Text>
              <Text size="sm" muted>
                {day.body}
              </Text>
              <Text size="xs" muted className="mt-2">
                Swipe left or right on this card.
              </Text>
            </Card.Content>
          </Card>
        </Tabs.Content>
      ))}
    </Tabs>
  );
}

/** The four destinations of the expanding row, and what each one shows. */
const EXPANDING_TABS = [
  {
    value: 'home',
    label: 'Home',
    icon: <PackageIcon size={18} />,
    body: 'Everything that changed since you were last here.',
  },
  {
    value: 'chats',
    label: 'Chats',
    icon: <MessageCircleIcon size={18} />,
    body: 'Four threads, two of them waiting on you.',
  },
  {
    value: 'calendar',
    label: 'Calendar',
    icon: <CalendarIcon size={18} />,
    body: 'Nothing until Thursday, and then rather a lot.',
  },
  {
    value: 'inbox',
    label: 'Inbox',
    icon: <BellIcon size={18} />,
    body: 'Three notifications, none of them urgent.',
  },
];

/**
 * Icon-only until you pick one.
 *
 * Four labels written out take the whole row to say four words nobody rereads
 * after the first time. Closed, they take an icon each; open, the one you are
 * looking at says what it is.
 */
function ExpandingTabsDemo() {
  return (
    // `swipeable` as well, so the panel under the row arrives the way it does
    // when it is dragged: pressing a pill throws the incoming panel in from the
    // side it belongs on rather than cross-fading it in place.
    <Tabs swipeable variant="expanding" defaultValue="chats" className="w-full">
      <Tabs.List className="justify-center">
        {EXPANDING_TABS.map((tab) => (
          <Tabs.Trigger key={tab.value} value={tab.value} icon={tab.icon}>
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {EXPANDING_TABS.map((tab) => (
        <Tabs.Content key={tab.value} value={tab.value}>
          <Card>
            <Card.Content className="gap-2 p-4">
              <Text weight="medium">{tab.label}</Text>
              <Text size="sm" muted>
                {tab.body}
              </Text>
            </Card.Content>
          </Card>
        </Tabs.Content>
      ))}
    </Tabs>
  );
}

function PasswordInputDemo() {
  const [visible, setVisible] = useState(false);

  return (
    <View className="w-full gap-1.5">
      <Label isRequired>Password</Label>
      <InputGroup>
        <InputGroup.Input placeholder="Enter your password" secureTextEntry={!visible} />
        <InputGroup.Suffix>
          <Button variant="ghost" size="sm" onPress={() => setVisible((v) => !v)}>
            {visible ? 'Hide' : 'Show'}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
    </View>
  );
}

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

const CANVAS_PHOTOS = [
  'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=900&q=60',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=900&q=60',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900&q=60',
  'https://images.unsplash.com/photo-1439853949127-fa647821eba0?w=900&q=60',
];

function ScrollCanvasVersion({
  effect,
}: {
  effect: 'parallax' | 'zoom' | 'reveal';
}) {
  return (
    <ScrollProgress className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollGap label={`scroll down — ${effect}`} />
        {CANVAS_PHOTOS.map((uri) => (
          <View key={uri} className="px-6">
            <ScrollCanvas source={{ uri }} effect={effect} />
            <ScrollGap />
          </View>
        ))}
        <ScrollGap label="that is all of them" />
      </ScrollView>
    </ScrollProgress>
  );
}

/** The scroll position picks the frame — the thumb scrubs the animation. */
function ScrollCanvasSequenceVersion() {
  const sources = useMemo(() => CANVAS_PHOTOS.map((uri) => ({ uri })), []);

  return (
    <ScrollProgress className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollGap label="scroll slowly" />
        <View className="px-6">
          <ScrollCanvas effect="sequence" sources={sources} start={0.95} end={0.1} />
          <Text size="sm" muted className="pt-3">
            Four frames across one screen of scroll. Every frame stays mounted,
            so scrubbing back up never waits on a decode.
          </Text>
        </View>
        <ScrollGap label="that is all of it" />
      </ScrollView>
    </ScrollProgress>
  );
}

/* -------------------------------------------------------------------------- */
/* ThinkingOrb                                                                */
/* -------------------------------------------------------------------------- */

const ORB_STATES = [
  ['working', 'Running a task'],
  ['searching', 'Looking something up'],
  ['solving', 'Working a problem out'],
  ['listening', 'Taking input'],
  ['composing', 'Writing a reply'],
  ['shaping', 'Forming a structure'],
] as const;

function ThinkingOrbStatesVersion() {
  return (
    <ScrollView
      contentContainerClassName="px-5 py-4"
      showsVerticalScrollIndicator={false}
    >
      <Item.Group>
        {ORB_STATES.map(([state, caption], index) => (
          <View key={state}>
            {index > 0 ? <Item.Separator /> : null}
            <Item>
              <Item.Media>
                <ThinkingOrb state={state} size={56} />
              </Item.Media>
              <Item.Content>
                <Item.Title>{state}</Item.Title>
                <Item.Description>{caption}</Item.Description>
              </Item.Content>
            </Item>
          </View>
        ))}
      </Item.Group>
    </ScrollView>
  );
}

/** The 20px tuning is a separate design, not the 64px one scaled down. */
function ThinkingOrbInlineVersion() {
  return (
    <ScrollView contentContainerClassName="gap-4 px-5 py-4">
      <Message>
        <Message.Avatar>
          <Avatar size="sm" fallback="AI" />
        </Message.Avatar>
        <Message.Content>
          <Message.Bubble>
            <View className="flex-row items-center gap-2">
              <ThinkingOrb state="searching" size={20} />
              <Shimmer>Searching the docs…</Shimmer>
            </View>
          </Message.Bubble>
        </Message.Content>
      </Message>

      {ORB_STATES.map(([state]) => (
        <View key={state} className="flex-row items-center gap-2">
          <ThinkingOrb state={state} size={20} />
          <Text size="sm" muted>
            {state}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function ThinkingOrbControlsVersion() {
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);

  return (
    <View className="flex-1 justify-center gap-8 px-5">
      <View className="items-center">
        <ThinkingOrb state="working" size={140} speed={speed} paused={paused} />
      </View>
      <Slider
        label="Speed"
        showValue
        formatValue={(value) => `${value.toFixed(1)}×`}
        min={0.2}
        max={3}
        step={0.1}
        value={speed}
        onValueChange={setSpeed}
      />
      <View className="flex-row items-center justify-between">
        <Text>Paused</Text>
        {/* Pausing holds the current frame rather than clearing it — a still
            orb is not an empty one. */}
        <Switch value={paused} onValueChange={setPaused} />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Soundwave                                                                  */
/* -------------------------------------------------------------------------- */

const WAVE_STATES = ['idle', 'listening', 'thinking', 'speaking'] as const;

/** The capsules over a microphone button — a voice-mode screen. */
function SoundwavePillsVersion() {
  const voice = useVoiceRecorder();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 justify-between pt-6"
      style={{ paddingBottom: insets.bottom + 24 }}
    >
      <View className="flex-1 items-center justify-center gap-8">
        <Soundwave
          variant="pills"
          state={voice.recording ? 'listening' : 'idle'}
          level={voice.recording ? voice.level : undefined}
          height={120}
          barWidth={34}
          barGap={12}
        />
        <Text muted>{voice.recording ? 'Listening' : 'Press record to start'}</Text>
      </View>

      <VoiceControls voice={voice} />
    </View>
  );
}

/** The metering strip, in both modes, at the size it is actually used. */
function SoundwaveBarsVersion() {
  const voice = useVoiceRecorder();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerClassName="gap-6 py-6"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <View className="gap-3 px-5">
        <Text size="sm" muted>
          static — every bar is a band of the current level
        </Text>
        <Card>
          <Card.Content className="p-4">
            <Soundwave
              variant="bars"
              mode="static"
              state={voice.recording ? 'listening' : 'idle'}
              level={voice.recording ? voice.level : undefined}
              height={64}
            />
          </Card.Content>
        </Card>
      </View>

      <View className="gap-3 px-5">
        <Text size="sm" muted>
          scrolling — history slides left, newest on the right
        </Text>
        <Card>
          <Card.Content className="p-4">
            <Soundwave
              variant="bars"
              mode="scrolling"
              state={voice.recording ? 'listening' : 'idle'}
              level={voice.recording ? voice.level : undefined}
              height={64}
            />
          </Card.Content>
        </Card>
      </View>

      <View className="gap-3 px-5">
        <Text size="sm" muted>
          not centered, and thicker — a recording row
        </Text>
        <Card>
          <Card.Content className="flex-row items-center gap-3 p-4">
            <MicIcon size={18} />
            <View className="flex-1">
              <Soundwave
                variant="bars"
                mode="scrolling"
                centered={false}
                bars={28}
                barWidth={5}
                height={40}
                state={voice.recording ? 'listening' : 'idle'}
                level={voice.recording ? voice.level : undefined}
              />
            </View>
            <Text size="sm" muted>
              {formatClock(voice.seconds)}
            </Text>
          </Card.Content>
        </Card>
      </View>

      <VoiceControls voice={voice} compact />
    </ScrollView>
  );
}

/** The travelling wave, and what each state does to it with no level supplied. */
function SoundwaveLineVersion() {
  const [state, setState] = useState<string[]>(['speaking']);
  const voice = useVoiceRecorder();
  const insets = useSafeAreaInsets();
  const picked = WAVE_STATES.find((name) => name === state[0]) ?? 'speaking';
  // Recording wins over the picker: pressing the button is the demo, and a
  // wave that ignored it would be the wrong lesson.
  const current = voice.recording ? 'listening' : picked;

  return (
    <ScrollView
      contentContainerClassName="gap-6 py-6"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <View className="px-5">
        <Card>
          <Card.Content className="p-4">
            <Soundwave
              variant="line"
              state={current}
              level={voice.recording ? voice.level : undefined}
              height={96}
            />
          </Card.Content>
        </Card>
      </View>

      <View className="gap-3 px-5">
        <Text size="sm" muted>
          state — what it animates with no level supplied
        </Text>
        <ToggleButtonGroup selectionMode="single" value={state} onValueChange={setState}>
          {WAVE_STATES.map((name) => (
            <ToggleButton key={name} id={name}>
              {name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </View>

      <View className="gap-3 px-5">
        <Text size="sm" muted>
          Under a reply, at the size it would sit there
        </Text>
        <Message>
          <Message.Avatar>
            <Avatar size="sm" fallback="AI" />
          </Message.Avatar>
          <Message.Content>
            <Message.Bubble>
              <View className="w-full gap-2">
                <Text size="sm">Here is what I found in the changelog.</Text>
                <Soundwave variant="line" state="speaking" height={36} barWidth={2} />
              </View>
            </Message.Bubble>
          </Message.Content>
        </Message>
      </View>

      <VoiceControls voice={voice} compact />
    </ScrollView>
  );
}

/**
 * The glow, taking the whole screen.
 *
 * This one runs full bleed — no title bar above it — because that is the only
 * way to see what it does: a rim of light around the *screen* reads as a lit
 * room, and the same thing under a header reads as a coloured box. So the
 * screen's chrome comes inside it instead: a way back, and a light/dark toggle,
 * since half the point of an ambient glow is how differently it sits in the two.
 */
function SoundwaveAmbientVersion() {
  const voice = useVoiceRecorder();
  const insets = useSafeAreaInsets();
  const { mode, toggleMode } = useThemeMode();

  return (
    <View className="flex-1 bg-background">
      {/* Absolutely positioned and non-interactive, so it goes behind the
          screen's own content rather than wrapping it. */}
      <Soundwave
        variant="ambient"
        state={voice.recording ? 'listening' : 'idle'}
        level={voice.recording ? voice.level : undefined}
        radius={40}
      />

      <View
        className="flex-row items-center justify-between px-5"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-full"
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <ChevronLeftIcon size={20} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-full"
          onPress={toggleMode}
          accessibilityLabel={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {mode === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </Button>
      </View>

      <View className="flex-1 items-center justify-center gap-3">
        <Text size="xl" weight="medium">
          {voice.recording ? 'Listening' : 'Start chatting anytime'}
        </Text>
        <Text size="sm" muted>
          The room is lit by the level, not by a spinner.
        </Text>
      </View>

      <View style={{ paddingBottom: insets.bottom + 24 }}>
        <VoiceControls voice={voice} />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Soundwave in a conversation                                                */
/* -------------------------------------------------------------------------- */

interface VoiceNote {
  id: string;
  align: 'start' | 'end';
  /** The stored shape of the recording — 40 numbers, not the audio. */
  levels: number[];
  seconds: number;
  time: string;
  /** Empty for the seeded notes: there is no file, only a waveform. */
  uri: string;
}

/** A plausible waveform, seeded so a note looks the same on every render. */
function seedWaveform(seed: number, bars = 40): number[] {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return Array.from({ length: bars }, (_unused, index) => {
    // Syllables, not noise: a slow envelope with quick peaks riding it, which
    // is what speech looks like once it is metered.
    const envelope = 0.45 + 0.55 * Math.sin((index / bars) * Math.PI * 2.2 + seed);
    return Math.max(0.08, Math.min(1, envelope * (0.5 + 0.7 * random())));
  });
}

const SEED_NOTES: VoiceNote[] = [
  { id: 'n1', align: 'start', levels: seedWaveform(3), seconds: 8, time: '09:41', uri: '' },
  { id: 'n2', align: 'end', levels: seedWaveform(11), seconds: 4, time: '09:42', uri: '' },
  { id: 'n3', align: 'start', levels: seedWaveform(27), seconds: 12, time: '09:44', uri: '' },
];

/**
 * One voice note: play, the waveform, the duration.
 *
 * The waveform is `levels` — the shape captured while recording — and the
 * playhead is `progress`, so the bars behind it fill as it plays. A recorded
 * note plays for real; the seeded ones have no file, so their playhead is
 * animated at the same rate rather than pretending there is audio behind it.
 */
/** The play button. Its icon takes the bubble's own foreground, so it reads on
 *  the sent side and the received one alike. */
function NoteButton({ playing, onPress }: { playing: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause' : 'Play'}
      onPress={onPress}
      className="size-9 items-center justify-center rounded-full"
    >
      {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
    </Pressable>
  );
}

function VoiceNoteBubble({ note }: { note: VoiceNote }) {
  const player = useAudioPlayer(note.uri || null);
  const status = useAudioPlayerStatus(player);
  const progress = useSharedValue(0);
  const [playingSeed, setPlayingSeed] = useState(false);

  useEffect(() => {
    if (!note.uri) return;
    progress.value = status.duration
      ? Math.min(1, status.currentTime / status.duration)
      : 0;
  }, [note.uri, status.currentTime, status.duration, progress]);

  const playing = note.uri ? status.playing : playingSeed;

  const toggle = () => {
    if (note.uri) {
      if (status.playing) player.pause();
      else {
        if (status.didJustFinish || status.currentTime >= status.duration) player.seekTo(0);
        player.play();
      }
      return;
    }

    if (playingSeed) {
      cancelAnimation(progress);
      setPlayingSeed(false);
      return;
    }
    setPlayingSeed(true);
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: note.seconds * 1000, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(setPlayingSeed)(false);
      }
    );
  };

  return (
    <Message align={note.align}>
      <Message.Content>
        <Message.Bubble className="px-3 py-2.5">
          <View className="w-64 flex-row items-center gap-3">
            <NoteButton playing={playing} onPress={toggle} />

            <View className="flex-1">
              {/* `levels` freezes the wave into the recorded shape, so nothing
                  animates until the playhead moves. */}
              <Soundwave
                variant="bars"
                levels={note.levels}
                progress={progress}
                bars={40}
                barWidth={2}
                height={28}
              />
            </View>

            <Text size="xs" muted>
              {formatClock(note.seconds)}
            </Text>
          </View>
        </Message.Bubble>
        <Message.Footer>{note.time}</Message.Footer>
      </Message.Content>
    </Message>
  );
}

/** Voice notes in a transcript — record one and it joins the thread. */
function SoundwaveNotesVersion() {
  const voice = useVoiceRecorder();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<VoiceNote[]>(SEED_NOTES);

  useEffect(() => {
    if (!voice.note) return;
    setNotes((current) => [
      ...current,
      {
        id: `rec-${current.length}`,
        align: 'end',
        levels: voice.note!.levels,
        seconds: voice.note!.seconds,
        time: 'now',
        uri: voice.note!.uri,
      },
    ]);
    voice.clearNote();
  }, [voice]);

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="gap-3 px-4 py-4">
        {notes.map((note) => (
          <VoiceNoteBubble key={note.id} note={note} />
        ))}
      </ScrollView>

      <View className="border-t border-border pt-5" style={{ paddingBottom: insets.bottom + 20 }}>
        <VoiceControls voice={voice} compact />
      </View>
    </View>
  );
}

/** The composer that turns into a recorder, over a live transcript. */
function SoundwaveComposerVersion() {
  const voice = useVoiceRecorder();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<VoiceNote[]>(SEED_NOTES.slice(0, 2));

  useEffect(() => {
    if (!voice.note) return;
    setNotes((current) => [
      ...current,
      {
        id: `rec-${current.length}`,
        align: 'end',
        levels: voice.note!.levels,
        seconds: voice.note!.seconds,
        time: 'now',
        uri: voice.note!.uri,
      },
    ]);
    voice.clearNote();
  }, [voice]);

  return (
    <View className="flex-1">
      {voice.meter}

      <MessageScroller autoScroll className="flex-1">
        <MessageScroller.Viewport>
          <MessageScroller.Content className="gap-3 px-4 py-4">
            {notes.map((note) => (
              <MessageScroller.Item key={note.id} messageId={note.id}>
                <VoiceNoteBubble note={note} />
              </MessageScroller.Item>
            ))}
          </MessageScroller.Content>
        </MessageScroller.Viewport>
        <MessageScroller.Button />
      </MessageScroller>

      {/* The version screen renders edge to edge, so the composer is what has
          to clear the home indicator. */}
      <View
        className="border-t border-border p-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {voice.recording ? (
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel recording"
              onPress={voice.cancel}
              className="size-10 items-center justify-center rounded-full"
            >
              <XIcon size={18} />
            </Pressable>

            <View className="flex-1">
              {/* Scrolling, because a composer is showing what was just said
                  rather than a level: the last few seconds slide past. */}
              <Soundwave
                variant="bars"
                mode="scrolling"
                level={voice.level}
                bars={32}
                barWidth={3}
                height={36}
              />
            </View>

            <Text size="sm" muted>
              {formatClock(voice.seconds)}
            </Text>

            <Button size="icon" className="size-10 rounded-full" onPress={voice.toggle}>
              <SendIcon size={16} />
            </Button>
          </View>
        ) : (
          <View className="flex-row items-center gap-3">
            <View className="flex-1 rounded-full bg-muted px-4 py-2.5">
              <Text size="sm" muted>
                Hold the mic, or press it
              </Text>
            </View>
            <Button size="icon" className="size-10 rounded-full" onPress={voice.toggle}>
              <MicIcon size={18} />
            </Button>
          </View>
        )}

        {voice.reason ? (
          <Text size="xs" muted className="pt-3 text-center">
            {voice.reason}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Direction                                                                  */
/* -------------------------------------------------------------------------- */

/** Rows with a leading icon and a trailing chevron — the thing RTL mirrors. */
function DirectionRows() {
  return (
    <Item.Group>
      <Item>
        <Item.Media variant="icon">
          <BellIcon size={16} />
        </Item.Media>
        <Item.Content>
          <Item.Title>Notifications</Item.Title>
          <Item.Description>Badges, sounds, banners</Item.Description>
        </Item.Content>
        <Item.Actions>
          <ChevronRightIcon size={16} />
        </Item.Actions>
      </Item>
      <Item.Separator />
      <Item>
        <Item.Media variant="icon">
          <ShieldCheckIcon size={16} />
        </Item.Media>
        <Item.Content>
          <Item.Title>Privacy</Item.Title>
          <Item.Description>Two-factor is on</Item.Description>
        </Item.Content>
        <Item.Actions>
          <ChevronRightIcon size={16} />
        </Item.Actions>
      </Item>
      <Item.Separator />
      <Item>
        <Item.Media variant="icon">
          <CardIcon size={16} />
        </Item.Media>
        <Item.Content>
          <Item.Title>Payment</Item.Title>
          <Item.Description>Visa ending 4242</Item.Description>
        </Item.Content>
        <Item.Actions>
          <ChevronRightIcon size={16} />
        </Item.Actions>
      </Item>
      <Item.Separator />
      {/* The send glyph is a direction too, and mirrors with the chevrons —
          toggle back and forth and both have to follow every time, not once. */}
      <Item>
        <Item.Media variant="icon">
          <SendIcon size={16} />
        </Item.Media>
        <Item.Content>
          <Item.Title>Send feedback</Item.Title>
          <Item.Description>Goes to the team</Item.Description>
        </Item.Content>
        <Item.Actions>
          <ChevronRightIcon size={16} />
        </Item.Actions>
      </Item>
    </Item.Group>
  );
}

function DirectionFlipDemo() {
  const [dir, setDir] = useState<string[]>(['rtl']);
  const value = dir[0] === 'rtl' ? 'rtl' : 'ltr';

  return (
    <View className="w-full gap-4">
      <ToggleButtonGroup selectionMode="single" value={dir} onValueChange={setDir}>
        <ToggleButton id="ltr">ltr</ToggleButton>
        <ToggleButton id="rtl">rtl</ToggleButton>
      </ToggleButtonGroup>
      {/* It takes no layout of its own, so it is as tall as the rows in it. */}
      <Direction dir={value} className="w-full">
        <DirectionRows />
      </Direction>
    </View>
  );
}

/** Reads the value back out, which is what a component flipping its own maths does. */
function DirectionReadout() {
  const dir = useDirection();

  return (
    <View className="flex-row items-center justify-between gap-3 px-4 py-3">
      <Text size="sm" muted>
        useDirection()
      </Text>
      <Badge variant="secondary">{dir}</Badge>
    </View>
  );
}

function DirectionNestedDemo() {
  return (
    <Direction dir="rtl" className="w-full gap-3">
      <Surface variant="secondary" className="w-full p-4">
        <Text weight="medium">حساب المستخدم</Text>
        <Text size="sm" muted>
          The card, its padding and its rows all mirror.
        </Text>
      </Surface>
      <Surface variant="secondary" className="w-full">
        <DirectionReadout />
        {/* An island that must not flip: an identifier reads the same way in
            every locale, and mirroring it makes it wrong rather than localised. */}
        <Direction dir="ltr" className="border-t border-border">
          <View className="px-4 pt-3">
            <Text size="sm">+1 (555) 010-4477</Text>
          </View>
          <DirectionReadout />
        </Direction>
      </Surface>
    </Direction>
  );
}

/**
 * A whole screen run through both directions.
 *
 * The point is the things Yoga cannot flip on its own: a slider's drag, a
 * switch's thumb, a shimmer's sweep, a chevron's glyph and a paragraph's
 * alignment are all pixel maths or text metrics rather than layout, and each
 * one had to be taught to read the direction. Side by side is the only way to
 * see whether they actually did.
 */
function DirectionScreenVersion() {
  const [selection, setSelection] = useState<string[]>(['rtl']);
  const dir: DirectionValue = selection[0] === 'ltr' ? 'ltr' : 'rtl';
  const [volume, setVolume] = useState(65);
  const [sync, setSync] = useState(true);

  return (
    <View className="flex-1">
      <View className="items-center p-4">
        <ToggleButtonGroup
          selectionMode="single"
          value={selection}
          onValueChange={setSelection}
        >
          <ToggleButton id="ltr">ltr</ToggleButton>
          <ToggleButton id="rtl">rtl</ToggleButton>
        </ToggleButtonGroup>
      </View>

      <Direction dir={dir} className="flex-1">
        <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
          <View className="gap-1">
            <Text size="lg" weight="semibold">
              {dir === 'rtl' ? 'الإعدادات' : 'Settings'}
            </Text>
            <Text size="sm" muted>
              {dir === 'rtl'
                ? 'تتبع المحاذاة اتجاه القراءة، وليس إعداد الجهاز.'
                : 'Alignment follows the reading direction, not the device setting.'}
            </Text>
          </View>

          <Surface variant="secondary">
            <Item>
              <Item.Media>
                <BellIcon size={18} />
              </Item.Media>
              <Item.Content>
                <Item.Title>{dir === 'rtl' ? 'الإشعارات' : 'Notifications'}</Item.Title>
                <Item.Description>
                  {dir === 'rtl' ? 'يتبع الشيفرون الاتجاه' : 'The chevron follows the direction'}
                </Item.Description>
              </Item.Content>
              <Item.Actions>
                <ChevronRightIcon size={16} />
              </Item.Actions>
            </Item>
            <Separator />
            <Item>
              <Item.Content>
                <Item.Title>{dir === 'rtl' ? 'المزامنة' : 'Sync'}</Item.Title>
                <Item.Description>
                  {dir === 'rtl' ? 'يتحرك المفتاح للجهة الصحيحة' : 'The thumb travels the right way'}
                </Item.Description>
              </Item.Content>
              <Item.Actions>
                <Switch value={sync} onValueChange={setSync} />
              </Item.Actions>
            </Item>
          </Surface>

          <Card>
            <Card.Header>
              <Card.Title>{dir === 'rtl' ? 'مستوى الصوت' : 'Volume'}</Card.Title>
              <Card.Description>
                {dir === 'rtl'
                  ? 'اسحب: يتبع الإبهام إصبعك في كلا الاتجاهين.'
                  : 'Drag it — the thumb follows your finger in both directions.'}
              </Card.Description>
            </Card.Header>
            <Card.Content className="gap-4">
              <Slider value={volume} onValueChange={setVolume} min={0} max={100} />
              <Progress value={volume} />
              <Shimmer>
                <Text size="sm" muted>
                  {dir === 'rtl' ? 'يمسح مع النص' : 'The sweep runs with the script'}
                </Text>
              </Shimmer>
            </Card.Content>
          </Card>

          <Message align="start">
            <Message.Bubble>
              {dir === 'rtl' ? 'يشير الركن المربع إلى المرسل.' : 'The squared corner points back at its sender.'}
            </Message.Bubble>
          </Message>
        </ScrollView>
      </Direction>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* HeatmapChart                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A year of plausible daily counts, seeded so the pattern is the same on every
 * render — a heatmap redrawn from `Math.random()` on each pass has no shape to
 * look at, and the reveal animation replays against different data every time.
 */
function heatmapYear(days = 371, seed = 7) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  const end = new Date(2026, 6, 23);
  const entries: { date: Date; count: number }[] = [];

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(end);
    date.setDate(date.getDate() - offset);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const roll = random();
    // Quiet weekends, the odd blank weekday, and a long tail — the shape real
    // activity has, rather than an even scatter.
    const count = weekend
      ? roll > 0.75
        ? Math.floor(roll * 6)
        : 0
      : roll > 0.12
        ? Math.floor(roll * 18)
        : 0;
    entries.push({ date, count });
  }

  return entries;
}

const HEATMAP_YEAR = buildHeatmapCalendar(heatmapYear(), { weekStartDay: 1 });
const HEATMAP_QUARTER = HEATMAP_YEAR.slice(-13);

const HEATMAP_TOTAL = HEATMAP_YEAR.reduce(
  (running, column) => running + column.bins.reduce((sum, cell) => sum + cell.count, 0),
  0
);

/** A full year, scrolled sideways — 53 weeks do not fit on a phone. */
function HeatmapContributionVersion() {
  const [active, setActive] = useState<HeatmapCell | null>(null);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Contributions</Frame.Title>
          <Frame.Action>Hold to read</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          {/* The header is outside the horizontal scroller on purpose: it and
              its ramp belong at the frame's width, not the grid's, or they
              scroll away with the cells. */}
          <HeatmapChart data={[]} className={CHART_HEADER}>
            <HeatmapChart.Header
              value={
                active
                  ? `${active.count}`
                  : HEATMAP_TOTAL.toLocaleString()
              }
              caption={
                active
                  ? (active.date?.toDateString() ?? '—')
                  : 'Contributions in the last year'
              }
              legend
            />
          </HeatmapChart>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4 pb-4"
          >
            <HeatmapChart
              data={HEATMAP_YEAR}
              weekStartDay={1}
              binSize={13}
              onActiveCellChange={setActive}
            >
              <HeatmapChart.XAxis />
              <HeatmapChart.YAxis />
              <HeatmapChart.Cells />
              <HeatmapChart.Tooltip />
            </HeatmapChart>
          </ScrollView>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** A quarter, with the cells sized to the width they are given. */
function HeatmapFillVersion() {
  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Last 13 weeks</Frame.Title>
          <Frame.Action>layout=&quot;fill&quot;</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <View className="p-4">
            {/* No chart header here: the frame's own already says what this
                is, and a second title under the first says it twice. */}
            <HeatmapChart data={HEATMAP_QUARTER} layout="fill" weekStartDay={1} gap={4}>
              <HeatmapChart.XAxis />
              <HeatmapChart.YAxis />
              <HeatmapChart.Cells cornerRadius={3} />
              <HeatmapChart.Tooltip />
              <HeatmapChart.Legend />
            </HeatmapChart>
          </View>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/** Quarter rules, and the whole chart on one accent colour. */
function HeatmapQuartersVersion() {
  const success = useCSSVariable('--color-success');

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Deploys by quarter</Frame.Title>
          <Frame.Action>Rules every 13</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <HeatmapChart data={[]} className={CHART_HEADER}>
            <HeatmapChart.Header
              title="Deploys"
              caption="A ramp off one colour rather than the chart token"
            />
          </HeatmapChart>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4 pb-4"
          >
            <HeatmapChart
              data={HEATMAP_YEAR}
              weekStartDay={1}
              binSize={11}
              color={typeof success === 'string' ? success : undefined}
            >
              <HeatmapChart.XAxis />
              <HeatmapChart.YAxis tickFilter="all" labelFormat="initial" width={16} />
              <HeatmapChart.Separator every="quarter" dashArray="2,3" />
              <HeatmapChart.Cells />
              <HeatmapChart.Tooltip />
            </HeatmapChart>
          </ScrollView>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/*
 * Six-hour bins. `fill` sizes a cell off the width, so with seven columns the
 * cells are wide and every row costs that much height — four rows is a grid
 * that stands shorter than the calendars it is paged beside, where eight
 * three-hour ones stood half as tall again.
 */
const HOURS = ['00', '06', '12', '18'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * A week by time of day rather than a year by date — seven columns of four
 * six-hour bins, seeded the same way the year is so the shape holds still.
 */
function punchcardWeek(): HeatmapColumn[] {
  let state = 19;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  return WEEKDAYS.map((_, day) => ({
    bin: day,
    bins: HOURS.map((_hour, slot) => {
      const roll = random();
      const weekend = day >= 5;
      // Office hours on weekdays, a quiet evening bump at the weekend, and
      // nothing much overnight either way.
      const working = slot === 1 || slot === 2;
      const peak = weekend ? (slot === 2 ? 0.45 : 0.1) : working ? 1 : 0.18;
      return { bin: slot, count: Math.floor(roll * 20 * peak) };
    }),
  }));
}

const HEATMAP_PUNCHCARD = punchcardWeek();

/**
 * The grid with something other than a calendar in it — rows are times of day,
 * columns are weekdays. "When is this busy" is a question the year grid cannot
 * answer, because it has already spent its rows on the days of the week.
 */
function HeatmapPunchcardVersion() {
  const [active, setActive] = useState<HeatmapCell | null>(null);

  return (
    <View className="flex-1 justify-center p-4">
      <Frame className="w-full">
        <Frame.Header>
          <Frame.Title>Support load</Frame.Title>
          <Frame.Action>By hour</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          <View className="p-4">
            <HeatmapChart
              data={HEATMAP_PUNCHCARD}
              layout="fill"
              rows={HOURS.length}
              gap={4}
              onActiveCellChange={setActive}
            >
              <HeatmapChart.Header
                title="Tickets opened"
                value={active ? `${active.count}` : '06:00 – 18:00'}
                caption={
                  active
                    ? `${WEEKDAYS[active.column] ?? ''} at ${HOURS[active.row] ?? ''}:00`
                    : 'Where the week actually lands'
                }
                legend
              />
              <HeatmapChart.XAxis labels={WEEKDAYS} />
              <HeatmapChart.YAxis labels={HOURS} tickFilter="all" width={24} />
              <HeatmapChart.Cells cornerRadius={3} />
              {/* The default label names contributions on a date, and this
                  grid has neither — so it says what this one is counting. */}
              <HeatmapChart.Tooltip
                formatLabel={(cell) =>
                  `${cell.count} · ${WEEKDAYS[cell.column] ?? ''} ${HOURS[cell.row] ?? ''}:00`
                }
              />
            </HeatmapChart>
          </View>
        </Frame.Panel>
      </Frame>
    </View>
  );
}

/**
 * A field that has to get out of the keyboard's way inside a scroll view —
 * the case a fixed-height box cannot show.
 *
 * Focus "Comment", then scroll the form. The field holds its place between
 * "Subject" and "Signature": its lift decays to nothing as it scrolls clear of
 * the keyboard, and comes back as it scrolls under it again.
 */
function KeyboardLiftDemo() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerClassName="gap-4 px-5 pt-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Plain fields first, to make the point that only the focused avoiding
          field moves. Tapping one of these leaves the screen exactly as it is. */}
      <Input label="From" placeholder="you@example.com" />
      <Input label="To" placeholder="them@example.com" />
      <Input label="Subject" placeholder="An ordinary field" />
      <Input
        avoidKeyboard
        label="Comment"
        placeholder="Say something…"
        description="Lifts on focus, follows the scroll, settles back on blur."
        multiline
      />
      <Input label="Signature" placeholder="Sent from my phone" />
      <Input label="Reply-to" placeholder="Optional" />
      <Input label="Tags" placeholder="Comma separated" />
    </ScrollView>
  );
}

/**
 * The other half of the job: a bar already pinned to the bottom edge, which
 * should ride the keyboard rather than measure anything. `dock` moves it by the
 * keyboard height less the inset it is already sitting above.
 */
function KeyboardDockDemo() {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');

  return (
    <View className="flex-1">
      <ScrollView
        contentContainerClassName="gap-3 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {[
          'Every control ships with its accessibility role wired up.',
          'Animations run on the UI thread, so a busy list never drops them.',
          'Tokens are semantic — a theme swap moves every component at once.',
          'The composer below stays put while this list scrolls.',
          'Open the keyboard and it travels with it, frame for frame.',
        ].map((line) => (
          <Card key={line}>
            <Card.Content className="p-4">
              <Text size="sm">{line}</Text>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      <KeyboardAvoider
        mode="dock"
        bottomInset={insets.bottom}
        pointerEvents="box-none"
        className="absolute left-0 right-0 px-5"
        style={{ bottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center gap-2 rounded-full border border-border bg-surface px-4 shadow-lg">
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            className="flex-1 border-0 bg-transparent px-0"
            containerClassName="flex-1"
            accessibilityLabel="Message"
          />
          <SendIcon size={18} />
        </View>
      </KeyboardAvoider>
    </View>
  );
}

const INVOICES = [
  { id: 'INV-001', status: 'Paid', method: 'Card', amount: 250 },
  { id: 'INV-002', status: 'Pending', method: 'Transfer', amount: 150 },
  { id: 'INV-003', status: 'Unpaid', method: 'Card', amount: 350 },
  { id: 'INV-004', status: 'Paid', method: 'Card', amount: 450 },
  { id: 'INV-005', status: 'Paid', method: 'Transfer', amount: 550 },
];

const invoiceAmount = (value: number) => `$${value.toFixed(2)}`;

/**
 * The same three columns as the basic demo, sized once at the top instead of on
 * all eighteen heads and cells. Module scope, not inline: a fresh array every
 * frame renumbers every cell in the table.
 */
const INVOICE_COLUMNS = [{ flex: 2 }, {}, { align: 'end' as const }];

/** One column model on the root; the rows below are just their contents. */
function ColumnsTableDemo() {
  return (
    <Table variant="outline" columns={INVOICE_COLUMNS} className="w-full">
      <Table.Header>
        <Table.Row>
          <Table.Head>Invoice</Table.Head>
          <Table.Head>Method</Table.Head>
          <Table.Head>Amount</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {INVOICES.map((invoice) => (
          <Table.Row key={invoice.id}>
            <Table.Cell>{invoice.id}</Table.Cell>
            <Table.Cell>{invoice.method}</Table.Cell>
            <Table.Cell>{invoiceAmount(invoice.amount)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

/**
 * A table that pages. The component reports the page; slicing the rows stays
 * here, which is the whole division of labour it is built around.
 */
function PaginatedTableDemo() {
  const [page, setPage] = useState(1);
  const pageSize = 2;
  const rows = INVOICES.slice((page - 1) * pageSize, page * pageSize);

  return (
    <View className="w-full gap-3">
      <Table variant="outline" columns={INVOICE_COLUMNS} className="w-full">
        <Table.Header>
          <Table.Row>
            <Table.Head>Invoice</Table.Head>
            <Table.Head>Method</Table.Head>
            <Table.Head>Amount</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((invoice) => (
            <Table.Row key={invoice.id}>
              <Table.Cell>{invoice.id}</Table.Cell>
              <Table.Cell>{invoice.method}</Table.Cell>
              <Table.Cell>{invoiceAmount(invoice.amount)}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <Pagination
        count={Math.ceil(INVOICES.length / pageSize)}
        page={page}
        onPageChange={setPage}
        variant="compact"
        size="sm"
      >
        <Pagination.Status pageSize={pageSize} total={INVOICES.length} />
      </Pagination>
    </View>
  );
}

/** Every presentation driven from one page number, so the three stay in step. */
function PaginationDemo({
  count = 12,
  ...props
}: Partial<React.ComponentProps<typeof Pagination>>) {
  const [page, setPage] = useState(1);

  return <Pagination count={count} page={page} onPageChange={setPage} {...props} />;
}

function TableDemo({
  variant,
  striped,
  caption,
}: {
  variant?: 'default' | 'outline';
  striped?: boolean;
  caption?: string;
}) {
  return (
    <Table variant={variant} striped={striped} className="w-full">
      <Table.Header>
        <Table.Row>
          <Table.Head flex={2}>Invoice</Table.Head>
          <Table.Head>Method</Table.Head>
          <Table.Head align="end">Amount</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {INVOICES.map((invoice) => (
          <Table.Row key={invoice.id}>
            <Table.Cell flex={2}>{invoice.id}</Table.Cell>
            <Table.Cell>{invoice.method}</Table.Cell>
            <Table.Cell align="end">{invoiceAmount(invoice.amount)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell flex={2} labelClassName="font-medium">
            Total
          </Table.Cell>
          <Table.Cell />
          <Table.Cell align="end" labelClassName="font-medium">
            {invoiceAmount(INVOICES.reduce((sum, i) => sum + i.amount, 0))}
          </Table.Cell>
        </Table.Row>
      </Table.Footer>
      {caption ? (
        <Table.Caption className="px-4 py-3">{caption}</Table.Caption>
      ) : null}
    </Table>
  );
}

/** Headings on the tray, rows in the card — `Table.Frame` does the lift. */
function FramedTableDemo() {
  return (
    // One caption line, not two. On the tray a title and a description are the
    // same muted `text-sm`, so stacking them reads as one sentence broken in
    // half and costs the frame a row of height for nothing.
    <Table.Frame
      className="w-full"
      title="Five most recent invoices"
      action={<Badge variant="outline">Q3</Badge>}
    >
      <Table.Header>
        <Table.Row>
          <Table.Head flex={2}>Invoice</Table.Head>
          <Table.Head>Method</Table.Head>
          <Table.Head align="end">Amount</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {INVOICES.map((invoice) => (
          <Table.Row key={invoice.id}>
            <Table.Cell flex={2}>{invoice.id}</Table.Cell>
            <Table.Cell>{invoice.method}</Table.Cell>
            <Table.Cell align="end">{invoiceAmount(invoice.amount)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell flex={2} labelClassName="font-medium">
            Total
          </Table.Cell>
          <Table.Cell />
          <Table.Cell align="end" labelClassName="font-medium">
            {invoiceAmount(INVOICES.reduce((sum, i) => sum + i.amount, 0))}
          </Table.Cell>
        </Table.Row>
      </Table.Footer>
    </Table.Frame>
  );
}

/** A column header is the handle for sorting by it; the arrow turns over. */
function SortableTableDemo() {
  const [column, setColumn] = useState<'id' | 'amount'>('amount');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  const sortBy = (next: 'id' | 'amount') => {
    if (next === column) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setColumn(next);
    setDirection('asc');
  };

  const rows = useMemo(() => {
    const sign = direction === 'asc' ? 1 : -1;
    return [...INVOICES].sort((a, b) =>
      column === 'amount'
        ? (a.amount - b.amount) * sign
        : a.id.localeCompare(b.id) * sign
    );
  }, [column, direction]);

  return (
    <Table variant="outline">
      <Table.Header>
        <Table.Row>
          <Table.Head
            flex={2}
            sortDirection={column === 'id' ? direction : undefined}
            sortable
            onPress={() => sortBy('id')}
          >
            Invoice
          </Table.Head>
          <Table.Head
            align="end"
            sortDirection={column === 'amount' ? direction : undefined}
            sortable
            onPress={() => sortBy('amount')}
          >
            Amount
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((invoice) => (
          <Table.Row key={invoice.id}>
            <Table.Cell flex={2}>{invoice.id}</Table.Cell>
            <Table.Cell align="end">{invoiceAmount(invoice.amount)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

/** Rows given an `onPress` become buttons, and the chosen one stays lit. */
function SelectableTableDemo() {
  const [picked, setPicked] = useState('INV-002');

  return (
    <View className="w-full gap-3">
      <Table variant="outline">
        <Table.Header>
          <Table.Row>
            <Table.Head flex={2}>Invoice</Table.Head>
            <Table.Head>Status</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {INVOICES.map((invoice) => (
            <Table.Row
              key={invoice.id}
              selected={picked === invoice.id}
              onPress={() => setPicked(invoice.id)}
            >
              <Table.Cell flex={2}>{invoice.id}</Table.Cell>
              <Table.Cell>
                <Badge
                  variant={
                    invoice.status === 'Paid'
                      ? 'success'
                      : invoice.status === 'Pending'
                        ? 'warning'
                        : 'destructive'
                  }
                >
                  {invoice.status}
                </Badge>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <Text size="sm" muted>
        Selected {picked}
      </Text>
    </View>
  );
}

/**
 * More columns than a phone is wide. The table keeps a `minWidth` and scrolls
 * sideways rather than crushing the columns; the fade says there is more.
 *
 * `w-full` on the `ScrollFade` is what makes that true. Without it the wrapper
 * shrink-wraps to the scroller's content and the table runs off the screen
 * instead of clipping — a scroll view only scrolls once something has decided
 * how wide its window is.
 */
function WideTableDemo() {
  return (
    <ScrollFade size={24} className="w-full self-start">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Table variant="outline" size="sm" striped style={{ minWidth: 440 }}>
          <Table.Header>
            <Table.Row>
              <Table.Head width={86}>Invoice</Table.Head>
              <Table.Head width={100}>Customer</Table.Head>
              <Table.Head width={82}>Status</Table.Head>
              <Table.Head width={92} align="end">
                Amount
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {INVOICES.slice(0, 4).map((invoice, index) => (
              <Table.Row key={invoice.id}>
                <Table.Cell width={86}>{invoice.id}</Table.Cell>
                <Table.Cell width={100}>
                  {['Acme', 'Globex', 'Initech', 'Umbrella'][index]}
                </Table.Cell>
                <Table.Cell width={82}>{invoice.status}</Table.Cell>
                <Table.Cell width={92} align="end">
                  {invoiceAmount(invoice.amount)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </ScrollView>
    </ScrollFade>
  );
}

/** `autoGrow` only shows itself while you type, so this one holds its value. */
function TextareaGrowDemo() {
  const [message, setMessage] = useState('');

  return (
    <View className="w-full gap-4">
      <Textarea
        autoGrow
        rows={2}
        maxRows={6}
        label="Message"
        placeholder="Type a few lines…"
        description="Starts at two rows, grows to six, then scrolls."
        value={message}
        onChangeText={setMessage}
      />
      <Textarea rows={2} placeholder="Fixed at two rows, for comparison" />
    </View>
  );
}

/** The counter has to be driven by a real value to count anything. */
function TextareaCountDemo() {
  const [status, setStatus] = useState('Shipping the new calendar today.');

  return (
    <Textarea
      label="Status"
      rows={3}
      maxLength={140}
      showCount
      description="Keep it short."
      value={status}
      onChangeText={setStatus}
      containerClassName="w-full"
    />
  );
}

/**
 * A composer that both grows and gets out of the keyboard's way — the pair of
 * behaviours a chat input needs, and the one case a fixed box cannot show.
 */
function TextareaComposerDemo() {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');

  return (
    <View className="flex-1">
      <ScrollView
        contentContainerClassName="gap-3 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {[
          'The composer below starts at one row.',
          'Type past the first line and it opens up, a row at a time.',
          'At five rows it stops growing and scrolls instead.',
          'Focus it and it lifts by exactly its overlap with the keyboard.',
        ].map((line) => (
          <Card key={line}>
            <Card.Content className="p-4">
              <Text size="sm">{line}</Text>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      <KeyboardAvoider
        mode="dock"
        bottomInset={insets.bottom}
        pointerEvents="box-none"
        className="absolute left-0 right-0 px-5"
        style={{ bottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-end gap-2 rounded-3xl border border-border bg-surface p-2 shadow-lg">
          <Textarea
            autoGrow
            rows={1}
            maxRows={5}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            className="flex-1 border-0 bg-transparent px-2"
            containerClassName="flex-1"
            accessibilityLabel="Message"
          />
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
            <SendIcon size={18} />
          </View>
        </View>
      </KeyboardAvoider>
    </View>
  );
}

/** The small progress ring shown beside each row in the Frame demo. */
function Meter({ percent }: { percent: number }) {
  return (
    <View className="h-6 w-6 items-center justify-center rounded-full border-2 border-muted">
      <View
        className="absolute h-6 w-6 rounded-full border-2 border-transparent border-t-info"
        style={{ transform: [{ rotate: `${(percent / 100) * 360}deg` }] }}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* AI components                                                              */
/* -------------------------------------------------------------------------- */

const REASONING_TRACE = `The band is drawn per cell, so each one has to know whether the range carries on past its own edge.

The old rule only asked "am I between the two ends", which leaves the ends themselves with no band at all — hence the gap on either side of the disc.

Making the test inclusive and giving each end half a cell should close it.`;

const AI_SNIPPET = `const inRange = !!range?.to && isWithin(date, range.from, range.to);

// The band carries on past this cell's edge unless it stops here.
const openStart = inRange && !isStart && dayIndex > 0;
const openEnd = inRange && !isEnd && dayIndex < 6;`;

const AI_PATCH = `@@ calendar/index.tsx
-  const inRange = !!range?.to && isWithin(date, range.from, range.to) && !selected;
+  const inRange = !!range?.to && isWithin(date, range.from, range.to);`;

/**
 * A trace that actually streams, because the whole of Reasoning is what it does
 * over time — it opens itself on the way in, times the wait, and folds away a
 * beat after the tokens stop.
 */
function ReasoningStreamDemo() {
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);

  const run = () => {
    setText('');
    setStreaming(true);
    let cursor = 0;
    const timer = setInterval(() => {
      cursor += 12;
      setText(REASONING_TRACE.slice(0, cursor));
      if (cursor >= REASONING_TRACE.length) {
        clearInterval(timer);
        setStreaming(false);
      }
    }, 60);
  };

  return (
    <View className="w-full gap-4">
      <Reasoning isStreaming={streaming}>
        <Reasoning.Trigger />
        <Reasoning.Content>{text || REASONING_TRACE}</Reasoning.Content>
      </Reasoning>
      <Button variant="outline" onPress={run} disabled={streaming}>
        {streaming ? 'Thinking…' : 'Stream a trace'}
      </Button>
    </View>
  );
}

/** The trace above the answer, which is where it belongs in a real turn. */
function ReasoningInTurnDemo() {
  return (
    <Message align="start">
      <Message.Content>
        <Reasoning defaultOpen={false} duration={6}>
          <Reasoning.Trigger />
          <Reasoning.Content>{REASONING_TRACE}</Reasoning.Content>
        </Reasoning>
        <Message.Bubble>
          <Message.BubbleContent>
            The gap was the inclusive test — both ends were excluded from the
            band, so neither carried its half of it.
          </Message.BubbleContent>
        </Message.Bubble>
      </Message.Content>
    </Message>
  );
}

const AI_SOURCES = [
  { url: 'https://expo.dev/changelog/sdk-57', title: 'Expo SDK 57' },
  { url: 'https://reactnative.dev/blog/new-architecture', title: 'The New Architecture' },
  { url: 'https://docs.swmansion.com/react-native-reanimated/', title: undefined },
];

/** Citations under a turn — read after the answer, not before it. */
function SourcesInTurnDemo() {
  return (
    <Message align="start">
      <Message.Content>
        <Message.Bubble>
          <Message.BubbleContent>
            SDK 57 ships the New Architecture by default, and Reanimated 4
            requires it.
          </Message.BubbleContent>
        </Message.Bubble>
        <Sources>
          <Sources.Trigger count={AI_SOURCES.length} />
          <Sources.Content>
            {AI_SOURCES.map((source) => (
              <Sources.Source
                key={source.url}
                href={source.url}
                title={source.title}
              />
            ))}
          </Sources.Content>
        </Sources>
      </Message.Content>
    </Message>
  );
}

/** The four statuses in the order a run of work actually passes through them. */
function TaskRunDemo() {
  return (
    <View className="w-full gap-3">
      <Marker variant="separator">
        <Marker.Content>Ran 4 tools</Marker.Content>
      </Marker>
      <Task status="complete">
        <Task.Trigger title="Read 2 files" />
        <Task.Content>
          <Task.Item>
            Opened <Task.File icon={<FileIcon size={12} />}>calendar/index.tsx</Task.File>
          </Task.Item>
          <Task.Item>
            Opened <Task.File icon={<FileIcon size={12} />}>utils/date.ts</Task.File>
          </Task.Item>
        </Task.Content>
      </Task>
      <Task status="running">
        <Task.Trigger title="Editing the range band" />
        <Task.Content>
          <Task.Item>
            Rewriting the band computation in{' '}
            <Task.File>CalendarGrid</Task.File>
          </Task.Item>
        </Task.Content>
      </Task>
      <Task status="error">
        <Task.Trigger title="Typecheck failed" />
        <Task.Content>
          <Task.Item>openStart is declared but never read.</Task.Item>
        </Task.Content>
      </Task>
      <Task status="pending" defaultOpen={false}>
        <Task.Trigger title="Regenerate the docs" />
        <Task.Content>
          <Task.Item>Waiting on the typecheck.</Task.Item>
        </Task.Content>
      </Task>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Response                                                                   */
/* -------------------------------------------------------------------------- */

const ANSWER = `## Paying down a card

Two orders work, and they answer different questions.

1. **Avalanche** — highest interest rate first. Costs the least overall.
2. **Snowball** — smallest balance first. Closes an account soonest, which
   is the one that keeps people going.

> Pick the one you will still be doing in six months.

Rough sketch of the avalanche order:

\`\`\`ts
const order = cards
  .slice()
  .sort((a, b) => b.apr - a.apr);
\`\`\`

| Card | Balance | APR |
| :--- | ------: | --: |
| Blue | £2,400 | 24.9% |
| Store | £310 | 29.9% |

See [the worked example](https://example.com) for the full month-by-month.`;

/**
 * The whole surface at once — headings, lists, a quote, a fence and a table.
 * Nothing here draws its own type: it is Typography, CodeBlock and Table.
 *
 * Its own screen, because an answer is as long as it is and a snapped page
 * would crop it at whatever height the phone happens to be — hiding the table
 * and the fence, which are the two blocks worth seeing.
 */
function ResponseDemo() {
  return (
    <ScrollView contentContainerClassName="px-5 pb-12 pt-2">
      <Response>{ANSWER}</Response>
    </ScrollView>
  );
}

/** The inline marks, in one paragraph. */
function ResponseMarksDemo() {
  return (
    <Response>
      {`Rates are **fixed for 12 months**, then they *revert*. The old rate was ~~29.9%~~ and the call is \`cards.sort(byApr)\`. See [the summary](https://example.com).`}
    </Response>
  );
}

/** A GFM table, with its alignment respected. */
function ResponseTableDemo() {
  return (
    <Response>
      {`| Card | Balance | APR |\n| :--- | ------: | --: |\n| Blue | £2,400 | 24.9% |\n| Store | £310 | 29.9% |\n| Travel | £45 | 21.9% |`}
    </Response>
  );
}

/**
 * The point of the component: text arriving a token at a time, without the
 * styles flickering as their delimiters land.
 */
function ResponseStreamDemo() {
  const [shown, setShown] = useState(ANSWER.length);
  const streaming = shown < ANSWER.length;

  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => {
      // A handful of characters a frame, which is roughly how a token stream
      // actually lands — one character at a time is a typewriter, not a model.
      setShown((count) => Math.min(count + 4, ANSWER.length));
    }, 24);
    return () => clearInterval(timer);
  }, [streaming]);

  return (
    <ScrollView contentContainerClassName="gap-4 px-5 pb-12 pt-2">
      <Button variant="outline" onPress={() => setShown(0)} disabled={streaming}>
        {streaming ? 'Answering…' : 'Stream it in'}
      </Button>
      <Response isStreaming={streaming}>{ANSWER.slice(0, shown)}</Response>
    </ScrollView>
  );
}

/** Where one actually turns up: as the body of an assistant's turn. */
function ResponseInTurnDemo() {
  return (
    <Message align="start">
      <Message.Content>
        <Message.Bubble>
          <Message.BubbleContent>
            <Response>
              {`Three things changed in **Reanimated 4**:\n\n- the worklet runtime\n- \`useAnimatedStyle\` composition\n- layout animations that respect shared values\n\nThe third is the one you will notice.`}
            </Response>
          </Message.BubbleContent>
        </Message.Bubble>
      </Message.Content>
    </Message>
  );
}

/* -------------------------------------------------------------------------- */
/* Post                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The full card. Every count in the footer is live, so a press moves a number
 * rather than only lighting an icon.
 */
function FeedPostDemo() {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <Post variant="feed" className="w-full">
      <Post.Header>
        <Post.Author
          name="Dwayne F. White"
          verified
          timestamp="Posted 3m ago"
          avatar={{ uri: AVATARS[0] }}
        />
        <Post.Action>
          <EllipsisIcon size={18} />
        </Post.Action>
      </Post.Header>

      <Post.Body onTagPress={() => {}}>
        {
          "I've been working hard to pay off my credit card debt, and I'm wondering what strategies you've all found most effective? #FinancialFreedom #DebtSnowball"
        }
      </Post.Body>

      <Post.Media
        source={{ uri: POST_PHOTOS.savings }}
        alt="A coin going into a piggy bank beside stacks of change"
        overlay={
          <View className="absolute end-3 top-3 h-8 w-8 items-center justify-center rounded-lg bg-black/45">
            <MaximizeIcon size={16} color="#ffffff" />
          </View>
        }
      />

      <Post.Footer>
        <Post.Stat icon={EyeIcon} value="5,874" />
        <Post.Stat
          icon={HeartIcon}
          tone="like"
          active={liked}
          value={liked ? 216 : 215}
          onPress={() => setLiked((on) => !on)}
        />
        <Post.Stat icon={MessageCircleIcon} value="11" onPress={() => {}} />
        <Post.Stat
          icon={BookmarkIcon}
          tone="save"
          align="end"
          active={saved}
          value={saved ? 'Saved' : 'Save'}
          onPress={() => setSaved((on) => !on)}
        />
      </Post.Footer>
    </Post>
  );
}

/**
 * The ranked-community shape: a score pill beside the headline. Pressing the
 * arrow already cast clears the vote, so a mind can be changed.
 */
function VotePostDemo() {
  const [vote, setVote] = useState<PostVote>(null);
  const base = 1240;
  const score = base + (vote === 'up' ? 1 : vote === 'down' ? -1 : 0);

  return (
    <Post variant="vote" className="w-full">
      <Post.Header>
        <Post.Community
          name="r/reactnative"
          avatar={{ uri: AVATARS[1] }}
          meta="5h ago"
        />
        <Post.Action>
          <EllipsisIcon size={18} />
        </Post.Action>
      </Post.Header>

      <Post.Title>Reanimated 4 shipped — what actually changed?</Post.Title>
      <Post.Body numberOfLines={3}>
        The worklet runtime is the headline, but the part that matters day to day
        is that layout animations finally compose with shared values.
      </Post.Body>

      <Post.Footer>
        <Post.Votes score={score.toLocaleString()} vote={vote} onVote={setVote} />
        <Post.Stat icon={MessageCircleIcon} value="184" onPress={() => {}} />
        <Post.Stat icon={ShareNodesIcon} value="Share" align="end" onPress={() => {}} />
      </Post.Footer>
    </Post>
  );
}

/** A dense timeline row: name and handle on one line, no media. */
function CompactPostDemo() {
  const [liked, setLiked] = useState(true);
  const [reposted, setReposted] = useState(false);

  return (
    <Post variant="compact" className="w-full">
      <Post.Header>
        <Post.Author
          name="Ada Okonkwo"
          handle="@ada"
          timestamp="12m"
          avatar={{ uri: AVATARS[2] }}
        />
        <Post.Action>
          <EllipsisIcon size={16} />
        </Post.Action>
      </Post.Header>

      <Post.Body onMentionPress={() => {}}>
        Spent the morning deleting a caching layer nobody had touched in a year.
        Fastest the app has ever been. cc @dwayne
      </Post.Body>

      <Post.Footer>
        <Post.Stat icon={MessageCircleIcon} value="8" onPress={() => {}} />
        <Post.Stat
          icon={RepeatIcon}
          tone="repost"
          active={reposted}
          value={reposted ? 41 : 40}
          onPress={() => setReposted((on) => !on)}
        />
        <Post.Stat
          icon={HeartIcon}
          tone="like"
          active={liked}
          value={liked ? 312 : 311}
          onPress={() => setLiked((on) => !on)}
        />
        <Post.Stat icon={EyeIcon} value="9.1k" align="end" />
      </Post.Footer>
    </Post>
  );
}

/** The image is the card, and the author is laid over it. */
function MediaPostDemo() {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <Post variant="media" className="w-full">
      {/* The scrim comes with the variant: white type over a photograph is only
          legible against one, and a flat panel would have an edge of its own. */}
      <Post.Media
        source={{ uri: POST_PHOTOS.coast }}
        aspectRatio={4 / 3}
        alt="A coastline at dusk"
      />
      <Post.Header>
        <Post.Author
          name="Marta Lindqvist"
          verified
          timestamp="Yesterday"
          avatar={{ uri: AVATARS[1] }}
        />
      </Post.Header>

      <Post.Body onTagPress={() => {}}>
        Four hours of walking for eleven minutes of light. #goldenhour
      </Post.Body>

      <Post.Footer>
        <Post.Stat
          icon={HeartIcon}
          tone="like"
          active={liked}
          value={liked ? '2,041' : '2,040'}
          onPress={() => setLiked((on) => !on)}
        />
        <Post.Stat icon={MessageCircleIcon} value="63" onPress={() => {}} />
        <Post.Stat
          icon={BookmarkIcon}
          tone="save"
          align="end"
          active={saved}
          onPress={() => setSaved((on) => !on)}
        />
      </Post.Footer>
    </Post>
  );
}

/**
 * All four in a scroll, which is the only place a feed card is really judged.
 *
 * Not `fullBleed`: this one keeps the screen's header, because it has no way
 * back of its own and a feed running under the notch is a feed you cannot
 * leave.
 */
function PostFeedDemo() {
  return (
    <ScrollView
      contentContainerClassName="gap-4 px-4 pb-12 pt-1"
      showsVerticalScrollIndicator={false}
    >
      <FeedPostDemo />
      <VotePostDemo />
      <CompactPostDemo />
      <MediaPostDemo />
    </ScrollView>
  );
}

const PLAN_STEPS = [
  { title: 'Make the in-range test inclusive', meta: 'utils/date.ts' },
  { title: 'Round the band only where it stops', meta: 'calendar/index.tsx' },
  { title: 'Square the discs against the band', meta: undefined },
  { title: 'Regenerate the docs page', meta: 'scripts/gen.mjs' },
];

/** The rail: four steps, the running one marked, the finished ones filled in. */
function PlanRailDemo() {
  return (
    <Plan>
      <Plan.Header>
        <Plan.Icon>
          <ListChecksIcon size={16} />
        </Plan.Icon>
        <Plan.Title>Fix the calendar range</Plan.Title>
        <Plan.Description>Four files, and no API change.</Plan.Description>
        <Plan.Action>
          <Plan.Progress />
          <Plan.Trigger />
        </Plan.Action>
      </Plan.Header>
      <Plan.Content>
        <Plan.Steps>
          {PLAN_STEPS.map((step, index) => (
            <Plan.Step
              key={step.title}
              status={index < 2 ? 'done' : index === 2 ? 'active' : 'pending'}
              meta={step.meta}
            >
              {step.title}
            </Plan.Step>
          ))}
        </Plan.Steps>
      </Plan.Content>
      <Plan.Footer>
        <Button variant="outline">Revise</Button>
        <Button>Approve</Button>
      </Plan.Footer>
    </Plan>
  );
}

/**
 * A plan whose fields arrive one at a time, which is what the shimmer is for.
 * The rail fills in behind it, so the header count is a live one.
 */
function PlanStreamDemo() {
  const [streaming, setStreaming] = useState(false);
  const [reached, setReached] = useState(PLAN_STEPS.length);

  useEffect(() => {
    if (!streaming) return;
    const timers = PLAN_STEPS.map((_unused, index) =>
      setTimeout(() => setReached(index), 400 + index * 550)
    );
    const done = setTimeout(() => {
      setReached(PLAN_STEPS.length);
      setStreaming(false);
    }, 400 + PLAN_STEPS.length * 550);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [streaming]);

  const start = () => {
    setReached(-1);
    setStreaming(true);
  };

  return (
    <View className="w-full gap-4">
      <Plan isStreaming={streaming}>
        <Plan.Header>
          <Plan.Icon>
            <ListChecksIcon size={16} />
          </Plan.Icon>
          <Plan.Title>Fix the calendar range</Plan.Title>
          <Plan.Description>Four files, and no API change.</Plan.Description>
          <Plan.Action>
            <Plan.Progress />
            <Plan.Trigger />
          </Plan.Action>
        </Plan.Header>
        <Plan.Content>
          <Plan.Steps>
            {PLAN_STEPS.map((step, index) => (
              <Plan.Step
                key={step.title}
                status={
                  index < reached ? 'done' : index === reached ? 'active' : 'pending'
                }
                meta={step.meta}
              >
                {step.title}
              </Plan.Step>
            ))}
          </Plan.Steps>
        </Plan.Content>
        <Plan.Footer>
          <Button variant="outline">Revise</Button>
          <Button>Approve</Button>
        </Plan.Footer>
      </Plan>
      <Button variant="outline" onPress={start} disabled={streaming}>
        {streaming ? 'Writing…' : 'Stream it in'}
      </Button>
    </View>
  );
}

/** A plan being carried out: the steps have statuses, so they are tasks. */
function PlanWithTasksDemo() {
  return (
    <Plan>
      <Plan.Header>
        <Plan.Title>Fix the calendar range</Plan.Title>
        <Plan.Action>
          <Badge variant="secondary">2 of 3</Badge>
          <Plan.Trigger />
        </Plan.Action>
      </Plan.Header>
      <Plan.Content>
        <Task status="complete">
          <Task.Trigger title="Make the test inclusive" />
          <Task.Content>
            <Task.Item>
              Edited <Task.File>calendar/index.tsx</Task.File>
            </Task.Item>
          </Task.Content>
        </Task>
        <Task status="complete">
          <Task.Trigger title="Round only where it stops" />
          <Task.Content>
            <Task.Item>Four corners, from openStart and openEnd.</Task.Item>
          </Task.Content>
        </Task>
        <Task status="running">
          <Task.Trigger title="Regenerate the docs" />
          <Task.Content>
            <Task.Item>Running docs:generate…</Task.Item>
          </Task.Content>
        </Task>
      </Plan.Content>
    </Plan>
  );
}

/** A snippet where one actually turns up: inside a turn. */
function CodeBlockInTurnDemo() {
  return (
    <Message align="start">
      <Message.Content>
        <Message.Bubble>
          <Message.BubbleContent>Here is the fix:</Message.BubbleContent>
        </Message.Bubble>
        <CodeBlock code={AI_SNIPPET} language="ts">
          <CodeBlock.Header>
            <CodeBlock.Filename>calendar/index.tsx</CodeBlock.Filename>
            <CodeBlock.Actions>
              <CodeBlock.CopyButton />
            </CodeBlock.Actions>
          </CodeBlock.Header>
        </CodeBlock>
      </Message.Content>
    </Message>
  );
}

/**
 * The whole shape of an agent turn, which is the only way any of these five
 * components makes sense: a plan, the steps that carried it out, the reasoning
 * behind the answer, the answer, its code, and where it came from.
 */
function AgentTranscriptDemo() {
  return (
    <MessageScroller className="flex-1">
      <MessageScroller.Viewport>
        <MessageScroller.Content className="gap-4 px-5 py-6">
          <MessageScroller.Item messageId="ask">
            <Message align="end">
              <Message.Content>
                <Message.Bubble>
                  <Message.BubbleContent>
                    The calendar range has a gap at each end. Can you fix it?
                  </Message.BubbleContent>
                </Message.Bubble>
              </Message.Content>
            </Message>
          </MessageScroller.Item>

          <MessageScroller.Item messageId="plan">
            <PlanWithTasksDemo />
          </MessageScroller.Item>

          <MessageScroller.Item messageId="answer">
            <Message align="start">
              <Message.Content>
                <Reasoning defaultOpen={false} duration={6}>
                  <Reasoning.Trigger />
                  <Reasoning.Content>{REASONING_TRACE}</Reasoning.Content>
                </Reasoning>
                <Message.Bubble>
                  <Message.BubbleContent>
                    Both ends were excluded from the band, so neither carried its
                    half of it. One character:
                  </Message.BubbleContent>
                </Message.Bubble>
                <CodeBlock code={AI_PATCH} language="diff">
                  <CodeBlock.Header>
                    <CodeBlock.Language>diff</CodeBlock.Language>
                    <CodeBlock.Actions>
                      <CodeBlock.CopyButton />
                    </CodeBlock.Actions>
                  </CodeBlock.Header>
                </CodeBlock>
                <Sources>
                  <Sources.Trigger count={AI_SOURCES.length} />
                  <Sources.Content>
                    {AI_SOURCES.map((source) => (
                      <Sources.Source
                        key={source.url}
                        href={source.url}
                        title={source.title}
                      />
                    ))}
                  </Sources.Content>
                </Sources>
              </Message.Content>
            </Message>
          </MessageScroller.Item>
        </MessageScroller.Content>
      </MessageScroller.Viewport>
    </MessageScroller>
  );
}

const DEPLOY_LOG = [
  {
    time: '09:12',
    title: 'Migration drafted',
    badge: 'Assigned',
    tone: 'default' as const,
    Icon: PlusSquareIcon,
    body: 'Schema change written for the reporting cluster.',
  },
  {
    time: '09:34',
    title: 'Shadow traffic enabled',
    badge: 'Shadow',
    tone: 'info' as const,
    Icon: ShareNodesIcon,
    body: 'Mirroring 5% of reads with query timing captured.',
  },
  {
    time: '09:51',
    title: 'Replica lag alarm',
    badge: 'Holding',
    tone: 'warning' as const,
    Icon: ShieldAlertIcon,
    body: 'Lag passed 400ms in eu-west-2; the cutover is paused.',
  },
  {
    time: '10:05',
    title: 'Runbook circulated',
    badge: 'Docs',
    tone: 'default' as const,
    Icon: BellIcon,
    body: 'On-call has the rollback steps and the owner list.',
  },
  {
    time: '10:42',
    title: 'Cutover approved',
    badge: 'Ready',
    tone: 'success' as const,
    Icon: ShieldCheckIcon,
    body: 'Lag recovered and every pre-flight check is green.',
  },
];

/** Leading time column, outlined icon nodes, a chip beside each title. */
function DeployLogDemo() {
  return (
    <View className="w-full gap-4">
      <View>
        <Text size="sm" muted>
          Migration audit
        </Text>
        <Text size="xl" weight="semibold">
          Reporting cluster
        </Text>
      </View>
      <Timeline variant="icon" value={DEPLOY_LOG.length - 1} className="w-full">
        {DEPLOY_LOG.map((entry, index) => (
          <Timeline.Item
            key={entry.title}
            step={index}
            tone={entry.tone}
            last={index === DEPLOY_LOG.length - 1}
          >
            <Timeline.Aside className="w-12">
              <Timeline.Date>{entry.time}</Timeline.Date>
            </Timeline.Aside>
            <Timeline.Indicator>
              <entry.Icon size={15} />
            </Timeline.Indicator>
            <Timeline.Content>
              <Timeline.Header>
                <Timeline.Title>{entry.title}</Timeline.Title>
                <Badge variant="secondary">{entry.badge}</Badge>
              </Timeline.Header>
              <Timeline.Description>{entry.body}</Timeline.Description>
            </Timeline.Content>
          </Timeline.Item>
        ))}
      </Timeline>
    </View>
  );
}

/** Solid dots, timestamps trailing the title, one entry carrying media. */
function StudioFeedDemo() {
  return (
    <Timeline variant="dot" value={3} className="w-full">
      <Timeline.Item step={0} tone="info">
        <Timeline.Indicator />
        <Timeline.Content>
          <Timeline.Header>
            <Timeline.Title>Cover art uploaded</Timeline.Title>
            <Badge variant="info">Review</Badge>
            <Timeline.Trailing>10:18</Timeline.Trailing>
          </Timeline.Header>
          <View className="mt-2 overflow-hidden rounded-xl border border-border">
            <Image
              source={{ uri: PHOTO }}
              style={{ width: '100%', height: 140 }}
              resizeMode="cover"
            />
            <View className="gap-2 p-3">
              <Text size="sm" muted>
                Final crop is ready for retouch, with the detail shot and the
                thumbnail queued behind it.
              </Text>
              <View className="flex-row gap-2">
                <Badge variant="secondary">Hero</Badge>
                <Badge variant="secondary">4 crops</Badge>
              </View>
            </View>
          </View>
        </Timeline.Content>
      </Timeline.Item>
      <Timeline.Item step={1} tone="warning">
        <Timeline.Indicator />
        <Timeline.Content>
          <Timeline.Header>
            <Timeline.Title>Lighting pass reviewed</Timeline.Title>
            <Timeline.Trailing>10:27</Timeline.Trailing>
          </Timeline.Header>
          <Timeline.Description>
            The side profile reads clearly; keep the shadow soft.
          </Timeline.Description>
        </Timeline.Content>
      </Timeline.Item>
      <Timeline.Item step={2} tone="success">
        <Timeline.Indicator />
        <Timeline.Content>
          <Timeline.Header>
            <Timeline.Title>Copy note resolved</Timeline.Title>
            <Timeline.Trailing>10:43</Timeline.Trailing>
          </Timeline.Header>
          <Timeline.Description>
            Launch tile copy now matches the campaign language.
          </Timeline.Description>
        </Timeline.Content>
      </Timeline.Item>
      <Timeline.Item step={3} tone="info" last>
        <Timeline.Indicator />
        <Timeline.Content>
          <Timeline.Header>
            <Timeline.Title>Package exported</Timeline.Title>
            <Timeline.Trailing>11:06</Timeline.Trailing>
          </Timeline.Header>
          <Timeline.Description>
            Square crop, product view and thumbnail are out.
          </Timeline.Description>
        </Timeline.Content>
      </Timeline.Item>
    </Timeline>
  );
}

const LEDGER = [
  { title: 'Dispute opened', time: 'Mar 6, 10:34', tone: 'warning' as const, Icon: ShieldAlertIcon, body: 'The customer disputed a renewal; finance has seven days.' },
  { title: 'Payment captured', time: 'Mar 6, 10:21', tone: 'success' as const, Icon: CardIcon },
  { title: 'Payment authorised', time: 'Mar 6, 10:21', tone: 'default' as const, Icon: ShieldCheckIcon },
  { title: 'Invoice generated', time: 'Mar 6, 10:20', tone: 'default' as const, Icon: ReceiptIcon },
];

/** Dense rows for an audit trail — small nodes, timestamps trailing. */
function LedgerDemo() {
  return (
    <Timeline variant="compact" value={0} className="w-full">
      {LEDGER.map((entry, index) => (
        <Timeline.Item
          key={entry.title}
          step={index}
          tone={entry.tone}
          last={index === LEDGER.length - 1}
        >
          <Timeline.Indicator>
            <entry.Icon size={13} />
          </Timeline.Indicator>
          <Timeline.Content>
            <Timeline.Header>
              <Timeline.Title>{entry.title}</Timeline.Title>
              <Timeline.Trailing>{entry.time}</Timeline.Trailing>
            </Timeline.Header>
            {entry.body ? (
              <Timeline.Description>{entry.body}</Timeline.Description>
            ) : null}
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

const HANDOFF = [
  {
    time: '09:15', team: 'Design', person: 'Nina Park', tone: 'default' as const,
    Icon: SendIcon, title: 'Checkout copy approved',
    stats: [['Screens', '18'], ['Open notes', '2']],
    body: 'Invoice copy, empty states and seat-change messages passed.',
  },
  {
    time: '12:05', team: 'Data', person: 'Maya Hart', tone: 'info' as const,
    Icon: ShareNodesIcon, title: 'Metrics pipeline connected',
    stats: [['Events', '12'], ['Lag', '42 s']],
    body: 'Billing telemetry is flowing into the release dashboard.',
  },
  {
    time: '15:00', team: 'Launch', person: 'Eli Wong', tone: 'success' as const,
    Icon: ShieldCheckIcon, title: 'Checklist signed off',
    stats: [['Checks', '9/9'], ['Window', '15 min']],
    body: 'Rollback owner, dashboard links and launch channel are pinned.',
  },
];

/** Meta column on the left, a stats strip under each title. */
function HandoffDemo() {
  return (
    <View className="w-full gap-4">
      <View className="items-center">
        <Text size="sm" muted>
          Launch review
        </Text>
        <Text size="xl" weight="semibold">
          Billing rollout
        </Text>
      </View>
      <Timeline variant="icon" value={HANDOFF.length - 1} className="w-full">
        {HANDOFF.map((entry, index) => (
          <Timeline.Item
            key={entry.title}
            step={index}
            tone={entry.tone}
            last={index === HANDOFF.length - 1}
          >
            <Timeline.Aside>
              <Timeline.Date>{entry.time}</Timeline.Date>
              <Timeline.Label>{entry.team}</Timeline.Label>
              <Timeline.Meta>{entry.person}</Timeline.Meta>
            </Timeline.Aside>
            <Timeline.Indicator>
              <entry.Icon size={15} />
            </Timeline.Indicator>
            <Timeline.Content>
              <Timeline.Title>{entry.title}</Timeline.Title>
              <Timeline.Stats>
                {entry.stats.map(([label, value]) => (
                  <Timeline.Stat key={label} label={label!} value={value!} />
                ))}
              </Timeline.Stats>
              <Timeline.Description>{entry.body}</Timeline.Description>
            </Timeline.Content>
          </Timeline.Item>
        ))}
      </Timeline>
    </View>
  );
}

const TIMELINE_DATA = [
  { date: 'Mar 12', title: 'Order placed', body: 'We received your order.' },
  { date: 'Mar 13', title: 'Packed', body: 'Your items left the warehouse.' },
  { date: 'Mar 15', title: 'In transit', body: 'Out with the courier.' },
  { date: 'Mar 17', title: 'Delivered', body: 'Left at the front door.' },
];

/** Renders the shared timeline data in whichever variant is asked for. */
function TimelineDemo({
  variant,
  value = 2,
}: {
  variant: 'dot' | 'icon' | 'numbered' | 'card';
  value?: number;
}) {
  return (
    <Timeline variant={variant} value={value} className="w-full">
      {TIMELINE_DATA.map((entry, index) => (
        <Timeline.Item
          key={entry.title}
          step={index}
          last={index === TIMELINE_DATA.length - 1}
        >
          <Timeline.Indicator>
            <CheckIcon size={14} />
          </Timeline.Indicator>
          <Timeline.Content>
            <Timeline.Header>
              <Timeline.Date>{entry.date}</Timeline.Date>
              <Timeline.Title>{entry.title}</Timeline.Title>
            </Timeline.Header>
            <Timeline.Description>{entry.body}</Timeline.Description>
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline>
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
/* Tree                                                                       */
/* -------------------------------------------------------------------------- */

type TreeNodeData = { value: string; label: string; children?: TreeNodeData[] };

const PROJECT_TREE: TreeNodeData[] = [
  {
    value: 'src',
    label: 'src',
    children: [
      {
        value: 'src/components',
        label: 'components',
        children: [
          { value: 'src/components/button.tsx', label: 'button.tsx' },
          { value: 'src/components/tree.tsx', label: 'tree.tsx' },
        ],
      },
      {
        value: 'src/primitives',
        label: 'primitives',
        children: [{ value: 'src/primitives/text.tsx', label: 'text.tsx' }],
      },
      { value: 'src/index.ts', label: 'index.ts' },
    ],
  },
  { value: 'package.json', label: 'package.json' },
  { value: 'README.md', label: 'README.md' },
];

/**
 * One recursive renderer, shared by every Tree demo — a tree in an app is
 * almost always a walk over data rather than hand-written rows, so the demos
 * are written the way the component is actually used.
 *
 * Every row fills its `Tree.Icon`: a folder for a branch, a document for a
 * leaf. An icon slot left empty is still a slot, so a folder whose glyph is
 * missing pushes its name a full box away from its own chevron while the files
 * under it line up correctly — the row reads as broken rather than as spaced.
 * `expanded` is threaded down for the same reason the chevron turns: a folder
 * that is open should look open.
 */
function TreeNodes({ nodes, expanded }: { nodes: TreeNodeData[]; expanded: string[] }) {
  return (
    <>
      {nodes.map((node) => {
        const isOpen = expanded.includes(node.value);
        return (
          <Tree.Item key={node.value} value={node.value}>
            <Tree.Trigger>
              <Tree.Indicator />
              <Tree.Icon>
                {node.children ? (
                  isOpen ? (
                    <FolderOpenIcon size={15} />
                  ) : (
                    <FolderIcon size={15} />
                  )
                ) : (
                  <FileIcon size={14} />
                )}
              </Tree.Icon>
              <Tree.Label>{node.label}</Tree.Label>
            </Tree.Trigger>
            {node.children ? (
              <Tree.Group>
                <TreeNodes nodes={node.children} expanded={expanded} />
              </Tree.Group>
            ) : null}
          </Tree.Item>
        );
      })}
    </>
  );
}

/**
 * The file tree, with and without guide lines. Expansion is controlled rather
 * than left to `defaultExpanded` only because the rows need to know which
 * folders are open to draw the right glyph; the component does not require it.
 */
function TreeFilesDemo({ showLines = false }: { showLines?: boolean }) {
  const [expanded, setExpanded] = useState<string[]>(
    showLines ? ['src', 'src/components'] : ['src']
  );

  return (
    <Tree expanded={expanded} onExpandedChange={setExpanded} showLines={showLines}>
      <TreeNodes nodes={PROJECT_TREE} expanded={expanded} />
    </Tree>
  );
}

function TreeSelectionDemo({ mode }: { mode: 'single' | 'multiple' }) {
  const [selected, setSelected] = useState<string | string[]>(mode === 'multiple' ? [] : '');
  const [expanded, setExpanded] = useState<string[]>(['src', 'src/components']);
  const chosen = Array.isArray(selected) ? selected : selected ? [selected] : [];

  return (
    <View className="w-full gap-3">
      <Tree
        selectionMode={mode}
        value={selected}
        onValueChange={setSelected}
        expanded={expanded}
        onExpandedChange={setExpanded}
        showLines
      >
        <TreeNodes nodes={PROJECT_TREE} expanded={expanded} />
      </Tree>
      <Text size="xs" muted>
        {chosen.length ? chosen.join(', ') : 'Nothing selected'}
      </Text>
    </View>
  );
}

const LAZY_CHILDREN: TreeNodeData[] = [
  { value: 'archive/2024.zip', label: '2024.zip' },
  { value: 'archive/2025.zip', label: '2025.zip' },
];

/**
 * A branch whose contents are fetched the first time it opens. It has no
 * `Tree.Group` to be recognised by until they arrive, so it says `hasChildren`
 * to earn its chevron, and the fetch hangs off `onExpandedChange`.
 */
function TreeLazyDemo() {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<TreeNodeData[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExpandedChange = (next: string[]) => {
    setExpanded(next);
    if (next.includes('archive') && !loaded && !loading) {
      setLoading(true);
      setTimeout(() => {
        setLoaded(LAZY_CHILDREN);
        setLoading(false);
      }, 900);
    }
  };

  return (
    <Tree expanded={expanded} onExpandedChange={handleExpandedChange} showLines>
      <Tree.Item value="archive" hasChildren>
        <Tree.Trigger>
          <Tree.Indicator />
          <Tree.Icon>
            {expanded.includes('archive') ? (
              <FolderOpenIcon size={15} />
            ) : (
              <FolderIcon size={15} />
            )}
          </Tree.Icon>
          <Tree.Label>archive</Tree.Label>
          <Tree.Actions>{loading ? <Spinner size="sm" /> : null}</Tree.Actions>
        </Tree.Trigger>
        {loaded ? (
          <Tree.Group>
            <TreeNodes nodes={loaded} expanded={expanded} />
          </Tree.Group>
        ) : null}
      </Tree.Item>
      <TreeNodes nodes={PROJECT_TREE.slice(1)} expanded={expanded} />
    </Tree>
  );
}

const NAV_TREE: Array<TreeNodeData & { count?: number }> = [
  {
    value: 'inbox',
    label: 'Inbox',
    children: [
      { value: 'inbox/unread', label: 'Unread' },
      { value: 'inbox/flagged', label: 'Flagged' },
    ],
  },
  {
    value: 'projects',
    label: 'Projects',
    children: [
      { value: 'projects/panelui', label: 'PanelUI' },
      { value: 'projects/docs', label: 'Docs' },
    ],
  },
];

const NAV_COUNTS: Record<string, number> = {
  'inbox/unread': 12,
  'inbox/flagged': 3,
  'projects/panelui': 8,
};

/** A sidebar nav at `sm`, with a per-row count in the trailing slot. */
function TreeNavDemo() {
  const [active, setActive] = useState<string | string[]>('inbox/unread');

  return (
    <Tree
      size="sm"
      selectionMode="single"
      value={active}
      onValueChange={setActive}
      defaultExpanded={['inbox', 'projects']}
      expandOnPress={false}
    >
      {NAV_TREE.map((section) => (
        <Tree.Item key={section.value} value={section.value}>
          <Tree.Trigger>
            <Tree.Indicator />
            <Tree.Label>{section.label}</Tree.Label>
          </Tree.Trigger>
          <Tree.Group>
            {section.children?.map((child) => (
              <Tree.Item key={child.value} value={child.value}>
                <Tree.Trigger>
                  <Tree.Indicator />
                  <Tree.Label>{child.label}</Tree.Label>
                  <Tree.Actions>
                    {NAV_COUNTS[child.value] ? (
                      <Badge variant="secondary" count={NAV_COUNTS[child.value]} />
                    ) : null}
                  </Tree.Actions>
                </Tree.Trigger>
              </Tree.Item>
            ))}
          </Tree.Group>
        </Tree.Item>
      ))}
    </Tree>
  );
}

const STEP_DATA = [
  { title: 'Account', description: 'Create your login' },
  { title: 'Profile', description: 'Tell us about you' },
  { title: 'Billing', description: 'Add a payment method' },
];

function StepsDemo() {
  const [step, setStep] = useState(1);

  return (
    <View className="w-full gap-6">
      <Steps value={step} onValueChange={setStep}>
        {STEP_DATA.map((item, index) => (
          <Steps.Item
            key={item.title}
            step={index}
            className={index < STEP_DATA.length - 1 ? 'flex-1' : undefined}
          >
            <Steps.Trigger>
              <Steps.Indicator />
            </Steps.Trigger>
            {index < STEP_DATA.length - 1 ? <Steps.Separator /> : null}
          </Steps.Item>
        ))}
      </Steps>
      <View className="items-center gap-1">
        <Text weight="medium">{STEP_DATA[step]?.title}</Text>
        <Text size="sm" muted>
          {STEP_DATA[step]?.description}
        </Text>
      </View>
      <View className="flex-row gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={step === 0}
          onPress={() => setStep((current) => Math.max(0, current - 1))}
        >
          Back
        </Button>
        <Button
          className="flex-1"
          disabled={step === STEP_DATA.length - 1}
          onPress={() =>
            setStep((current) => Math.min(STEP_DATA.length - 1, current + 1))
          }
        >
          Next
        </Button>
      </View>
    </View>
  );
}

function ToastDemo() {
  const { toast } = useToast();

  return (
    <View className="w-full gap-3">
      <Button variant="outline" onPress={() => toast.show('Link copied to clipboard')}>
        Simple string
      </Button>
      <Button
        variant="outline"
        onPress={() =>
          toast.show({
            variant: 'success',
            label: 'Deployment complete',
            description: 'panelui.dev is live on production.',
            actionLabel: 'View',
          })
        }
      >
        With action
      </Button>
      <Button
        variant="outline"
        onPress={() =>
          toast.show({
            variant: 'destructive',
            label: 'Upload failed',
            description: 'The file exceeds the 25 MB limit.',
            placement: 'top',
          })
        }
      >
        Destructive, top
      </Button>
      <Button
        variant="outline"
        onPress={() => {
          // Fire several at once to show the deck: newest in front, the rest
          // peeking out behind it.
          (['default', 'info', 'success', 'warning'] as const).forEach(
            (variant, index) =>
              setTimeout(
                () =>
                  toast.show({
                    variant,
                    label: `Notification ${index + 1}`,
                    description: 'Swipe down to dismiss the front one.',
                    duration: 8000,
                  }),
                index * 220
              )
          );
        }}
      >
        Stack four
      </Button>
      <Button variant="ghost" onPress={() => toast.hideAll()}>
        Hide all
      </Button>
      <Button
        variant="outline"
        onPress={() =>
          toast.show({
            duration: 6000,
            component: ({ hide }) => (
              <Toast variant="info" onHide={hide}>
                <Toast.Indicator />
                <Toast.Content>
                  <Toast.Title>Custom component</Toast.Title>
                  <Toast.Description>
                    Rendered entirely by the caller.
                  </Toast.Description>
                </Toast.Content>
                <Toast.Close />
              </Toast>
            ),
          })
        }
      >
        Custom component
      </Button>
    </View>
  );
}

/** The layout kit on its own — a grouped set, a horizontal row, a manual error. */
function FieldDemo() {
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [username, setUsername] = useState('taken-name');
  const errors = username === 'taken-name' ? ['That username is already taken.'] : [];

  return (
    <View className="w-full gap-6">
      <Field.Set>
        <Field.Legend>Notifications</Field.Legend>
        <Checkbox checked={email} onCheckedChange={setEmail} label="Email" />
        <Checkbox checked={sms} onCheckedChange={setSms} label="SMS" />
      </Field.Set>

      <Field.Separator />

      <Field orientation="horizontal">
        <Field.Content>
          <Field.Title>Advanced analytics</Field.Title>
          <Field.Description>Included with the Pro plan.</Field.Description>
        </Field.Content>
        <Switch value={analytics} onValueChange={setAnalytics} />
      </Field>

      <Field invalid={errors.length > 0}>
        <Field.Label isRequired>Username</Field.Label>
        <Input value={username} onChangeText={setUsername} />
        <Field.Error errors={errors} />
      </Field>
    </View>
  );
}

/** A two-field form, validated on blur, wired to `useForm` and `Form.Field`. */
function FormDemo() {
  const { toast } = useToast();
  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async (values) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      toast.show({ variant: 'success', label: `Signed in as ${values.email}` });
      form.reset();
    },
  });

  return (
    <Form form={form}>
      <View className="w-full gap-4">
        <Form.Field
          name="email"
          validate={(value: string) => (value.includes('@') ? undefined : 'Enter a valid email')}
        >
          {(field) => (
            <Input
              label="Email"
              placeholder="you@example.com"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={field.error}
            />
          )}
        </Form.Field>
        <Form.Field
          name="password"
          validate={(value: string) => (value.length >= 8 ? undefined : 'At least 8 characters')}
        >
          {(field) => (
            <Input
              label="Password"
              secureTextEntry
              placeholder="••••••••"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={field.error}
            />
          )}
        </Form.Field>
        <Button loading={form.isSubmitting} onPress={form.handleSubmit}>
          Sign in
        </Button>
      </View>
    </Form>
  );
}

/**
 * The fuller version: cross-field validation (`confirmPassword` against
 * `password`), a checkbox field whose control takes a differently-shaped
 * change prop, and a submit that only fires once every field passes.
 */
function SignUpFormVersion() {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const form = useForm({
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', acceptedTerms: false },
    validate: (values) =>
      values.password !== values.confirmPassword
        ? { confirmPassword: 'Passwords must match' }
        : {},
    onSubmit: async (values) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast.show({ variant: 'success', label: `Welcome, ${values.name}` });
      form.reset();
    },
  });

  return (
    <ScrollView
      contentContainerClassName="gap-4 px-5 pt-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Form form={form}>
        <Card className="w-full">
          <Card.Header>
            <Card.Title>Create an account</Card.Title>
            <Card.Description>It takes less than a minute.</Card.Description>
          </Card.Header>
          <Card.Content className="gap-4">
            <Form.Field
              name="name"
              validate={(value: string) => (value ? undefined : 'Required')}
            >
              {(field) => (
                <Input
                  label="Full name"
                  isRequired
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={field.error}
                />
              )}
            </Form.Field>
            <Form.Field
              name="email"
              validate={(value: string) => (value.includes('@') ? undefined : 'Enter a valid email')}
            >
              {(field) => (
                <Input
                  label="Email"
                  isRequired
                  placeholder="you@example.com"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={field.error}
                />
              )}
            </Form.Field>
            <Form.Field
              name="password"
              validate={(value: string) => (value.length >= 8 ? undefined : 'At least 8 characters')}
            >
              {(field) => (
                <Input
                  label="Password"
                  isRequired
                  secureTextEntry
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={field.error}
                />
              )}
            </Form.Field>
            <Form.Field name="confirmPassword">
              {(field) => (
                <Input
                  label="Confirm password"
                  isRequired
                  secureTextEntry
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={field.error}
                />
              )}
            </Form.Field>
            <Form.Field
              name="acceptedTerms"
              validate={(value: boolean) => (value ? undefined : 'Required to continue')}
            >
              {(field) => (
                <Field invalid={!!field.error}>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="I accept the terms"
                  />
                  <Field.Error>{field.error}</Field.Error>
                </Field>
              )}
            </Form.Field>
          </Card.Content>
          <Card.Footer>
            <Button fullWidth loading={form.isSubmitting} onPress={form.handleSubmit}>
              Create account
            </Button>
          </Card.Footer>
        </Card>
      </Form>
    </ScrollView>
  );
}

/** The layout kit without a form hook — grouping, a horizontal row, a rule. */
function PreferencesVersion() {
  const insets = useSafeAreaInsets();
  const [marketing, setMarketing] = useState(true);
  const [product, setProduct] = useState(true);
  const [thirdParty, setThirdParty] = useState(false);
  const [publicProfile, setPublicProfile] = useState(false);

  return (
    <ScrollView
      contentContainerClassName="gap-4 px-5 pt-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Card className="w-full">
        <Card.Header>
          <Card.Title>Preferences</Card.Title>
          <Card.Description>Manage what you hear from us.</Card.Description>
        </Card.Header>
        <Card.Content className="gap-5">
          <Field.Set>
            <Field.Legend>Emails</Field.Legend>
            <Field orientation="horizontal">
              <Field.Content>
                <Field.Title>Marketing</Field.Title>
                <Field.Description>Offers and announcements.</Field.Description>
              </Field.Content>
              <Switch value={marketing} onValueChange={setMarketing} />
            </Field>
            <Field orientation="horizontal">
              <Field.Content>
                <Field.Title>Product updates</Field.Title>
                <Field.Description>New features and releases.</Field.Description>
              </Field.Content>
              <Switch value={product} onValueChange={setProduct} />
            </Field>
            <Field orientation="horizontal">
              <Field.Content>
                <Field.Title>Third-party offers</Field.Title>
                <Field.Description>From partners we work with.</Field.Description>
              </Field.Content>
              <Switch value={thirdParty} onValueChange={setThirdParty} />
            </Field>
          </Field.Set>

          <Field.Separator>Profile</Field.Separator>

          <Field orientation="horizontal">
            <Field.Content>
              <Field.Title>Public profile</Field.Title>
              <Field.Description>Anyone can see your activity.</Field.Description>
            </Field.Content>
            <Switch value={publicProfile} onValueChange={setPublicProfile} />
          </Field>
        </Card.Content>
      </Card>
    </ScrollView>
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

const GOALS: RingDatum[] = [
  { label: 'Move', value: 486, maxValue: 600 },
  { label: 'Exercise', value: 24, maxValue: 30 },
  { label: 'Stand', value: 9, maxValue: 12 },
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
/* GridItem                                                                   */
/* -------------------------------------------------------------------------- */

/** A dashboard's worth of numbers, at four sizes. */
function GridItemBentoDemo() {
  return (
    /*
     * A row height rather than an aspect, and it is set from what the tiles
     * have to hold rather than from the shape that looked right: the tallest
     * of these is an icon, a title, a figure and a line under it, and a cell
     * shorter than that clips the last of them. A tile's height is its cells.
     */
    <GridItem.Group columns={2} gap={12} rowHeight={164} className="w-full">
      <GridItem colSpan={2}>
        <GridItem.Media variant="icon">
          <SparklesIcon size={18} />
        </GridItem.Media>
        <GridItem.Title>Deploys</GridItem.Title>
        <GridItem.Value>1,284</GridItem.Value>
        <GridItem.Description numberOfLines={1}>
          this week, across 12 projects
        </GridItem.Description>
      </GridItem>
      <GridItem>
        <GridItem.Title>Uptime</GridItem.Title>
        <GridItem.Value>99.98%</GridItem.Value>
        <GridItem.Footer>
          <Badge variant="secondary">30 days</Badge>
        </GridItem.Footer>
      </GridItem>
      <GridItem variant="muted">
        <GridItem.Title>p95 latency</GridItem.Title>
        <GridItem.Value>142ms</GridItem.Value>
        <GridItem.Description numberOfLines={1}>down 18ms</GridItem.Description>
      </GridItem>
    </GridItem.Group>
  );
}

/**
 * What the spans actually do.
 *
 * The tall tile is the one to watch: the two after it tuck in beside it rather
 * than starting a new row, which is the thing a wrapping row of views cannot do
 * and the reason the group places its tiles itself.
 */
function GridItemSpansDemo() {
  return (
    <GridItem.Group columns={3} gap={10} className="w-full">
      <GridItem rowSpan={2} variant="muted">
        <GridItem.Title>rowSpan 2</GridItem.Title>
        <GridItem.Description>
          Two rows tall. The next tiles fill in beside it.
        </GridItem.Description>
      </GridItem>
      <GridItem colSpan={2}>
        <GridItem.Title>colSpan 2</GridItem.Title>
      </GridItem>
      <GridItem>
        <GridItem.Title>1 × 1</GridItem.Title>
      </GridItem>
      <GridItem>
        <GridItem.Title>1 × 1</GridItem.Title>
      </GridItem>
      <GridItem colSpan={3} variant="outline">
        <GridItem.Title>colSpan 3</GridItem.Title>
        <GridItem.Description>A full-width band under the rest.</GridItem.Description>
      </GridItem>
    </GridItem.Group>
  );
}

/** Tiles that go somewhere. Pressing one dims it and gives a little. */
function GridItemPressableDemo() {
  const [opened, setOpened] = useState<string | null>(null);

  const tiles = [
    { key: 'billing', label: 'Billing', caption: '3 invoices due' },
    { key: 'team', label: 'Team', caption: '12 members' },
    { key: 'keys', label: 'API keys', caption: '2 active' },
    { key: 'logs', label: 'Logs', caption: 'Live' },
  ];

  return (
    <View className="w-full gap-3">
      <GridItem.Group columns={2} gap={12} aspect={1.9} size="sm">
        {tiles.map((tile) => (
          <GridItem key={tile.key} onPress={() => setOpened(tile.label)}>
            <GridItem.Title>{tile.label}</GridItem.Title>
            <GridItem.Footer>
              <Text size="xs" className="flex-1 text-muted-foreground">
                {tile.caption}
              </Text>
              <ChevronRightIcon size={14} />
            </GridItem.Footer>
          </GridItem>
        ))}
      </GridItem.Group>
      <Text size="xs" muted className="text-center">
        {opened ? `Opened ${opened}` : 'Press a tile'}
      </Text>
    </View>
  );
}

/** Three across at the smaller density, for a grid of shortcuts. */
function GridItemCompactDemo() {
  const shortcuts = [
    { label: 'Search', icon: <SearchIcon size={16} /> },
    { label: 'Upload', icon: <PackageIcon size={16} /> },
    { label: 'Invite', icon: <PlusSquareIcon size={16} /> },
    { label: 'Export', icon: <ReceiptIcon size={16} /> },
    { label: 'Schedule', icon: <CalendarIcon size={16} /> },
    { label: 'Alerts', icon: <BellIcon size={16} /> },
  ];

  return (
    <GridItem.Group columns={3} gap={10} size="sm" className="w-full">
      {shortcuts.map((shortcut) => (
        <GridItem key={shortcut.label} onPress={() => {}}>
          <GridItem.Media variant="icon">{shortcut.icon}</GridItem.Media>
          <GridItem.Footer>
            <GridItem.Title numberOfLines={1}>{shortcut.label}</GridItem.Title>
          </GridItem.Footer>
        </GridItem>
      ))}
    </GridItem.Group>
  );
}

/** Seven days of something, for the tile that carries a shape behind it. */
const TILE_TREND = [
  { day: 'M', v: 18 },
  { day: 'T', v: 26 },
  { day: 'W', v: 21 },
  { day: 'T', v: 34 },
  { day: 'F', v: 41 },
  { day: 'S', v: 37 },
  { day: 'S', v: 52 },
];

/**
 * The layer behind the text, which is what makes a bento a bento rather than a
 * wall of stat cards. The tile clips it, so it is meant to run off the edges.
 */
function GridItemBackgroundDemo() {
  return (
    <GridItem.Group columns={2} gap={12} rowHeight={132} className="w-full">
      <GridItem colSpan={2}>
        <GridItem.Background>
          {/* Pinned to the bottom and allowed to bleed off both sides — the
              shape is the decoration, not a chart anyone reads values off. */}
          <View className="mt-auto h-20 w-full opacity-60">
            <LineChart data={TILE_TREND} compact aspectRatio={3.4}>
              <LineChart.Area dataKey="v" />
              <LineChart.Line dataKey="v" />
            </LineChart>
          </View>
        </GridItem.Background>
        <GridItem.Title>Requests</GridItem.Title>
        <GridItem.Value>52.4k</GridItem.Value>
        <GridItem.Description>up 41% on last week</GridItem.Description>
      </GridItem>
      <GridItem variant="muted">
        <GridItem.Background>
          <View className="absolute -bottom-4 -right-3 opacity-10">
            <SparklesIcon size={96} />
          </View>
        </GridItem.Background>
        <GridItem.Title>Cache hits</GridItem.Title>
        <GridItem.Value>94%</GridItem.Value>
      </GridItem>
      <GridItem variant="outline">
        <GridItem.Title>Errors</GridItem.Title>
        <GridItem.Value>7</GridItem.Value>
        <GridItem.Description>none critical</GridItem.Description>
      </GridItem>
    </GridItem.Group>
  );
}

/** Every tile carrying the same treatment, in the five chart colours. */
const WATERMARKS: {
  label: string;
  value: string;
  caption: string;
  icon: (color: string) => ReactNode;
  token: string;
}[] = [
  {
    label: 'Cache hits',
    value: '94%',
    caption: 'of 2.1M lookups',
    icon: (color) => <SparklesIcon size={72} color={color} />,
    token: '--color-chart-1',
  },
  {
    label: 'Alerts',
    value: '3',
    caption: 'two acknowledged',
    icon: (color) => <BellIcon size={72} color={color} />,
    token: '--color-chart-2',
  },
  {
    label: 'Blocked',
    value: '1,902',
    caption: 'requests today',
    icon: (color) => <ShieldCheckIcon size={72} color={color} />,
    token: '--color-chart-3',
  },
  {
    label: 'Bundles',
    value: '48 MB',
    caption: 'served from the edge',
    icon: (color) => <PackageIcon size={72} color={color} />,
    token: '--color-chart-4',
  },
];

/** One tile of the wall above, so the token hook has somewhere to live. */
function WatermarkTile({ tile }: { tile: (typeof WATERMARKS)[number] }) {
  const token = useCSSVariable(tile.token);
  const tint = typeof token === 'string' ? token : undefined;

  return (
    <GridItem>
      <GridItem.Background>
        {/*
         * Hung off the bottom-right corner and cut by the tile, which is the
         * whole trick: an icon that fits inside the tile is an icon, and one
         * that runs off two edges of it is a texture.
         */}
        <View className="absolute -bottom-6 -right-5 opacity-[0.14]">
          {tile.icon(tint ?? '#888888')}
        </View>
      </GridItem.Background>
      <GridItem.Title>{tile.label}</GridItem.Title>
      <GridItem.Value>{tile.value}</GridItem.Value>
      <GridItem.Footer>
        <Text size="xs" muted numberOfLines={1}>
          {tile.caption}
        </Text>
      </GridItem.Footer>
    </GridItem>
  );
}

/**
 * The watermark treatment across the whole wall rather than on one tile.
 *
 * It survives being repeated because the icon is not decoration on top of the
 * tile — it is the tile's own subject, at a size nobody reads it at, in that
 * series' colour. Four of them read as four different things; four of the same
 * icon would read as wallpaper.
 */
function GridItemWatermarksDemo() {
  return (
    <GridItem.Group columns={2} gap={12} rowHeight={132} className="w-full">
      {WATERMARKS.map((tile) => (
        <WatermarkTile key={tile.label} tile={tile} />
      ))}
    </GridItem.Group>
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

const LOADER_VARIANTS: { variant: LoaderVariant; label: string }[] = [
  { variant: 'pulse-dots', label: 'Pulse dots' },
  { variant: 'bounce-dots', label: 'Bounce dots' },
  { variant: 'pulsating-dots', label: 'Pulsating dots' },
  { variant: 'liquid-dots', label: 'Liquid dots' },
  { variant: 'bar-cascade', label: 'Bar cascade' },
  { variant: 'bouncing-bars', label: 'Bouncing bars' },
  { variant: 'symmetric-wave', label: 'Symmetric wave' },
  { variant: 'morph-ring', label: 'Morph ring' },
  { variant: 'wave-physics', label: 'Wave physics' },
];

/** All nine at once, which is the only way to pick between them. */
function LoaderGalleryVersion() {
  return (
    <ScrollView contentContainerClassName="gap-3 p-4 pb-10">
      <View className="gap-1">
        <Text size="lg" weight="semibold">
          Nine loaders
        </Text>
        <Text size="sm" muted>
          Same props, same colour, same tempo — the variant is the only thing
          that changes.
        </Text>
      </View>

      {LOADER_VARIANTS.map(({ variant, label }) => (
        <Card key={variant}>
          <Card.Content className="flex-row items-center gap-4 py-5">
            <View className="w-32 items-center">
              <Loader variant={variant} />
            </View>
            <Text size="sm" muted className="flex-1">
              {label}
            </Text>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

/** A loader is nearly always standing in for content that has not arrived. */
function LoaderScreenVersion() {
  const [variant, setVariant] = useState<LoaderVariant>('wave-physics');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 2600);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <View className="flex-1">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 p-4"
      >
        {LOADER_VARIANTS.map(({ variant: value, label }) => (
          <Chip
            key={value}
            selected={value === variant}
            onPress={() => {
              setVariant(value);
              setLoading(true);
            }}
          >
            {label}
          </Chip>
        ))}
      </ScrollView>

      <View className="flex-1 items-center justify-center gap-6 p-6">
        {loading ? (
          <>
            <Loader variant={variant} size="lg" label="Loading your reports" />
            <Text size="sm" muted className="text-center">
              Fetching reports…
            </Text>
          </>
        ) : (
          <>
            <Text size="lg" weight="semibold">
              12 reports
            </Text>
            <Text size="sm" muted className="text-center">
              Pick another loader above to run it again.
            </Text>
            <Button variant="outline" onPress={() => setLoading(true)}>
              Reload
            </Button>
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Inside a button, where the loader has to be legible on a filled surface it
 * was never told about.
 */
function LoaderInlineVersion() {
  const [busy, setBusy] = useState<string | null>(null);

  const run = (id: string) => {
    setBusy(id);
    setTimeout(() => setBusy(null), 2200);
  };

  return (
    <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
      <View className="gap-1">
        <Text size="lg" weight="semibold">
          In place
        </Text>
        <Text size="sm" muted>
          With no colour of its own a loader draws in the foreground of the
          surface it is on, so it stays readable inside a filled button.
        </Text>
      </View>

      <Button onPress={() => run('primary')} disabled={busy === 'primary'}>
        {busy === 'primary' ? <Loader variant="pulse-dots" size="sm" /> : 'Save changes'}
      </Button>

      <Button
        variant="outline"
        onPress={() => run('outline')}
        disabled={busy === 'outline'}
      >
        {busy === 'outline' ? (
          <Loader variant="bounce-dots" size="sm" />
        ) : (
          'Sync library'
        )}
      </Button>

      <Card>
        <Card.Header>
          <Card.Title>Coloured by token</Card.Title>
          <Card.Description>
            `color` takes a token name, so the loader follows the theme.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex-row items-center justify-around py-6">
          <Loader variant="bar-cascade" color="--color-info" />
          <Loader variant="symmetric-wave" color="--color-success" />
          <Loader variant="bouncing-bars" color="--color-destructive" />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Sizes</Card.Title>
        </Card.Header>
        <Card.Content className="flex-row items-center justify-around py-6">
          <Loader variant="pulsating-dots" size="sm" />
          <Loader variant="pulsating-dots" size="md" />
          <Loader variant="pulsating-dots" size="lg" />
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

/**
 * A replay control, because an animation nobody can re-trigger demonstrates
 * itself once and is then a screenshot. Remounting the subtree is the honest
 * way to do it: every part starts from its own beginning rather than from
 * whatever it happened to be showing.
 */
function Replay({ children }: { children: (run: number) => ReactNode }) {
  const [run, setRun] = useState(0);

  return (
    <View className="w-full items-center gap-4">
      {children(run)}
      <Button variant="outline" size="sm" onPress={() => setRun((n) => n + 1)}>
        Play again
      </Button>
    </View>
  );
}

function TypingDemo() {
  return (
    <Replay>
      {(run) => (
        // A fixed height, because a line that grows as it types pushes the
        // button under it down the screen on every keystroke.
        <View key={run} className="h-16 w-full justify-center">
          <TextAnimation.Typing
            text="Everything ships with its accessibility wiring already done."
            size="lg"
            weight="medium"
            caret
          />
        </View>
      )}
    </Replay>
  );
}

function TypingCycleDemo() {
  return (
    <View className="h-16 w-full justify-center">
      <TextAnimation.Typing
        text={['fast by default', 'native where it counts', 'yours to change']}
        size="lg"
        weight="medium"
        caret
        loop
      />
    </View>
  );
}

function RotatingDemo() {
  return (
    <View className="w-full flex-row items-center justify-center gap-2">
      <Text size="xl" weight="semibold">
        Built for
      </Text>
      <TextAnimation.Rotating
        text={['Expo', 'React Native', 'you']}
        size="xl"
        weight="semibold"
        className="text-info-foreground"
      />
    </View>
  );
}

function CountingDemo() {
  return (
    <Replay>
      {(run) => (
        <View key={run} className="w-full flex-row justify-around">
          <View className="items-center gap-1">
            <TextAnimation.Counting value={2048} size="3xl" weight="semibold" />
            <Text size="sm" muted>
              Installs
            </Text>
          </View>
          <View className="items-center gap-1">
            <TextAnimation.Counting
              value={99.4}
              decimals={1}
              size="3xl"
              weight="semibold"
              formatOptions={{ style: 'percent', maximumFractionDigits: 1 }}
            />
            <Text size="sm" muted>
              Uptime
            </Text>
          </View>
        </View>
      )}
    </Replay>
  );
}

/** The odometer, driven by a real value rather than by a timer. */
function SlidingDemo() {
  const [total, setTotal] = useState(1024);

  return (
    <View className="w-full items-center gap-4">
      <TextAnimation.Sliding
        value={total}
        thousandSeparator=","
        size="3xl"
        weight="semibold"
      />
      <View className="flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          onPress={() => setTotal((n) => Math.max(0, n - 137))}
        >
          −137
        </Button>
        <Button variant="outline" size="sm" onPress={() => setTotal((n) => n + 137)}>
          +137
        </Button>
        <Button variant="outline" size="sm" onPress={() => setTotal(1024)}>
          Reset
        </Button>
      </View>
    </View>
  );
}

function SlidingPriceDemo() {
  const [price, setPrice] = useState(24.99);

  return (
    <View className="w-full items-center gap-4">
      <View className="flex-row items-center">
        <Text size="2xl" weight="semibold">
          $
        </Text>
        <TextAnimation.Sliding value={price} decimals={2} size="2xl" weight="semibold" />
        <Text size="sm" muted className="ms-2">
          /month
        </Text>
      </View>
      <ToggleButtonGroup
        selectionMode="single"
        value={[price === 24.99 ? 'monthly' : 'yearly']}
        onValueChange={(next) => setPrice(next[0] === 'yearly' ? 19.16 : 24.99)}
      >
        <ToggleButton id="monthly">Monthly</ToggleButton>
        <ToggleButton id="yearly">Yearly</ToggleButton>
      </ToggleButtonGroup>
    </View>
  );
}

function ScrollingDemo() {
  return (
    <Replay>
      {(run) => (
        <View key={run} className="w-full items-center gap-3">
          {/* The band and the edge fade are what make it a picker rather than
              a list of five numbers with no answer in it. The fade is painted,
              so it has to be told what is behind the window. */}
          <TextAnimation.Scrolling
            value={120}
            step={10}
            size="2xl"
            weight="semibold"
            highlight
            className="w-28"
          />
          <Text size="sm" muted>
            Minutes this week
          </Text>
        </View>
      )}
    </Replay>
  );
}

/** Three parts under one root, configured once. */
function TextAnimationGroupDemo() {
  return (
    <Replay>
      {(run) => (
        <TextAnimation key={run} duration={900} delay={200} className="gap-2">
          <TextAnimation.Counting value={48} size="2xl" weight="semibold" />
          <Text size="2xl" weight="semibold">
            of
          </Text>
          <TextAnimation.Counting value={60} size="2xl" weight="semibold" />
          <Text size="2xl" muted>
            done
          </Text>
        </TextAnimation>
      )}
    </Replay>
  );
}

/**
 * A navigation drawer with a destination selected, because that is the state a
 * navigation drawer is almost always in: it opens to tell you where you are,
 * not only where you could go. The group under the rule is the second tier —
 * settings that belong to the workspace rather than places inside it.
 */
function DrawerNavigationDemo() {
  const [destination, setDestination] = useState('Projects');

  const places = [
    { label: 'Projects', icon: <PackageIcon size={16} />, detail: '12 active' },
    { label: 'Members', icon: <BellIcon size={16} />, detail: '8 people' },
    { label: 'Billing', icon: <CardIcon size={16} />, detail: 'Pro plan' },
  ];

  return (
    <Drawer>
      <Drawer.Trigger>
        <Button variant="outline">Open menu</Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header title="Acme Studio" description="Switch project or manage members." />
        <Drawer.Body>
          <View className="gap-4 pb-4">
            <Item.Group>
              {places.map(({ label, icon, detail }, index) => (
                <Fragment key={label}>
                  {index > 0 ? <Item.Separator /> : null}
                  <Item
                    // Selected rather than merely pressable: the row you are on
                    // has to be announced as such, not only tinted.
                    variant={destination === label ? 'muted' : 'default'}
                    onPress={() => setDestination(label)}
                    accessibilityState={{ selected: destination === label }}
                  >
                    <Item.Media variant="icon">{icon}</Item.Media>
                    <Item.Content>
                      <Item.Title>{label}</Item.Title>
                      <Item.Description>{detail}</Item.Description>
                    </Item.Content>
                    <Item.Actions>
                      {destination === label ? (
                        <Badge variant="secondary">Here</Badge>
                      ) : (
                        <ChevronRightIcon size={16} />
                      )}
                    </Item.Actions>
                  </Item>
                </Fragment>
              ))}
            </Item.Group>

            <Separator />

            <Item.Group>
              <Item>
                <Item.Media variant="icon">
                  <ShieldCheckIcon size={16} />
                </Item.Media>
                <Item.Content>
                  <Item.Title>Security</Item.Title>
                  <Item.Description>Two-factor is on</Item.Description>
                </Item.Content>
                <Item.Actions>
                  <ChevronRightIcon size={16} />
                </Item.Actions>
              </Item>
              <Item.Separator />
              <Item>
                <Item.Media variant="icon">
                  <BellIcon size={16} />
                </Item.Media>
                <Item.Content>
                  <Item.Title>Notifications</Item.Title>
                  <Item.Description>Badges, sounds, banners</Item.Description>
                </Item.Content>
                <Item.Actions>
                  <ChevronRightIcon size={16} />
                </Item.Actions>
              </Item>
            </Item.Group>
          </View>
        </Drawer.Body>
        <Drawer.Footer>
          <Avatar size="sm" fallback="KA" />
          <View className="min-w-0 flex-1">
            <Text size="sm" weight="medium" numberOfLines={1}>
              Khalid Abdi
            </Text>
            <Text size="xs" muted numberOfLines={1}>
              khalid@acme.studio
            </Text>
          </View>
          <Drawer.Close>
            <Button variant="outline" size="sm">
              Sign out
            </Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

/**
 * What each size asks for and what it is capped at. Written out because the
 * cap is the part that is invisible on a phone and the whole point on a
 * tablet — a fraction alone reads correctly on one and absurdly on the other.
 */
const DRAWER_SIZES = [
  { size: 'sm', asks: '62% of the width', capped: 'never past 280pt', use: 'A short list of destinations.' },
  { size: 'md', asks: '78% of the width', capped: 'never past 320pt', use: 'The default. Navigation, filters, a form.' },
  { size: 'lg', asks: '88% of the width', capped: 'never past 400pt', use: 'Anything with two columns of content.' },
  { size: 'full', asks: '94% of the width', capped: 'no cap', use: 'A takeover that still shows the app behind it.' },
] as const;

function DrawerSizesDemo() {
  return (
    <View className="w-full flex-row flex-wrap justify-center gap-2">
      {DRAWER_SIZES.map(({ size, asks, capped, use }) => (
        <Drawer key={size}>
          <Drawer.Trigger>
            <Button variant="outline" size="sm">
              {size}
            </Button>
          </Drawer.Trigger>
          <Drawer.Content size={size}>
            <Drawer.Header title={`size="${size}"`} description={use} />
            <Drawer.Body>
              <View className="gap-4 pb-4">
                <Item.Group>
                  <Item>
                    <Item.Content>
                      <Item.Title>Asks for</Item.Title>
                    </Item.Content>
                    <Item.Actions>
                      <Text size="sm" muted>
                        {asks}
                      </Text>
                    </Item.Actions>
                  </Item>
                  <Item.Separator />
                  <Item>
                    <Item.Content>
                      <Item.Title>Capped at</Item.Title>
                    </Item.Content>
                    <Item.Actions>
                      <Text size="sm" muted>
                        {capped}
                      </Text>
                    </Item.Actions>
                  </Item>
                </Item.Group>
                <Text size="sm" muted>
                  The cap is what a fraction cannot do on its own: 78% of a tablet is
                  a navigation list with a column of whitespace beside it.
                </Text>
                <Text size="sm" muted>
                  Drag the panel back toward its edge to dismiss it.
                </Text>
              </View>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer>
      ))}
    </View>
  );
}

const DRAWER_CATEGORIES = ['Chairs', 'Desks', 'Lighting', 'Storage', 'Rugs'];

/**
 * A filter drawer on the end edge — the edge text runs toward, so it is the
 * right in a left-to-right app and the left in a right-to-left one.
 *
 * `closeSide="end"` puts the ✕ in the outer corner rather than the inner one it
 * would take by default. A filter panel is opened and closed a dozen times in a
 * session, and a target that is always under the same thumb beats one that
 * moves with the edge the panel came from.
 *
 * Everything in it drives the count in the footer, so the panel is a control
 * rather than a picture of one — a filter that changes nothing demonstrates
 * nothing about whether the drawer can hold a real form.
 */
function DrawerFiltersDemo() {
  const [categories, setCategories] = useState<string[]>(['Chairs']);
  const [budget, setBudget] = useState(320);
  const [rating, setRating] = useState(4);
  const [inStock, setInStock] = useState(true);
  const [onSale, setOnSale] = useState(false);

  const toggleCategory = (name: string) =>
    setCategories((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]
    );

  const reset = () => {
    setCategories([]);
    setBudget(500);
    setRating(0);
    setInStock(false);
    setOnSale(false);
  };

  // Deliberately arbitrary, but monotonic in every input: the number has to
  // move the right way when a filter tightens, or the footer is a decoration.
  const results =
    240 -
    categories.length * 26 -
    Math.round((500 - budget) / 8) -
    rating * 11 -
    (inStock ? 18 : 0) -
    (onSale ? 34 : 0);
  const applied =
    categories.length + (budget < 500 ? 1 : 0) + (rating > 0 ? 1 : 0) + (inStock ? 1 : 0) + (onSale ? 1 : 0);

  return (
    <Drawer>
      <Drawer.Trigger>
        <Button variant="outline">Filters</Button>
      </Drawer.Trigger>
      <Drawer.Content side="end" closeSide="end">
        <Drawer.Header
          title="Filters"
          description={applied === 0 ? 'Nothing applied' : `${applied} applied`}
        />
        <Drawer.Body>
          <View className="gap-6 pb-6">
          <View className="gap-3">
            <Label>Category</Label>
            <View className="flex-row flex-wrap gap-2">
              {DRAWER_CATEGORIES.map((name) => (
                <Chip
                  key={name}
                  selected={categories.includes(name)}
                  onPress={() => toggleCategory(name)}
                >
                  {name}
                </Chip>
              ))}
            </View>
          </View>

          <Separator />

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Label>Budget</Label>
              <Text size="sm" muted>
                Up to ${budget}
              </Text>
            </View>
            <Slider value={budget} onValueChange={setBudget} min={40} max={500} step={20} />
          </View>

          <Separator />

          <View className="gap-2">
            <Label>Minimum rating</Label>
            <Rating value={rating} onValueChange={setRating} allowClear />
          </View>

          <Separator />

          <Item.Group>
            <Item>
              <Item.Content>
                <Item.Title>In stock only</Item.Title>
                <Item.Description>Hide anything on backorder</Item.Description>
              </Item.Content>
              <Item.Actions>
                <Switch value={inStock} onValueChange={setInStock} />
              </Item.Actions>
            </Item>
            <Item.Separator />
            <Item>
              <Item.Content>
                <Item.Title>On sale</Item.Title>
                <Item.Description>Reduced in the last 30 days</Item.Description>
              </Item.Content>
              <Item.Actions>
                <Switch value={onSale} onValueChange={setOnSale} />
              </Item.Actions>
            </Item>
          </Item.Group>
          </View>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="ghost" onPress={reset}>
            Reset
          </Button>
          <Drawer.Close>
            <Button className="flex-1">Show {Math.max(results, 0)} results</Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

/**
 * A short list where every row deletes itself. The rows are state so the full
 * swipe has something real to do — an action that only logs proves nothing
 * about whether the row got out of the way afterwards.
 */
function SwipeDeleteDemo() {
  const [rows, setRows] = useState([
    { name: 'Invoice.pdf', meta: '2.4 MB' },
    { name: 'Contract.docx', meta: '812 KB' },
    { name: 'Notes.md', meta: '4 KB' },
  ]);

  if (rows.length === 0) {
    return (
      <View className="w-full gap-3">
        <Text size="sm" muted>
          Every row deleted.
        </Text>
        <Button
          variant="outline"
          size="sm"
          onPress={() =>
            setRows([
              { name: 'Invoice.pdf', meta: '2.4 MB' },
              { name: 'Contract.docx', meta: '812 KB' },
              { name: 'Notes.md', meta: '4 KB' },
            ])
          }
        >
          Put them back
        </Button>
      </View>
    );
  }

  return (
    <View className="w-full overflow-hidden rounded-xl border border-border">
      {rows.map((row, index) => (
        <View key={row.name}>
          <Swipe haptics>
            <Swipe.End>
              <Swipe.Action
                icon={<TrashIcon />}
                label="Delete"
                color="destructive"
                onPress={() =>
                  setRows((current) => current.filter((r) => r.name !== row.name))
                }
              />
            </Swipe.End>
            <Item>
              <Item.Media variant="icon">
                <FileIcon />
              </Item.Media>
              <Item.Content>
                <Item.Title>{row.name}</Item.Title>
                <Item.Description>{row.meta}</Item.Description>
              </Item.Content>
            </Item>
          </Swipe>
          {index < rows.length - 1 ? <Item.Separator /> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * A panel on each side, and more than one tile on the end — which is where the
 * rule about the outermost action earns its keep: Delete is the far tile, so it
 * is the one a full swipe reaches.
 */
function SwipeBothSidesDemo() {
  const [status, setStatus] = useState('Drag the row either way.');

  return (
    <View className="w-full gap-3">
      <View className="overflow-hidden rounded-xl border border-border">
        <Swipe haptics onOpenChange={(side) => side && setStatus(`Open on the ${side}.`)}>
          <Swipe.Start>
            <Swipe.Action
              icon={<CheckIcon />}
              label="Done"
              color="success"
              onPress={() => setStatus('Marked done.')}
            />
          </Swipe.Start>
          <Swipe.End>
            <Swipe.Action
              icon={<BellIcon />}
              label="Snooze"
              color="warning"
              onPress={() => setStatus('Snoozed until tomorrow.')}
            />
            <Swipe.Action
              icon={<TrashIcon />}
              label="Delete"
              color="destructive"
              onPress={() => setStatus('Deleted.')}
            />
          </Swipe.End>
          <Item>
            <Item.Content>
              <Item.Title>Renew the domain</Item.Title>
              <Item.Description>Due Friday</Item.Description>
            </Item.Content>
          </Item>
        </Swipe>
      </View>
      <Text size="sm" muted>
        {status}
      </Text>
    </View>
  );
}

/**
 * The two halves of the full-swipe decision, side by side. The top row fires
 * its action on a long drag; the bottom one opens and waits to be tapped.
 */
function SwipeFullSwipeDemo() {
  const [log, setLog] = useState('Nothing fired yet.');

  return (
    <View className="w-full gap-4">
      <View className="gap-2">
        <Text size="sm" weight="medium">
          fullSwipe (default)
        </Text>
        <View className="overflow-hidden rounded-xl border border-border">
          <Swipe haptics>
            <Swipe.End>
              <Swipe.Action
                icon={<TrashIcon />}
                label="Delete"
                color="destructive"
                onPress={() => setLog('Fired by the swipe.')}
              />
            </Swipe.End>
            <Item>
              <Item.Content>
                <Item.Title>Draft note</Item.Title>
                <Item.Description>Carry the drag all the way</Item.Description>
              </Item.Content>
            </Item>
          </Swipe>
        </View>
      </View>

      <View className="gap-2">
        <Text size="sm" weight="medium">
          fullSwipe={'{false}'}
        </Text>
        <View className="overflow-hidden rounded-xl border border-border">
          <Swipe fullSwipe={false}>
            <Swipe.End>
              <Swipe.Action
                icon={<TrashIcon />}
                label="Delete"
                color="destructive"
                onPress={() => setLog('Fired by the tile.')}
              />
            </Swipe.End>
            <Item>
              <Item.Content>
                <Item.Title>Production database</Item.Title>
                <Item.Description>The tile has to be tapped</Item.Description>
              </Item.Content>
            </Item>
          </Swipe>
        </View>
      </View>

      <Text size="sm" muted>
        {log}
      </Text>
    </View>
  );
}

/** `keepOpen` for an action that toggles rather than finishes. */
function SwipeKeepOpenDemo() {
  const [saved, setSaved] = useState(false);

  return (
    <View className="w-full overflow-hidden rounded-xl border border-border">
      <Swipe>
        <Swipe.Start>
          <Swipe.Action
            icon={<BookmarkIcon />}
            label={saved ? 'Saved' : 'Save'}
            color={saved ? 'success' : 'primary'}
            keepOpen
            onPress={() => setSaved((current) => !current)}
          />
        </Swipe.Start>
        <Item>
          <Item.Content>
            <Item.Title>Weekly digest</Item.Title>
            <Item.Description>{saved ? 'Saved for later' : 'Not saved'}</Item.Description>
          </Item.Content>
        </Item>
      </Swipe>
    </View>
  );
}

/**
 * The same row in a right-to-left subtree. `Swipe.End` still means the edge
 * text runs toward, so the panel is on the left and the row opens rightward —
 * without a word of the markup changing.
 */
function SwipeRtlDemo() {
  return (
    <Direction dir="rtl" className="w-full">
      <View className="overflow-hidden rounded-xl border border-border">
        <Swipe>
          <Swipe.End>
            <Swipe.Action icon={<TrashIcon />} label="حذف" color="destructive" />
          </Swipe.End>
          <Item>
            <Item.Content>
              <Item.Title>فاتورة يوليو</Item.Title>
              <Item.Description>٢٫٤ ميغابايت</Item.Description>
            </Item.Content>
          </Item>
        </Swipe>
      </View>
    </Direction>
  );
}

/* -------------------------------------------------------------------------- */
/* Questionnaire                                                              */
/* -------------------------------------------------------------------------- */

const PROTOTYPE_QUESTIONS = [
  { name: 'direction', required: true },
  { name: 'detail' },
] as const;

/** One answer to each of two questions, the second of which can be skipped. */
function QuestionnaireDemo() {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});

  return (
    <View className="w-full gap-4">
      <Questionnaire
        items={PROTOTYPE_QUESTIONS}
        onAnswersChange={setAnswers}
        onSubmit={(final) => setAnswers(final)}
      >
        <Questionnaire.Title>Prototype</Questionnaire.Title>
        <Questionnaire.Progress />
        <Questionnaire.Item name="direction" required>
          <Questionnaire.Question>What should we build next?</Questionnaire.Question>
          <Questionnaire.Description>
            Choose the direction you want to see first.
          </Questionnaire.Description>
          <Questionnaire.Choices>
            <Questionnaire.Choice
              value="delegation"
              label="Delegation"
              description="Show how work moves to a specialist."
            />
            <Questionnaire.Choice
              value="prompts"
              label="Question prompts"
              description="Show choices while the interface waits."
            />
            <Questionnaire.Choice value="both" label="Both together" />
          </Questionnaire.Choices>
          <Questionnaire.Error />
        </Questionnaire.Item>
        <Questionnaire.Item name="detail">
          <Questionnaire.Question>How much detail?</Questionnaire.Question>
          <Questionnaire.Description>
            Skip this one if you have not decided.
          </Questionnaire.Description>
          <Questionnaire.Choices>
            <Questionnaire.Choice value="focused" label="Focused" />
            <Questionnaire.Choice value="complete" label="The complete flow" />
          </Questionnaire.Choices>
        </Questionnaire.Item>
        <Questionnaire.Footer>
          <Questionnaire.Back />
          <Questionnaire.Spacer />
          <Questionnaire.Skip />
          <Questionnaire.Next />
          <Questionnaire.Submit />
        </Questionnaire.Footer>
      </Questionnaire>
      <Text size="sm" muted>
        {Object.keys(answers).length > 0
          ? JSON.stringify(answers)
          : 'Every answer arrives under the question’s own name.'}
      </Text>
    </View>
  );
}

/** A question that takes as many answers as apply, so its answer is a list. */
function QuestionnaireMultipleDemo() {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});

  return (
    <View className="w-full gap-4">
      <Questionnaire onAnswersChange={setAnswers}>
        <Questionnaire.Progress />
        <Questionnaire.Item name="signals" required multiple>
          <Questionnaire.Question>What should every update include?</Questionnaire.Question>
          <Questionnaire.Description>Select all that apply.</Questionnaire.Description>
          <Questionnaire.Choices>
            <Questionnaire.Choice value="progress" label="Progress" />
            <Questionnaire.Choice value="decisions" label="Decisions" />
            <Questionnaire.Choice value="risks" label="Risks" />
          </Questionnaire.Choices>
          <Questionnaire.Error />
        </Questionnaire.Item>
        <Questionnaire.Footer>
          <Questionnaire.Spacer />
          <Questionnaire.Submit />
        </Questionnaire.Footer>
      </Questionnaire>
      <Text size="sm" muted>
        {Array.isArray(answers.signals) && answers.signals.length > 0
          ? answers.signals.join(', ')
          : 'A question that takes several answers stores them as a list.'}
      </Text>
    </View>
  );
}

/** The text field holds whatever answer the fixed choices do not offer. */
function QuestionnaireFreeformDemo() {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});

  return (
    <View className="w-full gap-4">
      <Questionnaire onAnswersChange={setAnswers}>
        <Questionnaire.Progress />
        <Questionnaire.Item name="tool" required>
          <Questionnaire.Question>Where do you keep your notes?</Questionnaire.Question>
          <Questionnaire.Choices>
            <Questionnaire.Choice value="files" label="Plain files" />
            <Questionnaire.Choice value="issues" label="Issue tracker" />
            <Questionnaire.Input placeholder="Somewhere else…" />
          </Questionnaire.Choices>
          <Questionnaire.Error />
        </Questionnaire.Item>
        <Questionnaire.Footer>
          <Questionnaire.Spacer />
          <Questionnaire.Submit />
        </Questionnaire.Footer>
      </Questionnaire>
      <Text size="sm" muted>
        Picking a choice empties the field, and typing clears the choice — one
        answer to one question either way.
      </Text>
    </View>
  );
}

/** A letter beside every answer, counting only the ones that can be picked. */
function QuestionnaireShortcutsDemo() {
  return (
    <View className="w-full gap-4">
      <Questionnaire shortcuts="letters">
        <Questionnaire.Progress />
        <Questionnaire.Item name="review" required>
          <Questionnaire.Question>What should be reviewed first?</Questionnaire.Question>
          <Questionnaire.Choices>
            <Questionnaire.Choice value="api" label="The public API" />
            <Questionnaire.Choice value="tests" label="Test coverage" />
            <Questionnaire.Choice value="perf" label="Performance" disabled />
            <Questionnaire.Choice value="docs" label="The documentation" />
          </Questionnaire.Choices>
        </Questionnaire.Item>
        <Questionnaire.Footer>
          <Questionnaire.Spacer />
          <Questionnaire.Submit />
        </Questionnaire.Footer>
      </Questionnaire>
      <Text size="sm" muted>
        Performance is disabled, so it takes no letter with it and the
        documentation is C.
      </Text>
    </View>
  );
}

/** Numbers instead of pips, for a flow the reader gets sent back through. */
function QuestionnaireNumbersDemo() {
  return (
    <View className="w-full gap-4">
      <Questionnaire items={PROTOTYPE_QUESTIONS}>
        <Questionnaire.Title>Prototype</Questionnaire.Title>
        <Questionnaire.Progress variant="numbers" />
        <Questionnaire.Item name="direction" required>
          <Questionnaire.Question>What should we build next?</Questionnaire.Question>
          <Questionnaire.Choices>
            <Questionnaire.Choice value="delegation" label="Delegation" />
            <Questionnaire.Choice value="prompts" label="Question prompts" />
          </Questionnaire.Choices>
          <Questionnaire.Error />
        </Questionnaire.Item>
        <Questionnaire.Item name="detail">
          <Questionnaire.Question>How much detail?</Questionnaire.Question>
          <Questionnaire.Choices>
            <Questionnaire.Choice value="focused" label="Focused" />
            <Questionnaire.Choice value="complete" label="The complete flow" />
          </Questionnaire.Choices>
        </Questionnaire.Item>
        <Questionnaire.Footer>
          <Questionnaire.Back />
          <Questionnaire.Spacer />
          <Questionnaire.Skip />
          <Questionnaire.Next />
          <Questionnaire.Submit />
        </Questionnaire.Footer>
      </Questionnaire>
      <Text size="sm" muted>
        A number says which question this is, which a bar cannot — worth it
        where somebody is going to be sent back to one of them.
      </Text>
    </View>
  );
}

/** No frame, for a questionnaire in something that draws its own boundary. */
function QuestionnaireBareDemo() {
  return (
    <View className="w-full">
      <Card>
        {/*
          `pt-6`, because Card.Content is `p-6 pt-0` — it expects a Card.Header
          above it, and without one the questionnaire's progress row starts
          flush against the card's top edge.
        */}
        <Card.Content className="pt-6">
          <Questionnaire frame={false}>
            <Questionnaire.Title>Timing</Questionnaire.Title>
            <Questionnaire.Progress />
            <Questionnaire.Item name="timing" required>
              <Questionnaire.Question>When should this ship?</Questionnaire.Question>
              <Questionnaire.Choices>
                <Questionnaire.Choice value="week" label="This week" />
                <Questionnaire.Choice value="cycle" label="Next cycle" />
              </Questionnaire.Choices>
            </Questionnaire.Item>
            <Questionnaire.Footer>
              <Questionnaire.Spacer />
              <Questionnaire.Submit />
            </Questionnaire.Footer>
          </Questionnaire>
        </Card.Content>
      </Card>
    </View>
  );
}

/* --- Versions ------------------------------------------------------------- */

const ONBOARDING_QUESTIONS = [
  { name: 'role', required: true },
  { name: 'size', required: true },
  { name: 'stack', multiple: true },
  { name: 'timeline' },
  { name: 'contact', required: true },
] as const;

const ONBOARDING_LABELS: Record<string, string> = {
  role: 'Role',
  size: 'Team size',
  stack: 'Stack',
  timeline: 'Timeline',
  contact: 'Best way to reach you',
};

/** Five questions and the summary they add up to. */
function QuestionnaireOnboardingVersion() {
  const [done, setDone] = useState<QuestionnaireAnswers | null>(null);

  if (done) {
    return (
      <ScrollView contentContainerClassName="gap-4 p-4">
        <Text size="xl" weight="semibold">
          That is everything
        </Text>
        <Frame>
          <Frame.Header>
            <Frame.Title>Your answers</Frame.Title>
          </Frame.Header>
          <Frame.Panel>
            {Object.entries(done).map(([name, value]) => (
              <Frame.Row key={name}>
                <Frame.Content>
                  <Frame.Title>{ONBOARDING_LABELS[name] ?? name}</Frame.Title>
                  <Frame.Description>
                    {Array.isArray(value) ? value.join(', ') : value}
                  </Frame.Description>
                </Frame.Content>
              </Frame.Row>
            ))}
          </Frame.Panel>
        </Frame>
        <Button variant="outline" onPress={() => setDone(null)}>
          Start over
        </Button>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <Questionnaire items={ONBOARDING_QUESTIONS} onSubmit={setDone}>
        <Questionnaire.Title>Getting set up</Questionnaire.Title>
        <Questionnaire.Progress />

        <Questionnaire.Item name="role" required>
          <Questionnaire.Question>What do you do?</Questionnaire.Question>
          <Questionnaire.Choices>
            <Questionnaire.Choice value="engineer" label="Engineering" />
            <Questionnaire.Choice value="design" label="Design" />
            <Questionnaire.Choice value="product" label="Product" />
            <Questionnaire.Input placeholder="Something else…" />
          </Questionnaire.Choices>
          <Questionnaire.Error />
        </Questionnaire.Item>

        <Questionnaire.Item name="size" required>
          <Questionnaire.Question>How big is the team?</Questionnaire.Question>
          <Questionnaire.Choices>
            <Questionnaire.Choice value="solo" label="Just me" />
            <Questionnaire.Choice value="small" label="Two to ten" />
            <Questionnaire.Choice value="large" label="More than ten" />
          </Questionnaire.Choices>
          <Questionnaire.Error />
        </Questionnaire.Item>

        <Questionnaire.Item name="stack" multiple>
          <Questionnaire.Question>What are you building with?</Questionnaire.Question>
          <Questionnaire.Description>Select all that apply.</Questionnaire.Description>
          <Questionnaire.Choices>
            <Questionnaire.Choice value="expo" label="Expo" />
            <Questionnaire.Choice value="next" label="Next.js" />
            <Questionnaire.Choice value="native" label="Bare React Native" />
          </Questionnaire.Choices>
        </Questionnaire.Item>

        <Questionnaire.Item name="timeline">
          <Questionnaire.Question>When are you shipping?</Questionnaire.Question>
          <Questionnaire.Description>
            Skip this if it is not decided.
          </Questionnaire.Description>
          <Questionnaire.Choices>
            <Questionnaire.Choice value="month" label="Within a month" />
            <Questionnaire.Choice value="quarter" label="This quarter" />
          </Questionnaire.Choices>
        </Questionnaire.Item>

        <Questionnaire.Item name="contact" required>
          <Questionnaire.Question>Best way to reach you?</Questionnaire.Question>
          <Questionnaire.Choices>
            <Questionnaire.Choice value="email" label="Email" />
            <Questionnaire.Choice value="none" label="Do not contact me" />
          </Questionnaire.Choices>
          <Questionnaire.Error />
        </Questionnaire.Item>

        <Questionnaire.Footer>
          <Questionnaire.Back />
          <Questionnaire.Spacer />
          <Questionnaire.Skip />
          <Questionnaire.Next />
          <Questionnaire.Submit>Finish</Questionnaire.Submit>
        </Questionnaire.Footer>
      </Questionnaire>

      <Text size="sm" muted>
        Swipe across the questions, or use the buttons. The first, second and
        last are required; the stack takes several answers and the timeline can
        be skipped.
      </Text>
    </ScrollView>
  );
}

/** In a sheet, which is where a phone usually asks a question like this. */
function QuestionnaireSheetVersion() {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<QuestionnaireAnswers | null>(null);

  return (
    <View className="flex-1 justify-center gap-4 p-4">
      <Button onPress={() => setOpen(true)}>Ask me two questions</Button>
      {answers ? (
        <Text size="sm" muted className="text-center">
          {JSON.stringify(answers)}
        </Text>
      ) : (
        <Text size="sm" muted className="text-center">
          The sheet owns being dismissed; the questionnaire owns the questions.
        </Text>
      )}

      {/*
        The sheet already draws the boundary and the padding, so the
        questionnaire goes in bare.

        `showClose={false}` matters: the sheet's close button is absolutely
        placed in its top-right corner, which is exactly where the progress
        sits. Two things in one corner is one of them unreachable — and a
        questionnaire that already has Back, Skip and Send does not need a
        third way out. The sheet still dismisses by drag and by backdrop.
      */}
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheet.Content showClose={false}>
          <Questionnaire
            frame={false}
            onSubmit={(final) => {
              setAnswers(final);
              setOpen(false);
            }}
          >
            <Questionnaire.Title>Feedback</Questionnaire.Title>
            <Questionnaire.Progress />
            <Questionnaire.Item name="mood" required>
              <Questionnaire.Question>How did that go?</Questionnaire.Question>
              <Questionnaire.Choices>
                <Questionnaire.Choice value="good" label="Better than expected" />
                <Questionnaire.Choice value="fine" label="About right" />
                <Questionnaire.Choice value="bad" label="Not well" />
              </Questionnaire.Choices>
              <Questionnaire.Error />
            </Questionnaire.Item>
            <Questionnaire.Item name="why">
              <Questionnaire.Question>Anything to add?</Questionnaire.Question>
              <Questionnaire.Choices>
                <Questionnaire.Input placeholder="In your own words…" />
              </Questionnaire.Choices>
            </Questionnaire.Item>
            <Questionnaire.Footer>
              <Questionnaire.Back />
              <Questionnaire.Spacer />
              <Questionnaire.Skip />
              <Questionnaire.Next />
              <Questionnaire.Submit>Send</Questionnaire.Submit>
            </Questionnaire.Footer>
          </Questionnaire>
        </BottomSheet.Content>
      </BottomSheet>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

const CATALOGUE: ComponentEntry[] = [
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
          <View className="flex-row">
            {AVATARS.map((uri, index) => (
              <View key={uri} style={{ marginLeft: index === 0 ? 0 : -14 }}>
                <Avatar
                  source={{ uri }}
                  fallback={String.fromCharCode(65 + index)}
                  className="border-2 border-background"
                />
              </View>
            ))}
            <View style={{ marginLeft: -14 }}>
              <Avatar fallback="+5" className="border-2 border-background" />
            </View>
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
    slug: 'bottom-sheet',
    name: 'BottomSheet',
    summary: 'Draggable sheet anchored to the bottom',
    demos: [
      {
        label: 'Basic',
        render: () => (
          <BottomSheet>
            <BottomSheet.Trigger>
              <Button variant="outline">Open sheet</Button>
            </BottomSheet.Trigger>
            <BottomSheet.Content>
              <Text size="lg" weight="semibold" className="mb-1">
                Share project
              </Text>
              <Text size="sm" muted className="mb-4">
                Anyone with the link can view this project.
              </Text>
              <View className="gap-3 pb-2">
                <Input placeholder="https://panelui.dev/p/xK2f9" />
                <Button>Copy link</Button>
              </View>
            </BottomSheet.Content>
          </BottomSheet>
        ),
      },
      {
        label: 'Without the close button',
        render: () => (
          // The corner X is on by default; drop it with showClose={false} when
          // the sheet is dismissible by drag or backdrop alone.
          <BottomSheet>
            <BottomSheet.Trigger>
              <Button variant="outline">Open, no X</Button>
            </BottomSheet.Trigger>
            <BottomSheet.Content showClose={false}>
              <Text size="lg" weight="semibold" className="mb-1">
                Drag to dismiss
              </Text>
              <Text size="sm" muted className="mb-4 pb-2">
                Pull the sheet down, or tap the backdrop.
              </Text>
            </BottomSheet.Content>
          </BottomSheet>
        ),
      },
      { label: 'Detached', render: () => <DetachedSheetDemo /> },
      { label: 'Frosted backdrop', render: () => <BlurredSheetDemo /> },
      {
        label: 'Full height',
        id: 'full-height',
        fullPage: true,
        description:
          'A heading that stays put, a body that scrolls under it, and the action pinned within reach.',
        render: () => (
          <View className="flex-1 items-center justify-center p-5">
            <FullHeightSheetDemo />
          </View>
        ),
      },
      { label: 'Form', render: () => <FormSheetDemo /> },
      { label: 'Scrollable list', render: () => <ScrollableSheetDemo /> },
      {
        label: 'Action list',
        render: () => (
          <BottomSheet>
            <BottomSheet.Trigger>
              <Button variant="outline">Open actions</Button>
            </BottomSheet.Trigger>
            <BottomSheet.Content>
              <Text size="lg" weight="semibold" className="mb-3">
                Project
              </Text>
              <View className="gap-2 pb-2">
                <Button variant="ghost" fullWidth>Rename</Button>
                <Button variant="ghost" fullWidth>Duplicate</Button>
                <Button variant="ghost" fullWidth>Archive</Button>
                <Button variant="destructive" fullWidth>Delete</Button>
              </View>
            </BottomSheet.Content>
          </BottomSheet>
        ),
      },
      { label: 'Native', render: () => <NativeBottomSheetDemo /> },
    ],
  },
  {
    slug: 'breadcrumb',
    name: 'Breadcrumb',
    summary: 'The trail back up to the current page',
    demos: [
      {
        label: 'A trail',
        render: () => (
          <Breadcrumb>
            <Breadcrumb.List>
              <Breadcrumb.Item>
                <Breadcrumb.Link onPress={() => {}}>Home</Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Item>
                <Breadcrumb.Link onPress={() => {}}>Components</Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Item>
                <Breadcrumb.Page>Breadcrumb</Breadcrumb.Page>
              </Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb>
        ),
      },
      {
        label: 'Custom separator',
        render: () => (
          // The chevron is the default; `separator` swaps it for any node
          // across every gap at once.
          <Breadcrumb separator={<Text size="sm" muted>/</Text>}>
            <Breadcrumb.List>
              <Breadcrumb.Item>
                <Breadcrumb.Link onPress={() => {}}>Docs</Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Item>
                <Breadcrumb.Link onPress={() => {}}>Guides</Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Item>
                <Breadcrumb.Page>Theming</Breadcrumb.Page>
              </Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb>
        ),
      },
      {
        label: 'Collapsed',
        render: () => (
          // maxItems folds the middle into an ellipsis, keeping the first and
          // last crumbs. onEllipsisPress makes it a handle for a hidden-steps menu.
          <Breadcrumb>
            <Breadcrumb.List maxItems={3} onEllipsisPress={() => {}}>
              <Breadcrumb.Item>
                <Breadcrumb.Link onPress={() => {}}>Home</Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Item>
                <Breadcrumb.Link onPress={() => {}}>Library</Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Item>
                <Breadcrumb.Link onPress={() => {}}>Components</Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Item>
                <Breadcrumb.Page>Breadcrumb</Breadcrumb.Page>
              </Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb>
        ),
      },
      {
        label: 'Dense header',
        render: () => (
          <Breadcrumb size="sm">
            <Breadcrumb.List>
              <Breadcrumb.Item>
                <Breadcrumb.Link onPress={() => {}}>Settings</Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Item>
                <Breadcrumb.Page>Billing</Breadcrumb.Page>
              </Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb>
        ),
      },
    ],
  },
  {
    slug: 'button',
    name: 'Button',
    summary: 'Pressable action with variants and loading',
    demos: [
      {
        label: 'Variants',
        render: () => (
          <View className="w-full gap-2">
            <Button fullWidth>Primary</Button>
            <Button fullWidth variant="secondary">
              Secondary
            </Button>
            <Button fullWidth variant="outline">
              Outline
            </Button>
            <Button fullWidth variant="ghost">
              Ghost
            </Button>
            <Button fullWidth variant="destructive">
              Delete
            </Button>
          </View>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="items-center gap-3">
            <Button size="sm" variant="outline">
              Small
            </Button>
            <Button>Medium</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </View>
        ),
      },
      { label: 'Loading', render: () => <LoadingButtonDemo /> },
      {
        label: 'Social login',
        render: () => (
          <View className="w-full gap-3">
            <Button variant="social" fullWidth startContent={<GoogleIcon size={18} />}>
              Continue with Google
            </Button>
            <Button variant="social" fullWidth startContent={<FacebookIcon size={18} />}>
              Continue with Facebook
            </Button>
            <Button variant="social" fullWidth startContent={<AppleIcon size={18} />}>
              Continue with Apple
            </Button>
          </View>
        ),
      },
      {
        label: 'With icons',
        render: () => (
          <View className="w-full gap-2">
            <Button fullWidth startContent={<SearchIcon size={16} />}>
              Search
            </Button>
            <Button
              fullWidth
              variant="outline"
              endContent={<ChevronRightIcon size={16} />}
            >
              Continue
            </Button>
            <Button size="icon" variant="outline">
              <SearchIcon size={18} />
            </Button>
          </View>
        ),
      },
      {
        label: 'Native',
        render: () => (
          <NativeDemo>
            <Button native onPress={() => {}}>
              Filled
            </Button>
            <Button native variant="outline" onPress={() => {}}>
              Outlined
            </Button>
            {/* Native buttons size to their labels, so a row of them reads as
                a row of buttons rather than as two halves of the screen. */}
            <View className="w-full flex-row items-center gap-3">
              <Button native variant="ghost" onPress={() => {}}>
                Text
              </Button>
              <Button native size="sm" onPress={() => {}}>
                Small
              </Button>
            </View>
          </NativeDemo>
        ),
      },
      {
        label: 'Liquid Glass',
        render: () => <GlassButtonDemo />,
      },
    ],
  },
  {
    slug: 'card',
    name: 'Card',
    summary: 'Grouped content surface',
    demos: [
      {
        label: 'Basic card',
        render: () => (
          <Card className="w-full">
            <Card.Header>
              <Card.Title>Living room Sofa</Card.Title>
              <Card.Description>
                This sofa is perfect for modern tropical spaces, baroque
                inspired spaces.
              </Card.Description>
            </Card.Header>
            <Card.Footer className="gap-2">
              <Button fullWidth>Buy now</Button>
            </Card.Footer>
          </Card>
        ),
      },
      {
        label: 'With form',
        render: () => (
          <Card className="w-full">
            <Card.Header>
              <Card.Title>Project settings</Card.Title>
              <Card.Description>
                Manage how your project appears to others.
              </Card.Description>
            </Card.Header>
            <Card.Content className="gap-4">
              <Input label="Project name" placeholder="PanelUI" />
              <Input
                label="Description"
                placeholder="A short description"
                description="Shown on your public profile."
              />
            </Card.Content>
            <Card.Footer>
              <Button size="sm">Save</Button>
              <Button size="sm" variant="ghost">
                Cancel
              </Button>
            </Card.Footer>
          </Card>
        ),
      },
      {
        label: 'With image',
        render: () => (
          <Card className="w-full overflow-hidden">
            <Image
              source={{ uri: PHOTO }}
              style={{ width: '100%', height: 180 }}
              resizeMode="cover"
            />
            <Card.Header>
              <Text size="sm" weight="medium" className="text-info-foreground">
                $450
              </Text>
              <Card.Title>Living room Sofa</Card.Title>
              <Card.Description>
                Perfect for modern tropical spaces and baroque inspired rooms.
              </Card.Description>
            </Card.Header>
            <Card.Footer>
              <Button fullWidth>Buy now</Button>
            </Card.Footer>
          </Card>
        ),
      },
      {
        label: 'Horizontal',
        render: () => (
          <Card className="w-full overflow-hidden">
            <Card.Content className="flex-row items-center gap-4 p-3">
              <Image
                source={{ uri: PHOTO }}
                style={{ width: 72, height: 72, borderRadius: 12 }}
                resizeMode="cover"
              />
              <View className="flex-1 gap-0.5">
                <Text weight="semibold">Accent chair</Text>
                <Text size="sm" muted>
                  Walnut and boucle
                </Text>
                <Badge variant="success">In stock</Badge>
              </View>
            </Card.Content>
          </Card>
        ),
      },
    ],
  },
  {
    slug: 'calendar',
    name: 'Calendar',
    summary: 'A month of days, for picking one, several, or a range',
    demos: [
      { label: 'A single day', render: () => <CalendarSingleDemo /> },
      { label: 'A range', render: () => <CalendarRangeDemo /> },
      { label: 'Several days', render: () => <CalendarMultipleDemo /> },
      { label: 'Days ruled out', render: () => <CalendarDisabledDemo /> },
      { label: 'The months either side', render: () => <CalendarOutsideDaysDemo /> },
      { label: 'Month and year pickers', render: () => <CalendarDropdownDemo /> },
      { label: 'Hijri or Gregorian', render: () => <CalendarSystemDemo /> },
    ],
  },
  {
    slug: 'carousel',
    name: 'Carousel',
    summary: 'A run of slides, one at a time, dragged with a finger',
    demos: [
      { label: 'A track', render: () => <CarouselTrackDemo /> },
      { label: 'Interactive', render: () => <CarouselInteractiveDemo /> },
      { label: 'Interactive, bare', render: () => <CarouselBareDemo /> },
      { label: 'Coverflow', render: () => <CarouselCoverflowDemo /> },
      { label: 'A deck of cards', render: () => <CarouselStackDemo /> },
      { label: 'Autoplay, looping', render: () => <CarouselAutoplayDemo /> },
    ],
  },
  {
    slug: 'checkbox',
    name: 'Checkbox',
    summary: 'Multi-select control with label',
    demos: [
      { label: 'With descriptions', render: () => <CheckboxDemo /> },
      { label: 'Select all', render: () => <CheckboxSelectAllDemo /> },
      { label: 'Card', render: () => <CheckboxCardDemo /> },
      {
        label: 'States',
        render: () => (
          <View className="gap-4">
            <Checkbox checked onCheckedChange={() => {}} label="Checked" />
            <Checkbox checked={false} onCheckedChange={() => {}} label="Unchecked" />
            <Checkbox checked disabled onCheckedChange={() => {}} label="Disabled" />
          </View>
        ),
      },
    ],
  },
  {
    slug: 'chip',
    name: 'Chip',
    summary: 'Interactive pill — filter, tag, or token',
    demos: [
      {
        label: 'Variants',
        render: () => (
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            <Chip>Default</Chip>
            <Chip variant="primary">Primary</Chip>
            <Chip variant="outline">Outline</Chip>
            <Chip variant="success">Shipped</Chip>
            <Chip variant="warning">Beta</Chip>
            <Chip variant="info">New</Chip>
            <Chip variant="destructive">Blocked</Chip>
          </View>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            <Chip size="sm">Small</Chip>
            <Chip size="md">Medium</Chip>
            <Chip size="lg">Large</Chip>
          </View>
        ),
      },
      {
        label: 'With a leading icon',
        render: () => (
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            <Chip variant="success" start={<CheckIcon size={13} />}>
              <Chip.Label>Available</Chip.Label>
            </Chip>
            <Chip variant="outline" start={<SearchIcon size={13} />}>
              <Chip.Label>Search</Chip.Label>
            </Chip>
          </View>
        ),
      },
      { label: 'A filter bar', render: () => <ChipFilterDemo /> },
      { label: 'Removable tokens', render: () => <ChipRemovableDemo /> },
    ],
  },
  {
    slug: 'color-picker',
    name: 'ColorPicker',
    summary: 'A colour chosen by dragging, not by typing',
    demos: [
      {
        label: 'Accent card',
        id: 'card',
        fullPage: true,
        description:
          'A labelled strip over the square, and a readout naming the track under it.',
        render: () => <ColorPickerCardVersion />,
      },
      {
        label: 'Wheel',
        id: 'wheel',
        fullPage: true,
        description:
          'Hue around and saturation out, with brightness on a track of its own.',
        render: () => <ColorPickerWheelVersion />,
      },
      { label: 'Interactive', render: () => <ColorPickerDemo /> },
      { label: 'With opacity', render: () => <ColorPickerAlphaDemo /> },
      { label: 'Presets first', render: () => <ColorPickerSwatchesDemo /> },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-6">
            <ColorPicker defaultValue="#8b5cf6" size="sm">
              <ColorPicker.Area />
              <ColorPicker.Hue />
            </ColorPicker>
            <ColorPicker defaultValue="#f59e0b" size="lg">
              <ColorPicker.Area />
              <ColorPicker.Hue />
            </ColorPicker>
          </View>
        ),
      },
      {
        label: 'Disabled',
        render: () => (
          <ColorPicker defaultValue="#64748b" disabled>
            <ColorPicker.Area height={110} />
            <ColorPicker.Hue />
            <ColorPicker.Preview showValue />
          </ColorPicker>
        ),
      },
    ],
  },
  {
    slug: 'combobox',
    name: 'Combobox',
    summary: 'A text field that filters a list as you type',
    demos: [
      { label: 'Filter as you type', render: () => <ComboboxDemo /> },
      { label: 'Grouped options', render: () => <ComboboxGroupedDemo /> },
      { label: 'Several at once', render: () => <ComboboxMultipleDemo /> },
      { label: 'Values it does not know about', render: () => <ComboboxTagsDemo /> },
      { label: 'Fetched for the query', render: () => <ComboboxAsyncDemo /> },
      { label: 'Inline — nothing is covered', render: () => <ComboboxInlineDemo /> },
    ],
  },
  {
    slug: 'questionnaire',
    name: 'Questionnaire',
    summary: 'One question at a time, with progress and a way back',
    demos: [
      { label: 'One answer at a time', render: () => <QuestionnaireDemo /> },
      { label: 'Selecting more than one', render: () => <QuestionnaireMultipleDemo /> },
      { label: 'An answer that is not listed', render: () => <QuestionnaireFreeformDemo /> },
      { label: 'A letter beside every answer', render: () => <QuestionnaireShortcutsDemo /> },
      { label: 'Numbers instead of pips', render: () => <QuestionnaireNumbersDemo /> },
      { label: 'Without the frame', render: () => <QuestionnaireBareDemo /> },
      {
        label: 'Getting set up',
        id: 'onboarding',
        fullPage: true,
        description:
          'Five questions and the summary they add up to — required, optional, multi-answer and freeform in one flow.',
        render: () => <QuestionnaireOnboardingVersion />,
      },
      {
        label: 'In a sheet',
        id: 'sheet',
        fullPage: true,
        description:
          'Two questions in a bottom sheet, where the sheet owns dismissal and the questionnaire owns the questions.',
        render: () => <QuestionnaireSheetVersion />,
      },
    ],
  },
  {
    slug: 'date-picker',
    name: 'DatePicker',
    summary: 'A calendar behind a button',
    demos: [
      { label: 'Single, range and birthday', render: () => <DatePickerDemo /> },
      { label: 'In a sheet', render: () => <DatePickerSheetDemo /> },
    ],
  },
  {
    slug: 'date-time-picker',
    name: 'DateTimePicker',
    summary: 'A day and a time, picked in one panel',
    demos: [
      { label: 'Both halves at once', render: () => <DateTimePickerDemo /> },
      { label: 'In a sheet', render: () => <DateTimePickerSheetDemo /> },
      { label: 'The wheel face', render: () => <DateTimePickerWheelDemo /> },
      { label: 'Booking a slot', render: () => <DateTimePickerSlotDemo /> },
    ],
  },
  {
    slug: 'dialog',
    name: 'Dialog',
    summary: 'Modal confirmation overlay',
    demos: [
      {
        label: 'Confirmation',
        render: () => (
          <Dialog>
            <Dialog.Trigger>
              <Button variant="outline">Open dialog</Button>
            </Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Title>Delete project?</Dialog.Title>
              <Dialog.Description>
                This action cannot be undone. The project and all of its data
                will be permanently removed.
              </Dialog.Description>
              <Dialog.Footer>
                <Dialog.Close>
                  <Button size="sm" variant="ghost">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Dialog.Close>
                  <Button size="sm" variant="destructive">
                    Delete
                  </Button>
                </Dialog.Close>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
        ),
      },
      {
        label: 'Informational',
        render: () => (
          <Dialog>
            <Dialog.Trigger>
              <Button variant="outline">What's new</Button>
            </Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Title>PanelUI 0.4</Dialog.Title>
              <Dialog.Description>
                Themes now change corner radius as well as colour, and there is
                a new Steps component for multi-step flows.
              </Dialog.Description>
              <Dialog.Footer>
                <Dialog.Close>
                  <Button size="sm">Got it</Button>
                </Dialog.Close>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
        ),
      },
      {
        label: 'Blurred background',
        render: () => (
          <Dialog>
            <Dialog.Trigger>
              <Button variant="outline">Open, blurred</Button>
            </Dialog.Trigger>
            {/* `blur` frosts the screen instead of dimming it — and falls back
                to the dim when expo-blur is not installed. */}
            <Dialog.Content blur>
              <Dialog.Title>Leave without saving?</Dialog.Title>
              <Dialog.Description>
                Your changes will be lost. The screen behind is blurred so the
                choice is the only thing in focus.
              </Dialog.Description>
              <Dialog.Footer>
                <Dialog.Close>
                  <Button size="sm" variant="ghost">
                    Keep editing
                  </Button>
                </Dialog.Close>
                <Dialog.Close>
                  <Button size="sm" variant="destructive">
                    Discard
                  </Button>
                </Dialog.Close>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
        ),
      },
    ],
  },
  {
    slug: 'direction',
    name: 'Direction',
    summary: 'Reading direction for everything below it',
    demos: [
      {
        label: 'A whole screen, both ways',
        id: 'screen',
        fullPage: true,
        description: 'The parts Yoga cannot flip on its own — a drag, a thumb, a sweep, a glyph.',
        render: () => <DirectionScreenVersion />,
      },
      { label: 'Flip it live', render: () => <DirectionFlipDemo /> },
      { label: 'Nested, with an island', render: () => <DirectionNestedDemo /> },
      {
        label: 'Right to left',
        render: () => (
          <Direction dir="rtl" className="w-full">
            <DirectionRows />
          </Direction>
        ),
      },
    ],
  },
  {
    slug: 'drawer',
    name: 'Drawer',
    summary: 'A panel that comes in from an edge of the screen',
    demos: [
      { label: 'Navigation drawer', render: () => <DrawerNavigationDemo /> },
      {
        label: 'From the end edge',
        render: () => <DrawerFiltersDemo />,
      },
      { label: 'Sizes', render: () => <DrawerSizesDemo /> },
      {
        label: 'From the top',
        render: () => (
          // On the vertical axis the sides mean what they say — there is no
          // reading direction to mirror.
          <Drawer>
            <Drawer.Trigger>
              <Button variant="outline">Notifications</Button>
            </Drawer.Trigger>
            <Drawer.Content side="top" size="sm">
              <Drawer.Header title="Notifications" />
              <Drawer.Body>
                <Item>
                  <Item.Content>
                    <Item.Title>Build passed</Item.Title>
                    <Item.Description>2 minutes ago</Item.Description>
                  </Item.Content>
                </Item>
                <Item>
                  <Item.Content>
                    <Item.Title>New comment</Item.Title>
                    <Item.Description>1 hour ago</Item.Description>
                  </Item.Content>
                </Item>
              </Drawer.Body>
            </Drawer.Content>
          </Drawer>
        ),
      },
      {
        label: 'Right to left',
        render: () => (
          // The same `side="start"` drawer, mirrored: it docks to the right,
          // slides in from the right, and dismisses on a swipe to the right.
          <Direction dir="rtl" className="w-full">
            <Drawer>
              <Drawer.Trigger>
                <Button variant="outline">افتح القائمة</Button>
              </Drawer.Trigger>
              <Drawer.Content side="start">
                <Drawer.Header title="مساحة العمل" />
                <Drawer.Body>
                  {['المشاريع', 'الأعضاء'].map((label) => (
                    <Item key={label}>
                      <Item.Content>
                        <Item.Title>{label}</Item.Title>
                      </Item.Content>
                    </Item>
                  ))}
                </Drawer.Body>
              </Drawer.Content>
            </Drawer>
          </Direction>
        ),
      },
    ],
  },
  {
    slug: 'empty-state',
    name: 'EmptyState',
    summary: 'Placeholder for a view with no content',
    demos: [
      {
        label: 'With icon',
        render: () => (
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <SearchIcon size={18} />
              </EmptyState.Media>
              <EmptyState.Title>No results found</EmptyState.Title>
              <EmptyState.Description>
                Try adjusting your search or filters to find what you're looking
                for.
              </EmptyState.Description>
            </EmptyState.Header>
            <EmptyState.Content>
              <Button variant="outline" fullWidth>
                Clear filters
              </Button>
            </EmptyState.Content>
          </EmptyState>
        ),
      },
      {
        label: 'Text only',
        render: () => (
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Title>Nothing here yet</EmptyState.Title>
              <EmptyState.Description>
                Projects you create will show up on this screen.
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        ),
      },
      {
        label: 'In a card',
        render: () => (
          // The card variant is a self-contained block, for an empty state
          // that sits inside content rather than owning the screen.
          <EmptyState variant="card" size="sm" className="w-full">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <BellIcon size={16} />
              </EmptyState.Media>
              <EmptyState.Title>No notifications</EmptyState.Title>
              <EmptyState.Description>
                You're all caught up.
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-3">
            {(['sm', 'default', 'lg'] as const).map((size) => (
              <EmptyState key={size} variant="card" size={size} className="w-full">
                <EmptyState.Header>
                  <EmptyState.Title>Size {size}</EmptyState.Title>
                  <EmptyState.Description>
                    Padding and type scale together.
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            ))}
          </View>
        ),
      },
    ],
  },
  {
    slug: 'field',
    name: 'Field',
    summary: 'Layout and validation-state kit for a form control',
    demos: [{ label: 'Anatomy', render: () => <FieldDemo /> }],
  },
  {
    slug: 'form',
    name: 'Form',
    summary: 'Form state with no form library underneath',
    demos: [
      { label: 'Sign in', render: () => <FormDemo /> },
      {
        label: 'Sign up form',
        id: 'sign-up-form',
        fullPage: true,
        description:
          'Cross-field validation, a checkbox with its own change prop, and a submit that waits on every field.',
        render: () => <SignUpFormVersion />,
      },
      {
        label: 'Preferences',
        id: 'preferences',
        fullPage: true,
        description: 'The layout kit grouping switches, with no form hook involved.',
        render: () => <PreferencesVersion />,
      },
    ],
  },
  {
    slug: 'flow',
    name: 'Flow',
    summary: 'Pan-and-zoom canvas of draggable nodes joined by animated edges',
    // A canvas that pans has no drag left to give a pager: a vertical swipe
    // over it is contested, and whichever wins is the one the user did not
    // mean. Stacked instead, where the only scroller is the page's own.
    layout: 'sections',
    demos: [
      { label: 'In a box', render: () => <FlowInlineDemo /> },
      { label: 'Edge shapes', render: () => <FlowEdgeShapesDemo /> },
      {
        label: 'Infrastructure map',
        id: 'infrastructure',
        fullPage: true,
        description:
          'Two services and the dependency between them. Drag a node and the edge follows it in real time.',
        render: () => <FlowInfrastructureVersion />,
      },
      {
        label: 'Build pipeline',
        id: 'pipeline',
        fullPage: true,
        description:
          'Stages running top to bottom, with only the live edge marching. Advance it and watch the animation move.',
        render: () => <FlowPipelineVersion />,
      },
      {
        label: 'Wiring it up',
        id: 'connect',
        fullPage: true,
        description:
          'Drag from one port to another to create an edge. The canvas reports the connection; the graph stays yours.',
        render: () => <FlowConnectVersion />,
      },
      {
        label: 'Mind map',
        id: 'mind-map',
        fullPage: true,
        description: 'Curved edges radiating from a centre, and no fixed sides — drag a branch across and the edge re-routes.',
        render: () => <FlowMindMapVersion />,
      },
      {
        label: 'Building a graph',
        id: 'builder',
        fullPage: true,
        description:
          'One button adds a frame, the other adds one already wired to the last. The canvas holds no list of its own.',
        render: () => <FlowBuilderVersion />,
      },
      {
        label: 'Named ports',
        id: 'ports',
        fullPage: true,
        description:
          'Edges pinned to handles instead of routed automatically, for a diagram where the sides mean something.',
        render: () => <FlowPortsVersion />,
      },
      {
        label: 'Groups and a minimap',
        id: 'grouped',
        fullPage: true,
        description:
          'Two containers joined by one edge, holding contents that travel with them, and an overview of the parts off screen.',
        render: () => <FlowGroupedVersion />,
      },
    ],
  },
  {
    slug: 'frame',
    name: 'Frame',
    summary: 'Widget shell with a titled header and a flush inner card',
    layout: 'sections',
    demos: [
      {
        label: 'Agent monitor',
        render: () => (
          <Frame className="w-full">
            <Frame.Header>
              <Frame.Title>Agent monitor</Frame.Title>
              <Frame.Action>All agents under 25% token limit</Frame.Action>
            </Frame.Header>
            <Frame.Panel>
              {[
                ['GPT 5.6 Sol', 'UX research for fintech trends', 'Done', '10m7s'],
                ['Fable 5', 'Planning out the app user flow', 'Running', '15m12s'],
                ['GPT 5.6 Sol', 'Building out the UI design system', 'Running', '15m12s'],
                ['Haiku 4.5', 'On standby', 'Idle', '0s'],
              ].map(([model, task, status, elapsed]) => (
                <Frame.Row key={task}>
                  <Frame.Content>
                    <Frame.Title>{model}</Frame.Title>
                    <Frame.Description>{task}</Frame.Description>
                  </Frame.Content>
                  <Frame.Actions>
                    <Chip
                      size="sm"
                      variant={
                        status === 'Running'
                          ? 'success'
                          : status === 'Done'
                            ? 'outline'
                            : 'default'
                      }
                    >
                      {status}
                    </Chip>
                    <Text size="xs" muted>
                      {elapsed}
                    </Text>
                  </Frame.Actions>
                </Frame.Row>
              ))}
            </Frame.Panel>
          </Frame>
        ),
      },
      {
        label: 'A single row',
        render: () => (
          // The whole widget is one row of the card, with the header strip
          // above it — the compact end of the same shape.
          <Frame className="w-full">
            <Frame.Header>
              <Frame.Title>Agent monitor</Frame.Title>
              <Frame.Action>25% token limit</Frame.Action>
            </Frame.Header>
            <Frame.Panel>
              {/* `wrap` rather than a spacer: five things in one row do not fit
                  on a narrow screen, and a second line is better than a chip
                  disappearing off the edge. */}
              <Frame.Row wrap className="gap-2">
                <Chip size="sm" variant="success">
                  2 Running
                </Chip>
                <Chip size="sm">1 Idle</Chip>
                <Chip size="sm" variant="outline">
                  1 Done
                </Chip>
                <Frame.Actions className="ml-auto">
                  <Text size="xs" muted>
                    15m12s ago
                  </Text>
                </Frame.Actions>
              </Frame.Row>
            </Frame.Panel>
          </Frame>
        ),
      },
      {
        label: 'Usage summary',
        render: () => (
          <Frame className="w-full">
            <Frame.Header>
              <Frame.Title>Usage Type</Frame.Title>
              <Frame.Action>Amount</Frame.Action>
            </Frame.Header>
            <Frame.Panel>
              {[
                ['Total API Requests', '33.1K', 25],
                ['Input Tokens', '98.2M', 70],
                ['Output Tokens', '59M', 45],
                ['Total Spend', '$149.61', 85],
              ].map(([label, value, pct]) => (
                <Frame.Row key={label as string}>
                  <Frame.Media>
                    <Meter percent={pct as number} />
                  </Frame.Media>
                  <Frame.Content>
                    <Text numberOfLines={1}>{label}</Text>
                  </Frame.Content>
                  <Frame.Actions>
                    <Text weight="medium">{value}</Text>
                  </Frame.Actions>
                </Frame.Row>
              ))}
            </Frame.Panel>
          </Frame>
        ),
      },
      {
        label: 'Member list',
        render: () => (
          <Frame className="w-full">
            <Frame.Header>
              <Frame.Title>Team members</Frame.Title>
              <Frame.Action>
                <Badge variant="secondary">3</Badge>
              </Frame.Action>
            </Frame.Header>
            <Frame.Panel>
              {[
                ['KA', 'Khalid Abdi', 'khalid@example.com', 'Owner'],
                ['JD', 'Jamie Doe', 'jamie@example.com', 'Editor'],
                ['SM', 'Sam Miller', 'sam@example.com', 'Viewer'],
              ].map(([initials, name, email, role]) => (
                <Frame.Row key={email}>
                  <Frame.Media>
                    <Avatar size="sm" fallback={initials} />
                  </Frame.Media>
                  <Frame.Content>
                    <Frame.Title>{name}</Frame.Title>
                    <Frame.Description>{email}</Frame.Description>
                  </Frame.Content>
                  <Frame.Actions>
                    <Badge variant="outline">{role}</Badge>
                  </Frame.Actions>
                </Frame.Row>
              ))}
            </Frame.Panel>
          </Frame>
        ),
      },
      {
        label: 'Settings group',
        render: () => (
          <Frame className="w-full">
            <Frame.Header>
              <Frame.Title>Preferences</Frame.Title>
              <Frame.Action>Edit</Frame.Action>
            </Frame.Header>
            <Frame.Panel>
              {[
                ['Language', 'English'],
                ['Region', 'United States'],
                ['Time zone', 'GMT+3'],
              ].map(([label, value]) => (
                <Frame.Row key={label}>
                  <Text size="sm" className="flex-1">
                    {label}
                  </Text>
                  <Text size="sm" muted>
                    {value}
                  </Text>
                </Frame.Row>
              ))}
            </Frame.Panel>
          </Frame>
        ),
      },
      {
        label: 'A row that would not fit',
        render: () => (
          // Everything here is longer than the room it has. The slots are what
          // keep it readable: the icon and the trailing chips hold their size,
          // and the text column shrinks around them instead of pushing them
          // past the edge, where the frame would clip them away.
          <Frame className="w-full">
            <Frame.Header>
              <Frame.Title>
                Deployment history for the production environment
              </Frame.Title>
              <Frame.Action>Last 7 days</Frame.Action>
            </Frame.Header>
            <Frame.Panel>
              <Frame.Row align="start">
                <Frame.Media>
                  <Avatar size="sm" fallback="KA" />
                </Frame.Media>
                <Frame.Content>
                  <Frame.Title>
                    feat(registry): resolve relative imports through the alias table
                  </Frame.Title>
                  <Frame.Description>
                    Deployed to production from the main branch about two hours
                    ago, after the full test suite passed on every workspace.
                  </Frame.Description>
                </Frame.Content>
                <Frame.Actions>
                  <Chip size="sm" variant="success">
                    Live
                  </Chip>
                  <Chip size="sm" variant="outline">
                    2h
                  </Chip>
                </Frame.Actions>
              </Frame.Row>
              <Frame.Row align="start">
                <Frame.Media>
                  <Avatar size="sm" fallback="JD" />
                </Frame.Media>
                <Frame.Content>
                  <Frame.Title>fix(bottom-sheet): restore the bottom border</Frame.Title>
                  <Frame.Description>
                    Rolled back after an hour — the detached sheet lost its
                    bottom edge on devices without a home indicator.
                  </Frame.Description>
                </Frame.Content>
                <Frame.Actions>
                  <Chip size="sm">Rolled back</Chip>
                </Frame.Actions>
              </Frame.Row>
            </Frame.Panel>
          </Frame>
        ),
      },
      {
        label: 'Rows that lead somewhere',
        render: () => (
          <Frame className="w-full">
            <Frame.Header>
              <Frame.Title>Account</Frame.Title>
            </Frame.Header>
            <Frame.Panel>
              {/* An onPress makes the row a real pressable — press feedback and
                  a button role — and `chevron` says so before you tap it. */}
              {['Profile', 'Notifications', 'Connected apps'].map((label) => (
                <Frame.Row key={label} chevron onPress={() => {}}>
                  <Text size="sm" className="flex-1">
                    {label}
                  </Text>
                </Frame.Row>
              ))}
            </Frame.Panel>
          </Frame>
        ),
      },
      {
        label: 'Sections',
        render: () => (
          <Frame className="w-full">
            <Frame.Header>
              <Frame.Title>Workspace</Frame.Title>
              <Frame.Action>Manage</Frame.Action>
            </Frame.Header>
            <Frame.Panel>
              <Frame.Section title="General">
                <Frame.Row>
                  <Text size="sm" className="flex-1">
                    Name
                  </Text>
                  <Text size="sm" muted>
                    Acme
                  </Text>
                </Frame.Row>
                <Frame.Row>
                  <Text size="sm" className="flex-1">
                    Plan
                  </Text>
                  <Badge variant="secondary">Pro</Badge>
                </Frame.Row>
              </Frame.Section>
              <Frame.Section title="Danger zone">
                <Frame.Row chevron onPress={() => {}}>
                  <Text size="sm" className="flex-1 text-destructive">
                    Delete workspace
                  </Text>
                </Frame.Row>
              </Frame.Section>
            </Frame.Panel>
          </Frame>
        ),
      },
      {
        label: 'Plain, inside a card',
        render: () => (
          // The card already draws a border; the default shell would put a
          // second edge just inside it.
          <Card className="w-full">
            <Card.Content className="p-4">
              <Frame variant="plain">
                <Frame.Panel>
                  {[
                    ['Requests', '12.4K'],
                    ['Errors', '38'],
                  ].map(([label, value]) => (
                    <Frame.Row key={label}>
                      <Text size="sm" className="flex-1">
                        {label}
                      </Text>
                      <Text size="sm" weight="medium">
                        {value}
                      </Text>
                    </Frame.Row>
                  ))}
                </Frame.Panel>
              </Frame>
            </Card.Content>
          </Card>
        ),
      },
    ],
  },
  {
    slug: 'heatmap-chart',
    name: 'HeatmapChart',
    summary: 'Contribution grid with a themed colour ramp',
    layout: 'pager',
    demos: [
      {
        label: 'Contribution grid',
        id: 'contribution',
        fullPage: true,
        description:
          'A full year, scrolled sideways. Hold to read a day — a swipe scrolls instead.',
        render: () => <HeatmapContributionVersion />,
      },
      {
        label: 'Filling the width',
        id: 'fill',
        fullPage: true,
        description: 'A quarter with the cells sized to the space they are given.',
        render: () => <HeatmapFillVersion />,
      },
      {
        label: 'Quarters',
        id: 'quarters',
        fullPage: true,
        description: 'Rules grouping the columns, and a ramp off a colour of your own.',
        render: () => <HeatmapQuartersVersion />,
      },
      {
        label: 'Punchcard',
        id: 'punchcard',
        fullPage: true,
        description: 'Rows that are hours rather than days — when the week actually lands.',
        render: () => <HeatmapPunchcardVersion />,
      },
    ],
  },
  {
    slug: 'input',
    name: 'Input',
    summary: 'Text field with label and validation',
    demos: [
      { label: 'Icons inside the field', render: () => <InputContentDemo /> },
      {
        label: 'States',
        render: () => (
          <View className="w-full gap-4">
            <Input label="Name" placeholder="Khalid Abdi" />
            <Input
              label="Description"
              placeholder="A short description"
              description="Shown on your public profile."
            />
            <Input
              label="Email"
              placeholder="you@example.com"
              errorMessage="This email is already taken."
            />
            <Input label="Plan" value="Premium" disabled />
          </View>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-4">
            <Input size="sm" label="Small" placeholder="40 tall" />
            <Input size="md" label="Medium" placeholder="48 tall" />
            <Input size="lg" label="Large" placeholder="56 tall" />
          </View>
        ),
      },
      {
        label: 'Filled',
        render: () => (
          // `filled` inside a card: a second border beside the card's own
          // reads as a seam, so the field carries a background instead.
          <Card className="w-full">
            <Card.Content className="gap-4 p-4">
              <Input variant="filled" label="Workspace" placeholder="Acme" isRequired />
              <Input
                variant="filled"
                label="Notes"
                placeholder="Anything we should know?"
                multiline
              />
            </Card.Content>
          </Card>
        ),
      },
      {
        label: 'In a form',
        render: () => (
          <Card className="w-full">
            <Card.Header>
              <Card.Title>Sign in</Card.Title>
              <Card.Description>Welcome back.</Card.Description>
            </Card.Header>
            <Card.Content className="gap-4">
              <Input label="Email" placeholder="you@example.com" isRequired />
              <Input label="Password" secureTextEntry placeholder="••••••••" isRequired />
            </Card.Content>
            <Card.Footer>
              <Button fullWidth>Continue</Button>
            </Card.Footer>
          </Card>
        ),
      },
      {
        label: 'Lifting in a scroll view',
        id: 'in-a-scroll-view',
        fullPage: true,
        description:
          'A field that lifts by its overlap with the keyboard, and keeps its place in the form as you scroll.',
        render: () => <KeyboardLiftDemo />,
      },
      {
        label: 'Docked composer',
        id: 'docked-composer',
        fullPage: true,
        description:
          'A bar pinned to the bottom edge that rides the keyboard up and back down.',
        render: () => <KeyboardDockDemo />,
      },
    ],
  },
  {
    slug: 'input-group',
    name: 'InputGroup',
    summary: 'Input with prefix and suffix decorators',
    demos: [
      {
        label: 'With prefix',
        render: () => (
          <InputGroup className="w-full">
            <InputGroup.Prefix isDecorative>
              <SearchIcon size={16} />
            </InputGroup.Prefix>
            <InputGroup.Input placeholder="Search products…" />
          </InputGroup>
        ),
      },
      { label: 'Interactive suffix', render: () => <PasswordInputDemo /> },
      {
        label: 'Disabled',
        render: () => (
          <InputGroup isDisabled className="w-full">
            <InputGroup.Prefix isDecorative>
              <SearchIcon size={16} />
            </InputGroup.Prefix>
            <InputGroup.Input placeholder="Disabled input" />
          </InputGroup>
        ),
      },
    ],
  },
  {
    slug: 'number-input',
    name: 'NumberInput',
    summary: 'Numeric field stepped by buttons or typed',
    demos: [
      { label: 'Quantity & budget', render: () => <NumberInputDemo /> },
      {
        label: 'Bounds & step',
        render: () => (
          <View className="w-full gap-5">
            <NumberInput defaultValue={0} min={0} max={5} />
            <NumberInput defaultValue={0} min={0} max={1} step={0.1} />
            <NumberInput
              label="Guests"
              description="Up to eight per reservation."
              defaultValue={2}
              min={1}
              max={8}
            />
          </View>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-5">
            <NumberInput size="sm" defaultValue={1} />
            <NumberInput size="md" defaultValue={1} />
            <NumberInput size="lg" defaultValue={1} />
          </View>
        ),
      },
      {
        label: 'Variants',
        render: () => (
          <View className="w-full gap-5">
            <NumberInput variant="outline" defaultValue={1} />
            <NumberInput variant="filled" defaultValue={1} />
            <NumberInput defaultValue={3} disabled />
          </View>
        ),
      },
    ],
  },
  {
    slug: 'otp-input',
    name: 'OtpInput',
    summary: 'One-time-code field, one cell per digit',
    demos: [
      { label: 'Verify a code', render: () => <OtpVerifyDemo /> },
      {
        label: 'Masked',
        render: () => (
          <View className="w-full items-center">
            <OtpInput length={4} mask defaultValue="12" />
          </View>
        ),
      },
      {
        label: 'Grouped',
        render: () => (
          <View className="w-full items-center">
            <OtpInput length={6} groupEvery={3} defaultValue="12" />
          </View>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full items-center gap-4">
            <OtpInput size="sm" length={4} defaultValue="12" />
            <OtpInput size="md" length={4} defaultValue="12" />
            <OtpInput size="lg" length={4} defaultValue="12" />
          </View>
        ),
      },
      {
        label: 'Letters',
        render: () => (
          <View className="w-full items-center">
            <OtpInput length={5} type="text" placeholder="•" />
          </View>
        ),
      },
    ],
  },
  {
    slug: 'grid-item',
    name: 'GridItem',
    summary: 'Bento tiles, and the grid that places them',
    demos: [
      { label: 'A bento of stats', render: () => <GridItemBentoDemo /> },
      { label: 'Spans', render: () => <GridItemSpansDemo /> },
      { label: 'Behind the text', render: () => <GridItemBackgroundDemo /> },
      { label: 'A wall of watermarks', render: () => <GridItemWatermarksDemo /> },
      { label: 'Pressable tiles', render: () => <GridItemPressableDemo /> },
      { label: 'Three across', render: () => <GridItemCompactDemo /> },
    ],
  },
  {
    slug: 'item',
    name: 'Item',
    summary: 'Row of media, text and actions',
    demos: [
      {
        label: 'Variants',
        render: () => (
          <View className="w-full gap-3">
            {(['default', 'outline', 'muted'] as const).map((variant) => (
              <Item key={variant} variant={variant}>
                <Item.Media variant="icon">
                  <PackageIcon size={18} />
                </Item.Media>
                <Item.Content>
                  <Item.Title>{variant}</Item.Title>
                  <Item.Description>
                    The {variant} surface treatment.
                  </Item.Description>
                </Item.Content>
                <Item.Actions>
                  <Badge variant="secondary">New</Badge>
                </Item.Actions>
              </Item>
            ))}
          </View>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-3">
            {(['default', 'sm', 'xs'] as const).map((size) => (
              <Item key={size} variant="outline" size={size}>
                <Item.Media variant="icon">
                  <ReceiptIcon size={size === 'xs' ? 12 : 16} />
                </Item.Media>
                <Item.Content>
                  <Item.Title>Size {size}</Item.Title>
                  <Item.Description>
                    Media, title and description all follow it.
                  </Item.Description>
                </Item.Content>
              </Item>
            ))}
          </View>
        ),
      },
      {
        label: 'Media types',
        render: () => (
          <View className="w-full gap-3">
            <Item variant="outline">
              <Item.Media variant="icon">
                <BellIcon size={18} />
              </Item.Media>
              <Item.Content>
                <Item.Title>Icon tile</Item.Title>
                <Item.Description>variant=&quot;icon&quot;</Item.Description>
              </Item.Content>
            </Item>

            <Item variant="outline">
              <Item.Media variant="image">
                <Image source={{ uri: PHOTO }} className="h-full w-full" />
              </Item.Media>
              <Item.Content>
                <Item.Title>Thumbnail</Item.Title>
                <Item.Description>variant=&quot;image&quot;</Item.Description>
              </Item.Content>
            </Item>

            <Item variant="outline">
              <Item.Media>
                <Avatar size="md" source={{ uri: AVATARS[0] }} fallback="KA" />
              </Item.Media>
              <Item.Content>
                <Item.Title>Avatar passed through</Item.Title>
                <Item.Description>
                  The default media variant adds no box.
                </Item.Description>
              </Item.Content>
            </Item>
          </View>
        ),
      },
      {
        label: 'A settings group',
        render: () => (
          <Card className="w-full overflow-hidden">
            <Item.Group>
              {[
                ['Notifications', 'Push, email and in-app'],
                ['Privacy', 'Who can see your activity'],
                ['Appearance', 'Theme and text size'],
              ].map(([title, description], index) => (
                <View key={title}>
                  {index > 0 ? <Item.Separator /> : null}
                  <Item size="sm" onPress={() => {}}>
                    <Item.Content>
                      <Item.Title>{title}</Item.Title>
                      <Item.Description>{description}</Item.Description>
                    </Item.Content>
                    <Item.Actions>
                      <ChevronRightIcon size={16} />
                    </Item.Actions>
                  </Item>
                </View>
              ))}
            </Item.Group>
          </Card>
        ),
      },
      {
        label: 'Horizontal group of cards',
        render: () => (
          <View className="w-full gap-4">
            <Text size="sm" muted>
              Two independent axes. `orientation` on the group runs the items
              across instead of down; `orientation` on each item stacks its own
              parts into a card. A carousel wants both.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Item.Group orientation="horizontal">
                {[
                  ['Starter', '$0', 'One project'],
                  ['Pro', '$12', 'Unlimited projects'],
                  ['Team', '$40', 'Shared workspaces'],
                ].map(([name, price, summary]) => (
                  <Item
                    key={name}
                    orientation="vertical"
                    variant="outline"
                    className="w-48"
                  >
                    <Item.Media variant="icon">
                      <PackageIcon size={18} />
                    </Item.Media>
                    <Item.Content>
                      <Item.Title>{name}</Item.Title>
                      <Item.Description>{summary}</Item.Description>
                    </Item.Content>
                    <Item.Footer>
                      <Text weight="semibold">{price}</Text>
                      <Text size="xs" muted>
                        per month
                      </Text>
                    </Item.Footer>
                  </Item>
                ))}
              </Item.Group>
            </ScrollView>
          </View>
        ),
      },
      {
        label: 'A vertical item',
        render: () => (
          // orientation="vertical" is also what Header and Footer need — both
          // are full-width strips, so they only make sense once it stacks.
          <Item orientation="vertical" variant="outline">
            <Item.Header>
              <Badge variant="secondary">Draft</Badge>
              <Text size="xs" muted>
                Updated 2h ago
              </Text>
            </Item.Header>
            <Item.Content>
              <Item.Title>Quarterly report</Item.Title>
              <Item.Description>
                Revenue, retention and headcount for Q3.
              </Item.Description>
            </Item.Content>
            <Item.Footer>
              <Button size="sm" variant="outline">
                Preview
              </Button>
              <Button size="sm">Publish</Button>
            </Item.Footer>
          </Item>
        ),
      },
    ],
  },
  {
    slug: 'label',
    name: 'Label',
    summary: 'Form field label with required and invalid states',
    demos: [
      {
        label: 'States',
        render: () => (
          <View className="w-full gap-5">
            <View className="gap-1.5">
              <Label>Username</Label>
              <Input placeholder="Choose a username" />
            </View>
            <View className="gap-1.5">
              <Label isRequired>Password</Label>
              <Input placeholder="Create a password" secureTextEntry />
            </View>
            <View className="gap-1.5">
              <Label isInvalid>Confirm password</Label>
              <Input value="different" errorMessage="Passwords do not match" />
            </View>
            <View className="gap-1.5">
              <Label isDisabled>Subscription plan</Label>
              <Input value="Premium" disabled />
            </View>
          </View>
        ),
      },
      {
        label: 'Custom layout',
        render: () => (
          <View className="w-full gap-1.5">
            <Label isRequired>
              <Label.Text className="text-base font-semibold">
                API key
              </Label.Text>
            </Label>
            <Input placeholder="sk-…" />
          </View>
        ),
      },
    ],
  },
  {
    slug: 'line-chart',
    name: 'LineChart',
    summary: 'Animated time series, drawn on the UI thread',
    layout: 'pager',
    demos: [
      {
        label: 'Basic',
        id: 'basic',
        fullPage: true,
        description: 'Two straight-line series sharing one axis, with a legend.',
        render: () => <ChartBasicVersion />,
      },
      {
        label: 'Both axes',
        id: 'both-axes',
        fullPage: true,
        description: 'Value labels down the side, each centred on the grid line it names.',
        render: () => <ChartBothAxesVersion />,
      },
      {
        label: 'With dots',
        id: 'dots',
        fullPage: true,
        description: 'A dot at every point, for a short series where each reading matters.',
        render: () => <ChartDotsVersion />,
      },
      {
        label: 'Crosshair',
        id: 'crosshair',
        fullPage: true,
        description: 'Drag across the chart and a label rides the crosshair with the value.',
        render: () => <ChartCrosshairVersion />,
      },
      {
        label: 'Animated line',
        id: 'animated',
        fullPage: true,
        description: 'A Replay button re-runs the reveal through the chart ref.',
        render: () => <ChartAnimatedVersion />,
      },
      {
        label: 'Finance',
        id: 'finance',
        fullPage: true,
        description: 'A balance, a delta, and a range selector that tweens the axis on change.',
        render: () => <ChartFinanceVersion />,
      },
      {
        label: 'Dashed comparison',
        id: 'dashed',
        fullPage: true,
        description: 'A solid actual against a dashed target — told apart by shape, not just colour.',
        render: () => <ChartDashedVersion />,
      },
      {
        label: 'Multi-line',
        id: 'multi',
        fullPage: true,
        description: 'Four series in the chart-token ramp.',
        render: () => <ChartMultiVersion />,
      },
    ],
  },
  {
    slug: 'kpi',
    name: 'Kpi',
    summary: 'One number, and what it is doing',
    layout: 'pager',
    demos: [
      {
        label: 'Default',
        id: 'default',
        fullPage: true,
        description: 'Number and change on the left, the shape it made on the right.',
        render: () => <KpiDefaultVersion />,
      },
      {
        label: 'With a sparkline',
        id: 'sparkline',
        fullPage: true,
        description: 'The shape under the number, and the shape beside it.',
        render: () => <KpiSparklineVersion />,
      },
      {
        label: 'With progress',
        id: 'progress',
        fullPage: true,
        description: 'Targets, with an icon, a badge and a bar under each number.',
        render: () => <KpiProgressVersion />,
      },
      {
        label: 'Several as one panel',
        id: 'group',
        fullPage: true,
        description: 'Divided by a rule rather than spaced apart, in a row and a column.',
        render: () => <KpiGroupVersion />,
      },
    ],
  },
  {
    slug: 'radar-chart',
    name: 'RadarChart',
    summary: 'Several measures of one thing, on one shape',
    layout: 'pager',
    demos: [
      {
        label: 'One profile',
        id: 'single',
        fullPage: true,
        description: 'A filled polygon on polygonal rings, with a dot at each vertex.',
        render: () => <RadarSingleVersion />,
      },
      {
        label: 'Two compared',
        id: 'comparison',
        fullPage: true,
        description: 'Two profiles over each other, only the first of them filled.',
        render: () => <RadarComparisonVersion />,
      },
      {
        label: 'Outline on circles',
        id: 'outline',
        fullPage: true,
        description: 'Circular rings and no fill, for reading a value off a spoke.',
        render: () => <RadarOutlineVersion />,
      },
      {
        label: 'Switching the data',
        id: 'switch',
        fullPage: true,
        description: 'Tabs under the chart change what it draws, and the outline travels.',
        render: () => <RadarSwitchVersion />,
      },
    ],
  },
  {
    slug: 'loader',
    name: 'Loader',
    summary: 'Nine loading animations behind one variant prop',
    demos: [
      {
        label: 'The nine',
        id: 'gallery',
        fullPage: true,
        description: 'All of them side by side, which is the only way to choose.',
        render: () => <LoaderGalleryVersion />,
      },
      {
        label: 'Waiting for a screen',
        id: 'screen',
        fullPage: true,
        description: 'Standing in for content that has not arrived yet.',
        render: () => <LoaderScreenVersion />,
      },
      {
        label: 'In place',
        id: 'inline',
        fullPage: true,
        description: 'Inside buttons and cards, taking its colour from the surface.',
        render: () => <LoaderInlineVersion />,
      },
      {
        label: 'Pulse dots',
        render: () => <Loader />,
      },
      {
        label: 'Wave physics',
        render: () => <Loader variant="wave-physics" />,
      },
      {
        label: 'Liquid dots',
        render: () => <Loader variant="liquid-dots" />,
      },
      {
        label: 'Morph ring',
        render: () => <Loader variant="morph-ring" />,
      },
    ],
  },
  {
    slug: 'map',
    name: 'Map',
    summary: 'Vector map drawn from your theme tokens',
    // Every one of these is a whole screen. A map squeezed into a section
    // between two dividers demonstrates nothing except that it does not fit.
    demos: [
      {
        label: 'Places',
        id: 'places',
        fullPage: true,
        fullBleed: true,
        description: 'A street map that is the whole screen — search, pins and a place card.',
        render: () => <PlacesBlock />,
      },
      {
        label: 'Choropleth',
        id: 'choropleth',
        fullPage: true,
        description: 'One layer shaded by a style expression — switch the metric.',
        render: () => <ChoroplethBlock />,
      },
      {
        label: 'Heatmap',
        id: 'heatmap',
        fullPage: true,
        description: 'Density as a field, handing over to the points it was made of.',
        render: () => <HeatmapBlock />,
      },
      {
        label: 'Delivery tracker',
        id: 'delivery',
        fullPage: true,
        description: 'A driven leg and a planned one, told apart by dash.',
        render: () => <DeliveryTrackerBlock />,
      },
      {
        label: 'Store locator',
        id: 'stores',
        fullPage: true,
        description: 'A list and a map on one selection.',
        render: () => <StoreLocatorBlock />,
      },
      {
        label: 'Logistics network',
        id: 'network',
        fullPage: true,
        description: 'Arcs between sites, bowed so lanes sharing a hub stay legible.',
        render: () => <LogisticsNetworkBlock />,
      },
      {
        label: 'Uptime monitor',
        id: 'uptime',
        fullPage: true,
        description: 'Edge nodes coloured by state, spread across the world.',
        render: () => <UptimeMonitorBlock />,
      },
    ],
  },
  {
    slug: 'marker',
    name: 'Marker',
    summary: 'Inline note between conversation turns',
    demos: [
      {
        label: 'Status rows',
        render: () => (
          <View className="w-full">
            <Marker>
              <Marker.Icon>
                <SearchIcon size={14} />
              </Marker.Icon>
              <Marker.Content>Explored 4 files</Marker.Content>
            </Marker>
            <Marker>
              <Marker.Icon>
                <CheckIcon size={14} />
              </Marker.Icon>
              <Marker.Content>Applied 2 edits to invoice.ts</Marker.Content>
            </Marker>
            <Marker>
              <Marker.Icon>
                <ShieldCheckIcon size={14} />
              </Marker.Icon>
              <Marker.Content>Type check passed</Marker.Content>
            </Marker>
          </View>
        ),
      },
      {
        label: 'A step still running',
        render: () => (
          <View className="w-full">
            <Marker>
              <Marker.Icon>
                <CheckIcon size={14} />
              </Marker.Icon>
              <Marker.Content>Read 12 files</Marker.Content>
            </Marker>
            {/* Shimmer marks the row in flight — dropped once it finishes. */}
            <Marker>
              <Marker.Icon>
                <SearchIcon size={14} />
              </Marker.Icon>
              <Marker.Content shimmer>Searching the codebase…</Marker.Content>
            </Marker>
          </View>
        ),
      },
      {
        label: 'Variants',
        render: () => (
          <View className="w-full gap-2">
            <Marker>
              <Marker.Icon>
                <InfoIcon size={14} />
              </Marker.Icon>
              <Marker.Content>default — the plain status row</Marker.Content>
            </Marker>
            <Marker variant="border">
              <Marker.Icon>
                <InfoIcon size={14} />
              </Marker.Icon>
              <Marker.Content>border — closed by a hairline</Marker.Content>
            </Marker>
            <Marker variant="separator">
              <Marker.Content>Yesterday</Marker.Content>
            </Marker>
          </View>
        ),
      },
      {
        label: 'In a transcript',
        render: () => (
          <View className="w-full gap-3">
            <Marker variant="separator">
              <Marker.Content>Today</Marker.Content>
            </Marker>

            <Message align="end">
              <Message.Content>
                <Message.Bubble>
                  <Message.BubbleContent>
                    Where is the invoice total calculated?
                  </Message.BubbleContent>
                </Message.Bubble>
              </Message.Content>
            </Message>

            <Marker onPress={() => {}}>
              <Marker.Icon>
                <SearchIcon size={14} />
              </Marker.Icon>
              <Marker.Content>Searched 128 files</Marker.Content>
            </Marker>

            <Message>
              <Message.Avatar>
                <Avatar size="sm" fallback="AI" />
              </Message.Avatar>
              <Message.Content>
                <Message.Bubble>
                  <Message.BubbleContent>
                    In `billing/total.ts` — it sums the line items, then applies
                    tax.
                  </Message.BubbleContent>
                </Message.Bubble>
              </Message.Content>
            </Message>
          </View>
        ),
      },
    ],
  },
  {
    slug: 'menu',
    name: 'Menu',
    summary: 'The list of things you can do to something',
    demos: [
      {
        label: 'Putting something behind the panel',
        render: () => (
          <View className="w-full items-center py-4">
            <Menu>
              <Menu.Trigger>
                <Button variant="outline">Tinted panel</Button>
              </Menu.Trigger>
              <Menu.Content align="start" width={224}>
                {/* The surface is a layer, so it can be replaced. A BlurView or
                    a gradient goes in the same slot. */}
                <Menu.Background className="bg-overlay">
                  <View className="flex-1 bg-foreground/5" />
                </Menu.Background>
                <Menu.Item icon={<PencilIcon size={16} />}>Rename</Menu.Item>
                <Menu.Item icon={<ShareNodesIcon size={16} />}>Share</Menu.Item>
                <Menu.Separator />
                <Menu.Item variant="destructive" icon={<TrashIcon size={16} />}>
                  Delete
                </Menu.Item>
              </Menu.Content>
            </Menu>
          </View>
        ),
      },
      {
        label: 'A menu of actions',
        render: () => (
          <View className="w-full items-center py-4">
            <Menu>
              <Menu.Trigger>
                <Button variant="outline">Options</Button>
              </Menu.Trigger>
              {/* Rows dismiss the panel as they run, which is what separates a
                  menu of verbs from a picker of values. */}
              <Menu.Content align="start" width={224}>
                <Menu.Item icon={<ShareNodesIcon size={16} />} shortcut="⌘S">
                  Share
                </Menu.Item>
                <Menu.Item icon={<PlusSquareIcon size={16} />}>Add to list</Menu.Item>
                <Menu.Item icon={<DownloadIcon size={16} />} disabled>
                  Download
                </Menu.Item>
                <Menu.Separator />
                <Menu.Item variant="destructive" icon={<TrashIcon size={16} />}>
                  Delete
                </Menu.Item>
              </Menu.Content>
            </Menu>
          </View>
        ),
      },
      {
        label: 'Checkboxes and a radio group',
        render: () => <MenuViewOptionsDemo />,
      },
      {
        label: 'A submenu, and a row that explains itself',
        render: () => <MenuSubmenuDemo />,
      },
      {
        label: 'Labels, and rows that line up without an icon',
        render: () => (
          <View className="w-full items-center py-4">
            <Menu>
              <Menu.Trigger>
                <Button variant="ghost" size="icon" accessibilityLabel="More">
                  <EllipsisIcon size={18} />
                </Button>
              </Menu.Trigger>
              <Menu.Content align="end" width={232}>
                <Menu.Label inset>Account</Menu.Label>
                {/* `inset` reserves the icon column on a row that has no icon,
                    so its label starts where the others' labels do. */}
                <Menu.Item inset>Profile</Menu.Item>
                <Menu.Item inset shortcut="⌘,">
                  Settings
                </Menu.Item>
                <Menu.Separator />
                <Menu.Item icon={<LockIcon size={16} />}>Lock screen</Menu.Item>
              </Menu.Content>
            </Menu>
          </View>
        ),
      },
      {
        label: 'A long menu, scrolled',
        render: () => (
          <View className="w-full items-center py-4">
            <Menu>
              <Menu.Trigger>
                <Button variant="outline">Jump to section</Button>
              </Menu.Trigger>
              {/* Capped at the room inside the safe area and scrolled, so the
                  last row is reachable however many there turn out to be. */}
              <Menu.Content align="start" width={230} maxHeight={260}>
                {Array.from({ length: 14 }, (_, index) => (
                  <Menu.Item key={index} inset>
                    {`Section ${index + 1}`}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu>
          </View>
        ),
      },
      {
        label: 'As a bottom sheet',
        render: () => (
          <View className="w-full items-center py-4">
            {/* The same rows, moved into a sheet — better on a small screen
                than a panel floating over the thing being acted on. */}
            <Menu presentation="bottom-sheet">
              <Menu.Trigger>
                <Button variant="outline">Open as a sheet</Button>
              </Menu.Trigger>
              <Menu.Content>
                <Menu.Item icon={<ShareNodesIcon size={16} />}>Share</Menu.Item>
                <Menu.Item icon={<BookmarkIcon size={16} />}>Save for later</Menu.Item>
                <Menu.Separator />
                <Menu.Item variant="destructive" icon={<TrashIcon size={16} />}>
                  Delete
                </Menu.Item>
              </Menu.Content>
            </Menu>
          </View>
        ),
      },
    ],
  },
  {
    slug: 'message-scroller',
    name: 'MessageScroller',
    summary: 'Scroll behaviour a chat transcript needs',
    demos: [
      {
        label: 'Following a streamed reply',
        id: 'streaming',
        fullPage: true,
        description:
          'Pins to the bottom while a reply streams — but only while you are already there. Scroll up mid-stream and it stops chasing.',
        render: () => <StreamingTranscriptDemo />,
      },
      {
        label: 'Loading history',
        id: 'history',
        fullPage: true,
        description:
          'Older turns are added above you. The message you are reading does not move.',
        render: () => <HistoryTranscriptDemo />,
      },
      {
        label: 'Opening a saved thread',
        id: 'saved',
        fullPage: true,
        description:
          'Opens on the last turn that started something, rather than at the bottom of the reply to it.',
        render: () => <SavedThreadDemo />,
      },
    ],
  },
  {
    slug: 'message',
    name: 'Message',
    summary: 'Chat turn with avatar, bubble and metadata',
    demos: [
      {
        label: 'Both sides',
        render: () => (
          <View className="w-full gap-3">
            <Message>
              <Message.Avatar>
                <Avatar size="sm" source={{ uri: AVATARS[1] }} fallback="OL" />
              </Message.Avatar>
              <Message.Content>
                <Message.Bubble>
                  <Message.BubbleContent>
                    How can I help you today?
                  </Message.BubbleContent>
                </Message.Bubble>
              </Message.Content>
            </Message>

            <Message align="end">
              <Message.Content>
                <Message.Bubble>
                  <Message.BubbleContent>
                    Set a reminder for 9am tomorrow.
                  </Message.BubbleContent>
                </Message.Bubble>
                <Message.Footer>Read</Message.Footer>
              </Message.Content>
            </Message>
          </View>
        ),
      },
      {
        label: 'Header and footer',
        render: () => (
          <View className="w-full gap-3">
            <Message>
              <Message.Avatar>
                <Avatar size="sm" source={{ uri: AVATARS[2] }} fallback="OL" />
              </Message.Avatar>
              <Message.Content>
                <Message.Header>Olivia</Message.Header>
                <Message.Bubble>
                  <Message.BubbleContent>
                    I pushed the fix — can you take another look?
                  </Message.BubbleContent>
                </Message.Bubble>
                <Message.Footer>Yesterday at 18:04</Message.Footer>
              </Message.Content>
            </Message>
          </View>
        ),
      },
      {
        label: 'Grouped turns',
        render: () => (
          // Only the first message keeps its avatar; the rest reserve the slot
          // so the bubbles stay in one column.
          <Message.Group align="start" className="w-full">
            {[
              'Looking that up…',
              'Found three matching invoices.',
              'Want me to export them?',
            ].map((body) => (
              <Message key={body}>
                <Message.Avatar>
                  <Avatar size="sm" fallback="AI" />
                </Message.Avatar>
                <Message.Content>
                  <Message.Bubble>
                    <Message.BubbleContent>{body}</Message.BubbleContent>
                  </Message.Bubble>
                </Message.Content>
              </Message>
            ))}
          </Message.Group>
        ),
      },
      {
        label: 'Streaming and actions',
        render: () => (
          <View className="w-full gap-3">
            <Message>
              <Message.Avatar>
                <Avatar size="sm" fallback="AI" />
              </Message.Avatar>
              <Message.Content>
                <Message.Bubble>
                  <Shimmer textClassName="text-base">Thinking…</Shimmer>
                </Message.Bubble>
              </Message.Content>
            </Message>

            <Message>
              <Message.Avatar>
                <Avatar size="sm" fallback="AI" />
              </Message.Avatar>
              <Message.Content>
                <Message.Bubble>
                  <Message.BubbleContent>
                    Your reminder is set for 9:00 tomorrow.
                  </Message.BubbleContent>
                </Message.Bubble>
                <Message.Actions>
                  <Button size="sm" variant="ghost">
                    Copy
                  </Button>
                  <Button size="sm" variant="ghost">
                    Retry
                  </Button>
                </Message.Actions>
              </Message.Content>
            </Message>
          </View>
        ),
      },
      { label: 'Long-press for actions', render: () => <MessageLongPressDemo /> },
    ],
  },
  {
    slug: 'popover',
    name: 'Popover',
    summary: 'Panel anchored to the thing that opened it',
    layout: 'sections',
    demos: [
      {
        // A column of actions belongs in Menu now — what this shows instead is
        // the cap, which is the thing a hand-built panel gets wrong.
        label: 'A long panel, scrolled',
        render: () => (
          <View className="w-full items-center py-4">
            <Popover>
              <Popover.Trigger>
                <Button variant="outline">Release notes</Button>
              </Popover.Trigger>
              {/* Capped below the safe area and scrolled, so the last line is
                  reachable however many there are. */}
              <Popover.Content scrollable maxHeight={260} align="start" className="w-72">
                <Popover.Title>What changed</Popover.Title>
                {Array.from({ length: 8 }, (_, index) => (
                  <Popover.Description key={index}>
                    {`Release note ${index + 1} — a line of detail long enough to
                      take a couple of rows on a phone.`}
                  </Popover.Description>
                ))}
              </Popover.Content>
            </Popover>
          </View>
        ),
      },
      {
        label: 'Placement',
        render: () => (
          // Each trigger is pinned to the side that leaves room for the panel
          // to open the way its label says — so left and right are actually
          // distinct rather than both flipping inward.
          <View className="h-72 w-full justify-between py-4">
            <View className="flex-row justify-center">
              <PlacementPopover placement="bottom" />
            </View>
            <View className="flex-row items-center justify-between">
              <PlacementPopover placement="right" />
              <PlacementPopover placement="left" />
            </View>
            <View className="flex-row justify-center">
              <PlacementPopover placement="top" />
            </View>
          </View>
        ),
      },
      {
        label: 'With an arrow',
        render: () => (
          <View className="w-full items-center py-4">
            <Popover>
              <Popover.Trigger>
                <Button variant="ghost" size="icon" accessibilityLabel="What is this?">
                  <InfoIcon size={18} />
                </Button>
              </Popover.Trigger>
              {/* Default bottom placement: the arrow sits centred on the
                  panel's top edge, pointing up at the trigger. */}
              <Popover.Content className="w-60">
                <Popover.Arrow />
                <Popover.Title>Monthly active users</Popover.Title>
                <Popover.Description>
                  Anyone who opened the app at least once in the last 30 days.
                </Popover.Description>
              </Popover.Content>
            </Popover>
          </View>
        ),
      },
      {
        label: 'A form, matching the trigger width',
        render: () => <PopoverFormDemo />,
      },
      {
        label: 'Blurred background',
        render: () => (
          <View className="w-full items-center py-4">
            <Popover>
              <Popover.Trigger>
                <Button variant="outline">Frost the screen</Button>
              </Popover.Trigger>
              {/* `blur` frosts what is behind, falling back to a dim when
                  expo-blur is not installed. */}
              <Popover.Content blur align="start" className="w-64">
                <Popover.Arrow />
                <Popover.Title>Focus here</Popover.Title>
                <Popover.Description>
                  The list behind is blurred so this panel reads as the only
                  thing to deal with.
                </Popover.Description>
              </Popover.Content>
            </Popover>
          </View>
        ),
      },
      {
        label: 'As a bottom sheet',
        render: () => (
          <View className="w-full items-center py-4">
            {/* Same API, presented as a draggable sheet — better for a form on
                a small screen than a panel floating over the trigger. */}
            <Popover presentation="bottom-sheet">
              <Popover.Trigger>
                <Button variant="outline">Open as a sheet</Button>
              </Popover.Trigger>
              <Popover.Content>
                <Popover.Title>Sort by</Popover.Title>
                <Popover.Description className="mb-2">
                  The same content, presented from the bottom.
                </Popover.Description>
                {['Newest', 'Oldest', 'Most active'].map((option) => (
                  <Popover.Close key={option}>
                    <Pressable
                      accessibilityRole="menuitem"
                      onPress={() => {}}
                      className="rounded-xl px-3 py-3 active:bg-accent"
                    >
                      <Text>{option}</Text>
                    </Pressable>
                  </Popover.Close>
                ))}
              </Popover.Content>
            </Popover>
          </View>
        ),
      },
    ],
  },
  {
    slug: 'progress',
    name: 'Progress',
    summary: 'Determinate and indeterminate progress bar',
    demos: [
      { label: 'Animated', render: () => <ProgressDemo /> },
      {
        label: 'Labelled',
        render: () => (
          <View className="w-full gap-4">
            <Progress value={64} label="Downloading" showValueLabel />
            <Progress
              value={40}
              color="success"
              label="Storage"
              showValueLabel
              formatOptions={{ style: 'currency', currency: 'USD' }}
              valueLabel="8.2 GB of 20 GB"
            />
            <Progress value={90} color="warning" showValueLabel />
          </View>
        ),
      },
      {
        // The bars below count money and seats, not percentages — nothing is
        // converted on the way in, and the readout says what was counted.
        label: 'A range of its own',
        render: () => (
          <View className="w-full gap-4">
            <Progress
              value={1250}
              maxValue={2000}
              label="Budget"
              formatOptions={{ style: 'currency', currency: 'USD' }}
              showValueLabel
            />
            <Progress
              value={18}
              maxValue={24}
              color="info"
              label="Seats"
              valueLabel="18 of 24"
              showValueLabel
            />
            <Progress value={72} minValue={40} maxValue={80} color="success" showValueLabel />
          </View>
        ),
      },
      {
        label: 'Colors',
        render: () => (
          <View className="w-full gap-4">
            <Progress value={35} />
            <Progress value={55} color="success" />
            <Progress value={75} color="warning" />
            <Progress value={90} color="destructive" />
          </View>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-4">
            <Progress value={60} size="sm" />
            <Progress value={60} />
            <Progress value={60} size="lg" />
          </View>
        ),
      },
    ],
  },
  {
    slug: 'radio-group',
    name: 'RadioGroup',
    summary: 'Single-select list of options',
    demos: [
      { label: 'Plans', render: () => <RadioGroupDemo /> },
      { label: 'Horizontal', render: () => <RadioGroupRowDemo /> },
      { label: 'Cards', render: () => <RadioGroupCardDemo /> },
      {
        label: 'In a card',
        render: () => (
          <Card className="w-full">
            <Card.Header>
              <Card.Title>Delivery speed</Card.Title>
              <Card.Description>Choose how fast you need it.</Card.Description>
            </Card.Header>
            <Card.Content>
              <RadioGroupDemo />
            </Card.Content>
          </Card>
        ),
      },
    ],
  },
  {
    slug: 'rating',
    name: 'Rating',
    summary: 'A row of stars to read or set a score',
    demos: [
      { label: 'Interactive', render: () => <RatingDemo /> },
      { label: 'Haptics', render: () => <RatingHapticsDemo /> },
      {
        label: 'Half stars',
        render: () => (
          <View className="w-full gap-5">
            <Rating precision={0.5} defaultValue={3.5} />
            <Rating precision={0.5} defaultValue={2.5} color="primary" />
          </View>
        ),
      },
      {
        label: 'Colors',
        render: () => (
          <View className="w-full gap-4">
            <Rating defaultValue={4} color="warning" />
            <Rating defaultValue={4} color="success" />
            <Rating defaultValue={4} color="destructive" />
            <Rating defaultValue={4} color="info" />
            <Rating defaultValue={4} color="foreground" />
          </View>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-4">
            <Rating defaultValue={3} size="sm" />
            <Rating defaultValue={3} size="md" />
            <Rating defaultValue={3} size="lg" />
          </View>
        ),
      },
      {
        label: 'Read-only & disabled',
        render: () => (
          <View className="w-full gap-4">
            <Rating value={4.3} precision={0.5} readOnly />
            <Rating max={10} defaultValue={7} size="sm" />
            <Rating defaultValue={3} disabled />
          </View>
        ),
      },
    ],
  },
  {
    slug: 'section-rail',
    name: 'SectionRail',
    summary: 'Floating section navigator for a long screen',
    demos: [
      {
        label: 'Bottom right',
        id: 'bottom-right',
        fullPage: true,
        description:
          'Out of the corner, clear of the text, with the panel opening upward. Haptics on.',
        render: () => <SectionRailVersion align="bottom" haptics />,
      },
      {
        label: 'Bottom left',
        id: 'bottom-left',
        fullPage: true,
        description: 'The same corner treatment against the other edge.',
        render: () => <SectionRailVersion placement="left" align="bottom" haptics />,
      },
      {
        label: 'Pager',
        id: 'pager',
        fullPage: true,
        description:
          'One section per screen. Swipe up and the rail in the bottom-left tracks the page.',
        render: () => <SectionRailPagerVersion />,
      },
      {
        label: 'Centred on the edge',
        id: 'side',
        fullPage: true,
        description:
          'The original placement — halfway down the right edge, over the content it indexes.',
        render: () => <SectionRailVersion />,
      },
    ],
  },
  {
    slug: 'select',
    name: 'Select',
    summary: 'Picker shown in a sheet, in place, or floating over the page',
    demos: [
      { label: 'Sheet (default)', render: () => <SelectDemo /> },
      {
        label: 'Inline — the row grows',
        render: () => (
          <View className="w-full gap-4">
            <RegionSelectDemo presentation="inline" />
            <Text size="sm" muted>
              The list expands in layout flow, so this paragraph is pushed down
              by its height. Right inside a settings list, where that reads as
              the row growing.
            </Text>
          </View>
        ),
      },
      {
        label: 'Overlay — nothing below moves',
        render: () => (
          <View className="w-full gap-4">
            <RegionSelectDemo presentation="overlay" />
            <Text size="sm" muted>
              This paragraph stays exactly where it is when the list above
              opens. With `inline` it would be pushed down by the height of the
              list.
            </Text>
            <Button variant="outline" fullWidth>
              And so does this button
            </Button>
          </View>
        ),
      },
      {
        label: 'Overlay width',
        render: () => (
          <View className="w-full gap-4">
            <RegionSelectDemo presentation="overlay" contentWidth="content" />
            <RegionSelectDemo presentation="overlay" contentWidth={220} />
          </View>
        ),
      },
      {
        label: 'In a form',
        render: () => (
          <Card className="w-full">
            <Card.Content className="gap-4 p-4">
              <Input label="Full name" placeholder="Khalid Abdi" />
              <SelectDemo />
              <RegionSelectDemo presentation="overlay" />
            </Card.Content>
          </Card>
        ),
      },
      {
        label: 'Searchable',
        render: () => (
          <View className="w-full gap-4">
            <SearchableSelectDemo />
            <Text size="sm" muted>
              Twenty cities. The filter matches any part of a label, so “lo”
              finds both London and Los Angeles.
            </Text>
          </View>
        ),
      },
      {
        label: 'Searchable — overlay',
        render: () => <SearchableSelectDemo presentation="overlay" />,
      },
      {
        label: 'Grouped options',
        render: () => (
          <View className="w-full gap-4">
            <GroupedSelectDemo />
            <Text size="sm" muted>
              Filter for “lo” and Asia disappears with its heading — a heading
              over no options reads as a section that failed to load.
            </Text>
          </View>
        ),
      },
      { label: 'Disabled option', render: () => <DisabledOptionSelectDemo /> },
      { label: 'Native — menu', render: () => <NativeSelectDemo /> },
      { label: 'Native — wheel', render: () => <NativeWheelPickerDemo /> },
    ],
  },
  {
    slug: 'surface',
    name: 'Surface',
    summary: 'Elevated container with a variant ladder',
    demos: [
      {
        label: 'Nested hierarchy',
        render: () => (
          <Surface className="w-full">
            <Text weight="medium">Account</Text>
            <Surface variant="secondary" className="mt-3">
              <Text size="sm" muted>
                Signed in as khalid@example.com
              </Text>
              <Surface variant="tertiary" className="mt-3">
                <Text size="xs" muted>
                  Session expires in 12 days
                </Text>
              </Surface>
            </Surface>
          </Surface>
        ),
      },
      {
        label: 'Variants',
        render: () => (
          <View className="w-full gap-3">
            {(['default', 'secondary', 'tertiary', 'transparent'] as const).map(
              (variant) => (
                <Surface key={variant} variant={variant}>
                  <Text size="sm">{variant}</Text>
                </Surface>
              )
            )}
          </View>
        ),
      },
      {
        label: 'Bordered and elevated',
        render: () => (
          <View className="w-full gap-3">
            {/* A hairline for a surface the same colour as the page. */}
            <Surface bordered>
              <Text size="sm">bordered — reads against a same-colour page</Text>
            </Surface>
            {/* A soft shadow lifts it off the page. */}
            <Surface elevated>
              <Text size="sm">elevated — a soft shadow</Text>
            </Surface>
            <Surface bordered elevated>
              <Text size="sm">both</Text>
            </Surface>
          </View>
        ),
      },
      {
        label: 'Padding scale',
        render: () => (
          <View className="w-full gap-3">
            {(['none', 'sm', 'default', 'lg'] as const).map((padding) => (
              <Surface key={padding} variant="secondary" padding={padding} bordered>
                <View className="rounded-lg bg-primary/10 px-2 py-1">
                  <Text size="xs" muted>
                    padding={padding}
                  </Text>
                </View>
              </Surface>
            ))}
          </View>
        ),
      },
      {
        label: 'As a stat card',
        render: () => (
          <View className="w-full flex-row gap-3">
            {[
              { label: 'Revenue', value: '$24.8k' },
              { label: 'Active', value: '1,204' },
            ].map((stat) => (
              <Surface key={stat.label} bordered padding="lg" className="flex-1">
                <Text size="xs" muted className="uppercase tracking-wider">
                  {stat.label}
                </Text>
                <Text size="xl" weight="semibold" className="mt-1">
                  {stat.value}
                </Text>
              </Surface>
            ))}
          </View>
        ),
      },
    ],
  },
  {
    slug: 'shimmer',
    name: 'Shimmer',
    summary: 'Animated highlight sweeping across content',
    demos: [
      {
        label: 'Thinking text',
        render: () => (
          <View className="w-full gap-4">
            <Shimmer>Generating response…</Shimmer>
            <Shimmer duration={1400} textClassName="text-lg font-medium">
              Thinking…
            </Shimmer>
            <Shimmer duration={2400} textClassName="text-2xl font-semibold">
              Searching the web
            </Shimmer>
          </View>
        ),
      },
      {
        label: 'Modes',
        render: () => (
          <View className="w-full gap-4">
            <Shimmer mode="ping-pong" duration={1600}>
              Ping-pong sweep
            </Shimmer>
            <Shimmer reverse>Right to left</Shimmer>
            <Shimmer spread={4} duration={2600}>
              A wider, slower band
            </Shimmer>
            <Shimmer enabled={false}>Disabled — renders statically</Shimmer>
          </View>
        ),
      },
      {
        label: 'Custom colours',
        render: () => (
          <View className="w-full gap-4">
            <Shimmer baseColor="#3f3f46" shimmerColor="#fafafa">
              Neutral on dark
            </Shimmer>
            <Shimmer
              baseColor="#1e3a8a"
              shimmerColor="#93c5fd"
              textClassName="text-lg font-semibold"
            >
              Tinted blue
            </Shimmer>
          </View>
        ),
      },
      {
        label: 'Masking a subtree',
        render: () => (
          <Shimmer as="view" className="w-full rounded-xl">
            <View className="gap-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </View>
          </Shimmer>
        ),
      },
    ],
  },
  {
    slug: 'text-animation',
    name: 'TextAnimation',
    summary: 'Five ways a piece of text or a number arrives',
    demos: [
      { label: 'Typing', render: () => <TypingDemo /> },
      { label: 'Typing a cycle', render: () => <TypingCycleDemo /> },
      { label: 'Rotating', render: () => <RotatingDemo /> },
      { label: 'Counting', render: () => <CountingDemo /> },
      { label: 'Sliding', render: () => <SlidingDemo /> },
      { label: 'Sliding a price', render: () => <SlidingPriceDemo /> },
      { label: 'Scrolling', render: () => <ScrollingDemo /> },
      { label: 'Shared configuration', render: () => <TextAnimationGroupDemo /> },
    ],
  },
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
  },
  {
    slug: 'scatter-chart',
    name: 'ScatterChart',
    summary: 'Two quantities against each other, to show how they relate',
    // One chart per version, none bringing a scroller of its own, so the
    // versions can be the pages and the rail can index them.
    layout: 'pager',
    demos: [
      {
        label: 'Basic',
        id: 'basic',
        fullPage: true,
        description: 'One series on two measured axes. Touch a point for both its values.',
        render: () => <ScatterBasicVersion />,
      },
      {
        label: 'Bubbles',
        id: 'bubbles',
        fullPage: true,
        description: "A third quantity on each point's area, via sizeKey.",
        render: () => <ScatterBubblesVersion />,
      },
      {
        label: 'Two series',
        id: 'two-series',
        fullPage: true,
        description: 'Two clouds sharing both domains, so they stay comparable.',
        render: () => <ScatterTwoSeriesVersion />,
      },
      {
        label: 'Loading',
        id: 'loading',
        fullPage: true,
        description: 'A still field of muted dots that gives way to the data.',
        render: () => <ScatterLoadingVersion />,
      },
    ],
  },
  {
    slug: 'scroll-canvas',
    name: 'ScrollCanvas',
    summary: 'Image frame whose contents move as you scroll',
    demos: [
      {
        label: 'Parallax',
        id: 'parallax',
        fullPage: true,
        description: 'The image drifts against the scroll inside a frame that stays put.',
        render: () => <ScrollCanvasVersion effect="parallax" />,
      },
      {
        label: 'Zoom',
        id: 'zoom',
        fullPage: true,
        description: 'It settles from slightly oversized to its natural size.',
        render: () => <ScrollCanvasVersion effect="zoom" />,
      },
      {
        label: 'Reveal',
        id: 'reveal',
        fullPage: true,
        description: 'A wipe uncovers it from the bottom edge up.',
        render: () => <ScrollCanvasVersion effect="reveal" />,
      },
      {
        label: 'Sequence',
        id: 'sequence',
        fullPage: true,
        description: 'The scroll position picks a frame, so the thumb scrubs the animation.',
        render: () => <ScrollCanvasSequenceVersion />,
      },
    ],
  },
  {
    slug: 'thinking-orb',
    name: 'ThinkingOrb',
    summary: 'Dotted orb saying which kind of busy an agent is',
    demos: [
      {
        label: 'The six states',
        id: 'states',
        fullPage: true,
        description: 'Each one side by side, at the large tuning.',
        render: () => <ThinkingOrbStatesVersion />,
      },
      {
        label: 'Inline in a reply',
        id: 'inline',
        fullPage: true,
        description: 'The small tuning, sitting in a line of chat text.',
        render: () => <ThinkingOrbInlineVersion />,
      },
      {
        label: 'Speed and pause',
        id: 'controls',
        fullPage: true,
        description: 'What `speed` and `paused` do to a running orb.',
        render: () => <ThinkingOrbControlsVersion />,
      },
    ],
  },
  {
    slug: 'reasoning',
    name: 'Reasoning',
    summary: "The model's working, shown while it happens",
    demos: [
      { label: 'A live trace', render: () => <ReasoningStreamDemo /> },
      { label: 'In a turn', render: () => <ReasoningInTurnDemo /> },
      {
        label: 'Words of your own',
        render: () => (
          <Reasoning defaultOpen duration={9}>
            <Reasoning.Trigger
              label={(streaming, duration) =>
                streaming ? (
                  <Shimmer>Working through it…</Shimmer>
                ) : (
                  <Text size="sm" muted>
                    Reasoned for {duration}s
                  </Text>
                )
              }
            />
            <Reasoning.Content>{REASONING_TRACE}</Reasoning.Content>
          </Reasoning>
        ),
      },
      {
        label: 'The whole turn',
        id: 'transcript',
        fullPage: true,
        description:
          'A plan, its steps, the reasoning, the answer, its code and its sources.',
        render: () => <AgentTranscriptDemo />,
      },
    ],
  },
  {
    slug: 'sources',
    name: 'Sources',
    summary: 'Where an answer came from, folded under a count',
    demos: [
      { label: 'Under a turn', render: () => <SourcesInTurnDemo /> },
      {
        label: 'On its own',
        render: () => (
          <Sources defaultOpen>
            <Sources.Trigger count={AI_SOURCES.length} />
            <Sources.Content>
              {AI_SOURCES.map((source) => (
                <Sources.Source key={source.url} href={source.url} title={source.title} />
              ))}
            </Sources.Content>
          </Sources>
        ),
      },
    ],
  },
  {
    slug: 'task',
    name: 'Task',
    summary: 'One step an agent took, and what it did there',
    demos: [
      { label: 'A run of steps', render: () => <TaskRunDemo /> },
      {
        label: 'One step',
        render: () => (
          <Task status="complete">
            <Task.Trigger title="Read 2 files" />
            <Task.Content>
              <Task.Item>
                Opened <Task.File icon={<FileIcon size={12} />}>theme.css</Task.File>
              </Task.Item>
              <Task.Item>Found 9 syntax tokens to add.</Task.Item>
            </Task.Content>
          </Task>
        ),
      },
    ],
  },
  {
    slug: 'code-block',
    name: 'CodeBlock',
    summary: 'A fenced snippet, coloured and scrolled sideways',
    demos: [
      { label: 'In a turn', render: () => <CodeBlockInTurnDemo /> },
      {
        label: 'Numbered lines',
        render: () => (
          <CodeBlock showLineNumbers code={AI_SNIPPET} language="ts">
            <CodeBlock.Header>
              <CodeBlock.Filename>calendar/index.tsx</CodeBlock.Filename>
              <CodeBlock.Actions>
                <CodeBlock.CopyButton />
              </CodeBlock.Actions>
            </CodeBlock.Header>
          </CodeBlock>
        ),
      },
      {
        label: 'Languages',
        render: () => (
          <View className="w-full gap-4">
            <CodeBlock
              code={'{\n  "addedIn": "0.30.0",\n  "group": "ai-components"\n}'}
              language="json"
            />
            <CodeBlock code={'npx expo install expo-clipboard'} language="bash" />
            <CodeBlock code={AI_PATCH} language="diff" />
          </View>
        ),
      },
    ],
  },
  {
    slug: 'response',
    name: 'Response',
    summary: "A model's answer, rendered as it arrives",
    demos: [
      // The short ones page under the rail. The two long ones are listed above
      // them and open on a screen of their own — a whole answer cropped to a
      // snapped page hides the table and the fence at the bottom of it.
      { label: 'Inside a turn', render: () => <ResponseInTurnDemo /> },
      { label: 'Marks and links', render: () => <ResponseMarksDemo /> },
      { label: 'A table', render: () => <ResponseTableDemo /> },
      {
        label: 'A full answer',
        id: 'answer',
        description: 'Headings, a list, a quote, a fence and a table — the whole surface.',
        fullPage: true,
        render: () => <ResponseDemo />,
      },
      {
        label: 'Streaming in',
        id: 'streaming',
        description: 'The same answer arriving a few characters at a time, without the styles flickering.',
        fullPage: true,
        render: () => <ResponseStreamDemo />,
      },
    ],
  },
  {
    slug: 'post',
    name: 'Post',
    summary: 'A card carrying something somebody said, and what everyone did about it',
    demos: [
      { label: 'Feed card', render: () => <FeedPostDemo /> },
      { label: 'Vote post', render: () => <VotePostDemo /> },
      { label: 'Compact', render: () => <CompactPostDemo /> },
      { label: 'Media first', render: () => <MediaPostDemo /> },
      {
        label: 'A feed',
        id: 'feed',
        description: 'All four in a scroll, which is where a card is really judged.',
        fullPage: true,
        render: () => <PostFeedDemo />,
      },
    ],
  },
  {
    slug: 'plan',
    name: 'Plan',
    summary: 'What an agent intends to do, before it does it',
    demos: [
      { label: 'A rail of steps', render: () => <PlanRailDemo /> },
      { label: 'Streaming in', render: () => <PlanStreamDemo /> },
      { label: 'Steps that are tasks', render: () => <PlanWithTasksDemo /> },
    ],
  },
  {
    slug: 'soundwave',
    name: 'Soundwave',
    summary: 'What a voice looks like while an app listens',
    demos: [
      {
        label: 'Capsules',
        id: 'pills',
        fullPage: true,
        description: 'The few big capsules over a microphone button.',
        render: () => <SoundwavePillsVersion />,
      },
      {
        label: 'Metering bars',
        id: 'bars',
        fullPage: true,
        description: 'Static bands and a scrolling history, in a transcript.',
        render: () => <SoundwaveBarsVersion />,
      },
      {
        label: 'Travelling wave',
        id: 'line',
        fullPage: true,
        description: 'One ribbon, and what each state does to it.',
        render: () => <SoundwaveLineVersion />,
      },
      {
        label: 'Ambient glow',
        id: 'ambient',
        fullPage: true,
        fullBleed: true,
        description: 'A bloom off the bottom edge and a rim around the screen.',
        render: () => <SoundwaveAmbientVersion />,
      },
      {
        label: 'Colour',
        render: () => (
          <View className="w-full gap-5">
            <View className="gap-2">
              <Text size="sm" muted>
                a theme token, so it follows the theme into dark mode
              </Text>
              <Soundwave variant="bars" color="--color-info" height={48} />
            </View>
            <View className="gap-2">
              <Text size="sm" muted>
                a colour of your own
              </Text>
              <Soundwave variant="bars" color="#f97316" height={48} />
            </View>
            <View className="gap-2">
              <Text size="sm" muted>
                a gradient across the wave
              </Text>
              <Soundwave
                variant="line"
                gradient={['#6366f1', '#ec4899', '#f59e0b']}
                height={64}
              />
            </View>
            <View className="gap-2">
              <Text size="sm" muted>
                a track colour, for the part not played yet
              </Text>
              <Soundwave
                variant="bars"
                levels={seedWaveform(5)}
                progress={0.45}
                color="--color-success"
                trackColor="--color-muted"
                height={48}
              />
            </View>
          </View>
        ),
      },
      {
        label: 'Voice notes',
        id: 'notes',
        fullPage: true,
        description: 'Recorded waveforms in bubbles, filling as they play.',
        render: () => <SoundwaveNotesVersion />,
      },
      {
        label: 'Recording composer',
        id: 'composer',
        fullPage: true,
        description: 'A composer that turns into a recorder over a transcript.',
        render: () => <SoundwaveComposerVersion />,
      },
    ],
  },
  {
    slug: 'scroll-fade',
    name: 'ScrollFade',
    summary: 'Fades the edges of a scroll container',
    layout: 'sections',
    demos: [
      {
        label: 'Horizontal cards',
        render: () => (
          // A horizontal group of vertical Items: each entry is a card, and
          // the fade shows there is more of them past the edge.
          <ScrollFade size={40} className="w-full">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Item.Group orientation="horizontal">
                {[
                  ['Overlays', 'Dialog, sheet, toast'],
                  ['Forms', 'Input, select, switch'],
                  ['Feedback', 'Alert, progress, spinner'],
                  ['Layout', 'Card, frame, surface'],
                  ['Motion', 'Shimmer, scroll fade'],
                  ['Theming', 'Six themes, three families'],
                ].map(([title, description]) => (
                  <Item
                    key={title}
                    orientation="vertical"
                    variant="outline"
                    size="sm"
                    className="w-44"
                  >
                    <Item.Media variant="icon">
                      <PackageIcon size={16} />
                    </Item.Media>
                    <Item.Content>
                      <Item.Title>{title}</Item.Title>
                      <Item.Description>{description}</Item.Description>
                    </Item.Content>
                  </Item>
                ))}
              </Item.Group>
            </ScrollView>
          </ScrollFade>
        ),
      },
      {
        label: 'Vertical list',
        render: () => (
          // Orientation is read from the child: no `horizontal` prop, so the
          // fades land on the top and bottom edges instead.
          <ScrollFade size={44} className="h-72 w-full">
            <ScrollView showsVerticalScrollIndicator={false}>
              <Item.Group>
                {[
                  ['Deployed to production', '2 minutes ago'],
                  ['Migration applied', '18 minutes ago'],
                  ['Build passed', '24 minutes ago'],
                  ['Pull request merged', '1 hour ago'],
                  ['Review requested', '2 hours ago'],
                  ['Branch pushed', '3 hours ago'],
                  ['Issue closed', '5 hours ago'],
                  ['Release tagged', 'Yesterday'],
                ].map(([title, when], index) => (
                  <View key={title}>
                    {index > 0 ? <Item.Separator /> : null}
                    <Item size="sm">
                      <Item.Media variant="icon">
                        <CheckIcon size={14} />
                      </Item.Media>
                      <Item.Content>
                        <Item.Title>{title}</Item.Title>
                        <Item.Description>{when}</Item.Description>
                      </Item.Content>
                    </Item>
                  </View>
                ))}
              </Item.Group>
            </ScrollView>
          </ScrollFade>
        ),
      },
      {
        label: 'One edge',
        render: () => (
          <ScrollFade size={56} edges="end" className="w-full">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Item.Group orientation="horizontal">
                {['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'].map((n) => (
                  <Item key={n} variant="muted" size="sm" className="w-32">
                    <Item.Content>
                      <Item.Title>{n}</Item.Title>
                    </Item.Content>
                  </Item>
                ))}
              </Item.Group>
            </ScrollView>
          </ScrollFade>
        ),
      },
      {
        label: 'Content that fits',
        render: () => (
          // Nothing scrolls past either edge, so neither fade ever shows.
          <ScrollFade size={40} className="w-full">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Item.Group orientation="horizontal">
                {['One', 'Two'].map((n) => (
                  <Item key={n} variant="outline" size="sm" className="w-32">
                    <Item.Content>
                      <Item.Title>{n}</Item.Title>
                    </Item.Content>
                  </Item>
                ))}
              </Item.Group>
            </ScrollView>
          </ScrollFade>
        ),
      },
      {
        label: 'Tuning the ramp',
        render: () => (
          <View className="w-full gap-4">
            {/* A long ramp fades in gradually over the first 120px of travel. */}
            <ScrollFade size={48} fadeInDistance={120} className="w-full">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2"
              >
                {['Slow', 'Ramp', 'Over', 'A', 'Long', 'Distance', 'Of', 'Travel'].map(
                  (n) => (
                    <Badge key={n} variant="secondary">
                      {n}
                    </Badge>
                  )
                )}
              </ScrollView>
            </ScrollFade>

            {/* Snaps to full opacity almost immediately. */}
            <ScrollFade size={48} fadeInDistance={4} className="w-full">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2"
              >
                {['Instant', 'Ramp', 'On', 'The', 'First', 'Few', 'Pixels'].map((n) => (
                  <Badge key={n}>{n}</Badge>
                ))}
              </ScrollView>
            </ScrollFade>
          </View>
        ),
      },
    ],
  },
  {
    slug: 'separator',
    name: 'Separator',
    summary: 'Horizontal or vertical rule between content',
    demos: [
      {
        label: 'Between sections',
        render: () => (
          <Surface variant="secondary" className="w-full px-6 py-7">
            <Text weight="medium">PanelUI</Text>
            <Text size="sm" muted>
              A React Native component library.
            </Text>
            <Separator className="my-4" />
            <View className="h-5 flex-row items-center">
              <Text size="sm">Components</Text>
              <Separator orientation="vertical" className="mx-3" />
              <Text size="sm">Themes</Text>
              <Separator orientation="vertical" className="mx-3" />
              <Text size="sm">Examples</Text>
            </View>
          </Surface>
        ),
      },
      {
        label: 'Labelled',
        render: () => (
          // Children break the rule around a centred label — the "or" divider
          // in a sign-in form. Only the horizontal axis carries a label.
          <View className="w-full gap-4">
            <Button variant="outline" fullWidth>
              Continue with email
            </Button>
            <Separator>or</Separator>
            <Button variant="outline" fullWidth>
              Continue as guest
            </Button>
          </View>
        ),
      },
      {
        label: 'Variants',
        render: () => (
          <View className="w-full gap-5">
            <View className="gap-2">
              <Text size="sm" muted>
                thin
              </Text>
              <Separator />
            </View>
            <View className="gap-2">
              <Text size="sm" muted>
                thick
              </Text>
              <Separator variant="thick" />
            </View>
          </View>
        ),
      },
      {
        label: 'Custom thickness',
        render: () => (
          <View className="w-full gap-5">
            {[1, 3, 6].map((thickness) => (
              <View key={thickness} className="gap-2">
                <Text size="sm" muted>
                  thickness={thickness}
                </Text>
                <Separator thickness={thickness} />
              </View>
            ))}
          </View>
        ),
      },
      {
        label: 'Vertical, stretched by the row',
        render: () => (
          // `items-stretch` gives the separators their length — a vertical
          // separator with no height from the parent measures zero.
          <View className="w-full flex-row items-stretch gap-4 py-2">
            {['Today', 'Week', 'Month'].map((label, index) => (
              <View key={label} className="flex-1 flex-row items-stretch gap-4">
                {index > 0 ? <Separator orientation="vertical" /> : null}
                <View className="flex-1 gap-1">
                  <Text size="xs" muted className="uppercase tracking-wider">
                    {label}
                  </Text>
                  <Text size="lg" weight="semibold">
                    {[128, 904, 3_612][index]?.toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ),
      },
    ],
  },
  {
    slug: 'signature',
    name: 'Signature',
    summary: 'Sign with a finger, and get the result back out',
    demos: [
      { label: 'Default', render: () => <SignatureDemo /> },
      { label: 'With a baseline', render: () => <SignatureDemo guideline /> },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-4">
            <Signature size="sm" placeholder={null} />
            <Signature size="md" placeholder={null} />
          </View>
        ),
      },
      {
        label: 'Signing frame',
        id: 'sheet',
        fullPage: true,
        description:
          'A framed pad over a frosted screen. Draw a stroke and the frame lifts as the confirm button arrives beneath it.',
        render: () => <SignatureSheetVersion />,
      },
      {
        label: 'Signing a document',
        id: 'document',
        fullPage: true,
        description:
          'An agreement you scroll, with the captured signature landing back in the document.',
        render: () => <SignatureDocumentVersion />,
      },
      {
        label: 'Saving to a file',
        id: 'export',
        fullPage: true,
        description:
          'save() writes SVG or PNG and hands back where it went. The optional packages report themselves by name.',
        render: () => <SignatureExportVersion />,
      },
      {
        label: 'Full screen',
        id: 'full-screen',
        fullPage: true,
        description: 'The whole screen is the pad, for a form that signs and nothing else.',
        render: () => <SignatureFullScreenVersion />,
      },
      {
        label: 'Proof of delivery',
        id: 'delivery',
        fullPage: true,
        description: 'Recipient, timestamp and signature on one screen, the way a courier app asks.',
        render: () => <SignatureDeliveryVersion />,
      },
    ],
  },
  {
    slug: 'skeleton',
    name: 'Skeleton',
    summary: 'Shimmer placeholder for loading content',
    demos: [
      {
        label: 'List row',
        render: () => (
          <View className="w-full gap-4">
            <View className="flex-row items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <View className="flex-1 gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </View>
            </View>
            <Skeleton className="h-32 w-full rounded-xl" />
          </View>
        ),
      },
      {
        label: 'Card placeholder',
        render: () => (
          <Card className="w-full">
            <Card.Content className="gap-3 p-4">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </Card.Content>
          </Card>
        ),
      },
    ],
  },
  {
    slug: 'slider',
    name: 'Slider',
    summary: 'Pick a value by dragging a thumb along a track',
    demos: [
      { label: 'Interactive', render: () => <SliderDemo /> },
      { label: 'Range', render: () => <RangeSliderDemo /> },
      { label: 'Native', render: () => <NativeSliderDemo /> },
      {
        label: 'Colors',
        render: () => (
          <View className="w-full gap-5">
            <Slider defaultValue={40} color="primary" />
            <Slider defaultValue={55} color="success" />
            <Slider defaultValue={70} color="warning" />
            <Slider defaultValue={85} color="destructive" />
          </View>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-5">
            <Slider defaultValue={40} size="sm" />
            <Slider defaultValue={40} size="md" />
            <Slider defaultValue={40} size="lg" />
          </View>
        ),
      },
      {
        label: 'Stepped',
        render: () => (
          <View className="w-full gap-5">
            <Slider defaultValue={2} min={0} max={5} step={1} />
            <Slider defaultValue={30} disabled />
          </View>
        ),
      },
      {
        label: 'Labelled',
        render: () => (
          <View className="w-full gap-6">
            <Slider label="Brightness" showValue defaultValue={62} />
            {/* formatValue owns the units, so the caption reads the way the
                value is actually spoken rather than as a bare number. */}
            <Slider
              label="Budget"
              showValue
              formatValue={(v) => `$${Math.round(v)}`}
              defaultValue={340}
              min={0}
              max={1000}
              step={20}
              color="success"
            />
          </View>
        ),
      },
    ],
  },
  {
    slug: 'spinner',
    name: 'Spinner',
    summary: 'Indeterminate loading indicator',
    demos: [
      {
        label: 'Sizes',
        render: () => (
          <View className="flex-row items-center gap-6">
            <Spinner size="sm" />
            <Spinner />
            <Spinner size="lg" />
          </View>
        ),
      },
      {
        label: 'In context',
        render: () => (
          <Card className="w-full">
            <Card.Content className="items-center gap-3 p-8">
              <Spinner size="lg" />
              <Text size="sm" muted>
                Loading your projects…
              </Text>
            </Card.Content>
          </Card>
        ),
      },
    ],
  },
  {
    slug: 'steps',
    name: 'Steps',
    summary: 'Stepper for multi-step flows',
    demos: [
      { label: 'Horizontal', render: () => <StepsDemo /> },
      {
        label: 'Vertical',
        render: () => (
          <Steps defaultValue={1} orientation="vertical" className="w-full">
            {STEP_DATA.map((step, index) => (
              <Steps.Item key={step.title} step={index}>
                <Steps.Trigger>
                  <Steps.Indicator />
                  <View className="flex-1">
                    <Steps.Title>{step.title}</Steps.Title>
                    <Steps.Description>{step.description}</Steps.Description>
                  </View>
                </Steps.Trigger>
                {index < STEP_DATA.length - 1 ? <Steps.Separator /> : null}
              </Steps.Item>
            ))}
          </Steps>
        ),
      },
      {
        label: 'Loading',
        render: () => (
          <Steps value={1} orientation="vertical" className="w-full">
            {STEP_DATA.map((step, index) => (
              <Steps.Item key={step.title} step={index} loading={index === 1}>
                <Steps.Trigger>
                  <Steps.Indicator />
                  <View className="flex-1">
                    <Steps.Title>{step.title}</Steps.Title>
                  </View>
                </Steps.Trigger>
                {index < STEP_DATA.length - 1 ? <Steps.Separator /> : null}
              </Steps.Item>
            ))}
          </Steps>
        ),
      },
    ],
  },
  {
    slug: 'swipe',
    name: 'Swipe',
    summary: 'A row that slides aside to reveal its actions',
    demos: [
      { label: 'Swipe to delete', render: () => <SwipeDeleteDemo /> },
      { label: 'Both sides', render: () => <SwipeBothSidesDemo /> },
      { label: 'Full swipe', render: () => <SwipeFullSwipeDemo /> },
      { label: 'Keeping the row open', render: () => <SwipeKeepOpenDemo /> },
      { label: 'Right to left', render: () => <SwipeRtlDemo /> },
    ],
  },
  {
    slug: 'switch',
    name: 'Switch',
    summary: 'On/off toggle',
    demos: [
      { label: 'Settings rows', render: () => <SwitchDemo /> },
      {
        label: 'States',
        render: () => (
          <View className="gap-5">
            <View className="flex-row items-center gap-3">
              <Switch value onValueChange={() => {}} />
              <Text size="sm" muted>On</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Switch value={false} onValueChange={() => {}} />
              <Text size="sm" muted>Off</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Switch value disabled onValueChange={() => {}} />
              <Text size="sm" muted>Disabled</Text>
            </View>
          </View>
        ),
      },
      { label: 'Haptics', render: () => <HapticSwitchDemo /> },
      { label: 'Native', render: () => <NativeSwitchDemo /> },
    ],
  },
  {
    slug: 'table',
    name: 'Table',
    summary: 'Rows and columns that stay lined up',
    demos: [
      { label: 'Basic', render: () => <TableDemo /> },
      { label: 'Outline', render: () => <TableDemo variant="outline" /> },
      { label: 'Striped', render: () => <TableDemo variant="outline" striped /> },
      { label: 'Declared columns', render: () => <ColumnsTableDemo /> },
      { label: 'Paged', render: () => <PaginatedTableDemo /> },
      { label: 'In a frame', render: () => <FramedTableDemo /> },
      { label: 'Sortable columns', render: () => <SortableTableDemo /> },
      { label: 'Selectable rows', render: () => <SelectableTableDemo /> },
      { label: 'Wider than the screen', render: () => <WideTableDemo /> },
      {
        label: 'Empty',
        render: () => (
          <Table variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.Head flex={2}>Invoice</Table.Head>
                <Table.Head align="end">Amount</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Empty>No invoices yet</Table.Empty>
          </Table>
        ),
      },
      {
        label: 'With a caption',
        render: () => (
          <TableDemo variant="outline" caption="Five most recent invoices." />
        ),
      },
    ],
  },
  {
    slug: 'pagination',
    name: 'Pagination',
    summary: 'Moving through a result set one page at a time',
    demos: [
      { label: 'Basic', render: () => <PaginationDemo /> },
      { label: 'Compact', render: () => <PaginationDemo variant="compact" /> },
      { label: 'Simple', render: () => <PaginationDemo variant="simple" /> },
      { label: 'Small', render: () => <PaginationDemo size="sm" /> },
      {
        label: 'A long set',
        render: () => <PaginationDemo count={240} />,
      },
      {
        // Nine targets is as wide as a run gets on a phone. Two boundaries and
        // two arriving arrows put it past the screen, and a centred row that
        // does not fit hangs off both ends — so this trades the arrows for the
        // numbers, which is what a wider run was for.
        label: 'Wider run',
        render: () => (
          <PaginationDemo count={240} siblings={2} boundaries={1} size="sm" controls={false} />
        ),
      },
      {
        label: 'Numbers only',
        render: () => <PaginationDemo controls={false} />,
      },
      {
        label: 'With a status line',
        render: () => (
          <PaginationDemo count={12} variant="compact">
            <Pagination.Status pageSize={20} total={240} />
          </PaginationDemo>
        ),
      },
      { label: 'Beside a table', render: () => <PaginatedTableDemo /> },
      {
        label: 'Disabled',
        render: () => <PaginationDemo disabled />,
      },
    ],
  },
  {
    slug: 'tabs',
    name: 'Tabs',
    summary: 'Segmented navigation between panels',
    demos: [
      {
        label: 'Basic',
        render: () => (
          <Tabs defaultValue="account" className="w-full">
            <Tabs.List>
              <Tabs.Trigger value="account">Account</Tabs.Trigger>
              <Tabs.Trigger value="password">Password</Tabs.Trigger>
              <Tabs.Trigger value="team">Team</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="account">
              <Card>
                <Card.Content className="gap-4 p-4">
                  <Input label="Name" placeholder="Khalid Abdi" />
                  <Input label="Username" placeholder="@khalid" />
                </Card.Content>
              </Card>
            </Tabs.Content>
            <Tabs.Content value="password">
              <Card>
                <Card.Content className="gap-4 p-4">
                  <Input label="Current password" secureTextEntry />
                  <Input label="New password" secureTextEntry />
                </Card.Content>
              </Card>
            </Tabs.Content>
            <Tabs.Content value="team">
              <Card>
                <Card.Content className="flex-row items-center gap-3 p-4">
                  <Avatar fallback="KA" />
                  <View className="flex-1">
                    <Text weight="medium">Khalid Abdi</Text>
                    <Text size="sm" muted>
                      Owner
                    </Text>
                  </View>
                  <Badge variant="secondary">Admin</Badge>
                </Card.Content>
              </Card>
            </Tabs.Content>
          </Tabs>
        ),
      },
      {
        label: 'Two panels',
        render: () => (
          <Tabs defaultValue="preview" className="w-full">
            <Tabs.List>
              <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
              <Tabs.Trigger value="code">Code</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="preview">
              <Card>
                <Card.Content className="items-center p-8">
                  <Button>Click me</Button>
                </Card.Content>
              </Card>
            </Tabs.Content>
            <Tabs.Content value="code">
              <Card>
                <Card.Content className="p-4">
                  <Typography.Code>{'<Button>Click me</Button>'}</Typography.Code>
                </Card.Content>
              </Card>
            </Tabs.Content>
          </Tabs>
        ),
      },
      {
        label: 'Underline',
        render: () => (
          <Tabs variant="underline" defaultValue="overview" className="w-full">
            <Tabs.List>
              <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
              <Tabs.Trigger value="activity" badge={<Badge variant="secondary">4</Badge>}>
                Activity
              </Tabs.Trigger>
              <Tabs.Trigger value="archived" disabled>
                Archived
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="overview">
              <Text size="sm" muted className="py-4">
                A rule under the active tab, on a row that has no track of its
                own — for a page-level switch rather than a control.
              </Text>
            </Tabs.Content>
            <Tabs.Content value="activity">
              <Text size="sm" muted className="py-4">
                Four things happened while you were away.
              </Text>
            </Tabs.Content>
            <Tabs.Content value="archived">
              <Text size="sm" muted className="py-4">
                Unreachable — the trigger is disabled.
              </Text>
            </Tabs.Content>
          </Tabs>
        ),
      },
      {
        label: 'Pill',
        render: () => (
          <Tabs variant="pill" defaultValue="all" className="w-full">
            <Tabs.List>
              <Tabs.Trigger value="all">All</Tabs.Trigger>
              <Tabs.Trigger value="unread">Unread</Tabs.Trigger>
              <Tabs.Trigger value="flagged">Flagged</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="all">
              <Text size="sm" muted className="py-4">
                A filled chip on the page, with the active label inverted
                against it.
              </Text>
            </Tabs.Content>
            <Tabs.Content value="unread">
              <Text size="sm" muted className="py-4">
                Nothing unread.
              </Text>
            </Tabs.Content>
            <Tabs.Content value="flagged">
              <Text size="sm" muted className="py-4">
                Nothing flagged.
              </Text>
            </Tabs.Content>
          </Tabs>
        ),
      },
      {
        label: 'Scrollable',
        render: () => <ScrollableTabsDemo />,
      },
      {
        label: 'Keeping panels mounted',
        render: () => <KeepMountedTabsDemo />,
      },
      {
        label: 'Swiping between panels',
        render: () => <SwipeableTabsDemo />,
      },
      {
        label: 'Icons that open',
        render: () => <ExpandingTabsDemo />,
      },
    ],
  },
  {
    slug: 'toggle-button',
    name: 'ToggleButton',
    summary: 'A button that stays down',
    demos: [
      { label: 'On its own', render: () => <ToggleButtonDemo /> },
      { label: 'A toolbar of marks', render: () => <ToggleButtonToolbarDemo /> },
      { label: 'An either-or choice', render: () => <ToggleButtonSingleDemo /> },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-3">
            <ToggleButtonGroup defaultValue={['s']} size="sm">
              <ToggleButton id="s">Small</ToggleButton>
              <ToggleButton id="s2">Small</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup defaultValue={['m']}>
              <ToggleButton id="m">Medium</ToggleButton>
              <ToggleButton id="m2">Medium</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup defaultValue={['l']} size="lg">
              <ToggleButton id="l">Large</ToggleButton>
              <ToggleButton id="l2">Large</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButton disabled defaultSelected>
              Disabled
            </ToggleButton>
          </View>
        ),
      },
    ],
  },
  {
    slug: 'textarea',
    name: 'Textarea',
    summary: 'Text that runs to several lines, sized in rows',
    demos: [
      {
        label: 'Rows, not pixels',
        render: () => (
          <View className="w-full gap-4">
            <Textarea rows={2} placeholder="Two rows" />
            <Textarea rows={4} placeholder="Four rows" />
            <Textarea size="sm" rows={4} placeholder="Four smaller rows" />
          </View>
        ),
      },
      { label: 'Growing with the text', render: () => <TextareaGrowDemo /> },
      {
        label: 'Label, description and error',
        render: () => (
          <View className="w-full gap-4">
            <Textarea
              label="Bio"
              rows={3}
              placeholder="A short bio"
              description="Shown on your public profile."
            />
            <Textarea
              label="Feedback"
              rows={3}
              isRequired
              placeholder="What went wrong?"
              errorMessage="Tell us a little more."
            />
          </View>
        ),
      },
      { label: 'Counting characters', render: () => <TextareaCountDemo /> },
      {
        label: 'Filled',
        render: () => (
          // `filled` inside a card: a second border beside the card's own
          // reads as a seam, so the field carries a background instead.
          <Card className="w-full">
            <Card.Content className="gap-4 p-4">
              <Textarea
                variant="filled"
                label="Notes"
                rows={3}
                placeholder="Anything we should know?"
              />
            </Card.Content>
          </Card>
        ),
      },
      {
        label: 'A composer that avoids the keyboard',
        id: 'composer',
        fullPage: true,
        description:
          'A one-row composer that grows as the message does and rides the keyboard up.',
        render: () => <TextareaComposerDemo />,
      },
    ],
  },
  {
    slug: 'time-picker',
    name: 'TimePicker',
    summary: 'A time of day, as a wheel, a clock or a swipeable scale',
    demos: [
      // The ruler leads: it is a trigger and a sheet, so it needs no more of
      // the screen than any other page here, and a Versions list of one row
      // pointing at it was a page spent on a link.
      { label: 'The ruler, in a sheet', render: () => <TimePickerRulerDemo /> },
      { label: 'Presentations', render: () => <TimePickerPresentationsDemo /> },
      { label: 'The wheel', render: () => <TimePickerWheelDemo /> },
      { label: 'The clock face', render: () => <TimePickerClockDemo /> },
      { label: 'Inline, inside a Frame', render: () => <TimePickerFrameDemo /> },
    ],
  },
  {
    slug: 'timeline',
    name: 'Timeline',
    summary: 'Vertical sequence of events',
    demos: [
      { label: 'Dot', render: () => <TimelineDemo variant="dot" /> },
      { label: 'Icon', render: () => <TimelineDemo variant="icon" /> },
      { label: 'Numbered', render: () => <TimelineDemo variant="numbered" /> },
      { label: 'Card', render: () => <TimelineDemo variant="card" /> },
      { label: 'Deploy log', render: () => <DeployLogDemo /> },
      { label: 'Studio feed', render: () => <StudioFeedDemo /> },
      { label: 'Ledger', render: () => <LedgerDemo /> },
      { label: 'Handoff', render: () => <HandoffDemo /> },
    ],
  },
  {
    slug: 'toast',
    name: 'Toast',
    summary: 'Transient notification with swipe to dismiss',
    demos: [
      { label: 'Usage patterns', render: () => <ToastDemo /> },
      {
        label: 'Anatomy',
        render: () => (
          <View className="w-full gap-3">
            <Toast variant="success">
              <Toast.Indicator />
              <Toast.Content>
                <Toast.Title>Changes saved</Toast.Title>
                <Toast.Description>Your profile is up to date.</Toast.Description>
              </Toast.Content>
              <Toast.Close />
            </Toast>
            <Toast variant="warning">
              <Toast.Indicator />
              <Toast.Content>
                <Toast.Title>Storage almost full</Toast.Title>
              </Toast.Content>
              <Toast.Action>Upgrade</Toast.Action>
            </Toast>
          </View>
        ),
      },
    ],
  },
  {
    slug: 'tooltip',
    name: 'Tooltip',
    summary: 'A small label that names the thing under your finger',
    demos: [
      {
        label: 'Long press',
        render: () => (
          <Tooltip label="Copy link">
            <Tooltip.Trigger>
              <Button variant="outline">Press and hold</Button>
            </Tooltip.Trigger>
            <Tooltip.Content>
              <Tooltip.Arrow />
              Copy link
            </Tooltip.Content>
          </Tooltip>
        ),
      },
      {
        label: 'On press',
        render: () => (
          <View className="flex-row items-center gap-3">
            <Tooltip openOn="press" label="More information">
              <Tooltip.Trigger>
                <Button variant="ghost" size="icon" accessibilityLabel="Info">
                  <InfoIcon size={20} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>
                <Tooltip.Arrow />
                Syncs every 15 minutes
              </Tooltip.Content>
            </Tooltip>
            <Text size="sm" muted>
              Tap the icon
            </Text>
          </View>
        ),
      },
      {
        label: 'Placement',
        render: () => (
          // Each trigger is pinned to the side that leaves room for the label
          // to open the way its label says, so all four sides are distinct
          // rather than flipping inward near an edge.
          <View className="h-64 w-full justify-between py-4">
            <View className="flex-row justify-center">
              <PlacementTooltip placement="bottom" />
            </View>
            <View className="flex-row justify-between px-2">
              <PlacementTooltip placement="right" />
              <PlacementTooltip placement="left" />
            </View>
            <View className="flex-row justify-center">
              <PlacementTooltip placement="top" />
            </View>
          </View>
        ),
      },
      {
        label: 'Rich content',
        render: () => (
          <Tooltip openOn="press" duration={0}>
            <Tooltip.Trigger>
              <Button variant="secondary">Keyboard shortcut</Button>
            </Tooltip.Trigger>
            <Tooltip.Content className="flex-row items-center gap-2">
              <Tooltip.Arrow />
              <Tooltip.Text>Save</Tooltip.Text>
              <View className="rounded bg-background/20 px-1.5 py-0.5">
                <Text size="xs" weight="semibold" className="text-background">
                  ⌘S
                </Text>
              </View>
            </Tooltip.Content>
          </Tooltip>
        ),
      },
      {
        label: 'A panel, not a label',
        render: () => (
          // Past a line of text the inversion stops reading as a whisper and
          // starts reading as a panel with the wrong colours — so it becomes
          // one, and takes a width rather than running to whatever the
          // sentence happens to want.
          <Tooltip openOn="press" duration={0}>
            <Tooltip.Trigger>
              <Button variant="outline">What is streaming?</Button>
            </Tooltip.Trigger>
            <Tooltip.Content
              variant="surface"
              width={264}
              className="gap-1 p-3"
            >
              <Tooltip.Arrow />
              <Tooltip.Title>Streaming</Tooltip.Title>
              <Tooltip.Description>
                Tokens are rendered as they arrive rather than waiting for the
                whole reply, so the first words appear in a few hundred
                milliseconds.
              </Tooltip.Description>
            </Tooltip.Content>
          </Tooltip>
        ),
      },
      {
        label: 'Scrolled, when it has to be',
        render: () => (
          <Tooltip openOn="press" duration={0}>
            <Tooltip.Trigger>
              <Button variant="outline">Release notes</Button>
            </Tooltip.Trigger>
            <Tooltip.Content
              variant="surface"
              width={280}
              maxHeight={220}
              scrollable
              className="p-3"
            >
              <View className="gap-2">
                <Tooltip.Title>What changed in 0.30</Tooltip.Title>
                {[
                  'Textarea, sized in rows rather than pixels.',
                  'The menu panel draws on a replaceable background layer.',
                  'Tooltips follow the theme, and hold a panel of content.',
                  'The calendar frames itself and draws a continuous range.',
                  'Reasoning, Sources, Task, CodeBlock and Plan.',
                ].map((line) => (
                  <Tooltip.Description key={line}>{line}</Tooltip.Description>
                ))}
              </View>
            </Tooltip.Content>
          </Tooltip>
        ),
      },
    ],
  },
  {
    slug: 'tree',
    name: 'Tree',
    summary: 'A hierarchy you can open a level at a time',
    demos: [
      { label: 'Default', render: () => <TreeFilesDemo /> },
      { label: 'Guide lines', render: () => <TreeFilesDemo showLines /> },
      { label: 'Single selection', render: () => <TreeSelectionDemo mode="single" /> },
      { label: 'Multiple selection', render: () => <TreeSelectionDemo mode="multiple" /> },
      { label: 'Sidebar nav', render: () => <TreeNavDemo /> },
      { label: 'Loads when opened', render: () => <TreeLazyDemo /> },
    ],
  },
  {
    slug: 'typography',
    name: 'Typography',
    summary: 'Semantic text presets',
    demos: [
      {
        label: 'Types',
        render: () => (
          <View className="w-full gap-3">
            <Typography type="h1">Heading 1</Typography>
            <Typography type="h2">Heading 2</Typography>
            <Typography type="h3">Heading 3</Typography>
            <Typography type="h4">Heading 4</Typography>
            <Typography type="body">Body text</Typography>
            <Typography type="body-sm" muted>
              Small body text
            </Typography>
            <Typography.Code>npm i panelui-native</Typography.Code>
          </View>
        ),
      },
      {
        label: 'Paragraphs',
        render: () => (
          <View className="w-full gap-3">
            <Typography.Paragraph type="lead">
              A lead paragraph: the sentence under a heading, set larger and
              quieter than the body it introduces.
            </Typography.Paragraph>
            <Typography.Paragraph>
              This is a default body paragraph. It uses the base font size and
              normal weight for comfortable reading.
            </Typography.Paragraph>
            <Typography.Paragraph type="body-sm" muted>
              A smaller paragraph, useful for captions, footnotes, or secondary
              descriptions.
            </Typography.Paragraph>
            <Typography.Paragraph type="small">
              Small: tight, medium weight, for meta lines.
            </Typography.Paragraph>
          </View>
        ),
      },
      {
        label: 'Marks',
        render: () => (
          <View className="w-full gap-3">
            <Typography underline>Terms of service</Typography>
            <Typography italic>An aside, in passing.</Typography>
            <Typography strike muted>
              £24.00
            </Typography>
            <Typography weight="bold">Bolded body, without a heading.</Typography>
            {/* Marks stack: each one is a prop, so a screen never has to know
                which utilities add up to "a struck-through italic". */}
            <Typography italic strike muted>
              Withdrawn
            </Typography>
          </View>
        ),
      },
      {
        label: 'Alignment and case',
        render: () => (
          <View className="w-full gap-3">
            <Typography align="left">Left</Typography>
            <Typography align="center">Centre</Typography>
            <Typography align="right">Right</Typography>
            <Typography type="body-xs" transform="uppercase" muted>
              Section label
            </Typography>
            <Typography transform="capitalize">a capitalised sentence</Typography>
          </View>
        ),
      },
      {
        label: 'Quotes and lists',
        render: () => (
          <View className="w-full gap-5">
            <Typography.Blockquote>
              A component library is a set of decisions you only have to make
              once.
            </Typography.Blockquote>

            <Typography.List>
              <Typography.ListItem>Runs in Expo Go</Typography.ListItem>
              <Typography.ListItem>Animates on the UI thread</Typography.ListItem>
              <Typography.ListItem>
                Wraps to as many lines as it needs, with the marker staying put
              </Typography.ListItem>
            </Typography.List>

            <Typography.List ordered>
              <Typography.ListItem>Install the package</Typography.ListItem>
              <Typography.ListItem>Import the stylesheet</Typography.ListItem>
              <Typography.ListItem>Wrap the app in the provider</Typography.ListItem>
            </Typography.List>
          </View>
        ),
      },
    ],
  },
  {
    slug: 'panelside',
    name: 'Panelside',
    summary: 'Navigation panel that pushes and curves the app screen',
    // Every one of these is the whole screen. Panelside wraps the app content
    // in order to push it, so there is no version of it that fits in a section
    // between two dividers.
    demos: [
      {
        label: 'Assistant',
        id: 'assistant',
        fullPage: true,
        fullBleed: true,
        description: 'Swipe from the left edge — the screen slides, shrinks and rounds.',
        render: () => <PanelsideAssistantBlock />,
      },
      {
        label: 'Open a conversation',
        id: 'navigate',
        fullPage: true,
        fullBleed: true,
        description: 'Press a chat and the screen becomes it, with the panel closing itself.',
        render: () => <PanelsideNavigateBlock />,
      },
      {
        label: 'Overlay',
        id: 'overlay',
        fullPage: true,
        fullBleed: true,
        description: 'The same panel sliding over a screen that stays where it is.',
        render: () => <PanelsideOverlayBlock />,
      },
      {
        label: 'Docked',
        id: 'docked',
        fullPage: true,
        fullBleed: true,
        description: 'Past a width you pick, the panel is a column and the trigger goes.',
        render: () => <PanelsideDockedBlock />,
      },
      {
        label: 'Deeper curve',
        id: 'curve',
        fullPage: true,
        fullBleed: true,
        description: 'Scale, radius and dim turned well up — the three numbers are yours.',
        render: () => <PanelsideCurveBlock />,
      },
      {
        label: 'Full chat',
        id: 'chat',
        fullPage: true,
        fullBleed: true,
        description: 'A streaming transcript underneath, anchored and scrolling on its own.',
        render: () => <PanelsideChatBlock />,
      },
      {
        label: 'Native chat',
        id: 'native',
        fullPage: true,
        fullBleed: true,
        description: 'Platform picker, sheet and buttons inside the panel — needs @expo/ui.',
        render: () => <PanelsideNativeBlock />,
      },
    ],
  },
];

/**
 * The catalogue, A–Z.
 *
 * Sorted here rather than kept in order above, because the array above is five
 * thousand lines of demo code and a new component is always appended to the end
 * of it. Every list that was alphabetical by hand has stopped being — this one
 * had charts filed under L and Item under O — so the order is derived from the
 * names the list prints and cannot drift again.
 */
export const COMPONENTS: ComponentEntry[] = [...CATALOGUE].sort((a, b) =>
  a.name.localeCompare(b.name)
);

/** Catalogue keyed by slug, for the detail route. */
export const COMPONENTS_BY_SLUG: Record<string, ComponentEntry> = Object.fromEntries(
  COMPONENTS.map((entry) => [entry.slug, entry])
);
