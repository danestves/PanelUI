/** Generate a browsable inventory of every export from panelui-native's root entry. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const SRC = path.join(ROOT, 'packages/panelui/src');
const DOCS = path.join(ROOT, 'apps/docs/content/docs');
const META = JSON.parse(fs.readFileSync(path.join(HERE, 'meta.json'), 'utf8'));
const check = process.argv.includes('--check');

function sourceFor(from, specifier) {
  const base = path.resolve(path.dirname(from), specifier);
  for (const file of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(file)) return file;
  }
  throw new Error(`${from}: cannot resolve public export ${specifier}`);
}

function exportsOf(file, seen = new Set()) {
  if (seen.has(file)) throw new Error(`cyclic public export: ${file}`);
  seen.add(file);
  const source = fs.readFileSync(file, 'utf8');
  const records = [];
  const pattern = /export\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+'([^']+)'|export\s+\*\s+from\s+'([^']+)'/g;
  let match;
  while ((match = pattern.exec(source))) {
    if (match[4]) {
      records.push(...exportsOf(sourceFor(file, match[4]), new Set(seen)));
      continue;
    }
    const target = sourceFor(file, match[3]);
    for (const raw of match[2].split(',')) {
      const token = raw.trim();
      if (!token) continue;
      const type = Boolean(match[1]) || token.startsWith('type ');
      const name = token.replace(/^type\s+/, '').split(/\s+as\s+/).at(-1);
      records.push({ name, kind: type ? 'type' : 'value', source: path.relative(SRC, target) });
    }
  }
  if (/^\s*export\s+/m.test(source.replace(pattern, ''))) {
    throw new Error(`${file}: unsupported public export syntax`);
  }
  return records;
}

const exports = exportsOf(path.join(SRC, 'index.ts'));
const duplicate = exports.find((item, index) => exports.findIndex((other) => other.name === item.name) !== index);
if (duplicate) throw new Error(`duplicate public export: ${duplicate.name}`);

function category(source) {
  if (source.startsWith('components/')) return 'components';
  if (source.startsWith('hooks/')) return 'hooks';
  if (source.startsWith('utils/cn.') || source.startsWith('utils/color.') || source.startsWith('utils/time.')) return 'utilities';
  if (source.startsWith('icons/')) return 'icons';
  if (source.startsWith('providers/')) return 'providers';
  if (source.startsWith('theme/')) return 'theme';
  return 'foundations';
}

const modules = [];
for (const source of [...new Set(exports.map((item) => item.source))].sort()) {
  const slug = source.startsWith('components/')
    ? source.split('/')[1]
    : path.basename(source).startsWith('index.')
      ? path.basename(path.dirname(source))
      : source.split('/').at(-1).replace(/\.[^.]+$/, '');
  const symbols = exports.filter((item) => item.source === source).map(({ name, kind }) => ({ name, kind }));
  modules.push({ source, slug, category: category(source), symbols });
}

const componentDirs = fs.readdirSync(path.join(SRC, 'components')).filter((name) =>
  fs.existsSync(path.join(SRC, 'components', name, 'index.tsx'))
).sort();
const componentModules = modules.filter((item) => item.category === 'components');
const publicComponents = componentModules.map((item) => item.source.split('/')[1]).sort();
if (JSON.stringify(componentDirs) !== JSON.stringify(publicComponents)) {
  throw new Error('root component exports do not match component source directories');
}

const routeFor = (slug) => `${META[slug]?.[3]?.group ?? 'components'}/${slug}`;
for (const item of componentModules) {
  const slug = item.source.split('/')[1];
  if (!META[slug] || !fs.existsSync(path.join(DOCS, `${routeFor(slug)}.mdx`))) {
    throw new Error(`public component has no generated docs page: ${slug}`);
  }
}

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/docs/public/r/index.json'), 'utf8'));
const registryHooks = registry.filter((item) => item.type === 'registry:hook');
const publicSlugs = new Set(exports.filter((item) => item.kind === 'value').map((item) =>
  item.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
));
for (const item of registryHooks) {
  if (!publicSlugs.has(item.name)) throw new Error(`registry hook is not public: ${item.name}`);
  if (!fs.existsSync(path.join(DOCS, `hooks/${item.name}.mdx`))) {
    throw new Error(`public registry hook has no docs page: ${item.name}`);
  }
}
for (const required of ['utils/cn.ts', 'utils/color.ts', 'utils/time.ts']) {
  if (!modules.some((item) => item.source === required)) throw new Error(`missing public utility: ${required}`);
}

const groups = Object.fromEntries(
  ['components', 'hooks', 'utilities', 'providers', 'theme', 'foundations', 'icons'].map((name) => [
    name,
    modules.filter((item) => item.category === name),
  ])
);
const counts = {
  exports: exports.length,
  values: exports.filter((item) => item.kind === 'value').length,
  types: exports.filter((item) => item.kind === 'type').length,
  modules: modules.length,
  components: componentModules.length,
  hooks: registryHooks.length,
};
const inventory = JSON.stringify({ version: 1, counts, groups }, null, 2) + '\n';

const list = (symbols) => symbols.length ? symbols.map((item) => `\`${item.name}\``).join(', ') : '—';
const moduleSection = (item, link) => {
  const values = item.symbols.filter((symbol) => symbol.kind === 'value');
  const types = item.symbols.filter((symbol) => symbol.kind === 'type');
  return `## ${link ? `[${item.slug}](${link})` : item.slug}\n\n**Values:** ${list(values)}\n\n**Types:** ${list(types)}`;
};
const frontmatter = (title, description) => `---\ntitle: ${title}\ndescription: ${description}\n---\n\n`;
const generated = '{/* Generated by scripts/build-api-reference.mjs. Do not edit. */}\n\n';
const outputs = new Map();
outputs.set(path.join(ROOT, 'apps/docs/lib/public-api.generated.json'), inventory);
outputs.set(path.join(DOCS, 'reference/meta.json'), JSON.stringify({
  title: 'API Reference', pages: ['index', 'components', 'hooks', 'utilities', 'foundations', 'icons'],
}, null, 2) + '\n');
outputs.set(path.join(DOCS, 'reference/index.mdx'), frontmatter(
  'Public API', `Every supported root export from panelui-native — ${counts.exports} symbols across ${counts.modules} modules.`
) + generated + `The package root exposes **${counts.values} values** and **${counts.types} types**. Task-oriented component guides remain the best place to start; these indexes answer exactly what is public.\n\n<Cards>\n  <Card title="Components" href="/docs/reference/components" />\n  <Card title="Hooks" href="/docs/reference/hooks" />\n  <Card title="Utilities" href="/docs/reference/utilities" />\n  <Card title="Providers, theme and primitives" href="/docs/reference/foundations" />\n  <Card title="Icons" href="/docs/reference/icons" />\n</Cards>\n`);
outputs.set(path.join(DOCS, 'reference/components.mdx'), frontmatter(
  'Component API', `${counts.components} public component modules, linked to their guides and per-module export tables.`
) + generated + componentModules.map((item) => {
  const slug = item.source.split('/')[1];
  return `- [${slug}](/docs/${routeFor(slug)}) — ${item.symbols.length} exports`;
}).join('\n') + '\n');
outputs.set(path.join(DOCS, 'reference/hooks.mdx'), frontmatter(
  'Hooks API', 'Standalone public hooks, their values and option/result types.'
) + generated + `All ${registryHooks.length} documented hooks:\n\n${registryHooks.map((item) =>
  `- [${item.name}](/docs/hooks/${item.name})`
).join('\n')}\n\n` + groups.hooks.map((item) => moduleSection(item, `/docs/hooks/${item.slug}`)).join('\n\n') + '\n');
outputs.set(path.join(DOCS, 'reference/utilities.mdx'), frontmatter(
  'Utilities API', 'The complete public cn, color and time utility surface.'
) + generated + groups.utilities.map((item) => moduleSection(item, item.slug === 'cn' ? '/docs/utilities/cn' : null)).join('\n\n') + '\n');
outputs.set(path.join(DOCS, 'reference/foundations.mdx'), frontmatter(
  'Foundations API', 'Providers, themes, primitives and optional native bridges.'
) + generated + [...groups.providers, ...groups.theme, ...groups.foundations].map((item) => moduleSection(item)).join('\n\n') + '\n');
outputs.set(path.join(DOCS, 'reference/icons.mdx'), frontmatter(
  'Icons API', 'Every icon and icon support export available from the package root.'
) + generated + groups.icons.map((item) => moduleSection(item, '/docs/customization/icons')).join('\n\n') + '\n');

for (const item of componentModules) {
  const slug = item.source.split('/')[1];
  const file = path.join(DOCS, `${routeFor(slug)}.mdx`);
  const marker = '\n## Public exports\n';
  const base = fs.readFileSync(file, 'utf8').split(marker)[0].trimEnd();
  // The blank line before the heading is not cosmetic. `marker` starts the
  // section, and a page ending in a JSX close tag — `</Callout>` — followed
  // straight by `##` gives MDX a heading glued to an element rather than a
  // heading. Splitting on `marker` still finds the old shape, so pages written
  // without it are rewritten rather than doubled.
  outputs.set(file, `${base}\n${marker}\n${generated}${moduleSection(item).replace(/^## [^\n]+\n\n/, '')}\n`);
}

for (const [file, content] of outputs) {
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) throw new Error(`stale API reference: ${path.relative(ROOT, file)}`);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
console.log(`api reference: ${counts.exports} exports (${counts.values} values, ${counts.types} types), ${counts.modules} modules`);
