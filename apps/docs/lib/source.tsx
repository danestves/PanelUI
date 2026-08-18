import type { ReactNode } from 'react';
import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { statusBadgesPlugin } from 'fumadocs-core/source/status-badges';

/**
 * The marks a sidebar `icon` can resolve to.
 *
 * A section that is about somebody else's product is the one place a mark
 * earns its keep: "Integrations" says nothing on its own, and the logo says
 * which integration before the row is read. Everything else in this sidebar is
 * about the library and is named for what it is, so nothing else has one.
 *
 * Drawn inline rather than fetched. The sidebar renders on the server and the
 * mark is four paths; a request for it would be four paths and a round trip.
 */
const ICONS: Record<string, ReactNode> = {
  neon: (
    <svg
      viewBox="0 0 317 116"
      role="img"
      aria-label="Neon"
      className="size-4 shrink-0"
      fill="currentColor"
    >
      <path d="M0 21.4C0 9.6 9.6 0 21.4 0h73.2C106.4 0 116 9.6 116 21.4v66.5c0 12.2-15.4 17.6-22.9 8L71 67.2v37.6c0 6.2-5 11.2-11.2 11.2H21.4C9.6 116 0 106.4 0 94.6V21.4Zm21.4-4.5a4.5 4.5 0 0 0-4.5 4.5v73.2a4.5 4.5 0 0 0 4.5 4.5h32.7V63.9c0-12.2 15.4-17.6 22.9-8L99.1 89V21.4a4.5 4.5 0 0 0-4.5-4.5H21.4Z" />
    </svg>
  ),
};

/**
 * The marks a `status` can resolve to. Anything else renders nothing.
 *
 * A `text` turns the mark into a small labelled pill instead of a bare dot —
 * "updated" carries the word because, unlike a brand-new component, the reader
 * has to be told *what* the mark means before it is worth acting on.
 */
const DOTS: Record<string, { label: string; text?: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-500' },
  updated: {
    label: 'Updated',
    text: 'Update',
    /*
     * Full-strength foreground, not the muted one. The pill sets its own
     * background, and muted-on-muted lands at 4.46:1 — under the 4.5:1 this
     * text needs at 10px. The grey comes from the fill; the word on top of it
     * has to be readable.
     */
    className: 'border border-fd-border bg-fd-muted text-fd-foreground',
  },
  /*
   * Alpha outranks both, and is the only one set by hand: it says the API is
   * still moving, which is a promise about the future rather than a fact about
   * a version, so nothing can derive it and nothing should expire it.
   *
   * Purple because it has to be distinguishable from the blue "new" dot at a
   * glance — the two often apply to the same component, and reading one as the
   * other is the whole failure mode. Light, because a warning that shouts is a
   * warning people stop seeing.
   */
  alpha: {
    label: 'Alpha — the API may still change',
    text: 'Alpha',
    className:
      'border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:border-purple-400/40 dark:bg-purple-400/15 dark:text-purple-300',
  },
  /*
   * Beta is where a component goes once its API has stopped moving but has not
   * been through enough use to promise it never will. It ranks below alpha and
   * above the derived dots, and is set and cleared by hand for the same reason.
   *
   * Amber rather than a second purple: alpha and beta are the two marks most
   * likely to be confused, and a component only ever carries one of them, so
   * they gain nothing from looking related and lose the distinction that
   * matters — whether the API is still moving under you.
   */
  beta: {
    label: 'Beta — the API is settling but not final',
    text: 'Beta',
    className:
      'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300',
  },
};

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  plugins: [
    /*
     * Resolves an `icon` string in a folder's meta.json or a page's
     * frontmatter to a rendered mark. Written out rather than imported: the
     * only icon plugin the package exports maps names onto a general-purpose
     * icon set, and a section named after a product wants that product's mark.
     */
    {
      name: 'panelui:icon',
      transformPageTree: {
        folder(node) {
          if (typeof node.icon === 'string') node.icon = ICONS[node.icon] ?? undefined;
          return node;
        },
        file(node) {
          if (typeof node.icon === 'string') node.icon = ICONS[node.icon] ?? undefined;
          return node;
        },
      },
    },
    /*
     * Blue dot for a component that has just arrived, a grey "Update" pill for
     * one that changed under someone already using it.
     *
     * The two are not equals, and are marked differently on purpose. "New" is
     * worth a glance from anyone, so a wordless coloured dot carries it while
     * the sidebar is being scanned rather than read. "Updated" is worth a look
     * *only if you already have the component* — a bare grey dot cannot say
     * that, so it spells the word out, in grey and not a second saturated hue
     * so it never competes with a genuinely new arrival.
     *
     * The `status` frontmatter is generated from each component's `addedIn` and
     * `updatedIn` versions and disappears three minor releases later, so
     * nothing here has to be cleaned up by hand.
     */
    statusBadgesPlugin({
      renderBadge: (status) => {
        const dot = DOTS[status];
        if (!dot) return null;
        if (dot.text) {
          return (
            <span
              role="img"
              aria-label={dot.label}
              className={`ms-1.5 inline-flex shrink-0 items-center rounded px-1 py-0.5 align-middle text-[10px] font-medium uppercase leading-none tracking-wide ${dot.className}`}
            >
              {dot.text}
            </span>
          );
        }
        return (
          <span
            role="img"
            aria-label={dot.label}
            className={`ms-1.5 inline-block size-1.5 shrink-0 rounded-full align-middle ${dot.className}`}
          />
        );
      },
    }),
  ],
});
