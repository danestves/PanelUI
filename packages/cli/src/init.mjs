/**
 * `init` — make a project ready to receive components.
 *
 * Components are useless without the theme tokens, the Uniwind pipeline and
 * the provider, so this sets all three up rather than letting the first `add`
 * fail in a confusing way.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG_FILE,
  DEFAULT_REGISTRY,
  aliasToDir,
  defaultConfig,
  detectProject,
  readConfig,
  writeConfig,
} from './config.mjs';
import { fetchItem } from './registry.mjs';
import { installDependencies, patchCss, patchMetro, patchTypeScript } from './patch.mjs';
import {
  TEMPLATES,
  THEMES,
  applyTheme,
  findTemplate,
  nameProject,
  scaffold,
} from './templates.mjs';
import {
  ask,
  bold,
  confirm,
  dim,
  fail,
  info,
  select,
  step,
  success,
  warn,
} from './ui.mjs';

/** Needed by anything the registry can install. */
const BASE_DEPENDENCIES = [
  'uniwind',
  'tailwindcss',
  'tailwind-variants',
  'clsx',
  'tailwind-merge',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-gesture-handler',
];

export async function init(options) {
  const cwd = options.cwd;

  /*
   * No package.json means there is no project to configure, only one to
   * create. Retrofitting an existing app and starting a new one are different
   * jobs, and asking which of the two this is by looking for a package.json is
   * more reliable than asking the person running it.
   */
  if (!fs.existsSync(path.join(cwd, 'package.json'))) {
    await create(options);
    return;
  }

  const project = detectProject(cwd);

  if (!project.isExpo) {
    warn('This does not look like an Expo project — no `expo` dependency found.');
    if (!(await confirm('Continue anyway?', { defaultValue: false, assumeYes: options.yes }))) {
      return;
    }
  }

  const existing = readConfig(cwd);
  if (existing && !options.yes) {
    const overwrite = await confirm(`${CONFIG_FILE} already exists. Reconfigure?`, {
      defaultValue: false,
    });
    if (!overwrite) {
      info(dim('Nothing to do.'));
      return;
    }
  }

  const config = defaultConfig(options.registry ?? DEFAULT_REGISTRY);

  if (!options.yes && process.stdin.isTTY) {
    config.aliases.components = await ask('Where should components go?', config.aliases.components);
    config.aliases.lib = await ask('Where should utilities go?', config.aliases.lib);
    config.aliases.hooks = await ask('Where should hooks go?', config.aliases.hooks);
    config.css = await ask('Which file is your CSS entry?', config.css);
  }

  step(`Write ${CONFIG_FILE}`);
  if (!options.dryRun) {
    writeConfig(cwd, config);
    success(`Wrote ${CONFIG_FILE}`);
  }

  // The tokens are global rather than per component — every class name in the
  // library resolves through them — so they come in whole, once.
  const theme = await fetchItem(config.registry, 'theme');
  const themePath = path.join(cwd, config.theme);
  const themeExists = fs.existsSync(themePath);

  if (themeExists && !options.overwrite) {
    success(`${config.theme} already exists — left alone`);
  } else {
    step(`Write ${config.theme} ${dim('(design tokens, all themes)')}`);
    if (!options.dryRun) {
      fs.writeFileSync(themePath, theme.files[0].content);
      success(`Wrote ${config.theme}`);
    }
  }

  await patchCss(cwd, config, options);
  await patchMetro(cwd, config, options);
  await patchTypeScript(cwd, config, options);

  const missing = BASE_DEPENDENCIES.filter((dep) => !(dep in project.deps));
  await installDependencies(cwd, missing, { ...options, isExpo: project.isExpo });

  printNextSteps(config);
}

/**
 * Start a new project from a template.
 *
 * Everything the retrofit path has to patch into an existing app — the Metro
 * config, the CSS entry, the tsconfig paths, the provider — is already correct
 * in a template, so this is a copy, a rename and an install rather than a
 * sequence of edits that can each fail on their own.
 */
async function create(options) {
  const cwd = options.cwd;

  info('');
  info(bold('There is nothing here yet — let us start a new app.'));
  info('');

  const template = options.template
    ? (findTemplate(options.template) ??
      fail(
        `No template called "${options.template}".`,
        `Try: ${TEMPLATES.map((entry) => entry.name).join(', ')}`
      ))
    : await select('Which template?', TEMPLATES, { assumeYes: options.yes });

  const projectName =
    options.name ??
    (options.yes
      ? template.defaultProjectName
      : await ask('What is it called?', template.defaultProjectName));

  const theme = options.theme
    ? (THEMES.find((entry) => entry.id === options.theme) ??
      fail(
        `No theme called "${options.theme}".`,
        `Try: ${THEMES.map((entry) => entry.id).join(', ')}`
      ))
    : await select(
        'Which theme?',
        THEMES.map((entry) => ({ ...entry, title: entry.name })),
        { assumeYes: options.yes }
      );

  const mode = await select(
    'Light or dark?',
    [
      { title: 'System', id: 'system', description: 'Follow the device' },
      { title: 'Light', id: 'light' },
      { title: 'Dark', id: 'dark' },
    ],
    { assumeYes: options.yes }
  );

  const projectPath = path.join(cwd, projectName);
  if (fs.existsSync(projectPath) && fs.readdirSync(projectPath).length > 0) {
    fail(`${projectName}/ already exists and is not empty.`, 'Pick another name.');
  }

  info('');

  if (options.dryRun) {
    step(`Would create ${projectName}/ from the ${template.title} template`);
    step(`Would start it in ${theme.name}, ${mode.id}`);
    return;
  }

  scaffold(template, projectPath);
  nameProject(projectPath, projectName);
  applyTheme(projectPath, theme, mode.id);

  // The config the `add` command reads. A generated project already has the
  // directories it names, so nothing here is a question.
  const config = defaultConfig(options.registry ?? DEFAULT_REGISTRY);
  writeConfig(projectPath, config);
  success(`Wrote ${CONFIG_FILE}`);

  await installDependencies(projectPath, [], {
    ...options,
    isExpo: true,
    // The template's package.json already lists everything; this is an
    // install of what is written down rather than an addition to it.
    installAll: true,
  });

  printCreated(projectName, template, theme, mode);
}

function printCreated(projectName, template, theme, mode) {
  info('');
  info(bold(`${projectName} is ready.`));
  info('');
  info(`  ${dim('$')} cd ${projectName}`);
  info(`  ${dim('$')} npx expo start`);
  info('');
  info(dim(`  ${template.title} template, starting in ${theme.name} (${mode.id}).`));
  info(dim(`  Add more components with: npx panelui-cli@latest add <name>`));
  info('');
}

function printNextSteps(config) {
  const componentsDir = aliasToDir(config.aliases.components);

  info('');
  info(bold('Almost there. Two things left:'));
  info('');
  info(`  1. Add a component:  ${bold('npx panelui-cli@latest add button')}`);
  info(`     It lands in ${componentsDir}/ and is yours to edit.`);
  info('');
  info(`  2. Wrap your app in the provider, which owns the portal host that`);
  info(`     overlays render into:`);
  info('');
  info(dim(`       npx panelui-cli@latest add panel-ui-provider`));
  info('');
  info(dim(`       import { PanelUIProvider } from '${config.aliases.components}/panel-ui-provider';`));
  info(dim('       export default function Layout() {'));
  info(dim('         return <PanelUIProvider><Slot /></PanelUIProvider>;'));
  info(dim('       }'));
  info('');
  warn('Restart Metro with a cleared cache — a running server keeps the old theme list.');
  info(dim('  npx expo start --clear'));
  info('');
}
