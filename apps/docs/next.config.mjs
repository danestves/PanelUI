import { createMDX } from 'fumadocs-mdx/next';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  /*
   * A docs URL follows the folder its page is filed in, so regrouping a
   * component moves it. Anything that has been published — the README, the
   * landing page, other people's links — has to keep working, which is what
   * these are for.
   */
  async redirects() {
    return [
      {
        source: '/docs/components/shimmer',
        destination: '/docs/ai-components/shimmer',
        permanent: true,
      },
      // The landing page's grid links every component under /components, so an
      // AI one needs a way back to the folder it actually lives in.
      {
        source: '/docs/components/soundwave',
        destination: '/docs/ai-components/soundwave',
        permanent: true,
      },
      // Field moved out of Form: it is a layout kit every control composes
      // into, not a piece of form state.
      {
        source: '/docs/form/field',
        destination: '/docs/components/field',
        permanent: true,
      },
      // Theming gained neighbours — Colors, Fonts and Styling — and moved into
      // the section they share. It is the most linked-to page in the docs.
      {
        source: '/docs/theming',
        destination: '/docs/customization/theming',
        permanent: true,
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(config);
