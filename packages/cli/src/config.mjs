/**
 * `panelui.json` — where a project says which directories it wants the copied
 * source to land in.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fail } from './ui.mjs';

export const CONFIG_FILE = 'panelui.json';
export const DEFAULT_REGISTRY = 'https://panelui.dev/r';

/** Aliases the registry emits. Anything else is rewritten on the way in. */
export const CANONICAL_ALIASES = {
  components: '@/components/ui',
  lib: '@/lib',
  hooks: '@/hooks',
};

export function defaultConfig(registry = DEFAULT_REGISTRY) {
  return {
    $schema: 'https://panelui.dev/schema.json',
    registry,
    aliases: { ...CANONICAL_ALIASES },
    css: 'global.css',
    theme: 'theme.css',
  };
}

export function configPath(cwd) {
  return projectPath(cwd, CONFIG_FILE, 'Configuration path');
}

export function readConfig(cwd) {
  const file = configPath(cwd);
  if (!fs.existsSync(file)) return null;

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (cause) {
    fail(`${CONFIG_FILE} is not valid JSON.`, `Fix or delete ${file}, then run init again.`);
  }
}

export function requireConfig(cwd) {
  const config = readConfig(cwd);
  if (!config) {
    fail(
      `No ${CONFIG_FILE} here.`,
      'Run `npx panelui-cli@latest init` first — it sets up the theme and the paths components are written to.'
    );
  }
  return config;
}

export function writeConfig(cwd, config) {
  fs.writeFileSync(configPath(cwd), JSON.stringify(config, null, 2) + '\n');
}

/**
 * Turn an alias into a real directory. `@/components/ui` → `components/ui`,
 * following the `@/*` → `./*` mapping Expo's base tsconfig already sets up.
 */
export function aliasToDir(alias) {
  if (typeof alias !== 'string') {
    fail('Alias paths must be relative directories.');
  }

  const directory = alias.replace(/^@\//, '').replace(/^~\//, '').replace(/^\.\//, '');
  return validateRelativePath(directory, 'Alias path', { allowEmpty: true });
}

/** Rejects paths that could escape a project on the current platform or Windows. */
export function validateRelativePath(value, label = 'Path', { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || value.includes('\0')) {
    fail(`${label} must be a relative path.`);
  }

  if (!value && !allowEmpty) {
    fail(`${label} must not be empty.`);
  }

  if (
    path.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    /^[a-zA-Z]:/.test(value) ||
    value.split(/[\\/]+/).includes('..')
  ) {
    fail(`${label} must stay inside the project.`);
  }

  return value;
}

/** Resolve a user or registry path, refusing anything outside the project root. */
export function projectPath(cwd, relativePath, label = 'Path') {
  const root = path.resolve(cwd);
  const destination = path.resolve(root, validateRelativePath(relativePath, label));
  const relative = path.relative(root, destination);

  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`${label} must stay inside the project.`);
  }

  return destination;
}

/** A scaffold name must produce exactly one child directory, on every platform. */
export function validateProjectName(name) {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name === '.' ||
    name === '..' ||
    name.includes('\0') ||
    /[\\/]/.test(name) ||
    path.isAbsolute(name) ||
    path.win32.isAbsolute(name) ||
    /^[a-zA-Z]:/.test(name)
  ) {
    fail('Project name must be a single directory name inside the current folder.');
  }

  return name;
}

/** Validate every configured path before it reaches a filesystem write boundary. */
export function validateConfigPaths(config) {
  const aliases = { ...CANONICAL_ALIASES, ...(config.aliases ?? {}) };
  aliasToDir(aliases.components);
  aliasToDir(aliases.lib);
  aliasToDir(aliases.hooks);
  validateRelativePath(config.css ?? 'global.css', 'CSS path');
  validateRelativePath(config.theme ?? 'theme.css', 'Theme path');
}

/**
 * Where one registry file lands, given the project's aliases. Registry paths
 * are `ui/…`, `lib/…`, `hooks/…` or a bare `theme.css`.
 */
export function targetPath(cwd, config, registryPath) {
  const safeRegistryPath = validateRelativePath(registryPath, 'Registry file path');
  if (safeRegistryPath.includes('\\')) {
    fail('Registry file paths must use forward slashes.');
  }

  const aliases = { ...CANONICAL_ALIASES, ...(config.aliases ?? {}) };
  const [group, ...rest] = safeRegistryPath.split('/');

  if (rest.length === 0) {
    // theme.css and anything else at the root goes where the config says.
    return projectPath(cwd, config.theme ?? safeRegistryPath, 'Theme path');
  }

  const alias =
    group === 'ui' ? aliases.components : group === 'lib' ? aliases.lib : aliases.hooks;

  return projectPath(cwd, path.join(aliasToDir(alias), ...rest), 'Registry file path');
}

/**
 * Rewrite the canonical aliases baked into the registry to whatever this
 * project uses. A no-op for the default configuration.
 */
export function applyAliases(content, config) {
  const aliases = { ...CANONICAL_ALIASES, ...(config.aliases ?? {}) };
  let output = content;

  for (const [key, canonical] of Object.entries(CANONICAL_ALIASES)) {
    const target = aliases[key];
    if (target && target !== canonical) {
      output = output.replaceAll(`'${canonical}/`, `'${target}/`);
    }
  }

  return output;
}

/** An Expo project, or at least something close enough to work in. */
export function detectProject(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fail(
      'No package.json here.',
      'Run this from the root of your app, or create one with `npx create-expo-app@latest`.'
    );
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  return {
    pkg,
    deps,
    isExpo: 'expo' in deps,
    hasTypeScript: 'typescript' in deps || fs.existsSync(path.join(cwd, 'tsconfig.json')),
  };
}
