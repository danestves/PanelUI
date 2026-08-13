# create-panelui-app

Start a new [Expo](https://expo.dev) app with [PanelUI](https://panelui.dev) already wired up —
the dependencies installed, Tailwind and Uniwind configured, the theme tokens in place and a
first screen that runs.

```sh
npm create panelui-app@latest
```

or with whichever runner the project will use:

```sh
pnpm create panelui-app
yarn create panelui-app
bun create panelui-app
```

Answer the prompts, or skip them:

```sh
npx create-panelui-app@latest my-app --template starter --theme moon --yes
```

## Options

| Option | Values | What it does |
| --- | --- | --- |
| `--template <name>` | `starter`, `minimal` | `starter` gives you tabs, a themed dashboard, a component gallery and a theme picker; `minimal` is one screen, everything wired, nothing to delete. |
| `--theme <name>` | `panel`, `moon`, `grass` | Which token set the app is themed with. Change it later in `global.css`. |
| `--name <name>` | Project folder name | The same value accepted as the bare first argument. |
| `--yes`, `-y` | | Accept every prompt and use the defaults. |
| `--help`, `-h` | | Print the usage. |
| `--version`, `-v` | | Print the version. |

A value-taking option without its value prints its usage and exits with status 1. No project is created.

## What it is

A thin front door to [`panelui-cli`](https://www.npmjs.com/package/panelui-cli), which does the
work. It exists because `npm create`, `pnpm create`, `yarn create` and `bun create` all resolve a
package named `create-<something>`, and that is the shape people reach for when starting a
project — `panelui-cli init` reads like a command you run *in* a project rather than one that
makes one.

Once the app exists, `panelui-cli` is what adds components to it:

```sh
npx panelui-cli@latest add bottom-sheet
```

## Documentation

- [Installation](https://panelui.dev/docs/installation)
- [The CLI](https://panelui.dev/docs/cli)
- [Components](https://panelui.dev/docs/components)

## Licence

MIT © Khalid Abdi
