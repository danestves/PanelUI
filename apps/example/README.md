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

The versions are the ones the Expo Go client contains, recorded in `test/expo-go-client.json` by
`scripts/expo-client-versions.mjs` and checked by `test/sdk-version-parity.test.mjs`. They are
not a free choice and they are not the newest ones: Expo Go is a prebuilt binary whose native
side is compiled against exact versions, so pinning a *different* one causes the same silent
close from the other direction — and an override is invisible to `expo install --check`, which
reads what is declared.

The authority is Expo's version manifest, `https://api.expo.dev/v2/versions/latest`, which is
what `expo.dev/go` and `eas go` build from. Neither `expo/bundledNativeModules.json` nor
`templates/expo-app` is: the first says what a *development build* would compile, the second is
a starter project. Both have been taken for it here, and each was wrong by a patch — which is a
crash on a device and nothing at all on a simulator.

`test/expo-go-client.json` also records the resolved `expo` and `expo-modules-core` versions,
because those are declared as ranges and a regenerated lockfile walks them forward with nothing
to see in any diff. Refresh it deliberately:

```bash
node scripts/expo-client-versions.mjs            # report drift
node scripts/expo-client-versions.mjs --update   # record it
```

If you ever change one of those versions, reinstall from nothing:

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules package-lock.json
npm install
```

Deleting the lockfile is not enough. npm reuses a stale lockfile rather than re-resolving when
only the overrides change, *and* it reuses whatever already fills a slot in `node_modules` — so
an install over the old tree can give one workspace the new version and leave the hoisted copy
behind for everything else. Two copies, from following the fix for two copies.

**The client on a device is a build with a date.** A simulator gets whatever `expo start --go`
fetches today; a phone keeps the client installed on it. App Store Expo Go stops at SDK 54, so
for SDK 55 and later a physical iPhone runs a [sign.expo.dev](https://sign.expo.dev/) or
`eas go` build that ages in place — re-run it after upgrading anything native, or the versions
here will be right and the phone will still crash.

## After a dependency change, start with `--clear`

```bash
npm run example:go:clear
```

Metro's caches are keyed on file contents and paths, not on where a package was resolved from
last time or on the version of the Babel plugin that transformed something. So a reinstall that
moves a package leaves a cache describing a tree that no longer exists, and what comes out does
not mention caching at all:

```
Unable to resolve "react-native-safe-area-context" from expo-router
[Worklets] Mismatch between JavaScript code version and Worklets Babel plugin version (0.10.1 vs. 0.10.0)
```

The first is a path cached from before the package moved. The second is transformed output stamped
by the plugin version that was installed when it was cached. `npm run reset` clears the same
caches without starting anything, and works on Windows, which the shell one-liner it replaced did
not.

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
