import assert from "node:assert/strict";
import test from "node:test";

import { assertUniqueParity } from "../scripts/catalogue-manifest.mjs";

test("catalogue parity reports missing entries", () => {
  assert.throws(
    () => assertUniqueParity("Docs", ["alert", "button"], ["alert"]),
    /Docs drifted.*missing: button/s,
  );
});

test("catalogue parity reports duplicate entries", () => {
  assert.throws(
    () =>
      assertUniqueParity(
        "Examples",
        ["alert", "button"],
        ["alert", "button", "button"],
      ),
    /Examples drifted.*duplicates: button/s,
  );
});

import { assertVisualizationContract } from "../scripts/catalogue-manifest.mjs";

test("visualization contracts require approved semantic implementations", () => {
  assert.doesNotThrow(() =>
    assertVisualizationContract(
      "line-chart",
      "shared-data",
      '<ChartAccessibilityData importantForAccessibility="no-hide-descendants"',
    ),
  );
  assert.doesNotThrow(() =>
    assertVisualizationContract(
      "live-line-chart",
      "summary",
      '<View accessibilityRole="image" accessibilityLabel={semantic.label} importantForAccessibility="no-hide-descendants" />',
    ),
  );
  assert.doesNotThrow(() =>
    assertVisualizationContract(
      "pie-chart",
      "interactive-items",
      '<View accessibilityRole="button" accessibilityLabel={label} />',
    ),
  );
  assert.throws(
    () => assertVisualizationContract("plot", "shared-data", "<Svg />"),
    /PlotAccessibilityData|ChartAccessibilityData|shared-data/i,
  );
  assert.throws(
    () => assertVisualizationContract("pie-chart", "interactive-items", "<Path />"),
    /labelled actionable data items/,
  );
  assert.throws(
    () => assertVisualizationContract("future-chart", "unknown", ""),
    /unknown visualization accessibility mode/,
  );
});
