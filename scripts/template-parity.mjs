#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const MANIFEST = path.join(ROOT, 'templates', 'parity.json');
const GENERATED_DIRECTORIES = new Set(['node_modules', '.expo']);

function filesBelow(root, relative = '') {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && GENERATED_DIRECTORIES.has(entry.name)) return [];
    const next = path.posix.join(relative, entry.name);
    return entry.isDirectory() ? filesBelow(root, next) : [next];
  });
}

function jsonDifferences(left, right, prefix = '') {
  if (Object.is(left, right)) return [];
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right) ? [] : [prefix];
  }
  if (
    left === null ||
    right === null ||
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    Array.isArray(left) ||
    Array.isArray(right)
  ) {
    return [prefix];
  }
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].flatMap((key) =>
    jsonDifferences(left[key], right[key], prefix ? `${prefix}.${key}` : key)
  );
}

export function validateTemplateParity(templateRoot, manifest) {
  const [first, ...rest] = manifest.templates;
  if (!first || rest.length !== 1) {
    throw new Error('Template parity currently requires exactly two templates.');
  }
  const second = rest[0];
  const overlayPaths = Object.keys(manifest.overlays);
  const failures = [];

  for (const template of manifest.templates) {
    const expected = new Set([
      ...manifest.shared,
      ...overlayPaths,
      ...(manifest.unique[template] ?? []),
    ]);
    const directory = path.join(templateRoot, template);
    if (!fs.existsSync(directory)) {
      failures.push(`${template}: template directory is missing`);
      continue;
    }
    const actual = new Set(filesBelow(directory).sort());
    for (const file of expected) {
      if (!actual.has(file)) failures.push(`${template}: missing ${file}`);
    }
    for (const file of actual) {
      if (!expected.has(file)) failures.push(`${template}: unexpected ${file}`);
    }
  }

  for (const file of manifest.shared) {
    const left = path.join(templateRoot, first, file);
    const right = path.join(templateRoot, second, file);
    if (fs.existsSync(left) && fs.existsSync(right) && !fs.readFileSync(left).equals(fs.readFileSync(right))) {
      failures.push(`shared file drifted: ${file}`);
    }
  }

  for (const [file, overlay] of Object.entries(manifest.overlays)) {
    const paths = manifest.templates.map((template) => path.join(templateRoot, template, file));
    if (paths.some((candidate) => !fs.existsSync(candidate))) continue;
    let actual;
    try {
      actual = jsonDifferences(
        JSON.parse(fs.readFileSync(paths[0], 'utf8')),
        JSON.parse(fs.readFileSync(paths[1], 'utf8'))
      ).sort();
    } catch (error) {
      failures.push(`${file}: invalid JSON (${error.message})`);
      continue;
    }
    const expected = [...overlay.differences].sort();
    if (actual.join('\n') !== expected.join('\n')) {
      failures.push(
        `${file}: overlay drifted (expected ${expected.join(', ') || 'none'}; found ${actual.join(', ') || 'none'})`
      );
    }
  }

  if (failures.length) throw new Error(`Template parity failed:\n${failures.join('\n')}`);
  return {
    shared: manifest.shared.length,
    overlays: overlayPaths.length,
    unique: Object.values(manifest.unique).reduce((count, files) => count + files.length, 0),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const result = validateTemplateParity(path.dirname(MANIFEST), manifest);
  console.log(
    `Template parity verified: ${result.shared} shared files, ${result.overlays} overlays, ${result.unique} template-specific files.`
  );
}
