import { llmsIndex } from '@/lib/llms-index';

/**
 * `/llms.txt` — the documentation index, at the conventional path.
 *
 * The index itself is built in `lib/llms-index`, which `/llms.md` serves too.
 * The only difference between the two is the content type, and it is a real
 * one: this is fetched as often by a person pasting a URL into a chat as by a
 * crawler, and a browser offers to download anything it cannot render inline.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(llmsIndex(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // This path is not content-negotiated, but it is what `/` negotiates to.
      // Saying so keeps a shared cache from serving it to a browser.
      Vary: 'Accept',
    },
  });
}
