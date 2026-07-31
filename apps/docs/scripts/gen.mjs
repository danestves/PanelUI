import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Repo root, three levels up from apps/docs/scripts. */
const ROOT = path.resolve(HERE, '../../..');

const S = HERE;
const api = JSON.parse(fs.readFileSync(`${S}/api.json`, 'utf8'));
const meta = JSON.parse(fs.readFileSync(`${S}/meta.json`, 'utf8'));
const usage = JSON.parse(fs.readFileSync(`${S}/usage.json`, 'utf8'));
const contentDir = path.join(HERE, '../content/docs');

/** Where a component's page goes, and what its sidebar group is called. */
const GROUPS = {
  components: 'Components',
  'ai-components': 'AI Components',
  form: 'Form',
};
const DEFAULT_GROUP = 'components';

/** The version being documented, for the sidebar dots below. */
const libVersion = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'packages/panelui/package.json'), 'utf8')
).version;

/**
 * How many minor releases a component keeps its sidebar dot.
 *
 * Deriving this from a version rather than hand-writing a `status` field means
 * nobody has to remember to take the badge off — which is the failure mode
 * every "new" marker has, and the reason half of them end up permanent.
 */
const BADGE_FOR_MINORS = 3;

/** True while `version` is recent enough to still be worth marking. */
function isRecent(version) {
  if (!version) return false;
  const [thenMajor, thenMinor] = version.split('.').map(Number);
  const [major, minor] = libVersion.split('.').map(Number);
  if (major !== thenMajor) return major < thenMajor;
  return minor - thenMinor < BADGE_FOR_MINORS;
}

/**
 * Which dot a component gets, if any.
 *
 * `addedIn` wins over `updatedIn`: a component that arrived and then changed
 * inside the same window is still news, and two dots on one row is noise. Both
 * expire on the same schedule — `updatedIn` is bumped by hand when a
 * component's API changes, and forgetting to clear it costs nothing.
 */
function statusOf({ alpha, beta, addedIn, updatedIn }) {
  // `alpha` and `beta` win and never expire: they state how settled the API
  // is, not which release it landed in, so they come off the page when someone
  // decides it has settled and not a version sooner. Alpha outranks beta so a
  // half-finished promotion reads as the more cautious of the two.
  if (alpha) return 'alpha';
  if (beta) return 'beta';
  if (isRecent(addedIn)) return 'new';
  if (isRecent(updatedIn)) return 'updated';
  return null;
}

/** Options are an optional 4th element, so the common entry stays a triple. */
const optionsOf = (entry) => entry[3] ?? {};
const groupOf = (entry) => optionsOf(entry).group ?? DEFAULT_GROUP;

for (const group of Object.keys(GROUPS)) {
  fs.mkdirSync(path.join(contentDir, group), { recursive: true });
}

const esc = (s) => String(s).replace(/\|/g, '\\|');
const inlineCode = (s) => '`' + String(s).replace(/`/g, '') + '`';

/**
 * A framed screenshot. Used both for the page's own preview, under the intro,
 * and for an example that is easier shown than described.
 */
const previewTag = (p) =>
  `<Preview\n  src="${p.src}"\n  alt="${p.alt}"\n  width={${p.width}}\n  height={${p.height}}${p.caption ? `\n  caption="${p.caption}"` : ''}\n/>`;

/**
 * A framed screen recording, for a component whose point is that it moves —
 * a still of a sweep is a still of nothing.
 */
const previewVideoTag = (p) =>
  `<PreviewVideo\n  src="${p.src}"${p.poster ? `\n  poster="${p.poster}"` : ''}\n  alt="${p.alt}"\n  width={${p.width}}\n  height={${p.height}}${p.caption ? `\n  caption="${p.caption}"` : ''}\n/>`;

/**
 * A labelled schematic of the component's structure, drawn once for a dark
 * page and once for a light one.
 *
 * Not a `Preview`: that frames a portrait shot of a device and holds it narrow,
 * which is right for a screenshot and wrong for a wide diagram whose whole job
 * is to be read.
 */
const diagramTag = (d) =>
  `<Diagram\n  src="${d.src}"\n  srcLight="${d.srcLight}"\n  alt="${d.alt}"\n  width={${d.width}}\n  height={${d.height}}${d.caption ? `\n  caption="${d.caption}"` : ''}\n/>`;

/**
 * The shot that sits above a worked example or version — a recording when the
 * demo moves, a screenshot when it doesn't, and nothing when neither is given.
 * Prefers `previewVideo` so a component can carry both and get the moving one.
 */
const demoMedia = (x) =>
  x.previewVideo
    ? `\n\n${previewVideoTag(x.previewVideo)}`
    : x.preview
      ? `\n\n${previewTag(x.preview)}`
      : '';

/** Props inherited from React Native, documented once rather than per row. */
const INHERITED = /^(ViewProps|TextProps|ViewProps, VariantProps|.*VariantProps.*)$/;

function propsTable(iface, defaults, byInterface = {}, variantDefaults = {}) {
  /*
   * Where an interface destructures its own props, that destructuring is the
   * whole truth: a prop missing from it has no default, and must not inherit
   * one from a sibling component that happens to use the same prop name. Only
   * an interface with no block of its own falls back to the file-wide guess.
   */
  const own = byInterface[iface.name];
  const scoped = own !== undefined;
  const rows = iface.fields
    .filter((f) => f.name !== 'children')
    .map((f) => {
      const resolved = scoped
        ? (own[f.name] ?? variantDefaults[f.name])
        : defaults[f.name];
      const def = resolved !== undefined ? inlineCode(resolved) : '—';
      return `| ${inlineCode(f.name)} | ${inlineCode(esc(f.type))} | ${def} | ${esc(f.doc || '')} |`;
    });
  if (!rows.length) return null;
  return ['| Prop | Type | Default | Description |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

let count = 0;
for (const [slug, entry] of Object.entries(meta)) {
  const [name, summary, keyword] = entry;
  const options = optionsOf(entry);
  const c = api[slug];
  if (!c) { console.error('missing api for', slug); continue; }
  const u = usage[slug] ?? {};

  const parts = c.parts.length ? c.parts.map((p) => `${name}.${p}`) : [];
  // A single string here would spread character by character (`"useState"` →
  // `u, s, e, …`), so coerce a lone extra import up to a one-element array.
  const extra = Array.isArray(u.extraImports)
    ? u.extraImports
    : u.extraImports
      ? [u.extraImports]
      : [];
  const imports = [name, ...extra];

  const sections = [];

  /*
   * A screenshot of the component running on a device, directly under the
   * intro — the first thing on the page should be what the thing looks like,
   * not a paragraph about it.
   */
  const preview = u.preview
    ? `\n\n${previewTag(u.preview)}`
    : u.previewVideo
      ? `\n\n${previewVideoTag(u.previewVideo)}`
      : '';

  const status = statusOf(options);

  sections.push(`---
title: ${name}
description: ${summary}${status ? `\nstatus: ${status}` : ''}
---

${u.intro ?? summary}${preview}

## Installation

${name} ships with the library — no separate install.

\`\`\`tsx
import { ${imports.join(', ')} } from 'panelui-native';
\`\`\`

Or copy the source into your project, to own and edit it:

\`\`\`bash
npx panelui-cli@latest add ${slug}
\`\`\`

## Usage

\`\`\`tsx
${u.usage ?? `<${name} />`}
\`\`\``);

  if (parts.length) {
    sections.push(`## Composition

\`\`\`tsx
${u.anatomy ?? `<${name}>\n  ${parts.map((p) => `<${p}>…</${p}>`).join('\n  ')}\n</${name}>`}
\`\`\`

${u.partNotes ?? parts.map((p) => `- **\`${p}\`** — ${u.parts?.[p.split('.')[1]] ?? 'See props below.'}`).join('\n')}${
  /*
   * Diagrams land here, under the parts they name, rather than at the top of
   * the page. The shot above the fold is of the component running; a labelled
   * schematic answers a different question, and it only answers it next to the
   * list of names it is labelling.
   */
  u.diagrams?.length ? `\n\n${u.diagrams.map(diagramTag).join('\n\n')}` : ''
}`);
  }

  // Worked examples, one heading each. This is the section people actually
  // read — a prop table tells you a prop exists, an example tells you what to
  // write.
  if (u.examples?.length) {
    sections.push(`## Examples

${u.examples.map((ex) => [
  `### ${ex.title}`,
  ex.description ? `\n\n${ex.description}` : '',
  // A shot of the example itself, above its code — for the ones where the
  // result is the point and the snippet is just how you get there.
  demoMedia(ex),
  `\n\n\`\`\`tsx\n${ex.code}\n\`\`\``,
].join('')).join('\n\n')}`);
  }

  /*
   * The full-screen demos in the example app, written out with their code.
   *
   * A component whose behaviour only shows at full height is listed on its own
   * screen there rather than rendered inline — and until now the docs said
   * nothing about any of them, so the one place a reader could find out what a
   * version *is* was to install the example app and go looking. Each entry is
   * the same demo, described and with the code you would write for it.
   */
  if (u.versions?.length) {
    sections.push(`## Versions

${u.versions.map((v) => [
  `### ${v.title}`,
  v.description ? `\n\n${v.description}` : '',
  demoMedia(v),
  `\n\n\`\`\`tsx\n${v.code}\n\`\`\``,
].join('')).join('\n\n')}`);
  }

  /*
   * `tv()` variant keys are an implementation detail, and only some of them
   * are public props on the root. A key can be internal state the component
   * derives for itself, or a prop that belongs to a compound part rather than
   * the root — documenting either as `<Name key="value">` sends readers to
   * write something that does not exist. STATE_KEYS covers the ones every
   * component names the same way; `hideVariants` in usage.json covers the rest.
   */
  const STATE_KEYS = ['checked', 'disabled', 'completed', 'isDisabled', 'active', 'selected'];
  const hidden = new Set([...STATE_KEYS, ...(u.hideVariants ?? [])]);
  /*
   * The other direction: a variant prop the `tv()` does not carry. Loader
   * picks an animation from `variant`, and not one of the nine values is a
   * class name — so there is nothing for the parser to find, and the values a
   * reader most needs listed are the ones it cannot list. `extraVariants`
   * declares them by hand, after which they behave like any other key.
   */
  const declared = { ...c.variants, ...(u.extraVariants ?? {}) };
  const variantKeys = Object.entries(declared).filter(
    ([k]) => !['true', 'false'].includes(k) && !hidden.has(k)
  );
  if (variantKeys.length) {
    sections.push(`## Variants

${variantKeys.map(([k, opts]) => {
  // A `tv()` default arrives bare; one read off the component's own
  // destructuring still has the quotes it was written with.
  const def = String(c.defaults[k] ?? '').replace(/^'(.*)'$/, '$1');
  const list = opts.map((o) => `- \`${o}\`${def === o ? ' *(default)*' : ''}`).join('\n');
  // A snippet under every variant key, so the list is copy-pasteable rather
  // than something you have to translate into JSX yourself.
  const snippet = u.variantCode?.[k]
    ?? opts.map((o) => `<${name} ${k}="${o}">…</${name}>`).join('\n');
  // Recordings or shots of individual variant values, each captioned with the
  // value it shows — for the keys where the difference is easier seen than read.
  const media = (u.variantMedia?.[k] ?? []).map(demoMedia).join('');
  return `### \`${k}\`\n\n${list}${media}\n\n\`\`\`tsx\n${snippet}\n\`\`\``;
}).join('\n\n')}`);
  }

  const tables = c.interfaces
    .map((i) => ({
      i,
      t: propsTable(i, c.defaults, c.byInterface ?? {}, c.variantDefaults ?? {}),
    }))
    .filter((x) => x.t);
  if (tables.length) {
    sections.push(`## API Reference

${tables.map(({ i, t }) => {
  const label = i.name.replace(/Props$/, '');
  // A name starting with the component's is assumed to be a compound part —
  // `FooBarProps` is `Foo.Bar`. Not always true: a sibling exported in its own
  // right shares the prefix without being a part of it, so `interfaceNames`
  // lets usage.json name those itself.
  const inferred = label === name ? name : `${name}.${label.replace(new RegExp('^' + name), '')}`;
  const heading = u.interfaceNames?.[i.name] ?? inferred;
  return `### ${heading.replace(/\.$/, '')}\n\n${t}`;
}).join('\n\n')}

Every part also accepts the underlying React Native props (\`ViewProps\` or \`TextProps\`) and a \`className\` for Tailwind utilities.`);
  }

  if (u.notes) sections.push(`## Notes\n\n${u.notes}`);

  fs.writeFileSync(
    path.join(contentDir, groupOf(entry), `${slug}.mdx`),
    sections.join('\n\n') + '\n'
  );
  count++;
}

/*
 * One meta.json per group, listing only the slugs in it. Written from the same
 * source as the pages, so a component cannot be filed in one place and listed
 * in another — and a page left behind by a regroup is deleted rather than
 * quietly kept in the sidebar.
 */
for (const [group, title] of Object.entries(GROUPS)) {
  const pages = Object.entries(meta)
    .filter(([, entry]) => groupOf(entry) === group)
    .map(([slug]) => slug);

  const dir = path.join(contentDir, group);
  fs.writeFileSync(
    path.join(dir, 'meta.json'),
    JSON.stringify({ title, pages }, null, 2) + '\n'
  );

  const keep = new Set([...pages.map((slug) => `${slug}.mdx`), 'meta.json']);
  for (const file of fs.readdirSync(dir)) {
    if (!keep.has(file)) fs.rmSync(path.join(dir, file));
  }
}
console.log('wrote', count, 'component pages');
