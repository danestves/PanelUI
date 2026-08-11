import { approximateTokens, llmsIndex } from '@/lib/llms-index';

/**
 * `/llms.md` — the same index as `/llms.txt`, served as markdown.
 *
 * This is what the site root answers with when a request asks for
 * `text/markdown`. It needs to exist separately because `/llms.txt` is
 * `text/plain` by convention and on purpose, and an agent that asked for
 * markdown and was handed plain text has been told the site does not do
 * markdown — which is exactly what it means.
 *
 * A page's own markdown is at `/llms.mdx/<slug>`; this is the index of them.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const body = llmsIndex();

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Markdown-Tokens': String(approximateTokens(body)),
      // The site root serves this or HTML depending on `Accept`, so a shared
      // cache has to key on it or one visitor's markdown becomes the next
      // visitor's home page.
      Vary: 'Accept',
    },
  });
}
