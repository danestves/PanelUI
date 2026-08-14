import fs from 'node:fs';
import path from 'node:path';
import { applyAliases, detectProject, projectPath, requireConfig, targetPath } from './config.mjs';
import { digest, LOCK_FILE, readLock, writeLock } from './lock.mjs';
import { collectDependencies, resolve } from './registry.mjs';
import { installDependencies } from './patch.mjs';
import { bold, confirm, dim, fail, info, success, warn } from './ui.mjs';

export async function update(names, options) {
  const cwd = options.cwd;
  const config = requireConfig(cwd);
  const lock = readLock(cwd);
  if (!lock) {
    fail(
      `No usable ${LOCK_FILE} here, so existing files cannot be proven unchanged.`,
      'Re-run `add <name> --overwrite` once for components you want the CLI to track.'
    );
  }

  const installed = [...new Set(Object.values(lock.files).map((entry) => entry.item))];
  const requested = names.length ? names : installed;
  const unknown = requested.filter((name) => !installed.includes(name));
  if (unknown.length) {
    fail(`Not tracked as installed: ${unknown.join(', ')}.`, 'Use `add` for new components.');
  }
  if (!requested.length) fail(`No tracked components in ${LOCK_FILE}.`);

  const registry = options.registry ?? config.registry;
  const items = await resolve(registry, requested);
  const candidates = [];
  for (const item of items) {
    for (const file of item.files) {
      const destination = targetPath(cwd, config, file.path);
      const relative = path.relative(cwd, destination).split(path.sep).join('/');
      const content = applyAliases(file.content, config);
      const tracked = lock.files[relative];
      const current = fs.existsSync(destination) ? fs.readFileSync(destination, 'utf8') : null;
      let status = 'update';
      if (current === content) status = 'current';
      else if (current === null) status = tracked ? 'conflict' : 'update';
      else if (!tracked || digest(current) !== tracked.digest) status = 'conflict';
      candidates.push({ item: item.name, destination, relative, content, status });
    }
  }

  const incoming = new Set(candidates.map((file) => file.relative));
  for (const [relative, tracked] of Object.entries(lock.files)) {
    if (!requested.includes(tracked.item) || incoming.has(relative)) continue;
    const destination = projectPath(cwd, relative, 'Tracked file path');
    const current = fs.existsSync(destination) ? fs.readFileSync(destination, 'utf8') : null;
    candidates.push({
      item: tracked.item,
      destination,
      relative,
      status: current !== null && digest(current) === tracked.digest ? 'remove' : 'conflict',
    });
  }

  info('');
  info(`Checking ${requested.map(bold).join(', ')}`);
  info('');
  for (const file of candidates) {
    const marker = { current: '·', update: '~', remove: '-', conflict: '!' }[file.status];
    const note = file.status === 'conflict' ? ' (modified)' : file.status === 'remove' ? ' (removed upstream)' : '';
    info(`  ${marker} ${file.relative}${dim(note)}`);
  }

  const safe = candidates.filter((file) => file.status === 'update' || file.status === 'remove');
  const conflicts = candidates.filter((file) => file.status === 'conflict');
  const preview = options.check || options.dryRun;
  const project = detectProject(cwd);
  const { dependencies } = collectDependencies(items);
  const missing = dependencies.filter((dependency) => !(dependency in project.deps));
  if (missing.length) info(dim(`  + install ${missing.join(', ')}`));
  if (conflicts.length) {
    warn(`${conflicts.length} modified or untracked file${conflicts.length === 1 ? '' : 's'} left alone.`);
  }

  if (!preview && (safe.length || missing.length)) {
    if (safe.length && !(await confirm(`Apply ${safe.length} file change${safe.length === 1 ? '' : 's'}?`, options))) {
      info(dim('Cancelled.'));
      return;
    }
    await installDependencies(cwd, missing, { ...options, isExpo: project.isExpo });
    for (const file of safe) {
      if (file.status === 'remove') fs.rmSync(file.destination);
      else {
        fs.mkdirSync(path.dirname(file.destination), { recursive: true });
        fs.writeFileSync(file.destination, file.content);
      }
    }
    if (safe.length) {
      const nextLock = structuredClone(lock);
      nextLock.registry = registry;
      for (const file of candidates.filter((entry) => entry.status !== 'conflict')) {
        if (file.status === 'remove') delete nextLock.files[file.relative];
        else nextLock.files[file.relative] = { item: file.item, digest: digest(file.content) };
      }
      writeLock(cwd, nextLock);
      success(`Applied ${safe.length} file change${safe.length === 1 ? '' : 's'}`);
    }
  } else if (!preview) {
    if (!conflicts.length) success('Tracked component files are current.');
  } else if (safe.length || missing.length) {
    const count = safe.length + missing.length;
    info(dim(`${count} safe update${count === 1 ? '' : 's'} available; nothing written.`));
  } else if (!conflicts.length) {
    success('Tracked component files are current.');
  }

  if ((preview && (safe.length || missing.length)) || conflicts.length) process.exitCode = 1;
  info('');
}
