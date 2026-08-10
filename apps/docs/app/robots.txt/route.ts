import { absoluteUrl, site } from '@/lib/site';

/**
 * robots.txt, written out rather than generated from `MetadataRoute.Robots`.
 *
 * Next's helper can only emit the directives it knows about, and the one worth
 * having here is not among them: `Content-Signal` states what this site's
 * content may be used for, which is a thing a licence says and a crawler
 * cannot infer.
 *
 * The answer is yes to all three, and that is deliberate rather than lazy.
 * This is MIT-licensed documentation for an open-source library whose actual
 * problem is that not enough people know it exists — being trained on,
 * searched and quoted is the point. A project that sold its documentation
 * would answer differently, which is exactly why the question is worth asking.
 */
export const dynamic = 'force-static';

const BODY = `# ${site.name} — ${site.tagline}

# What this content may be used for. https://contentsignals.org/
Content-Signal: ai-train=yes, search=yes, ai-input=yes

User-agent: *
Allow: /
# Returns JSON, and there is nothing in it to index.
Disallow: /api/

Sitemap: ${absoluteUrl('/sitemap.xml')}

# For agents: every page as markdown, and the component registry.
# ${absoluteUrl('/llms.txt')}
# ${absoluteUrl('/.well-known/api-catalog')}
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
