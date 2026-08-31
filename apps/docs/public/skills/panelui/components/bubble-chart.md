# BubbleChart

Named circles on two axes, with a third quantity on their area.

```tsx
import { BubbleChart } from 'panelui-native';
// Copied into the project with the CLI instead:
// import { BubbleChart } from '@/components/ui/bubble-chart';
```

### Anatomy

```tsx
<BubbleChart>
  <BubbleChart.Grid />        {/* reference lines both ways */}
  <BubbleChart.Bubbles />     {/* the circles */}
  <BubbleChart.Labels />      {/* their names, inside them */}
  <BubbleChart.Skeleton />    {/* while status="loading" */}
  <BubbleChart.XAxis />
  <BubbleChart.YAxis />
  <BubbleChart.Legend />      {/* under the plot, instead of Labels */}
  <BubbleChart.Tooltip />     {/* the drag, and the readout */}
</BubbleChart>
```

### Parts

- `BubbleChart.Header`
- `BubbleChart.Grid` — Reference lines both ways. Both axes are quantities here, so both earn them.
- `BubbleChart.Bubbles` — The circles. Colour comes from the row unless `color` overrides every one of them.
- `BubbleChart.Labels` — The names, written inside the circles. A bubble too small to hold its own is left without one rather than given an unreadable one.
- `BubbleChart.Skeleton` — A still field of muted circles shown while `status="loading"`, dissolving as the real ones grow in.
- `BubbleChart.XAxis` — The x labels, evenly along the axis, as real text under the plot.
- `BubbleChart.YAxis` — Value labels down the side, one per grid line. Reserves its own gutter.
- `BubbleChart.Tooltip` — The touch target, the nearest-bubble selection it drives, and the readout that follows it.
- `BubbleChart.Legend` — A swatch and a name per bubble, drawn under the plot. Use it instead of `BubbleChart.Labels` when the circles are too small to carry their own names.

### Props

#### `BubbleChartProps`

Extends `ViewProps, ChartAccessibilityProps<BubbleChartDatum>`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `data` | `BubbleChartDatum[]` | **required** | The rows. One bubble each. |
| `xDataKey` | `string` | `x` | Key holding the horizontal value. |
| `yDataKey` | `string` | `y` | Key holding the vertical value. |
| `sizeKey` | `string` | — | Key holding the third quantity, mapped to each bubble's *area*. Without it every bubble is drawn at the middle of `sizeRange` and the chart is a scatter plot with names on it. |
| `labelKey` | `string` | — | Key holding the name written inside the circle. |
| `colorKey` | `string` | — | Key holding a colour for the row — either a CSS colour or a number from 1 to 5 naming a `--color-chart-*` token. Without it the ramp cycles by row. |
| `sizeRange` | `[number, number]` | — | Smallest and largest radius `sizeKey` maps onto, in points. The largest is also what the plot holds back at every edge, so raising it costs room. |
| `status` | `BubbleChartStatus` | `ready` | `loading` shows a still field of muted circles and dissolves it as the real bubbles grow in. One component throughout, rather than a spinner swapped for a chart — swapping loses the transition. Add a `BubbleChart.Skeleton` for something to stand in the plot meanwhile. |
| `aspectRatio` | `number` | `1` | Width ÷ height. `1` is the square shape a bubble field reads best in. |
| `animationDuration` | `number` | `800` | Milliseconds for the bubbles to grow in on mount. |
| `domainDuration` | `number` | `500` | Milliseconds for the axes to settle after the data changes. |
| `xDomain` | `[number, number]` | — | Fix the horizontal axis instead of deriving it. |
| `yDomain` | `[number, number]` | — | Fix the vertical axis instead of deriving it. |
| `onActivePointChange` | `(point: BubbleChartPoint \| null) => void` | — | The bubble under the finger, and `null` when it lifts. |
| `children` | `ReactNode` | — | — |

#### `BubbleChartGridProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `rows` | `number` | `5` | Horizontal rules across the plot. |
| `columns` | `number` | `5` | Vertical rules up it. Both axes are measured, so both earn lines. |
| `color` | `string` | — | Both default to five. A coarse grid draws a handful of large squares that read as blocks behind the bubbles rather than as reference lines; a finer one recedes and lets the circles be the thing on the chart. |
| `opacity` | `number` | `1` | — |

#### `BubbleChartBubblesProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `opacity` | `number` | `1` | Fill opacity. Below 1 by default so that overlapping bubbles read as denser rather than hiding each other — in a crowded corner that overlap *is* the finding, and opaque circles erase it. |
| `color` | `string` | — | One colour for every bubble, overriding the per-row ramp. |

#### `BubbleChartSkeletonProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `count` | `number` | — | How many placeholder circles to scatter. |
| `color` | `string` | — | — |

#### `BubbleChartLabelsProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `minRadius` | `number` | `10` | Smallest radius a bubble may have and still be given its label. Below it the name is wider than the circle it names. |
| `format` | `(point: BubbleChartPoint) => string` | — | Turn a bubble into its label. Defaults to the value at `labelKey`. |
| `className` | `string` | — | — |

#### `BubbleChartXAxisProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `ticks` | `number` | — | How many intervals to divide the axis into. Yields `ticks + 1` labels. |
| `format` | `(value: number) => string` | — | Turn a value into its label. Defaults to a compact number. |
| `className` | `string` | — | — |

#### `BubbleChartYAxisProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `ticks` | `number` | — | How many intervals to divide the axis into. Yields `ticks + 1` labels. |
| `format` | `(value: number) => string` | — | Turn a value into its label. Defaults to a compact number. |
| `className` | `string` | — | — |

#### `BubbleChartTooltipProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `showLabel` | `boolean` | `true` | Float a small readout beside the selected bubble. On by default. |
| `formatX` | `(value: number) => string` | — | Format the x value for the readout. Defaults to a compact number. |
| `formatY` | `(value: number) => string` | — | Format the y value for the readout. Defaults to a compact number. |
| `formatSize` | `(value: number) => string` | — | Format the size value for the readout. Defaults to a compact number. |
| `hitRadius` | `number` | `22` | Floor on the touch target, for a chart whose smallest bubbles are tiny. |
| `className` | `string` | — | — |

#### `BubbleChartLegendProps`

Extends `ViewProps`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `limit` | `number` | — | Cap on how many bubbles are named. The rest are left to the readout. |

#### `BubbleChartHeaderProps`

Extends `ViewProps`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `title` | `string` | — | Small line above the value — what the chart is of. |
| `value` | `string` | — | The readout. The largest thing on the card, and the first thing read. |
| `caption` | `string` | — | One muted line under the value — what the area means, usually. |
| `children` | `ReactNode` | — | Trailing slot — a control, a badge, a range picker. |

### Example — Three quantities on one chart

Two of them are the axes and the third is the area. Say what the area means in the header — a reader who is not told has no way to work it out from the picture.

```tsx
<Frame className="w-full">
  <Frame.Header>
    <Frame.Title>Performance vs efficiency</Frame.Title>
    <Frame.Action>Drag to inspect</Frame.Action>
  </Frame.Header>
  <Frame.Panel>
    <BubbleChart
      data={TEAMS}
      xDataKey="efficiency"
      yDataKey="performance"
      sizeKey="people"
      labelKey="team"
    >
      <BubbleChart.Header value="8 teams" caption="Circle area is team size" />
      <BubbleChart.Grid />
      <BubbleChart.Bubbles />
      <BubbleChart.Labels />
      <BubbleChart.XAxis />
      <BubbleChart.YAxis />
      <BubbleChart.Tooltip />
    </BubbleChart>
  </Frame.Panel>
</Frame>
```

### Notes

### Area, not radius

`sizeKey` maps to a circle's *area*. Doubling a radius quadruples the ink, so a chart that scaled the radius would show a doubled value as four times the size and the reader would believe the picture. `sizeRange` is the smallest and largest radius the scale runs between, and the scale runs over the whole data set so one bubble's size means the same thing as another's. Its upper end is also what the plot holds back at every edge — a circle is drawn about its centre, so without that the bubble carrying the largest value is the one cropped in half.

Without a `sizeKey` every bubble is drawn at the middle of `sizeRange`, which is a scatter plot with names on it — and an honest one.

### Colour

The ramp cycles by row. Pass `colorKey` to name a colour per row: either a CSS colour, or a number from 1 to 5 selecting a `--color-chart-*` token. `BubbleChart.Bubbles` also takes a single `color` for every circle, which is what a chart with a legend usually wants.

### Selection

The readout clears the *edge* of the bubble rather than its centre, and drops below it where there is no room above — lifted by a constant it landed on the larger circles, which are exactly the ones a finger is most likely to be resting on.

A touch picks the nearest bubble whose own circle — or the `hitRadius` floor, whichever is larger — reaches the finger. Nearest rather than topmost, because where bubbles overlap the one drawn last is not the one being aimed at.

## Accessible data

The chart exposes one screen-reader summary and one semantic entry per data row; its SVG circles, axes and labels stay decorative. Set `accessibilityLabel` for the summary, `accessibilityLabelForDatum` to phrase a row in your own words, and `onAccessibilityDatumPress` to make each row activatable. Pass `accessible={false}` to drop the semantic layer entirely.

---

Full page, with every example: https://panelui.dev/docs/charts/bubble-chart
