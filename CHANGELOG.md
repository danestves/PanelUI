# Changelog

Notable changes to [`panelui-native`](https://www.npmjs.com/package/panelui-native).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [semantic versioning](https://semver.org/spec/v2.0.0.html) — while the major version is
`0`, a minor bump is where new components, parts and tokens land, and a patch is a fix that leaves
the API alone.

Releases before 0.40.0 predate this file and are recorded only in the commit history.

## [0.47.0] — 2026-08-06

### Added

- **`Questionnaire`** (alpha) — one question at a time, with progress, validation and a way back.
  Where `Steps` reflects a flow the app owns, this one *owns* the flow: it holds the answers,
  decides which question is current, gates the way forward on the current one being answered, and
  hands the whole set back when it is done. For onboarding, intake, surveys, and the clarifying
  questions an agent asks before it starts work.

  Answers come back as one record keyed by question name — a string for a single-answer question,
  an array for a `multiple` one. A freeform `Questionnaire.Input` lands under the *same* name,
  because it is another answer to the same question rather than a separate field, and that is what
  makes picking a choice empty the text field and typing clear the choice without either part
  knowing the other exists.

  The root draws its own `Frame`, since a survey wants a boundary, a title strip and a footer that
  stays put while the middle changes; `frame={false}` drops it for a sheet or a card that already
  draws one. It reads its children once to sort them into that shell and to learn the full set of
  questions without mounting any of them, which is what makes a total countable and a conditional
  question skippable before it is ever reached. Pass `items` when a question is conditional — one
  that has not been reached is not mounted, so it cannot report that it exists.

  Only a **required** question blocks. `Questionnaire.Skip` therefore unblocks nothing; it
  *records* that an optional question was deliberately left out, moving its status from
  `unanswered` to `skipped` so an app can tell a skipped answer from a missing one. Demanding an
  explicit skip would trap anyone who left the button out, and a question that cannot be ignored is
  not optional. `Questionnaire.Next` and `Submit` dim while a required question is unanswered but
  stay pressable, because a disabled button says no without saying why — the look says not yet, the
  press puts the reason under the question.

  `Questionnaire.Progress` draws a bar per question by default, `variant="numbers"` counts them out
  where the reader will be sent back to a particular one, and `variant="count"` is plain text; both
  marked variants fall back to the count past eight questions, where neither is countable at a
  glance. `shortcuts` badges each answer with a letter or number, skipping disabled ones so they do
  not take a letter out of the sequence — a visual affordance only, since React Native surfaces
  hardware key events just to a focused text field.

  A horizontal drag moves between questions under the same gate as the buttons, and yields to any
  drag with vertical intent so a questionnaire inside a scroller never fights the page.

  Marked **alpha**: it is a large new compound API and the first real use will move it.

## [0.46.0] — 2026-08-05

### Added

- **`PieChart`** — one whole, divided between its parts. Composed like the rest of the family:
  `Header`, `Slices`, `Center`, `Legend` and `Skeleton`. It is the opposite claim to `RingChart`
  beside it, and the difference decides which one you want: a ring is a value against *its own*
  target and nothing has to add up, while every slice here is a share of one total, normalised
  against the sum, closing the turn.

  `innerRadius` is a share of the radius rather than a length, so `0` is a pie and anything above
  it is a donut at the same proportions whatever size it is measured at. Prefer the donut where
  there is a total worth showing, which is most of the time — the angles say roughly how the parts
  compare, and the middle says what they came to, which is the one figure a reader takes off a pie
  exactly.

  `minAngle` puts a floor under the slices too small to see. A slice worth a third of a percent is
  a hairline nobody can press, so it reads as *missing* rather than as small, and "missing" is a
  different claim from "nearly none"; the angle it borrows comes off the others in proportion.
  `padAngle` and `cornerRadius` turn the disc into separate segments, and `startAngle`/`endAngle`
  open it into a dial.

  The reveal is an unroll — one hand sweeping clockwise from the start of the dial, each slice
  drawn as far as it has reached — so the chart fills the way it would be drawn by hand. The
  loading state is one undivided band, because a placeholder split is an invented answer to the
  only question the chart is being asked, and nobody can tell an invented split from a real one
  until it changes under them.

- **`GridItem`** — bento tiles, and the grid that places them. `GridItem.Group` owns `columns`,
  `gap` and the cell shape; a tile takes `colSpan` and `rowSpan`, with `Background`, `Media`,
  `Title`, `Value`, `Description`, `Footer` and `Actions` inside it.

  The group measures itself and places its children into the first free cell each one fits in,
  scanning row by row. That is what a wrapping row of views cannot do: wrapping puts whatever did
  not fit on a *new line*, so nothing ever tucks under a tall tile and `rowSpan` would be a prop
  that quietly did nothing. The trade is that a tile's height is its cells rather than its
  content — which is the right way round for a bento, since a grid of boxes that each grew to fit
  their own text is not a grid, but it does mean the cell has to be sized from what the tallest
  tile holds.

  `GridItem.Background` is the part that separates a bento from a wall of stat cards: a sparkline,
  a wash, an oversized icon, clipped by the tile and meant to run off its edges.

- **`DateTimePicker`** — a day and a time of day, picked in one panel and carried in one `Date`.
  A date field beside a time field is two decisions the reader makes separately and then has to
  hold together, and the two halves can disagree — which is how a booking lands on the right day
  at a time that has already passed.

  It composes what already exists rather than reimplementing either half: `Calendar` above,
  `TimePicker`'s inline panel below, a hairline between them and one Done that finishes both. The
  time face is the ruler by default, because under a month grid the panel is already tall and the
  wheel is five rows of it; `layout` swaps in the other two.

  It does **not** close on the date, in any presentation including the popover — the day is half
  the value, and closing on it hides the other half at the moment it becomes relevant. A time
  picked before a day means today, since a time is not a `Date` without one and refusing to emit
  anything until both halves have been touched is a form that silently does nothing when used in
  the order it did not expect.

- **`Tabs` gains `variant="expanding"`** — a row of icon pills where only the selected one is
  open, widening to let its label out and closing again behind it. For a short row of destinations
  recognisable by their icons, where writing every label out spends the whole width on words
  nobody rereads. Give every trigger an `icon`; a closed tab has nothing else. The label is never
  unmounted, only closed over, so a screen reader still has something to read out.

- `wedgePath` and `polarPoint` join the shared chart maths: a filled slice of an annulus, closing
  on the centre for a pie and on a second arc for a donut. `arcPath` could not express it — it
  draws a line to be stroked, and a stroke is a band of even thickness with no ends of its own.

### Changed

- **Breaking: `KpiChart` is now `Kpi`**, and every `KpiChart*Props` type is `Kpi*Props`. It was
  never a chart — the number is the message, the sparkline is a footnote drawn by `LineChart`, and
  half its versions have no chart at all. Calling it one filed it with the plots and described the
  smallest part of it.

  The docs URL keeps working through a redirect. **The registry item does not**: the CLI command
  `npx panelui-cli@latest add kpi-chart` is now `add kpi`, and a redirect does not cover a fetch of
  a file under `public/`.

- **`ScatterChart`'s reveal is no longer a wipe.** The other charts sweep a clip across the plot,
  which suits a series read along the x-axis; here it handed the reader a direction the data does
  not have, when the whole claim of a scatter plot is that a point's position is its meaning. Each
  point now grows into place on its own slice of one shared clock, a little past its size and back
  to it. The selection swell went the same way — it was a hard switch, so the point under the
  finger jumped half as big again between one frame and the next.

- **`Tabs`' swipe is one continuous movement.** The panel followed a third of the finger's travel
  and then, at the moment the finger lifted, the arriving panel started afresh from a fixed third
  of a width away with none of the speed the gesture had — so it jumped exactly where it should
  have been smoothest. The panel now tracks the finger one to one, and the arriving panel picks up
  a whole panel's width from wherever the outgoing one was let go, carrying the release velocity
  into the spring. Only one panel is mounted, so it dims as it travels and the arriving one comes
  back up through the same fade, which reads as a dissolve the movement is carrying rather than as
  a hole.

- The eight charts have a **Charts** section of their own in the documentation sidebar, under
  Components. Eight consecutive entries in the middle of an alphabetical list of eighty-seven is
  where a list stops reading as a catalogue. Their URLs move with them and the old ones redirect.

### Fixed

- **`Combobox`** drew typed text below the middle of its field. The input asked for `text-base`,
  which sets a 16px size and a 24px line height together, and the extra leading lands above the
  glyphs — so inside the slot's fixed-height box the text and the placeholder sat a few points
  under the chips they share the row with. It is a length now, as every `Input` size already was.

- **`ScatterChart`'s loading state only ever animated once.** The reveal's guard was latched on the
  first pass and never cleared, so a chart sent back to `loading` came back with no animation at
  all. The placeholder field was also cut at the frame the data landed, leaving the plot briefly
  empty; it now dissolves as the real points grow in.

- **The templates could not be started where they are written.** Run from inside the checkout, a
  template resolves past its own `node_modules` and up into the monorepo's, so the Worklets Babel
  plugin came from one install and the Worklets runtime from another and the app died on the first
  import with the two reporting different versions of themselves — followed by every route
  reporting as missing a default export, which is the same failure one step downstream. Neither
  message names the cause, so each template's `metro.config.js` now refuses to start from in there
  and points at `npm run template`. Inert for a generated project, which is never inside this
  repository.

### Docs

- Both component lists are alphabetical again, and neither is ordered by hand any more. The docs
  sidebar sorts on the name it prints, and the example app derives its catalogue from its array —
  a new component was always appended rather than inserted, which is how the charts collected under
  L and `Item` ended up after `OtpInput`.

- The scrollable **`BottomSheet`** version says which version it is. Every version of that sheet
  looks much the same once open, and this one's heading read only "Choose a country".

## [0.45.0] — 2026-08-05

### Added

- **`ScatterChart`** — two quantities plotted against each other, to show how they relate.
  Composed like the rest of the family: `Grid`, `Points`, `XAxis`, `YAxis`, `Tooltip`, `Legend`,
  `Skeleton` and `Header`. It is the one chart here that *measures* its x rather than spacing
  points evenly by position, because a scatter plot's whole claim is that both coordinates are
  quantities — so `xDataKey` must point at a number, and both domains tween when the data
  changes.

  Touching the plot selects the nearest point by distance, resolved on the UI thread and only
  within a hit radius sized for a fingertip rather than for the dot — so a touch in an empty
  corner selects nothing instead of lighting up whichever point is least far away. Give `Points`
  a `sizeKey` for a bubble chart; the value maps to each point's **area**, not its radius, since
  mapping to the radius makes a point holding twice the value carry four times the ink.

  Neither axis is floored at zero, unlike `AreaChart`'s. A scatter plot's subject is the spread,
  and forcing a cluster of values between 80 and 90 to share a frame with zero squashes it into
  a corner and hides the thing being plotted. Pass `xDomain`/`yDomain` when a fixed frame matters
  more.

- **`LineChart.YAxis`** — value labels down the side, one per grid line, as `AreaChart` and
  `BarChart` already had. The chart's own documentation already told readers to match `Grid`'s
  `rows` to `YAxis`'s `ticks`; the part it described did not exist until now. Like the others it
  reserves its label gutter before the plot is laid out, and its labels read the settled domain
  rather than the tweening one — a number counting through every intermediate value while the
  axis animates is noise.

- `xAt` joins the shared chart maths: a value's x on a measured axis. The counterpart to `xOf`,
  which spreads points evenly by position, and not a replacement for it.

### Docs

- The README's component count had drifted (81, against 83 shipped) and its data-visualisation
  list was missing `KpiChart` and `RadarChart`. Both corrected, alongside the new chart.

## [0.44.0] — 2026-08-05

### Changed

- **Breaking:** `Card.Wash` and the `CardWashProps` type are removed. The wash was the only part
  of `Card` that did any work — a shared value, a repeating opacity animation, a resolved theme
  token and a ten-stop gradient — and reaching the gradient meant importing `expo-linear-gradient`
  at module scope. That made a native module mandatory for everyone who renders a `Card`, when
  only the wash ever used it, and a client built without that module hands JavaScript an undefined
  native view which native code then dereferences rather than raising anything catchable. `Card`
  is now six plain views and its registry item declares no dependencies at all, where it
  previously pulled in three. A card that wants a decorative backing layer composes one as its
  first child, inside a root that clips.

### Fixed

- The project templates declare `expo-linear-gradient` and `@react-native-masked-view/masked-view`.
  Both are non-optional peers of the library — the first is still reached by `Shimmer`,
  `ColorPicker`, `Post`, `Panelside`, `Soundwave`, `ScrollFade` and `TextAnimation`, the second by
  `Shimmer` and `ColorPicker` — but neither template listed them. npm installs a missing required
  peer on its own, so nothing failed locally; the versions were simply left to whatever `latest`
  resolved to and stayed invisible to `expo install --check`. Under a client that does not
  auto-install peers there was no native module at all. Both are now pinned to their SDK 57
  versions alongside the rest.
- The starter's component gallery composed `Alert` and `Accordion` against an anatomy they do not
  have, and both showed on screen. `Alert`'s root is a flex row and `Alert.Content` is the flex-1
  wrapper inside it; the gallery put a bare `Text` in the row, so nothing constrained the line and
  it ran past the padding on the right. `Accordion.Trigger` draws no chevron of its own — that is
  `Accordion.Indicator`, a part the caller places, and the trigger is laid out `justify-between` to
  receive it — so a bare string gave a row that opened and closed with nothing saying it could.

## [0.43.0] — 2026-08-04

### Added

- `KpiChart` — the metric card, which until now existed only as a private helper in the example
  app. A number is the message and the chart under it is the footnote, so the parts are sized and
  ordered around that: `Header`, `Icon`, `Title`, `Actions`, `Stat`, `Value`, `Trend`, `Chart`,
  `Progress`, `Footer`, `Separator`, and a `Group` that lays several out as one panel. `Trend`
  takes a signed number rather than a written string, and `goodDirection` says which way the good
  news is — a fall in churn, refunds or latency is what you want, so it is drawn as what you want.
  Colour comes from the meaning rather than the sign, which is the thing a caller keeping a red
  and a minus in step by hand always eventually gets wrong.
- `RadarChart` — several measures of one thing, drawn as one shape. It answers a question a bar
  chart cannot: not which of these is biggest but what shape is this. `Header`, `Grid`, `Axis`,
  `Series` and `Legend`, on the same root as the other charts here. The reveal grows the polygons
  out of the centre, because a polar chart has no left-hand edge for the usual sweep to start
  from, and it scales the values rather than transforming the group so the stroke does not grow
  with the shape. Changing the data makes the outline travel to the new profile a vertex at a
  time, which is what says which axes moved and by how much.
- `ColorPicker.Wheel`, an alternative to `.Area`: hue is the angle and saturation the radius. It
  reads the same channels, so a picker is a wheel *instead of* a square rather than as well as
  one — but a wheel spends both dimensions on hue and saturation, so `ColorPicker.Brightness`
  comes with it. Also `ColorPicker.Field`, the strip that names the colour and prints it, and
  `ColorPicker.Channel`, the readout that names the track under it. Both build their text on the
  UI thread and only cross to JavaScript when the rounded string changes.
- `Tabs` takes `swipeable`, so a horizontal drag on the panel moves between tabs. Off by default,
  because a panel is allowed to contain a carousel or a slider and two horizontal recognisers in
  one tree cannot both win. The arriving panel starts on the side it is arriving from and springs
  in; a tab changed by pressing a trigger moves the same way, since a swipe and a press producing
  different animations would read as two features.
- `SectionRail.Content` takes `maxWidth`, for a screen whose section titles are long enough that
  two lines is not enough either.
- `polarPoint` and `radarPath` join the exported chart maths, both on the same turn convention as
  `arcPath`.

### Changed

- **Moon is a different theme.** It was a second neutral — white or pure black, a bright blue
  accent, and a radius scale tight enough to read as unrounded — which sat too close to the
  default family to be worth choosing. The dark half now runs on a near-black canvas with
  elevation carried by a ladder of four barely-separated surfaces and opaque hairlines instead of
  shadow, under a lavender accent; the light half is derived from the same palette so the pair
  stays one family. The shape scale opens out at the top rather than tightening, because a badge
  looks much the same in any family and a sheet does not. **If you were relying on Moon's old
  colours, this will change how your app looks.**
- `Menu` draws its tick, radio dot and submenu chevron from `lucide-react-native`, which is now a
  dependency. Both sets are on the same geometry, so nothing moves; what changes is that the set
  is complete, so an app can keep one icon vocabulary instead of falling off ours the first time
  it needs a glyph we never drew.
- The ColorPicker thumbs lose a point of ring and the tracks gain four points of height, so a knob
  sits in its track rather than over a hairline.

### Fixed

- `Combobox` in `mode="multiple"`: the chips sat high against the input, because a `Chip` is
  `self-start` by default and that overrode the row's centring; and the input's own text sat
  differently again, because it had vertical padding rather than a height and Android does not
  centre a single-line input on its own.
- A `Combobox` list could take two taps to answer. Which side it opened on was recomputed from its
  measured height on every layout, and that height changes — it is 0 on the frame it opens, and
  picking an option in multiple mode clears the query and re-expands the list, so a finger already
  on its way down landed where the option used to be. The side is now decided once. Separately,
  the full-window dismiss catcher covered the field that opened the list, so a tap on the input or
  the chevron was spent dismissing; it is now the four strips around the field.
- `SectionRail` cropped its section titles. The panel was capped at 60% of the screen with every
  row on one line, and a row spends at least 40pt on indent and padding before any text. The cap
  is now 78% with a 200pt floor, and a row wraps to two lines before it truncates. The row indent
  also moves from `paddingLeft` to `paddingStart`, so it falls on the same side as the bar it
  belongs to under RTL.

### Docs

- A **Templates** page: `panelui-cli init` in an empty directory now writes a working Expo app —
  a theme, a native tab bar and the whole Metro pipeline already wired. Linked from Installation
  and the CLI page.
- Theming gains a per-family radius table, the two CSS install shapes side by side, a complete
  theme picker, how to read a token from JavaScript, and all sixty tokens in one paste-able block.

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
