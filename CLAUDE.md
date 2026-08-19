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

### Write a guide, not an argument

Docs prose is there to be *used*. A reader arrives with a decision to make — should I use this,
and how — and the page has to answer it in the order they need it:

1. **What it is for**, in a plain sentence. Not an aphorism, not a fragment.
2. **The trade-off or constraint**, stated. "It needs a height to fill."
3. **The workaround**, where there is one. "Pad the bottom of the list."
4. **The alternatives**, linked. "For one row's actions, use Swipe."

Those are four separate statements, and keeping them separate is the whole point — a reader
skimming for the constraint should find it as its own paragraph, not buried in the middle of a
sentence that is also making a case.

What to stop doing, because all of it was here and a user filed an issue about it:

- **No aphoristic openers.** "It floats, which is the whole problem with it." Say what it does.
- **No arguing towards a verdict.** State the constraint and move on; the reader did not come
  for the reasoning that produced the API, they came to use it.
- **No rhetorical flourishes** — "a column of unlabelled circles is a quiz", "the failure people
  actually hit", "which is the honest shape". They read as an assistant thinking out loud.
- **Don't restate the summary as the first line.** `meta.json` already carries it; the intro
  repeating it verbatim wastes the one line most readers read.

Say *why* where the why changes what somebody does — "the baseline stays zero, because a bar
cropped at the bottom is a length that lies" earns its place. Cut it where it only justifies a
decision already made.

This applies to `intro`, `examples[].description`, `notes` and `parts` in `usage.json`, to prop
JSDoc (which becomes the props table), and to `CHANGELOG.md` entries.

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

**Both drive a mark in the docs sidebar** — a blue dot for `addedIn`, a grey **Updated** pill for
`updatedIn`. `gen.mjs` emits `status: new` or `status: updated` into the page's frontmatter while
the library version is inside that mark's window, and `lib/source.tsx` renders it.

**The two windows are different lengths, and deliberately so.** `addedIn` runs for **three minor
releases**: a component arriving is worth knowing about for a while, whoever you are. `updatedIn`
runs for **one** — it is gone the moment anything else ships. A change only ever means something
to a reader who already has the component and has not upgraded yet, and that reader has moved on
by the next release. Held for three it was on so many rows at once that it stopped pointing at
anything.

Past its window a mark stops being emitted and disappears on the next regeneration. A component
inside both windows shows the blue dot only: it is still news, and two marks on one row is noise.

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

### Screenshots and recordings: convert, never reframe

The previews on the docs pages are recorded on a device and left in `~/Downloads`. Placing them
is a mechanical job, and the one rule that matters is this:

> **Never crop, pan, reframe or re-time a recording. The framing is the author's.**

A crop that looks like it tightens the shot is a crop that cuts the button off the bottom of it,
and nobody reviewing a docs page can tell what was lost. Convert the container, resample the
whole frame to the folder's width, and stop there.

**Which file goes where.** The filename says it, and the words are load-bearing:

| In the name | Where it goes |
| --- | --- |
| `top` | The `preview` / `previewVideo` under the page's intro |
| `<title> version` | The `examples` or `versions` entry with that title |
| `top and <title> version` | **Both** — the top preview *and* that entry |

Only the current day's batch is in play. `~/Downloads` keeps months of these, and an older file
with the same name is a recording of a component that has since changed — check the dates, and
where two files claim the same slot, the later one wins.

**The conversion, exactly.** Everything here matches the 146 previews already in
`apps/docs/public/previews`, and the point of writing it down is that a file which differs is
the odd one out on a page beside them:

```bash
# video: any container -> mp4, whole frame, 720 points wide
ffmpeg -i "<source>" -vf scale=720:-2:flags=lanczos \
  -an -c:v libx264 -preset slow -crf 26 \
  -pix_fmt yuv420p -movflags +faststart "<slug>[-<kebab-title>].mp4"

# its poster: the first frame, whole
ffmpeg -i "<slug>.mp4" -frames:v 1 -q:v 3 "<slug>[-<kebab-title>]-poster.jpg"
```

- `-2` keeps the aspect ratio and rounds the height to something H.264 accepts. Scaling is not
  cropping — every pixel of the frame survives, and 720 is roughly a third of the decode work
  of a native-resolution recording played in a column half its width.
- **Stills are already framed at 1179 points.** Re-encode them to `.jpg` at quality 90 and do
  not resize them.
- Strip the audio. None of these have any, and a silent track is bytes on every page load.

**Wiring it up.** Files go in `apps/docs/public/previews`; the entries go in
`apps/docs/scripts/usage.json`, never into an MDX file by hand. A video is `previewVideo` with a
`poster`; a still is `preview`. Both carry `alt` and the **real pixel dimensions** — Next needs
them to reserve the aspect ratio, and a wrong number is a page that jumps as it loads.

If a recording has no example or version to attach to, **write the example**. Attaching it to a
neighbouring one because the name is close puts a caption on a video that shows something else,
which is worse than the gap it filled.

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
- `npm test` — discover and run every repository contract test; rejects focused `.only` tests
- `npm run typecheck` — typecheck all workspaces
- `npm run build` — build the library with react-native-builder-bob (output: `lib/`)
- `npm run docs` — start the docs site; `npm run build --workspace=docs` for a production build
- Publish: **nobody runs `npm publish` by hand.** Cutting a GitHub release publishes the package
  it is tagged for — see below.

### Never launch a simulator on your own

**Do not boot the iOS Simulator, an Android emulator, or a device build unless the user asks for
it in so many words.** Not to check a change, not to take a screenshot, not to confirm something
renders. It takes over the machine, and deciding when to look at the app is the user's call.

Verify with `npm run typecheck`, `npm run build` and `npm run docs:generate` instead, and say
plainly which parts of a change are unverified until somebody runs it. When a change genuinely
needs eyes on a device, ask; do not start one and report back.

## Reviewing and landing pull requests

Batches of contributor PRs arrive together, and "review them" means the same thing every time:
read each one for defects and security problems, **push the fixes onto the contributor's branch**
rather than landing a follow-up commit on `main`, and merge them one at a time in an order chosen
so the conflicts are small.

### Order the batch before touching any of it

List what every PR touches first. Two rules decide the order, and both exist because getting them
wrong loses work silently:

- **A PR that rewrites or deletes a file other PRs edit goes first, not last.** Rebasing a
  wholesale replacement over other people's edits resolves as "deleted by us" and drops them with
  no conflict to notice. Landing it first turns the same problem into a mechanical redirect —
  move each later PR's hunk into wherever the content lives now — which the generated-file check
  then verifies.
- **After that, largest diff first** among PRs sharing a file. `.github/workflows/ci.yml` and the
  root `package.json` are the usual pile-up; a batch of tooling PRs will all add a step and a
  script, and every one of those conflicts is additive — keep both sides.

When a PR's edits have to be redirected, do it by comparing the PR against **its own base**, not
against `main`. Apply only what the PR actually changed, and stop if `main` has moved on the same
key — that one needs a real three-way merge, by hand, keeping both changes.

### Generated files are regenerated, never merged

`apps/docs/content/docs/**/*.mdx`, `apps/docs/public/r/*.json`, `apps/docs/public/skills/**`,
`skills/**`, `catalogue.json` and `apps/docs/lib/public-api.generated.json` are artifacts. On a
conflict take either side, run `npm run docs:generate --workspace=docs`, and amend. Never resolve
one by hand — the diff will look plausible and be wrong.

### The gates, per PR

```bash
npm run typecheck
npm run build
npm test                                              # every contract test
npm run docs:generate --workspace=docs && git diff --exit-code
npm run verify:package --workspace=panelui-native
```

The `git diff --exit-code` is the load-bearing one: a non-empty diff means generated output was
hand-written and has drifted. Then merge only once the PR's own `check` run is green.

### What to actually look for

CI catches drift, types and tests. It does not catch these, so they are the review:

- **Anything that reaches a path, a URL or a shell.** A name that came from a registry, a
  lockfile, an MCP argument or a config is untrusted. Confirm it is validated at the point it
  becomes a path, and that the containment helpers still gate every route in.
- **A gate that behaves differently where it runs.** Check which workflows run each new check and
  under which npm. `publish.yml` and `publish-cli.yml` install `npm@latest`; CI runs Node's
  bundled npm. A verifier that passes in one and crashes in the other fails *after* the tag
  exists, which is the worst moment available. This has happened once and cost a release.
- **A budget with no headroom.** Size and count ceilings that a few ordinary components can cross
  turn a normal week into a red build. Ask what the current number is and how much room is left,
  and say so in a comment next to the number.
- **A check that only passes on a clean checkout.** Scripts that walk the filesystem must ignore
  what the platform and the tooling leave behind — `node_modules`, `.expo`, `expo-env.d.ts`,
  `.DS_Store`. CI never sees those, so the check passes there and fails for every human.
- **Docs prose**, against the guide rules above, and the props table, anatomy and variants against
  what the diff actually changed.

`updatedIn` in `apps/docs/scripts/meta.json` is bookkeeping for the release, not the merge — set
it after the version bump, never while landing the PR.

Report `npm audit` rather than acting on it; the findings are transitive through the Expo and
sharp toolchains and are a standing known state.

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

**Publishing is the release's job, not a command anybody types.** `.github/workflows/publish.yml`
fires on `release: published`, checks the tag against `packages/panelui/package.json`, builds, and
publishes with provenance over npm Trusted Publishing — there is no npm token in this repository.
So cutting the release *is* publishing, and step 3 is the last one. Never run `npm publish` by
hand; the version will already be on the registry and the second attempt fails.

**The CLI packages are released separately**, by `.github/workflows/publish-cli.yml`, and versioned
independently of the library and of each other. Which package a release is for comes from its tag:

| Tag | Publishes |
| --- | --- |
| `vX.Y.Z` | `packages/panelui` → `panelui-native` |
| `cli-vX.Y.Z` | `packages/cli` → `panelui-cli` |
| `create-vX.Y.Z` | `packages/create-panelui-app` → `create-panelui-app` |

`create-panelui-app` depends on `panelui-cli`, so a breaking change to the `panelui-cli/init` or
`panelui-cli/ui` subpath exports needs both released, cli first.

Tagging and the GitHub release are outward-facing — and now publish — so confirm before the first
one in a session unless the user has already said to go ahead. Their answer to the release question
counts as that go-ahead for the release they just approved, and for that one only.

### What builds when

Four workflows, and nothing else runs on its own. This is the whole picture:

| Event | What runs | What it produces |
| --- | --- | --- |
| Push to `main`, or any pull request | `ci.yml` | Nothing published. Typecheck, template parity, catalogue and theme parity, build, contract tests, accessibility gate, generated-file drift, template typechecks, package and registry budgets. A second job re-runs the CLI tests on Node 20. |
| Push to `main`, or any pull request | — | **No Vercel build.** `apps/docs/vercel.json` sets `git.deploymentEnabled: false`. |
| Release published, tag `vX.Y.Z` | `publish.yml` | `panelui-native` on npm, via OIDC trusted publishing. |
| Release published, tag `vX.Y.Z` | `deploy-docs.yml` | panelui.dev, by firing a Vercel deploy hook. |
| Release published, tag `cli-v*` | `publish-cli.yml` | `panelui-cli` on npm. |
| Release published, tag `create-v*` | `publish-cli.yml` | `create-panelui-app` on npm. |
| **Deploy docs** run by hand | `deploy-docs.yml` | panelui.dev, from the current `main`. |

Every workflow on `release: published` sees **every** release and filters by tag prefix itself, so
a `cli-v*` release does not redeploy a docs site it did not change, and does not reach the
library's version check.

### panelui.dev deploys on release, not on merge

The site used to build through Vercel's Git integration, which meant a full Next.js build for every
push and every pull request — of a site whose content only changes meaning when a version ships.
An open batch of pull requests turned that into dozens of builds nobody read.

Two pieces make the current arrangement, and they have to stay in step:

- **`apps/docs/vercel.json`** turns the Git integration off. It lives in `apps/docs` because that
  is the project's Root Directory in Vercel, and **it is validated against a schema that rejects
  unknown properties** — a `//` key put there as a comment fails every deployment before it reaches
  a build, with no build log to explain it. Explanations go in this file or in the workflow, not in
  that one.
- **`.github/workflows/deploy-docs.yml`** fires a Vercel deploy hook. The hook URL is the repository
  secret `VERCEL_DEPLOY_HOOK`; it is created in Vercel under Settings → Git → Deploy Hooks, bound to
  `main`. Deploy hooks are unaffected by `deploymentEnabled: false` — that setting gates the Git
  integration, not the hook.

**A documentation change that is not part of a release does not reach panelui.dev on its own.**
New previews, a corrected props table and a typo fix all sit on `main` until the next release. To
publish them now, run the **Deploy docs** workflow by hand from the Actions tab — that is what the
`workflow_dispatch` trigger is for, and using it is expected rather than exceptional. The hook is
bound to `main`, so the branch picker in the Actions UI has no say in what Vercel builds.

The docs build runs `prebuild` before `next build`, which regenerates the icons, the registry, the
skill and its assets, and **checks the API reference is current**. So a library change committed
without running `docs:generate` fails the deploy — after CI has already caught it, but the second
line matters because the deploy is the one that happens after the tag exists.

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
