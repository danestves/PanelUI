/**
 * Fetching registry items and resolving what an item actually needs.
 */
import { fail, nearest } from './ui.mjs';

/** Per-run cache — a closure re-visits shared items like `text` constantly. */
const cache = new Map();

/** Loopback is the one place cleartext is not a downgrade — nothing is on the wire. */
function isLoopback(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

/**
 * Whatever the registry returns is written into the project as source, so the
 * answer has to be known to come from the host that was asked. Cleartext gives
 * anyone on the path an edit of that source, which is why it is refused
 * anywhere but loopback.
 */
function assertTransport(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail(`Registry URL is not a URL: ${url}.`, 'Pass --registry https://panelui.dev/r');
  }

  if (parsed.protocol === 'https:') return;
  if (parsed.protocol === 'http:' && isLoopback(parsed.hostname)) return;

  fail(
    `Refusing to fetch components over ${parsed.protocol}//.`,
    'Registry files become source in your project, so they are only fetched over https.'
  );
}

async function fetchJson(url) {
  assertTransport(url);

  let response;
  try {
    response = await fetch(url);
  } catch (cause) {
    fail(
      `Could not reach the registry at ${url}.`,
      'Check your connection, or pass --registry to point somewhere else.'
    );
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    fail(`Registry returned ${response.status} for ${url}.`);
  }

  return response.json();
}

export async function fetchIndex(registry) {
  const index = await fetchJson(`${registry}/index.json`);
  if (!index) fail(`No index at ${registry}/index.json.`);
  return index;
}

export async function fetchItem(registry, name) {
  if (cache.has(name)) return cache.get(name);

  const item = await fetchJson(`${registry}/${name}.json`);
  if (!item) {
    const index = await fetchIndex(registry);
    const suggestion = nearest(
      name,
      index.map((entry) => entry.name)
    );
    fail(
      `No component called "${name}".`,
      suggestion
        ? `Did you mean "${suggestion}"?`
        : 'Run `npx panelui-cli@latest list` to see what is available.'
    );
  }

  cache.set(name, item);
  return item;
}

/**
 * Everything needed to install `names`, in dependency order.
 *
 * The registry records only direct edges, so this walks them. The graph is a
 * DAG — nothing in the library imports something that imports it back — but
 * the visited set makes that irrelevant either way.
 */
export async function resolve(registry, names) {
  const resolved = new Map();

  async function visit(name) {
    if (resolved.has(name)) return;

    const item = await fetchItem(registry, name);
    // Marked before recursing so a cycle could not loop forever.
    resolved.set(name, item);

    for (const dependency of item.registryDependencies ?? []) {
      await visit(dependency);
    }
  }

  for (const name of names) await visit(name);

  return [...resolved.values()];
}

/** The union of npm packages a set of items needs. */
export function collectDependencies(items) {
  const required = new Set();
  const optional = new Set();

  for (const item of items) {
    for (const dep of item.dependencies ?? []) required.add(dep);
    for (const dep of item.optionalDependencies ?? []) optional.add(dep);
  }

  return {
    dependencies: [...required].sort(),
    optionalDependencies: [...optional].sort(),
  };
}
