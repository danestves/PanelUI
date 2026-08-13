# panelui-cli

Add [PanelUI](https://panelui.dev) components to an Expo project one at a time — the source
lands in your repo and is yours to edit.

```bash
npx panelui-cli@latest init
npx panelui-cli@latest add button
```

## Two ways to use PanelUI

| | `panelui-native` | `panelui-cli` |
| --- | --- | --- |
| You get | A dependency | Source files in your repo |
| Updates | `npm update` | Re-run `add --overwrite`, or keep your edits |
| Editing | Wrap or restyle it | Change the file |
| Install size | Whole library | Only what you add |

Neither is more supported than the other. Take the package if you want updates handled for you;
take the source if you expect to change it.

## Commands

### `init`

Sets the project up: writes `panelui.json`, copies the design tokens, wires the CSS entry and
Metro config, adds the TypeScript path alias and ambient types, and installs the base packages.
Every write shows a diff and asks first.

```bash
npx panelui-cli@latest init
```

### `add <name...>`

Copies components in, along with everything they depend on. A component you already have is
left alone — those files are yours once copied. Re-running the command still installs any missing
packages required by those files.

```bash
npx panelui-cli@latest add item message
npx panelui-cli@latest add button --overwrite
```

### `list`

Everything available, grouped.

```bash
npx panelui-cli@latest list
```

### `mcp`

Runs PanelUI's [Model Context Protocol](https://modelcontextprotocol.io/) server. An MCP client can
inspect the registry, read component source and documentation, get the matching `add` command, and
check how the current project consumes PanelUI.

```bash
npx panelui-cli@latest mcp
```

The server is a long-running stdio process intended to be launched by an MCP client. Standard input
and output carry newline-delimited JSON-RPC messages; stdout contains no banner or other human-readable
output. It reads project information from `--cwd` (the current directory by default).

Registry lookups use `--registry <url>` first, then the registry in that project's `panelui.json`,
then `https://panelui.dev/r`.

#### `mcp init [claude|cursor|vscode]`

Adds the server to a supported editor's project-level MCP configuration. The editor defaults to
Claude Code when omitted.

| Editor | Command | Config path, relative to `--cwd` |
| --- | --- | --- |
| Claude Code | `mcp init claude` | `.mcp.json` |
| Cursor | `mcp init cursor` | `.cursor/mcp.json` |
| VS Code | `mcp init vscode` | `.vscode/mcp.json` |

```bash
npx panelui-cli@latest mcp init
npx panelui-cli@latest mcp init cursor
npx panelui-cli@latest --cwd ./apps/mobile mcp init vscode
```

The command creates the parent directory when needed and merges a `panelui` server into the existing
JSON instead of replacing other settings or servers. Claude Code and Cursor use the `mcpServers` map;
VS Code uses `servers`. An existing `panelui` entry is updated to run:

```text
npx -y panelui-cli@latest mcp
```

The generated entry does not store one-off CLI options. To pin a registry or working directory for
editor-launched sessions, add `--registry <url>` or `--cwd <dir>` to that server's generated `args`.

## Options

| Flag | Effect |
| --- | --- |
| `--yes`, `-y` | Accept every prompt |
| `--overwrite` | Replace files that already exist |
| `--dry-run` | Show what would happen, write nothing |
| `--cwd <dir>` | Run against another directory |
| `--registry <url>` | Use a different registry |

A value-taking flag without its value prints its usage and exits with status 1. No command runs.

## `panelui.json`

```json
{
  "registry": "https://panelui.dev/r",
  "aliases": {
    "components": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "css": "global.css",
  "theme": "theme.css"
}
```

Change the aliases and imports are rewritten to match on the way in.

## Notes

This package has **no dependencies**. Running it with `npx` downloads a few kilobytes.

If components render but are unstyled, the `@source` lines in your CSS entry are missing or
point at the wrong directory — that is what tells Uniwind where to look for class names. Restart
Metro with `--clear` after any change to the theme list.

Full documentation: <https://panelui.dev/docs/cli>
