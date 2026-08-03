import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(REPO_ROOT, "bin", "coding-agents.mjs");
const SELF_REPORT_GUIDANCE =
  /If still running at heartbeat_interval, self-report progress with fields completed\/current\/blocker\/ETA; use blocker: none and ETA: unknown when unknown\./;
const CODING_CONDUCT_RULES =
  /coding_conduct_rules: .*GitHub\/npm OSS.*do not reimplement.*first principles.*fallback implementations.*main-flow errors/;

function contractCoverageArgs(taskId) {
  const decisions = Array.from({ length: 4 }, (_, index) => `D-${taskId}-${String(index + 1).padStart(3, "0")}`);
  const completions = Array.from({ length: 5 }, (_, index) => `C-${taskId}-${String(index + 1).padStart(3, "0")}`);
  return [
    "--contract-coverage",
    "required",
    "--decision-coverage",
    decisions
      .map((id) => `${id}: 日本語の確認 path:.coding-agents/decisions.md`)
      .join(" | "),
    "--completion-coverage",
    completions
      .map((id) => `${id}: 日本語の確認 test:workflow-state result:pass`)
      .join(" | "),
    "--source-spec-coverage",
    "仕様範囲を確認 path:.coding-agents/task.md",
  ];
}

test("runner commands require matching intake state before writing runner state", () => {
  const repo = makeTempGitRepo();
  try {
    const beforeIntake = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "state-safety",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--assignment",
      "make a scoped change",
      "--expected-output",
      "implementation packet",
    ]);
    assert.notEqual(beforeIntake.status, 0);
    assert.match(beforeIntake.stderr, /requires current intake state/);
    assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false);

    const finalizeBeforeIntake = runCli([
      "finalize",
      "--target-cwd",
      repo,
      "--task-id",
      "state-safety",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
    ]);
    assert.notEqual(finalizeBeforeIntake.status, 0);
    assert.match(finalizeBeforeIntake.stderr, /finalize requires current intake state/);
    assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false);

    intake(repo, { taskId: "state-safety", epoch: "e1", scope: "README.md" });

    const wrongTask = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "wrong-task",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--assignment",
      "make a scoped change",
      "--expected-output",
      "implementation packet",
    ]);
    assert.notEqual(wrongTask.status, 0);
    assert.match(wrongTask.stderr, /does not match current task state-safety/);
    assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false);

    const wrongFinalizationTask = runCli([
      "finalize",
      "--target-cwd",
      repo,
      "--task-id",
      "wrong-task",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
    ]);
    assert.notEqual(wrongFinalizationTask.status, 0);
    assert.match(wrongFinalizationTask.stderr, /does not match current task state-safety/);
    assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false);

    const assigned = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "state-safety",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--assignment",
      "make a scoped change",
      "--expected-output",
      "implementation packet",
    ]);
    assert.equal(assigned.status, 0, assigned.stderr);
    assert.match(readState(repo, "runner.md"), /type: assignment/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("completed state does not lock the repo and clearly unrelated fresh intake preserves runner history", () => {
  const repo = makeTempGitRepo();
  try {
    const firstTask = "completed-first-purpose";
    intake(repo, {
      taskId: firstTask,
      epoch: "e1",
      scope: "README.md",
      workType: "documentation",
      task: "Document the first completed purpose",
    });

    const finalized = runCli([
      "finalize",
      "--target-cwd",
      repo,
      "--task-id",
      firstTask,
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--work-type",
      "documentation",
      ...contractCoverageArgs(firstTask),
    ]);
    assert.equal(finalized.status, 0, finalized.stderr);
    const historicalRunner = readState(repo, "runner.md");
    assert.match(historicalRunner, /type: task-finalization/);
    assert.match(historicalRunner, /task_id: completed-first-purpose/);

    const nextTask = "next-purpose-same-repo";
    const nextIntake = runCli([
      "intake",
      "--target-cwd",
      repo,
      "--work-type",
      "documentation",
      "--task",
      "Start a clearly unrelated second purpose in the same repository",
      "--task-id",
      nextTask,
      "--epoch",
      "e2",
      "--scope",
      "docs/next-purpose.md",
    ]);
    assert.equal(nextIntake.status, 0, nextIntake.stderr);

    for (const file of ["project.md", "task.md", "decisions.md", "handoff.md"]) {
      const current = readState(repo, file);
      assert.match(current, /next-purpose-same-repo/);
      assert.doesNotMatch(current, /completed-first-purpose/);
    }
    assert.equal(readState(repo, "runner.md"), historicalRunner);

    const handoff = runCli(["handoff", "--target-cwd", repo, "--task-id", nextTask]);
    assert.equal(handoff.status, 0, handoff.stderr);
    assert.match(handoff.stdout, /next-purpose-same-repo/);
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);
    assert.equal(runCli(["doctor", "--target-cwd", repo]).status, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("finalize synchronizes active TODO state and validators reject completion contradictions", () => {
  const repo = makeTempGitRepo();
  try {
    const taskId = "todo-finalization-consistency";
    intake(repo, {
      taskId,
      epoch: "e1",
      scope: "README.md",
      workType: "documentation",
      task: "Verify task finalization and TODO state remain consistent",
    });

    const initialTodo = readState(repo, "todo.md");
    assert.match(initialTodo, new RegExp(`^- \\[ \\] ${taskId}\\.4`, "m"));
    assert.match(initialTodo, new RegExp(`^- \\[ \\] ${taskId}\\.5`, "m"));

    const prematureTodo = initialTodo.replace(
      new RegExp(`^- \\[ \\] (${taskId}\\.\\d+.*)$`, "gm"),
      "- [x] $1",
    );
    writeFileSync(path.join(repo, ".coding-agents", "todo.md"), prematureTodo, "utf8");
    const prematureDoctor = runCli(["doctor", "--target-cwd", repo]);
    assert.notEqual(prematureDoctor.status, 0);
    assert.match(prematureDoctor.stdout, /TODO\/task-finalization contradiction/);
    writeFileSync(path.join(repo, ".coding-agents", "todo.md"), initialTodo, "utf8");

    const rejected = runCli([
      "finalize",
      "--target-cwd",
      repo,
      "--task-id",
      taskId,
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--work-type",
      "documentation",
      "--contract-coverage",
      "required",
      "--decision-coverage",
      "missing",
      "--completion-coverage",
      "missing",
      "--source-spec-coverage",
      "missing",
    ]);
    assert.notEqual(rejected.status, 0);
    assert.equal(readState(repo, "todo.md"), initialTodo, "rejected finalize must not mutate TODO");
    assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false);

    const finalized = runCli([
      "finalize",
      "--target-cwd",
      repo,
      "--task-id",
      taskId,
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--work-type",
      "documentation",
      ...contractCoverageArgs(taskId),
    ]);
    assert.equal(finalized.status, 0, finalized.stderr);
    assert.match(finalized.stdout, /ok todo: completed 5 active task item\(s\)/);

    const completedTodo = readState(repo, "todo.md");
    assert.doesNotMatch(completedTodo, new RegExp(`^- \\[ \\] ${taskId}\\.`, "m"));
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);
    assert.equal(runCli(["doctor", "--target-cwd", repo]).status, 0);

    const contradictoryTodo = completedTodo.replace(
      `- [x] ${taskId}.5`,
      `- [ ] ${taskId}.5`,
    );
    writeFileSync(path.join(repo, ".coding-agents", "todo.md"), contradictoryTodo, "utf8");
    const contradictoryVerify = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(contradictoryVerify.status, 0);
    assert.match(contradictoryVerify.stdout, /task-finalization\/TODO contradiction/);
    const contradictoryDoctor = runCli(["doctor", "--target-cwd", repo]);
    assert.notEqual(contradictoryDoctor.status, 0);
    assert.match(contradictoryDoctor.stdout, /task-finalization\/TODO contradiction/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("finalize requires exact delimiter-aware coverage IDs while preserving colon and equals mappings", () => {
  const repo = makeTempGitRepo();
  try {
    const taskId = "coverage-boundary";
    const decisionIds = Array.from({ length: 4 }, (_, index) => `D-${taskId}-${String(index + 1).padStart(3, "0")}`);
    const completionIds = Array.from({ length: 5 }, (_, index) => `C-${taskId}-${String(index + 1).padStart(3, "0")}`);
    intake(repo, { taskId, epoch: "e1", scope: "README.md", workType: "documentation" });

    const suffixedFake = runCli([
      "finalize",
      "--target-cwd",
      repo,
      "--task-id",
      taskId,
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--work-type",
      "documentation",
      "--contract-coverage",
      "required",
      "--decision-coverage",
      decisionIds
        .map((id, index) => `${index === decisionIds.length - 1 ? `${id}-extra` : id}: path:.coding-agents/decisions.md`)
        .join(" | "),
      "--completion-coverage",
      completionIds.map((id) => `${id}: test:workflow-state result:pass`).join(" | "),
      "--source-spec-coverage",
      "path:.coding-agents/task.md",
    ]);
    assert.notEqual(suffixedFake.status, 0);
    assert.match(suffixedFake.stderr, /decision_coverage\.D-coverage-boundary-004/);
    assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false, "rejected finalize must be atomic");

    const exactMappings = runCli([
      "finalize",
      "--target-cwd",
      repo,
      "--task-id",
      taskId,
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--work-type",
      "documentation",
      "--contract-coverage",
      "required",
      "--decision-coverage",
      decisionIds
        .map((id, index) => `${id}${index % 2 === 0 ? ":" : " ="} path:.coding-agents/decisions.md`)
        .join(" | "),
      "--completion-coverage",
      completionIds
        .map((id, index) => `${id}${index % 2 === 0 ? ":" : " ="} test:workflow-state result:${["pass", "fail", "7"][index % 3]}`)
        .join(" | "),
      "--source-spec-coverage",
      "test:source-spec result:0",
    ]);
    assert.equal(exactMappings.status, 0, exactMappings.stderr);
    assert.match(readState(repo, "runner.md"), /type: task-finalization/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("finalize keeps prefix-collision coverage IDs independently required", () => {
  const repo = makeTempGitRepo();
  try {
    const taskId = "prefix";
    const generatedDecisionIds = Array.from({ length: 4 }, (_, index) => `D-${taskId}-${String(index + 1).padStart(3, "0")}`);
    const completionIds = Array.from({ length: 5 }, (_, index) => `C-${taskId}-${String(index + 1).padStart(3, "0")}`);
    intake(repo, { taskId, epoch: "e1", scope: "README.md", workType: "documentation" });

    const decisionsPath = path.join(repo, ".coding-agents", "decisions.md");
    writeFileSync(
      decisionsPath,
      `${readFileSync(decisionsPath, "utf8")}\n## D-prefix-1 Prefix Boundary\n\n- accepted: D-prefix-1 remains independently required.\n\n## D-prefix-10 Prefix Boundary\n\n- accepted: D-prefix-10 remains independently required.\n`,
      "utf8",
    );

    const rejected = runCli([
      "finalize",
      "--target-cwd",
      repo,
      "--task-id",
      taskId,
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--work-type",
      "documentation",
      "--contract-coverage",
      "required",
      "--decision-coverage",
      [...generatedDecisionIds, "D-prefix-10"].map((id) => `${id}: path:.coding-agents/decisions.md`).join(" | "),
      "--completion-coverage",
      completionIds.map((id) => `${id}: test:workflow-state result:pass`).join(" | "),
      "--source-spec-coverage",
      "path:.coding-agents/task.md",
    ]);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /decision_coverage\.D-prefix-1(?:\b|$)/);
    assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false, "prefix rejection must be atomic");
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("finalize rejects skip and skipped test results as typed completion evidence atomically", () => {
  for (const resultValue of ["skip", "skipped"]) {
    const repo = makeTempGitRepo();
    try {
      const taskId = `typed-${resultValue}`;
      const decisionIds = Array.from({ length: 4 }, (_, index) => `D-${taskId}-${String(index + 1).padStart(3, "0")}`);
      const completionIds = Array.from({ length: 5 }, (_, index) => `C-${taskId}-${String(index + 1).padStart(3, "0")}`);
      intake(repo, { taskId, epoch: "e1", scope: "README.md", workType: "documentation" });

      const rejected = runCli([
        "finalize",
        "--target-cwd",
        repo,
        "--task-id",
        taskId,
        "--epoch",
        "e1",
        "--scope",
        "README.md",
        "--work-type",
        "documentation",
        "--contract-coverage",
        "required",
        "--decision-coverage",
        decisionIds.map((id) => `${id}: test:decision-boundary result:${resultValue}`).join(" | "),
        "--completion-coverage",
        completionIds.map((id) => `${id}: test:completion-boundary result:${resultValue}`).join(" | "),
        "--source-spec-coverage",
        `test:source-spec-boundary result:${resultValue}`,
      ]);
      assert.notEqual(rejected.status, 0, `result:${resultValue} unexpectedly finalized the task`);
      assert.match(rejected.stderr, new RegExp(`decision_coverage\\.D-${taskId}-001`));
      assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false, "rejected typed evidence must be atomic");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }
});

test("task-finalization validation binds D and C namespaces to packet task_id", () => {
  const repo = makeTempGitRepo();
  try {
    const taskId = "namespace-ident";
    intake(repo, { taskId, epoch: "e1", scope: "README.md", workType: "documentation" });
    const finalized = runCli([
      "finalize",
      "--target-cwd",
      repo,
      "--task-id",
      taskId,
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--work-type",
      "documentation",
      ...contractCoverageArgs(taskId),
    ]);
    assert.equal(finalized.status, 0, finalized.stderr);

    const runnerPath = path.join(repo, ".coding-agents", "runner.md");
    const validRunner = readFileSync(runnerPath, "utf8");
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);
    assert.equal(runCli(["doctor", "--target-cwd", repo]).status, 0);

    const tamperedRunner = validRunner.replace(`- task_id: ${taskId}`, "- task_id: other");
    assert.notEqual(tamperedRunner, validRunner);
    writeFileSync(runnerPath, tamperedRunner, "utf8");

    const verifyTampered = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(verifyTampered.status, 0);
    assert.match(verifyTampered.stdout, /task-finalization.*contract_coverage_expected_(?:decision|completion)_ids.*namespace/);
    const doctorTampered = runCli(["doctor", "--target-cwd", repo]);
    assert.notEqual(doctorTampered.status, 0);
    assert.match(doctorTampered.stdout, /task-finalization.*namespace/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("handoff validates requested task id before printing the handoff body", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "handoff-current", epoch: "e1", scope: "README.md" });

    const wrong = runCli(["handoff", "--target-cwd", repo, "--task-id", "wrong-task"]);
    assert.notEqual(wrong.status, 0);
    assert.match(wrong.stderr, /does not match current task handoff-current/);
    assert.doesNotMatch(wrong.stdout, /# Handoff Prompt/);

    const current = runCli(["handoff", "--target-cwd", repo, "--task-id", "handoff-current"]);
    assert.equal(current.status, 0, current.stderr);
    assert.match(current.stdout, /# Handoff Prompt/);
    assert.match(current.stdout, SELF_REPORT_GUIDANCE);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("identity isolation fields reject CR/LF injection before state writes", () => {
  const repo = makeTempGitRepo();
  try {
    for (const [field, value] of [
      ["--task-id", "identity\n- epoch: injected"],
      ["--epoch", "e1\r- scope: injected"],
      ["--scope", "README.md\n- task_id: injected"],
    ]) {
      const intakeArgs = [
        "intake",
        "--target-cwd",
        repo,
        "--task",
        "Add a focused workflow-state safety improvement",
        "--task-id",
        "identity-safe",
        "--epoch",
        "e1",
        "--scope",
        "README.md",
      ];
      intakeArgs[intakeArgs.indexOf(field) + 1] = value;
      const rejected = runCli(intakeArgs);
      assert.notEqual(rejected.status, 0, `${field} unexpectedly passed`);
      assert.match(rejected.stderr, /CR\/LF are not allowed/);
    }

    assert.equal(existsSync(path.join(repo, ".coding-agents")), false);

    intake(repo, { taskId: "identity-current", epoch: "e1", scope: "README.md" });
    const commands = [
      [
        "assign",
        "--target-cwd",
        repo,
        "--role",
        "Implementer",
        "--task-id",
        "identity-current\n- scope: injected",
        "--epoch",
        "e1",
        "--scope",
        "README.md",
        "--assignment",
        "make a scoped change",
        "--expected-output",
        "implementation packet",
      ],
      [
        "collect",
        "--target-cwd",
        repo,
        "--role",
        "Implementer",
        "--task-id",
        "identity-current",
        "--epoch",
        "e1\r- scope: injected",
        "--scope",
        "README.md",
        "--status",
        "blocked",
        "--blockers",
        "blocked by identity validation test",
        "--next-investigation",
        "retry with clean identity",
      ],
      [
        "run",
        "--target-cwd",
        repo,
        "--role",
        "Implementer",
        "--task-id",
        "identity-current",
        "--epoch",
        "e1",
        "--scope",
        "README.md\n- task_id: injected",
        "--assignment",
        "make a scoped change",
        "--expected-output",
        "runner packet",
      ],
      ["handoff", "--target-cwd", repo, "--task-id", "identity-current\n- scope: injected"],
    ];

    for (const args of commands) {
      const rejected = runCli(args);
      assert.notEqual(rejected.status, 0, `${args[0]} unexpectedly passed`);
      assert.match(rejected.stderr, /CR\/LF are not allowed/);
    }
    assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("validation rejects corrupted workflow state with injected identity fields", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "identity-state", epoch: "e1", scope: "README.md" });
    const taskPath = path.join(repo, ".coding-agents", "task.md");
    const task = readFileSync(taskPath, "utf8");
    writeFileSync(taskPath, task.replace("- task_id: identity-state", "- task_id: identity-state\n- task_id: injected"), "utf8");

    const verify = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stdout, /invalid workflow identity fields/);

    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.notEqual(doctor.status, 0);
    assert.match(doctor.stdout, /task_id duplicated/);

    const normalize = runCli(["normalize-debugging-integrity", "--target-cwd", repo]);
    assert.notEqual(normalize.status, 0);
    assert.match(normalize.stderr, /requires valid workflow identity fields/);

    const assign = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "identity-state",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--assignment",
      "make a scoped change",
      "--expected-output",
      "implementation packet",
    ]);
    assert.notEqual(assign.status, 0);
    assert.match(assign.stderr, /task_id duplicated/);
    assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("workflow identity ignores task body fenced field-looking bullets", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, {
      taskId: "task-fence",
      epoch: "e1",
      scope: "README.md",
      task: `Investigate a user-supplied Markdown sample.

\`\`\`markdown
- task_id: fake-task
- epoch: fake-epoch
- scope: fake-scope
\`\`\`

The fenced sample is task prose, not workflow identity.`,
    });

    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
    assert.doesNotMatch(doctor.stdout, /duplicated|fake-task|fake-epoch|fake-scope/);

    const handoff = runCli(["handoff", "--target-cwd", repo, "--task-id", "task-fence"]);
    assert.equal(handoff.status, 0, handoff.stderr);

    const fakeHandoff = runCli(["handoff", "--target-cwd", repo, "--task-id", "fake-task"]);
    assert.notEqual(fakeHandoff.status, 0);
    assert.match(fakeHandoff.stderr, /does not match current task task-fence/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("assignment validation does not accept fenced fake identity fields", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "assignment-fence", epoch: "e1", scope: "README.md" });
    const assignmentsPath = path.join(repo, ".coding-agents", "assignments.md");
    const assignments = readFileSync(assignmentsPath, "utf8");
    const corrupted = assignments.replace(
      /(## Implementer[\s\S]*?)- task_id: assignment-fence\n/,
      "$1```markdown\n- task_id: assignment-fence\n```\n",
    );
    writeFileSync(assignmentsPath, corrupted, "utf8");

    const verify = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stdout, /Implementer\.task_id/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("doctor verifies the target git info exclude without mutating it", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "exclude-check", epoch: "e1", scope: "README.md" });
    const excludePath = path.join(repo, ".git", "info", "exclude");
    const originalExclude = readFileSync(excludePath, "utf8");
    assert.match(originalExclude, /^\.coding-agents\/$/m);

    writeFileSync(excludePath, originalExclude.replace(/^\.coding-agents\/\n?/m, ""), "utf8");
    const missing = runCli(["doctor", "--target-cwd", repo]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stdout, /missing \.coding-agents\/ in/);
    assert.doesNotMatch(readFileSync(excludePath, "utf8"), /^\.coding-agents\/$/m);

    writeFileSync(excludePath, originalExclude, "utf8");
    const restored = runCli(["doctor", "--target-cwd", repo]);
    assert.equal(restored.status, 0, restored.stdout + restored.stderr);
    assert.match(restored.stdout, /ok \.coding-agents\/ ignored by git info exclude/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("intake describes fixed roles as scaffold, not resident agents", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "role-scaffold", epoch: "e1", scope: "README.md" });
    const assignments = readState(repo, "assignments.md");
    assert.match(assignments, /# Role Assignment Scaffold/);
    assert.match(assignments, /not resident agents or spawned workers/);
    assert.match(assignments, /shared contracts below apply once to every scaffold role/i);
    assert.equal([...assignments.matchAll(/^## (?!Debugging|Coding Conduct|Meta-Cognitive|Nested|Subagent)(.+)$/gm)].length, 14);
    assert.match(assignments, /- status: scaffolded/);
    const taskState = readState(repo, "task.md");
    const decisions = readState(repo, "decisions.md");
    assert.equal([...taskState.matchAll(/^- C-role-scaffold-\d{3}:/gm)].length, 5);
    assert.equal([...decisions.matchAll(/^## D-role-scaffold-\d{3} /gm)].length, 4);
    assert.match(taskState, /The first acceptance candidate integrates every known requirement in the declared iterative slice and completes the primary path end to end:/);
    assert.match(taskState, /delivery_mode: ITERATIVE_DELIVERY/);

    const verify = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.equal(verify.status, 0, verify.stdout + verify.stderr);

    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
    assert.match(doctor.stdout, /14 role assignment scaffold sections present/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("intake validates and propagates one typed evidence reference", () => {
  const repo = makeTempGitRepo();
  const evidenceRef =
    "artifact:.coding-agents/improvements/proposal-0123456789abcdef0123.json";
  try {
    intake(repo, {
      taskId: "evidence-link",
      epoch: "e1",
      scope: "src/parser.js",
      workType: "debug",
      evidenceRef,
    });
    for (const filename of ["project.md", "task.md", "audit.md", "handoff.md"]) {
      assert.ok(
        readState(repo, filename).includes(`- evidence_ref: ${evidenceRef}\n`),
      );
    }

    const before = readState(repo, "task.md");
    const rejected = runCli([
      "intake",
      "--target-cwd",
      repo,
      "--task",
      "Reject an untyped evidence value",
      "--task-id",
      "evidence-rejected",
      "--epoch",
      "e2",
      "--scope",
      "src/parser.js",
      "--evidence-ref",
      "looked at the session",
    ]);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /--evidence-ref must contain a concrete typed reference/);
    assert.equal(readState(repo, "task.md"), before);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("intake centralizes shared supervision guidance without duplicating scaffold roles", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "supervision-intake", epoch: "e1", scope: "README.md" });
    const assignments = readState(repo, "assignments.md");
    const implementer = getRoleSection(assignments, "Implementer");
    assert.match(assignments, /## Subagent Supervision Contract/);
    assert.match(assignments, /Silence before heartbeat deadline is neutral, not failure/);
    assert.match(assignments, /Heartbeat is telemetry, not completion evidence/);
    assert.match(assignments, SELF_REPORT_GUIDANCE);
    assert.match(assignments, /completed_retire, user_stop, safety_stop, scope_violation, stale_timeout, blocker_or_failure, stale_premise/);
    assert.match(assignments, /missed heartbeat -> soft ping\/status request -> grace wait -> stale mark -> cancel\/replace only if still silent or invalid/);
    assert.match(assignments, /descendants inherit supervision and cancellation rules; they cannot expand scope\/depth\/permissions/);
    assert.match(assignments, /## Coding Conduct Gate/);
    assert.match(assignments, /coding_conduct_gate: Coding Conduct Gate/);
    assert.match(assignments, CODING_CONDUCT_RULES);
    assertSupervisionSchema(assignments);
    assert.doesNotMatch(implementer, /^- supervision_contract:/m);
    assert.doesNotMatch(implementer, /^- coding_conduct_gate:/m);
    assert.doesNotMatch(implementer, /^- contract_coverage_gate:/m);
    assert.ok(Buffer.byteLength(assignments) < 20_000, `assignments scaffold is unexpectedly large: ${Buffer.byteLength(assignments)} bytes`);

    const handoff = readState(repo, "handoff.md");
    assert.match(handoff, /^Supervision:$/m);
    assert.match(handoff, /Parent must not cancel or interrupt a quiet worker, mark its workflow state_retired, or replace it during the no-interrupt window/);
    assert.match(handoff, /Explicit completed, blocked, or failed results are not silence; collect and integrate them immediately/);
    assert.match(handoff, SELF_REPORT_GUIDANCE);
    assert.match(handoff, /^- hierarchy_mode: none$/m);
    assert.match(handoff, /^- heartbeat_interval: PT15M$/m);
    assert.match(handoff, /^- cancel_reason_required: true$/m);
    assert.match(handoff, /^Coding Conduct Gate:$/m);
    assert.match(handoff, CODING_CONDUCT_RULES);
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);
    assert.equal(runCli(["doctor", "--target-cwd", repo]).status, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("collect records workflow-state lifecycle without claiming runtime-thread closure", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, {
      task: "Record workflow-only lifecycle disposition",
      taskId: "lifecycle-collect",
      epoch: "e1",
      scope: "README.md",
      workType: "documentation",
    });
    const taskState = readState(repo, "task.md");
    assert.match(taskState, /lifecycle_contract_version: workflow_state_v1/);
    assert.match(taskState, /lifecycle_contract_effective_at: \d{4}-\d{2}-\d{2}T/);
    const base = [
      "collect",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "lifecycle-collect",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--work-type",
      "documentation",
      "--status",
      "blocked",
      "--blockers",
      "fixture unavailable",
      "--next",
      "parent decides whether to continue",
    ];

    const missingDisposition = runCli(base);
    assert.notEqual(missingDisposition.status, 0);
    assert.match(missingDisposition.stderr, /--lifecycle-disposition/);
    assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false);

    const missingReason = runCli([...base, "--lifecycle-disposition", "state_retired"]);
    assert.notEqual(missingReason.status, 0);
    assert.match(missingReason.stderr, /--cancel-reason/);

    const unknownDisposition = runCli([...base, "--lifecycle-disposition", "runtime_closed"]);
    assert.notEqual(unknownDisposition.status, 0);
    assert.match(unknownDisposition.stderr, /unknown lifecycle disposition: runtime_closed/);

    const multipleReasons = runCli([
      ...base,
      "--lifecycle-disposition",
      "state_retired",
      "--cancel-reason",
      "completed_retire,user_stop",
    ]);
    assert.notEqual(multipleReasons.status, 0);
    assert.match(multipleReasons.stderr, /exactly one allowed --cancel-reason/);

    const duplicateReasonFlags = runCli([
      ...base,
      "--lifecycle-disposition",
      "state_retired",
      "--cancel-reason",
      "completed_retire",
      "--cancel-reason",
      "user_stop",
    ]);
    assert.notEqual(duplicateReasonFlags.status, 0);
    assert.match(duplicateReasonFlags.stderr, /duplicate --cancel-reason/);

    const continuationWithReason = runCli([
      ...base,
      "--lifecycle-disposition",
      "continuation_expected",
      "--cancel-reason",
      "completed_retire",
    ]);
    assert.notEqual(continuationWithReason.status, 0);
    assert.match(continuationWithReason.stderr, /continuation_expected rejects --cancel-reason/);

    const runtimeCloseClaim = runCli([
      ...base,
      "--lifecycle-disposition",
      "state_retired",
      "--cancel-reason",
      "blocker_or_failure",
      "--runtime-thread-closed",
      "true",
    ]);
    assert.notEqual(runtimeCloseClaim.status, 0);
    assert.match(runtimeCloseClaim.stderr, /--runtime-thread-closed is unsupported/);

    const retired = runCli([
      ...base,
      "--lifecycle-disposition",
      "state_retired",
      "--cancel-reason",
      "blocker_or_failure",
    ]);
    assert.equal(retired.status, 0, retired.stderr);
    assert.match(retired.stdout, /ok lifecycle_scope: workflow_state_only/);
    assert.match(retired.stdout, /ok lifecycle_disposition: state_retired/);
    assert.match(retired.stdout, /ok cancel_reason: blocker_or_failure/);
    assert.match(retired.stdout, /ok runtime_thread_disposition: unmanaged_by_workflow_cli/);
    assert.match(retired.stdout, /ok runtime_changed: false/);

    const continuation = runCli([
      ...base,
      "--role",
      "Reviewer",
      "--lifecycle-disposition",
      "continuation_expected",
    ]);
    assert.equal(continuation.status, 0, continuation.stderr);
    assert.match(continuation.stdout, /ok lifecycle_disposition: continuation_expected/);
    assert.match(continuation.stdout, /ok cancel_reason: none/);

    const runnerPath = path.join(repo, ".coding-agents", "runner.md");
    const validRunner = readFileSync(runnerPath, "utf8");
    assert.match(validRunner, /type: worker-result-collection[\s\S]*lifecycle_scope: workflow_state_only/);
    assert.match(validRunner, /lifecycle_contract_version: workflow_state_v1/);
    assert.match(validRunner, /lifecycle_disposition: state_retired\n- cancel_reason: blocker_or_failure/);
    assert.match(validRunner, /lifecycle_disposition: continuation_expected\n- cancel_reason: none/);
    assert.match(validRunner, /runtime_thread_disposition: unmanaged_by_workflow_cli\n- runtime_changed: false/);
    assert.doesNotMatch(validRunner, /runtime_thread_closed:/);
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);

    const fieldlessCurrent = validRunner
      .split(/\r?\n/)
      .filter((line) => !/^- (?:lifecycle_contract_version|lifecycle_scope|lifecycle_disposition|cancel_reason|runtime_thread_disposition|runtime_changed):/.test(line))
      .join("\n");
    writeFileSync(runnerPath, fieldlessCurrent, "utf8");
    const fieldlessCurrentResult = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(fieldlessCurrentResult.status, 0);
    assert.match(fieldlessCurrentResult.stdout, /missing or invalid lifecycle runner packet fields: .*lifecycle_contract_version/);

    writeFileSync(
      runnerPath,
      validRunner.replace("- lifecycle_contract_version: workflow_state_v1", "- lifecycle_contract_version: forged_version"),
      "utf8",
    );
    const forgedVersion = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(forgedVersion.status, 0);
    assert.match(forgedVersion.stdout, /missing or invalid lifecycle runner packet fields: .*lifecycle_contract_version/);

    writeFileSync(runnerPath, validRunner.replace("- runtime_changed: false", "- runtime_changed: true"), "utf8");
    const changedRuntime = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(changedRuntime.status, 0);
    assert.match(changedRuntime.stdout, /missing or invalid lifecycle runner packet fields: .*runtime_changed/);

    writeFileSync(
      runnerPath,
      validRunner.replace("- runtime_changed: false", "- runtime_changed: false\n- runtime_thread_closed: true"),
      "utf8",
    );
    const forgedClosure = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(forgedClosure.status, 0);
    assert.match(forgedClosure.stdout, /runtime_thread_closed unsupported/);

    const help = runCli(["--help"]);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /--lifecycle-disposition state_retired\|continuation_expected/);
    assert.match(help.stdout, /coding-agents\.mjs finalize/);
    assert.match(help.stdout, /Accepted typed references: file:<path>.*command:<command> exit:<integer>.*test:<name> result:<pass\|fail\|integer>/);
    assert.match(help.stdout, /workflow CLI never emits or accepts runtime_thread_closed=true/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("runtime-thread closure flags are rejected at the global command boundary", () => {
  const repo = makeTempGitRepo();
  try {
    const commands = [
      "intake",
      "assign",
      "collect",
      "finalize",
      "run",
      "orchestrate",
      "verify-assignments",
      "normalize-debugging-integrity",
      "handoff",
      "doctor",
    ];
    for (const command of commands) {
      const rejected = runCli([command, "--target-cwd", repo, "--runtime-thread-closed", "true"]);
      assert.notEqual(rejected.status, 0, `${command} unexpectedly accepted runtime-thread closure`);
      assert.match(rejected.stderr, /--runtime-thread-closed is unsupported by every command/);
    }
    const rejectedHelp = runCli(["--help", "--runtime-thread-closed", "true"]);
    assert.notEqual(rejectedHelp.status, 0);
    assert.match(rejectedHelp.stderr, /--runtime-thread-closed is unsupported by every command/);
    assert.equal(existsSync(path.join(repo, ".coding-agents")), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("feature profiles are optional overlays and do not change the fixed 14-role scaffold", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "profile-scaffold", epoch: "e1", scope: "README.md" });

    const assigned = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "profile-scaffold",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--feature-profile",
      "workflow.state-safety",
      "--assignment",
      "check workflow state append safety",
      "--expected-output",
      "assignment packet",
    ]);
    assert.equal(assigned.status, 0, assigned.stderr);

    const assignments = readState(repo, "assignments.md");
    assert.equal([...assignments.matchAll(/^## (?!Debugging|Coding Conduct|Meta-Cognitive|Nested|Subagent)(.+)$/gm)].length, 14);
    assert.doesNotMatch(assignments, /workflow\.state-safety/);
    assert.doesNotMatch(assignments, /^## workflow\.state-safety$/m);

    const runner = readState(repo, "runner.md");
    assert.match(runner, /feature_profile: workflow\.state-safety/);
    assert.match(runner, /feature_profile_guidance: .*optional assignment overlay, not a resident agent or spawned worker/);
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("runner assignment packets carry supervision guidance", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "supervision-runner", epoch: "e1", scope: "README.md" });

    const assigned = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "supervision-runner",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--assignment",
      "record a supervised assignment packet",
      "--expected-output",
      "assignment packet",
    ]);
    assert.equal(assigned.status, 0, assigned.stderr);

    const runner = readState(repo, "runner.md");
    assert.match(runner, /type: assignment[\s\S]*supervision_contract: Subagent Supervision Contract/);
    assert.match(runner, /type: assignment[\s\S]*supervision_heartbeat: Silence before heartbeat deadline is neutral, not failure\. Heartbeat is telemetry, not completion evidence\./);
    assert.match(runner, /type: assignment[\s\S]*supervision_no_interrupt: Parent must not cancel or interrupt a quiet worker, mark its workflow state_retired, or replace it during the no-interrupt window\./);
    assert.match(runner, /type: assignment[\s\S]*Explicit completed, blocked, or failed results are not silence; collect and integrate them immediately\./);
    assert.match(runner, /type: assignment[\s\S]*If still running at heartbeat_interval, self-report progress with fields completed\/current\/blocker\/ETA; use blocker: none and ETA: unknown when unknown\./);
    assert.match(runner, /type: assignment[\s\S]*supervision_retire_cancel_reasons: completed_retire, user_stop, safety_stop, scope_violation, stale_timeout, blocker_or_failure, stale_premise/);
    assert.match(runner, /type: assignment[\s\S]*coding_conduct_gate: Coding Conduct Gate/);
    assert.match(runner, new RegExp(`type: assignment[\\s\\S]*${CODING_CONDUCT_RULES.source}`));
    assert.match(runner, /type: assignment[\s\S]*hierarchy_mode: none/);
    assert.match(runner, /type: assignment[\s\S]*heartbeat_interval: PT15M/);
    assert.match(runner, /type: assignment[\s\S]*cancel_reason_required: true/);
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("runner assignment packets can override finite hierarchy and supervision timing", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "supervision-override", epoch: "e1", scope: "README.md" });

    const assigned = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "supervision-override",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--hierarchy-mode",
      "one_level",
      "--heartbeat-interval",
      "PT10M",
      "--heartbeat-deadline",
      "PT20M",
      "--max-silence",
      "PT40M",
      "--soft-timeout",
      "PT60M",
      "--hard-timeout",
      "PT90M",
      "--no-interrupt-until",
      "PT40M",
      "--assignment",
      "record a supervised assignment packet with delegated depth",
      "--expected-output",
      "assignment packet",
    ]);
    assert.equal(assigned.status, 0, assigned.stderr);

    const runner = readState(repo, "runner.md");
    assert.match(runner, /type: assignment[\s\S]*hierarchy_mode: one_level/);
    assert.match(runner, /type: assignment[\s\S]*max_depth: 1/);
    assert.match(runner, /type: assignment[\s\S]*depth: 0/);
    assert.match(runner, /type: assignment[\s\S]*remaining_depth: 1/);
    assert.match(runner, /type: assignment[\s\S]*heartbeat_interval: PT10M/);
    assert.match(runner, /type: assignment[\s\S]*heartbeat_deadline: PT20M/);
    assert.match(runner, /type: assignment[\s\S]*no_interrupt_until: PT40M/);
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("n_level hierarchy requires finite max depth before runner state append", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "supervision-invalid-depth", epoch: "e1", scope: "README.md" });

    const assigned = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "supervision-invalid-depth",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--hierarchy-mode",
      "n_level",
      "--assignment",
      "record an invalid depth packet",
      "--expected-output",
      "assignment packet",
    ]);
    assert.notEqual(assigned.status, 0);
    assert.match(assigned.stderr, /--max-depth is required/);
    assert.throws(() => readState(repo, "runner.md"));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("valid feature profile renders in assignment, collect, and run skeleton packets", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "profile-render", epoch: "e1", scope: "README.md" });

    const assigned = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "profile-render",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--feature-profile",
      "debug.reproducer",
      "--assignment",
      "capture a reproduction",
      "--expected-output",
      "assignment packet",
    ]);
    assert.equal(assigned.status, 0, assigned.stderr);
    assert.match(assigned.stdout, /ok feature_profile: debug\.reproducer/);

    const collected = runCli([
      "collect",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "profile-render",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--feature-profile",
      "debug.reproducer",
      "--status",
      "blocked",
      "--lifecycle-disposition",
      "continuation_expected",
      "--findings",
      "reproduction needs a fixture",
      "--blockers",
      "fixture is not available",
      "--next",
      "parent decides fixture source",
    ]);
    assert.equal(collected.status, 0, collected.stderr);
    assert.match(collected.stdout, /ok feature_profile: debug\.reproducer/);

    const run = runCli([
      "orchestrate",
      "--target-cwd",
      repo,
      "--role",
      "Test Runner",
      "--task-id",
      "profile-render",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--feature-profile",
      "debug.reproducer",
      "--assignment",
      "record a runner skeleton",
      "--expected-output",
      "runner skeleton",
    ]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /ok feature_profile: debug\.reproducer/);

    const runner = readState(repo, "runner.md");
    assert.match(runner, /type: assignment[\s\S]*feature_profile: debug\.reproducer/);
    assert.match(runner, /type: worker-result-collection[\s\S]*feature_profile: debug\.reproducer/);
    assert.match(runner, /type: process-orchestration-skeleton[\s\S]*feature_profile: debug\.reproducer/);
    assert.match(runner, /type: assignment[\s\S]*feature_profile: debug\.reproducer\n- work_type: auto/);
    assert.match(runner, /type: worker-result-collection[\s\S]*feature_profile: debug\.reproducer\n- work_type: auto/);
    assert.match(runner, /type: process-orchestration-skeleton[\s\S]*feature_profile: debug\.reproducer\n- work_type: auto/);
    assert.match(runner, /feature_profile_guidance: .*reproduce the expected versus actual behavior/);
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("external process runner flags are rejected while run remains record-only", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "official-spawn-only", epoch: "e1", scope: "README.md" });

    for (const forbiddenArgs of [
      ["--runner", "codex-cli"],
      ["--timeout-ms", "1000"],
    ]) {
      const rejected = runCli([
        "run",
        "--target-cwd",
        repo,
        "--role",
        "Implementer",
        "--task-id",
        "official-spawn-only",
        "--epoch",
        "e1",
        "--scope",
        "README.md",
        "--assignment",
        "record a bounded assignment",
        "--expected-output",
        "assignment and orchestration skeleton",
        ...forbiddenArgs,
      ]);
      assert.notEqual(rejected.status, 0);
      assert.match(rejected.stderr, /this CLI never launches Codex workers; use the official Codex subagent spawn tools/);
      assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false);
    }

    const recorded = runCli([
      "run",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "official-spawn-only",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--assignment",
      "record a bounded assignment",
      "--expected-output",
      "assignment and orchestration skeleton",
    ]);
    assert.equal(recorded.status, 0, recorded.stderr);
    assert.match(recorded.stdout, /ok spawned: false/);
    assert.match(recorded.stdout, /record-only; dispatch subagents through the official Codex spawn tools/);

    const runner = readState(repo, "runner.md");
    assert.match(runner, /type: assignment/);
    assert.match(runner, /type: process-orchestration-skeleton/);
    assert.doesNotMatch(runner, /type: process-runner-result/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("historical completed process-runner results remain readable and require collection", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, {
      task: "Preserve historical process result validation",
      taskId: "historical-runner-result",
      epoch: "e1",
      scope: "README.md",
      workType: "documentation",
    });
    const recorded = runCli([
      "run",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "historical-runner-result",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--work-type",
      "documentation",
      "--assignment",
      "record a documentation assignment",
      "--expected-output",
      "workflow-state packet",
    ]);
    assert.equal(recorded.status, 0, recorded.stderr);

    const runnerPath = path.join(repo, ".coding-agents", "runner.md");
    const runner = readFileSync(runnerPath, "utf8");
    const assignment = runner.match(/## Issued Assignments\n\n(### [\s\S]*?)(?=\n## Process Orchestration Skeletons)/)?.[1];
    assert.ok(assignment, "record-only run must emit an assignment packet");
    const historicalResult = assignment
      .replace("- type: assignment", "- type: process-runner-result")
      .replace("- status: assigned", "- status: completed")
      .replace(
        /- lifecycle: /,
        "- runner: codex-cli\n- spawned: true\n- exit_code: 0\n- summary: historical completed process result\n- failure: none\n- lifecycle: ",
      );
    writeFileSync(
      runnerPath,
      `${runner.trimEnd()}\n\n## Historical Process Runner Results\n\n${historicalResult.trim()}\n`,
      "utf8",
    );

    const uncollected = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(uncollected.status, 0);
    assert.match(uncollected.stdout, /uncollected completed runner result missing follow-up worker result collection/);

    const collected = runCli([
      "collect",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "historical-runner-result",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--work-type",
      "documentation",
      "--status",
      "completed",
      "--lifecycle-disposition",
      "state_retired",
      "--cancel-reason",
      "completed_retire",
      "--findings",
      "historical result collected",
      "--verification",
      "backward validation completed",
      "--next",
      "parent final verification",
    ]);
    assert.equal(collected.status, 0, collected.stderr);
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);
    assert.match(readState(repo, "runner.md"), /type: process-runner-result/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("unknown feature profiles fail before runner state is appended", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "profile-reject", epoch: "e1", scope: "README.md" });

    for (const args of [
      [
        "assign",
        "--target-cwd",
        repo,
        "--role",
        "Implementer",
        "--task-id",
        "profile-reject",
        "--epoch",
        "e1",
        "--scope",
        "README.md",
        "--feature-profile",
        "debug.unknown",
        "--assignment",
        "make a scoped change",
        "--expected-output",
        "assignment packet",
      ],
      [
        "collect",
        "--target-cwd",
        repo,
        "--role",
        "Implementer",
        "--task-id",
        "profile-reject",
        "--epoch",
        "e1",
        "--scope",
        "README.md",
        "--feature-profile",
        "debug.unknown",
        "--status",
        "blocked",
        "--blockers",
        "unknown profile",
        "--next",
        "retry with known profile",
      ],
      [
        "run",
        "--target-cwd",
        repo,
        "--role",
        "Implementer",
        "--task-id",
        "profile-reject",
        "--epoch",
        "e1",
        "--scope",
        "README.md",
        "--feature-profile",
        "debug.unknown",
        "--assignment",
        "make a scoped change",
        "--expected-output",
        "runner packet",
      ],
    ]) {
      const rejected = runCli(args);
      assert.notEqual(rejected.status, 0, `${args[0]} unexpectedly passed`);
      assert.match(rejected.stderr, /unknown feature profile: debug\.unknown/);
      assert.match(rejected.stderr, /debug\.reproducer/);
      assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false);
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("unknown work types fail before runner state is appended", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "work-type-reject", epoch: "e1", scope: "README.md" });

    for (const args of [
      [
        "assign",
        "--target-cwd",
        repo,
        "--role",
        "Implementer",
        "--task-id",
        "work-type-reject",
        "--epoch",
        "e1",
        "--scope",
        "README.md",
        "--work-type",
        "mystery",
        "--assignment",
        "make a scoped change",
        "--expected-output",
        "assignment packet",
      ],
      [
        "collect",
        "--target-cwd",
        repo,
        "--role",
        "Implementer",
        "--task-id",
        "work-type-reject",
        "--epoch",
        "e1",
        "--scope",
        "README.md",
        "--work-type",
        "mystery",
        "--status",
        "blocked",
        "--blockers",
        "unknown work type",
        "--next",
        "retry with known work type",
      ],
      [
        "run",
        "--target-cwd",
        repo,
        "--role",
        "Implementer",
        "--task-id",
        "work-type-reject",
        "--epoch",
        "e1",
        "--scope",
        "README.md",
        "--work-type",
        "mystery",
        "--assignment",
        "make a scoped change",
        "--expected-output",
        "runner packet",
      ],
    ]) {
      const rejected = runCli(args);
      assert.notEqual(rejected.status, 0, `${args[0]} unexpectedly passed`);
      assert.match(rejected.stderr, /unknown work type: mystery/);
      assert.match(rejected.stderr, /auto, documentation, source-change, debug/);
      assert.equal(existsSync(path.join(repo, ".coding-agents", "runner.md")), false);
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("omitted feature profile remains backwards compatible and records none", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "profile-none", epoch: "e1", scope: "README.md" });

    const assigned = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "profile-none",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--assignment",
      "make a scoped change",
      "--expected-output",
      "assignment packet",
    ]);
    assert.equal(assigned.status, 0, assigned.stderr);
    assert.match(assigned.stdout, /ok feature_profile: none/);

    const collected = runCli([
      "collect",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "profile-none",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--status",
      "completed",
      "--lifecycle-disposition",
      "state_retired",
      "--cancel-reason",
      "completed_retire",
      "--findings",
      "done",
      "--changed-files",
      "README.md",
      "--verification",
      "not run",
      ...contractCoverageArgs("profile-none"),
    ]);
    assert.equal(collected.status, 0, collected.stderr);
    const runner = readState(repo, "runner.md");
    assert.match(runner, /feature_profile: none/);
    assert.doesNotMatch(runner, /feature_profile_guidance:/);
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("legacy runner packets without work_type remain explicitly backwards compatible", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "work-type-legacy", epoch: "e1", scope: "README.md" });
    assert.match(readState(repo, "task.md"), /lifecycle_contract_version: workflow_state_v1/);
    const legacy = legacyRunnerWithoutWorkType("historical-pre-contract");
    assert.doesNotMatch(legacy, /work_type:/);
    assert.doesNotMatch(legacy, /hierarchy_mode|heartbeat_interval|cancel_reason_required/);
    writeFileSync(path.join(repo, ".coding-agents", "runner.md"), legacy, "utf8");

    const verify = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.equal(verify.status, 0, verify.stdout + verify.stderr);
    assert.match(verify.stdout, /runner packets valid \(3 checked\)/);
    assert.match(verify.stdout, /legacy parent-integration lifecycle preserved as unknown_legacy \(1 checked\)/);
    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
    assert.match(doctor.stdout, /legacy parent-integration lifecycle preserved as unknown_legacy \(1 checked\)/);
    assert.equal(readState(repo, "runner.md"), legacy);
    assert.doesNotMatch(readState(repo, "runner.md"), /lifecycle_scope|lifecycle_disposition|runtime_thread_disposition|runtime_changed/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("validation rejects assignments missing hierarchy fields", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "hierarchy-missing", epoch: "e1", scope: "README.md" });
    const assignmentsPath = path.join(repo, ".coding-agents", "assignments.md");
    writeFileSync(assignmentsPath, stripHierarchyLines(readFileSync(assignmentsPath, "utf8")), "utf8");

    const verify = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stdout, /missing or incomplete supervision assignment fields/);
    assert.match(verify.stdout, /hierarchy_mode/);

    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.notEqual(doctor.status, 0);
    assert.match(doctor.stdout, /remaining_depth/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("validation rejects modern runner packets missing supervision contract", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "supervision-missing", epoch: "e1", scope: "README.md" });
    writeFileSync(
      path.join(repo, ".coding-agents", "runner.md"),
      stripSupervisionLines(modernRunnerPacket("supervision-missing")),
      "utf8",
    );

    const verify = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stdout, /missing or incomplete supervision runner packet fields/);
    assert.match(verify.stdout, /supervision_contract/);

    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.notEqual(doctor.status, 0);
    assert.match(doctor.stdout, /supervision_heartbeat/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("validation rejects modern runner packets missing machine timing fields", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "timing-missing", epoch: "e1", scope: "README.md" });
    writeFileSync(
      path.join(repo, ".coding-agents", "runner.md"),
      stripTimingLines(modernRunnerPacket("timing-missing")),
      "utf8",
    );

    const verify = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(verify.status, 0);
    assert.match(verify.stdout, /missing or incomplete supervision runner packet fields/);
    assert.match(verify.stdout, /heartbeat_interval/);

    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.notEqual(doctor.status, 0);
    assert.match(doctor.stdout, /hard_timeout/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("validation rejects workflow state missing coding conduct fields", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "conduct-missing", epoch: "e1", scope: "README.md" });
    const assignmentsPath = path.join(repo, ".coding-agents", "assignments.md");
    writeFileSync(assignmentsPath, stripCodingConductLines(readFileSync(assignmentsPath, "utf8")), "utf8");

    const assignmentVerify = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(assignmentVerify.status, 0);
    assert.match(assignmentVerify.stdout, /coding conduct assignment fields/);

    intake(repo, { taskId: "conduct-runner-missing", epoch: "e1", scope: "README.md" });
    const assigned = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "conduct-runner-missing",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--assignment",
      "record an assignment packet",
      "--expected-output",
      "assignment packet",
    ]);
    assert.equal(assigned.status, 0, assigned.stderr);

    const runnerPath = path.join(repo, ".coding-agents", "runner.md");
    writeFileSync(runnerPath, stripCodingConductLines(readFileSync(runnerPath, "utf8")), "utf8");

    const runnerVerify = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(runnerVerify.status, 0);
    assert.match(runnerVerify.stdout, /coding conduct runner packet fields/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("normalize adds missing hierarchy and machine supervision fields to stale generated state", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "normalize-supervision", epoch: "e1", scope: "README.md" });
    const assigned = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "normalize-supervision",
      "--epoch",
      "e1",
      "--scope",
      "README.md",
      "--assignment",
      "record a stale packet",
      "--expected-output",
      "assignment packet",
    ]);
    assert.equal(assigned.status, 0, assigned.stderr);

    const assignmentsPath = path.join(repo, ".coding-agents", "assignments.md");
    const runnerPath = path.join(repo, ".coding-agents", "runner.md");
    writeFileSync(assignmentsPath, stripTimingLines(stripHierarchyLines(readFileSync(assignmentsPath, "utf8"))), "utf8");
    writeFileSync(runnerPath, stripTimingLines(stripHierarchyLines(readFileSync(runnerPath, "utf8"))), "utf8");

    const stale = runCli(["verify-assignments", "--target-cwd", repo]);
    assert.notEqual(stale.status, 0);

    const normalized = runCli(["normalize-debugging-integrity", "--target-cwd", repo, "--execute"]);
    assert.equal(normalized.status, 0, normalized.stderr);
    assert.match(normalized.stdout, /Updated: assignments\.md/);
    assert.match(normalized.stdout, /Updated: runner\.md/);

    const normalizedAssignments = readState(repo, "assignments.md");
    assertSupervisionSchema(normalizedAssignments);
    assert.doesNotMatch(getRoleSection(normalizedAssignments, "Implementer"), /^- hierarchy_mode:/m);
    assert.match(readState(repo, "runner.md"), /type: assignment[\s\S]*hierarchy_mode: none/);
    assert.match(readState(repo, "runner.md"), /type: assignment[\s\S]*heartbeat_interval: PT15M/);
    assert.equal(runCli(["verify-assignments", "--target-cwd", repo]).status, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("doctor does not treat trailing legacy runner packet identity as modern duplicates", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "legacy-boundary", epoch: "e1", scope: "README.md" });
    writeFileSync(path.join(repo, ".coding-agents", "runner.md"), modernPacketFollowedByLegacyRunnerPacket("legacy-boundary"), "utf8");

    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
    assert.doesNotMatch(doctor.stdout, /duplicated/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("doctor still reports duplicate identity fields inside a modern runner packet", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "runner-duplicate", epoch: "e1", scope: "README.md" });
    const runner = modernRunnerPacket("runner-duplicate")
      .replace("- task_id: runner-duplicate", "- task_id: runner-duplicate\n- task_id: duplicate");
    writeFileSync(path.join(repo, ".coding-agents", "runner.md"), runner, "utf8");

    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.notEqual(doctor.status, 0);
    assert.match(doctor.stdout, /task_id duplicated/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("runner validation ignores fenced field-looking bullets inside modern packets", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "runner-fence", epoch: "e1", scope: "README.md" });
    const runner = `${modernRunnerPacket("runner-fence")}
\`\`\`markdown
- task_id: fake-runner-task
- epoch: fake-runner-epoch
- scope: fake-runner-scope
\`\`\`
`;
    writeFileSync(path.join(repo, ".coding-agents", "runner.md"), runner, "utf8");

    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
    assert.doesNotMatch(doctor.stdout, /duplicated|fake-runner/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("runner validation does not accept fenced fake identity for missing structural fields", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "runner-missing-fence", epoch: "e1", scope: "README.md" });
    const runner = `${modernRunnerPacket("runner-missing-fence").replace("- task_id: runner-missing-fence\n", "")}
\`\`\`markdown
- task_id: runner-missing-fence
\`\`\`
`;
    writeFileSync(path.join(repo, ".coding-agents", "runner.md"), runner, "utf8");

    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.notEqual(doctor.status, 0);
    assert.match(doctor.stdout, /task_id/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("normalize runner debugging integrity stops modern packets before legacy runner packets", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "normalize-legacy-boundary", epoch: "e1", scope: "README.md" });
    const runner = modernPacketFollowedByLegacyRunnerPacket("normalize-legacy-boundary")
      .replace("- debugging_integrity: debug work requires root cause and verification\n", "");
    writeFileSync(path.join(repo, ".coding-agents", "runner.md"), runner, "utf8");

    const normalized = runCli(["normalize-debugging-integrity", "--target-cwd", repo, "--execute"]);
    assert.equal(normalized.status, 0, normalized.stderr);
    assert.match(normalized.stdout, /Updated: runner\.md/);

    const nextRunner = readState(repo, "runner.md");
    const modernSection = nextRunner.slice(0, nextRunner.indexOf("## runner packet: legacy-import"));
    assert.match(modernSection, /- debugging_integrity: For debug or repair work, identify root cause/);

    const doctor = runCli(["doctor", "--target-cwd", repo]);
    assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("normalize runner metacognitive gate does not accept packet fields as preamble", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, {
      taskId: "normalize-runner-preamble",
      epoch: "e1",
      scope: "bin/coding-agents.mjs",
      workType: "debug",
    });
    const assigned = runCli([
      "assign",
      "--target-cwd",
      repo,
      "--role",
      "Implementer",
      "--task-id",
      "normalize-runner-preamble",
      "--epoch",
      "e1",
      "--scope",
      "bin/coding-agents.mjs",
      "--work-type",
      "debug",
      "--assignment",
      "change source parser behavior",
      "--expected-output",
      "source patch and tests",
    ]);
    assert.equal(assigned.status, 0, assigned.stderr);

    const runner = readState(repo, "runner.md");
    assert.doesNotMatch(runner, /^## Meta-Cognitive Debug\/Repair Gate$/m);
    assert.match(runner, /^- metacognitive_gate_required: true$/m);

    const normalized = runCli(["normalize-debugging-integrity", "--target-cwd", repo, "--execute"]);
    assert.equal(normalized.status, 0, normalized.stderr);
    assert.match(normalized.stdout, /Updated: runner\.md/);

    const nextRunner = readState(repo, "runner.md");
    assert.match(nextRunner, /^## Meta-Cognitive Debug\/Repair Gate$/m);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

function intake(repo, options) {
  const args = [
    "intake",
    "--target-cwd",
    repo,
    "--task",
    options.task || "Add a focused workflow-state safety improvement",
    "--task-id",
    options.taskId,
    "--epoch",
    options.epoch,
    "--scope",
    options.scope,
  ];
  if (options.workType) args.splice(3, 0, "--work-type", options.workType);
  if (options.deliveryMode) args.splice(3, 0, "--delivery-mode", options.deliveryMode);
  if (options.oneShotAuthority) args.splice(3, 0, "--one-shot-authority", options.oneShotAuthority);
  if (options.evidenceRef) args.push("--evidence-ref", options.evidenceRef);
  const result = runCli(args);
  assert.equal(result.status, 0, result.stderr);
}

function makeTempGitRepo() {
  const repo = mkdtempSync(path.join(os.tmpdir(), "coding-agents-workflow-"));
  const init = spawnSync("git", ["init"], { cwd: repo, encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  return repo;
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: options.cwd || REPO_ROOT,
    env: options.env || process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
}

function readState(repo, file) {
  return readFileSync(path.join(repo, ".coding-agents", file), "utf8");
}

function legacyRunnerWithoutWorkType(taskId) {
  return `# Coding Agents Runner

This file records legacy packets without work_type.

## Issued Assignments

### 2026-06-13T00:00:00.000Z Implementer ${taskId}

- type: assignment
- role: Implementer
- status: assigned
- task_id: ${taskId}
- epoch: e1
- scope: README.md
- feature_profile: none
- invocation_cwd: /tmp/legacy
- target_cwd: /tmp/legacy
- assignment: make a scoped documentation change
- expected_output: assignment packet
- nested_coding_agents_preflight: parent already selected Coding Agents
- debugging_integrity: debug work requires root cause and verification
- lifecycle: return concise parent-integration material, then stop

## Parent Integration Packets

### 2026-06-13T00:01:00.000Z Implementer ${taskId}

- type: parent-integration
- role: Implementer
- status: completed
- task_id: ${taskId}
- epoch: e1
- scope: README.md
- feature_profile: none
- invocation_cwd: /tmp/legacy
- target_cwd: /tmp/legacy
- findings: legacy packet completed documentation work
- changed_files: README.md
- verification: not run
- blockers: none
- assumptions: none
- next: parent final verification
- debugging_integrity: debug work requires root cause and verification
- lifecycle: Parent integrates this packet, records any blocker or follow-up, then closes or retires the subagent unless an explicitly scoped continuation is required.

## Historical Process Runner Results

### 2026-06-13T00:02:00.000Z Implementer ${taskId}

- type: process-runner-result
- role: Implementer
- status: failed
- task_id: ${taskId}
- epoch: e1
- scope: README.md
- feature_profile: none
- invocation_cwd: /tmp/legacy
- target_cwd: /tmp/legacy
- runner: codex-cli
- spawned: true
- exit_code: 1
- summary: historical process runner record retained for audit
- failure: historical process runner failed before completion
- debugging_integrity: debug work requires root cause and verification
- lifecycle: historical process result is retained as an immutable workflow record
`;
}

function modernRunnerPacket(taskId) {
  return `# Coding Agents Runner

## Issued Assignments

### 2026-06-13T00:00:00.000Z Implementer ${taskId}

- type: assignment
- role: Implementer
- status: assigned
- task_id: ${taskId}
- epoch: e1
- scope: README.md
- feature_profile: none
- work_type: auto
- invocation_cwd: /tmp/modern
- target_cwd: /tmp/modern
- assignment: make a scoped documentation change
- expected_output: assignment packet
- nested_coding_agents_preflight: parent already selected Coding Agents
- debugging_integrity: debug work requires root cause and verification
${codingConductFieldLines()}
${supervisionFieldLines()}
- lifecycle: return concise parent-integration material, then stop
`;
}

function modernPacketFollowedByLegacyRunnerPacket(taskId) {
  return `${modernRunnerPacket(taskId)}
## runner packet: legacy-import

- type: assignment
- role: Implementer
- task_id: legacy-task
- epoch: legacy-epoch
- scope: legacy-scope
- assignment: legacy docs/codex packet outside the modern section
- expected_output: legacy integration material
- debugging_integrity: legacy text outside modern packet
- lifecycle: legacy lifecycle outside modern packet
`;
}

function supervisionFieldLines() {
  return `- supervision_contract: Subagent Supervision Contract
- supervision_heartbeat: Silence before heartbeat deadline is neutral, not failure. Heartbeat is telemetry, not completion evidence.
- supervision_no_interrupt: Parent must not cancel or interrupt a quiet worker, mark its workflow state_retired, or replace it during the no-interrupt window. Explicit completed, blocked, or failed results are not silence; collect and integrate them immediately.
- supervision_self_report: If still running at heartbeat_interval, self-report progress with fields completed/current/blocker/ETA; use blocker: none and ETA: unknown when unknown.
- supervision_retire_cancel_reasons: completed_retire, user_stop, safety_stop, scope_violation, stale_timeout, blocker_or_failure, stale_premise
- supervision_stale_timeout_path: missed heartbeat -> soft ping/status request -> grace wait -> stale mark -> cancel/replace only if still silent or invalid
- supervision_descendants: For permitted nested depth, descendants inherit supervision and cancellation rules; they cannot expand scope/depth/permissions.
- hierarchy_mode: none
- max_depth: 0
- depth: 0
- remaining_depth: 0
- heartbeat_interval: PT15M
- heartbeat_deadline: PT30M
- max_silence: PT45M
- soft_timeout: PT60M
- hard_timeout: PT120M
- no_interrupt_until: PT30M
- cancel_reason_required: true`;
}

function codingConductFieldLines() {
  return `- coding_conduct_gate: Coding Conduct Gate
- coding_conduct_rules: Reuse mature GitHub/npm OSS directly when it fits the requirement and dependency approval or scope permits it; do not reimplement mature solved problems. | Start bug analysis from first principles: expected outcome, actual behavior, invariants, inputs, execution path, evidence, and competing hypotheses before choosing a fix. | Do not add fallback implementations that hide main-flow errors; fix the main flow or report unresolved status or explicit user-approved temporary containment.`;
}

function stripSupervisionLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^- supervision_/.test(line))
    .join("\n");
}

function stripCodingConductLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^- coding_conduct_/.test(line))
    .join("\n");
}

function stripHierarchyLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^- (?:hierarchy_mode|max_depth|depth|remaining_depth):/.test(line))
    .join("\n");
}

function stripTimingLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^- (?:heartbeat_interval|heartbeat_deadline|max_silence|soft_timeout|hard_timeout|no_interrupt_until|cancel_reason_required):/.test(line))
    .join("\n");
}

function assertSupervisionSchema(text) {
  assert.match(text, /^- supervision_contract: Subagent Supervision Contract$/m);
  assert.match(text, SELF_REPORT_GUIDANCE);
  assert.match(text, /^- hierarchy_mode: none$/m);
  assert.match(text, /^- max_depth: 0$/m);
  assert.match(text, /^- depth: 0$/m);
  assert.match(text, /^- remaining_depth: 0$/m);
  assert.match(text, /^- heartbeat_interval: PT15M$/m);
  assert.match(text, /^- heartbeat_deadline: PT30M$/m);
  assert.match(text, /^- max_silence: PT45M$/m);
  assert.match(text, /^- soft_timeout: PT60M$/m);
  assert.match(text, /^- hard_timeout: PT120M$/m);
  assert.match(text, /^- no_interrupt_until: PT30M$/m);
  assert.match(text, /^- cancel_reason_required: true$/m);
}

function getRoleSection(text, role) {
  const startMatch = new RegExp(`^## ${escapeRegExp(role)}$`, "m").exec(text);
  if (!startMatch) return "";
  const start = startMatch.index;
  const next = text.slice(start + startMatch[0].length).search(/^## /m);
  if (next === -1) return text.slice(start);
  return text.slice(start, start + startMatch[0].length + next);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
