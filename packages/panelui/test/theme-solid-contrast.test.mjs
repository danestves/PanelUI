import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const themes = ['light', 'dark', 'moon', 'moon-dark', 'grass', 'grass-dark'];
const statuses = ['destructive', 'info', 'success', 'warning'];
const nativeCss = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
const docsCss = readFileSync(new URL('../../../apps/docs/app/panel-themes.css', import.meta.url), 'utf8');

function block(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`unclosed ${marker}`);
}

function tokens(source, marker) {
  return Object.fromEntries(
    [...block(source, marker).matchAll(/--(?:color-)?([\w-]+):\s*([^;]+);/g)].map(
      ([, name, value]) => [name, value.trim()]
    )
  );
}

function parseColor(value) {
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const size = hex.length === 3 ? 1 : 2;
    const channels = [...hex.matchAll(new RegExp(`.{${size}}`, 'g'))].map(({ 0: part }) =>
      Number.parseInt(size === 1 ? part.repeat(2) : part, 16)
    );
    return [...channels, channels[3] === undefined ? 1 : channels[3] / 255];
  }
  const match = value.match(/^rgba?\(([^)]+)\)$/);
  assert.ok(match, `unsupported color ${value}`);
  const channels = match[1].split(',').map(Number);
  return [channels[0], channels[1], channels[2], channels[3] ?? 1];
}

function composite(foreground, background) {
  const [fr, fg, fb, fa] = parseColor(foreground);
  const [br, bg, bb, ba] = parseColor(background);
  const alpha = fa + ba * (1 - fa);
  return [
    (fr * fa + br * ba * (1 - fa)) / alpha,
    (fg * fa + bg * ba * (1 - fa)) / alpha,
    (fb * fa + bb * ba * (1 - fa)) / alpha,
    alpha,
  ];
}

function luminance([red, green, blue]) {
  const linear = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function ratio(foreground, background) {
  const foregroundLuminance = luminance(parseColor(foreground));
  const backgroundLuminance = luminance(parseColor(background));
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function rgba([red, green, blue, alpha]) {
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const nativeThemes = Object.fromEntries(
  themes.map((theme) => [theme, tokens(nativeCss, `@variant ${theme} {`)])
);
const docsThemes = Object.fromEntries(
  themes.map((theme) => [theme, tokens(docsCss, `[data-panel-theme='${theme}'] {`)])
);

test('native and docs solid token matrices stay identical', () => {
  for (const theme of themes) {
    for (const token of [
      'background',
      'primary',
      'primary-foreground',
      ...statuses.flatMap((status) => [
        status,
        `${status}-foreground`,
        `${status}-solid-foreground`,
        `${status}-subtle`,
      ]),
    ]) {
      assert.equal(docsThemes[theme][token], nativeThemes[theme][token], `${theme} ${token}`);
    }
  }
});

test('solid text pairs clear the WCAG AA normal-text floor', () => {
  const rows = [];
  for (const theme of themes) {
    const palette = nativeThemes[theme];
    const pairs = [
      ['primary', 'primary-foreground'],
      ...statuses.map((status) => [status, `${status}-solid-foreground`]),
    ];
    for (const [surface, text] of pairs) {
      const contrast = ratio(palette[text], palette[surface]);
      rows.push(`${theme.padEnd(10)} ${surface.padEnd(11)} ${contrast.toFixed(3)}:1`);
      assert.ok(contrast >= 4.5, `${theme} ${text} on ${surface}: ${contrast.toFixed(3)}:1`);
    }
  }
  console.log(`\nSolid text contrast (AA normal text >= 4.5:1):\n${rows.join('\n')}`);
});

test('subtle status aliases remain legible after alpha compositing', () => {
  for (const theme of themes) {
    const palette = nativeThemes[theme];
    for (const status of statuses) {
      const surface = rgba(composite(palette[`${status}-subtle`], palette.background));
      const contrast = ratio(palette[`${status}-foreground`], surface);
      assert.ok(
        contrast >= 4.5,
        `${theme} ${status}-foreground on composited ${status}-subtle: ${contrast.toFixed(3)}:1`
      );
    }
  }
});
