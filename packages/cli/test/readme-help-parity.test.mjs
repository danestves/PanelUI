import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/panelui.mjs', import.meta.url));
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

function topLevelCommands(help) {
  const section = help.match(/\nCommands\n(?<commands>[\s\S]*?)\n\n\S/);
  assert.ok(section?.groups?.commands, 'CLI help must contain a Commands section');

  return [
    ...new Set(
      section.groups.commands
        .split('\n')
        .map((line) => line.match(/^  (?<command>[a-z][\w-]*)\b/)?.groups?.command)
        .filter(Boolean)
    ),
  ];
}

test('README keeps a command section for every command shipped in top-level help', () => {
  const result = spawnSync(process.execPath, [cli, '--help'], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });

  assert.equal(result.status, 0, result.stderr);
  const commands = topLevelCommands(result.stdout);
  assert.ok(commands.length > 0, 'top-level help must expose at least one command');

  for (const command of commands) {
    assert.match(readme, new RegExp('^### `' + command + '(?:\\s[^`]*)?`$', 'm'), command);
  }
});
