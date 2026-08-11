'use client';

import { useEffect } from 'react';

/**
 * Exposes the site's own endpoints to an agent driving the browser, through
 * the WebMCP API.
 *
 * The same three things the MCP server does — search the registry, read a
 * page, get the install command — offered to an agent that is already on the
 * page and would otherwise have to scrape it. Nothing here is new capability:
 * every tool is a fetch of a public URL that anyone could make directly. What
 * it saves is the agent having to work out the URL scheme first.
 *
 * Registered in an effect rather than at module scope, because
 * `navigator.modelContext` only exists in a browser that implements it — most
 * do not, and a missing API must be a no-op rather than a crash on every page.
 * Everything is unregistered on unmount through an `AbortController`, so a
 * client-side navigation cannot leave two copies of each tool behind.
 */

/** The shape this uses, which is narrower than what the API actually offers. */
type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<{
    content: { type: 'text'; text: string }[];
  }>;
};

type ModelContext = {
  registerTool?: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => unknown;
  provideContext?: (context: { tools: ToolDefinition[] }) => unknown;
};

/** One text answer, which is the only shape any of these return. */
function text(body: string) {
  return { content: [{ type: 'text' as const, text: body }] };
}

async function fetchText(url: string, accept: string): Promise<string> {
  const response = await fetch(url, { headers: { Accept: accept } });
  if (!response.ok) return `${response.status} ${response.statusText} for ${url}`;
  return response.text();
}

function tools(origin: string): ToolDefinition[] {
  return [
    {
      name: 'search_panelui_components',
      description:
        'Search the PanelUI documentation and component registry by name, keyword or what ' +
        'the component is for. Returns matching pages with their URLs.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to look for, e.g. "bottom sheet" or "chart for one value".',
          },
        },
        required: ['query'],
      },
      async execute({ query }) {
        const url = `${origin}/api/search?query=${encodeURIComponent(String(query ?? ''))}`;
        return text(await fetchText(url, 'application/json'));
      },
    },
    {
      name: 'read_panelui_docs',
      description:
        "Read a PanelUI documentation page as markdown — a component's props, variants, " +
        'anatomy and examples. Takes the page slug, e.g. "components/tabs" or "installation".',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description:
              'The path under /docs, without a leading slash. For example "components/tabs".',
          },
        },
        required: ['slug'],
      },
      async execute({ slug }) {
        const path = String(slug ?? '').replace(/^\/+|\/+$/g, '');
        // `/llms.txt` is the index, and is the right answer to an empty slug —
        // it is the one page that says what all the others are.
        const url = path ? `${origin}/llms.mdx/${path}` : `${origin}/llms.txt`;
        return text(await fetchText(url, 'text/markdown'));
      },
    },
    {
      name: 'get_panelui_add_command',
      description:
        'The command that copies a PanelUI component’s source into a project, and the URL ' +
        'of the registry item it installs.',
      inputSchema: {
        type: 'object',
        properties: {
          component: {
            type: 'string',
            description: 'The component’s slug, e.g. "bottom-sheet".',
          },
        },
        required: ['component'],
      },
      async execute({ component }) {
        const name = String(component ?? '').trim();
        if (!name) return text('Give a component slug, e.g. "bottom-sheet".');
        return text(
          [
            `npx panelui-cli@latest add ${name}`,
            '',
            `Registry item: ${origin}/r/${name}.json`,
            `Documentation: ${origin}/docs/components/${name}`,
            '',
            'Or install the whole library instead: npm install panelui-native',
          ].join('\n')
        );
      },
    },
  ];
}

export function WebMcp() {
  useEffect(() => {
    const context = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    if (!context) return;

    const controller = new AbortController();
    const definitions = tools(window.location.origin);

    try {
      if (typeof context.registerTool === 'function') {
        for (const tool of definitions) {
          context.registerTool(tool, { signal: controller.signal });
        }
      } else if (typeof context.provideContext === 'function') {
        // The older shape of the same idea: one call, every tool, replacing
        // whatever was declared before.
        context.provideContext({ tools: definitions });
      }
    } catch {
      // An API that exists but rejects what it was handed is not worth taking
      // the page down over. The page works without any of this.
    }

    return () => controller.abort();
  }, []);

  return null;
}
