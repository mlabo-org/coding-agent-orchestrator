import assert from "node:assert/strict";
import test from "node:test";
import {
  PLUGIN_NAME,
  REQUIRED_HOOK_EVENTS,
  REQUIRED_PLUGIN_FILES,
  canonicalSourceRoot,
  createInstallPlan,
  planMarketplace,
  validatePluginBundle
} from "../scripts/lib/plugin-installer.mjs";

const manifest = { name: PLUGIN_NAME, version: "0.3.0" };
const hookRegistration = { hooks: [{ type: "command", command: 'node "${PLUGIN_ROOT}/scripts/cao-state-hook.mjs"' }] };
const hooksDocument = { hooks: Object.fromEntries(REQUIRED_HOOK_EVENTS.map((event) => [event, [hookRegistration]])) };

test("complete bundle exposes all public Hook files and events", () => {
  assert.deepEqual(validatePluginBundle({ manifest, hooksDocument, presentFiles: REQUIRED_PLUGIN_FILES }), []);
  const incomplete = validatePluginBundle({ manifest, hooksDocument: { hooks: {} }, presentFiles: REQUIRED_PLUGIN_FILES.filter((file) => file !== "hooks/hooks.json") });
  assert.deepEqual(incomplete.map((entry) => entry.code), ["PLUGIN_BUNDLE_INCOMPLETE", "HOOK_BUNDLE_INCOMPLETE"]);
});

test("install plan registers the complete canonical source through the personal marketplace", () => {
  const homeDir = "/home/reader";
  const plan = createInstallPlan({ repoRoot: canonicalSourceRoot(homeDir), homeDir, manifest, hooksDocument, presentFiles: REQUIRED_PLUGIN_FILES, marketplaceDocument: null, configuredMarketplaces: { marketplaces: [] }, nodeVersion: "22.0.0" });
  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.bundledFiles, REQUIRED_PLUGIN_FILES);
  assert.deepEqual(plan.bundledHooks, REQUIRED_HOOK_EVENTS);
  assert.equal(plan.installSelector, `${PLUGIN_NAME}@personal`);
  assert.equal(plan.marketplaceDocument.plugins[0].source.path, `./plugins/${PLUGIN_NAME}`);
});

test("existing entries are preserved and conflicting plugin sources fail closed", () => {
  const existing = { name: "personal", plugins: [{ name: "other", source: { source: "local", path: "./plugins/other" } }] };
  const added = planMarketplace({ marketplaceDocument: existing, configuredMarketplaces: { marketplaces: [{ name: "personal", root: "/home/reader" }] }, homeDir: "/home/reader" });
  assert.equal(added.document.plugins[0].name, "other");
  assert.equal(added.document.plugins[1].name, PLUGIN_NAME);
  assert.throws(() => planMarketplace({ marketplaceDocument: { name: "personal", plugins: [{ name: PLUGIN_NAME, source: { source: "local", path: "./wrong" } }] }, configuredMarketplaces: { marketplaces: [{ name: "personal", root: "/home/reader" }] }, homeDir: "/home/reader" }), /different marketplace source/);
});

test("noncanonical checkout and unsupported Node are blockers", () => {
  const plan = createInstallPlan({ repoRoot: "/tmp/cao", homeDir: "/home/reader", manifest, hooksDocument, presentFiles: REQUIRED_PLUGIN_FILES, marketplaceDocument: null, configuredMarketplaces: { marketplaces: [] }, nodeVersion: "20.0.0" });
  assert.deepEqual(plan.blockers.map((entry) => entry.code), ["SOURCE_PATH_MISMATCH", "NODE_VERSION_UNSUPPORTED"]);
});
