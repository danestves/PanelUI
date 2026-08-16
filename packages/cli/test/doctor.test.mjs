import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { BASE_DEPENDENCIES } from "../src/init.mjs";
import { digest } from "../src/lock.mjs";

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

test("tracked files, provenance, and compatible local versions are deterministic and read-only", () => {
  const root = fixture();
  write(root, "components/ui/card.tsx", "card source\n");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
  manifest.dependencies["panelui-native"] = "^0.68.0";
  write(root, "package.json", JSON.stringify(manifest));
  write(
    root,
    "node_modules/panelui-native/package.json",
    JSON.stringify({ name: "panelui-native", version: "0.68.2" }),
  );
  write(
    root,
    "panelui-lock.json",
    JSON.stringify({
      version: 1,
      registry: "https://panelui.dev/r/",
      files: {
        "components/ui/card.tsx": {
          item: "card",
          digest: digest("card source\n"),
        },
      },
    }),
  );
  const before = snapshot(root);
  const first = run(root, "--json");
  const second = run(root, "--json");
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, second.stdout);
  assert.equal(snapshot(root), before);
  const report = JSON.parse(first.stdout);
  assert.equal(report.status, "healthy");
  assert.deepEqual(
    ["lock", "tracked-files", "registry", "versions"].map((id) => [
      id,
      report.checks.find((item) => item.id === id).status,
    ]),
    [
      ["lock", "ok"],
      ["tracked-files", "ok"],
      ["registry", "ok"],
      ["versions", "ok"],
    ],
  );
  const v2Lock = JSON.parse(fs.readFileSync(path.join(root, "panelui-lock.json")));
  Object.assign(v2Lock, { version: 2, roots: { card: ["card"] }, legacyFiles: [] });
  write(root, "panelui-lock.json", JSON.stringify(v2Lock));
  const v2Report = JSON.parse(run(root, "--json").stdout);
  assert.equal(v2Report.status, "healthy");
  assert.equal(v2Report.checks.find((item) => item.id === "lock").status, "ok");
  write(
    root,
    "node_modules/panelui-native/package.json",
    JSON.stringify({ name: "panelui-native", version: "0.69.0" }),
  );
  const incompatible = JSON.parse(run(root, "--json").stdout);
  assert.equal(incompatible.status, "broken");
  assert.equal(incompatible.checks.find((item) => item.id === "versions").status, "error");
});

test("local drift, missing tracked files, and registry changes request review", () => {
  const root = fixture();
  write(root, "components/ui/changed.tsx", "local edit\n");
  write(
    root,
    "panelui-lock.json",
    JSON.stringify({
      version: 1,
      registry: "https://old.panelui.dev/r",
      files: {
        "components/ui/changed.tsx": {
          item: "changed",
          digest: digest("installed\n"),
        },
        "components/ui/missing.tsx": {
          item: "missing",
          digest: digest("missing\n"),
        },
      },
    }),
  );
  const result = run(root, "--json");
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "review");
  assert.match(
    report.checks.find((item) => item.id === "tracked-files").message,
    /1 missing, 1 locally changed/,
  );
  assert.equal(
    report.checks.find((item) => item.id === "registry").status,
    "warning",
  );
});

test("malformed and escaping lock metadata is confirmed breakage without outside hashing", () => {
  const malformed = fixture();
  write(malformed, "panelui-lock.json", "{broken");
  const malformedResult = run(malformed, "--json");
  assert.equal(malformedResult.status, 1);
  assert.equal(
    JSON.parse(malformedResult.stdout).checks.find((item) => item.id === "lock")
      .status,
    "error",
  );
  const malformedV2 = fixture();
  write(malformedV2, "panelui-lock.json", JSON.stringify({ version: 2, files: {}, roots: [], legacyFiles: [] }));
  const v2Result = JSON.parse(run(malformedV2, "--json").stdout);
  assert.equal(v2Result.status, "broken");
  assert.match(v2Result.checks.find((item) => item.id === "lock").message, /ownership metadata/);

  const escaping = fixture();
  write(
    escaping,
    "panelui-lock.json",
    JSON.stringify({
      version: 1,
      files: {
        "../outside.ts": { item: "outside", digest: digest("outside\n") },
      },
    }),
  );
  const escapingResult = run(escaping, "--json");
  assert.equal(escapingResult.status, 1);
  assert.match(
    JSON.parse(escapingResult.stdout).checks.find(
      (item) => item.id === "tracked-files",
    ).message,
    /1 unsafe path/,
  );
});

test("newer lock schemas and unprovable installed versions request review", () => {
  const root = fixture();
  write(
    root,
    "panelui-lock.json",
    JSON.stringify({
      version: 3,
      registry: "https://panelui.dev/r",
      files: {},
    }),
  );
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
  manifest.devDependencies = { "panelui-cli": "workspace:*" };
  write(root, "package.json", JSON.stringify(manifest));
  write(
    root,
    "node_modules/panelui-cli/package.json",
    JSON.stringify({ name: "panelui-cli", version: "0.5.0" }),
  );
  const result = run(root, "--json");
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "review");
  assert.match(report.checks.find((item) => item.id === "lock").message, /newer schema/);
  assert.equal(report.checks.find((item) => item.id === "versions").status, "unknown");
});

test("copied-source directories without a lock request review rather than claiming breakage", () => {
  const root = fixture();
  write(root, "components/ui/local.tsx", "export {};\n");
  const result = run(root, "--json");
  assert.equal(result.status, 0);
  const lock = JSON.parse(result.stdout).checks.find((item) => item.id === "lock");
  assert.equal(lock.status, "warning");
  assert.match(lock.message, /lockfile is missing/);
});
