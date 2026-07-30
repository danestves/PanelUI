<!--
Thanks for the pull request.

Keep it to one logical change — a PR that fixes a bug and refactors two other things is three
reviews wearing one coat. See CONTRIBUTING.md if you have not already.
-->

## What this changes

<!-- One or two sentences. What behaviour is different after this than before it? -->

## Why

<!--
The problem, not the patch. If there is an issue, link it — "Closes #123" will close it on merge.
-->

Closes #

## Type of change

<!-- Tick what applies. -->

- [ ] Bug fix
- [ ] New component
- [ ] New prop, variant, or behaviour on an existing component
- [ ] Breaking change — an existing API is renamed, removed, or behaves differently
- [ ] Documentation only
- [ ] Internal: refactor, tooling, CI

## How it was tested

<!--
Which platforms did you actually run it on, and what did you do? "Ran the example app on iOS,
opened the Table screen, pressed each sortable header" beats "tested".
-->

- [ ] iOS
- [ ] Android
- [ ] Light and dark themes

## Screenshots or recording

<!-- For anything visual. A before/after pair is worth a paragraph of description. -->

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] Animations use Reanimated on the UI thread, not the React Native `Animated` API
- [ ] No hardcoded colours — everything resolves through the theme tokens
- [ ] Interactive parts wire up `accessibilityRole` and mirror their state
- [ ] Every new part accepts `className`

### If this touches a component's API

- [ ] `apps/docs/scripts/meta.json` and `usage.json` are updated, with `addedIn` or `updatedIn` set
- [ ] `npm run docs:generate --workspace=docs` has been run and the generated files are committed
- [ ] A demo exists in `apps/example/src/data/components.tsx`
- [ ] Props tables read correctly — they come from the TypeScript interfaces and their JSDoc

### If this adds a component

- [ ] Exported from `packages/panelui/src/index.ts`, with its types
- [ ] Listed in `README.md` and `packages/panelui/README.md`, and the counts updated there and in
      `apps/docs/content/docs/index.mdx`

## Notes for the reviewer

<!--
Anything you are unsure about, a decision you would like a second opinion on, or a part of the
diff worth reading first.
-->
