import { absoluteUrl, site } from '@/lib/site';

/**
 * The MCP server card: how to run the PanelUI MCP server, published where an
 * agent looks rather than only in a documentation page it would have to be
 * told to read.
 *
 * The server is stdio and runs locally through npx — there is no hosted
 * endpoint, and saying so is the point of the card. An agent that finds this
 * knows both that the server exists and that it does not have to ask anyone
 * for access to it.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const card = {
    name: 'panelui',
    description:
      `Search, read and install components from the ${site.name} registry — ${site.tagline}.`,
    version: '1.0.0',
    websiteUrl: site.url,
    documentationUrl: absoluteUrl('/docs/skills'),
    repository: { url: site.repo, source: 'github' },
    packages: [
      {
        registryType: 'npm',
        identifier: 'panelui-cli',
        version: 'latest',
        transport: { type: 'stdio' },
        runtimeHint: 'npx',
        runtimeArguments: [
          { type: 'positional', value: '-y' },
          { type: 'positional', value: 'panelui-cli@latest' },
          { type: 'positional', value: 'mcp' },
        ],
      },
    ],
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
  };

  return new Response(JSON.stringify(card, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json' },
  });
}
