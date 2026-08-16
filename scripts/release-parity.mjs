#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const RELEASE_PACKAGES = Object.freeze([
  {
    directory: 'packages/panelui',
    name: 'panelui-native',
    tagPrefix: 'v',
    changelog: true,
  },
  {
    directory: 'packages/cli',
    name: 'panelui-cli',
    tagPrefix: 'cli-v',
  },
  {
    directory: 'packages/create-panelui-app',
    name: 'create-panelui-app',
    tagPrefix: 'create-v',
  },
]);

export function releaseTarget(tag) {
  const target = RELEASE_PACKAGES.find(({ tagPrefix }) => tag.startsWith(tagPrefix));
  if (!target) return null;
  const version = tag.slice(target.tagPrefix.length);
  return VERSION.test(version) ? { ...target, version } : null;
}

function sameRecord(left, right) {
  const normalize = (record) =>
    Object.fromEntries(Object.entries(record ?? {}).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

export function validateReleaseParity(read) {
  const errors = [];
  const json = (file) => JSON.parse(read(file));
  const lock = json('package-lock.json');
  const hub = read('apps/docs/content/docs/upgrading.mdx');
  const changelog = read('CHANGELOG.md');
  const ciWorkflow = read('.github/workflows/ci.yml');
  const libraryWorkflow = read('.github/workflows/publish.yml');
  const cliWorkflow = read('.github/workflows/publish-cli.yml');
  const docsWorkflow = read('.github/workflows/deploy-docs.yml');
  const dependencyFields = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];

  for (const target of RELEASE_PACKAGES) {
    const source = `${target.directory}/package.json`;
    const manifest = json(source);
    const locked = lock.packages?.[target.directory];
    if (manifest.name !== target.name) {
      errors.push(`${source}: expected package name ${target.name}, received ${manifest.name}`);
    }
    if (!VERSION.test(manifest.version)) {
      errors.push(`${source}: invalid release version ${manifest.version}`);
    }
    if (!locked) {
      errors.push(`package-lock.json: missing workspace ${target.directory}`);
    } else {
      if (locked.version !== manifest.version) {
        errors.push(
          `package-lock.json: ${target.directory} is ${locked.version}, manifest is ${manifest.version}`,
        );
      }
      for (const field of dependencyFields) {
        if (!sameRecord(locked[field], manifest[field])) {
          errors.push(`package-lock.json: ${target.directory} ${field} drifted from its manifest`);
        }
      }
    }

    const escapedName = target.name.replaceAll('-', '\\-');
    const escapedVersion = manifest.version.replaceAll('.', '\\.');
    const row = new RegExp(
      `^\\| \`${escapedName}\`\\s+\\| \`${escapedVersion}\`\\s+\\|`,
      'gm',
    );
    if ((hub.match(row) ?? []).length !== 1) {
      errors.push(`upgrading.mdx: expected one ${target.name} ${manifest.version} row`);
    }
    const npmUrl = `https://www.npmjs.com/package/${target.name}/v/${manifest.version}`;
    if (!hub.includes(npmUrl)) errors.push(`upgrading.mdx: missing ${npmUrl}`);
    const sourceUrl = `https://github.com/panel-ui/PanelUI/blob/main/${source}`;
    if (!hub.includes(sourceUrl)) errors.push(`upgrading.mdx: missing ${sourceUrl}`);

    if (target.changelog) {
      const current = changelog.match(/^## \[([^\]]+)\]/m)?.[1];
      if (current !== manifest.version) {
        errors.push(`CHANGELOG.md: current release is ${current}, manifest is ${manifest.version}`);
      }
    }
  }

  const workflowContracts = [
    [ciWorkflow, 'run: npm run release:check', 'release parity CI gate'],
    [libraryWorkflow, "startsWith(github.ref_name, 'v')", 'library tag filter'],
    [libraryWorkflow, '${GITHUB_REF_NAME#v}', 'library tag parser'],
    [docsWorkflow, "startsWith(github.ref_name, 'v')", 'docs release tag filter'],
    [
      cliWorkflow,
      'cli-v*)    dir=packages/cli;                name=panelui-cli;        version="${tag#cli-v}" ;;',
      'CLI tag parser',
    ],
    [
      cliWorkflow,
      'create-v*) dir=packages/create-panelui-app; name=create-panelui-app; version="${tag#create-v}" ;;',
      'create-app tag parser',
    ],
  ];
  for (const [workflow, contract, label] of workflowContracts) {
    if (!workflow.includes(contract)) errors.push(`workflow: missing ${label} (${contract})`);
  }

  return errors;
}

export function checkReleaseParity(root = ROOT) {
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const errors = validateReleaseParity(read);
  if (errors.length) throw new Error(`Release parity failed:\n${errors.join('\n')}`);
  const versions = RELEASE_PACKAGES.map(({ directory, name, tagPrefix }) => {
    const version = JSON.parse(read(`${directory}/package.json`)).version;
    return `${tagPrefix}${version} (${name})`;
  });
  console.log(`Verified release parity: ${versions.join(', ')}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkReleaseParity();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
