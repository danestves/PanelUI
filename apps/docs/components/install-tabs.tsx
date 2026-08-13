'use client';

import { useCallback, useId, useRef, useSyncExternalStore } from 'react';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { cn } from '@/lib/utils';
import { tabIndexForKey } from './composite-keyboard';

/**
 * An install command, in the four package managers.
 *
 * Every tab set on the site shares one selection, and it survives navigation:
 * a reader who uses pnpm should say so once, not once per code block on a page
 * that has five of them. Fumadocs' own `Tabs` is uncontrolled and has no group
 * in this version, hence the small store below rather than its `groupId`.
 *
 * The commands are derived from one package list rather than written out four
 * times, because four hand-maintained copies of a dependency list is four
 * chances for one of them to fall behind — which is the exact problem this
 * page had before.
 */

const MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const;
export type PackageManager = (typeof MANAGERS)[number];

/** What kind of command this is, which decides how each manager spells it. */
export type InstallKind =
  /** Scaffold a new project from a `create-*` package. */
  | 'create'
  /** `expo install` — resolves versions against the installed SDK. */
  | 'expo'
  /** A plain dependency install. */
  | 'add'
  /** Run a CLI without installing it. */
  | 'dlx';

const STORAGE_KEY = 'panelui:package-manager';

/*
 * One selection for the whole page, in a store rather than in a context: the
 * tab sets are rendered from MDX, scattered through the page and not wrapped in
 * anything shared, so there is nowhere sensible to hang a provider.
 */
let current: PackageManager = 'npm';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(): PackageManager {
  return current;
}

/** The server has no stored choice, and neither does the first client render. */
function readServer(): PackageManager {
  return 'npm';
}

function select(manager: PackageManager) {
  current = manager;
  try {
    localStorage.setItem(STORAGE_KEY, manager);
  } catch {
    // Private mode, or storage turned off. The choice still applies to this
    // page; it just does not outlive it.
  }
  for (const listener of listeners) listener();
}

/* Restore before the first subscription so the initial paint is already right
   for a returning reader. */
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (MANAGERS as readonly string[]).includes(stored)) {
      current = stored as PackageManager;
    }
  } catch {
    // As above.
  }
}

/** The command for one manager. `packages` is a space-separated list. */
export function commandFor(
  manager: PackageManager,
  kind: InstallKind,
  packages: string
): string {
  switch (kind) {
    case 'create':
      return {
        npm: `npx ${packages}@latest`,
        pnpm: `pnpm create ${packages.replace(/^create-/, '')}@latest`,
        yarn: `yarn create ${packages.replace(/^create-/, '')}`,
        bun: `bun create ${packages.replace(/^create-/, '')}@latest`,
      }[manager];
    case 'expo':
      /*
       * `expo install` in every one of them, not `add`. It asks the installed
       * SDK which version of each package it was built against — the whole
       * reason this page does not pin versions by hand.
       */
      return {
        npm: `npx expo install ${packages}`,
        pnpm: `pnpm expo install ${packages}`,
        yarn: `yarn expo install ${packages}`,
        bun: `bunx expo install ${packages}`,
      }[manager];
    case 'add':
      return {
        npm: `npm install ${packages}`,
        pnpm: `pnpm add ${packages}`,
        yarn: `yarn add ${packages}`,
        bun: `bun add ${packages}`,
      }[manager];
    case 'dlx':
      return {
        npm: `npx ${packages}`,
        pnpm: `pnpm dlx ${packages}`,
        yarn: `yarn dlx ${packages}`,
        bun: `bunx ${packages}`,
      }[manager];
  }
}

export interface InstallTabsProps {
  /** How the command is spelled in each manager. */
  kind?: InstallKind;
  /** Space-separated packages, or the whole argument string for `dlx`. */
  packages: string;
}

export function InstallTabs({ kind = 'expo', packages }: InstallTabsProps): React.ReactElement {
  const manager = useSyncExternalStore(subscribe, read, readServer);
  const onSelect = useCallback((next: PackageManager) => select(next), []);
  const instanceId = useId();
  const tabRefs = useRef<Partial<Record<PackageManager, HTMLButtonElement | null>>>({});

  const onTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, name: PackageManager) => {
      const nextIndex = tabIndexForKey(event.key, MANAGERS.indexOf(name), MANAGERS.length);
      if (nextIndex === undefined) return;
      event.preventDefault();
      const next = MANAGERS[nextIndex];
      onSelect(next);
      tabRefs.current[next]?.focus();
    },
    [onSelect]
  );

  return (
    <div className="not-prose my-4 overflow-hidden rounded-xl border bg-card">
      <div
        role="tablist"
        aria-label="Package manager"
        aria-orientation="horizontal"
        className="flex flex-row border-b bg-muted/40"
      >
        {MANAGERS.map((name) => (
          <button
            key={name}
            ref={(node) => {
              tabRefs.current[name] = node;
            }}
            type="button"
            role="tab"
            id={`${instanceId}-tab-${name}`}
            aria-controls={`${instanceId}-panel-${name}`}
            aria-selected={manager === name}
            tabIndex={manager === name ? 0 : -1}
            onClick={() => onSelect(name)}
            onKeyDown={(event) => onTabKeyDown(event, name)}
            className={cn(
              'cursor-pointer border-b-2 px-4 py-2 font-mono text-sm transition-colors',
              manager === name
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {/*
       * Keyed on the command so the copy button's "copied" state does not
       * carry over onto a different command after a tab change.
       *
       * `px-4` on the code, because the block's own horizontal padding comes
       * from a rule on the `.line` spans Shiki emits — and there is no Shiki
       * here, just a string. 16px is what that rule resolves to, so this lines
       * the command up with the tab labels above it and with every other code
       * block on the site. Borrowing the `.shiki` class instead would bring a
       * colour rule pointing at a variable that only exists on highlighted
       * output.
       */}
      {MANAGERS.map((name) => {
        const command = commandFor(name, kind, packages);
        return (
          <div
            key={name}
            role="tabpanel"
            id={`${instanceId}-panel-${name}`}
            aria-labelledby={`${instanceId}-tab-${name}`}
            hidden={manager !== name}
            tabIndex={0}
          >
            <CodeBlock key={command} allowCopy className="m-0 rounded-none border-0">
              <Pre>
                <code className="px-4">{command}</code>
              </Pre>
            </CodeBlock>
          </div>
        );
      })}
    </div>
  );
}
