# PanelUI example app

An Expo Router gallery of every component in the library, plus the themes, the hooks and the
blocks. Run it from the repo root:

```bash
npm run example
```

## Expo Go, and what it cannot show you

Most of the gallery runs in Expo Go. Start it there with:

```bash
npm run example:go     # from the repo root; then press `a` or `i`
```

`expo-dev-client` is a dependency, so a plain `expo start` opens the development build instead —
`--go` is what sends it to Expo Go.

**`Map` is the exception.** Its renderer, `@maplibre/maplibre-react-native`, is native code that
is not part of the Expo SDK, and Expo Go is a prebuilt binary containing only the modules Expo
ships in it. The Map screens draw a panel naming the build they need rather than failing; every
other screen works. `hasMapLibre` is exported for anything that wants to check before routing
somewhere whose whole content is a map.

The native `@expo/ui` controls, Liquid Glass and haptics are all in Expo Go, so `native` and
`glass` are real there too.

## A development build

For the Map screens, and for anything you want to profile on a release build:

```bash
npx expo prebuild --clean
npx expo run:ios       # or: npx expo run:android
```

After that the normal Metro workflow is unchanged — fast refresh, `npm run example`, all of it.
You only need to rebuild when a *native* dependency changes, not when you edit TypeScript.

## One copy of every native package

The workspace pins `react`, `react-native` and every shared native package in `overrides` in the
root `package.json`, and `test/single-native-copy.test.mjs` fails the build when a second copy
appears. This is not tidiness. Metro resolves from the requesting file upward, and
`packages/panelui` has no `node_modules` of its own — so the library reaches the hoisted copy
while an app with its own nested pin reaches that one, and both go into a single bundle.
Reanimated aborts on a second instance during module init, before the LogBox exists, which is an
app that closes on Android with nothing in the terminal and nothing in the Metro log.

The versions are the SDK's own, taken from `node_modules/expo/bundledNativeModules.json` and
checked against it by `test/sdk-version-parity.test.mjs`. They are not a free choice: Expo Go is a
prebuilt binary whose native side is compiled against exact versions, so pinning a *different* one
causes the same silent close from the other direction — and an override is invisible to
`expo install --check`, which reads what is declared. Copying the numbers by hand is how that
happened once already.

If you ever change one of those versions, delete `package-lock.json` before reinstalling: npm
reuses a stale lockfile rather than re-resolving when only the overrides change.

## Building with EAS

`eas.json` defines four profiles:

| Profile | What it is for |
| --- | --- |
| `development` | Dev client for the iOS **simulator**. The everyday one. |
| `development-device` | The same, for a physical device. |
| `preview` | Internal distribution, no dev client — a build to hand to someone. |
| `production` | Store build, with the build number auto-incremented. |

```bash
eas build --profile development --platform ios
```

## Map tiles

`Map` defaults to CARTO's street tiles, which are free for non-commercial use and need a licence
from CARTO for commercial use. Pass a `source` to use a different provider — any that serves the
OpenMapTiles schema will do, and the layer colours still come from your theme either way.
