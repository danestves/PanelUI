import { NextResponse, type NextRequest } from 'next/server';

/**
 * Markdown for agents: a request that asks for `text/markdown` gets the page
 * as markdown, and a browser goes on getting HTML.
 *
 * Both versions already exist — `/llms.mdx/<slug>` has served the raw markdown
 * of every docs page since the "Copy page" button was added, and `/llms.txt`
 * is the index. All this does is answer at the page's own URL, so an agent
 * that was given `panelui.dev/docs/installation` does not have to know about a
 * second URL scheme to get the useful form of it.
 *
 * A rewrite, not a redirect: the URL the agent asked for is the URL it should
 * think it is reading.
 */

/** Whether the client would rather have markdown than HTML. */
function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;

  // `*/*` is every browser and every fetch with no opinion, so wanting
  // markdown has to be said explicitly.
  let markdown = -1;
  let html = -1;

  for (const part of accept.split(',')) {
    const [type = '', ...parameters] = part.trim().split(';');
    const q = parameters
      .map((parameter) => parameter.trim())
      .find((parameter) => parameter.startsWith('q='));
    const weight = q ? Number.parseFloat(q.slice(2)) : 1;
    if (Number.isNaN(weight) || weight <= 0) continue;

    const name = type.trim().toLowerCase();
    if (name === 'text/markdown') markdown = Math.max(markdown, weight);
    else if (name === 'text/html') html = Math.max(html, weight);
  }

  return markdown > 0 && markdown >= html;
}

export function middleware(request: NextRequest): NextResponse {
  if (!prefersMarkdown(request.headers.get('accept'))) {
    const response = NextResponse.next();
    // The response varies by Accept whether or not this request did, or a
    // cache will serve one visitor's markdown to the next visitor's browser.
    response.headers.set('Vary', 'Accept');
    return response;
  }

  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();

  // The home page has no markdown of its own; the index of the whole site is
  // the closest true thing and the more useful one.
  url.pathname = pathname === '/' ? '/llms.txt' : `/llms.mdx${pathname.replace(/^\/docs/, '')}`;

  const response = NextResponse.rewrite(url);
  response.headers.set('Vary', 'Accept');
  return response;
}

export const config = {
  matcher: ['/', '/docs/:path*'],
};
