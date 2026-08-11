# Changelog

Notable changes to [`panelui-native`](https://www.npmjs.com/package/panelui-native).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [semantic versioning](https://semver.org/spec/v2.0.0.html) — while the major version is
`0`, a minor bump is where new components, parts and tokens land, and a patch is a fix that leaves
the API alone.

Releases before 0.40.0 predate this file and are recorded only in the commit history.

## [0.60.0] — 2026-08-11

### Added

- **`SelectionMode` — pick several things at once, on a screen or in a sheet.** Messages to
  archive, people to share with, colours to apply, files to move. On a screen it is a mode: the
  list is there to be read, and a long press turns it into one you can pick from. In a sheet it
  is a picker — `SelectionMode.Sheet` was opened in order to choose, so it is choosing from the
  moment it appears, with the actions in the sheet's footer.

  `SelectionMode.Item` wraps whatever you give it rather than replacing it, so one component
  holds a row of people, a grid of colours and a run of slides. `SelectionMode.Group` is the
  rounded card that holds them, with `columns` for a grid, and `indicator="ring"` draws the
  selection around a swatch instead of beside it. Ships **alpha**: the shape is right, but it
  has not been through enough lists to promise the props will not move.

- **`animation="disable-all"` on `Tabs`**, which stops the indicator, the panel strip and the
  expanding reveal together. For a screen already animating something more important, or a
  device that cannot afford them. The system's reduce-motion setting is honoured without it.

### Changed

- **A swipeable `Tabs` is a real pager.** The panels are laid out side by side in a strip as
  wide as all of them, behind a window one panel wide, and moving between tabs is that strip
  translating. The panels either side of the active one are therefore built and sized *before*
  you reach them.

  This is the fix for a long-running report of tab changes stalling with a virtualised list in
  each panel ([#28]). The cause was never the swipe: each panel was an independent sibling and
  only the active one was in the layout, so the arriving panel was mounted *and measured* during
  the transition and did its first render on the frame it became visible. A press paid the same
  cost — the swipe only put a movement next to it.

  Mounting is also sticky now: a panel that has been reached stays mounted for the life of the
  tab set, so a tab is slow at most once, with no flag set.

### Fixed

- **`Fab.Group` no longer draws over every screen you navigate to** ([#29]). It rendered through
  a portal, which mounts at the app root above the router and is only removed when the declaring
  component unmounts — and a stack keeps the screen you pushed from mounted. It was the only
  overlay here that portalled unconditionally, so it leaked even while closed. The scrim and the
  dial are now two absolutely positioned siblings in the group's own parent, so a group belongs
  to its screen and leaves with it. Write one in the screen's root container.

- **Anything in a `Fab.Group` action slot closes the dial when pressed**, not only `Fab.Action`.
  A plain `Fab` written as a child is a reasonable thing to reach for, and it used to run its
  action — navigating, usually — with the dial still standing open behind it. An open dial also
  takes the Android back button now.

- **`keepMounted` on `Tabs` does what it says.** `true` used to hide with `display: none`, which
  lays a panel out at zero size, so a virtualised list inside one rendered no rows and was
  mounted-but-unbuilt. `'measured'` kept the size but stretched the panel against the tab set's
  root, which only has a height if the tab set was given one — undocumented, so it measured zero
  too. Neither could do the thing they were reached for.

### Docs

- **Every component page is written as a guide rather than as an argument.** A user reported that
  the prose read like an assistant thinking out loud, and sent a rewrite of the Fab page to show
  the difference. All 101 intros now follow that shape — what it is for, the trade-off, the
  workaround, the alternatives — as separate statements rather than one argued paragraph. Around
  twenty pages also gained the cross-link they were missing, because "when should I use the other
  one" is the question an intro is for.

- **An alpha or beta component says so on its own page**, not only as a pill in the sidebar.
  Somebody arriving from a search result never sees the sidebar entry, and "this API is still
  moving" is not a thing to learn after building against it.

- **panelui.dev answers the questions an agent arrives asking.** A request for `Accept:
  text/markdown` at the site root returns markdown rather than plain text — the one thing that
  was keeping the site off Level 3 on agent-readiness checks — and the site now serves an MCP
  server card, an A2A agent card, an agent-skills index with per-artifact digests, and `auth.md`
  saying plainly that everything here is public and takes no token.

### Migration

- **A swipeable `Tabs` needs a height to lay its strip out in** — `className="flex-1"` on the tab
  set, or a fixed height — the same as any pager. Without one the strip falls back to the height
  of its tallest panel, which is right for ordinary content and not enough for a virtualised
  list. It warns in development rather than rendering nothing.

- **`keepMounted="measured"` still works and now means the same as `true`.** Every panel in a
  strip is measured already, so the distinction it drew no longer exists.

- **Write a `Fab.Group` in the screen's root container.** That parent is what `offset` is
  measured from and what the scrim covers.

[#28]: https://github.com/panel-ui/PanelUI/issues/28
[#29]: https://github.com/panel-ui/PanelUI/issues/29

## [0.59.0] — 2026-08-11

### Changed

- **`FunnelChart` is drawn as one ribbon across the card, and reads in three places.** The stack
  of full-width blocks with a row of text laid over each had two faults, and they had the same
  root. A stage's fill and the label on it resolve to the same token family, so wherever the shape
  reached under a row the text vanished into it — and the first stage of a funnel is a hundred
  percent of itself, so it always reached. And the name, the count and the conversion shared one
  line, which makes that line as wide as all three: on a phone the name was the one that gave way,
  and a reader was left with "Checkout st…" against a number.

  So the stages now divide the width between them and the shape is a single ribbon symmetrical
  about the centre line — each band as tall as its value where it starts and the next stage's
  where it ends, sides curved so consecutive bands meet flush and the run reads as one narrowing
  channel rather than a row of separate shapes. Each band is drawn concentrically, from a wide
  faint ring to a tight near-solid core, which gives the edge a falloff and leaves a low-opacity
  band for text to sit on. Stages grow out of the centre line one after another, in the order they
  happen. The readings split three ways: the count above the band, the name below it, and the
  conversion in a filled pill on the band itself — the one reading that sits over the shape, so it
  is punched out of its own background and stays legible whatever the fill is doing underneath.

- **`FunnelChart.Legend` is a row per stage.** Names down one column, numbers down another. The
  stages are a sequence and a wrapped centred line loses that — the order is only implied by the
  order the names happen to be read in, and a long one breaks across lines that no longer align.
  `layout="inline"` keeps the old arrangement where the names are short enough for it.

### Removed

- **`FunnelChart`'s `align` and `cornerRadius`.** A ribbon has no leading edge to hang off and no
  corners to turn; `edges` chooses between curved sides and straight diagonals instead.
- **`FunnelChart`'s `orientation`.** It shipped with a vertical run for one release and the layout
  was carrying the design: down the screen a stage is a row, so its count and its name compete with
  the shape for the same width, and both the shape and the names come off worse. Across the card a
  stage is a column and each reading has that column to itself.

### Migration

- `stageHeight` is now `stageSize`, and is optional — left unset the stages divide the card's
  width between them, which is what a run across a card almost always wants.
- `crossSize` is now `height`: how deep the ribbon tapers, the one measurement a set of counts
  cannot supply.
- Keep stage names short. A stage gets a column of the card's width, so five across a phone is
  about seventy points each.
- New: `layers` for the depth of the halo, `edges` for curved or straight sides, `staggerDelay`
  for the wait between one stage arriving and the next.

## [0.58.0] — 2026-08-11

### Added

- **`FunnelChart`** — where a population drained away, one step at a time. Each stage is a
  trapezoid running from its own width down to the next stage's, so the taper is continuous and
  the slope between two stages *is* the drop between them. `FunnelChart.Labels` lays a row across
  each stage rather than fitting text inside it, because the stages with the worst drop-off are
  the narrowest and neither text nor a fingertip fits in them; `minWidth` puts a floor under those
  stages so a rare outcome reads as rare rather than as absent. One hue fading down the run rather
  than a colour per stage — the stages are one quantity at successive moments, not five series.
  A `FunnelChart.Legend` replaces the labels on a compact card, and `status="loading"` draws a
  single undivided taper, since an invented drop-off is worse than none.

### Changed

- **Reduce motion is honoured by `Progress`.** The determinate fill lands on its value instead of
  springing to it, and the indeterminate bar fills the track and pulses in place instead of
  crossing it. Freezing it outright was the other option and it is the wrong one: a bar that stops
  moving reads as a bar that has hung, which is the single thing an indeterminate bar exists to
  rule out. The track also carries `busy` while indeterminate — with no value to announce, that is
  all that separated "working, length unknown" from "empty".

### Fixed

- **A `Progress` bar that turned determinate mid-fade kept the fade.** The two animated styles now
  each set every property either of them sets, so neither can strand the bar at the other's
  opacity.

## [0.57.0] — 2026-08-11

### Added

- **`QRCode`** — a string, drawn as something a camera can read. Composition is the API, as
  everywhere else here: a bare `QRCode.Canvas` is a QR code, a `QRCode.Frame` around it is the
  widget shell the charts are shown in, and a `QRCode.Trigger` with a `QRCode.Content` folds it
  away behind a button until it is wanted — a popover, or a sheet on a phone, the same way
  `ColorPicker` folds away.

  The encoder is vendored rather than installed. A component that needs an npm package to draw
  itself is one the CLI has to install on someone's behalf, and every project that copies the
  source in inherits it; QR encoding is a few hundred lines of arithmetic that has not changed
  since 2000, so it is cheaper to own. Byte mode, versions 1–40, all four correction levels, and
  UTF-8 — so a `value` can be a URL, a WiFi string, a vCard or Japanese.

  It was checked rather than eyeballed, which matters more here than usual: a QR code that is
  nearly right does not scan, and nothing about looking at one tells you which kind it is. The
  codewords and the Reed–Solomon check bytes were compared byte for byte against a reference
  implementation, and every code produced was decoded back to its input by a real decoder across
  versions 1 to 25 and all four levels. Two bugs came out of that — the finder pattern drew its
  own separator dark, and the alignment positions came out descending, which put a pattern over
  the top-left finder and left the bottom-right one off entirely.

  The whole matrix draws as a single `<Path>`. A version 10 code is three and a half thousand
  modules, and half of them dark as a `<Rect>` each is seventeen hundred native views for a
  picture that never changes.

  Two decisions worth knowing about. **The code is drawn dark-on-light whatever the theme is
  doing** — the one place in the library that ignores the tokens, because a QR code is not a
  surface but a thing a camera has to read, and inverted it is rejected outright by a good share
  of scanners. And **`QRCode.Logo` clears the modules it covers** rather than drawing over them,
  then raises the error-correction level if the one you asked for could not afford the loss; a
  logo on an `L` code is a logo on a code that has stopped working.

- **An MCP server**, as `npx panelui-cli@latest mcp`. Six tools over the same registry `add`
  installs from, so the source an agent quotes is the source you would get: project info first,
  then search, list, view, docs and the add command. `mcp init` writes it into `.mcp.json`,
  `.cursor/mcp.json` or `.vscode/mcp.json`, merging rather than replacing. No dependencies — the
  stdio transport is JSON-RPC over newline-delimited lines, which is about forty of them.

- **A skill for coding agents**, installable with `npx skills add panel-ui/PanelUI`. What an agent
  needs to not get this wrong: which of the two ways in a project uses, and therefore what an
  import should look like; the rules that are not negotiable, each with a wrong/right pair; the
  six themes and the radius scale a family brings with it. Its component list is generated from
  the same file the documentation is, because a skill naming a component that does not exist is
  worse than one naming none.

### Changed

- **The install story is one story.** The home page said `npx expo install panelui-native`, the
  installation page said that plus nine more packages on one line, and neither answered "I do not
  have an app yet". There are now two paths: **`npx create-panelui-app@latest`** for a new
  project — a new package, a thin front on the scaffolder `panelui-cli` already had, so
  `npm create`, `pnpm create`, `yarn create` and `bun create` all resolve it — and, for an
  existing one, the package followed by its peer dependencies as a separate step that explains
  what each of the nine is for and why `expo install` rather than a pinned range.

  Every command on the site now has npm, pnpm, yarn and bun forms, and the choice is remembered
  across every block and every page.

- **`panelui-cli` 0.3.0** — the `mcp` command, and an `exports` map so `create-panelui-app` can
  call the scaffolder directly rather than re-launching the CLI through `npx`.

- **The home page shows the components instead of listing them.** The section that was ninety-eight
  names in a grid is now previews of what they look like, over a picker for the three theme
  families. Those links moved somewhere better: **`/docs/components`**, a generated index grouping
  every component by the job it does.

- The web token set matches the native one. The elevation ladder (`--surface` and its two steps)
  and the tinted status fills (`-soft`, `-subtle`) exist on both sides now, so a preview can use
  the token its component uses instead of an approximation in greys.

### Fixed

- The sitemap said every one of its 130 URLs had changed on the day of the build, every build.
  A crawler uses that to decide what to look at again, and a signal that says "all of it, always"
  is one it learns to ignore — which is part of why 49 component pages were sitting in Search
  Console's "discovered, currently not indexed". It now comes from git, and gives 62 distinct
  dates instead of one.

### Docs

- **`/docs/skills`** documents the skill and the MCP server.
- Agent discovery: `Link` headers on every HTML route, `/.well-known/api-catalog`,
  `/openapi.json` describing the registry and the search endpoint, `/.well-known/mcp/server.json`,
  `Content-Signal` in robots.txt, and `Accept: text/markdown` returning any page as markdown at
  its own URL. All of it describes things that already existed and were only undiscoverable. The
  OAuth discovery documents the same report asked for are deliberately absent — PanelUI has no
  accounts, no tokens and no protected endpoints, and those files would describe an
  authentication system that does not exist.

## [0.56.0] — 2026-08-10

### Added

- **`HexChart`** — a whole broken into parts, counted out in cells. Every series holds a number of
  hexagons proportional to its share of the total, so a series worth a tenth *looks* like a tenth
  and can be confirmed as one by counting.

  That is the reason to reach for it over the `PieChart` beside it. A pie asks the reader to
  compare angles, which is the hardest quantity there is to judge by eye; this asks them to
  compare counts, which anyone can check by looking. What it gives up is the small end — every
  cell is a whole unit, so a series worth half a cell either rounds up or disappears. It is for
  shares of a few percent and up, not for a long tail.

  `shape` picks the arrangement. `grid` is reading order and fills every cell, which is the
  countable one: someone checking that the second series really is a quarter can count a row and
  multiply. `blob` grows the series out from the middle of the field instead — smallest in the
  centre, each larger one wrapped around it — which shows the shape of the split at a glance.
  Its ragged edge comes from a hash of each cell's own coordinates rather than a random number,
  so a re-render is not an animation and the same data draws the same honeycomb every time.

  Cell counts are apportioned by largest remainder, so the parts add up to the budget exactly.
  Rounding each share on its own does not: three equal parts of a hundred round to 33 each and
  leave one over, and a spare cell in a honeycomb is a cell of some colour that nothing in the
  data accounts for.

  `columns` is the one knob for how fine the grid is, `density` how much of the field a blob
  fills, and the parts are the ones every chart here has — `Header`, `Cells`, `Tooltip`, `Legend`
  and `Skeleton`. Colours come from the `--color-chart-*` tokens like every other chart.

### Changed

- **Releases are now published from CI.** A published GitHub release builds and publishes the
  package through npm's trusted publishing, so every version from this one on carries a
  provenance attestation naming the workflow and the commit it was built from. Nothing changes
  about how the package is consumed; it is verifiable now in a way it was not.

### Fixed

- **`Tour`'s card no longer warns about a fought-over opacity.** The card carried an entering
  animation and an inline opacity on the same view — the fade on the way in, and the gate holding
  the card invisible for the frame it is measured in — and Reanimated warned that a layout
  animation may overwrite a property the style also sets. Which of them won was never something
  to rely on. The animation and the placement now sit on an outer view and the measurement and
  the gate on an inner one.

### Docs

- **A new [Charts](https://panelui.dev/docs/customization/charts) page under Customization.** The
  five-colour series ramp was named in passing on the Colors page and shown in a theme block on
  the Theming page, and pulled together nowhere — so "put every chart in my app on brand" had no
  answer to link to. It covers the ramp and its ordering, which part of each chart takes a
  `colorIndex`, the two charts that are deliberately not a series ramp, the override block in the
  shape Uniwind actually requires, and the weight and fill props that separate series without
  spending another colour on them.

- **`Tour` gains a worked version for a screen taller than the screen** — the one case the
  component cannot handle by itself. Each step records where it sits during layout and
  `onStepChange` scrolls it back into view before the spotlight goes looking. The existing
  scroller example was writing pixel offsets down by hand, which is right until somebody adds a
  paragraph above one; it now measures them the same way.

- **The showcase app has an "All charts" screen**, reached from a row above the component list:
  one example of every chart on one screen, each rendered exactly as its own page renders it.
  Choosing a chart is a decision about shape, and a list of names is the one thing that cannot
  help with that.

## [0.55.0] — 2026-08-10

*Never published. Its changes first shipped in 0.56.0 above — `npm install panelui-native@0.55.0`
will not resolve.*

### Added

- **`Tour`** *(alpha)* — a walkthrough that introduces a screen one control at a time. Nothing in
  the library covered first-run guidance: an empty state explains a screen before there is
  anything on it, and a tour explains it once there is. It dims everything, cuts a hole around
  one control and puts a card beside it, then moves the hole to the next control.

  The hole is the reason to reach for it rather than for a sequence of tooltips. A caption on its
  own has to describe where to look, and "the button at the top right" is a sentence people read
  twice and still get wrong.

  A `Tour.Step` wraps the control it is about, so the two live together in the tree and a step
  whose target is deleted goes with it instead of pointing at empty space. `order` sequences the
  steps and is the author's numbering rather than the tree's, because a walkthrough usually
  crosses a header, a list and a tab bar in an order the layout knows nothing about.

  Targets are measured each time their step comes up and again when the window changes size, so
  rotating the device mid-tour re-places the spotlight rather than stranding it. A target that
  has scrolled out of view is the one case the component cannot fix by itself, so `onStepChange`
  fires with the step about to be shown and the measurement waits a frame for whatever it
  scrolls.

  `shape="circle"` squares the hole around a round control, `interactive` leaves the spotlit
  control pressable for the walkthrough that asks you to try the step, and `labels` replaces the
  card's words. It is marked alpha because the card's own composition is the part still likely to
  move.

### Changed

- **A stepper's connectors now come with its steps.** Every `Steps` in this repo carried the same
  line — `{index < items.length - 1 ? <Steps.Separator /> : null}` — because the connector was
  the author's to place and the last one was the author's to leave off. `Breadcrumb` settled that
  argument for its own separators long ago; `Steps` now follows it. The root counts the items it
  holds and each one draws the connector to the next.

  Existing code renders exactly as it did: an item holding its own `Steps.Separator` keeps it and
  gets no second one. The new `separators={false}` turns the automatic ones off for a stepper
  that wants none.

- **A step now says where it sits.** Counting the items is also what lets a screen reader reaching
  the middle of a wizard hear "Payment, step 2 of 3, completed" — the position and the state,
  which are what the circle and its fill convey to everyone else. It is announced as an
  accessibility value rather than a label, because a label there would replace the step's own
  title with its number.

## [0.54.0] — 2026-08-09

### Added

- **`TagInput`** — a field whose value is a list of tokens rather than a string. The tags are
  whatever gets typed, which is the whole distinction from `Combobox` in `multiple` mode: a
  Combobox picks from a set of options you supply, so it needs a list, a filter and a surface to
  float that list on. A tag field has none of those, so it carries none of that machinery and
  never opens a portal.

  A tag is committed by return, by any of `delimiters` (a comma by default — which is what makes
  a pasted `design, research, ops` land as three tags rather than one), or by `blurBehavior` when
  the field loses focus mid-word. Three rules can turn a tag away — `max`, a duplicate, or a
  `validate` that returned `false` — and each calls `onReject` with the reason. That callback
  exists because a tag that is silently dropped is indistinguishable from one that was never
  finished typing.

  `renderTag` hands the token back to the caller, `chipVariant` picks the resting colour,
  `showCount` puts the count against `max` under the field, and `readOnly` keeps the tags while
  taking the input and every ✕ away.

### Changed

- **A backspace on a field full of chips now marks the last one before it takes it.** In
  `Combobox` under `mode="multiple"`, and in the new `TagInput`, backspace on an empty field
  turns the last chip `destructive` and only a second backspace removes it. A held backspace
  repeats, and a field that deleted on the first one would empty itself in the time it takes to
  notice — the mark is the beat that lets you stop. Typing anything, or leaving the field, takes
  the mark off again.

  The chip is also now removed by position rather than by value, so a repeated label — which
  `allowCustomValue` makes possible — loses the one that was marked instead of both.

### Docs

- The component lists in both READMEs and the docs index had drifted a release behind. They now
  carry `CandlestickChart` and `TagInput`, and the counts are right again.

## [0.53.0] — 2026-08-09

### Added

- **`CandlestickChart`** — open, high, low and close for a period, drawn as one mark. The body
  spans open to close and is filled by direction, and the wick behind it spans the low to the
  high. Composed the way every chart here is, so the grid, the candles, the axes and the readout
  are separate children, and it takes the same drag, the same reveal and the same header.

  Three things had to differ from the charts it sits beside. **Its axis does not reach zero** — a
  bar compares lengths, so a bar cropped at the bottom is a length that lies, but a candle
  compares nothing to zero. What is being read is the distance between four numbers that sit
  close together and far from the origin, and forcing zero onto that axis turns every candle into
  a dash. **Colour is direction rather than identity**: there is one thing plotted, so the two
  colours are its two states, taken from the theme's success and destructive tokens instead of
  the chart palette. And it **draws in four paths, not four per candle**, so two hundred periods
  cost the same four animated props a frame as twenty.

- **`ContextMenu.Preview`** — the held content, lifted off the dimmed page while its actions are
  up. It is for a list, where otherwise the thing being acted on is one card among several behind
  a scrim with the panel floating over all of them. It draws the trigger's own children, so
  nothing is described twice, and it takes no touches — the actions are in the panel, and a
  second live copy of a pressable card would be a second place to press.

- **`Sortable`** — a `pinned` prop, the feature `disabled` had been standing in for and was never
  able to be. A pinned row cannot be picked up and nothing can take its place: the rows that do
  move reorder among the slots left over, so a step that has to come first still does. It is not
  a wall — a row can be carried across a pinned one, going around it rather than pushing it down.
  `disabled` keeps its own meaning, which is only that a row cannot be lifted.

### Changed

- **`ContextMenu`** — rows read verb first, glyph last, and are taller. `Menu` puts the glyph in
  front, where a column of them is what the eye runs down to find a row; a context menu is not
  read that way, since it arrives under the hand that opened it and what is being scanned is the
  words. A glyph is now painted to match its label, including the red of a destructive row, so an
  icon set that defaults to `currentColor` — which React Native will not draw at all — no longer
  has to be coloured by hand at every call site.

- **`Sortable`** — rows get out of the way at once. The swap used to be triggered by the carried
  row's middle reaching a neighbour's middle, and a row's middle starts a whole row away from its
  neighbour's, so the finger had to travel a full row before anything happened: the list sat still
  through the first row of every drag and then moved all at once. It is now the carried row's
  leading edge against the neighbour's middle, which halves that and is the more natural reading
  anyway. The spring the neighbours ride was also underdamped and is now critically damped.

- **`TimePicker`** — a picker given `minTime` or `maxTime` no longer offers times it will refuse.
  The ruler and the clock's list now hold only the times inside the span, so the end of the scale
  is the last time that can be picked and dragging to it picks it. Previously it drew the whole
  day, clamped whatever you chose, and sprang back without saying why.

### Fixed

- **`Popover`** — the width floor now reaches a panel sized to its own contents, which is the one
  case it was for. A panel given a width already knows how wide it is; `minWidth` was being
  dropped on exactly the panels that needed it, so a panel took its width from the only
  non-flexible thing in a row. A menu of a flexible label beside a fixed glyph came up as a narrow
  strip of icons with the words squeezed out of it entirely.

- **`Popover`** — a panel in a sheet no longer starts under the close button. The eight points the
  sheet presentation reserved were never enough: the sheet's own padding and grabber put the first
  child 24 points down and the button's lower edge is at 44, so the top of every panel was drawn
  under it.

- **`Combobox`** — options written as literal JSX are keyed when a query narrows them. The filter
  builds a plain array, which is not the path that hands out keys, so a short fixed list — the
  ordinary way to write one — arrived unkeyed and React said so.

- **`Combobox`** — the panel no longer moves under a scrolling finger. Dragging the list dismisses
  the keyboard, the keyboard's height changing re-measures the field, and a new anchor recomputed
  both the panel's top edge and its maximum height, so the thing being scrolled resized and moved
  under the finger doing it.

- **`TimePicker`** — a refused drag puts the column back. A reported row can be bounded away or
  rounded to a different one, and when it was the value did not change, so nothing told the column
  anything had happened — it was left showing one time and holding another, and no later drag
  could put it right.

- **`TimePicker`** — a flick reports once, when it stops. It used to report twice: at the offset
  the finger left, which is a row it is in the middle of flying past, and again where it actually
  stopped. The first was committed, so the picker briefly held a time nobody chose. A correction
  arriving mid-glide could also jam the list — a programmatic scroll against a running
  deceleration fights it, and the wheel stopped dead between two rows and took no further touches.

- **`Sortable`** — dragging a long list no longer costs the square of its length. Each row worked
  out its own offset by summing the heights above it, twice, in a worklet that re-runs on every
  frame of a drag. The root derives every row's offset in one pass, and only when the arrangement
  changes.

- **`TimePicker`** — the row either side of the centre stays readable. It used to drop to just
  over half opacity and shrink by an eighth, which on a settling column reads as the digits
  smearing — and those are exactly the rows being compared against while choosing.

### Docs

- **`ColorPicker`** — the accent card version drops the block that painted the two chosen colours
  over each other; both rows already print the colour they change. The wheel version now opens
  over its row like the square does, so the two versions differ in the thing that actually differs
  between them.

- **`ContextMenu`** — the bottom-sheet example holds a list row rather than a card, which is the
  case a sheet is actually for, and carries a `Label` naming what it is acting on, since a sheet
  is nowhere near the row it came from. A new example shows the placements side by side.

## [0.52.0] — 2026-08-08

### Added

- **`ContextMenu`** — the actions that belong to a piece of content, reached by holding it. A
  `Menu` hangs off a control that exists to be opened; a context menu has no such control, so the
  target is the content itself — a message, a card, a list row.

  Its rows *are* `Menu`'s rows, the same components rather than a second set styled to match, so
  the destructive colour, the press-in scale and the dismiss-on-select rule cannot drift between
  the two ways of reaching a list of verbs. The panel is `Menu`'s, so edge-flipping, safe-area
  clamping, submenus and `presentation="bottom-sheet"` all work from the first line.

  What it adds is the two things a menu opened on content needs. The panel is anchored to the
  press point rather than to the target, because a context menu's target is often most of the
  screen and the middle of a whole message is not where the finger was — `anchor="target"` opts
  into the other behaviour for something small and list-shaped. And the hold and the tap are given
  to the gesture recogniser as alternatives, so a target that already does something when tapped
  keeps doing it and a hold never also counts as a press. Pass that tap as `onPress` on the
  trigger, not on the content inside it.

  `delay` and `slop` set how long the hold is and how far a finger may drift during it; `haptics`
  ticks as the hold is accepted, which is worth setting, because a hold has no edge you can feel
  and until the panel appears nothing says it has been long enough.

- **`Popover`** — a `scrim` prop, for a dim behind the panel without a blur. A popover leaves the
  page behind it live and so does not dim by default; a menu opened on the content itself is modal
  in practice, and the dim is what says so.

- **`Popover`** — `usePopoverAnchor`, for building a trigger that opens the panel on something
  other than a press, or anchors it somewhere other than its own bounds. It is how `ContextMenu`
  borrows the placing, flipping and clamping instead of owning a second copy of them.

### Fixed

- **`Tabs`** — `keepMounted` now has a setting that helps a panel whose content sizes itself.
  Hiding a kept panel with `display: none` also takes it out of layout, so it is mounted at zero
  size: a virtualised list inside one asks its parent how tall it is, is told nothing, and renders
  no rows. Its first real render still landed on the frame the tab became visible — the stall the
  flag looks like it should have removed, and the reason switching cost the same with it on or off.

  `keepMounted="measured"` keeps a hidden panel laid out at the full size of the tab set, hiding it
  by not drawing it rather than by removing it from layout. A list inside it measures, renders and
  settles while still hidden, so becoming visible costs nothing.

  It is a third setting rather than a redefinition, and it is off by default, because the trade is
  real: every kept panel lays out and draws, so a five-tab set builds five panels of rows to show
  one. Reach for it when a panel is slow to appear *and* its content measures itself.

### Docs

- **`Tabs`** — the `swipeable` notes sent a reader with an expensive panel to `keepMounted`, which
  was the one thing that could not fix it. They now say which setting actually keeps a panel's
  content built.

## [0.51.1] — 2026-08-07

0.50.0 was tagged but never reached npm, so upgrading from 0.49.0 brings **Sortable** with it —
see the entry below this one for what it is.

### Fixed

- **`Sortable`** — a row being carried is no longer see-through. It is drawn over the rows it is
  passing, and the row itself is only a box around whatever you put inside it; anything without a
  background of its own — an outlined `Item`, a bare `View` — left the rest of the list readable
  straight through the middle of it. A lifted row now takes an opaque surface and a shadow, and
  `activeClassName` replaces them.

- **`Sortable`** — the drop is one movement rather than two. The lift used to be released only
  once the landing spring had finished, so the row arrived at full size and then shrank; it now
  comes loose and settles back on a single value driven from the gesture, which starts returning
  the moment the finger leaves.

- **`Sortable`** — a dropped row no longer slides twice. Applying the reorder moves the rows in
  the tree and drops every offset to zero on the same commit, and the spring on those offsets sent
  the row that had just landed back across the distance it had travelled, in a slot it was already
  sitting in. Offsets are only animated while a drag is in flight.

- **`Sortable`** — an interrupted landing spring used to leave the row lifted for good and never
  report the drop, so `onReorder` was silently lost. It now lands whether or not the spring
  finished, and only stands aside when the row has genuinely been picked up again.

- **`Sortable`** — the handle's activation slop was four points, the tightest pan in the library.
  A list inside a scroller could not be scrolled by a finger that happened to land on a grip. It
  is now in line with everything else.

### Changed

- **`Sortable`** — the springs are split in two: quick for the rows getting out of the way, near
  critically damped for the landing, where overshoot reads as having landed in the wrong slot. The
  lift is also a little more pronounced, because a three per cent step with no shadow under it was
  not visible enough to say the row had come loose.

### Docs

- Screens and recordings for **ButtonGroup, Fab, GridItem, Kpi, MarkdownEditor, Pagination,
  Questionnaire, Tree, PieChart, RadarChart and ScatterChart**. Nine of the eleven had no preview
  at all, and none of them had one on a single example or version.

- Ten new examples, written because a recording showed something no page had an entry for and a
  caption under the wrong picture is worse than a gap: ButtonGroup's busy and disabled segments
  and its three sizes, Fab's sizes and variants, GridItem's bento and its wall of watermarks,
  Pagination at the small size, with a wider run and with a status line, and Tree selecting more
  than one.

## [0.50.0] — 2026-08-07

### Added

- **`Sortable`** — a list whose rows can be dragged into a different order. Marked **beta**: the
  parts and their props are settled, but it has not had enough use to promise they will not move.

  Nothing in the library let a person say *this one goes above that one*. `Swipe` acts on a row,
  `Tree` opens one, `Table` sorts every row at once by a column — none of them arrange a playlist,
  a set of form fields or a run of dashboard tiles, which is an order somebody chose rather than
  one derived from the data.

  The rows are never moved in the tree. Each one stays where it was laid out and is pushed around
  with a transform: the difference between where its slot sits in the order being dragged and where
  it sits in the order that was rendered. That is one subtraction per row per frame, on the UI
  thread. Reordering the children instead would put a full reconciliation of the list on every slot
  the finger crosses, which is the one thing a drag cannot afford.

  Heights are measured rather than assumed, so a list with a two-line row in it lands in the right
  slots — a fixed row height is the number that goes wrong the moment somebody adds that row. The
  dragged row moves to the first slot whose middle it has passed, walking outwards from where it
  started rather than scanning for the nearest one, because with rows of unequal height a
  nearest-slot search can hand back a slot two places away and read on screen as a skip.

  `onReorder` fires once the row has settled, not when the finger lifts: until the spring finishes
  the row is in a slot the layout knows nothing about, and re-rendering there would relayout every
  row underneath one that is still moving. By the time the callback runs the rows are already where
  the new order puts them, so the re-render that follows changes nothing on screen.

  The component never owns the order — it reports where a row was dropped and the list stays
  yours to rearrange, because only you know what an id stands for. `reorderItems` applies the same
  move to a list of whatever those ids name.

  `activation` is `handle` by default, so a row with a button, a checkbox or a link on it keeps
  working; `longPress` gives the whole row to the drag. Pass the scroller the list sits in and a
  drag carried to the edge scrolls it, with the scrolled distance added back into the row's offset
  so the row does not slide out from under the finger. `useSortableItem` tells a row of your own
  whether it is the one in the air, as a plain boolean that changes twice in a drag rather than
  once a frame.

- **`Swipe.Group`** — several rows that agree only one of them is open at a time. A row knows when
  it opens and has no way to hear that a sibling did, so a list of swipeable rows ends up with
  three of them standing open at once — a state every list on the phone with this gesture goes out
  of its way to avoid, and one that previously had to be fixed by holding a ref to every row.

  Rows register themselves with the group rather than being found by walking children, so a row
  nested inside anything at all still belongs: wrapped in an `Item.Group`, produced by a `map`, or
  rendered by a component of your own. Nothing re-renders — the registry is a ref and closing a
  sibling writes to that row's shared value, so opening a row still costs the springs it starts and
  no React work.

  `useSwipeGroup()` returns `closeAll`, for the cases a row cannot see either: a list that scrolls,
  navigates away, or has just deleted the row that was open. `exclusive={false}` keeps the
  container and the handle while letting several rows stand open.

- **`GripVerticalIcon`** — the two columns of dots that mark a row as something to take hold of.

- **`impactKnock`** — the haptic for a thing coming loose or landing, alongside the existing
  selection tick. An impact rather than a selection because it marks a change of state rather than
  a change of value: the finger is now holding something it was not holding a moment ago.

### Docs

- The README's component count had been stale since 0.49.0 and is now 93, with the six names its
  category lists were missing: ButtonGroup, Fab, MarkdownEditor, Questionnaire, TextAnimation and
  Sortable.

## [0.49.0] — 2026-08-06

### Added

- **`ButtonGroup`** — several buttons drawn as one control: a segmented run, a split action, a
  toolbar down the side of a canvas. Nothing in the library drew a *joined* row of buttons before
  this; `ToggleButtonGroup` is a spaced run of pills that owns its own selection, and `Tabs` is
  navigation between panels.

  The buttons stay buttons. Anything a `Button` does — an icon, a badge, a loading state, a
  disabled segment, opening a `Popover` — it still does inside a group, because the group is a
  container rather than a component that takes a list of items and renders them for you. A
  list-of-items API has to grow a prop for every one of those things; this one has none of them.

  `variant` and `size` pass down through context rather than by rewriting the children, which is
  what lets a segment be a `Button` nested inside a `Popover.Trigger` — a split button — and still
  belong to the run. A segment that wants to stand out sets its own and wins, which is all
  "selected" needs to be once the shape around it is drawn. `orientation` turns the run and its
  dividers; `fullWidth` shares the row equally; `attached={false}` keeps the shared props and drops
  the shared shape.

- **`MarkdownEditor`** — a field for writing markdown, with a formatting toolbar and a rendered
  preview. Marked **beta**: the parts and their props are settled, but it has not had enough use to
  promise they will not move.

  Writing and reading are two modes rather than two panes. Side by side is a desktop layout, and it
  does not survive the trip to a phone: two columns of a phone's width are two columns too narrow
  to read, and the keyboard covers the bottom half of the screen exactly when the writer is using
  it. One pane and a switch, and the toolbar carries the switch because it is the only thing on
  screen in both modes.

  The preview is `Response` — the same reader that renders a model's answer — so markdown means one
  thing across the library and there is one parser to be right rather than two to keep in step. It
  renders through `Typography`, `CodeBlock` and `Table`, which is to say through your own type and
  colours.

  The part that matters is where the caret lands. Every toolbar action is a pure function of the
  text and the selection: pressing twice undoes it, a selection stays selected so it can be bolded
  and then italicised, and with nothing selected the caret lands between the new markers rather
  than after them. A line-level action applies to every line the selection touches and removes
  itself only when all of them already have it, because a mixed block is a block somebody is trying
  to make uniform.

- **`Fab`** — the floating action button, and the speed dial behind it. Circular or `extended`, in
  three sizes and four variants, pinned to any of three corners with `placement` and `offset`.

  `Fab.Group` with `Fab.Action` children is the dial. The actions unfold one after another rather
  than together, a few frames apart each, and every one carries its label — a column of unlabelled
  circles is a quiz. The whole dial runs off one shared value on the UI thread, so closing it
  halfway through opening runs the same value back down instead of leaving a queue of callbacks to
  fire into a closed menu. Opening drops a scrim, which is both what says the dial is modal and
  what catches the tap that closes it; the scrim and the buttons travel through the same portal, so
  the backdrop can never end up on top of the dial it is behind.

  Its documentation leads with when *not* to reach for it. A button floating over the content is a
  button covering some of it, and a corner with three buttons in it is a toolbar in the wrong
  place.

- **Nine icons** — `FolderIcon` and `FolderOpenIcon`, and `BoldIcon`, `ItalicIcon`, `HeadingIcon`,
  `ListIcon`, `ListOrderedIcon`, `QuoteIcon` and `CodeIcon` for a formatting toolbar.

- **`ColorPicker` opens from the row that reads it out.** `presentation` takes `popover` or
  `bottom-sheet` and folds the controls behind a `ColorPicker.Trigger`, drawn in a
  `ColorPicker.Content`. A picker is a page's worth of controls in service of one value that is
  looked at far more often than it is changed, so leaving the square permanently open under a
  labelled strip spends a screen on something nobody is currently using — two colours cost two
  panels. `inline` is still the default, so nothing already written changes. `ColorPicker.Field`
  gains an `onPress` and becomes a button when it has one.

- **`TimePicker` can turn its readout down.** `readout` takes `default`, `compact` or `none`. The
  `ruler` face states its time in one large centred number, which is right when the scale is the
  only thing on the panel and wrong under something that outranks it.

- **`DateTimePicker` names its time half.** `timeLabel` is the word above the face.

### Changed

- **The date now outranks the time in `DateTimePicker`.** The panel is a month grid over a time
  scale and the date is the coarse choice, but the ruler's 36pt readout stood against a month
  caption of 16 and dates of 14 — the largest text in the panel for the smaller half of the value,
  with nothing saying what the bottom half even was. The panel takes `readout="none"` and writes
  the row itself: the half's name on one edge, its current value on the other, at a size that sits
  under the date. The seam between the halves gets equal margin above and below rather than
  clinging to the calendar.

- **A folder row in `Tree` gets its own glyph.** `Tree.Icon` holds its width whether or not it has
  anything in it, which is what keeps a folder's name and a file's name starting in the same place
  — so a row that leaves it empty puts its label a whole box away from its own chevron while the
  rows around it look right. The demos and the documented snippets now fill it on every row, and
  the part's own docs say the slot is all-or-nothing.

- **`GridItem`'s watermark fits the tile.** At 112 points against a 132-point row the background
  glyph filled the tile corner to corner and competed with the number in front of it. Down to 72;
  the corner it hangs off is unchanged.

### Fixed

- **Swiping between `Tabs` no longer re-draws the whole panel every frame** ([#28]). Reported as
  jank on Android with a list in each panel, both when swiping and when pressing a trigger. Three
  causes, none of them the one in the report — `swipeable` does not mount extra panels, only
  `keepMounted` decides that.

  A panel travelling under the finger also had its opacity animated. A transform is a layer
  property and costs nothing per frame however much is inside it; an alpha that changes every frame
  is not one on Android, where the view group has no offscreen buffer, so the value is pushed down
  into the children and every visible row is re-drawn on every frame of the drag. The fade is now
  iOS-only, where the layer fades itself and it is free.

  The follow style was also applied to *every* mounted panel, so `keepMounted` ran one mapper per
  panel per frame to reposition views that are `display: none` — which meant the obvious workaround
  for a slow panel made the drag worse. It is now gated to the active one.

  And a committed swipe left the panel parked wherever the finger let go until React had mounted
  the arriving one, a stall exactly as long as the mount. The outgoing panel now carries on off the
  edge on the UI thread immediately, and the arriving one is placed relative to wherever it has got
  to, read live, so the handover stays continuous. Changing tab also no longer rebuilds the pan
  gesture, which was detaching and re-attaching the native recogniser on the busiest frame of the
  interaction.

### Docs

- The PieChart page opens with a recording of the component running, which it had neither a preview
  nor a video for before.

[#28]: https://github.com/panel-ui/PanelUI/issues/28

## [0.48.0] — 2026-08-06

### Added

- **`Tree`** — a hierarchy you can open a level at a time: a file browser, a folder of settings, a
  category picker, a table of contents. `Accordion` is the one-level version of the same idea and
  stops there, because its items cannot hold items. A tree's can, to any depth, and everything that
  follows from that is what the component owns — which node a row sits under, how far in it is
  drawn, whether it is a branch at all, and which of its ancestors are open.

  A closed branch is unmounted rather than hidden, so a tree costs what is *open* in it rather than
  what is *in* it: a folder of ten thousand files that nobody has opened costs one row. An item is
  a branch because it holds a `Tree.Group`, not because it was declared one, so there is no second
  fact to keep true — with one exception, a branch whose children have not been fetched yet, which
  has no group to be recognised by and so sets `hasChildren` to earn its chevron. The fetch itself
  hangs off `onExpandedChange`.

  Expansion and selection are separate pieces of state, because they answer separate questions —
  which parts of the hierarchy are open, and which row is the chosen one — and a tree commonly
  needs one without the other. Either can be controlled or left alone. Selection is off entirely
  until `selectionMode` is set, and hands its value back in the shape it was given, a string when
  `single` and an array when `multiple`, as `Accordion` does.

  The chevron is pressable in its own right, so it opens a branch without selecting it. That is
  what makes `expandOnPress={false}` usable: a sidebar where pressing a section navigates to it and
  only the chevron opens it. On a leaf the chevron becomes an empty box of the same size, so a
  file's name starts where a folder's name does. Parts: `Item`, `Trigger`, `Indicator`, `Icon`,
  `Label`, `Actions`, `Group`, plus `size`, `showLines` and `indent` on the root.

### Changed

- **`Accordion` — `keepMounted`, for a body worth keeping.** A closed section unmounts its body,
  which is right when the closed state should cost nothing and wrong when there is state inside it:
  a half-filled form, a list scrolled to the middle, a video part-way through. Collapsing such a
  section threw that away and reopening it started over.

  `keepMounted` hides the body from layout instead of unmounting it. That is a real distinction and
  not a cosmetic one — a hidden view takes up no room, so the item's height changes by exactly as
  much as it would have on an unmount and the same layout transition plays. The two modes are
  indistinguishable to look at, and everything inside the kept one stays alive. The hidden subtree
  is taken out of the accessibility tree too, so a screen reader does not read out a section the
  eye cannot see.

  It goes on the accordion for every section, or on a single `Accordion.Content` for the one that
  needs it; the prop on the content wins either way round. The default is unchanged.

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
