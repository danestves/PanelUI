#!/usr/bin/env node
/**
 * create-panelui-app — start a new Expo app with PanelUI already wired up.
 *
 * Everything it does is `panelui-cli`'s scaffolder; this exists because
 * `npm create`, `pnpm create`, `yarn create` and `bun create` all resolve a
 * package called `create-<something>`, and that is the shape people reach for
 * when starting a project. Without it the only way in is `panelui-cli init`,
 * which reads like a command you run *in* a project rather than one that makes
 * one.
 *
 * It calls `create` directly rather than `init`. `init` decides between
 * retrofitting and scaffolding by looking for a package.json, which is the
 * right question for `panelui-cli init` and the wrong one here: a command
 * spelled `create` should create, even when it is run somewhere that already
 * has a project in it.
 */
import process from 'node:process';
import { create } from 'panelui-cli/init';
import { CliError, bold, dim, error, info, optionValue } from 'panelui-cli/ui';

const HELP = `
${bold('create-panelui-app')} — a new Expo app, with PanelUI already set up.

${bold('Usage')}
  npx create-panelui-app@latest [name] [options]

${bold('Options')}
  --template <name>    starter | minimal
  --theme <name>       panel | moon | grass
  --yes, -y            Accept every prompt
  --help, -h           This
  --version, -v        Print the version

${bold('Examples')}
  npx create-panelui-app@latest
  npx create-panelui-app@latest my-app --template starter --theme moon --yes
`;

function parseArgs(argv) {
  const options = { cwd: process.cwd(), yes: false, template: undefined, theme: undefined };
  let help = false;
  let version = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--yes':
      case '-y':
        options.yes = true;
        break;
      case '--help':
      case '-h':
        help = true;
        break;
      case '--version':
      case '-v':
        version = true;
        break;
      case '--template':
        options.template = optionValue(argv, i, arg, '<name>');
        i += 1;
        break;
      case '--theme':
        options.theme = optionValue(argv, i, arg, '<name>');
        i += 1;
        break;
      case '--name':
        options.name = optionValue(argv, i, arg, '<name>');
        i += 1;
        break;
      default:
        if (arg.startsWith('-')) throw new CliError(`Unknown option: ${arg}`);
        // The bare argument is the app's name, which is how every other
        // `create-*` is called: `npm create panelui-app my-app`.
        options.name ??= arg;
    }
  }

  return { options, help, version };
}

async function main() {
  const { options, help, version } = parseArgs(process.argv.slice(2));

  if (version) {
    const { default: pkg } = await import('./package.json', { with: { type: 'json' } });
    info(pkg.version);
    return;
  }

  if (help) {
    info(HELP);
    return;
  }

  await create(options);
}

main().catch((err) => {
  info('');

  if (err instanceof CliError) {
    error(err.message);
    if (err.hint) info(dim(`  ${err.hint}`));
    info('');
    process.exit(1);
  }

  error('Unexpected error:');
  console.error(err);
  process.exit(1);
});
