import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { BASE_DEPENDENCIES } from "../src/init.mjs";

const cli = fileURLToPath(new URL("../bin/panelui.mjs", import.meta.url));
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "panelui-doctor-"));
const write = (root, file, value) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
};
const run = (root, ...args) =>
  spawnSync(process.execPath, [cli, "--cwd", root, "doctor", ...args], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

function fixture({ metro = "wrapped", provider = true } = {}) {
  const root = temp();
  write(
    root,
    "panelui.json",
    JSON.stringify({
      registry: "https://panelui.dev/r",
      aliases: {
        components: "@/components/ui",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      css: "global.css",
      theme: "theme.css",
    }),
  );
  write(
    root,
    "package.json",
    JSON.stringify({
      dependencies: Object.fromEntries(
        BASE_DEPENDENCIES.map((name) => [name, "*"]),
      ),
    }),
  );
  write(
    root,
    "global.css",
    "@import 'tailwindcss';\n@import 'uniwind';\n@import './theme.css';\n@source './components';\n@source './lib';\n@source './hooks';\n",
  );
  write(root, "theme.css", ":root {}\n");
  write(root, "uniwind-env.d.ts", "import 'uniwind/types';\n");
  write(
    root,
    "metro.config.js",
    metro === "wrapped"
      ? "const { withUniwindConfig } = require('uniwind/metro');\nmodule.exports = withUniwindConfig({});\n"
      : "const wrap = require('./wrap');\nmodule.exports = wrap({});\n",
  );
  if (provider)
    write(
      root,
      "app/_layout.tsx",
      "import { PanelUIProvider } from 'panelui-native';\nexport default () => <PanelUIProvider><Slot /></PanelUIProvider>;\n",
    );
  return root;
}

function snapshot(root) {
  const hash = crypto.createHash("sha256");
  for (const file of fs
    .readdirSync(root, { recursive: true })
    .filter((name) => fs.statSync(path.join(root, name)).isFile())
    .sort()) {
    hash.update(file);
    hash.update(fs.readFileSync(path.join(root, file)));
  }
  return hash.digest("hex");
}

test("healthy project exits zero and doctor is strictly read-only", () => {
  const root = fixture();
  const before = snapshot(root);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PanelUI doctor: healthy/);
  assert.equal(snapshot(root), before);
});

test("confirmed breakage exits nonzero with stable machine-readable checks", () => {
  const root = fixture();
  write(root, "panelui.json", "{broken");
  const first = run(root, "--json");
  const second = run(root, "--json");
  assert.equal(first.status, 1);
  assert.equal(first.stdout, second.stdout);
  const report = JSON.parse(first.stdout);
  assert.deepEqual(Object.keys(report), [
    "version",
    "cwd",
    "status",
    "errors",
    "warnings",
    "checks",
  ]);
  assert.deepEqual(report.checks[0].id, "config");
  assert.equal(report.status, "broken");
});

test("ambiguous static wiring requests review without claiming an error", () => {
  const root = fixture({ metro: "ambiguous", provider: false });
  const result = run(root, "--json");
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 0);
  assert.equal(report.status, "review");
  assert.deepEqual(
    report.checks
      .filter((item) => item.status !== "ok")
      .map((item) => [item.id, item.status]),
    [
      ["metro", "warning"],
      ["provider", "unknown"],
    ],
  );
});

test("unsafe configured paths are confirmed errors without escaping the project", () => {
  const root = fixture();
  write(
    root,
    "panelui.json",
    JSON.stringify({ aliases: { components: "../../outside" } }),
  );
  const result = run(root, "--json");
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).checks[0].id, "config");
});
