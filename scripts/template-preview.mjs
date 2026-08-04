#!/usr/bin/env node
/**
 * Scaffold a template and run it against *this* checkout.
 *
 * A template pins `panelui-native: latest`, which is right for anyone
 * generating a project and wrong for anyone reviewing one from inside this
 * repository: `latest` is whatever was last published, so a template using a
 * component added in this branch fails with "Cannot read property … of
 * undefined" until the release goes out. Reviewing a template against a
 * version that predates it tells you nothing.
 *
 * So this scaffolds into `.template-preview/`, installs, and then swaps the
 * published package for the built one from `packages/panelui`. The template
 * itself is untouched — the substitution happens in the generated copy.
 *
 * Run the templates through this rather than starting one in place. A template
 * directory has no node_modules of its own by design.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIBRARY = path.join(ROOT, 'packages', 'panelui');

/*
 * Outside the repository, deliberately.
 *
 * A project generated *inside* a workspace resolves up into the workspace's
 * node_modules, and what it finds there is not what it installed — the Babel
 * plugin loaded for Worklets came from the monorepo root while the runtime
 * came from the project, and the two disagreed about their own version. None
 * of that happens to a real user, so testing it here would be testing the
 * wrong thing.
 */
const PREVIEW = path.join(os.tmpdir(), 'panelui-template-preview');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function main() {
  const passthrough = process.argv.slice(2);

  if (!fs.existsSync(path.join(LIBRARY, 'lib'))) {
    console.log('Building the library first — the preview links against lib/.\n');
    run('npm', ['run', 'build'], { cwd: ROOT });
  }

  fs.mkdirSync(PREVIEW, { recursive: true });

  run(
    'node',
    [path.join(ROOT, 'packages', 'cli', 'bin', 'panelui.mjs'), 'init', '--cwd', PREVIEW, ...passthrough],
    { cwd: ROOT, env: { ...process.env, PANELUI_TEMPLATE_DIR: path.join(ROOT, 'templates') } }
  );

  // Whichever project the run just made — there is only ever one that is new,
  // and the newest is it.
  const projects = fs
    .readdirSync(PREVIEW, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      at: fs.statSync(path.join(PREVIEW, entry.name)).mtimeMs,
    }))
    .sort((a, b) => b.at - a.at);

  if (!projects.length) return;

  const project = path.join(PREVIEW, projects[0].name);
  const installed = path.join(project, 'node_modules', 'panelui-native');

  if (!fs.existsSync(path.join(project, 'node_modules'))) {
    console.log('\nNo node_modules — install skipped, so nothing to link.');
    return;
  }

  fs.rmSync(installed, { recursive: true, force: true });
  // A copy rather than a symlink: Metro resolves a symlinked package's own
  // node_modules against its real path, which here is the monorepo root, and
  // ends up with two copies of React.
  fs.cpSync(LIBRARY, installed, {
    recursive: true,
    filter: (from) => !from.includes(`${path.sep}node_modules`),
  });

  console.log(`\n✓ Linked packages/panelui into ${projects[0].name} (this checkout, not npm)`);
  console.log(`\n  cd ${project}`);
  console.log('  npx expo start\n');
}

main();
