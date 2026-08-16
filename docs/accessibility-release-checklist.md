# Accessibility release checklist

## Scope and limits

Run `npm run test:a11y` first. It covers deterministic source contracts for
contrast, reduced transparency, target sizes, modal isolation, structured
content, accessible actions, and web composite keyboards. It is not an axe
scan, WCAG certification, or substitute for assistive-technology testing.

Test a release candidate on one current iOS device or simulator with VoiceOver
and one current Android device or emulator with TalkBack. Record OS, device,
app build, tester, and date. Use nontrivial data, large text, dark mode, and both
portrait and landscape where the component supports them.

## VoiceOver — iOS

- **Dialog and nested overlays:** open a Dialog, then a nested menu or picker.
  Focus enters the active overlay, background content is skipped, Escape/dismiss
  closes only the top layer, and focus returns to the opener. Reference:
  `packages/panelui/test/modal-isolation-store.test.mjs`.
- **ContextMenu:** reach the trigger by swipe, invoke its Show Menu action,
  traverse every item and dismiss it. The trigger remains named and disabled
  state prevents opening. Reference:
  `packages/panelui/test/context-menu-invocation.test.mjs`.
- **Adjustable and reorder controls:** increment/decrement Slider and TimePicker,
  then move a Sortable item with accessibility actions. Announced values stay
  within bounds and each action changes exactly one step. References:
  `packages/panelui/test/slider-haptics.test.mjs`,
  `packages/panelui/test/time-picker-accessibility.test.mjs`, and
  `packages/panelui/test/sortable-reorder.test.mjs`.
- **Structured visuals:** traverse a populated Map, Flow, and chart. Meaningful
  features/data are reachable without focusing decorative geometry, and an
  actionable datum activates the same behavior as touch. Sources:
  `packages/panelui/src/components/map/index.tsx`,
  `packages/panelui/src/components/flow/index.tsx`, and
  `packages/panelui/src/components/line-chart/index.tsx`.
- **Signature:** hear empty/signed state, draw strokes, use undo/redo/clear, and
  reach the product-provided alternative input method. Reference:
  `packages/panelui/test/signature-accessibility.test.mjs`.

## TalkBack — Android

Repeat the VoiceOver scenarios using swipe navigation and the local context
menu. Confirm roles, names, selected/disabled/expanded state, action results,
overlay isolation, and focus return. Also verify 200% font size does not hide
the active control or its label, and touch targets remain operable without
overlap. Target-size reference: `packages/panelui/test/core-target-sizes.test.mjs`.

## Keyboard — web

- In InstallTabs, Tab reaches only the selected tab. Left/Right wrap, Home/End
  select the edges, focus follows selection, and each panel is correctly linked.
- In the theme radio group, one checked radio is tabbable; arrows wrap and
  select, while Home/End select the edges.
- Open ContextMenu with the Context Menu key and Shift+F10, dismiss with Escape,
  and confirm focus remains on its trigger.

Automated contract references: `apps/docs/test/composite-keyboard.test.mjs` and
`packages/panelui/test/context-menu-invocation.test.mjs`.

## Browser automation — docs

After the production docs build, run `npm run test:a11y:browser`. It starts that
build locally and runs axe in headless Chromium against the home page, docs
shell, and Button guide using WCAG 2.0, 2.1, and 2.2 A/AA rules. This bounded
smoke catches deterministic markup regressions; it is not a site-wide crawl,
an assistive-technology test, or WCAG certification.

## Sign-off

- [ ] `npm run test:a11y` passes at the release commit.
- [ ] VoiceOver scenarios pass; device/build evidence is linked.
- [ ] TalkBack scenarios pass; device/build evidence is linked.
- [ ] Keyboard scenarios pass in a supported browser.
- [ ] The docs browser accessibility smoke passes.
- [ ] Failures are filed with component, platform, build, steps, expected
      announcement/focus, and actual announcement/focus. No claim of full WCAG
      or device coverage is made from this checklist alone.
