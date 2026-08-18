#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST = 'docs/accessibility-native-journeys.json';
export const REQUIRED_JOURNEYS = [
  'adjustable-seams',
  'controlled-rejection',
  'overlay-focus',
  'large-text',
  'swipe-dismissal',
  'chart-exploration',
  'screen-reader-actions',
];

export function validateJourneyManifest(manifest) {
  const errors = [];
  if (manifest?.version !== 1) errors.push('Journey manifest version must be 1.');
  if (JSON.stringify(manifest?.platforms) !== JSON.stringify(['ios', 'android'])) {
    errors.push('Journey platforms must be exactly ios and android.');
  }
  const ids = manifest?.journeys?.map((journey) => journey.id) ?? [];
  if (new Set(ids).size !== ids.length) errors.push('Journey ids must be unique.');
  for (const id of REQUIRED_JOURNEYS) {
    if (!ids.includes(id)) errors.push(`Missing required native journey: ${id}`);
  }
  for (const journey of manifest?.journeys ?? []) {
    if (!journey.title?.trim() || !journey.expected?.trim()) {
      errors.push(`Journey ${journey.id ?? '<unknown>'} needs a title and expectation.`);
    }
  }
  return errors;
}

export function receiptTemplate(manifest, commit = '<release-commit>') {
  return {
    version: 1,
    commit,
    runs: manifest.platforms.map((platform) => ({
      platform,
      osVersion: '',
      device: '',
      build: '',
      tester: '',
      date: new Date().toISOString().slice(0, 10),
      results: Object.fromEntries(
        manifest.journeys.map(({ id }) => [id, { status: 'pending', evidence: '', notes: '' }]),
      ),
    })),
  };
}

export function validateNativeReceipt(receipt, manifest) {
  const errors = [];
  if (receipt?.version !== 1) errors.push('Receipt version must be 1.');
  if (!/^[0-9a-f]{7,40}$/.test(receipt?.commit ?? '')) {
    errors.push('Receipt commit must be a 7-40 character Git SHA.');
  }
  const runs = Array.isArray(receipt?.runs) ? receipt.runs : [];
  for (const platform of manifest.platforms) {
    const matches = runs.filter((run) => run.platform === platform);
    if (matches.length !== 1) {
      errors.push(`Receipt needs exactly one ${platform} run.`);
      continue;
    }
    const run = matches[0];
    for (const field of ['osVersion', 'device', 'build', 'tester', 'date']) {
      if (typeof run[field] !== 'string' || !run[field].trim()) {
        errors.push(`${platform} run needs ${field}.`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(run.date ?? '')) {
      errors.push(`${platform} run date must use YYYY-MM-DD.`);
    }
    const journeyIds = new Set(manifest.journeys.map(({ id }) => id));
    for (const id of Object.keys(run.results ?? {})) {
      if (!journeyIds.has(id)) errors.push(`${platform} run has unexpected journey: ${id}`);
    }
    for (const { id } of manifest.journeys) {
      const result = run.results?.[id];
      if (!['pass', 'fail'].includes(result?.status)) {
        errors.push(`${platform}/${id} needs pass or fail status.`);
      }
      if (typeof result?.evidence !== 'string' || !result.evidence.trim()) {
        errors.push(`${platform}/${id} needs linked or local evidence.`);
      }
      if (result?.status === 'fail') {
        errors.push(`${platform}/${id} failed: ${result.notes || 'no notes'}`);
      }
    }
  }
  const knownPlatforms = new Set(manifest.platforms);
  for (const run of runs) {
    if (!knownPlatforms.has(run.platform)) errors.push(`Unexpected platform run: ${run.platform}`);
  }
  return errors;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function run() {
  const manifest = readJson(path.join(ROOT, MANIFEST));
  const manifestErrors = validateJourneyManifest(manifest);
  if (manifestErrors.length) throw new Error(manifestErrors.join('\n'));
  const receiptFlag = process.argv.indexOf('--receipt');
  if (process.argv.includes('--template')) {
    console.log(JSON.stringify(receiptTemplate(manifest), null, 2));
    return;
  }
  if (receiptFlag < 0 || !process.argv[receiptFlag + 1]) {
    console.log(`Native accessibility journeys: ${manifest.journeys.length} journeys on iOS and Android.`);
    console.log('Create a local receipt with: npm run test:a11y:native -- --template');
    return;
  }
  const receipt = readJson(path.resolve(process.argv[receiptFlag + 1]));
  const errors = validateNativeReceipt(receipt, manifest);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Native accessibility receipt passed for iOS and Android.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
