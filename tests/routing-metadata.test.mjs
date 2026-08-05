import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function yamlScalar(document, key) {
  const match = document.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  assert.ok(match, `${key} must be a single-line YAML scalar`);
  return match[1].trim();
}

test("discovery metadata enforces state-first semantic continuation", () => {
  const manifest = JSON.parse(read(".codex-plugin/plugin.json"));
  const creatorContract = JSON.parse(read("creator-contract.json"));
  const skill = read("skills/coding-agents/SKILL.md");
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(frontmatter, "SKILL.md must have YAML frontmatter");
  const frontmatterLines = frontmatter[1].split("\n");
  const descriptionStart = frontmatterLines.indexOf("description: >-");
  assert.notEqual(descriptionStart, -1, "SKILL.md must use a folded description");
  const frontmatterDescription = frontmatterLines
    .slice(descriptionStart + 1)
    .filter((line) => line.startsWith("  "))
    .map((line) => line.trim())
    .join(" ");

  assert.match(manifest.description, /Coding Agents state-first continuation, new-task intake/i);
  assert.match(manifest.description, /model-neutral official-subagent job contracts/i);
  assert.match(manifest.description, /Primary route:/);
  assert.match(manifest.description, /Fallback:/);
  assert.match(manifest.description, /Root Sol selects the actual worker model and reasoning effort at official spawn time/i);
  assert.match(manifest.description, /never launches workers or infers a worker profile/i);
  assert.deepEqual(manifest.keywords, [
    "coding-agents",
    ".coding-agents",
    "coding-agents-cli",
    "coding-agents-continuation",
    "coding-agents-same-repo",
    "coding-agents-next-stage",
    "coding-agents-new-task-intake",
    "coding-agents-job-contracts",
    "model-neutral-worker-routing",
    "sol-parent-dynamic-worker-routing",
    "coding-agents-audit",
    "coding-agents-repair",
    "legacy-coding-agents",
  ]);
  assert.deepEqual(manifest.interface.capabilities, [
    "Coding Agents State",
    "Coding Agents CLI",
    "Coding Agents Continuation",
    "Semantic State Triage",
    "Model-neutral Subagent Job Contracts",
    "Coding Agents Audit/Repair",
  ]);
  assert.match(manifest.interface.shortDescription, /State-first tasks and model-neutral worker contracts/i);
  assert.match(manifest.interface.longDescription, /Inspect task, active checklist, audit, runner, and handoff state/i);
  assert.match(manifest.interface.longDescription, /related work preserves completed progress/i);
  assert.match(manifest.interface.longDescription, /only clearly unrelated work gets fresh active state/i);
  assert.match(manifest.interface.longDescription, /official spawn surface/i);
  assert.match(manifest.interface.longDescription, /required capabilities plus ambiguity, consequence, coupling, and acceptance characteristics/i);
  assert.match(manifest.interface.longDescription, /Root Sol selects the actual model and reasoning effort/i);
  assert.match(manifest.interface.longDescription, /never launches workers or creates automatic review or repair loops/i);
  assert.ok(
    manifest.interface.defaultPrompt.every((prompt) =>
      /Coding Agents|\.coding-agents/.test(prompt),
    ),
    "every manifest prompt must name the explicit legacy workflow",
  );
  assert.ok(
    manifest.interface.defaultPrompt.every((prompt) => prompt.length <= 128),
    "manifest starter prompts must stay within the plugin UI limit",
  );

  assert.ok(frontmatterDescription.length <= 320, "skill description must stay routing-budget concise");
  assert.match(frontmatterDescription.slice(0, 180), /state-first continuation and new-task intake.*\.coding-agents/i);
  assert.match(frontmatterDescription, /^Coding Agents state-first continuation and new-task intake\./);
  assert.match(frontmatterDescription, /Resume related work/i);
  assert.match(frontmatterDescription, /restart only clearly unrelated work/i);
  assert.match(frontmatterDescription, /model-neutral official-subagent job contracts/i);

  const triggerBoundary = skill.match(/## Trigger Boundary\n\n([\s\S]*?)\n## Core Contract/);
  assert.ok(triggerBoundary, "SKILL.md must define Trigger Boundary before Core Contract");
  assert.match(triggerBoundary[1], /explicitly names `Coding Agents` or `coding-agents`/i);
  assert.match(triggerBoundary[1], /strong continuation intent for a repository with valid `\.coding-agents` state/i);
  assert.match(triggerBoundary[1], /Mere state-directory presence is not a trigger/i);
  assert.match(triggerBoundary[1], /Before deciding to run fresh intake, inspect current `task\.md`/i);
  assert.match(triggerBoundary[1], /preserve the current task lineage and completed checklist entries/i);
  assert.match(triggerBoundary[1], /Only when the request is clearly unrelated/i);
  assert.match(triggerBoundary[1], /Do not ask the user to choose a routine new-versus-continuation mode/i);
  assert.match(triggerBoundary[1], /Never reject a repository because an earlier task is completed/i);
  assert.match(triggerBoundary[1], /record workflow packets and never launch a worker process/i);
  assert.doesNotMatch(triggerBoundary[1], /subagent development team coordination/i);
  const jobRouting = skill.match(/### Model-Neutral Official-Subagent Job Routing\n\n([\s\S]*?)\n- Every subagent assignment/);
  assert.ok(jobRouting, "SKILL.md must define model-neutral job routing before assignment hierarchy");
  assert.match(jobRouting[1], /job_routing_contract_version: model_neutral_job_v1/);
  assert.match(jobRouting[1], /required_capabilities/);
  assert.match(jobRouting[1], /ambiguity.*consequence.*coupling.*acceptance_characteristics/is);
  assert.match(jobRouting[1], /Root Sol exclusively chooses the actual model and reasoning effort/i);
  assert.match(jobRouting[1], /reassign only the affected scope at a higher sufficient profile or take ownership/i);
  assert.match(jobRouting[1], /does not trigger a stronger-profile review or an automatic repair loop/i);
  assert.doesNotMatch(jobRouting[1], /GPT-|ULTRA|strongest reasoning and execution capacity/i);
  assert.match(creatorContract.routing.primary_route, /Inspect active state and completion flags first/i);
  assert.match(creatorContract.routing.primary_route, /fresh task_id\/epoch\/scope only for clearly unrelated work/i);
  assert.match(creatorContract.routing.primary_route, /model_neutral_job_v1 requirements/i);
  assert.match(creatorContract.routing.primary_route, /Root Sol exclusively selects the actual worker model and reasoning effort at official spawn time/i);
  assert.match(creatorContract.routing.primary_route, /does not.*infer.*worker profile|never.*infers.*worker profile/i);
  assert.deepEqual(
    creatorContract.production_contract.rules.map((rule) => rule.id),
    [
      "official-spawn-only",
      "model-neutral-worker-routing",
      "workflow-state-preserved",
      "capability-improvement-evidence-link",
      "semantic-state-triage",
      "active-checklist-finalization-consistency",
      "delivery-mode-authority-and-propagation",
    ],
  );
  const routingRule = creatorContract.production_contract.rules.find(
    (rule) => rule.id === "model-neutral-worker-routing",
  );
  assert.ok(routingRule, "creator contract must own model-neutral worker routing");
  assert.match(routingRule.description, /model_neutral_job_v1/);
  assert.match(routingRule.description, /Root Sol alone selects model\/reasoning at official spawn/i);
  assert.match(routingRule.description, /without automatic success review or repair loops/i);
  assert.deepEqual(
    creatorContract.routing.openai_yaml.manifests[0].document.interface,
    {
      display_name: "Coding Agents",
      short_description: "State-first tasks and model-neutral worker contracts",
      default_prompt: "Use $coding-agents to inspect state first, preserve related progress, and record model-neutral jobs for root Sol to route at spawn time.",
    },
  );
});

test("skill metadata permits natural-language continuation routing", () => {
  const skillMetadata = read("skills/coding-agents/agents/openai.yaml");

  assert.match(skillMetadata, /^interface:\n/m);
  assert.match(skillMetadata, /^  short_description: ['"]?State-first tasks and model-neutral worker contracts['"]?$/m);
  assert.match(skillMetadata, /^  default_prompt: ['"]?Use \$coding-agents to inspect state first/m);
  assert.match(skillMetadata, /record model-neutral jobs for root Sol to route at spawn time/i);
  assert.match(skillMetadata, /^  allow_implicit_invocation: true$/m);
  assert.doesNotMatch(skillMetadata, /^  allow_implicit_invocation: false$/m);
});

test("source CLI has no Codex process-runner route", () => {
  const cli = read("bin/coding-agents.mjs");

  assert.doesNotMatch(cli, /(?:spawnSync|execFileSync)\s*\(\s*["']codex["']/);
  assert.doesNotMatch(cli, /\brunCodexCli\b|\brenderRunnerPrompt\b|--output-last-message/);
  assert.match(cli, /--runner and --timeout-ms are unsupported/);
  assert.match(cli, /this CLI never launches Codex workers; use the official Codex subagent spawn tools/);
  assert.match(cli, /record-only; dispatch subagents through the official Codex spawn tools outside this CLI/);
  assert.match(cli, /Fresh-state action used after state-first semantic triage/i);
  assert.match(cli, /preserves runner\.md history/);
  assert.match(cli, /complete every active task TODO item/i);
  assert.match(cli, /task-finalization\/TODO agreement/i);
});
