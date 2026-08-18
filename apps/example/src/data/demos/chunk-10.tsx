import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AIInput, Avatar, Badge, Button, CameraIcon, ChevronsUpDownIcon, CodeBlock, FileIcon, Frame, GlobeIcon, Item, Marker, Message, MessageScroller, MicIcon, Plan, PlusIcon, Reasoning, Response, ScatterChart, ScrollCanvas, ScrollProgress, SearchIcon, Separator, Shimmer, Skeleton, Slider, Sources, Switch, Task, Text, ThinkingOrb, Tooltip, type AIInputStatus } from "panelui-native";
import { router } from "expo-router";
import { useCSSVariable } from "uniwind";
import type { ComponentEntry } from '../component-types';

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

export /* -------------------------------------------------------------------------- */
/* Composer                                                                   */
/* -------------------------------------------------------------------------- */

function ComposerDemo({
  initial = '',
  placeholder = 'Chat with the model',
}: {
  initial?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial);

  return (
    <AIInput value={value} onValueChange={setValue} avoidKeyboard={false} onSubmit={() => setValue('')}>
      <AIInput.Field placeholder={placeholder} />
      <AIInput.Toolbar>
        <AIInput.Action label="Add to chat" icon={<PlusIcon size={20} />} />
        <AIInput.Pill label="Sonnet 4.6" detail="High" accessibilityLabel="Change model" />
        <AIInput.Spacer />
        <AIInput.Action label="Dictate" icon={<MicIcon size={18} />} />
        <AIInput.Submit />
      </AIInput.Toolbar>
    </AIInput>
  );
}

/**
 * The recording state, driven by nothing.
 *
 * With no `level` the meter animates its own plausible motion, which is the
 * point of the demo: the screen can be built and reviewed before any recorder
 * exists behind it.
 */
function RecordingDemo() {
  const [status, setStatus] = useState<AIInputStatus>('recording');

  return (
    <AIInput
      status={status}
      avoidKeyboard={false}
      onRecordCancel={() => setStatus('ready')}
      onRecordConfirm={() => setStatus('ready')}
    >
      <AIInput.Field placeholder="Chat with the model" />
      {status === 'recording' ? (
        <AIInput.Recording />
      ) : (
        <AIInput.Toolbar>
          <AIInput.Action label="Add to chat" icon={<PlusIcon size={20} />} />
          <AIInput.Spacer />
          <AIInput.Action
            label="Dictate"
            icon={<MicIcon size={18} />}
            onPress={() => setStatus('recording')}
          />
          <AIInput.Submit />
        </AIInput.Toolbar>
      )}
    </AIInput>
  );
}

/** Answering, so the trailing button offers to stop rather than to send. */
function StreamingDemo() {
  const [status, setStatus] = useState<AIInputStatus>('streaming');
  const [value, setValue] = useState(
    'Explain the difference between a bottom sheet and a drawer'
  );

  return (
    <AIInput
      value={value}
      onValueChange={setValue}
      status={status}
      avoidKeyboard={false}
      onStop={() => setStatus('ready')}
      onSubmit={() => setStatus('streaming')}
    >
      <AIInput.Field />
      <AIInput.Toolbar>
        <AIInput.Pill label="Sonnet 4.6" detail="High" accessibilityLabel="Change model" />
        <AIInput.Spacer />
        <AIInput.Submit />
      </AIInput.Toolbar>
    </AIInput>
  );
}

/* -------------------------------------------------------------------------- */
/* Full page: a chat                                                          */
/* -------------------------------------------------------------------------- */

const TURNS = [
  { from: 'them', text: 'Good evening. What are we working on?' },
  { from: 'me', text: 'A composer for the library.' },
  {
    from: 'them',
    text: 'Start with what happens when the text runs past one line — that is the part every composer gets wrong.',
  },
];

function ChatDemo() {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const [sheet, setSheet] = useState(false);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-4 pb-4 pt-6"
        keyboardDismissMode="interactive"
      >
        {TURNS.map((turn, index) => (
          <View
            key={index}
            className={
              turn.from === 'me'
                ? 'max-w-[80%] self-end rounded-2xl bg-primary px-3.5 py-2.5'
                : 'max-w-[85%] self-start rounded-2xl bg-muted px-3.5 py-2.5'
            }
          >
            <Text className={turn.from === 'me' ? 'text-primary-foreground' : undefined}>
              {turn.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View className="px-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <AIInput
          value={value}
          onValueChange={setValue}
          onSubmit={() => setValue('')}
          keyboardBottomInset={Math.max(insets.bottom, 12)}
        >
          <AIInput.Field placeholder="Chat with the model" />
          <AIInput.Toolbar>
            <AIInput.Action
              label="Add to chat"
              icon={<PlusIcon size={20} />}
              onPress={() => setSheet(true)}
            />
            <AIInput.Pill label="Sonnet 4.6" detail="High" accessibilityLabel="Change model" />
            <AIInput.Spacer />
            <AIInput.Action label="Dictate" icon={<MicIcon size={18} />} />
            <AIInput.Submit />
          </AIInput.Toolbar>
        </AIInput>
      </View>

      <AddToChatSheet open={sheet} onOpenChange={setSheet} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Full page: the sheet                                                       */
/* -------------------------------------------------------------------------- */

const TOOL_MODES = [
  { id: 'auto', label: 'Auto', description: 'The model chooses for you' },
  {
    id: 'on-demand',
    label: 'On demand',
    description: 'Load when needed. More messages, lower accuracy',
  },
  {
    id: 'always',
    label: 'Always available',
    description: 'Ready from the start. Fewer messages, better accuracy',
  },
];

const PROJECTS = [
  { id: 'library', name: 'Component library', updated: 'last week' },
  { id: 'docs', name: 'Documentation site', updated: 'last month' },
];

function AddToChatSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [project, setProject] = useState<string | null>(null);
  const [tools, setTools] = useState('auto');
  const [research, setResearch] = useState(false);
  const [web, setWeb] = useState(true);

  const toolLabel = TOOL_MODES.find((mode) => mode.id === tools)?.label ?? 'Auto';
  const projectLabel = PROJECTS.find((entry) => entry.id === project)?.name ?? 'None';

  return (
    <AIInput.Sheet open={open} onOpenChange={onOpenChange}>
      <AIInput.Sheet.Screen
        id="root"
        title="Add to chat"
        trailing={
          <Text size="lg" muted>
            All photos
          </Text>
        }
      >
        <AIInput.Sheet.Group>
          <AIInput.Sheet.Row icon={<CameraIcon size={20} />} label="Camera" onPress={() => {}} />
          <AIInput.Sheet.Row icon={<FileIcon size={20} />} label="Add files" onPress={() => {}} />
        </AIInput.Sheet.Group>

        <AIInput.Sheet.Group>
          <AIInput.Sheet.Row label="Add to project" value={projectLabel} to="project" />
          <AIInput.Sheet.Row label="Tool access" value={toolLabel} to="tools" />
        </AIInput.Sheet.Group>

        <AIInput.Sheet.Group>
          <AIInput.Sheet.Toggle
            icon={<SearchIcon size={20} />}
            label="Research"
            value={research}
            onValueChange={setResearch}
          />
          <AIInput.Sheet.Toggle
            icon={<GlobeIcon size={20} />}
            label="Web search"
            value={web}
            onValueChange={setWeb}
          />
        </AIInput.Sheet.Group>
      </AIInput.Sheet.Screen>

      <AIInput.Sheet.Screen
        id="project"
        title="Add to project"
        trailing={<AIInput.Action label="New project" icon={<PlusIcon size={20} />} />}
      >
        <AIInput.Sheet.Group>
          {PROJECTS.map((entry) => (
            <AIInput.Sheet.Row
              key={entry.id}
              label={entry.name}
              description={entry.updated}
              onPress={() => setProject(entry.id)}
              value={project === entry.id ? 'Selected' : undefined}
            />
          ))}
        </AIInput.Sheet.Group>
      </AIInput.Sheet.Screen>

      <AIInput.Sheet.Screen id="tools" title="Tool access">
        <AIInput.Sheet.Group footnote="Tools the model can reach while it answers.">
          {TOOL_MODES.map((mode) => (
            <AIInput.Sheet.Choice
              key={mode.id}
              label={mode.label}
              description={mode.description}
              selected={tools === mode.id}
              onPress={() => setTools(mode.id)}
            />
          ))}
        </AIInput.Sheet.Group>
      </AIInput.Sheet.Screen>
    </AIInput.Sheet>
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(true);

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <AddToChatSheet open={open} onOpenChange={setOpen} />
      <View className="w-full max-w-sm">
        <AIInput avoidKeyboard={false}>
          <AIInput.Field placeholder="Chat with the model" />
          <AIInput.Toolbar>
            <AIInput.Action
              label="Add to chat"
              icon={<PlusIcon size={20} />}
              onPress={() => setOpen(true)}
            />
            <AIInput.Spacer />
            <AIInput.Submit />
          </AIInput.Toolbar>
        </AIInput>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Full page: voice mode                                                      */
/* -------------------------------------------------------------------------- */

function VoiceDemo() {
  const level = useSharedValue(0);
  const [muted, setMuted] = useState(false);
  const [sheet, setSheet] = useState(false);
  const toggle = useCallback(() => setMuted((current) => !current), []);

  return (
    <>
      <AIInput.VoiceMode
        state={muted ? 'idle' : 'listening'}
        level={level}
        title={muted ? 'Muted' : 'Start chatting anytime'}
        micLabel={muted ? 'Unmute' : 'Mute'}
        onMicPress={toggle}
        // The screen is drawn edge to edge with no header, so this button is
        // the only way back out of it.
        onClose={() => router.back()}
      >
        <AIInput.Action
          label="Add to chat"
          icon={<PlusIcon size={20} />}
          onPress={() => setSheet(true)}
        />
        <AIInput.Pill
          label="Sonnet"
          indicator={<ChevronsUpDownIcon size={14} />}
          accessibilityLabel="Change model"
          onPress={() => setSheet(true)}
        />
      </AIInput.VoiceMode>
      <AddToChatSheet open={sheet} onOpenChange={setSheet} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

const ENTRIES: ComponentEntry[] = [
  {
    slug: 'ai-input',
    name: 'AIInput',
    summary: 'A prompt composer, the sheet it opens, and a screen with no field on it',
    demos: [
      { label: 'At rest', render: () => <ComposerDemo /> },
      {
        label: 'Past one line',
        render: () => (
          <ComposerDemo initial="It grows a line at a time until it reaches five of them, and then it holds that height and starts to scroll instead, which is what keeps the row of buttons on the screen." />
        ),
      },
      { label: 'While the answer arrives', render: () => <StreamingDemo /> },
      { label: 'While recording', render: () => <RecordingDemo /> },
      {
        label: 'In a chat',
        id: 'chat',
        fullPage: true,
        description: 'Docked above the keyboard, over a transcript that stays where it is.',
        render: () => <ChatDemo />,
      },
      {
        label: 'The sheet it opens',
        id: 'sheet',
        fullPage: true,
        description: 'Three screens on one sheet, each row pushing the next onto it.',
        render: () => <SheetDemo />,
      },
      {
        label: 'Voice mode',
        id: 'voice',
        fullPage: true,
        fullBleed: true,
        description: 'The screen with no field: one microphone, and a way out.',
        render: () => <VoiceDemo />,
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
  }
];
export const ENTRIES_BY_SLUG = Object.fromEntries(ENTRIES.map((entry) => [entry.slug, entry]));
