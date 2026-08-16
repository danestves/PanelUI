import fs from 'node:fs';
import path from 'node:path';
import { applyAliases, detectProject, projectPath, requireConfig, targetPath } from './config.mjs';
import { digest, LOCK_FILE, readLock, writeLock } from './lock.mjs';
import { collectDependencies, dependencyClosures, resolve } from './registry.mjs';
import { installDependencies } from './patch.mjs';
import { unifiedDiff } from './diff.mjs';
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
  // Components installed before the lock recorded roots are still the user's to
  // update. Their files sit in `legacyFiles` because no closure claims them,
  // which says nothing about whether they were asked for — so each such item is
  // a root too. Without this, the first `add` after an upgrade migrates the
  // lock to v2 and silently narrows `update` to whatever was added since.
  const adopted =
    lock.version === 2
      ? lock.legacyFiles.map((relative) => lock.files[relative]?.item).filter(Boolean)
      : [];
  const roots =
    lock.version === 2 ? [...new Set([...Object.keys(lock.roots), ...adopted])] : installed;
  const requested = names.length ? names : roots;
  const unknown = requested.filter((name) => !roots.includes(name));
  if (unknown.length) {
    fail(`Not tracked as a requested root: ${unknown.join(', ')}.`, 'Use `add` for new components.');
  }
  if (!requested.length) fail(`No tracked roots in ${LOCK_FILE}.`);

  if (lock.version === 1) {
    warn(
      `${LOCK_FILE} v1 cannot prune former dependencies safely. Re-run \`add <root>\` before dependencies change to record requested roots.`
    );
  }

  const registry = options.registry ?? config.registry;
  const items = await resolve(registry, requested);
  const resolvedItems = new Set(items.map((item) => item.name));
  const closures = dependencyClosures(items, requested);
  const nextRoots = lock.version === 2 ? { ...lock.roots, ...closures } : null;
  const protectedItems = new Set(Object.values(nextRoots ?? {}).flat());
  const legacyFiles = new Set(lock.version === 2 ? lock.legacyFiles : Object.keys(lock.files));
  const ownershipChanged =
    lock.version === 2 && JSON.stringify(lock.roots) !== JSON.stringify(nextRoots);
  const candidates = [];
  for (const item of items) {
    for (const file of item.files) {
      const destination = targetPath(cwd, config, file.path);
      const relative = path.relative(cwd, destination).split(path.sep).join('/');
      const content = applyAliases(file.content, config);
      const tracked = lock.files[relative];
      const current = fs.existsSync(destination) ? fs.readFileSync(destination, 'utf8') : null;
      let status;
      if (current === content) status = 'current';
      else if (current === null) status = tracked ? 'conflict' : 'add';
      else if (!tracked || digest(current) !== tracked.digest) status = 'conflict';
      else status = 'update';
      candidates.push({ item: item.name, destination, relative, current, content, status });
    }
  }

  const incoming = new Set(candidates.map((file) => file.relative));
  for (const [relative, tracked] of Object.entries(lock.files)) {
    if (incoming.has(relative)) continue;
    const removedUpstream = resolvedItems.has(tracked.item);
    const orphaned =
      lock.version === 2 && !legacyFiles.has(relative) && !protectedItems.has(tracked.item);
    if (!removedUpstream && !orphaned) continue;
    const destination = projectPath(cwd, relative, 'Tracked file path');
    const current = fs.existsSync(destination) ? fs.readFileSync(destination, 'utf8') : null;
    candidates.push({
      item: tracked.item,
      destination,
      relative,
      current,
      status: current !== null && digest(current) === tracked.digest ? 'remove' : 'conflict',
    });
  }

  info('');
  info(`Checking ${requested.map(bold).join(', ')}`);
  info('');
  for (const file of candidates) {
    const marker = { current: '·', add: '+', update: '~', remove: '-', conflict: '!' }[file.status];
    const note = file.status === 'conflict' ? ' (modified)' : file.status === 'remove' ? ' (removed upstream)' : '';
    info(`  ${marker} ${file.relative}${dim(note)}`);
  }

  const safe = candidates.filter(
    (file) => file.status === 'add' || file.status === 'update' || file.status === 'remove'
  );
  const conflicts = candidates.filter((file) => file.status === 'conflict');
  const preview = options.check || options.dryRun;
  const project = detectProject(cwd);
  const { dependencies } = collectDependencies(items);
  const missing = dependencies.filter((dependency) => !(dependency in project.deps));
  if (missing.length) info(dim(`  + install ${missing.join(', ')}`));
  if (safe.length) {
    info('');
    safe.forEach((file, index) => {
      info(unifiedDiff(file.relative, file.current, file.status === 'remove' ? null : file.content));
      if (index < safe.length - 1) info('');
    });
  }
  if (conflicts.length) {
    warn(`${conflicts.length} modified or untracked file${conflicts.length === 1 ? '' : 's'} left alone.`);
  }

  if (!preview && (safe.length || missing.length || ownershipChanged)) {
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
    if (safe.length || ownershipChanged) {
      const nextLock = structuredClone(lock);
      nextLock.registry = registry;
      for (const file of candidates.filter((entry) => entry.status !== 'conflict')) {
        if (file.status === 'remove') delete nextLock.files[file.relative];
        else nextLock.files[file.relative] = { item: file.item, digest: digest(file.content) };
      }
      if (nextLock.version === 2) {
        nextLock.roots = nextRoots;
        nextLock.legacyFiles = nextLock.legacyFiles.filter(
          (relative) => Object.hasOwn(nextLock.files, relative)
        );
      }
      writeLock(cwd, nextLock);
      if (safe.length) success(`Applied ${safe.length} file change${safe.length === 1 ? '' : 's'}`);
      else success('Updated dependency ownership metadata.');
    }
  } else if (!preview) {
    if (!conflicts.length) success('Tracked component files are current.');
  } else if (safe.length || missing.length || ownershipChanged) {
    const count = safe.length + missing.length + (ownershipChanged ? 1 : 0);
    info(dim(`${count} safe update${count === 1 ? '' : 's'} available; nothing written.`));
  } else if (!conflicts.length) {
    success('Tracked component files are current.');
  }

  if ((preview && (safe.length || missing.length || ownershipChanged)) || conflicts.length) {
    process.exitCode = 1;
  }
  info('');
}
