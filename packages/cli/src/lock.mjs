import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { projectPath } from './config.mjs';

export const LOCK_FILE = 'panelui-lock.json';

export function digest(content) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

export function readLock(cwd) {
  const file = projectPath(cwd, LOCK_FILE, 'Lockfile path');
  if (!fs.existsSync(file)) return null;
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!value || ![1, 2].includes(value.version) || !value.files || Array.isArray(value.files)) {
      return null;
    }
    const filesValid = Object.values(value.files).every(
      (entry) => typeof entry?.item === 'string' && /^sha256:[a-f0-9]{64}$/.test(entry.digest)
    );
    if (!filesValid) return null;
    if (value.version === 1) return value;
    const rootsValid =
      value.roots &&
      !Array.isArray(value.roots) &&
      Object.values(value.roots).every(
        (closure) => Array.isArray(closure) && closure.every((item) => typeof item === 'string')
      );
    const legacyValid =
      Array.isArray(value.legacyFiles) && value.legacyFiles.every((file) => typeof file === 'string');
    return rootsValid && legacyValid ? value : null;
  } catch {
    return null;
  }
}

export function recordInstalled(cwd, writes, registry, closures) {
  const current = readLock(cwd);
  const lock = current?.version === 2
    ? current
    : {
        version: 2,
        files: current?.files ?? {},
        roots: {},
        legacyFiles: Object.keys(current?.files ?? {}),
      };
  lock.registry = registry;
  lock.roots = { ...lock.roots, ...closures };
  for (const write of writes) {
    const relative = write.relative.split(path.sep).join('/');
    lock.files[relative] = { item: write.item, digest: digest(write.content) };
  }
  const claimed = new Set(Object.values(closures).flat());
  lock.legacyFiles = lock.legacyFiles.filter(
    (relative) => !claimed.has(lock.files[relative]?.item)
  );
  writeLock(cwd, lock);
}

export function writeLock(cwd, lock) {
  const file = projectPath(cwd, LOCK_FILE, 'Lockfile path');
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(lock, null, 2) + '\n');
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
