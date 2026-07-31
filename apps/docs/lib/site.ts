import aiComponents from '@/content/docs/ai-components/meta.json';
import components from '@/content/docs/components/meta.json';
import form from '@/content/docs/form/meta.json';

/**
 * How many components the library ships, counted rather than written down.
 *
 * It was written down three times, and by the time anyone noticed, the social
 * card claimed 26, the meta description and the JSON-LD claimed 39, and the
 * library shipped 74. A number that appears in marketing copy is exactly the
 * number nobody remembers to update, so this is read off the sidebar groups
 * `scripts/gen.mjs` generates: add a component, run `docs:generate`, and every
 * surface that quotes the count follows on the next build.
 *
 * The three groups are the ones holding things you render. Hooks and utilities
 * are documented in their own groups and deliberately not counted here.
 */
export const componentCount =
  components.pages.length + aiComponents.pages.length + form.pages.length;

/** Canonical site metadata, used by every page's SEO tags and the sitemap. */
export const site = {
  name: 'PanelUI',
  /** Override in the environment to point a preview deploy at its own host. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://panelui.dev',
  tagline: 'React Native UI components for Expo, styled with Tailwind CSS',
  /**
   * Shorter than `tagline`, for the `<title>` tag only. Google truncates a
   * title past roughly 60 characters, and `name` + `tagline` is 71 — so the
   * long form was being cut mid-phrase in the results it was written for.
   * `tagline` still runs in full on the social cards, which have the room.
   */
  titleTagline: 'React Native UI components for Expo',
  /**
   * Kept under 160 characters, which is where Google stops rendering a
   * description. The previous one ran to 270 and its last third — the Expo Go
   * claim, the best part — was never once displayed.
   */
  description:
    `An accessible React Native component library for Expo. ${componentCount} typed ` +
    'components, styled with Tailwind CSS, animated on the UI thread, and running in Expo Go.',
  package: 'panelui-native',
  repo: 'https://github.com/panel-ui/PanelUI',
  npm: 'https://www.npmjs.com/package/panelui-native',
  /**
   * Google Analytics measurement ID. Not a secret — it ships in the page
   * source either way — but it lives here so a fork or a preview deploy can
   * point at its own property instead of reporting into this one.
   */
  analyticsId: process.env.NEXT_PUBLIC_GA_ID ?? 'G-B7QYTQH288',
} as const;

/** Absolute URL for a path, for canonical tags and the sitemap. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, site.url).toString();
}
