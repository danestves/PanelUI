# Templates

Real, runnable Expo apps. `panelui-cli init` in an empty directory copies one
of them out and turns it into a project.

| Directory | `--template` | What it is |
| --- | --- | --- |
| `expo-app` | `minimal` | One screen, everything wired, nothing to delete |
| `expo-starter` | `starter` | Tabs, a themed dashboard, a component gallery, a theme picker |

They are kept as apps rather than as strings in the CLI on purpose: a template
written as a string is one nobody runs, and it rots on the first SDK bump with
nothing failing to say so.

## Running one

**Not in place.** A template directory has no `node_modules` and is not a
workspace, and its `package.json` pins `panelui-native: latest` — which is
whatever was last published, not this checkout. A template using a component
added on your branch will fail against it with `Cannot read property … of
undefined`, and reviewing a template against a version that predates it tells
you nothing.

From the repository root:

```sh
npm run template
```

That scaffolds into `.template-preview/`, installs, and swaps the published
package for the one built from `packages/panelui`. Then:

```sh
cd .template-preview/<name>
npx expo start
```

Flags pass straight through, so a specific combination needs no prompting:

```sh
npm run template -- --template starter --name demo --theme moon --yes
```

## Changing one

- Dependency versions track `apps/example`, minus everything only the showcase
  needs. When the example moves to a new SDK, these move with it.
- Anything a template renders has to exist in the **published** package by the
  time the template ships, since that is what a generated project installs.
- The CLI writes the project's name into `package.json` and `app.json`, and the
  chosen theme into `app/_layout.tsx`. Everything else is copied verbatim, so
  the files here are exactly the files a user gets.
