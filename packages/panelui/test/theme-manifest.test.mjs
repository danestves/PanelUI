import assert from "node:assert/strict";
import test from "node:test";

import {
  assertExactSequence,
  validateManifest,
} from "../../../scripts/theme-manifest.mjs";

test("theme parity rejects missing and extra names", () => {
  assert.throws(
    () => assertExactSequence("themes", ["light", "dark"], ["light"]),
    /missing=dark/,
  );
  assert.throws(
    () => assertExactSequence("themes", ["light"], ["light", "dark"]),
    /extra=dark/,
  );
});

test("theme parity rejects duplicates and order drift", () => {
  assert.throws(
    () => assertExactSequence("themes", ["light", "dark"], ["light", "light"]),
    /duplicates=light/,
  );
  assert.throws(
    () => assertExactSequence("themes", ["light", "dark"], ["dark", "light"]),
    /order differs/,
  );
});

test("the default family owns builtin themes and system stays semantic", () => {
  const family = {
    id: "panel",
    name: "Panel",
    light: "light",
    dark: "dark",
    swatch: ["#000", "#fff"],
  };
  assert.throws(
    () =>
      validateManifest({
        defaultFamily: "other",
        systemTheme: "system",
        families: [family],
      }),
    /default family/,
  );
  assert.throws(
    () =>
      validateManifest({
        defaultFamily: "panel",
        systemTheme: "light",
        families: [family],
      }),
    /system/,
  );
});
