import './global.css';

import type { Metadata } from 'next';
import { Geist_Mono, Inter } from 'next/font/google';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Analytics } from '@vercel/analytics/next';
import { GoogleAnalytics } from '@/components/google-analytics';
import { LayoutLink } from '@/components/layout-link';
import { OpenPanel } from '@/components/openpanel';
import { WebMcp } from '@/components/web-mcp';
import { absoluteUrl, site } from '@/lib/site';
import { cn } from "@/lib/utils";

const interHeading = Inter({subsets:['latin'],variable:'--font-heading'});


/*
 * The `variable` names must be exactly --font-sans and --font-mono: the
 * design tokens read those, and Next starters default to --font-geist-sans,
 * which silently falls back to system UI. --font-heading is aliased to --font-sans
 * in global.css.
 */
const inter = Inter({subsets:['latin'],variable:'--font-sans'});
const geistMono = Geist_Mono({subsets:['latin'],variable:'--font-mono'});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  /*
   * `template` appends the brand to every child page's title, so a child must
   * never include the brand itself — that is what produced
   * "PanelUI — … — PanelUI" on the home page. A page that needs the brand in
   * its own title opts out with `title: { absolute }` rather than spelling it
   * twice.
   */
  title: {
    default: `${site.name} — ${site.titleTagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    'react native ui library',
    'expo ui components',
    'react native tailwind',
    'expo component library',
    'react native design system',
    'uniwind',
    'nativewind alternative',
    'react native bottom sheet',
    'react native dialog',
    'react native dark mode',
    'reanimated',
    'typescript',
  ],
  authors: [{ name: 'Khalid Abdi', url: site.repo }],
  creator: 'Khalid Abdi',
  alternates: { canonical: absoluteUrl('/') },
  /*
   * app/favicon.ico is deliberately not listed here. Next treats that one
   * filename specially — it serves it at the root and emits its `rel="icon"`
   * tag whatever this object says, so repeating it produces two tags for one
   * file with disagreeing `sizes`. app/icon.png gets no such treatment: naming
   * `icons` at all replaces the tag Next would have emitted for it, which is
   * why the PNGs below have to be written out.
   *
   * The root ICO is the point of all this. It is what a search engine falls
   * back to when it will not take a `rel="icon"` PNG, and having nothing there
   * is why results showed a blank globe beside the domain. The PNGs stay
   * because they are what a browser tab and an install prompt actually draw —
   * Google wants a square icon that is a multiple of 48px, and icon.png is 192.
   */
  icons: {
    icon: [
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    siteName: site.name,
    url: absoluteUrl('/'),
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  category: 'technology',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(inter.variable, interHeading.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      {/* `isolate` keeps Base UI portals layering against this root. */}
      <body className="isolate flex min-h-screen flex-col font-sans antialiased">
        <RootProvider components={{ Link: LayoutLink }}>{children}</RootProvider>
        {/*
          All three mount once here, because the root layout wraps every page
          and nothing else should mount any of them again.

          Three of them on purpose, measuring different things. Vercel Web
          Analytics is cookieless and needs no consent banner, so it is the one
          that will still be counting for visitors who decline or block the
          others; Google Analytics is what gives the long tail — acquisition,
          search terms, the funnel — that the Vercel dashboard does not;
          OpenPanel is the product-analytics view, where a question is about
          which components people actually read rather than where they arrived
          from.
        */}
        <Analytics />
        <GoogleAnalytics />
        <OpenPanel />
        {/*
          Offers the registry and the docs to an agent driving the browser.
          Renders nothing, and does nothing at all in a browser without the
          API — which is most of them.
        */}
        <WebMcp />
      </body>
    </html>
  );
}
