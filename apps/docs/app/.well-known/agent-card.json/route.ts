import { absoluteUrl, site } from '@/lib/site';
import { componentCount } from '@/lib/site';

/**
 * The A2A agent card: what an agent arriving at this domain can get from it.
 *
 * This site is a registry and a set of documents, not a service that acts on
 * anyone's behalf, so the card is mostly a way of saying which of its URLs are
 * worth fetching and in what shape they come back. The skills below are the
 * three things it can actually do, each one a plain HTTP GET that needs no
 * credentials.
 *
 * `protocolVersion` and the capability flags are the parts a client reads
 * first: nothing here streams, nothing here pushes, and every answer is
 * complete when it arrives.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const card = {
    protocolVersion: '0.3.0',
    name: site.name,
    description: site.description,
    url: site.url,
    preferredTransport: 'HTTP+JSON',
    version: '1.0.0',
    documentationUrl: absoluteUrl('/docs'),
    provider: {
      organization: site.name,
      url: site.repo,
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/markdown', 'application/json'],
    // Public, and the card says so in the terms the spec has for it rather
    // than by leaving the field out and letting a client assume.
    securitySchemes: {},
    security: [],
    skills: [
      {
        id: 'search-components',
        name: 'Search the component registry',
        description:
          `Find one of the ${componentCount} components by name, keyword or what it is for.`,
        tags: ['search', 'components', 'react-native', 'expo'],
        examples: [
          'Which component shows a sheet from the bottom of the screen?',
          'Find a chart for one value against a target.',
        ],
        inputModes: ['text/plain'],
        outputModes: ['application/json'],
      },
      {
        id: 'read-documentation',
        name: 'Read a documentation page',
        description:
          'Fetch any documentation page as markdown, either from /llms.mdx/<slug> or by ' +
          'asking for text/markdown at the page’s own URL. /llms.txt is the index of them.',
        tags: ['documentation', 'markdown'],
        examples: ['Read the Tabs documentation.', 'What props does BottomSheet take?'],
        inputModes: ['text/plain'],
        outputModes: ['text/markdown'],
      },
      {
        id: 'install-component',
        name: 'Get a component’s source',
        description:
          'Fetch a registry item from /r/<name>.json — every file’s source, its dependencies ' +
          'and where each file belongs — so a component can be copied into a project.',
        tags: ['registry', 'install', 'source'],
        examples: ['Get the source for the bottom sheet.', 'What does adding Tabs pull in?'],
        inputModes: ['text/plain'],
        outputModes: ['application/json'],
      },
    ],
  };

  return new Response(JSON.stringify(card, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json' },
  });
}
