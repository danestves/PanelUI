import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { baseOptions } from '@/app/layout.config';
import { source } from '@/lib/source';

/**
 * The notebook layout, not the default docs one.
 *
 * `layouts/docs` has no persistent header on desktop — it sets
 * `--fd-header-height: 0px` and moves the nav links into the sidebar, which is
 * what duplicated them above the page tree. Notebook keeps a real top navbar
 * with the sidebar beneath it, which is the layout in the reference.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions}
      nav={{ ...baseOptions.nav, mode: 'top' }}
      /*
       * The tree is two flat groups already; nothing should render a toggle.
       *
       * `prefetch` is off because the tree is ~90 links and every one of them
       * is in the viewport at once. Left on, opening a single page fires an
       * RSC request for most of the sidebar — pages the reader never asks
       * for — and the router keys those by segment, so the same href is
       * fetched again for each context it renders in. It was two thirds of
       * the site's request volume.
       */
      sidebar={{ collapsible: false, prefetch: false }}
      tabMode="navbar"
      containerProps={{ style: { gridTemplate: PAGE_TREE_RIGHT } }}
    >
      {children}
    </DocsLayout>
  );
}

/*
 * The page tree on the right, the table of contents on the left.
 *
 * Notebook lays the page out as a five-column grid — gutter, sidebar, main,
 * toc, gutter — and there is no prop for which side the tree goes on, so this
 * is the same template with the two outer content columns swapped. The layout
 * spreads `containerProps.style` after its own, which is what makes overriding
 * it here supported rather than a fight with the component.
 *
 * `sidebar` still spans into the gutter beside it, as it did on the left: that
 * span is what lets the column bleed to the edge of the window instead of
 * stopping at the content width. The header keeps the middle three columns, so
 * it stays put whichever side the tree is on.
 *
 * The aside inside that area pins itself to the start edge; `#nd-sidebar` in
 * global.css turns it around to match. Both halves have to move together.
 */
const PAGE_COLUMN =
  'calc(var(--fd-layout-width,97rem) - var(--fd-sidebar-col) - var(--fd-toc-width))';

const PAGE_TREE_RIGHT = `". header header header ."
". toc-popover toc-popover sidebar sidebar"
". toc main sidebar sidebar" 1fr / minmax(min-content, 1fr) var(--fd-toc-width) minmax(0, ${PAGE_COLUMN}) var(--fd-sidebar-col) minmax(min-content, 1fr)`;
