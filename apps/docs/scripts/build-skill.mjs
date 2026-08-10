/**
 * Writes `skills/panelui/components.md` — the component list the agent skill
 * reads — from the same meta.json the documentation is generated from.
 *
 * Generated for the reason everything else here is: a hand-written list of a
 * hundred components is wrong by the next release, and a skill that names a
 * component which does not exist is worse than one that names none. It runs in
 * the `docs:generate` chain, so adding a component updates the skill in the
 * same command that writes its page.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(ROOT, 'skills/panelui/components.md');

const meta = JSON.parse(fs.readFileSync(path.join(HERE, 'meta.json'), 'utf8'));

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
        return `| \`${entry[0]}\`${note} | ${entry[1]} | \`${groupOf(entry)}/${slug}\` |`;
      });

    if (!rows.length) return null;
    return `## ${heading}\n\n| Component | What it is | Docs |\n| --- | --- | --- |\n${rows.join('\n')}`;
  })
  .filter(Boolean);

const page = `# Every component

Generated from the documentation — do not edit by hand.

${Object.keys(meta).length} components. The **Docs** column is the path under
\`https://panelui.dev/llms.mdx/\`, which returns the page as markdown: anatomy, every prop with
its type, the variants, and worked examples. Fetch it before using a component you have not used
in this session — the props tables there are read from the library's TypeScript, and anything you
remember is a guess.

${sections.join('\n\n')}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, page);
console.log(`skill: ${Object.keys(meta).length} components -> skills/panelui/components.md`);
