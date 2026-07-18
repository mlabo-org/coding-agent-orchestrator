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

  assert.match(manifest.description, /Coding Agents state-first continuation and new-task intake/i);
  assert.match(manifest.description, /Primary route:/);
  assert.match(manifest.description, /Fallback:/);
  assert.match(
    manifest.description,
    /Do not ask the user for a routine new-versus-continue mode/i,
  );
  assert.deepEqual(manifest.keywords, [
    "coding-agents",
    ".coding-agents",
    "coding-agents-cli",
    "coding-agents-continuation",
    "coding-agents-same-repo",
    "coding-agents-next-stage",
    "coding-agents-new-task-intake",
    "coding-agents-audit",
    "coding-agents-repair",
    "legacy-coding-agents",
  ]);
  assert.deepEqual(manifest.interface.capabilities, [
    "Coding Agents State",
    "Coding Agents CLI",
    "Coding Agents Continuation",
    "Semantic State Triage",
    "Coding Agents Audit/Repair",
  ]);
  assert.match(manifest.interface.shortDescription, /State-first continuation and new-task intake/i);
  assert.match(manifest.interface.longDescription, /Inspect task, active checklist, audit, runner, and handoff state/i);
  assert.match(manifest.interface.longDescription, /related work preserves completed progress and appends/i);
  assert.match(manifest.interface.longDescription, /only clearly unrelated work gets a fresh task identity/i);
  assert.match(manifest.interface.longDescription, /not asked for a routine new-versus-continue mode/i);
  assert.match(manifest.interface.longDescription, /only through official Codex subagent spawn tools/i);
  assert.match(manifest.interface.longDescription, /never launches codex exec/i);
  assert.ok(
    manifest.interface.defaultPrompt.every((prompt) =>
      /Coding Agents|\.coding-agents/.test(prompt),
    ),
    "every manifest prompt must name the explicit legacy workflow",
  );

  assert.ok(frontmatterDescription.length <= 320, "skill description must stay routing-budget concise");
  assert.match(frontmatterDescription.slice(0, 180), /state-first continuation and new-task intake.*\.coding-agents/i);
  assert.match(frontmatterDescription, /^Coding Agents state-first continuation and new-task intake\./);
  assert.match(frontmatterDescription, /semantically resume related work/i);
  assert.match(frontmatterDescription, /regenerate only clearly unrelated work/i);

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
  assert.match(creatorContract.routing.primary_route, /Inspect active state and completion flags first/i);
  assert.match(creatorContract.routing.primary_route, /fresh task_id\/epoch\/scope only for clearly unrelated work/i);
  assert.deepEqual(
    creatorContract.production_contract.rules.map((rule) => rule.id),
    [
      "official-spawn-only",
      "workflow-state-preserved",
      "capability-improvement-evidence-link",
      "semantic-state-triage",
      "active-checklist-finalization-consistency",
    ],
  );
});

test("skill metadata permits natural-language continuation routing", () => {
  const skillMetadata = read("skills/coding-agents/agents/openai.yaml");

  assert.match(skillMetadata, /^interface:\n/m);
  assert.match(skillMetadata, /^  short_description: ['"]?State-first Coding Agents continuation['"]?$/m);
  assert.match(skillMetadata, /^  default_prompt: ['"]?Use \$coding-agents to inspect this valid \.coding-agents state/m);
  assert.match(skillMetadata, /fresh intake only for clearly unrelated work without asking me for a mode/i);
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
