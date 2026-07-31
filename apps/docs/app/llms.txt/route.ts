import type {
  Item as TreeItem,
  Node as TreeNode,
} from 'fumadocs-core/page-tree';
import { source } from '@/lib/source';
import { absoluteUrl, site } from '@/lib/site';

/**
 * `/llms.txt` — the whole documentation as one index, for a model rather than
 * a reader.
 *
 * The convention is a heading, a one-line summary of what the project is, and
 * then nothing but grouped links with a sentence each. A model landing here
 * should be able to decide which page answers the question in front of it and
 * fetch that one, without crawling ninety-nine pages to find out. The per-page
 * raw Markdown it would then fetch is served by `app/llms.mdx/[[...slug]]`;
 * this is the map, that is the territory.
 *
 * Generated from the same page tree the sidebar is built from, so a component
 * added to `meta.json` appears here without anyone remembering to add it. That
 * is the only reason this is a route and not a checked-in text file.
 *
 * Two deliberate departures from Fumadocs' built-in `llms()` helper, which is
 * otherwise exactly this: it emits section separators as `- **Name**` list
 * items rather than `##` headings, and it emits relative URLs. Absolute URLs
 * matter more than they look — this file is read detached from its origin, and
 * a model holding `/docs/components/button` has no way to resolve it back to a
 * host it can fetch.
 */
export const dynamic = 'force-static';

/**
 * This file's own path. It is in the sidebar — that is how a reader finds it —
 * and the sidebar is what this is generated from, so without skipping it the
 * index lists itself as a descriptionless link to where the reader already is.
 */
const SELF = '/llms.txt';

/**
 * The tree carries React elements, not strings: the status-badges plugin in
 * `lib/source.tsx` replaces a page's `name` with a fragment so the sidebar can
 * draw its "New"/"Alpha" pill. Rendering that into a text file would emit
 * `[object Object]`, so titles and descriptions are read back off the page's
 * own frontmatter and `node.name` is trusted only when it really is a string —
 * which is the case for separators, the one node type no plugin decorates.
 */
function titleOf(node: TreeNode): string {
  if (node.type === 'page') {
    const page = source.getNodePage(node);
    if (page?.data.title) return page.data.title;
  }
  return typeof node.name === 'string' ? node.name : '';
}

/** Narrower than `titleOf` on purpose: a separator has no description to read. */
function descriptionOf(node: TreeItem): string {
  const page = source.getNodePage(node);
  if (page?.data.description) return page.data.description.trim();
  return typeof node.description === 'string' ? node.description.trim() : '';
}

/** `- [Title](https://…): description`, with the description dropped when absent. */
function itemOf(node: TreeItem): string {
  const link = `- [${titleOf(node)}](${absoluteUrl(node.url)})`;
  const description = descriptionOf(node);
  return description ? `${link}: ${description}` : link;
}

export function GET(): Response {
  const lines: string[] = [`# ${site.name}`, '', `> ${site.description}`];

  /*
   * A folder's own pages are flattened in beside it rather than nested. The
   * grouping a reader needs is already carried by the `---Section---`
   * separators in `content/docs/meta.json`, and a second level of indentation
   * under it only makes the list harder to scan.
   */
  const walk = (nodes: TreeNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'separator') {
        lines.push('', `## ${titleOf(node) || 'Docs'}`, '');
      } else if (node.type === 'folder') {
        if (node.index) lines.push(itemOf(node.index));
        walk(node.children);
      } else if (node.url !== SELF) {
        lines.push(itemOf(node));
      }
    }
  };

  walk(source.pageTree.children);

  return new Response(`${lines.join('\n').trim()}\n`, {
    headers: {
      // text/plain, not text/markdown: this is fetched as often by a person
      // pasting a URL into a chat as by a crawler, and a browser offers to
      // download anything it cannot render inline.
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
