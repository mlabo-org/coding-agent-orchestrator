import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("public metadata exposes explicit state control without owning native execution topology", () => {
  const manifest = JSON.parse(read(".codex-plugin/plugin.json"));
  const creator = JSON.parse(read("creator-contract.json"));
  const capability = JSON.parse(read("local-capability-manifest.json"));
  const skill = read("skills/coding-agent-orchestrator/SKILL.md");
  const metadata = read("skills/coding-agent-orchestrator/agents/openai.yaml");

  assert.equal(manifest.name, "coding-agent-orchestrator");
  assert.match(manifest.description, /explicit-only.*state control/i);
  assert.ok(manifest.interface.capabilities.includes("Exact Root-Thread State Binding"));
  assert.ok(manifest.interface.capabilities.includes("Official Hook Event Capture"));
  assert.ok(manifest.interface.capabilities.includes("App-Server Runtime Reconciliation"));
  assert.ok(manifest.interface.capabilities.includes("Declared Verification Coverage"));
  assert.ok(manifest.interface.capabilities.includes("Completed Task Handoff"));
  assert.match(manifest.interface.longDescription, /Native Codex owns.*recursive delegation.*peer messaging/is);
  assert.match(manifest.interface.longDescription, /runtime completion.*semantic completion/i);

  assert.match(skill, /CAO is a state-control plane, not a subagent launcher/i);
  assert.match(skill, /SubagentStart.*SubagentStop.*app-server/is);
  assert.match(skill, /exact bound root thread tree/i);
  assert.match(skill, /must not infer semantic completion/i);
  assert.match(metadata, /Durable CAO state control/);

  assert.equal(creator.workflow_contract.execution_owner, "native-codex");
  assert.equal(creator.workflow_contract.state_owner, "coding-agent-orchestrator");
  assert.match(creator.workflow_contract.runtime_observation_rule, /Hooks.*app-server/i);
  assert.equal(capability.capabilities[0].executionClass, "state_controller");
  assert.match(capability.capabilities[0].runtimeBinding.instruction, /exact root thread/i);
});

test("plugin hooks cover root rehydration, descendant lifecycle, and known-work stop control", () => {
  const hooks = JSON.parse(read("hooks/hooks.json"));
  assert.deepEqual(Object.keys(hooks.hooks).sort(), ["SessionStart", "Stop", "SubagentStart", "SubagentStop"].sort());
  for (const event of Object.keys(hooks.hooks)) {
    const handler = hooks.hooks[event][0].hooks[0];
    assert.equal(handler.type, "command");
    assert.match(handler.command, /\$\{PLUGIN_ROOT\}\/scripts\/cao-state-hook\.mjs/);
    assert.ok(handler.statusMessage.length > 0);
  }
  assert.doesNotThrow(() => JSON.parse(read("hooks/hooks.json")));
  assert.match(read("scripts/cao-state-hook.mjs"), /bin\/coding-agents\.mjs/);
});

test("capability schemas expose root binding and separate runtime observations from semantic state", () => {
  const input = JSON.parse(read("schemas/v1/leaves/coding-agent-orchestrator-input.schema.json"));
  const output = JSON.parse(read("schemas/v1/leaves/coding-agent-orchestrator-output.schema.json"));
  assert.ok(input.required.includes("rootThreadId"));
  assert.match(input.properties.rootThreadId.description, /exact.*root.*thread/i);
  assert.ok(output.properties.workflowState.required.includes("rootThreadId"));
  assert.ok(output.properties.workflowState.required.includes("runtimeObservationIntegrity"));
  assert.ok(output.properties.workflowState.required.includes("handoffStatus"));
  assert.equal(output.properties.workflowState.properties.handoffStatus.const, "completed");
  assert.match(output.properties.workflowState.properties.runtimeObservationIntegrity.description, /does not prove semantic completion/i);
});

test("active source no longer exposes CAO-owned worker routing or lifecycle control", () => {
  const activePaths = [
    "README.md",
    "skills/coding-agent-orchestrator/SKILL.md",
    "skills/coding-agent-orchestrator/agents/openai.yaml",
    ".codex-plugin/plugin.json",
    "creator-contract.json",
    "local-capability-manifest.json",
    "schemas/v1/leaves/coding-agent-orchestrator-input.schema.json",
    "schemas/v1/leaves/coding-agent-orchestrator-output.schema.json",
    "docs/specs/coding-agent-orchestrator-gui-subagent-spec.md",
    "docs/specs/coding-agent-orchestrator-state-control-spec.md",
  ];
  const source = activePaths.map(read).join("\n");
  const retired = [
    ["Root", "Sol"].join(" "),
    ["hierarchy", "mode"].join("_"),
    ["heartbeat", "interval"].join("_"),
    ["lifecycle", "disposition"].join("_"),
    ["parallel", "wave"].join(" "),
    ["critical", "path"].join(" "),
    ["dynamic", "role", "assignment"].join(" "),
  ];
  for (const phrase of retired) {
    const pattern = new RegExp(phrase, "i");
    assert.doesNotMatch(source, pattern);
  }
});
