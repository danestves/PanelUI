import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  ImageIcon,
  SearchIcon,
  SendHorizontalIcon,
  XIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The previews on the home page: the library's components, drawn in the
 * browser.
 *
 * These are markup, not the real components — the real ones are React Native
 * and putting them on this page would mean shipping react-native-web to every
 * visitor to show them a picture. What makes them worth having anyway is that
 * every class name here is copied from the component it stands for, so a
 * preview and the thing it previews are the same colours, the same radii and
 * the same spacing rather than a designer's impression of them. When a
 * component's variants change, these are wrong, and the fix is to copy the new
 * strings across.
 *
 * They are also why the token work in `panel-themes.css` matters: nothing here
 * names a colour, so all thirty of these surfaces retheme together.
 *
 * Nothing here is interactive — see the `inert` on the wrapper in `themer.tsx`.
 */

/* ------------------------------------------------------------------ *
 * The shells every preview is built in — Card and Frame.
 * ------------------------------------------------------------------ */

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col rounded-2xl border border-border bg-card shadow-sm', className)}>
      {children}
    </div>
  );
}

function CardHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1.5 p-5">
      <span className="text-lg font-semibold leading-none text-card-foreground">{title}</span>
      {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
    </div>
  );
}

function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex flex-col p-5 pt-0', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ *
 * The controls themselves.
 * ------------------------------------------------------------------ */

/** Button — `variant` × `size`, at the resting state. */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const root = {
    primary: 'border-primary bg-primary shadow-sm',
    secondary: 'bg-secondary',
    outline: 'border-input bg-popover shadow-sm',
    ghost: 'bg-transparent',
    destructive: 'border-destructive bg-destructive shadow-sm',
  }[variant];

  const label = {
    primary: 'text-primary-foreground',
    secondary: 'text-secondary-foreground',
    outline: 'text-foreground',
    ghost: 'text-foreground',
    destructive: 'text-destructive-solid-foreground',
  }[variant];

  return (
    <span
      className={cn(
        'inline-flex flex-row items-center justify-center gap-2 rounded-lg border border-transparent',
        size === 'sm' ? 'h-9 gap-1.5 px-2.5' : 'h-11 px-4',
        root,
        className
      )}
    >
      <span className={cn('font-medium', size === 'sm' ? 'text-sm' : 'text-base', label)}>
        {children}
      </span>
    </span>
  );
}

/** Badge — the pill, in the variants that carry a status colour. */
function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info';
}) {
  const root = {
    default: 'bg-primary',
    secondary: 'bg-secondary',
    outline: 'border-border bg-transparent',
    success: 'bg-success-subtle',
    warning: 'bg-warning-subtle',
    info: 'bg-info-subtle',
  }[variant];

  const label = {
    default: 'text-primary-foreground',
    secondary: 'text-secondary-foreground',
    outline: 'text-foreground',
    success: 'text-success-foreground',
    warning: 'text-warning-foreground',
    info: 'text-info-foreground',
  }[variant];

  return (
    <span
      className={cn(
        'inline-flex flex-row items-center justify-center gap-1 self-start rounded-sm border border-transparent px-2 py-0.5',
        root
      )}
    >
      <span className={cn('text-xs font-medium', label)}>{children}</span>
    </span>
  );
}

/** Input — the outline field at `md`, with optional content at either end. */
function Input({
  placeholder,
  value,
  start,
  end,
  size = 'md',
}: {
  placeholder?: string;
  value?: string;
  start?: React.ReactNode;
  end?: React.ReactNode;
  size?: 'sm' | 'md';
}) {
  const pad = size === 'sm' ? 'px-3' : 'px-3.5';
  return (
    <span className="relative flex w-full">
      <span
        className={cn(
          'flex w-full flex-row items-center rounded-lg border border-input bg-background font-normal',
          size === 'sm' ? 'h-10 text-[14px]' : 'h-12 text-[16px]',
          pad,
          start && (size === 'sm' ? 'ps-9' : 'ps-10'),
          end && (size === 'sm' ? 'pe-9' : 'pe-10')
        )}
      >
        <span className={cn('truncate', value ? 'text-foreground' : 'text-muted-foreground')}>
          {value ?? placeholder}
        </span>
      </span>
      {start ? (
        <span
          className={cn(
            'absolute bottom-0 start-0 top-0 z-10 flex flex-row items-center justify-center gap-2 text-muted-foreground',
            pad
          )}
        >
          {start}
        </span>
      ) : null}
      {end ? (
        <span
          className={cn(
            'absolute bottom-0 end-0 top-0 z-10 flex flex-row items-center justify-center gap-2 text-muted-foreground',
            pad
          )}
        >
          {end}
        </span>
      ) : null}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-foreground">{children}</span>;
}

/** Switch — the track and thumb at their two rest positions. */
function Switch({ on = false }: { on?: boolean }) {
  return (
    <span
      className={cn(
        'relative flex h-7 w-12 shrink-0 flex-row items-center justify-center rounded-full border border-transparent p-[3px]',
        on ? 'bg-primary' : 'bg-input'
      )}
    >
      <span
        className={cn('h-5 w-5 rounded-full bg-white shadow-sm', on ? 'ms-auto' : 'me-auto')}
      />
    </span>
  );
}

function Checkbox({ checked = false }: { checked?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-input',
        checked ? 'border-primary bg-primary' : 'bg-background'
      )}
    >
      {checked ? (
        <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
          <path
            d="M20 6 9 17l-5-5"
            fill="none"
            stroke="var(--primary-foreground)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

/** Chip — the rounded filter tag. */
function Chip({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'success';
}) {
  const root = {
    default: 'bg-secondary',
    outline: 'border-border bg-transparent',
    success: 'bg-success-subtle',
  }[variant];
  const label = {
    default: 'text-secondary-foreground',
    outline: 'text-foreground',
    success: 'text-success-foreground',
  }[variant];
  return (
    <span
      className={cn(
        'inline-flex h-7 flex-row items-center gap-1.5 self-start rounded-full border border-transparent px-2.5',
        root
      )}
    >
      <span className={cn('text-sm font-medium', label)}>{children}</span>
    </span>
  );
}

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted',
        className
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{initials}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * The cards.
 * ------------------------------------------------------------------ */

/** Buttons, fields and the small controls, in one panel. */
export function ControlsCard() {
  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">Button</Button>
        <Button size="sm" variant="secondary">
          Secondary
        </Button>
        <Button size="sm" variant="outline">
          Outline
        </Button>
      </div>

      <Input placeholder="Search components" start={<SearchIcon className="size-4" />} size="sm" />

      <div className="flex h-20 w-full flex-col rounded-lg border border-input bg-background px-3 py-2">
        <span className="text-[14px] text-muted-foreground">Leave a message…</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge>Badge</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="success">Shipped</Badge>
      </div>

      <div className="flex flex-row items-center gap-3">
        <Checkbox checked />
        <Checkbox />
        <span className="ms-auto flex flex-row items-center gap-3">
          <Switch />
          <Switch on />
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip variant="success">Expo Go</Chip>
        <Chip>Reanimated</Chip>
        <Chip variant="outline">Uniwind</Chip>
      </div>
    </Card>
  );
}

/**
 * Attachment — file rows in the three states they pass through: uploading with
 * a hairline of progress along the bottom edge, done, and failed with the
 * border carrying the failure so it reads at a glance down a list.
 */
export function AttachmentCard() {
  const files = [
    {
      icon: ImageIcon,
      name: 'launch-hero@2x.png',
      meta: 'PNG · 1.8 MB',
      state: 'uploading' as const,
      progress: 62,
    },
    {
      icon: FileTextIcon,
      name: 'sales-dashboard.pdf',
      meta: 'PDF · 2.4 MB',
      state: 'done' as const,
      progress: 0,
    },
    {
      icon: FileTextIcon,
      name: 'q3-forecast.xlsx',
      meta: 'Upload failed',
      state: 'error' as const,
      progress: 0,
    },
  ];

  return (
    <Card className="gap-3 p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Attachments
      </span>
      {files.map(({ icon: Icon, name, meta, state, progress }) => (
        <div
          key={name}
          className={cn(
            'relative w-full overflow-hidden rounded-xl border p-4',
            state === 'error' ? 'border-destructive' : 'border-border'
          )}
        >
          <div className="flex w-full flex-row items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <Icon className="size-4 text-muted-foreground" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className={cn(
                  'truncate text-base font-medium',
                  state === 'error' ? 'text-destructive' : 'text-foreground'
                )}
              >
                {name}
              </span>
              <span
                className={cn(
                  'truncate text-sm',
                  state === 'error' ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {meta}
              </span>
            </span>
            <XIcon className="size-4 shrink-0 text-muted-foreground" />
          </div>
          {state === 'uploading' ? (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted">
              <span className="block h-full bg-primary" style={{ width: `${progress}%` }} />
            </span>
          ) : null}
        </div>
      ))}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Frame — the widget shell every chart demo is shown in: a titled tray
 * with the card flush inside it.
 * ------------------------------------------------------------------ */

function Frame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-3xl border border-border bg-surface', className)}>
      {children}
    </div>
  );
}

function FrameHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex flex-row items-center justify-between gap-3 px-4 pb-3 pt-2.5">
      <span className="min-w-0 shrink truncate text-sm text-muted-foreground">{title}</span>
      {action ? (
        <span className="flex shrink-0 flex-row items-center gap-2 text-sm text-muted-foreground">
          {action}
        </span>
      ) : null}
    </div>
  );
}

function FramePanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card', className)}>
      {children}
    </div>
  );
}

/** The value, caption and series key a chart puts above its plot. */
function ChartHeader({
  value,
  caption,
  series,
}: {
  value: string;
  caption: string;
  series: { label: string; color: string }[];
}) {
  return (
    <div className="flex flex-row items-start justify-between gap-3 px-4 pb-3 pt-3.5">
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-xl font-bold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{caption}</span>
      </div>
      <div className="shrink pt-1">
        <div className="flex flex-row flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {series.map(({ label, color }) => (
            <span key={label} className="flex flex-row items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A curve through every point, as cubic segments with horizontal handles —
 * the shape the chart utilities produce for a monotone series: it reaches each
 * point and never overshoots between two of them.
 */
function segments(points: [number, number][]): string {
  return points
    .slice(1)
    .map(([x, y], index) => {
      const [px, py] = points[index];
      const dx = (x - px) / 3;
      return `C${px + dx},${py} ${x - dx},${y} ${x},${y}`;
    })
    .join(' ');
}

function curve(points: [number, number][]): string {
  return `M${points[0][0]},${points[0][1]} ${segments(points)}`;
}

/** A filled band: down the top edge, across, and back along the bottom one. */
function band(top: [number, number][], bottom: [number, number][]): string {
  return `${curve(top)} L${bottom[0][0]},${bottom[0][1]} ${segments(bottom)} Z`;
}

const AREA_DATA = [
  { hour: '00', direct: 18, search: 26, social: 10 },
  { hour: '02', direct: 22, search: 24, social: 12 },
  { hour: '04', direct: 16, search: 30, social: 9 },
  { hour: '06', direct: 28, search: 34, social: 14 },
  { hour: '08', direct: 42, search: 46, social: 18 },
  { hour: '10', direct: 55, search: 52, social: 24 },
  { hour: '12', direct: 61, search: 58, social: 27 },
  { hour: '14', direct: 54, search: 63, social: 22 },
  { hour: '16', direct: 66, search: 57, social: 29 },
  { hour: '18', direct: 72, search: 64, social: 33 },
  { hour: '20', direct: 58, search: 55, social: 26 },
  { hour: '22', direct: 44, search: 48, social: 20 },
];

/**
 * AreaChart, stacked, in the Frame the demo puts it in: the tray names the
 * widget, the panel holds the chart, and the chart's own header carries the
 * total and the series key.
 */
export function AreaChartCard() {
  const W = 300;
  const H = 96;
  const MAX = 180;
  const step = W / (AREA_DATA.length - 1);
  const y = (value: number) => H - (value / MAX) * H;
  const at = (index: number) => index * step;

  /* Stacked: each band sits on the sum of the ones declared before it. */
  const totals = AREA_DATA.map((d) => [d.direct, d.direct + d.search, d.direct + d.search + d.social]);

  const bands = [
    { key: 'direct', label: 'Direct', color: 'var(--chart-1)', level: 0 },
    { key: 'search', label: 'Search', color: 'var(--chart-2)', level: 1 },
    { key: 'social', label: 'Social', color: 'var(--chart-3)', level: 2 },
  ];

  return (
    <Frame>
      <FrameHeader title="Sessions by channel" action="Today" />
      <FramePanel>
        <ChartHeader
          value="4,812"
          caption="Across the day"
          /* Reversed, because a stacked key reads top band first. */
          series={[...bands].reverse().map(({ label, color }) => ({ label, color }))}
        />
        <div className="relative px-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              {bands.map(({ key, color }) => (
                <linearGradient key={key} id={`showcase-band-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={color} stopOpacity="0.85" />
                  <stop offset="1" stopColor={color} stopOpacity="0.35" />
                </linearGradient>
              ))}
            </defs>

            {/* Dashed and quiet: the gridlines are a reference, not content. */}
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1="0"
                y1={(H / 3) * i}
                x2={W}
                y2={(H / 3) * i}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {bands.map(({ key, color, level }) => {
              const top: [number, number][] = totals.map((t, i) => [at(i), y(t[level])]);
              /* The lowest band sits on the axis; the others sit on the one
                 below, walked backwards so the shape closes. */
              const floor: [number, number][] =
                level === 0
                  ? [
                      [W, H],
                      [0, H],
                    ]
                  : totals.map((t, i) => [at(i), y(t[level - 1])] as [number, number]).reverse();

              return (
                <g key={key}>
                  <path d={band(top, floor)} fill={`url(#showcase-band-${key})`} />
                  <path
                    d={curve(top)}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </svg>

          <div className="flex flex-row pb-3 pt-2">
            {['00:00', '06:00', '12:00', '17:00', '23:00'].map((hour) => (
              <span key={hour} className="flex-1 text-center text-xs text-muted-foreground">
                {hour}
              </span>
            ))}
          </div>
        </div>
      </FramePanel>
    </Frame>
  );
}

/** BarChart in its own Frame — categories compared by length. */
export function BarChartCard() {
  const bars = [42, 78, 55, 96, 61, 34];
  const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];

  return (
    <Frame>
      <FrameHeader title="Contributions" action="6 months" />
      <FramePanel className="px-4 pb-3 pt-3.5">
        <div className="flex flex-col gap-0.5 pb-3">
          <span className="text-xl font-bold text-foreground">1,284</span>
          <span className="text-xs text-muted-foreground">Peak in March</span>
        </div>
        {/*
         * `items-stretch`, not `items-end`: the bars are percentage heights,
         * and a percentage needs a parent with a height to be a percentage of.
         * Under `items-end` each column shrinks to its content — which is
         * nothing — and the chart draws as an empty box.
         */}
        <div className="flex h-24 flex-row items-stretch gap-2">
          {bars.map((value, index) => (
            <div key={months[index]} className="flex flex-1 flex-col justify-end">
              <div
                className="w-full rounded-t-md bg-chart-1"
                style={{ height: `${value}%`, opacity: index === 3 ? 1 : 0.28 }}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-row pt-2">
          {months.map((month) => (
            <span key={month} className="flex-1 text-center text-xs text-muted-foreground">
              {month}
            </span>
          ))}
        </div>
      </FramePanel>
    </Frame>
  );
}

/**
 * KPI — several metrics gathered into one panel: the number, what it did, and
 * the shape it made getting there, one row each under a shared tray header.
 */
export function KpiCard() {
  const rows = [
    {
      label: 'Total Revenue',
      value: '$317,904',
      delta: '+7.8%',
      caption: 'last 30d',
      color: 'var(--chart-1)',
      spark: [
        [0, 30],
        [16, 26],
        [32, 27],
        [48, 18],
        [64, 16],
        [80, 10],
        [96, 4],
      ] as [number, number][],
    },
    {
      label: 'Bounce Rate',
      value: '37.6%',
      delta: '−8.4%',
      caption: 'vs last 7d',
      color: 'var(--chart-3)',
      spark: [
        [0, 6],
        [16, 9],
        [32, 12],
        [48, 14],
        [64, 20],
        [80, 22],
        [96, 30],
      ] as [number, number][],
    },
    {
      label: 'New Customers',
      value: '2,867',
      delta: '+4.2%',
      caption: 'this week',
      color: 'var(--chart-2)',
      spark: [
        [0, 30],
        [16, 27],
        [32, 24],
        [48, 18],
        [64, 17],
        [80, 11],
        [96, 5],
      ] as [number, number][],
    },
  ];

  return (
    <Frame>
      <FrameHeader title="Overview" action="Last 30 days" />
      <FramePanel>
        {rows.map(({ label, value, delta, caption, color, spark }, index) => (
          <div
            key={label}
            className={cn(
              'flex flex-row items-center gap-4 px-4 py-4',
              /* Frame.Panel rules its children apart; the first has the
                 panel's own top edge above it already. */
              index > 0 && 'border-t border-border'
            )}
          >
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">{label}</span>
              <span className="text-2xl font-bold text-foreground">{value}</span>
              <span className="text-sm">
                <span className="font-medium text-success">{delta}</span>{' '}
                <span className="text-muted-foreground">{caption}</span>
              </span>
            </div>
            <svg viewBox="0 0 96 36" className="h-10 w-28 shrink-0" aria-hidden="true">
              <path
                d={curve(spark)}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ))}
      </FramePanel>
    </Frame>
  );
}

/** A form: labelled fields, then the two buttons that close it. */
export function FormCard() {
  return (
    <Card>
      <CardHeader title="Set a new milestone" description="Name it, then say when it lands." />
      <CardBody className="gap-4">
        <div className="flex w-full flex-col gap-1.5">
          <Label>Goal name</Label>
          <Input placeholder="New device fund" size="sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex w-full flex-col gap-1.5">
            <Label>Target</Label>
            <Input value="$15,000" size="sm" />
          </div>
          <div className="flex w-full flex-col gap-1.5">
            <Label>Date</Label>
            <Input value="Dec 2026" size="sm" />
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Button className="w-full">Create goal</Button>
          <Button variant="ghost" className="w-full">
            Cancel
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** Slider and Progress — the two bars, with their captions. */
export function SlidersCard() {
  return (
    <Card className="gap-5 p-5">
      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full flex-row items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">Minimum payout</span>
          <span className="text-sm text-muted-foreground">$2,500</span>
        </div>
        <div className="relative flex h-5 w-full flex-row items-center justify-center rounded-full bg-muted">
          <span className="absolute bottom-0 start-0 top-0 w-[46%] rounded-full bg-primary" />
          <span className="absolute start-[46%] flex h-5 -translate-x-1/2 flex-row rounded-full bg-primary p-0.5">
            <span className="w-6 rounded-full bg-background shadow-sm" />
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full flex-row items-center justify-between">
          <span className="text-sm font-medium text-foreground">Upload</span>
          <span className="text-sm text-muted-foreground">72%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-primary/16">
          <div className="h-full w-[72%] rounded-full bg-primary" />
        </div>
      </div>

      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full flex-row items-center justify-between">
          <span className="text-sm font-medium text-foreground">Storage</span>
          <span className="text-sm text-muted-foreground">18%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-success/16">
          <div className="h-full w-[18%] rounded-full bg-success" />
        </div>
      </div>
    </Card>
  );
}

/** Alert — the soft status fill, over the badges that use the subtle one. */
export function AlertCard() {
  return (
    <Card className="gap-3 p-4">
      <div className="flex w-full flex-row items-start gap-3 rounded-xl bg-info-soft p-4">
        <BellIcon className="mt-0.5 size-4 shrink-0 text-info-foreground" />
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-semibold text-info-foreground">Update available</span>
          <span className="text-sm text-muted-foreground">
            0.57.0 adds a QR code and a components index.
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Info</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="outline">Outline</Badge>
      </div>
    </Card>
  );
}

/** A chat transcript, and the composer under it. */
export function ChatCard() {
  return (
    <Card>
      <div className="flex flex-row items-center gap-3 border-b border-border p-4">
        <Avatar initials="PA" />
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-medium text-foreground">Assistant</span>
          <span className="text-xs text-muted-foreground">Online</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex w-full flex-row items-end justify-start gap-2">
          <div className="flex max-w-[85%] flex-col items-start gap-1">
            <div className="rounded-2xl rounded-es-md bg-muted px-3.5 py-2.5">
              <span className="text-base text-foreground">
                How do I switch the theme at runtime?
              </span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-row-reverse items-end justify-start gap-2">
          <div className="flex max-w-[85%] flex-col items-end gap-1">
            <div className="rounded-2xl rounded-ee-md bg-primary px-3.5 py-2.5">
              <span className="text-base text-primary-foreground">
                Call setTheme from useThemeMode.
              </span>
            </div>
            <span className="text-xs text-muted-foreground">Just now</span>
          </div>
        </div>
      </div>

      <div className="flex flex-row items-center gap-2 border-t border-border p-3">
        <span className="flex h-10 flex-1 flex-row items-center rounded-full border border-input bg-background px-4">
          <span className="text-[14px] text-muted-foreground">Ask anything…</span>
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary">
          <SendHorizontalIcon className="size-4 text-primary-foreground" />
        </span>
      </div>
    </Card>
  );
}

/** Calendar — a month of days, with one picked and the neighbours dimmed. */
export function CalendarCard() {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  /* July 2026 starts on a Wednesday, so the grid opens on three days of June
     and closes on eight of August — both drawn, both muted. */
  const days = [
    ...[28, 29, 30].map((d) => ({ day: d, outside: true })),
    ...Array.from({ length: 31 }, (_, i) => ({ day: i + 1, outside: false })),
    ...Array.from({ length: 8 }, (_, i) => ({ day: i + 1, outside: true })),
  ];

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-row items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">
          <ChevronLeftIcon className="size-4 text-muted-foreground" />
        </span>
        <span className="text-base font-semibold text-foreground">July 2026</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </span>
      </div>

      <div className="grid grid-cols-7">
        {weekdays.map((weekday) => (
          <span key={weekday} className="py-1 text-center text-xs text-muted-foreground">
            {weekday}
          </span>
        ))}
        {days.map(({ day, outside }, index) => (
          <span key={index} className="flex items-center justify-center py-1">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-sm',
                day === 29 && !outside
                  ? 'bg-primary font-medium text-primary-foreground'
                  : outside
                    ? 'text-muted-foreground/56'
                    : 'text-foreground'
              )}
            >
              {day}
            </span>
          </span>
        ))}
      </div>

      <span className="text-center text-sm text-muted-foreground">Wed Jul 29 2026</span>
    </Card>
  );
}

/** Tabs — the segmented variant: a raised chip travelling in a recessed track. */
export function TabsCard() {
  const tabs = ['Overview', 'Activity', 'Files'];

  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-row rounded-lg bg-muted p-1">
        {tabs.map((tab, index) => (
          <span
            key={tab}
            className={cn(
              'flex flex-1 items-center justify-center rounded-md py-1.5 text-sm',
              index === 0 ? 'bg-popover text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="flex flex-row items-center gap-3">
        <div className="flex flex-row">
          {['KA', 'ML', 'JR'].map((initials, index) => (
            <Avatar key={initials} initials={initials} className={index > 0 ? '-ms-2' : undefined} />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">and 12 others</span>
      </div>
      <div className="flex flex-row gap-2">
        <Button size="sm" variant="outline" className="flex-1">
          Share
        </Button>
        <Button size="sm" className="flex-1">
          Publish
        </Button>
      </div>
    </Card>
  );
}

/** Timeline — the rail of discs, with a connector running between them. */
export function TimelineCard() {
  const events = [
    { title: 'Opened the pull request', meta: '2h ago', done: true },
    { title: 'Review requested', meta: '1h ago', done: true },
    { title: 'Checks passed', meta: '24m ago', done: true },
    { title: 'Merge', meta: 'Waiting', done: false },
  ];

  return (
    <Card className="gap-0 p-5">
      <span className="pb-4 text-sm font-medium text-muted-foreground">Release 0.57.0</span>
      {events.map(({ title, meta, done }, index) => (
        <div key={title} className="flex w-full flex-row gap-3">
          <div className="flex items-center">
            <div className="flex flex-col items-center self-stretch">
              <span className={cn('h-4 w-4 rounded-full', done ? 'bg-primary' : 'bg-muted')} />
              {index < events.length - 1 ? (
                <span className="w-0.5 flex-1 rounded-full bg-border" />
              ) : null}
            </div>
          </div>
          <div className={cn('flex flex-1 flex-col', index < events.length - 1 && 'pb-5')}>
            <span className="text-sm font-medium text-foreground">{title}</span>
            <span className="text-xs text-muted-foreground">{meta}</span>
          </div>
        </div>
      ))}
    </Card>
  );
}

/** Table — the header row, four body rows and a numeric column. */
export function TableCard() {
  const rows = [
    ['Button', 'Stable', '12.4k'],
    ['BottomSheet', 'Stable', '9.1k'],
    ['ColorPicker', 'Stable', '4.8k'],
    ['Flow', 'Alpha', '1.2k'],
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Most used" />
      <div className="flex flex-col">
        <div className="flex flex-row items-center gap-3 border-b border-border px-5 py-2">
          <span className="flex-1 text-xs font-medium text-muted-foreground">Component</span>
          <span className="w-16 text-xs font-medium text-muted-foreground">State</span>
          <span className="w-12 text-end text-xs font-medium text-muted-foreground">Adds</span>
        </div>
        {rows.map(([name, state, adds]) => (
          <div
            key={name}
            className="flex flex-row items-center gap-3 border-b border-border px-5 py-2.5 last:border-b-0"
          >
            <span className="flex-1 truncate text-sm text-foreground">{name}</span>
            <span className="w-16">
              <Badge variant={state === 'Alpha' ? 'warning' : 'success'}>{state}</Badge>
            </span>
            <span className="w-12 text-end text-sm tabular-nums text-muted-foreground">{adds}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
