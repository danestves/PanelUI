/**
 * Writes the component half of the agent skill:
 *
 * - `skills/panelui/components.md` — the index, every component with a line on
 *   what it is and a link to its reference.
 * - `skills/panelui/components/<slug>.md` — one reference per component: the
 *   import line, the anatomy, every prop with its type, default and
 *   documentation, the variants, the compound parts, and a worked example.
 *
 * Generated for the reason everything else here is: a hand-written list of a
 * hundred components is wrong by the next release, and a skill that names a
 * component which does not exist is worse than one that names none. It runs in
 * the `docs:generate` chain, so adding a component updates the skill in the
 * same command that writes its page.
 *
 * ## Why the props are written out rather than linked to
 *
 * The skill used to be a list of names and a line each, with an instruction to
 * fetch the documentation over HTTP before using anything. That is a round trip
 * per component for an agent that has one, and nothing at all for an agent that
 * does not — and plenty of them run with no network tool. Everything needed was
 * already sitting in `api.json`, generated from the library's own TypeScript.
 *
 * One file per component rather than one big one, because an agent reaching for
 * `BottomSheet` should read `BottomSheet` and not the other hundred and twenty.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadUsage } from './load-usage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const SKILL = path.join(ROOT, 'skills/panelui');
const INDEX = path.join(SKILL, 'components.md');
const MANIFEST = path.join(SKILL, 'SKILL.md');
const PAGES = path.join(SKILL, 'components');

const meta = JSON.parse(fs.readFileSync(path.join(HERE, 'meta.json'), 'utf8'));
const api = JSON.parse(fs.readFileSync(path.join(HERE, 'api.json'), 'utf8'));
const usage = loadUsage(path.join(HERE, 'usage'), Object.keys(meta));

/** The same sections the documentation index uses, in the same order. */
const SECTIONS = {
  actions: 'Actions',
  forms: 'Forms and input',
  overlays: 'Overlays',
  navigation: 'Navigation',
  layout: 'Layout and structure',
  data: 'Data',
  charts: 'Charts',
  feedback: 'Feedback and status',
  media: 'Media and motion',
  ai: 'AI components',
};

const groupOf = (entry) => entry[3]?.group ?? 'components';

function categoryOf(entry) {
  const group = groupOf(entry);
  if (group === 'charts') return 'charts';
  if (group === 'ai-components') return 'ai';
  return entry[3]?.category ?? 'layout';
}

/**
 * Markdown table cells cannot hold a pipe or a line break, and a prop's type is
 * full of the first — `'never' | 'focus' | 'always'` is a union, not four
 * columns.
 */
function cell(text) {
  return String(text ?? '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

function defaultFor(entry, field) {
  const value = entry.variantDefaults?.[field.name] ?? entry.defaults?.[field.name];
  if (value === undefined) return field.optional ? '—' : '**required**';
  return `\`${String(value).replace(/^'(.*)'$/, '$1')}\``;
}

function propsTable(entry, iface) {
  if (!iface.fields.length) return '';
  const rows = iface.fields.map(
    (field) =>
      `| \`${field.name}\` | \`${cell(field.type)}\` | ${defaultFor(entry, field)} | ${
        cell(field.doc) || '—'
      } |`
  );
  const extendsLine = iface.extends ? `\nExtends \`${cell(iface.extends)}\`.\n` : '';
  return `#### \`${iface.name}\`\n${extendsLine}
| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
${rows.join('\n')}`;
}

function variantList(entry) {
  const names = Object.keys(entry.variants ?? {});
  if (!names.length) return '';
  const lines = names.map((name) => {
    const values = entry.variants[name]
      .map((value) =>
        entry.variantDefaults?.[name] === value ? `\`${value}\` *(default)*` : `\`${value}\``
      )
      .join(', ');
    return `- **${name}** — ${values}`;
  });
  return `### Variants\n\n${lines.join('\n')}`;
}

function partsList(slug, entry) {
  const parts = entry.parts ?? [];
  if (!parts.length) return '';
  const described = usage[slug]?.parts ?? {};
  const name = meta[slug][0];
  const lines = parts.map((part) =>
    described[part]
      ? `- \`${name}.${part}\` — ${described[part].replace(/\r?\n+/g, ' ')}`
      : `- \`${name}.${part}\``
  );
  return `### Parts\n\n${lines.join('\n')}`;
}

function page(slug) {
  const entry = api[slug];
  const info = meta[slug];
  const use = usage[slug] ?? {};
  const name = info[0];
  const group = groupOf(info);
  const options = info[3] ?? {};

  const stability = options.alpha
    ? '\n> **Alpha.** This API is still moving.\n'
    : options.beta
      ? '\n> **Beta.** This API has settled but is not promised yet.\n'
      : '';

  const sections = [
    `# ${name}`,
    `${info[1]}${stability}`,
    `\`\`\`tsx
import { ${name} } from 'panelui-native';
// Copied into the project with the CLI instead:
// import { ${name} } from '@/components/ui/${slug}';
\`\`\``,
  ];

  if (use.anatomy) sections.push(`### Anatomy\n\n\`\`\`tsx\n${use.anatomy}\n\`\`\``);
  else if (use.usage) sections.push(`### Usage\n\n\`\`\`tsx\n${use.usage}\n\`\`\``);

  const variants = variantList(entry);
  if (variants) sections.push(variants);

  const parts = partsList(slug, entry);
  if (parts) sections.push(parts);

  const tables = (entry.interfaces ?? []).map((iface) => propsTable(entry, iface)).filter(Boolean);
  if (tables.length) sections.push(`### Props\n\n${tables.join('\n\n')}`);

  const example = use.examples?.[0];
  if (example) {
    const description = example.description ? `\n${example.description}\n` : '';
    sections.push(
      `### Example — ${example.title}\n${description}\n\`\`\`tsx\n${example.code}\n\`\`\``
    );
  }

  if (use.notes) sections.push(`### Notes\n\n${use.notes}`);

  sections.push(
    `---\n\nFull page, with every example: https://panelui.dev/docs/${group}/${slug}`
  );

  return sections.join('\n\n') + '\n';
}

fs.rmSync(PAGES, { recursive: true, force: true });
fs.mkdirSync(PAGES, { recursive: true });
for (const slug of Object.keys(meta)) {
  if (!api[slug]) throw new Error(`build-skill: no extracted API for ${slug}`);
  fs.writeFileSync(path.join(PAGES, `${slug}.md`), page(slug));
}

const sections = Object.entries(SECTIONS)
  .map(([category, heading]) => {
    const rows = Object.entries(meta)
      .filter(([, entry]) => categoryOf(entry) === category)
      .sort(([, a], [, b]) => a[0].localeCompare(b[0]))
      .map(([slug, entry]) => {
        const options = entry[3] ?? {};
        // Worth flagging: an alpha API is one an agent should be cautious
        // about building on, and a beta one is worth a mention.
        const note = options.alpha ? ' *(alpha)*' : options.beta ? ' *(beta)*' : '';
        return `| \`${entry[0]}\`${note} | ${entry[1]} | [${slug}](./components/${slug}.md) |`;
      });

    if (!rows.length) return null;
    return `## ${heading}\n\n| Component | What it is | Reference |\n| --- | --- | --- |\n${rows.join('\n')}`;
  })
  .filter(Boolean);

const count = Object.keys(meta).length;

const index = `# Every component

Generated from the library's own TypeScript — do not edit by hand.

${count} component modules. The **Reference** column links to a file in this skill holding that
component's anatomy, every prop with its type and default, its variants, its compound parts and a
worked example. **Read it before using a component you have not used in this session** — the props
there are read from the source, and anything you remember is a guess.

There is no need to fetch anything over the network. If you would rather, the same page is at
\`https://panelui.dev/llms.mdx/<group>/<slug>\`, with every example rather than one.

${sections.join('\n\n')}
`;

fs.writeFileSync(INDEX, index);

/*
 * The skill's own version, stamped from the library's. It says which release
 * the props in `components/` were read from, which is the only thing that makes
 * a copied skill checkable against the package a project has installed — and a
 * number written by hand in the frontmatter is wrong the first time anybody
 * cuts a release without remembering it.
 */
const version = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'packages/panelui/package.json'), 'utf8')
).version;
const manifest = fs.readFileSync(MANIFEST, 'utf8');
const stamped = manifest.replace(/^(\s*version:\s*).+$/m, `$1${version}`);
if (stamped === manifest && !manifest.includes(`version: ${version}`)) {
  throw new Error('build-skill: SKILL.md has no metadata.version line to stamp');
}
fs.writeFileSync(MANIFEST, stamped);

/*
 * The Claude Code plugin carries the same version, for the same reason: it
 * bundles this skill, so a number that disagreed with the one above would tell
 * somebody the props came from a release they did not.
 */
const PLUGIN = path.join(ROOT, '.claude-plugin/plugin.json');
const plugin = JSON.parse(fs.readFileSync(PLUGIN, 'utf8'));
if (plugin.version !== version) {
  plugin.version = version;
  fs.writeFileSync(PLUGIN, JSON.stringify(plugin, null, 2) + '\n');
}

console.log(
  `skill: ${count} components -> skills/panelui/components.md and components/*.md (v${version})`
);
