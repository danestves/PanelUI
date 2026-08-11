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
      /*
       * The site itself, and the documents describing what it is rather than
       * what it serves — the agent card, the MCP server, the skill index, and
       * the two that answer "how do I authenticate" with "you do not".
       */
      {
        anchor: absoluteUrl('/'),
        'service-doc': [{ href: absoluteUrl('/llms.txt'), type: 'text/plain' }],
        describedby: [
          { href: absoluteUrl('/.well-known/agent-card.json'), type: 'application/json' },
          { href: absoluteUrl('/.well-known/mcp/server-card.json'), type: 'application/json' },
          { href: absoluteUrl('/.well-known/agent-skills/index.json'), type: 'application/json' },
        ],
        'oauth-protected-resource': [
          { href: absoluteUrl('/.well-known/oauth-protected-resource'), type: 'application/json' },
        ],
        author: [{ href: absoluteUrl('/auth.md'), type: 'text/markdown' }],
      },
    ],
  };

  return new Response(JSON.stringify(linkset, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/linkset+json' },
  });
}
