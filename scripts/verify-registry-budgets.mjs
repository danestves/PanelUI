#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = path.resolve(HERE, '../apps/docs/public/r');

/*
 * These are capacity guards, not targets. At 137 items the generated registry
 * is 2.88 MB and its largest response is 96 KB. The ceilings leave room for
 * about 60 ordinary items, while still catching copied assets, bundled output,
 * or accidentally duplicated source before it reaches the docs CDN and CLI.
 */
export const REGISTRY_BUDGETS = Object.freeze({
  files: 200,
  totalBytes: 4_500_000,
  itemBytes: 150_000,
});

export function measureRegistry(directory) {
  const items = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({ file, bytes: fs.statSync(path.join(directory, file)).size }));
  if (items.length === 0) throw new Error('Registry contains no JSON items.');

  return {
    files: items.length,
    totalBytes: items.reduce((total, item) => total + item.bytes, 0),
    largest: items.reduce((largest, item) => (item.bytes > largest.bytes ? item : largest)),
  };
}

export function assertRegistryBudgets(metrics, budgets = REGISTRY_BUDGETS) {
  const exceeded = [];
  if (metrics.files > budgets.files) {
    exceeded.push(`files: ${metrics.files} > ${budgets.files}`);
  }
  if (metrics.totalBytes > budgets.totalBytes) {
    exceeded.push(`total bytes: ${metrics.totalBytes} > ${budgets.totalBytes}`);
  }
  if (metrics.largest.bytes > budgets.itemBytes) {
    exceeded.push(
      `largest item: ${metrics.largest.file} is ${metrics.largest.bytes} bytes > ${budgets.itemBytes}`
    );
  }
  if (exceeded.length > 0) {
    throw new Error(`Registry exceeds its size budget:\n${exceeded.join('\n')}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const metrics = measureRegistry(REGISTRY);
  assertRegistryBudgets(metrics);
  console.log(
    `Verified registry: ${metrics.files} files, ${metrics.totalBytes} total bytes, ` +
      `${metrics.largest.file} largest at ${metrics.largest.bytes} bytes.`
  );
}
