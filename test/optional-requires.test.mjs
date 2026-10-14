/**
 * An optional peer dependency has to be optional to Metro, not only to npm.
 *
 * Metro resolves every `require('literal')` and `import('literal')` when it
 * bundles, before any of the library's code runs. A missing package is a build
 * failure unless Metro has marked that dependency optional, and it decides that
 * from where the call sits: walking out from the call, the first block it meets
 * must be the `try` block of a `try` statement. A `require` one `if` deeper is a
 * hard dependency, however carefully the `catch` below it handles the package
 * being absent — the bundle never gets as far as running it.
 *
 * That is invisible in this repository, where every optional peer is installed,
 * and it broke every app scaffolded without `react-native-keyboard-controller`.
 * So the position is checked here, the way Metro checks it.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIBRARY = path.join(ROOT, 'packages/panelui');
const SOURCE = path.join(LIBRARY, 'src');

const manifest = JSON.parse(fs.readFileSync(path.join(LIBRARY, 'package.json'), 'utf8'));
const OPTIONAL = new Set(
  Object.entries(manifest.peerDependenciesMeta ?? {})
    .filter(([, meta]) => meta?.optional)
    .map(([name]) => name),
);

/** `@scope/name/sub/path` → `@scope/name`; `name/sub` → `name`. */
function packageOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function sourceFiles(directory, found = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) found.push(full);
  }
  return found;
}

/**
 * Metro's rule, from `isOptionalDependency` in its dependency collector: walk
 * out through at most three statements; the first block reached decides, and
 * it has to be the `try` block of a `try` statement.
 */
function inTryBlock(node) {
  let statements = 0;
  for (let current = node; current && statements < 3; current = current.parent) {
    if (ts.isBlock(current)) {
      return ts.isTryStatement(current.parent) && current.parent.tryBlock === current;
    }
    if (isStatement(current)) statements += 1;
  }
  return false;
}

function isStatement(node) {
  return (
    ts.isExpressionStatement(node) ||
    ts.isVariableStatement(node) ||
    ts.isReturnStatement(node) ||
    ts.isIfStatement(node) ||
    ts.isThrowStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isIterationStatement(node, false)
  );
}

/** Every package `require`/`import()` call, and every static value import. */
function collect() {
  const calls = [];
  const imports = [];

  for (const file of sourceFiles(SOURCE)) {
    const text = fs.readFileSync(file, 'utf8');
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
    const where = (node) =>
      `${path.relative(ROOT, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
        const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
        const [argument] = node.arguments;
        if ((isRequire || isImport) && argument && ts.isStringLiteralLike(argument)) {
          calls.push({ specifier: argument.text, optional: inTryBlock(node), at: where(node) });
        }
      }
      if (
        ts.isImportDeclaration(node) &&
        !node.importClause?.isTypeOnly &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        imports.push({ specifier: node.moduleSpecifier.text, at: where(node) });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return { calls, imports };
}

const { calls, imports } = collect();

test('the library has optional peers to check', () => {
  assert.ok(OPTIONAL.has('react-native-keyboard-controller'));
  assert.ok(
    calls.some((call) => OPTIONAL.has(packageOf(call.specifier))),
    'no optional require was found, so the walk is broken',
  );
});

test('every optional peer is required where Metro treats it as optional', () => {
  const hard = calls
    .filter((call) => OPTIONAL.has(packageOf(call.specifier)) && !call.optional)
    .map((call) => `${call.at}  ${call.specifier}`);

  assert.deepEqual(
    hard,
    [],
    'These calls are not directly inside a `try` block, so Metro bundles them as hard ' +
      'dependencies and an app without the package fails to build. Move the call so its ' +
      'statement sits directly in the `try`.',
  );
});

test('no optional peer is imported statically', () => {
  const statics = imports
    .filter((entry) => OPTIONAL.has(packageOf(entry.specifier)))
    .map((entry) => `${entry.at}  ${entry.specifier}`);

  assert.deepEqual(statics, [], 'A static import of an optional peer is always a hard dependency.');
});
