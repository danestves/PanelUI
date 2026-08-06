<p align="center">
  <img src=".github/assets/logo.png" alt="PanelUI logo" width="140" />
</p>

<h1 align="center">PanelUI</h1>

<p align="center">
  High-performance React Native components for Expo.<br />
  Semantic design tokens · Tailwind v4 via Uniwind · Reanimated on the UI thread.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/panelui-native"><img src="https://img.shields.io/npm/v/panelui-native?style=flat-square" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/panelui-native"><img src="https://img.shields.io/npm/dm/panelui-native?style=flat-square" alt="npm downloads per month" /></a>
  <a href="https://github.com/panel-ui/PanelUI/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT license" /></a>
  <img src="https://img.shields.io/badge/platforms-iOS%20%7C%20Android-black?style=flat-square" alt="Platforms: iOS and Android" />
  <img src="https://img.shields.io/badge/Expo-SDK%2057%2B-000?style=flat-square&logo=expo" alt="Expo SDK 57+" />
</p>

<p align="center">
  <a href="https://panelui.dev/docs"><b>Documentation</b></a> ·
  <a href="https://panelui.dev/docs/installation">Installation</a> ·
  <a href="https://panelui.dev/docs/components/button">Components</a> ·
  <a href="https://panelui.dev/docs/customization/theming">Theming</a> ·
  <a href="https://panelui.dev/docs/cli">CLI</a>
</p>

---

**PanelUI is an open-source React Native UI component library for Expo apps**, styled with
Tailwind CSS v4 and animated with Reanimated 4. **89 accessible, typed components** — buttons,
inputs, forms, dialogs, bottom sheets, charts, calendars, maps and a set of AI chat components —
in one coherent visual language, with light and dark themes out of the box.

Pure TypeScript with no native modules, so it runs in **Expo Go** with no `prebuild`, no Xcode and
no Android Studio.

## Why PanelUI

- ⚡ **Fast styling** — [Uniwind](https://github.com/jonlepage/uniwind) brings Tailwind v4 to React
  Native with no Babel transform, around 2.4–3× faster than the alternatives.
- 🧵 **UI-thread animations** — press feedback, switches, sheets, dialogs and tabs all run on the
  UI thread with Reanimated 4. No JS-thread jank.
- 🎨 **Semantic design tokens** — one colour system (`background`, `primary`, `muted`,
  `destructive`, …) across light and dark, precomputed to static values for native.
- 🌗 **Native dark mode** — theme switching is applied natively, without re-rendering your tree.
- ♿ **Accessible by default** — every interactive component wires up `accessibilityRole` and
  mirrors its state.
- 🧩 **Compound APIs** — `Card.Header`, `Dialog.Content`, `Table.Row` compose the way the markup
  reads.
- 📦 **Typed, tree-shakeable, zero native code** — works in Expo Go, ships full TypeScript types.

## Getting started

Needs an Expo SDK 57+ app and Node 20+.

```bash
npx expo install panelui-native uniwind tailwindcss @react-native-masked-view/masked-view expo-linear-gradient react-native-gesture-handler react-native-reanimated react-native-safe-area-context react-native-svg react-native-worklets
```

Then three files — a Metro config, a CSS entry and the provider. The
**[installation guide](https://panelui.dev/docs/installation)** walks through each one and lists a
fix for every error people hit.

### Or copy the source

`panelui-cli` copies a component's source into your project, to own and edit:

```bash
npx panelui-cli@latest init
npx panelui-cli@latest add button
```

Both approaches are supported and you can mix them. See [the CLI docs](https://panelui.dev/docs/cli).

## Usage

```tsx
import { Button, Card, Dialog, Input } from 'panelui-native';

function CreateProject() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Create project</Card.Title>
        <Card.Description>Deploy your new project in one click.</Card.Description>
      </Card.Header>
      <Card.Content className="gap-4">
        <Input label="Name" placeholder="My project" />
      </Card.Content>
      <Card.Footer>
        <Dialog>
          <Dialog.Trigger>
            <Button>Deploy</Button>
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Are you sure?</Dialog.Title>
            <Dialog.Description>This will start a deployment.</Dialog.Description>
            <Dialog.Footer>
              <Dialog.Close>
                <Button variant="ghost" size="sm">Cancel</Button>
              </Dialog.Close>
              <Dialog.Close>
                <Button size="sm">Confirm</Button>
              </Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
      </Card.Footer>
    </Card>
  );
}
```

Every component takes `className`, so anything can be restyled with Tailwind classes:

```tsx
<Button className="w-full rounded-full" labelClassName="uppercase">
  Continue
</Button>
```

## Components

**89 components**, documented with live examples and full props tables at
**[panelui.dev/docs](https://panelui.dev/docs)**.

- **Layout & content** — Card, Frame, Surface, Item, GridItem, Separator, Typography, Table,
  Timeline, Steps, Accordion, Carousel, EmptyState, Skeleton
- **Forms & inputs** — Form, Field, Input, Textarea, InputGroup, NumberInput, OtpInput, Select,
  Combobox, Checkbox, RadioGroup, Switch, Slider, Rating, Signature, ColorPicker, DatePicker,
  TimePicker, DateTimePicker, Calendar, Label
- **Actions & navigation** — Button, ToggleButton, Menu, Swipe, Tabs, Breadcrumb, Pagination,
  SectionRail, Panelside, Tree, Chip, Badge
- **Overlays & feedback** — Dialog, BottomSheet, Drawer, Popover, Tooltip, Toast, Alert,
  Progress, Spinner, Loader
- **Data visualisation** — LineChart, AreaChart, BarChart, ScatterChart, PieChart, RingChart,
  RadarChart, HeatmapChart, Kpi, Map, Marker, Flow
- **AI components** — Message, MessageScroller, Response, Reasoning, Plan, Task, Sources,
  CodeBlock, Shimmer, ThinkingOrb, Soundwave
- **Social** — Post, Avatar, Attachment
- **Scroll & motion** — ScrollFade, ScrollText, ScrollCanvas, Direction

Plus the primitives: `PanelUIProvider`, `Portal`, `AnimatedPressable`, `useTheme`, `useThemeMode`,
`useToast`, `cn`.

## Theming

Six themes ship in [`theme.css`](packages/panelui/theme.css) — `light`, `dark`, `moon`,
`moon-dark`, `grass` and `grass-dark`. Each family sets its own radius scale as well as its own
palette, so switching one changes the shape of the UI too.

```tsx
const { theme, setTheme } = useTheme();
setTheme('moon-dark');
setTheme('system'); // follow the device

const { family, mode, setFamily, toggleMode } = useThemeMode();
toggleMode();       // dark ↔ light, staying in the current brand
setFamily('grass'); // switch family, staying in the current mode
```

Tokens are CSS variables and can be overridden in your own `global.css`. See
**[Colors](https://panelui.dev/docs/customization/colors)** for the token reference and the
`@variant` shape overrides have to use, and **[Fonts](https://panelui.dev/docs/customization/fonts)**
for pointing the library at a typeface of your own.

## Example app

An Expo Router showcase with a live demo for every component and a theme picker — used to
smoke-test the whole library in all six themes before a release.

```sh
git clone https://github.com/panel-ui/PanelUI.git
cd PanelUI
npm install
npm run example
```

Then press `i` for iOS or `a` for Android.

## Contributing

Contributions are welcome. The library lives in [`packages/panelui`](packages/panelui), the
showcase in [`apps/example`](apps/example) and the documentation site in
[`apps/docs`](apps/docs).

```sh
npm install         # install workspace deps
npm run typecheck   # typecheck all workspaces
npm run build       # build the library
```

Read **[CONTRIBUTING.md](CONTRIBUTING.md)** before opening a pull request, and please follow the
**[Code of Conduct](CODE_OF_CONDUCT.md)**.

## Community

- **[Report a bug](https://github.com/panel-ui/PanelUI/issues/new?template=bug_report.yml)** or
  **[request a component](https://github.com/panel-ui/PanelUI/issues/new?template=feature_request.yml)**
- **[Ask a question](https://github.com/panel-ui/PanelUI/discussions)** in Discussions
- Star the repo if PanelUI is useful to you — it is how other people find it

## License

[MIT](LICENSE) © Khalid Abdi
