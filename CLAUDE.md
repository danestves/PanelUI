# PanelUI

High-performance React Native UI library for Expo, published on npm as
[`panelui-native`](https://www.npmjs.com/package/panelui-native).
GitHub: https://github.com/panel-ui/PanelUI

## Research before you build

**Never design a component, variant, animation, or token from scratch.** Before writing any
component code, read how the problem is already solved by mature libraries, then adapt it to
PanelUI's tokens and conventions. This is not optional.

Where to look, in order:

1. The React Native / Expo component libraries — for native structure, Reanimated usage, gesture
   handling, accessibility props and compound anatomy. Closest to our target; check here first.
2. The web component libraries — for compound-component API shape, prop naming and variant
   taxonomy. Their structure ports; their CSS does not.
3. The design-system references — for token usage and visual language.

The `.claude/skills/` directory holds the pinned references for 2 and 3; invoke them by name
before touching design tokens, `packages/panelui/theme.css`, the docs theming or the landing
page. They carry rules worth not reconstructing — for instance, *never rewrite `--alpha()` to
`rgba()` in the web CSS*: it is a valid Tailwind v4 build-time function, not broken CSS.

If none of them has the component, search the web for other React Native / Tailwind
implementations before inventing an approach.

How to read a repository:

- Use `gh api "repos/<owner>/<repo>/git/trees/main?recursive=1" --jq '.tree[].path'` to locate
  files, then `gh api "repos/<owner>/<repo>/contents/<path>" --jq '.content' | base64 -d` to read
  them. **Prefer `gh` over WebFetch** — `raw.githubusercontent.com` returns 404 for many repos.
- Some libraries ship a `<name>.md` next to each component with the full documented API. Read it
  before the implementation; it is faster and more accurate.

### Never name a reference library in anything we ship or author

This is a hard rule, and it applies to **source comments, JSDoc, README files, docs pages, npm
metadata and commit messages** alike:

- No `Adapted from: <repo>` headers. Write a header comment that explains what the component
  does and *why it is shaped that way* — that is the part worth keeping, and it stays true when
  the upstream changes.
- No "the React Native equivalent of X's Y utility", no "matches Z's animation constants", no
  third-party product names in prose anywhere.
- Docs describe PanelUI's behaviour on its own terms. A reader should never have to know another
  library to understand a page.

Research from them; do not credit them in the artifact. If a reference genuinely needs recording
for future maintainers, it belongs in this file or a commit body — never in shipped code.

## Two ways to consume the library

- **`panelui-native`** — the npm package. The default.
- **`panelui-cli`** — copies a component's source into a project. Backed by the registry at
  `apps/docs/public/r`, generated from `packages/panelui/src` by
  `apps/docs/scripts/build-registry.mjs` and served from panelui.dev.

The registry is generated, never hand-written, so it cannot drift. Two consequences when
changing the library:

- A **new relative import** must be resolvable by the builder, or it throws. Import from
  `../../primitives`, `../../utils/cn`, `../../icons`, `../../native`, `../<component>` or
  `../hooks/<name>` — anything else needs a mapping added to the builder first.
- A **new npm dependency** lands in the registry item automatically, but decide whether it is
  required or optional. Optional means reached through a lazy `require`/`import` inside a
  `try`/`catch`, and it must be listed in `OPTIONAL` in the builder.

## Documentation is part of the change

`apps/docs` is the published documentation site. **A component change is not complete until its
docs page is updated in the same commit.**

- Adding a component → add an entry to `apps/docs/scripts/meta.json` and `usage.json`, then
  regenerate. The MDX file and the group's `meta.json` are written for you.
- Changing a component → update that page's props table, anatomy, variant list and examples. New
  props, renamed variants and changed defaults all count.
- Removing or renaming anything → fix every page that references it.

Props tables are read from the component's actual TypeScript interfaces and their JSDoc in
`packages/panelui/src/components/<name>/index.tsx` — never written from memory. Docs that drift
from the source are worse than no docs, because they are trusted.

**The component MDX is generated, never hand-edited.** `apps/docs/scripts/extract.mjs` reads
the library source into `api.json`; `gen.mjs` merges it with the hand-written `usage.json` and
`meta.json` and writes the MDX. Edit those two JSON files and run
`npm run docs:generate --workspace=docs`, which also rebuilds the registry. See
`apps/docs/scripts/README.md` for what each `usage.json` key becomes.

### meta.json entries: group, addedIn, updatedIn and alpha

A `scripts/meta.json` entry is `[name, summary, keyword]`, optionally followed by an options
object. Four keys live there:

- **`group`** — which sidebar section the page is filed under. Omit it for `components`; pass
  `"ai-components"` for the AI Components section. The group decides both the folder the MDX is
  written to *and* the page's URL, so **regrouping an existing component moves its URL** — add a
  redirect in `apps/docs/next.config.mjs` when you do.
- **`addedIn`** — the version the component first ships in. Set it when adding a component, to
  the version you are about to release.
- **`alpha`** / **`beta`** — how settled the API is. Unlike the other two these are set and
  cleared by hand and never expire, because they are statements about how settled the API is
  rather than about which release it landed in. `alpha` means it is still moving; `beta` that
  it has stopped but has not seen enough use to promise it will not move again. They render as
  a purple **Alpha** pill and an amber **Beta** pill, a component carries at most one, and
  either wins over both dots.
- **`updatedIn`** — the version a component's API last changed in. Set it when a change is worth
  a reader's attention: a new prop, a renamed or removed variant, a changed default, new
  behaviour. Not for a bug fix that leaves the API alone.

```json
"section-rail": ["SectionRail", "…", "…", { "addedIn": "0.11.0" }],
"flow": ["Flow", "…", "…", { "addedIn": "0.19.0", "alpha": true }],
"slider": ["Slider", "…", "…", { "updatedIn": "0.15.0" }],
"shimmer": ["Shimmer", "…", "…", { "group": "ai-components" }]
```

**Both drive a dot in the docs sidebar** — blue for `addedIn`, grey for `updatedIn`. `gen.mjs`
emits `status: new` or `status: updated` into the page's frontmatter while the library version is
within **three minor releases** of the version given, and `lib/source.tsx` renders it as a dot.
Past that window it stops being emitted and the badge disappears on the next regeneration. A
component in both windows shows the blue dot only: it is still news, and two dots on one row is
noise.

Never hand-write a `status` field into an MDX file — it is generated, and the next
`docs:generate` will drop it. The whole point of deriving it is that nobody has to remember to
take the badge off.

### Full-screen demos go behind a version row

A component whose demo needs the whole screen — a chat transcript, a scroller, an editor — is
not rendered inline on the component's detail screen in `apps/example`. Squeezed into a section
between two dividers it demonstrates nothing except that it does not fit.

Mark the demo `fullPage: true` with an `id` and a `description` in
`apps/example/src/data/components.tsx`. The detail screen lists those demos under a **Versions**
heading as `Item` rows, and each pushes `/components/<slug>/<id>`, where
`app/components/[slug]/[demo].tsx` renders it edge to edge with no padding and no scroll
wrapper around it.

## Architecture

- npm-workspaces monorepo:
  - `packages/panelui` — the library (npm: `panelui-native`). Pure TypeScript, no native code.
  - `apps/example` — Expo SDK 57 showcase app (expo-router gallery of every component).
  - `apps/docs` — Fumadocs documentation site + landing page (Next.js, private, deploys to
    panelui.dev). Themed with the same tokens in their web form.
- Styling: **Uniwind** (Tailwind v4 for RN) + `tailwind-variants` for variant APIs.
- Design tokens: semantic values precomputed to static rgba/hex in `packages/panelui/theme.css`
  (native can't evaluate `color-mix()`/`--alpha()` at runtime). The web copy in
  `apps/docs/app/global.css` keeps those expressions intact; keep the two in sync.
- Animations: Reanimated 4, UI thread only. Never use RN core `Animated`.

## Commands (run from repo root)

- `npm install` — install all workspace deps
- `npm run example` — start the example app (Metro/Expo dev server)
- `npm run typecheck` — typecheck all workspaces
- `npm run build` — build the library with react-native-builder-bob (output: `lib/`)
- `npm run docs` — start the docs site; `npm run build --workspace=docs` for a production build
- Publish: bump version in `packages/panelui`, `npm run build`, `npm publish` (from that dir), tag `vX.Y.Z`

## Git & release

- **Every modification gets its own git commit.** Commit as soon as a logical unit of work is
  done — never batch unrelated changes into one commit, and never leave finished work uncommitted.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`. Scope with the component
  or area where it helps (`feat(toast): …`).
- **When everything the user asked for is finished**, in this order:
  1. `npm run typecheck` and `npm run build` — both must pass.
  2. Commit the outstanding work and **`git push` to `panel-ui/PanelUI`**.
  3. **Ask the user whether this is going out as a release.** See below — this is a question,
     asked every time, never assumed either way.
  4. Only if they say yes, do the release steps below.

### Always ask whether a release is being cut

**Finishing the work and cutting a release are two separate decisions, and the second one is the
user's.** Never infer it from the size of the change, from a component having been added, or from
the work looking finished. A run of commits with no release is a perfectly normal state for this
repo.

So at the end of every task, once the work is committed and pushed, **ask**: is this going out as
a release, and at what version? Use `AskUserQuestion` with the version you would pick — minor for
new components, parts, props or tokens; patch for fixes that leave the API alone — so answering is
one keystroke. Offer "no release yet" as an option, and take it as the end of the task.

If the answer is yes, then and only then:

1. Bump the version in `packages/panelui/package.json`. Bump it **before**
   `npm run docs:generate`, because `gen.mjs` compares the library version against
   `addedIn`/`updatedIn` to decide which sidebar dots to emit — regenerating first bakes in the
   old answer.
2. Write the release's `CHANGELOG.md` entry (see below) and commit it with the bump.
3. Push, then tag `vX.Y.Z` and cut the GitHub release from that changelog entry.
4. **Remind the user to run `npm publish`.** Never publish to npm autonomously — that stays the
   user's call whatever they answered above.

Tagging and the GitHub release are outward-facing, so confirm before the first one in a session
unless the user has already said to go ahead. Their answer to the release question counts as that
go-ahead for the release they just approved, and for that one only.

### Release notes

**Every release gets a `CHANGELOG.md` entry, patches included**, written in the same commit as the
version bump. It is the record of what changed, and the source the GitHub release is cut from —
the release commit itself touches nothing but the version, so without the entry there is nothing
anywhere saying what shipped. Releases before 0.40.0 have no entry and no tag; the changelog starts
there rather than reconstructing them.

- Newest first, `## [X.Y.Z] — YYYY-MM-DD`, grouped **Added / Changed / Fixed / Docs**. Omit a
  group that has nothing in it.
- Source it from the Conventional Commit subjects since the previous `chore(release):` commit —
  `git log --oneline <previous-release-commit>..HEAD`. Those subjects are already written to be
  read, so the entry is a regrouping rather than a rewrite.
- Write it for someone deciding whether to upgrade: what they can now do, what moved, what stopped
  being wrong. Say *why* a change was made where the reason is not obvious from the what — a
  changelog that only lists prop names is a diff with extra steps.
- The same rule as everywhere else applies: **never name a reference library**, and never credit
  one for a component's design.

## "Native" means Liquid Glass on iOS

When the user asks for something **native**, read it as: *iOS should draw it in Liquid Glass*.
That is the specific ask, not a general "use the platform toolkit" — a control that hands off to
SwiftUI but comes back looking like iOS 18 has not answered it.

- On **iOS**, `native` is not enough on its own. Pass `glass` too. It goes on through
  `buttonStyle('glass' | 'glassProminent')`, resolved by `getSwiftUIModifiers()` in
  `src/native/index.ts` — the portable `@expo/ui` props cannot ask for the material, only a
  modifier can. `glassProminent` is the tinted one and is what keeps the accent fill on a
  primary button; drawing the material by hand over a `plain` button throws that fill away.
- On **Android**, the same props mean the same thing: hand off to Jetpack Compose and let the
  platform draw it. There is no Liquid Glass there and none is faked — the material is the iOS
  half of one instruction, not a look to reproduce.
- **Liquid Glass is iOS 26+.** Below that the modifier is inert and the button keeps its ordinary
  platform style. That is indistinguishable from the prop not working, so before changing any
  code on a report of "no glass", check what the demo actually passes and what OS it is running
  on. The Button page's Liquid Glass version puts a glass button beside its non-glass twin
  precisely so those two cases can be told apart.
- **A hosted view inside a native control needs a definite size above it, on both axes.**
  Passing elements instead of a string makes the platform host them (`RNHostView`), and a
  hosted view only measures where something above it is fixed. An icon button is a square the
  component sizes, so it works; a labelled button's width is its text's and known to nobody, so
  hosting a label there leaves the width unresolved and the app dies in native code — where a
  `try` in JavaScript has nothing to catch. This has cost two crashes; do not rediscover it.
- A native control **ignores `className` and every theme token** — the platform owns its
  colours, metrics and shape. Anything the look depends on has to be a prop or a modifier, and
  spacing around it has to come from the container.

## Conventions

- One folder per component: `packages/panelui/src/components/<name>/index.tsx`; export it from `src/index.ts`.
- `tv()` variant objects at module scope, never inside render.
- Every component: `className` passthrough, accessibility role/state wiring, dark-mode via theme tokens (no hardcoded colors — resolve dynamic colors with `useCSSVariable`).
- Overlays (Dialog, BottomSheet, Select) mount lazily via `Portal` and unmount after exit animations.
- Compound components via `Object.assign` (e.g. `Card.Header`, `Dialog.Content`).
