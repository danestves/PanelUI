# Contributing to PanelUI

Thanks for taking the time to contribute. This document covers how the repository is laid out,
what a change is expected to include, and how to get a pull request merged.

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bug fix?** Go ahead — open a [bug report](https://github.com/panel-ui/PanelUI/issues/new?template=bug_report.yml)
  and send the fix.
- **New component, or a change to an existing API?** Open an issue or a
  [discussion](https://github.com/panel-ui/PanelUI/discussions) first. PanelUI aims at one
  coherent visual language across the full component catalogue, and the design conversation is much cheaper
  before the code than after it.
- **Documentation or a typo?** Straight to a pull request.

## Getting set up

Requires **Node 20+** and npm. The repo is an npm-workspaces monorepo, so install once at the root.

```sh
git clone https://github.com/panel-ui/PanelUI.git
cd PanelUI
npm install
```

| Command | What it does |
| --- | --- |
| `npm run example` | Start the Expo showcase app |
| `npm run typecheck` | Typecheck every workspace |
| `npm run build` | Build the library with `react-native-builder-bob` |
| `npm run docs` | Start the documentation site |
| `npm run docs:generate --workspace=docs` | Regenerate the docs pages and the CLI registry |

`npm run example` needs the library built at least once, since the app imports `panelui-native`
from the workspace. Run `npm run build` after changing library source, or the app will keep
compiling against the previous build.

### Where things live

```
packages/panelui   the library — pure TypeScript, no native code (npm: panelui-native)
apps/example       Expo Router showcase, one live demo per component
apps/docs          documentation site and landing page (panelui.dev)
```

## Conventions

These are not style preferences; the build enforces most of them.

**One folder per component.** `packages/panelui/src/components/<name>/index.tsx`, exported from
`src/index.ts` — the component and every public type, in the alphabetical position.

**Animations run on the UI thread.** Reanimated 4 only. The React Native `Animated` API is not
used anywhere in this library and should not be introduced.

**Variants are computed once.** `tv()` objects live at module scope, never inside render. A
variant belongs to the part it configures — if an option only applies to `Foo.Item`, express it as
a lookup rather than a `tv()` variant on the root, or the docs generator will document it as
something you can pass to `<Foo>`.

**No hardcoded colours.** Everything resolves through the semantic tokens in
`packages/panelui/theme.css`. A dynamic colour comes from `useCSSVariable`, with a literal only as
a fallback.

**Accessibility is part of the component.** Interactive parts wire up `accessibilityRole`, mirror
their state through `accessibilityState`, and label anything that is not self-describing.

**Every component takes `className`.** It is how a consumer restyles anything.

**Overlays mount lazily** through `Portal` and unmount after their exit animation.

**Compound components** are assembled with `Object.assign` — `Card.Header`, `Dialog.Content`.

### React Native has two rules that catch people out

- A bare string is only legal inside a `<Text>`. Dropping one into a `<View>` throws
  *"Text strings must be rendered within a `<Text>` component"*. The `textChildren` helper in
  `src/primitives/text.tsx` wraps bare strings for you; most compound parts already use it.
- A `<View>` inside a `<Text>` breaks the line around it. Anything meant to sit inline — a bolded
  run, inline code — has to be a `<Text>`.

## Documentation is part of the change

**A component change is not complete until its documentation page is updated in the same commit.**

The MDX pages are generated. Do not edit `apps/docs/content/docs/**` by hand — the next
regeneration will overwrite it. Edit these two files instead:

- `apps/docs/scripts/meta.json` — the component's name, summary, search keyword, and options:
  `group`, `addedIn` (the version it first ships in), `updatedIn` (the version its API last
  changed in), and `alpha` / `beta`.
- `apps/docs/scripts/usage.json` — intro, usage snippet, anatomy, parts, examples and notes. See
  [`apps/docs/scripts/README.md`](apps/docs/scripts/README.md) for what each key becomes.

Then run:

```sh
npm run docs:generate --workspace=docs
```

Props tables are read from the actual TypeScript interfaces and their JSDoc, so the way to fix a
wrong props table is to fix the JSDoc.

The same command rebuilds the CLI registry under `apps/docs/public/r`, which is generated from the
library source and never hand-written. Two consequences:

- **A new relative import** must be resolvable by the builder or it throws. Import from
  `../../primitives`, `../../utils/cn`, `../../icons`, `../../native`, `../<component>` or
  `../hooks/<name>`; anything else needs a mapping added to
  [`apps/docs/scripts/build-registry.mjs`](apps/docs/scripts/build-registry.mjs) first.
- **A new npm dependency** is picked up automatically. Decide whether it is required or optional —
  optional means reached through a lazy `require`/`import` inside a `try`/`catch`, and listed in
  `OPTIONAL` in the builder.

## Adding a component

1. `packages/panelui/src/components/<name>/index.tsx`
2. Export it and its types from `packages/panelui/src/index.ts`
3. New icons → `packages/panelui/src/icons/index.tsx`
4. New tokens → `packages/panelui/theme.css` **and** `apps/docs/app/global.css`, kept in sync
5. A demo entry in `apps/example/src/data/components.tsx`
6. `apps/docs/scripts/meta.json` and `usage.json`, then `npm run docs:generate --workspace=docs`
7. The component lists and counts in `README.md`, `packages/panelui/README.md` and
   `apps/docs/content/docs/index.mdx`

A demo that needs the whole screen — a transcript, a map, a long answer — is marked
`fullPage: true` with an `id` and a `description`, so it opens on a route of its own instead of
being squeezed into a section.

## Commits and pull requests

[Conventional Commits](https://www.conventionalcommits.org/), scoped with the component or area
where it helps:

```
feat(table): frame the table and make sorting read as working
fix(calendar): clamp navigation to its bounds
docs(readme): list the AI components
```

`feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`, `build`, `ci`.

Keep a pull request to one logical change. Before you open it:

```sh
npm run typecheck   # must pass
npm run build       # must pass
```

CI runs both on every pull request. Fill in the pull request template — the checklist is short and
it is what the review is against.

Do **not** bump the version in `packages/panelui/package.json` in a pull request; releases are cut
separately.

## Reporting a security issue

Please do not open a public issue. Use the repository's **Security** tab → *Report a
vulnerability*, which is private and visible only to the maintainers.

## Licence

By contributing you agree that your contributions will be licensed under the
[MIT Licence](LICENSE).
