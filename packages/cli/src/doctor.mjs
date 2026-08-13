import fs from "node:fs";
import path from "node:path";
import {
  CANONICAL_ALIASES,
  aliasToDir,
  projectPath,
  validateConfigPaths,
} from "./config.mjs";
import { BASE_DEPENDENCIES } from "./init.mjs";
import { hasWrappedMetroExport } from "./patch.mjs";

const check = (id, status, message) => ({ id, status, message });
const read = (file) => fs.readFileSync(file, "utf8");

function sourceFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [file] : [];
  });
}

export function diagnose(cwd) {
  const checks = [];
  const configFile = path.join(cwd, "panelui.json");
  let config;
  try {
    config = JSON.parse(read(configFile));
    if (!config || Array.isArray(config) || typeof config !== "object")
      throw new Error("not an object");
    if (config.registry !== undefined && typeof config.registry !== "string")
      throw new Error("registry must be a string");
    if (
      config.aliases !== undefined &&
      (!config.aliases ||
        Array.isArray(config.aliases) ||
        typeof config.aliases !== "object")
    )
      throw new Error("aliases must be an object");
    validateConfigPaths(config);
    checks.push(check("config", "ok", "panelui.json is valid and contained"));
  } catch (error) {
    const message = fs.existsSync(configFile)
      ? error.message
      : "panelui.json is missing";
    checks.push(check("config", "error", message));
    return report(cwd, checks);
  }

  const aliases = { ...CANONICAL_ALIASES, ...(config.aliases ?? {}) };
  checks.push(check("aliases", "ok", Object.values(aliases).join(", ")));

  const cssFile = projectPath(cwd, config.css ?? "global.css", "CSS path");
  if (!fs.existsSync(cssFile)) {
    checks.push(
      check("css", "error", `${path.relative(cwd, cssFile)} is missing`),
    );
  } else {
    const css = read(cssFile);
    const cssDir = path.dirname(cssFile);
    const required = ["@import 'tailwindcss'", "@import 'uniwind'"];
    let themeImport = path
      .relative(cssDir, path.join(cwd, config.theme ?? "theme.css"))
      .split(path.sep)
      .join("/");
    if (!themeImport.startsWith(".")) themeImport = `./${themeImport}`;
    required.push(`@import '${themeImport}'`);
    const sourceDirs = new Set(
      Object.values(aliases)
        .map(aliasToDir)
        .map((dir) => dir.split(/[\\/]/)[0]),
    );
    for (const dir of sourceDirs) {
      let relative = path
        .relative(cssDir, path.join(cwd, dir))
        .split(path.sep)
        .join("/");
      if (!relative.startsWith(".")) relative = `./${relative}`;
      required.push(`@source '${relative}'`);
    }
    const missing = required.filter((line) => !css.includes(line));
    checks.push(
      check(
        "css",
        missing.length ? "error" : "ok",
        missing.length
          ? `missing ${missing.join(", ")}`
          : "imports and sources are present",
      ),
    );
  }

  const metroFile = ["metro.config.js", "metro.config.mjs", "metro.config.cjs"]
    .map((file) => path.join(cwd, file))
    .find(fs.existsSync);
  checks.push(
    !metroFile
      ? check("metro", "error", "Metro config is missing")
      : hasWrappedMetroExport(read(metroFile))
        ? check("metro", "ok", "export wraps withUniwindConfig")
        : check(
            "metro",
            "warning",
            "could not prove the exported config uses withUniwindConfig",
          ),
  );

  const themeFile = projectPath(cwd, config.theme ?? "theme.css", "Theme path");
  checks.push(
    check(
      "theme",
      fs.existsSync(themeFile) ? "ok" : "error",
      fs.existsSync(themeFile)
        ? "theme file is present"
        : `${path.relative(cwd, themeFile)} is missing`,
    ),
  );

  const typesFile = [
    path.join(cwd, "uniwind-env.d.ts"),
    ...sourceFiles(path.join(cwd, "src")),
  ].find(
    (file) =>
      fs.existsSync(file) &&
      /\.d\.ts$/.test(file) &&
      /uniwind\/types/.test(read(file)),
  );
  checks.push(
    check(
      "types",
      typesFile ? "ok" : "warning",
      typesFile
        ? "Uniwind ambient types are present"
        : "could not find an ambient uniwind/types import",
    ),
  );

  let manifest = {};
  try {
    manifest = JSON.parse(read(path.join(cwd, "package.json")));
  } catch {}
  const deps = { ...manifest.dependencies, ...manifest.devDependencies };
  const missingDeps = BASE_DEPENDENCIES.filter((name) => !(name in deps));
  checks.push(
    check(
      "dependencies",
      missingDeps.length ? "error" : "ok",
      missingDeps.length
        ? `missing ${missingDeps.join(", ")}`
        : "required packages are present",
    ),
  );

  const appFiles = ["app", "src/app"].flatMap((dir) =>
    sourceFiles(path.join(cwd, dir)),
  );
  const provider = appFiles.some((file) => {
    const source = read(file);
    return (
      /import\s*\{[^}]*\bPanelUIProvider\b[^}]*\}\s*from\s*['"][^'"]+['"]/.test(
        source,
      ) && /<PanelUIProvider\b/.test(source)
    );
  });
  checks.push(
    check(
      "provider",
      provider ? "ok" : "unknown",
      provider
        ? "PanelUIProvider is wired in app source"
        : "provider wiring needs manual review",
    ),
  );
  return report(cwd, checks);
}

function report(cwd, checks) {
  const errors = checks.filter((item) => item.status === "error").length;
  const warnings = checks.filter(
    (item) => item.status === "warning" || item.status === "unknown",
  ).length;
  return {
    version: 1,
    cwd: path.resolve(cwd),
    status: errors ? "broken" : warnings ? "review" : "healthy",
    errors,
    warnings,
    checks,
  };
}

export function formatDoctor(report) {
  const mark = { ok: "✓", error: "✗", warning: "!", unknown: "?" };
  return [
    `PanelUI doctor: ${report.status}`,
    ...report.checks.map(
      (item) => `${mark[item.status]} ${item.id}: ${item.message}`,
    ),
    `${report.errors} errors, ${report.warnings} warnings/unknowns`,
  ].join("\n");
}
