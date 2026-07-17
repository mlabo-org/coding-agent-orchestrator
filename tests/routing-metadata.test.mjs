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

test("discovery metadata supports intent-bound same-repo continuation", () => {
  const manifest = JSON.parse(read(".codex-plugin/plugin.json"));
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

  assert.match(manifest.description, /Coding Agents same-repo continuation and new-task intake/i);
  assert.match(manifest.description, /Primary route:/);
  assert.match(manifest.description, /Fallback:/);
  assert.match(
    manifest.description,
    /Do not auto-route unrelated generic coding/i,
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
    "Same-Repo New Task Intake",
    "Coding Agents Audit/Repair",
  ]);
  assert.match(manifest.interface.shortDescription, /Same-repo continuation and new-task intake/i);
  assert.match(manifest.interface.longDescription, /Existing completed state never locks the repository/i);
  assert.match(manifest.interface.longDescription, /fresh task_id\/epoch\/scope/i);
  assert.match(manifest.interface.longDescription, /Mere state presence and unrelated generic coding do not trigger it/i);
  assert.match(manifest.interface.longDescription, /only through official Codex subagent spawn tools/i);
  assert.match(manifest.interface.longDescription, /never launches codex exec/i);
  assert.ok(
    manifest.interface.defaultPrompt.every((prompt) =>
      /Coding Agents|\.coding-agents/.test(prompt),
    ),
    "every manifest prompt must name the explicit legacy workflow",
  );

  assert.ok(frontmatterDescription.length <= 320, "skill description must stay routing-budget concise");
  assert.match(frontmatterDescription.slice(0, 180), /same-repo continuation and new-task intake.*\.coding-agents/i);
  assert.match(frontmatterDescription, /^Coding Agents same-repo continuation and new-task intake\./);
  assert.match(frontmatterDescription, /Start fresh task_id\/epoch\/scope for new work/i);
  assert.match(frontmatterDescription, /completed state never locks the repo/i);

  const triggerBoundary = skill.match(/## Trigger Boundary\n\n([\s\S]*?)\n## Core Contract/);
  assert.ok(triggerBoundary, "SKILL.md must define Trigger Boundary before Core Contract");
  assert.match(triggerBoundary[1], /explicitly names `Coding Agents` or `coding-agents`/i);
  assert.match(triggerBoundary[1], /strong continuation intent for a repository with valid `\.coding-agents` state/i);
  assert.match(triggerBoundary[1], /Mere state-directory presence is not a trigger/i);
  assert.match(triggerBoundary[1], /fresh `task_id`, `epoch`, and `scope`/i);
  assert.match(triggerBoundary[1], /Never reject a repository because an earlier task is completed/i);
  assert.match(triggerBoundary[1], /record workflow packets and never launch a worker process/i);
  assert.doesNotMatch(triggerBoundary[1], /subagent development team coordination/i);
});

test("skill metadata permits natural-language continuation routing", () => {
  const skillMetadata = read("skills/coding-agents/agents/openai.yaml");

  assert.match(skillMetadata, /^interface:\n/m);
  assert.match(skillMetadata, /^  short_description: ['"]?Continue same-repo Coding Agents tasks['"]?$/m);
  assert.match(skillMetadata, /^  default_prompt: ['"]?Use \$coding-agents to continue this valid \.coding-agents repository/m);
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
  assert.match(cli, /Existing completed state never locks the repo/);
  assert.match(cli, /preserves runner\.md history/);
});
