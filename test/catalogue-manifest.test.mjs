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
