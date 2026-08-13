import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  readFileSync(resolve(packageRoot, "package.json"), "utf8"),
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const [manifest] = JSON.parse(
  execFileSync(npm, ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: packageRoot,
    encoding: "utf8",
  }),
);

const files = new Set(manifest.files.map(({ path }) => path));
const allowedFiles = new Set(["README.md", "package.json", "theme.css"]);
const allowedDirectories = ["src/", "lib/module/", "lib/typescript/"];

const unexpectedFiles = [...files].filter(
  (path) =>
    !allowedFiles.has(path) &&
    !allowedDirectories.some((directory) => path.startsWith(directory)),
);

if (unexpectedFiles.length > 0) {
  throw new Error(
    `Package contains files outside the publish contract:\n${unexpectedFiles.join("\n")}`,
  );
}

const collectTargets = (value) => {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectTargets);
};

const requiredTargets = new Set(
  [
    packageJson.main,
    packageJson.module,
    packageJson.types,
    packageJson["react-native"],
    ...collectTargets(packageJson.exports),
  ]
    .filter(Boolean)
    .map((path) => path.replace(/^\.\//, "")),
);
for (const asset of [
  "README.md",
  "theme.css",
  "lib/module/index.js.map",
  "lib/typescript/src/index.d.ts.map",
]) {
  requiredTargets.add(asset);
}

const missingTargets = [...requiredTargets].filter((path) => !files.has(path));
if (missingTargets.length > 0) {
  throw new Error(
    `Package is missing declared entry points:\n${missingTargets.join("\n")}`,
  );
}

const forbiddenFiles = [...files].filter(
  (path) =>
    path.includes("/__tests__/") ||
    path.includes(".test.") ||
    path.endsWith(".tsbuildinfo"),
);
if (forbiddenFiles.length > 0) {
  throw new Error(
    `Package contains development-only files:\n${forbiddenFiles.join("\n")}`,
  );
}

/*
 * Set to catch a mistake, not to police growth.
 *
 * What this is guarding against is a stray directory finding its way into
 * `files` — a `node_modules`, a build cache, a folder of recordings. Those
 * arrive orders of magnitude over the line, so the line does not need to be
 * anywhere near the current size to catch them.
 *
 * It needs to be well clear of it, though, because this step also runs in
 * `publish.yml`, after the tag exists. A budget that a few ordinary components
 * can cross turns a release into a failure at the one moment there is nothing
 * useful to do about it. At 106 components the package is 768 files and 2.1 MB
 * packed, and each new component costs six or seven files — so this leaves room
 * for roughly another sixty of them. Raise it when it is genuinely reached;
 * that is a normal thing to do and not a signal that anything is wrong.
 */
const budgets = {
  files: 1_200,
  packedBytes: 4_000_000,
  unpackedBytes: 14_000_000,
};
const exceededBudgets = [
  ["files", manifest.entryCount, budgets.files],
  ["packed bytes", manifest.size, budgets.packedBytes],
  ["unpacked bytes", manifest.unpackedSize, budgets.unpackedBytes],
].filter(([, actual, maximum]) => actual > maximum);

if (exceededBudgets.length > 0) {
  throw new Error(
    `Package exceeds its size budget:\n${exceededBudgets
      .map(([name, actual, maximum]) => `${name}: ${actual} > ${maximum}`)
      .join("\n")}`,
  );
}

console.log(
  `Verified package: ${manifest.entryCount} files, ${manifest.size} packed bytes, ${manifest.unpackedSize} unpacked bytes.`,
);
