import Image from 'next/image';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { GithubStars } from '@/components/github-stars';
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
      type: 'main',
      text: 'Components',
      // The index, not Button. This link is "show me what there is", and
      // answering it by dropping the reader into one arbitrary component's
      // page made them work out the rest from the sidebar.
      url: '/docs/components',
      active: 'nested-url',
    },
    {
      // Star count where available, a bare icon while the repo is private.
      type: 'custom',
      children: <GithubStars />,
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
