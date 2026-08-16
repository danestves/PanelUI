#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE = path.join(ROOT, 'apps/example');

/*
 * Baseline (Expo 57, 108 component catalogue): 4,161 modules, a 6,640,222
 * byte minified bundle, 33 assets / 1,019,361 bytes, eight route entries and
 * 7,661,810 output bytes. These are capacity guards with 6–50% headroom,
 * depending on how discrete the metric is, rather than targets to fill.
 */
export const EXAMPLE_EXPORT_BUDGETS = Object.freeze({
  modules: 4_400,
  bundleBytes: 7_100_000,
  assets: 40,
  assetBytes: 1_150_000,
  routes: 12,
  files: 45,
  totalBytes: 8_300_000,
});

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  });
}

function containedFile(root, relative) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error(`Export metadata escaped its output directory: ${relative}`);
  }
  return target;
}

export function measureExampleExport(outputDirectory, log, appDirectory = EXAMPLE) {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(outputDirectory, 'metadata.json'), 'utf8'),
  );
  const platforms = Object.keys(metadata.fileMetadata ?? {});
  if (platforms.join(',') !== 'android') {
    throw new Error(`Expected one Android export, received: ${platforms.join(', ')}`);
  }

  const android = metadata.fileMetadata.android;
  const bundle = containedFile(outputDirectory, android.bundle);
  const assets = android.assets.map((asset) => containedFile(outputDirectory, asset.path));
  if (new Set(assets).size !== assets.length) {
    throw new Error('Expo export metadata contains duplicate assets.');
  }
  const moduleMatch = log.match(/Android Bundled[^\n]*\(([\d,]+) modules\)/);
  if (!moduleMatch) throw new Error('Expo output did not report its module count.');

  const outputFiles = filesBelow(outputDirectory);
  const routeFiles = filesBelow(path.join(appDirectory, 'app'))
    .filter((file) => /\.[jt]sx?$/.test(file))
    .filter((file) => !path.basename(file).startsWith('_'));

  return {
    modules: Number(moduleMatch[1].replaceAll(',', '')),
    bundle: path.relative(outputDirectory, bundle).replaceAll(path.sep, '/'),
    bundleBytes: fs.statSync(bundle).size,
    assets: assets.length,
    assetBytes: assets.reduce((sum, file) => sum + fs.statSync(file).size, 0),
    routes: routeFiles.length,
    files: outputFiles.length,
    totalBytes: outputFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0),
  };
}

export function assertExampleExportBudgets(
  metrics,
  budgets = EXAMPLE_EXPORT_BUDGETS,
) {
  const exceeded = [];
  for (const key of [
    'modules',
    'bundleBytes',
    'assets',
    'assetBytes',
    'routes',
    'files',
    'totalBytes',
  ]) {
    if (metrics[key] > budgets[key]) {
      exceeded.push(`${key}: ${metrics[key]} > ${budgets[key]}`);
    }
  }
  if (exceeded.length) {
    throw new Error(`Example export exceeds its budget:\n${exceeded.join('\n')}`);
  }
}

export function formatExampleExport(metrics) {
  return (
    `Verified Android example export: ${metrics.modules} modules, ` +
    `${metrics.bundleBytes} bundle bytes (${metrics.bundle}), ` +
    `${metrics.assets} assets / ${metrics.assetBytes} asset bytes, ` +
    `${metrics.routes} routes, ${metrics.files} files / ${metrics.totalBytes} total bytes.`
  );
}

export function verifyExampleExport() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-expo-export-'));
  const { FORCE_COLOR: _forceColor, NO_COLOR: _noColor, ...baseEnv } = process.env;
  try {
    const result = spawnSync(
      process.execPath,
      [
        path.join(ROOT, 'node_modules/expo/bin/cli'),
        'export',
        '--platform',
        'android',
        '--output-dir',
        output,
        '--clear',
        // Hermes bytecode embeds a nondeterministic byte in otherwise identical
        // exports. Budget the stable, minified production JavaScript instead.
        '--no-bytecode',
        '--max-workers',
        '2',
      ],
      {
        cwd: EXAMPLE,
        encoding: 'utf8',
        env: { ...baseEnv, CI: '1', EXPO_OFFLINE: '1', NO_COLOR: '1' },
        maxBuffer: 20_000_000,
      },
    );
    const log = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Expo export failed with status ${result.status}:\n${log}`);
    }
    const metrics = measureExampleExport(output, log);
    assertExampleExportBudgets(metrics);
    console.log(formatExampleExport(metrics));
    return metrics;
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    verifyExampleExport();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
