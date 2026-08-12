import { OpenPanelComponent } from '@openpanel/nextjs';
import { site } from '@/lib/site';

/**
 * OpenPanel analytics, mounted once in the root layout so it covers every page.
 *
 * It renders two `next/script` tags and nothing else, which is why it can be
 * called from a server component without a `use client` boundary.
 *
 * What each flag turns on:
 *
 * - `trackScreenViews` — a screen view per route. The App Router changes routes
 *   without a document load, so without this only the first page of a visit is
 *   ever counted.
 * - `trackOutgoingLinks` — clicks on links to another host. This is how the npm
 *   page and the repo links get attributed; they leave the site, so nothing
 *   else sees them.
 * - `trackAttributes` — lets an element opt into an event with `data-track`
 *   attributes rather than a click handler, so a plain server-rendered
 *   component can report one.
 *
 * Nothing is sent from a development build, on the same reasoning as the other
 * two tags in the layout: localhost traffic is noise you then have to remember
 * to filter out of every report.
 */
export function OpenPanel() {
  if (process.env.NODE_ENV !== 'production' || !site.openPanelClientId) {
    return null;
  }

  return (
    <OpenPanelComponent
      clientId={site.openPanelClientId}
      trackScreenViews
      trackOutgoingLinks
      trackAttributes
    />
  );
}
