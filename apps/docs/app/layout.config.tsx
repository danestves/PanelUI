import Image from 'next/image';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { GithubStars } from '@/components/github-stars';
import { LayoutLink } from '@/components/layout-link';
import { site } from '@/lib/site';

/** Shared nav config for the docs layout and the home layout. */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="inline-flex items-center gap-2">
        {/* Two marks, one per surface. Both render; CSS picks the one that
            reads against the current background, so the swap survives
            hydration and needs no JS. */}
        <Image
          src="/logo-light.png"
          alt=""
          width={26}
          height={26}
          className="dark:hidden"
          priority
        />
        <Image
          src="/logo-dark.png"
          alt=""
          width={26}
          height={26}
          className="hidden dark:block"
          priority
        />
        <span className="font-heading text-base font-semibold tracking-tight">
          {site.name}
        </span>
      </span>
    ),
    url: '/',
    /*
     * Components sits on the left, beside the wordmark, rather than in the row
     * of links on the right.
     *
     * `nav.children` is the only left-hand slot either layout offers: the
     * header renders it inside the same container as the title, while
     * everything in `links` goes into the `justify-end` group at the other end
     * of the bar. So this link lives here and not in `links` below — moving it
     * back means moving it between the two, not flipping a flag.
     *
     * It is deliberately not in `links`, which also means it is not in
     * `menuItems` — the mobile menu would otherwise list it twice, since the
     * notebook sidebar already renders the page tree it points at.
     *
     * `LayoutLink`, not `next/link`: this destination is repeated by the
     * persistent chrome, and the policy behind that wrapper is what stops every
     * page in the site prefetching it again.
     */
    children: (
      <LayoutLink
        href="/docs/components"
        // ms-6, because the wordmark ends where this begins. The nav title is
        // its own anchor with no trailing space of its own, so without a margin
        // the two read as one string.
        className="ms-6 text-sm text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground max-lg:hidden"
      >
        Components
      </LayoutLink>
    ),
  },
  /*
   * No `on` here, which means 'all' — and that is what puts these links in the
   * mobile menu.
   *
   * They were 'nav' to stop them being duplicated above the page tree in the
   * docs sidebar. But 'nav' is *only* the navbar: it leaves `menuItems` empty,
   * and `menuItems` is what both mobile menus are built from. The trigger
   * still rendered, so the landing page had a menu button that opened onto
   * nothing and no way to reach the docs on a phone.
   *
   * The duplication it was avoiding does not happen in this layout anyway —
   * the notebook sidebar renders these `lg:hidden`, above the tree on small
   * screens only, which is exactly where they are wanted.
   */
  links: [
    { type: 'main', text: 'Docs', url: '/docs', active: 'nested-url' },
    {
      // Star count where available, a bare icon while the repo is private.
      // Let Fumadocs own the anchor and list item. A custom item is inserted
      // directly under its desktop ul, producing invalid list markup.
      type: 'button',
      text: <GithubStars />,
      url: site.repo,
      external: true,
      secondary: true,
    },
    {
      type: 'button',
      text: 'Get started',
      url: '/docs',
      secondary: true,
    },
  ],
};
