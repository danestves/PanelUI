# PanelUI example app

An Expo Router gallery of every component in the library, plus the themes, the hooks and the
blocks. Run it from the repo root:

```bash
npm run example
```

## This app needs a development build

It cannot run in Expo Go, and the reason is the `Map` component: its renderer,
`@maplibre/maplibre-react-native`, is native code and is not part of the Expo SDK. Expo Go is a
prebuilt binary containing only the modules Expo ships in it, so there is no way to load a
native module it was not built with.

Every other component in the gallery is pure JavaScript and would run in Expo Go perfectly well.
The dev build is the cost of the one that cannot.

```bash
npx expo prebuild --clean
npx expo run:ios       # or: npx expo run:android
```

After that the normal Metro workflow is unchanged — fast refresh, `npm run example`, all of it.
You only need to rebuild when a *native* dependency changes, not when you edit TypeScript.

`Map` itself degrades rather than crashing: without the renderer it draws a panel explaining
which build it needs, so a screen embedding one still loads. `hasMapLibre` is exported for
anything that wants to check before routing somewhere whose whole content is a map.

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
