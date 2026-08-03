# Changelog

Notable changes to [`panelui-native`](https://www.npmjs.com/package/panelui-native).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [semantic versioning](https://semver.org/spec/v2.0.0.html) — while the major version is
`0`, a minor bump is where new components, parts and tokens land, and a patch is a fix that leaves
the API alone.

Releases before 0.40.0 predate this file and are recorded only in the commit history.

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
