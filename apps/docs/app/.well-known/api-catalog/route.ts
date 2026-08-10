import { absoluteUrl } from '@/lib/site';

/**
 * The API catalog, RFC 9727: one well-known place naming every API this site
 * has, so an agent does not have to read the documentation to find out that
 * the registry exists.
 *
 * Two APIs, both real, both public and both unauthenticated — which is what
 * makes publishing this honest. A catalog that advertises endpoints nobody can
 * reach is worse than no catalog.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const linkset = {
    linkset: [
      {
        anchor: absoluteUrl('/r/'),
        'service-desc': [{ href: absoluteUrl('/openapi.json'), type: 'application/openapi+json' }],
        'service-doc': [{ href: absoluteUrl('/docs/cli'), type: 'text/html' }],
        'service-meta': [{ href: absoluteUrl('/r/index.json'), type: 'application/json' }],
      },
      {
        anchor: absoluteUrl('/api/search'),
        'service-desc': [{ href: absoluteUrl('/openapi.json'), type: 'application/openapi+json' }],
        'service-doc': [{ href: absoluteUrl('/docs'), type: 'text/html' }],
      },
    ],
  };

  return new Response(JSON.stringify(linkset, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/linkset+json' },
  });
}
