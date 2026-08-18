import fs from 'node:fs';
import path from 'node:path';

export const LIFECYCLE_CASES = [
  'default initialization', 'controlled acceptance', 'controlled rejection',
  'external reset', 'disabled path', 'prop replacement', 'unmount cleanup',
  'reduced motion', 'callback counts',
];

const testNames = (source) =>
  new Set([...source.matchAll(/\b(?:test|it)\(\s*(['"`])([^'"`\n]+)\1/g)].map((match) => match[2]));

export function validateLifecycleMatrices(root, matrices) {
  const errors = [];
  for (const [slug, matrix] of Object.entries(matrices)) {
    const keys = Object.keys(matrix.cases ?? {});
    for (const key of LIFECYCLE_CASES) {
      if (!String(matrix.cases?.[key] ?? '').trim()) errors.push(`${slug}: missing lifecycle case ${key}`);
    }
    for (const key of keys) if (!LIFECYCLE_CASES.includes(key)) errors.push(`${slug}: unknown lifecycle case ${key}`);
    if (!matrix.evidence?.length) errors.push(`${slug}: missing lifecycle evidence`);
    for (const item of matrix.evidence ?? []) {
      const absolute = path.join(root, item.file);
      if (!fs.existsSync(absolute)) { errors.push(`${slug}: missing evidence ${item.file}`); continue; }
      const names = testNames(fs.readFileSync(absolute, 'utf8'));
      for (const title of item.tests ?? []) if (!names.has(title)) errors.push(`${slug}: missing evidence test ${title}`);
    }
  }
  return errors;
}

export function loadLifecycleMatrices(root) {
  const file = path.join(root, 'lifecycle-matrices.json');
  const matrices = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = validateLifecycleMatrices(root, matrices);
  if (errors.length) throw new Error(errors.join('\n'));
  return matrices;
}
