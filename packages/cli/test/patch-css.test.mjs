import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { patchCss } from '../src/patch.mjs';

async function withProject(run) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-cli-css-'));
  try {
    await run(cwd);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

const config = (css) => ({
  css,
  theme: 'theme.css',
  aliases: {
    components: '@/components/ui',
    lib: '@/lib',
    hooks: '@/hooks',
  },
});

test('patchCss preserves root CSS import and source paths', async () => {
  await withProject(async (cwd) => {
    await patchCss(cwd, config('global.css'), { assumeYes: true, dryRun: false });

    assert.equal(
      fs.readFileSync(path.join(cwd, 'global.css'), 'utf8'),
      [
        "@import 'tailwindcss';",
        "@import 'uniwind';",
        "@import './theme.css';",
        "@source './components';",
        "@source './lib';",
        "@source './hooks';",
        '',
      ].join('\n')
    );
  });
});

test('patchCss generates portable paths from a nested CSS entry', async () => {
  await withProject(async (cwd) => {
    const cssPath = path.join(cwd, 'app/styles/global.css');
    fs.mkdirSync(path.dirname(cssPath), { recursive: true });
    fs.writeFileSync(
      cssPath,
      [
        "@import 'tailwindcss';",
        "@import 'uniwind';",
        "@import './theme.css';",
        "@source './components';",
        "@source './lib';",
        "@source './hooks';",
        '',
      ].join('\n')
    );

    await patchCss(cwd, config('app/styles/global.css'), { assumeYes: true, dryRun: false });

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /@import '\.\.\/\.\.\/theme\.css';/);
    assert.match(css, /@source '\.\.\/\.\.\/components';/);
    assert.match(css, /@source '\.\.\/\.\.\/lib';/);
    assert.match(css, /@source '\.\.\/\.\.\/hooks';/);
    assert.ok(!css.includes('\\'));
  });
});

test('patchCss generates relative paths for a new nested CSS entry', async () => {
  await withProject(async (cwd) => {
    await patchCss(cwd, config('app/styles/global.css'), { assumeYes: true, dryRun: false });

    assert.equal(
      fs.readFileSync(path.join(cwd, 'app/styles/global.css'), 'utf8'),
      [
        "@import 'tailwindcss';",
        "@import 'uniwind';",
        "@import '../../theme.css';",
        "@source '../../components';",
        "@source '../../lib';",
        "@source '../../hooks';",
        '',
      ].join('\n')
    );
  });
});
