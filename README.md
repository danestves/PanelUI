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
  <a href="https://github.com/panel-ui/PanelUI/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT license" /></a>
  <img src="https://img.shields.io/badge/platforms-iOS%20%7C%20Android-black?style=flat-square" alt="Platforms" />
  <img src="https://img.shields.io/badge/Expo-SDK%2057%2B-000?style=flat-square&logo=expo" alt="Expo SDK 57+" />
</p>

---

**PanelUI** brings compound-component APIs and a coherent visual language to React Native — built for Expo from day one and engineered for performance:

- ⚡ **Uniwind (Tailwind v4)** — the fastest Tailwind bindings for React Native. No Babel transform, ~2.4–3× faster styling than NativeWind.
- 🧵 **UI-thread animations** — every animation (press feedback, switches, sheets, dialogs, tabs) runs on the UI thread with Reanimated 4. No JS-thread jank.
- 🎨 **Semantic design tokens** — one colour system (`background`, `primary`, `muted`, `destructive`, …) in light and dark, resolved to static values for native.
- 🌗 **Native dark mode** — theme switching handled by Uniwind at the native level, without re-rendering your tree.
- ♿ **Accessible** — proper `accessibilityRole` and state wiring on every interactive component.
- 📦 **Tree-shakeable, typed, zero native code** — pure TypeScript, works in Expo Go.

## Install

Needs an Expo SDK 57+ app and Node 20+. No `prebuild`, no Xcode, no Android Studio — PanelUI has
no native modules, so it runs in Expo Go.

```bash
npx expo install panelui-native uniwind tailwindcss @react-native-masked-view/masked-view expo-linear-gradient react-native-gesture-handler react-native-reanimated react-native-safe-area-context react-native-svg react-native-worklets
```

Then three files: [Metro config, CSS entry, provider](#installation) — or follow the
**[full walkthrough](https://panelui.dev/docs/installation)**, which explains where each file goes
and lists a fix for every error people hit.

Or copy a single component's source into your project, to own and edit it:

```bash
npx panelui-cli@latest init
npx panelui-cli@latest add button
```

Both are supported, and you can mix them. See [the docs](https://panelui.dev/docs/cli).

## Components

| | | |
| --- | --- | --- |
| Accordion | Frame | ScrollText |
| Alert | HeatmapChart | SectionRail |
| AreaChart | Input | Select |
| Attachment | InputGroup | Separator |
| Avatar | Item | Shimmer |
| Badge | Label | Signature |
| BarChart | LineChart | Skeleton |
| BottomSheet | Loader | Slider |
| Breadcrumb | Map | Soundwave |
| Button | Marker | Spinner |
| Calendar | Menu | Steps |
| Card | Message | Surface |
| Carousel | MessageScroller | Switch |
| Checkbox | NumberInput | Table |
| Chip | OtpInput | Tabs |
| DatePicker | Popover | ThinkingOrb |
| Dialog | Progress | Timeline |
| Direction | RadioGroup | Toast |
| EmptyState | Rating | ToggleButton |
| Field | RingChart | Tooltip |
| Flow | ScrollCanvas | Typography |
| Form | ScrollFade |  |

`Select` shows its options in a bottom sheet, expanded in place, or floating
over the page — one `presentation` prop, because which is right depends on what
surrounds the trigger rather than on what the options are. Past a couple of
dozen options, `searchable` puts a filter above the list.
`Table` keeps rows and columns lined up in a runtime that has no table layout:
a stack of flex rows dividing their width the same way, with the hairlines, the
muted header and footer bands, the striping and a sort arrow that turns over
rather than being swapped.
`Menu` is the list of things you can do to something — rows that are verbs
rather than values, carrying their own roles, their dismiss-on-select rule and
a destructive tint. Submenus expand in place rather than flying out sideways,
because a finger has no path across to a second panel.
`Tooltip` is a small inverted label that names the control under your finger:
a long press reveals it, it points at its trigger, and it hides itself after a
beat rather than waiting to be dismissed.
`Dialog`, `BottomSheet`, `Popover` and `Select` each own the Android hardware
back button while they are open, closing themselves instead of letting the
press pop the screen behind them.
`Frame` is a widget shell: a card of rows sitting in a tray, with the strip of
tray left showing above it carrying the title.
`InputGroup` measures its prefix/suffix and pads the input to match.
`OtpInput` spreads a one-time code across a cell per digit, over a single
hidden field so the keyboard, SMS autofill and paste all still behave.
`ScrollText` and `ScrollCanvas` scrub a reveal off the scroll position,
`ThinkingOrb` says which kind of busy an agent is rather than just that it is,
and `Soundwave` draws the level of a voice — capsules, metering bars, a
travelling wave or an ambient glow — from a number your recorder already has.
`Direction` flips a subtree right to left without restarting the app.
`Flow` is a canvas of nodes joined by edges that you pan, pinch and rearrange
with a finger — positions live in a shared value, so dragging a node re-routes
every edge attached to it without React rendering once.
`Signature` captures a signature drawn with a finger and hands it back as SVG,
a data URI, or a file.
`Rating` is a row of stars you read or set — drag to pick a value, `precision`
to allow half stars, and any fractional value renders as a partial fill.
`Map` draws its basemap from your theme tokens, so a map matches the app it is
in rather than the tile server it came from.
`Loader` is nine loading animations behind one `variant` prop — dots, bars, a
morphing ring and a ball bouncing along a row of them — all on the UI thread,
and all drawing in the foreground of whatever surface they land on.
The four charts share their scales and path building, so a line and an area
drawn from the same data lie exactly on top of each other. `LineChart` is
change over time, `AreaChart` is what a total is made of, `BarChart` compares
categories by length, and `RingChart` measures each ring against its own
target rather than against the others.

Plus primitives: `PanelUIProvider`, `Portal`, `AnimatedPressable`, `useTheme`,
`useThemeMode`, `useToast`, `cn`.

## Installation

After the [install command above](#install), three files. Full walkthrough with troubleshooting:
[panelui.dev/docs/installation](https://panelui.dev/docs/installation).

### 1. `metro.config.js`

**In the root of your project, next to `package.json`** — not in `app/`, not in `src/`. A Metro
config anywhere else is silently ignored and none of your classes will do anything. A fresh Expo
app has no such file; `npx expo customize metro.config.js` writes one.

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './uniwind-types.d.ts',
  // Only needed to switch to the Moon or Grass themes at runtime.
  extraThemes: ['moon', 'moon-dark', 'grass', 'grass-dark'],
});
```

`cssEntryFile` and `dtsFile` are relative to this file. `./src/global.css` is where
`create-expo-app` puts the CSS — if yours is at the project root, change it to `'./global.css'`.
Nothing validates the path: name a file that does not exist and Metro still bundles, while not one
class resolves — a blank screen and `Uniwind - We couldn't find your variable --color-background`.

In a monorepo this file belongs in the app's own folder, with `watchFolders` pointing at the
workspace root — see [`apps/example/metro.config.js`](apps/example/metro.config.js).

### 2. `global.css`

**Look for this file before you create one** — an app made by `create-expo-app` already has
`src/global.css`. Add these lines at the top of it and leave the rest below; a second CSS file at
the project root gives you two entries, only one of which is compiled.

```css
/* src/global.css */
@import 'tailwindcss';
@import 'uniwind';
@import 'panelui-native/theme.css';

@source '../node_modules/panelui-native/src';
```

`@source` is relative to **the CSS file**, and has to land on `node_modules/panelui-native/src` —
hence the `../` above, from `src/`. From `src/styles/global.css` it is `'../../node_modules/…'`.
Get it wrong and your own classes work while PanelUI's components come out unstyled.

### 3. The entry file

Import the CSS at the top, and wrap the app in the provider. The default template uses Expo Router
with routes under `src/`, so there is usually no `App.tsx` — the entry is `src/app/_layout.tsx`,
which already returns a navigation `ThemeProvider` to wrap rather than replace:

```tsx
// src/app/_layout.tsx
import '../global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { PanelUIProvider } from 'panelui-native';

import AppTabs from '@/components/app-tabs';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <PanelUIProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppTabs />
      </ThemeProvider>
    </PanelUIProvider>
  );
}
```

`PanelUIProvider` owns the gesture root, the themed page background, the portal host used by
overlays, and the toast viewport. One at the root is enough. No `babel.config.js` is needed —
Expo's default preset already wires the worklets plugin Reanimated needs.

Then `npx expo start --clear`. Metro reads all three of `metro.config.js`, `global.css` and
`extraThemes` once at startup, so restart the dev server after changing any of them; `--clear` on a
running one is not enough.

## Usage

```tsx
import { Button, Card, Dialog, Input, useTheme } from 'panelui-native';

function Example() {
  const { theme, setTheme } = useTheme();

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

Every component accepts `className`, so you can restyle anything with Tailwind classes:

```tsx
<Button className="w-full rounded-full" labelClassName="uppercase">
  Continue
</Button>
```

### Buttons

`Button` supports icon slots, a `loading` state (renders a variant-matched
spinner and blocks presses), and `fullWidth`:

```tsx
<Button loading={saving} startContent={<SaveIcon />} fullWidth>
  {saving ? 'Saving…' : 'Save changes'}
</Button>
```

### Progress

Determinate or indeterminate, animated on the UI thread. `value` is `0–100`:

```tsx
<Progress value={uploaded} color="success" />
<Progress indeterminate color="info" />
```

`color` is `primary | success | warning | destructive | info` and `size` is
`sm | md | lg`.

### Toasts

The toast queue lives outside React, so `toast.show()` works from anywhere —
including API clients and other non-component code:

```tsx
const { toast } = useToast();

toast.show('Link copied');
toast.show({
  variant: 'success',
  label: 'Deployment complete',
  description: 'panelui.dev is live on production.',
  actionLabel: 'View',
  onActionPress: ({ hide }) => hide(),
});
```

## Theming

Six themes ship in [`theme.css`](packages/panelui/theme.css): `light`, `dark`,
`moon`, `moon-dark`, `grass` and `grass-dark`. Each family sets its own radius scale as
well as its own palette, so switching one changes the shape of the UI too.

Uniwind only gives `light` and `dark` `prefers-color-scheme` handling — any other
theme compiles to a plain class selector and cannot adapt on its own. So each brand
ships as a light/dark pair, and `useThemeMode()` treats brand and mode as separate
axes:

```tsx
const { theme, setTheme } = useTheme();
setTheme('moon-dark');
setTheme('system'); // follow the device

const { family, mode, setFamily, toggleMode } = useThemeMode();
toggleMode();          // dark ↔ light, staying in the current brand
setFamily('grass');    // switch family, staying in the current mode
```

Named themes must be registered in `extraThemes` in your Metro config, or
`setTheme` throws "it was not registered".

Tokens are CSS variables. Override them in your own `global.css` using the same
`@variant` shape the library uses — Uniwind does not support the web's
`:root` / `.dark` pattern:

```css
@import 'panelui-native/theme.css';

@layer theme {
  :root {
    @variant light {
      --color-primary: #4f46e5;
    }
    @variant dark {
      --color-primary: #818cf8;
    }
  }
}
```

Every theme must define the same set of variables — Uniwind fails the build with
"All themes must have the same variables" otherwise.

## Performance principles

Every component follows the same rules:

1. Animations run on the UI thread (Reanimated 4) — never the RN `Animated` API.
2. Variant styles are computed once at module scope with `tailwind-variants`.
3. Overlays mount lazily and unmount after their exit animation.
4. Theme switches are applied natively by Uniwind without a tree re-render.

The [example app](apps/example) is an Expo Router showcase — a browsable component
gallery with a live demo per component and a theme picker, used to smoke-test every
component in all six themes before a release.

## Example app

```sh
git clone https://github.com/panel-ui/PanelUI.git
cd PanelUI
npm install
npm run example
```

Then press `i` for iOS or `a` for Android.

## Contributing

Contributions are welcome! The library lives in [`packages/panelui`](packages/panelui), the showcase app in [`apps/example`](apps/example).

```sh
npm install         # install workspace deps
npm run typecheck   # typecheck all workspaces
npm run build       # build the library with react-native-builder-bob
```

## License

[MIT](LICENSE) © Khalid Abdi
