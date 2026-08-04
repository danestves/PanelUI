/**
 * Project templates — the "I have nothing yet" half of `init`.
 *
 * The templates are real, runnable Expo apps kept in the repository rather
 * than strings in this file. That is deliberate: a template written as a
 * string is a template nobody runs, and it rots on the first SDK bump without
 * anything failing to say so. Kept as an app it is typechecked, started and
 * looked at like any other, and this file only has to fetch it.
 *
 * Fetching is a sparse `git clone`, so a template of any size costs one
 * request and no dependency. `PANELUI_TEMPLATE_DIR` copies from a local path
 * instead, which is how the templates are worked on and reviewed before they
 * are ever published.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fail, step, success } from './ui.mjs';

const REPOSITORY = process.env.PANELUI_REPO ?? 'https://github.com/panel-ui/PanelUI.git';

/** Where the templates live inside the repository. */
const TEMPLATE_ROOT = 'templates';

export const TEMPLATES = [
  {
    name: 'starter',
    dir: 'expo-starter',
    title: 'Starter',
    description: 'Tabs, a themed dashboard, a component gallery and a theme picker',
    defaultProjectName: 'my-app',
  },
  {
    name: 'minimal',
    dir: 'expo-app',
    title: 'Minimal',
    description: 'One screen, everything wired, nothing to delete',
    defaultProjectName: 'my-app',
  },
];

export function findTemplate(name) {
  return TEMPLATES.find((template) => template.name === name);
}

/** Themes a generated project can start in, and what each one is called. */
export const THEMES = [
  { id: 'panel', name: 'Panel', light: 'light', dark: 'dark' },
  { id: 'moon', name: 'Moon', light: 'moon', dark: 'moon-dark' },
  { id: 'grass', name: 'Grass', light: 'grass', dark: 'grass-dark' },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) {
    const detail = (result.stderr || result.error?.message || '').trim();
    fail(`\`${command} ${args.join(' ')}\` failed.`, detail || undefined);
  }
  return result;
}

function hasGit() {
  const result = spawnSync('git', ['--version'], { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

/**
 * Put a template's files at `projectPath`.
 *
 * The clone is `--depth 1 --filter=blob:none --sparse`, so it fetches one
 * commit, no history and only the blobs the sparse path actually needs —
 * a template rather than the repository.
 */
export function scaffold(template, projectPath) {
  const local = process.env.PANELUI_TEMPLATE_DIR;

  if (local) {
    const source = path.resolve(local, template.dir);
    if (!fs.existsSync(source)) {
      fail(
        `No template at ${source}.`,
        'PANELUI_TEMPLATE_DIR is set, so the template is being read from disk rather than fetched.'
      );
    }
    step(`Copy ${template.title} from ${source}`);
    fs.cpSync(source, projectPath, {
      recursive: true,
      // Copying a template someone has already run would bring its installed
      // tree and its lockfile along with it.
      filter: (from) => !from.includes('node_modules') && !from.endsWith('.expo'),
    });
    success(`Created ${path.basename(projectPath)}`);
    return;
  }

  if (!hasGit()) {
    fail(
      'git is required to fetch a template.',
      'Install git, or clone the template by hand from ' + REPOSITORY
    );
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-template-'));

  try {
    step(`Fetch the ${template.title} template`);
    run('git', [
      'clone',
      '--depth',
      '1',
      '--filter=blob:none',
      '--sparse',
      REPOSITORY,
      scratch,
    ]);
    run('git', ['-C', scratch, 'sparse-checkout', 'set', `${TEMPLATE_ROOT}/${template.dir}`]);

    const source = path.join(scratch, TEMPLATE_ROOT, template.dir);
    if (!fs.existsSync(source)) {
      fail(`The ${template.name} template is missing from the repository.`);
    }

    fs.cpSync(source, projectPath, { recursive: true });
    success(`Created ${path.basename(projectPath)}`);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Write the project's own name into the two files that carry one.
 *
 * Templates ship with a placeholder name rather than a token to substitute,
 * so they stay valid projects that can be installed and started in place.
 */
export function nameProject(projectPath, projectName) {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const packageJson = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageJson)) {
    const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
    pkg.name = slug;
    fs.writeFileSync(packageJson, JSON.stringify(pkg, null, 2) + '\n');
  }

  const appJson = path.join(projectPath, 'app.json');
  if (fs.existsSync(appJson)) {
    const app = JSON.parse(fs.readFileSync(appJson, 'utf8'));
    if (app.expo) {
      app.expo.name = projectName;
      app.expo.slug = slug;
      // A scheme has to be a valid URL scheme, so it loses the hyphens the
      // slug is allowed to keep.
      app.expo.scheme = slug.replace(/-/g, '');
    }
    fs.writeFileSync(appJson, JSON.stringify(app, null, 2) + '\n');
  }
}

/**
 * Make the chosen theme the one the app starts in.
 *
 * Written into the root layout rather than into a config file, because that is
 * where someone will look for it — and where they will change it once the
 * choice made at `init` time stops being the right one.
 */
export function applyTheme(projectPath, theme, mode) {
  if (theme.id === 'panel' && mode === 'system') return;

  const layout = path.join(projectPath, 'app', '_layout.tsx');
  if (!fs.existsSync(layout)) return;

  const initial =
    mode === 'system'
      ? // `system` follows the device, which only `light` and `dark` can do —
        // so a named family has to be told which half to start in.
        theme.id === 'panel'
          ? 'system'
          : theme.light
      : mode === 'dark'
        ? theme.dark
        : theme.light;

  const source = fs.readFileSync(layout, 'utf8');
  if (source.includes('Uniwind.setTheme')) return;

  /*
   * At module scope, not in an effect. `setTheme` is a static call rather than
   * something the provider owns, so running it as the module loads means the
   * first frame is already in the right theme — an effect would paint the
   * default one first and switch out of it, which is visible.
   */
  const patched = source.replace(
    "import { useCSSVariable } from 'uniwind';",
    `import { Uniwind, useCSSVariable } from 'uniwind';`
  );
  if (patched === source) return;

  const withInitial = patched.replace(
    '/**\n * React Navigation paints',
    `/*
 * The theme this app starts in. Change it here, or call \`setTheme\` from
 * anywhere to switch at runtime.
 *
 * Anything other than 'light', 'dark' and 'system' must also be listed in
 * \`extraThemes\` in metro.config.js — and a change to that list needs the dev
 * server restarted rather than reloaded.
 */
Uniwind.setTheme('${initial}');

/**
 * React Navigation paints`
  );

  fs.writeFileSync(layout, withInitial);
}
