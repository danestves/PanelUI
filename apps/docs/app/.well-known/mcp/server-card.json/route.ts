import { absoluteUrl, site } from '@/lib/site';

/**
 * The MCP Server Card, at the path SEP-1649 standardises.
 *
 * `/.well-known/mcp/server.json` next door is the same server described in the
 * npm registry's shape, and predates this. Both are served rather than one
 * redirecting to the other, because a client looking for one of them has no
 * reason to know the other spelling exists — and the document is small enough
 * that saying it twice costs less than making anybody guess.
 *
 * The transport is stdio, and that is the honest answer rather than a
 * limitation being papered over. There is no hosted endpoint: the server runs
 * locally through npx, reads this site's public registry over HTTP, and needs
 * no credentials from anyone. An agent that finds this card knows both that the
 * server exists and that it does not have to ask for access to it.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const card = {
    serverInfo: {
      name: 'panelui',
      title: `${site.name} registry`,
      version: '1.0.0',
      description:
        `Search, read and install components from the ${site.name} registry — ${site.tagline}.`,
      websiteUrl: site.url,
      documentationUrl: absoluteUrl('/docs/skills'),
    },
    transport: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'panelui-cli@latest', 'mcp'],
    },
    capabilities: {
      // Everything this server does is a tool call. It publishes no resources
      // and no prompts, and declaring either would have a client asking for
      // something that comes back empty.
      tools: { listChanged: false },
    },
    tools: [
      {
        name: 'panelui_get_project_info',
        description: 'How the project is set up, and which components are already in it.',
      },
      { name: 'panelui_search_components', description: 'Search the registry.' },
      { name: 'panelui_list_components', description: 'Everything in the registry.' },
      {
        name: 'panelui_view_component',
        description: 'One item in full, including every file’s source.',
      },
      {
        name: 'panelui_get_component_docs',
        description: 'A component’s documentation page as markdown.',
      },
      { name: 'panelui_get_add_command', description: 'The command that copies components in.' },
    ],
    // No token is needed for anything this server reaches. Spelled out rather
    // than left absent, so a client does not go looking for an authorization
    // server that does not exist.
    authentication: { type: 'none' },
  };

  return new Response(JSON.stringify(card, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json' },
  });
}
