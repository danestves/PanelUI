import { absoluteUrl, site } from '@/lib/site';

/**
 * RFC 9728 protected-resource metadata, for a resource that is not protected.
 *
 * That reads like a contradiction and is the useful thing to publish. An agent
 * that gets a 401 from an API goes looking for this document to find out where
 * to get a token; an agent that has *never* seen this document has no way to
 * tell "no authentication needed" from "the discovery document is missing and
 * I should try harder". An empty `authorization_servers` says the first one.
 *
 * There is deliberately no `/.well-known/oauth-authorization-server` beside
 * this. RFC 8414 metadata has to name an issuer, an authorization endpoint, a
 * token endpoint and a JWKS URI, and this site has none of those. Publishing
 * them to satisfy a checker would send an agent to a token endpoint that 404s,
 * and a failure there reads as the site being broken rather than as it being
 * open.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const metadata = {
    resource: site.url,
    resource_name: `${site.name} registry and documentation`,
    resource_documentation: absoluteUrl('/docs/cli'),
    // Empty, and that is the whole message: nothing issues tokens for this
    // resource because nothing here asks for one.
    authorization_servers: [],
    scopes_supported: [],
    bearer_methods_supported: [],
  };

  return new Response(JSON.stringify(metadata, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json' },
  });
}
