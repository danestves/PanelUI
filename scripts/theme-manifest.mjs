import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const manifest = JSON.parse(read("theme-manifest.json"));

export function assertExactSequence(label, expected, actual) {
  const duplicates = actual.filter(
    (value, index) => actual.indexOf(value) !== index,
  );
  const missing = expected.filter((value) => !actual.includes(value));
  const extra = actual.filter((value) => !expected.includes(value));
  if (duplicates.length || missing.length || extra.length) {
    throw new Error(
      `${label} differs:` +
        [
          duplicates.length &&
            ` duplicates=${[...new Set(duplicates)].join(",")}`,
          missing.length && ` missing=${missing.join(",")}`,
          extra.length && ` extra=${extra.join(",")}`,
        ]
          .filter(Boolean)
          .join(""),
    );
  }
  if (expected.some((value, index) => actual[index] !== value)) {
    throw new Error(`${label} order differs`);
  }
}

export function validateManifest(value) {
  const ids = value.families.map((family) => family.id);
  const names = value.families.map((family) => family.name);
  const themes = value.families.flatMap((family) => [
    family.light,
    family.dark,
  ]);
  assertExactSequence("family ids", [...new Set(ids)], ids);
  assertExactSequence("family names", [...new Set(names)], names);
  assertExactSequence("theme names", [...new Set(themes)], themes);
  if (ids[0] !== value.defaultFamily)
    throw new Error("default family must be first");
  if (value.systemTheme !== "system" || themes.includes(value.systemTheme)) {
    throw new Error("system must be a non-concrete theme choice");
  }
  const defaultFamily = value.families[0];
  if (defaultFamily.light !== "light" || defaultFamily.dark !== "dark") {
    throw new Error("the default family must own light and dark");
  }
  return { ids, themes, extraThemes: themes.slice(2) };
}

function quoted(source) {
  return [...source.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function libraryFamilies(source) {
  return [
    ...source.matchAll(
      /id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?light:\s*'([^']+)'[\s\S]*?dark:\s*'([^']+)'[\s\S]*?swatch:\s*\['([^']+)',\s*'([^']+)'\]/g,
    ),
  ].map((match) => match.slice(1));
}

function simpleFamilies(source) {
  return [
    ...source.matchAll(
      /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*light:\s*'([^']+)',\s*dark:\s*'([^']+)'\s*\}/g,
    ),
  ].map((match) => match.slice(1));
}

function docsFamilies(source) {
  return [
    ...source.matchAll(
      /id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?swatch:\s*\{\s*light:\s*'([^']+)',\s*dark:\s*'([^']+)'\s*\}/g,
    ),
  ].map((match) => match.slice(1));
}

function assertFamilies(label, expected, actual, fields) {
  assertExactSequence(
    label,
    expected.map((family) =>
      fields.flatMap((field) => family[field]).join("|"),
    ),
    actual.map((family) => family.join("|")),
  );
}

function validateSkillTable(file) {
  const source = read(file);
  const rows = manifest.families.map((family) => {
    const row = source
      .split("\n")
      .find((line) => line.startsWith(`| ${family.name} |`));
    if (!row) throw new Error(`${file}: missing ${family.name} theme row`);
    for (const value of [family.light, family.dark, ...family.swatch]) {
      if (!row.includes(value)) {
        throw new Error(`${file}: ${family.name} row is missing ${value}`);
      }
    }
    return family.id;
  });
  assertExactSequence(
    `${file} family rows`,
    manifest.families.map((family) => family.id),
    rows,
  );
}

function textFiles(directory) {
  const ignored = new Set([".git", ".codegraph", "node_modules", ".next"]);
  const extensions = new Set([
    ".css",
    ".js",
    ".json",
    ".md",
    ".mdx",
    ".mjs",
    ".ts",
    ".tsx",
  ]);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name)) return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return textFiles(target);
    return extensions.has(path.extname(entry.name)) ? [target] : [];
  });
}

function validate() {
  const { themes, extraThemes } = validateManifest(manifest);
  const library = read("packages/panelui/src/theme/use-theme.ts");
  const panelTheme =
    library.match(/export type PanelTheme =([\s\S]*?);/)?.[1] ?? "";
  assertExactSequence("PanelTheme", themes, quoted(panelTheme));
  assertExactSequence(
    "ThemeName system option",
    [manifest.systemTheme],
    quoted(library.match(/export type ThemeName =([^;]+);/)?.[1] ?? ""),
  );
  assertFamilies("PANEL_THEMES", manifest.families, libraryFamilies(library), [
    "id",
    "name",
    "light",
    "dark",
    "swatch",
  ]);

  assertFamilies(
    "CLI theme choices",
    manifest.families,
    simpleFamilies(read("packages/cli/src/templates.mjs")),
    ["id", "name", "light", "dark"],
  );
  const cliTemplates = read("packages/cli/src/templates.mjs");
  if (
    !cliTemplates.includes(
      `theme.id === '${manifest.defaultFamily}' && mode === '${manifest.systemTheme}'`,
    )
  ) {
    throw new Error("CLI default family/system shortcut drifted");
  }
  const modeChoices = read("packages/cli/src/init.mjs").match(
    /'Light or dark\?'[\s\S]*?\[([\s\S]*?)\]\s*,\s*options/,
  )?.[1];
  assertExactSequence(
    "CLI mode choices",
    [manifest.systemTheme, "light", "dark"],
    [...(modeChoices ?? "").matchAll(/id:\s*'([^']+)'/g)].map(
      (match) => match[1],
    ),
  );
  assertFamilies(
    "docs theme picker",
    manifest.families,
    docsFamilies(read("apps/docs/components/showcase/themer.tsx")),
    ["id", "name", "swatch"],
  );

  const css = read("packages/panelui/theme.css");
  assertExactSequence(
    "CSS custom variants",
    extraThemes,
    [...css.matchAll(/@custom-variant\s+([\w-]+)/g)].map((match) => match[1]),
  );
  validateSkillTable("skills/panelui/theming.md");
  validateSkillTable("apps/docs/public/skills/panelui/theming.md");
  assertExactSequence(
    "CSS theme blocks",
    themes,
    [...css.matchAll(/@variant\s+([\w-]+)\s*\{/g)]
      .map((match) => match[1])
      .filter((name) => name !== "ios" && name !== "android"),
  );
  assertExactSequence(
    "docs theme selectors",
    themes,
    [
      ...read("apps/docs/app/panel-themes.css").matchAll(
        /\[data-panel-theme='([^']+)'\]/g,
      ),
    ].map((match) => match[1]),
  );

  let extraThemeLists = 0;
  let typeLists = 0;
  for (const file of textFiles(ROOT)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/extraThemes\s*:\s*\[([^\]]*)\]/g)) {
      assertExactSequence(
        `${path.relative(ROOT, file)} extraThemes`,
        extraThemes,
        quoted(match[1]),
      );
      extraThemeLists += 1;
    }
    for (const match of source.matchAll(/themes:\s*readonly\s*\[([^\]]*)\]/g)) {
      assertExactSequence(
        `${path.relative(ROOT, file)} generated theme types`,
        themes,
        quoted(match[1]),
      );
      typeLists += 1;
    }
  }
  if (extraThemeLists < 14 || typeLists !== 3) {
    throw new Error(
      `theme consumer inventory changed: ${extraThemeLists} extraThemes, ${typeLists} type lists`,
    );
  }

  const registryHook = JSON.parse(read("apps/docs/public/r/use-theme.json"))
    .files[0].content;
  assertFamilies(
    "generated registry hook",
    manifest.families,
    libraryFamilies(registryHook),
    ["id", "name", "light", "dark", "swatch"],
  );
  const registryCss = JSON.parse(read("apps/docs/public/r/theme.json")).files[0]
    .content;
  assertExactSequence(
    "generated registry CSS",
    extraThemes,
    [...registryCss.matchAll(/@custom-variant\s+([\w-]+)/g)].map(
      (match) => match[1],
    ),
  );

  console.log(
    `themes: ${manifest.families.length} families, ${themes.length} concrete themes, ${extraThemeLists} extraThemes consumers verified`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  validate();
