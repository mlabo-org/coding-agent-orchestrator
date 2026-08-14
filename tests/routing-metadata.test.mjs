import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("plugin metadata exposes explicit CAO activation and required state control", () => {
  const manifest = JSON.parse(read(".codex-plugin/plugin.json"));
  const creator = JSON.parse(read("creator-contract.json"));
  const skill = read("skills/coding-agent-orchestrator/SKILL.md");
  const metadata = read("skills/coding-agent-orchestrator/agents/openai.yaml");

  assert.equal(manifest.name, "coding-agent-orchestrator");
  assert.match(manifest.description, /Explicit-only Coding Agent Orchestrator.*deterministic \.CAO state control/i);
  assert.ok(manifest.keywords.includes(".CAO"));
  assert.ok(manifest.interface.capabilities.includes("Deterministic .CAO State Control"));
  assert.match(manifest.interface.longDescription, /There is no fixed role roster/i);
  assert.match(manifest.interface.longDescription, /record-only state CLI never launches workers/i);
  assert.ok(manifest.interface.defaultPrompt.every((prompt) => /CAO|Coding Agent Orchestrator|\$coding-agent-orchestrator/.test(prompt)));

  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(frontmatter, "SKILL.md must have YAML frontmatter");
  const description = frontmatter[1]
    .split("\n")
    .filter((line) => line.startsWith("  "))
    .map((line) => line.trim())
    .join(" ");
  assert.ok(description.length <= 400, "skill description must remain routing-budget concise");
  assert.match(description.slice(0, 220), /Coding Agent Orchestrator.*official Codex subagents.*\.CAO state control/i);
  assert.match(skill, /For every activated coding workflow, `\.CAO\/` is the workflow state SSOT/);
  assert.match(skill, /There is no fixed roster and no role-name allowlist/);
  assert.match(skill, /Before `spawn_agent`, record the exact dynamic role/);
  assert.match(skill, /The CLI may create and validate `\.CAO\/`/);
  assert.match(skill, /It must never launch Codex/);
  assert.match(skill, /Use only `spawn_agent`.*`list_agents`/s);

  assert.match(creator.routing.primary_route, /resolve or initialize.*\.CAO state/i);
  assert.match(creator.workflow_contract.role_rule, /unrestricted dynamic responsibility names/i);
  assert.match(creator.workflow_contract.execution_rule, /never launches workers/i);
  assert.equal(creator.runtime_boundaries.generated_or_runtime_paths[0], ".CAO/");

  assert.match(metadata, /^  short_description: "Official subagents with deterministic \.CAO state"$/m);
  assert.match(metadata, /^  default_prompt: "Use \$coding-agent-orchestrator.*\.CAO state/m);
  assert.match(metadata, /^  allow_implicit_invocation: true$/m);
});

test("capability schemas require finalized workflow state", () => {
  const input = JSON.parse(read("schemas/v1/leaves/coding-agent-orchestrator-input.schema.json"));
  const output = JSON.parse(read("schemas/v1/leaves/coding-agent-orchestrator-output.schema.json"));
  const capability = JSON.parse(read("local-capability-manifest.json"));

  assert.ok(input.required.includes("stateTransition"));
  assert.deepEqual(input.properties.stateTransition.enum, [
    "continue-related",
    "initialize-unrelated",
  ]);
  assert.ok(output.required.includes("workflowState"));
  assert.equal(output.properties.workflowState.properties.finalized.const, true);
  assert.equal(output.properties.workflowState.properties.integrity.const, "passed");
  assert.deepEqual(capability.capabilities[0].artifactRoots, [".CAO/"]);
  assert.match(capability.capabilities[0].runtimeBinding.instruction, /record-only state CLI/);
  assert.match(capability.capabilities[0].runtimeBinding.instruction, /official GUI Codex collaboration tools for actual worker lifecycle/);
});

test("source CLI has deterministic state control without a worker runner or fixed roles", () => {
  const cli = read("bin/coding-agents.mjs");

  assert.doesNotMatch(cli, /(?:spawnSync|execFileSync)\s*\(\s*["']codex["']/);
  assert.doesNotMatch(cli, /\bconst ROLES\b|unknown role:|14 role|14-role|fixed role/i);
  assert.match(cli, /# Dynamic Role Assignments/);
  assert.match(cli, /There is no fixed roster and no allowlist of role names/);
  assert.match(cli, /--role must be a 1-80 character single-line responsibility name/);
  assert.match(cli, /--runner and --timeout-ms are unsupported/);
  assert.match(cli, /record-only; dispatch subagents through the official Codex spawn tools outside this CLI/);
  assert.match(cli, /preserves runner\.md history/);
  assert.match(cli, /task-finalization\/TODO agreement/i);
});
