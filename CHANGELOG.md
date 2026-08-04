# Changelog

Notable changes to [`panelui-native`](https://www.npmjs.com/package/panelui-native).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [semantic versioning](https://semver.org/spec/v2.0.0.html) — while the major version is
`0`, a minor bump is where new components, parts and tokens land, and a patch is a fix that leaves
the API alone.

Releases before 0.40.0 predate this file and are recorded only in the commit history.

## [0.42.0] — 2026-08-04

### Added

- `ColorPicker` — a colour chosen by dragging rather than typed: a square with saturation across
  it and brightness up it, a hue scale, an opacity scale over a checkerboard, a preview and a row
  of presets. Every part is optional and renders where you write it, so a picker with no opacity
  is one with no `ColorPicker.Alpha` in it rather than one with a prop turned off. It stores hue,
  saturation, value and alpha rather than the string it hands back, which is what keeps the thumb
  where you left it — a fully black colour is `#000` whatever produced it, so a picker that stored
  its own output would lose the thumb in the corner of the square and have nowhere to put it back.
  Nothing about a drag crosses to JavaScript: the four channels are shared values and every fill
  is computed from them on the UI thread, including the opacity ramp, which is a gradient used as
  a mask over a solid colour rather than a gradient whose colours React would have to re-declare
  on every frame.
- `Slider` takes `range` and `defaultRange`, and reports through `onRangeChange` and
  `onRangeCommit`. A range is a second pair of props rather than a tuple in the first one, so a
  one-thumb slider's handler stays `(value: number) => void` and no existing caller has to narrow
  a union to read a number out of it. `minStepsBetweenThumbs` is the gap the span can never
  close; the two thumbs bound each other rather than the track, so they meet but never cross.
- The colour maths the picker is built on is exported: `parseColor`, `formatColor`, `hsvToHex`,
  `hsvToRgb`, `rgbToHsv`, `hsvToHsl`, `hsvToCss` and `isValidColor`. Every one is a worklet, so
  they can be called from an animated style as well as from ordinary code.

### Fixed

- A controlled `Slider` fought the finger while being dragged. Each change was echoed straight
  back as a new prop, and the effect that keeps the thumb in step with an outside change sprang it
  onto that echo — so at a coarse `step` every frame pulled the knob back onto the last snapped
  value while the finger had already moved past it. The sync now stands down for the length of a
  gesture.

## [0.41.0] — 2026-08-03

### Added

- `TextAnimation` — five ways a piece of text or a number arrives: `Typing`, `Rotating`,
  `Counting`, `Sliding` and `Scrolling`. One component rather than five, because they share
  every prop that says *how*: put `duration`, `delay`, `loop` or `enabled` on the root and it
  becomes the default for everything under it. Almost none of it re-renders — `Counting` runs on
  the UI thread and crosses back only when the rounded number changes, and the two that roll
  digits never cross back at all.
- `Card.Wash` — a decorative layer for the back of a card: the tint rising from its bottom edge
  on a power curve, so the top two thirds are untouched and the colour arrives in the lower
  third. A straight fade would read as a tinted panel, which is a different thing.
- `Drawer.Content` takes `closeSide`. The close button takes the corner away from the docked
  edge, which is right for a drawer opened once and wrong for a filter panel opened all day —
  where a target always under the same thumb beats one that moves with the edge.
- `Panelside` takes `haptics`, and `scale`, `radius` and `dim` as defaults for every
  `Panelside.Scene` under it, so the three numbers that describe the curve live where the panel
  is configured. `Panelside.Scene` takes `scrimClassName`, for a dim that is not black.
- `Panelside.Cta` and `Panelside.Item` take `size`.
- `Map.Heatmap` takes `color`, `colors` and `points`.

### Fixed

- A mirrored chevron stayed mirrored after the direction flipped back. `useFlip` returned no
  transform in a left-to-right subtree, which *removes* the prop rather than setting an identity,
  and the renderer keeps the last matrix it was handed — so one toggle into RTL left every list
  row pointing at its own text, for good. Icons now write a transform on every render.
- `Map.Heatmap` ramped through `--color-chart-1`, the series colour a chart is *about*, which
  every theme starts close to the foreground: near-black in a light theme, near-white in a dark
  one. Over a basemap that is a smudge rather than a measurement. Its intensity was also
  constant, so the same points packed into fewer pixels at world zoom saturated the whole field.
- A `Pagination` run wider than its container spilled past both edges of a centred row, leaving
  the leading number half off the screen. It clips to its own bounds now, and `size="sm"` draws
  genuinely smaller targets — 32pt, with the extra `hitSlop` raised to keep the 44pt reach.
- `Panelside`'s compose pill stood a step above the account button beside it and sized the whole
  footer row with it. The default is 40pt; `size="lg"` is the old one.

### Changed

- The outward arrow and the send plane mirror in a right-to-left subtree, alongside the two
  chevrons. The vertical arrows and the asymmetric glyphs that are not directions — a pencil, a
  magnifier, a play triangle — stay as they are drawn.
- `Map` drops its two analytics screens for a street map that is the whole screen. Both put a map
  inside a dashboard, which is a chart with geography rather than a map, and they were the first
  thing anyone opening the component saw.

## [0.40.0] — 2026-08-03

### Added

- `RingChart.Header` and `HeatmapChart.Header` — the strip above the plot carrying a title, a
  readout and a key, which the bar, line and area charts already had. All five charts now
  introduce themselves the same way, and the part belongs to the chart rather than to the card
  around it: its value changes as the plot is read.
- `RingChart` takes `startAngle` and `endAngle`, in degrees clockwise from twelve o'clock. Leave
  less than a turn between them and the ring opens into a gauge, with the track and the touch
  target both stopping where the arc does.
- `RingChart.Ring` takes `segments` and `segmentGap`, breaking the ring into countable ticks —
  eight of twelve reads off ticks you can count, and off a smooth arc only as "about two thirds".
- `HeatmapChart.XAxis` takes `labels`, for a grid whose columns are not weeks. The axis emitted a
  label where the month changed, which such a grid never does; `YAxis` already had the equivalent
  for its rows.

### Fixed

- `HeatmapChart.Tooltip` reported "No data" over every cell of a grid built without dates, having
  treated a missing date as missing data and discarded the count it had already computed. A cell
  with no date is a cell in a grid that is not a calendar; it now reads as its count.
- A `RingChart` given a `size` drew its plot against the leading edge of its container instead of
  in the middle of it.

### Changed

- The `RingChart` root is two views, so a header is not measured as part of the square. A chart
  that sets no `size` is unaffected.

### Docs

- The RingChart page documents the gauge and the segmented ring, and its versions are the gauge,
  the segmented ring and a set of separate dials.
- The HeatmapChart page documents the punchcard — hours in the rows, weekdays in the columns.
