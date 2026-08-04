const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  // Generates uniwind-types.d.ts, which is what makes `setTheme` know the
  // theme names below rather than accepting any string.
  dtsFile: './uniwind-types.d.ts',
  // Only `light` and `dark` work without being listed here. Any other theme
  // throws "it was not registered" from `setTheme`, and a change to this list
  // needs the dev server restarted rather than reloaded — a running server
  // rewrites the generated CSS from the list it started with.
  extraThemes: ['moon', 'moon-dark', 'grass', 'grass-dark'],
});
