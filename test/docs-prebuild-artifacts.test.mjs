/**
 * The production build has to generate every file it reads.
 *
 * `apps/docs/scripts/api.json` is gitignored, so it exists on a developer's
 * machine — left behind by the last `docs:generate` — and does not exist on a
 * clean checkout. A build step that reads it without a step that writes it
 * therefore passes locally and fails on the deploy, which is the one place
 * nobody is watching: the docs deploy runs *after* the tag exists, and the
 * workflow that fires it reports success as soon as the hook is accepted.
 *
 * That is not hypothetical. v0.87.0 shipped, the site's build died on exactly
 * this, and panelui.dev served 0.86.1 — so two charts that had been documented,
 * generated and committed were simply missing from the site, with every gate in
 * the repository green.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const docs = path.join(root, 'apps/docs');

const pkg = JSON.parse(fs.readFileSync(path.join(docs, 'package.json'), 'utf8'));
const ignored = fs
  .readFileSync(path.join(docs, '.gitignore'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

/** The scripts a chain runs, in order, as `scripts/<name>.mjs`. */
function chain(command) {
  return [...command.matchAll(/node\s+(\S+\.mjs)/g)].map((match) => match[1]);
}

/** Which of the gitignored artifacts a script reads, and which it writes. */
function touches(file) {
  const source = fs.readFileSync(path.join(docs, file), 'utf8');
  const reads = new Set();
  const writes = new Set();
  for (const artifact of ignored) {
    const name = path.basename(artifact);
    if (!source.includes(name)) continue;
    if (/writeFileSync\([^)]*/.test(source) && source.includes(`${name}'`)) {
      // Crude, but the only writer of an artifact names it beside a write call.
      if (new RegExp(`writeFileSync\\([^;]*${name.replace('.', '\\.')}`).test(source)) {
        writes.add(artifact);
        continue;
      }
    }
    if (new RegExp(`readFileSync\\([^;]*${name.replace('.', '\\.')}`).test(source)) {
      reads.add(artifact);
    }
  }
  return { reads, writes };
}

test('the production build generates every gitignored file it reads', () => {
  const steps = chain(pkg.scripts.prebuild);
  assert.ok(steps.length > 0, 'prebuild runs no scripts — has it been renamed?');

  const written = new Set();
  for (const step of steps) {
    const { reads, writes } = touches(step);
    for (const artifact of reads) {
      assert.ok(
        written.has(artifact),
        `apps/docs/${step} reads ${artifact}, which is gitignored and is not ` +
          `written by any earlier step of \`prebuild\`. It will exist locally ` +
          `and be missing on the deploy. Add the generator that writes it ` +
          `before this step.`
      );
    }
    for (const artifact of writes) written.add(artifact);
  }
});

test('docs:generate and prebuild agree about what has to be generated', () => {
  // `docs:generate` is what a developer runs and `prebuild` is what the deploy
  // runs. A generator in one and not the other is the drift this whole file is
  // about, so the deploy chain may never be the shorter list of *generators*.
  const generate = new Set(chain(pkg.scripts['docs:generate']));
  const prebuild = chain(pkg.scripts.prebuild);

  for (const step of prebuild) {
    assert.ok(
      generate.has(step),
      `apps/docs/${step} runs on the deploy but not in \`docs:generate\`, so ` +
        `nothing a developer runs exercises it.`
    );
  }
});
