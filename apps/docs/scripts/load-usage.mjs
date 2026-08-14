import fs from 'node:fs';
import path from 'node:path';

/**
 * Load one usage record per component. The envelope repeats the slug so a copy
 * or bad rename cannot silently replace another component's documentation.
 */
export function loadUsage(directory, expectedSlugs) {
  const expected = new Set(expectedSlugs);
  const records = new Map();
  const failures = [];

  const entries = fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    // Whatever the platform leaves lying around is not an authoring mistake.
    // Opening this folder in Finder writes a `.DS_Store` into it, and treating
    // that as a stray module fails `docs:generate` for everybody on a Mac with
    // an error about an artifact they did not create and cannot see.
    if (entry.name.startsWith('.')) continue;

    if (!entry.isFile() || path.extname(entry.name) !== '.json') {
      failures.push(`unexpected artifact: ${entry.name}`);
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(directory, entry.name), 'utf8'));
    } catch (error) {
      failures.push(`${entry.name}: invalid JSON (${error.message})`);
      continue;
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      failures.push(`${entry.name}: usage module must be an object`);
      continue;
    }

    const { slug, ...usage } = parsed;
    if (typeof slug !== 'string' || slug.length === 0) {
      failures.push(`${entry.name}: missing string slug`);
      continue;
    }
    if (records.has(slug)) failures.push(`${entry.name}: duplicate slug ${slug}`);
    else records.set(slug, usage);
    if (!expected.has(slug)) failures.push(`${entry.name}: unknown slug ${slug}`);
    if (entry.name !== `${slug}.json`) {
      failures.push(`${entry.name}: filename must match slug ${slug}`);
    }
  }

  for (const slug of expectedSlugs) {
    if (!records.has(slug)) failures.push(`missing usage module: ${slug}.json`);
  }
  if (failures.length > 0) {
    throw new Error(`Invalid usage modules:\n${failures.join('\n')}`);
  }

  // Meta order is the aggregate contract consumed by gen.mjs.
  return Object.fromEntries(expectedSlugs.map((slug) => [slug, records.get(slug)]));
}
