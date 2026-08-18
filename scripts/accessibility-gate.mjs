import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ACCESSIBILITY_SUITES = [
  {
    class: 'gate-integrity',
    file: 'packages/panelui/test/accessibility-gate.test.mjs',
    count: 3,
    anchor: 'the accessibility gate rejects a removed class, suite, required test, or count drift',
  },
  {
    class: 'perception',
    file: 'packages/panelui/test/theme-solid-contrast.test.mjs',
    count: 3,
    anchor: 'solid text pairs clear the WCAG AA normal-text floor',
  },
  {
    class: 'perception',
    file: 'packages/panelui/test/timeline-contrast.test.mjs',
    count: 2,
    anchor: 'horizontal Timeline keeps informative content fully opaque',
  },
  {
    class: 'perception',
    file: 'packages/panelui/test/scrim-transparency.test.mjs',
    count: 6,
    anchor: 'rendering decisions suppress blur until it is explicitly allowed',
  },
  {
    class: 'target-size',
    file: 'packages/panelui/test/core-target-sizes.test.mjs',
    count: 1,
    anchor: 'compact core controls keep 48dp interaction boxes',
  },
  {
    class: 'large-text',
    file: 'packages/panelui/test/button-dynamic-type.test.mjs',
    count: 2,
    anchor: 'labelled Button sizes are floors with scalable intrinsic line boxes',
  },
  {
    class: 'motion-control',
    file: 'packages/panelui/test/marquee-math.test.mjs',
    count: 5,
    anchor: 'only the spoken Marquee copy can receive pointer or keyboard interaction',
  },
  {
    class: 'modal-isolation',
    file: 'packages/panelui/test/modal-isolation-store.test.mjs',
    count: 3,
    anchor: 'closing one nested modal keeps the app isolated for the other',
  },
  {
    class: 'structured-content',
    file: 'packages/panelui/test/flow-accessibility.test.mjs',
    count: 4,
    anchor: 'the node owns actions and visual handles no longer claim button behavior',
  },
  {
    class: 'structured-content',
    file: 'packages/panelui/test/map-accessibility.test.mjs',
    count: 3,
    anchor: 'describes every feature from the same FeatureCollection used by the layer',
  },
  {
    class: 'chart-semantics',
    file: 'packages/panelui/test/chart-accessibility.test.mjs',
    count: 4,
    anchor: 'all confirmed chart families use the shared semantic sibling',
  },
  {
    class: 'accessible-actions',
    file: 'packages/panelui/test/context-menu-invocation.test.mjs',
    count: 3,
    anchor: 'ContextMenu accessibility actions preserve menu and primary activation semantics',
  },
  {
    class: 'accessible-actions',
    file: 'packages/panelui/test/signature-accessibility.test.mjs',
    count: 4,
    anchor: 'only currently usable signature actions are exposed',
  },
  {
    class: 'accessible-actions',
    file: 'packages/panelui/test/slider-haptics.test.mjs',
    count: 4,
    anchor: 'accessibility changes update the same per-thumb history',
  },
  {
    class: 'accessible-actions',
    file: 'packages/panelui/test/sortable-reorder.test.mjs',
    count: 5,
    anchor: 'accessibility steps cross adjacent pinned slots without moving them',
  },
  {
    class: 'accessible-actions',
    file: 'packages/panelui/test/time-picker-accessibility.test.mjs',
    count: 5,
    anchor: 'disabled adjustable controls ignore actions',
  },
  {
    class: 'web-keyboard',
    file: 'apps/docs/test/composite-keyboard.test.mjs',
    count: 4,
    anchor: 'horizontal tabs wrap and support Home and End without consuming vertical keys',
  },
  {
    class: 'native-journeys',
    file: 'test/accessibility-native-journeys.test.mjs',
    count: 3,
    anchor: 'native accessibility journeys cover the bounded release matrix',
  },
];

export const REQUIRED_CLASSES = [
  'gate-integrity',
  'perception',
  'target-size',
  'large-text',
  'motion-control',
  'modal-isolation',
  'structured-content',
  'chart-semantics',
  'accessible-actions',
  'web-keyboard',
  'native-journeys',
];

export const CHECKLIST = 'docs/accessibility-release-checklist.md';
export const CHECKLIST_SECTIONS = [
  '## Scope and limits',
  '## VoiceOver — iOS',
  '## TalkBack — Android',
  '## Keyboard — web',
  '## Native journey receipts',
  '## Sign-off',
];

function testNames(source) {
  return [...source.matchAll(/\b(?:test|it)\(\s*(['"`])([^'"`\n]+)\1/g)].map((match) => match[2]);
}

export function validateAccessibilityGate({
  root = ROOT,
  suites = ACCESSIBILITY_SUITES,
  checklist = CHECKLIST,
} = {}) {
  const errors = [];
  const classes = new Set(suites.map((suite) => suite.class));
  for (const required of REQUIRED_CLASSES) {
    if (!classes.has(required)) errors.push(`Missing required accessibility class: ${required}`);
  }

  for (const suite of suites) {
    const absolute = path.join(root, suite.file);
    if (!fs.existsSync(absolute)) {
      errors.push(`Missing accessibility suite: ${suite.file}`);
      continue;
    }
    const names = testNames(fs.readFileSync(absolute, 'utf8'));
    if (names.length !== suite.count) {
      errors.push(`${suite.file} must contain ${suite.count} tests; found ${names.length}`);
    }
    if (!names.includes(suite.anchor)) {
      errors.push(`${suite.file} is missing required test: ${suite.anchor}`);
    }
  }

  const checklistPath = path.join(root, checklist);
  if (!fs.existsSync(checklistPath)) return [...errors, `Missing manual checklist: ${checklist}`];
  const manual = fs.readFileSync(checklistPath, 'utf8');
  for (const section of CHECKLIST_SECTIONS) {
    if (!manual.includes(section)) errors.push(`Manual checklist is missing section: ${section}`);
  }
  for (const match of manual.matchAll(/`((?:packages|apps)\/[^`]+)`/g)) {
    if (!fs.existsSync(path.join(root, match[1]))) {
      errors.push(`Manual checklist references a missing path: ${match[1]}`);
    }
  }
  return errors;
}

function run() {
  const errors = validateAccessibilityGate();
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join('\n'));
    process.exitCode = 1;
    return;
  }
  const files = [...new Set(ACCESSIBILITY_SUITES.map((suite) => suite.file))];
  console.log(`Accessibility gate: ${REQUIRED_CLASSES.length} classes, ${files.length} suites`);
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--test', ...files],
    { cwd: ROOT, stdio: 'inherit' }
  );
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();
