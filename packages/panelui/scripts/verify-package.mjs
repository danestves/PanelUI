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

const budgets = {
  files: 850,
  packedBytes: 2_500_000,
  unpackedBytes: 9_000_000,
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
