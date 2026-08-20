import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(docs, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const hub = read("apps/docs/content/docs/upgrading.mdx");
const changelog = read("CHANGELOG.md");

function migrationVersions() {
  const headings = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\][^\n]*$/gm)];
  const releases = headings.map((heading, index) => [
    heading[1],
    changelog.slice(
      heading.index,
      headings[index + 1]?.index ?? changelog.length,
    ),
  ]);
  return releases
    .filter(
      ([, body]) =>
        /^### Migration$/m.test(body) || /\*\*Breaking(?::|\b)/.test(body),
    )
    .map(([version]) => version);
}

test("the upgrade hub is present exactly once in primary docs navigation", () => {
  const meta = JSON.parse(read("apps/docs/content/docs/meta.json"));
  assert.equal(meta.pages.filter((page) => page === "upgrading").length, 1);
  assert.equal(
    fs.existsSync(path.join(docs, "content/docs/upgrading.mdx")),
    true,
  );
});

test("every changelog migration has one versioned hub entry with real links", () => {
  const versions = migrationVersions();
  // Newest first, matching the changelog. Every release listed here owes the
  // hub an oldest-first entry, an anchor and both links; the loop below checks
  // each one. Add a release when its changelog entry gains a Migration section.
  assert.deepEqual(versions, ["0.79.0", "0.78.0", "0.60.0", "0.59.0", "0.46.0", "0.44.0"]);
  const linkedAnchors = [
    ...hub.matchAll(/CHANGELOG\.md#(migration-[\d-]+)/g),
  ].map((match) => match[1]);
  const linkedReleases = [
    ...hub.matchAll(/releases\/tag\/v(\d+\.\d+\.\d+)/g),
  ].map((match) => match[1]);
  assert.deepEqual(
    linkedAnchors,
    [...versions]
      .reverse()
      .map((version) => `migration-${version.replaceAll(".", "-")}`),
  );
  assert.deepEqual(linkedReleases, [...versions].reverse());

  for (const version of versions) {
    const anchor = `migration-${version.replaceAll(".", "-")}`;
    assert.equal(
      (hub.match(new RegExp(`^### v${version}\\b`, "gm")) ?? []).length,
      1,
    );
    assert.ok(
      changelog.includes(`<a id="${anchor}"></a>`),
      `${anchor} must exist`,
    );
    assert.ok(
      hub.includes(
        `https://github.com/panel-ui/PanelUI/blob/main/CHANGELOG.md#${anchor}`,
      ),
      `${version} source notes`,
    );
    assert.ok(
      hub.includes(
        `https://github.com/panel-ui/PanelUI/releases/tag/v${version}`,
      ),
      `${version} release`,
    );
  }
});

test("current package versions and source links match real manifests", () => {
  const packages = [
    ["packages/panelui/package.json", "panelui-native"],
    ["packages/cli/package.json", "panelui-cli"],
    ["packages/create-panelui-app/package.json", "create-panelui-app"],
  ];

  for (const [source, expectedName] of packages) {
    const manifest = JSON.parse(read(source));
    assert.equal(manifest.name, expectedName);
    assert.match(
      hub,
      new RegExp(
        "\\| `" + manifest.name + "`\\s+\\| `" + manifest.version + "`\\s+\\|",
      ),
    );
    assert.ok(
      hub.includes(
        `https://www.npmjs.com/package/${manifest.name}/v/${manifest.version}`,
      ),
    );
    assert.ok(
      hub.includes(`https://github.com/panel-ui/PanelUI/blob/main/${source}`),
    );
  }
});
