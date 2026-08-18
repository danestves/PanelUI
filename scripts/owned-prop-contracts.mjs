#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST = 'scripts/owned-props.json';

function variableDeclaration(sourceFile, name) {
  let match;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      match = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return match;
}

export function validateOwnedPropContracts({ root = ROOT, contracts } = {}) {
  const inventory = contracts ?? JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf8'));
  const errors = [];
  for (const contract of inventory) {
    const absolute = path.join(root, contract.file);
    if (!fs.existsSync(absolute)) {
      errors.push(`${contract.owner}: missing source ${contract.file}`);
      continue;
    }
    const source = fs.readFileSync(absolute, 'utf8');
    const sourceFile = ts.createSourceFile(
      contract.file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const declaration = variableDeclaration(sourceFile, contract.owner);
    if (!declaration?.initializer) {
      errors.push(`${contract.owner}: variable declaration not found`);
      continue;
    }
    const matches = [];
    const visit = (node) => {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(sourceFile) === contract.element
      ) {
        const attributes = node.attributes.properties;
        let spreadAt = -1;
        attributes.forEach((attribute, index) => {
          if (
            ts.isJsxSpreadAttribute(attribute) &&
            /\bprops\b/.test(attribute.expression.getText(sourceFile))
          ) {
            spreadAt = index;
          }
        });
        if (spreadAt >= 0) matches.push({ attributes, spreadAt });
      }
      ts.forEachChild(node, visit);
    };
    visit(declaration.initializer);
    if (matches.length !== 1) {
      errors.push(`${contract.owner}: expected one ${contract.element} forwarding props; found ${matches.length}`);
      continue;
    }
    const { attributes, spreadAt } = matches[0];
    for (const owned of contract.props) {
      const ownedAt = attributes.findIndex(
        (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === owned,
      );
      if (ownedAt < 0) errors.push(`${contract.owner}: missing owned ${owned}`);
      else if (ownedAt < spreadAt) errors.push(`${contract.owner}: consumer props can replace ${owned}`);
    }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateOwnedPropContracts();
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Owned prop contracts are protected after consumer spreads.');
  }
}
