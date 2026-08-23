const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.join(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8")
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")
);

test("manifest uses the expected MV3 version and least-privilege permissions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, packageJson.version);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
});

test("all files referenced by the manifest exist", () => {
  const referencedFiles = [
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon)
  ];

  for (const relativePath of referencedFiles) {
    assert.equal(
      fs.existsSync(path.join(projectRoot, relativePath)),
      true,
      `Missing manifest resource: ${relativePath}`
    );
  }
});

test("popup references existing local scripts and styles", () => {
  const popupHtml = fs.readFileSync(
    path.join(projectRoot, manifest.action.default_popup),
    "utf8"
  );
  const resourcePattern = /(?:src|href)="([^"]+)"/g;
  const resources = Array.from(popupHtml.matchAll(resourcePattern), (match) => match[1]);

  for (const relativePath of resources) {
    assert.equal(
      fs.existsSync(path.join(projectRoot, relativePath)),
      true,
      `Missing popup resource: ${relativePath}`
    );
  }
});
