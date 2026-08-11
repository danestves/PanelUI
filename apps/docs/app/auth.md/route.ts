import { absoluteUrl, site } from '@/lib/site';

/**
 * `/auth.md` — how an agent authenticates here, which is: it does not.
 *
 * Worth serving precisely because the answer is "nothing to do". An agent that
 * finds no auth document has to decide between "this is open" and "I have not
 * found the door yet", and the second guess costs it a round of 401-hunting
 * against endpoints that were never going to challenge it.
 *
 * Markdown rather than JSON because this one is meant to be read — by a model
 * in a context window, and by a person wondering what the file is.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const body = `# auth.md

${site.name} needs no authentication. Every endpoint below is public, anonymous and
unmetered — there is no account to create, no key to request and no token to send.

## Audience

Any agent, crawler or client. There is no allow-list and no registration step, so there is
nothing to identify yourself as.

## Authentication

**None.** Do not send an \`Authorization\` header; nothing reads it. No endpoint on this
domain will answer \`401\` or \`403\`, so a challenge you receive is not coming from here.

- Registration endpoint: none
- Supported methods: none
- Credential types: none
- Token revocation: not applicable

\`${absoluteUrl('/.well-known/oauth-protected-resource')}\` says the same in RFC 9728's terms,
with an empty \`authorization_servers\` list. There is no
\`/.well-known/oauth-authorization-server\`, because there is no authorization server to
describe.

## What is public

| Endpoint | What it is |
| --- | --- |
| \`/r/index.json\` | Every component in the registry |
| \`/r/{name}.json\` | One component, with every file's source |
| \`/api/search?query=\` | Full-text search over the documentation |
| \`/llms.txt\` | The documentation index |
| \`/llms.md\` | The same index, as \`text/markdown\` |
| \`/llms.mdx/{slug}\` | One documentation page as markdown |
| \`/openapi.json\` | The registry and search API, described |

Any documentation page also answers with markdown if you ask for it:
\`Accept: text/markdown\` at the page's own URL returns \`text/markdown\`, and a browser
still gets HTML.

## Rate limits

None published. Be reasonable — the registry is static JSON and caches well, so fetching
\`/r/index.json\` once beats fetching a hundred item files to find one.

## The MCP server

\`${absoluteUrl('/.well-known/mcp/server-card.json')}\` describes it. It runs locally over
stdio (\`npx -y panelui-cli@latest mcp\`) and reads this site's public endpoints, so it needs
no credentials either.

## Contact

${site.repo}/issues
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Markdown-Tokens': String(Math.ceil(body.length / 4)),
    },
  });
}
