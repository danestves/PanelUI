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
    if (!value || value.version !== 1 || !value.files || Array.isArray(value.files)) return null;
    return Object.values(value.files).every(
      (entry) => typeof entry?.item === 'string' && /^sha256:[a-f0-9]{64}$/.test(entry.digest)
    ) ? value : null;
  } catch {
    return null;
  }
}

export function recordInstalled(cwd, writes, registry) {
  const lock = readLock(cwd) ?? { version: 1, files: {} };
  lock.registry = registry;
  for (const write of writes) {
    const relative = write.relative.split(path.sep).join('/');
    lock.files[relative] = { item: write.item, digest: digest(write.content) };
  }
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
