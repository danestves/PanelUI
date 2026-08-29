const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

/*
 * No `watchFolders` and no `resolver.nodeModulesPaths`.
 *
 * Expo's Metro config has resolved monorepos on its own since SDK 52, and its
 * documentation says to delete exactly those two keys where they were set by
 * hand. Setting them here did not merely duplicate that work — it papered over
 * a second copy of every shared native package. `nodeModulesPaths` is a
 * fallback list rather than a redirect, so Metro still walked up from the
 * requesting file first: `packages/panelui/src` reached the hoisted root copy
 * of Reanimated while `apps/example` reached its own nested pin, and both went
 * into one bundle. Reanimated aborts on a second instance during module init,
 * before the LogBox exists, which is an app that closes with nothing in the
 * terminal.
 *
 * The versions themselves are held to one each by `overrides` in the root
 * package.json, and `test/single-native-copy.test.mjs` fails the build if a
 * second copy ever comes back.
 */
const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
  // Named themes must be registered here or setTheme() throws. Keep in sync
  // with PANEL_EXTRA_THEMES in panelui-native.
  extraThemes: ['moon', 'moon-dark', 'grass', 'grass-dark'],
});
