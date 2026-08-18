# Accessibility release checklist

## Scope and limits

Run `npm run test:a11y` first. It covers deterministic source contracts for
contrast, reduced transparency, motion controls, target sizes, modal isolation,
structured content, chart semantics, accessible actions, and web composite keyboards. It
is not an axe scan, WCAG certification, or substitute for assistive-technology
testing.

Test a release candidate on one current iOS device or simulator with VoiceOver
and one current Android device or emulator with TalkBack. Record OS, device,
app build, tester, and date. Use nontrivial data, large text, dark mode, and both
portrait and landscape where the component supports them.

- **Dynamic Type / font size:** at 200% and the platform maximum, check `sm`,
  `md`, and `lg` Buttons with a long label and start/end icons, both alone and
  in a ButtonGroup. Labels may wrap and labelled controls may grow; no glyph is
  cropped, icon-only Buttons remain square, and adjacent targets do not overlap.
  Reference: `packages/panelui/test/button-dynamic-type.test.mjs`.

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
  `packages/panelui/test/chart-accessibility.test.mjs`,
  `packages/panelui/src/components/map/index.tsx`,
  `packages/panelui/src/components/flow/index.tsx`, and
  `packages/panelui/src/components/line-chart/index.tsx`.
- **Signature:** hear empty/signed state, draw strokes, use undo/redo/clear, and
  reach the product-provided alternative input method. Reference:
  `packages/panelui/test/signature-accessibility.test.mjs`.
- **Marquee:** reach the visible Pause control, stop and restart motion, then
  traverse interactive content once. Repeated and measurement copies must not
  receive focus. Reference: `packages/panelui/test/marquee-math.test.mjs`.

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
- Tab through a Marquee with interactive content, pause and restart it, and
  confirm neither hidden repeated copies nor the measurement copy receive focus.

Automated contract references: `apps/docs/test/composite-keyboard.test.mjs`,
`packages/panelui/test/context-menu-invocation.test.mjs`, and
`packages/panelui/test/marquee-math.test.mjs`.

## Native journey receipts

The seven cross-component journeys in
`docs/accessibility-native-journeys.json` are the bounded native release
matrix. Run all seven on both platforms rather than selecting only the paths
changed in the release:

1. Build the exact release commit and record its SHA.
2. Create a local template (the ignored directory prevents device evidence
   from entering the repository):

   ```sh
   mkdir -p accessibility-receipts
   npm run test:a11y:native -- --template > accessibility-receipts/<sha>.json
   ```

3. On VoiceOver/iOS and TalkBack/Android, fill in OS, device, build, tester,
   date, pass/fail, and a screenshot/video/log path or link for every journey.
4. Validate the complete receipt:

   ```sh
   npm run test:a11y:native -- --receipt accessibility-receipts/<sha>.json
   ```

The validator rejects a missing platform, missing journey, pending result,
missing evidence, or any failed result. It does not operate the device or
claim that typed evidence proves the observation; the named tester owns that
release decision.

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
- [ ] The native journey receipt passes for the exact release commit.
- [ ] Keyboard scenarios pass in a supported browser.
- [ ] The docs browser accessibility smoke passes.
- [ ] Failures are filed with component, platform, build, steps, expected
      announcement/focus, and actual announcement/focus. No claim of full WCAG
      or device coverage is made from this checklist alone.
