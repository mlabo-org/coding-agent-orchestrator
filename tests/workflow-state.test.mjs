import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(REPO_ROOT, "bin", "coding-agents.mjs");
const ROOT_THREAD_ID = "01911111-1111-7111-8111-111111111111";
const CHILD_THREAD_ID = "01922222-2222-7222-8222-222222222222";

test("intake binds exact root thread and promotes legacy state without deleting it", () => {
  const repo = makeTempGitRepo();
  try {
    mkdirSync(path.join(repo, ".coding-agents"));
    writeFileSync(path.join(repo, ".coding-agents", "legacy.txt"), "preserve\n");
    const result = intake(repo, { taskId: "state-binding" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`ok root_thread_id: ${ROOT_THREAD_ID}`));
    const task = readState(repo, "task.md");
    assert.equal(task.includes(`root_thread_id: ${ROOT_THREAD_ID}`), true);
    assert.match(task, /state_contract_version: semantic_state_v2/);
    assert.doesNotMatch(task, /Matching root and descendant starts receive/);
    assert.doesNotMatch(task, /doctor passes/);
    assert.equal(readFileSync(path.join(repo, ".coding-agents", "legacy.txt"), "utf8"), "preserve\n");
    assert.equal(readFileSync(path.join(repo, ".CAO", "legacy.txt"), "utf8"), "preserve\n");
    const exclude = readFileSync(resolveGitPathForTest(repo, "info/exclude"), "utf8");
    assert.match(exclude, /^\/\.CAO\/$/m);
    assert.match(exclude, /^\/\.coding-agents\/$/m);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("intake and doctor use Git's exclude path in a linked worktree", () => {
  const fixture = makeTempLinkedWorktree();
  try {
    assert.match(readFileSync(path.join(fixture.worktree, ".git"), "utf8"), /^gitdir: /);
    const excludePath = resolveGitPathForTest(fixture.worktree, "info/exclude");

    const result = intake(fixture.worktree, { taskId: "linked-worktree" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(excludePath, "utf8"), /^\/\.CAO\/$/m);
    assert.match(readFileSync(path.join(fixture.worktree, ".CAO", "task.md"), "utf8"), /task_id: linked-worktree/);

    const doctor = runCli(fixture.worktree, ["doctor"]);
    assert.equal(doctor.status, 0, `${doctor.stdout}\n${doctor.stderr}`);
    assert.match(doctor.stdout, /OK \.CAO locally excluded/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("material work is opened once, resolved once, and blocks finalization while open", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "work-state" });
    const begin = runCli(repo, [
      "begin-work", ...identityArgs("work-state"), "--work-id", "W-1",
      "--responsibility", "implementation", "--objective", "build state control",
      "--expected-output", "complete source result",
    ]);
    assert.equal(begin.status, 0, begin.stderr);
    const premature = runCli(repo, ["finalize", ...identityArgs("work-state"), ...coverageArgs("work-state")]);
    assert.notEqual(premature.status, 0);
    assert.match(premature.stderr, /cannot finalize with open work: W-1/);

    const complete = runCli(repo, [
      "complete-work", ...identityArgs("work-state"), "--work-id", "W-1",
      "--summary", "implemented", "--changed-paths", "bin/coding-agents.mjs",
      "--evidence-refs", "test:workflow-state result:pass",
    ]);
    assert.equal(complete.status, 0, complete.stderr);
    const duplicate = runCli(repo, [
      "complete-work", ...identityArgs("work-state"), "--work-id", "W-1",
      "--summary", "again", "--evidence-refs", "test:workflow-state result:pass",
    ]);
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /already resolved/);

    recordAcceptance(repo, "work-state");
    const finalized = runCli(repo, ["finalize", ...identityArgs("work-state"), ...coverageArgs("work-state")]);
    assert.equal(finalized.status, 0, finalized.stderr);
    assert.match(readState(repo, "handoff.md"), /^- status: completed$/m);
    assert.doesNotMatch(readState(repo, "handoff.md"), /Continue task/);
    const doctor = runCli(repo, ["doctor"]);
    assert.equal(doctor.status, 0, `${doctor.stdout}\n${doctor.stderr}`);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("concurrent semantic updates serialize without losing TODO or ledger state", async () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "concurrent-state" });
    const common = ["progress", ...identityArgs("concurrent-state")];
    const [first, second] = await Promise.all([
      runCliAsync(repo, [...common, "--item-id", "concurrent-state.3", "--status", "completed", "--summary", "first", "--evidence-refs", "test:concurrency result:pass"]),
      runCliAsync(repo, [...common, "--item-id", "concurrent-state.4", "--status", "completed", "--summary", "second", "--evidence-refs", "test:concurrency result:pass"]),
    ]);
    assert.equal(first.code, 0, first.stderr);
    assert.equal(second.code, 0, second.stderr);
    const todo = readState(repo, "todo.md");
    assert.match(todo, /^- \[x\] concurrent-state\.3/m);
    assert.match(todo, /^- \[x\] concurrent-state\.4/m);
    const ledger = readState(repo, "ledger.md");
    assert.equal((ledger.match(/^- type: progress-update$/gm) ?? []).length, 2);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("root hooks rehydrate matching state and block only known unfinished state", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "root-hooks" });
    const start = hook(repo, {
      hook_event_name: "SessionStart",
      session_id: ROOT_THREAD_ID,
      cwd: repo,
      model: "gpt-current",
      permission_mode: "default",
      source: "resume",
      transcript_path: null,
    });
    assert.equal(start.status, 0, start.stderr);
    assert.match(start.stdout, /CAO_STATE_CONTROL_ACTIVE/);
    assert.match(start.stdout, /task_id: root-hooks/);
    assert.match(start.stdout, /native Codex collaboration features freely/i);

    const unrelated = hook(repo, {
      hook_event_name: "SessionStart",
      session_id: "01999999-9999-7999-8999-999999999999",
      cwd: repo,
      model: "gpt-current",
      permission_mode: "default",
      source: "startup",
      transcript_path: null,
    });
    assert.equal(unrelated.status, 0, unrelated.stderr);
    assert.equal(unrelated.stdout, "");

    const stop = hook(repo, rootStopPayload(repo));
    assert.equal(stop.status, 0, stop.stderr);
    const stopOutput = JSON.parse(stop.stdout);
    assert.equal(stopOutput.decision, "block");
    assert.match(stopOutput.reason, /not finalized/);

    recordAcceptance(repo, "root-hooks");
    const finalized = runCli(repo, ["finalize", ...identityArgs("root-hooks"), ...coverageArgs("root-hooks")]);
    assert.equal(finalized.status, 0, finalized.stderr);
    const acceptedStop = hook(repo, rootStopPayload(repo));
    assert.equal(acceptedStop.status, 0, acceptedStop.stderr);
    assert.equal(acceptedStop.stdout, "");
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("subagent hooks use app-server ancestry and never infer semantic completion", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "subagent-hooks" });
    const fakeCodex = makeFakeCodex(repo);
    const start = hook(repo, subagentPayload(repo, "SubagentStart"), fakeCodex);
    assert.equal(start.status, 0, start.stderr);
    assert.match(start.stdout, /CAO_STATE_CONTROL_ACTIVE/);

    const stop = hook(repo, subagentPayload(repo, "SubagentStop"), fakeCodex);
    assert.equal(stop.status, 0, stop.stderr);
    assert.equal(stop.stdout, "");

    const events = readRuntimeEvents(repo);
    assert.equal(events.filter((event) => event.source === "codex-hook").length, 2);
    assert.ok(events.every((event) => event.binding_status === "matched"));
    assert.ok(events.some((event) => event.hook.agent_id === CHILD_THREAD_ID));
    assert.ok(events.every((event) => event.hook.last_assistant_message === undefined));
    assert.doesNotMatch(readState(repo, "ledger.md"), /task-finalization/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("app-server reconciliation records recursive coordination without copying prompts", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "runtime-reconcile" });
    const fakeCodex = makeFakeCodex(repo);
    const result = runCli(repo, ["reconcile-runtime", "--task-id", "runtime-reconcile", "--codex-binary", fakeCodex]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /semantic_completion_inferred: false/);
    const evidenceRef = result.stdout.match(/ok evidence_ref: (runtime:\S+)/)?.[1];
    assert.ok(evidenceRef);
    const allEvents = readRuntimeEvents(repo);
    const events = allEvents.filter((event) => event.source === "codex-app-server-readback");
    assert.ok(events.some((event) => event.observation.kind === "thread" && event.observation.thread_id === CHILD_THREAD_ID));
    const collab = events.find((event) => event.observation.kind === "collaboration_tool_call");
    assert.equal(collab.observation.tool, "sendInput");
    assert.equal(collab.observation.sender_thread_id, ROOT_THREAD_ID);
    assert.deepEqual(collab.observation.receiver_thread_ids, [CHILD_THREAD_ID]);
    assert.equal(collab.observation.prompt_present, true);
    assert.equal(collab.observation.prompt, undefined);
    assert.ok(events.some((event) => event.observation.kind === "subagent_activity"));
    const receipt = allEvents.find((event) => event.observation.kind === "runtime_reconciliation");
    assert.equal(`runtime:${receipt.event_key}`, evidenceRef);
    assert.equal(receipt.observation.semantic_completion_inferred, false);
    assert.deepEqual(receipt.observation.incomplete_lifecycle_thread_ids, [CHILD_THREAD_ID]);
    const runtimeVerification = runCli(repo, [
      "verify", ...identityArgs("runtime-reconcile"), "--check-id", "V-runtime-receipt", "--status", "passed",
      "--detail", "runtime reconciliation receipt is present", "--covers", "D-runtime-reconcile-003",
      "--evidence-refs", evidenceRef,
    ]);
    assert.equal(runtimeVerification.status, 0, runtimeVerification.stderr);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("unrelated intake retains runtime history without treating it as active state", () => {
  const repo = makeTempGitRepo();
  try {
    intake(repo, { taskId: "historical-runtime" });
    const fakeCodex = makeFakeCodex(repo);
    const reconciled = runCli(repo, ["reconcile-runtime", "--task-id", "historical-runtime", "--codex-binary", fakeCodex]);
    assert.equal(reconciled.status, 0, reconciled.stderr);
    assert.ok(readRuntimeEvents(repo).length > 0);

    const next = intake(repo, { taskId: "active-runtime" });
    assert.equal(next.status, 0, next.stderr);
    const context = runCli(repo, ["context", "--task-id", "active-runtime"]);
    assert.equal(context.status, 0, context.stderr);
    assert.doesNotMatch(context.stdout, /===== runtime-events =====/);
    const doctor = runCli(repo, ["doctor"]);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /runtime events 0 active, \d+ historical/);
    assert.ok(readRuntimeEvents(repo).length > 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

function intake(repo, { taskId, rootThreadId = ROOT_THREAD_ID } = {}) {
  return runCli(repo, [
    "intake", "--task", "Implement exact CAO state control", "--task-id", taskId,
    "--epoch", "e1", "--scope", "README.md", "--root-thread-id", rootThreadId,
    "--state-transition", "initialize-unrelated",
  ]);
}

function identityArgs(taskId) {
  return ["--task-id", taskId, "--epoch", "e1", "--scope", "README.md"];
}

function coverageArgs(taskId) {
  const decisions = Array.from({ length: 4 }, (_, index) => `D-${taskId}-${String(index + 1).padStart(3, "0")}`);
  const completions = Array.from({ length: 5 }, (_, index) => `C-${taskId}-${String(index + 1).padStart(3, "0")}`);
  return [
    "--decision-coverage", decisions.map((id) => `${id} verification:V-${taskId}`).join(";"),
    "--completion-coverage", completions.map((id) => `${id} verification:V-${taskId}`).join(";"),
    "--source-spec-coverage", "file:README.md",
  ];
}

function recordAcceptance(repo, taskId) {
  const ids = [
    ...Array.from({ length: 4 }, (_, index) => `D-${taskId}-${String(index + 1).padStart(3, "0")}`),
    ...Array.from({ length: 5 }, (_, index) => `C-${taskId}-${String(index + 1).padStart(3, "0")}`),
  ];
  const result = runCli(repo, [
    "verify", ...identityArgs(taskId), "--check-id", `V-${taskId}`, "--status", "passed",
    "--detail", "admitted primary path passed", "--covers", ids.join(";"),
    "--evidence-refs", "test:workflow-state result:pass",
  ]);
  assert.equal(result.status, 0, result.stderr);
}

function rootStopPayload(repo) {
  return {
    hook_event_name: "Stop",
    session_id: ROOT_THREAD_ID,
    turn_id: "turn-root",
    cwd: repo,
    model: "gpt-current",
    permission_mode: "default",
    transcript_path: null,
    stop_hook_active: false,
    last_assistant_message: "done",
  };
}

function subagentPayload(repo, hookEventName) {
  return {
    hook_event_name: hookEventName,
    session_id: CHILD_THREAD_ID,
    turn_id: "turn-child",
    agent_id: CHILD_THREAD_ID,
    agent_type: "worker",
    cwd: repo,
    model: "gpt-current",
    permission_mode: "default",
    transcript_path: null,
    agent_transcript_path: null,
    stop_hook_active: false,
    last_assistant_message: hookEventName === "SubagentStop" ? "complete" : null,
  };
}

function hook(repo, payload, codexBinary) {
  const args = ["hook-event"];
  if (codexBinary) args.push("--codex-binary", codexBinary);
  return runCli(repo, args, { input: `${JSON.stringify(payload)}\n` });
}

function readRuntimeEvents(repo) {
  const directory = path.join(repo, ".CAO", "runtime-events");
  return readdirSync(directory).filter((name) => name.endsWith(".json")).map((name) => JSON.parse(readFileSync(path.join(directory, name), "utf8")));
}

function makeFakeCodex(repo) {
  const file = path.join(repo, "fake-codex.mjs");
  writeFileSync(file, `#!/usr/bin/env node
import readline from "node:readline";
const ROOT = ${JSON.stringify(ROOT_THREAD_ID)};
const CHILD = ${JSON.stringify(CHILD_THREAD_ID)};
const rl = readline.createInterface({ input: process.stdin });
const thread = (id, turns = []) => ({ id, sessionId: id, forkedFromId: null, parentThreadId: id === CHILD ? ROOT : null, preview: "", ephemeral: false, section: null, sectionEnteredAt: null, historyMode: "legacy", modelProvider: "openai", createdAt: 1, updatedAt: 2, recencyAt: 2, status: { type: "notLoaded" }, path: null, cwd: process.cwd(), cliVersion: "test", source: id === CHILD ? { subAgent: { thread_spawn: { parent_thread_id: ROOT, depth: 1, agent_path: "/root/worker", agent_nickname: "Worker", agent_role: "worker" } } } : "appServer", canAcceptDirectInput: null, threadSource: null, agentNickname: id === CHILD ? "Worker" : null, agentRole: id === CHILD ? "worker" : null, gitInfo: null, name: null, turns });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  if (message.method === "initialize") return reply(message.id, { userAgent: "fake", codexHome: process.cwd(), platformFamily: "unix", platformOs: "macos" });
  if (message.method === "thread/list") return reply(message.id, { data: [thread(CHILD)], nextCursor: null, backwardsCursor: null });
  if (message.method === "thread/read") {
    const id = message.params.threadId;
    const turns = id === ROOT && message.params.includeTurns ? [{ id: "turn-root", status: "completed", error: null, startedAt: 1, completedAt: 2, durationMs: 1, itemsView: "full", items: [
      { type: "collabAgentToolCall", id: "collab-1", tool: "sendInput", status: "completed", senderThreadId: ROOT, receiverThreadIds: [CHILD], prompt: "private assignment", model: null, reasoningEffort: null, agentsStates: { [CHILD]: { status: "completed", message: "private result" } } },
      { type: "subAgentActivity", id: "activity-1", kind: "interacted", agentThreadId: CHILD, agentPath: "/root/worker" }
    ] }] : [];
    return reply(message.id, { thread: thread(id, turns) });
  }
  reply(message.id, {});
});
function reply(id, result) { process.stdout.write(JSON.stringify({ id, result }) + "\\n"); }
`);
  chmodSync(file, 0o755);
  return file;
}

function runCli(repo, args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args, "--target-cwd", repo], {
    cwd: repo,
    encoding: "utf8",
    timeout: 10_000,
    ...options,
  });
}

function runCliAsync(repo, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args, "--target-cwd", repo], { cwd: repo, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function readState(repo, name) {
  return readFileSync(path.join(repo, ".CAO", name), "utf8");
}

function resolveGitPathForTest(repo, gitRelativePath) {
  const result = spawnSync("git", ["rev-parse", "--git-path", gitRelativePath], { cwd: repo, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const resolved = result.stdout.trim();
  return path.isAbsolute(resolved) ? resolved : path.resolve(repo, resolved);
}

function makeTempGitRepo() {
  const repo = mkdtempSync(path.join(os.tmpdir(), "cao-state-"));
  initializeTempGitRepo(repo);
  return repo;
}

function makeTempLinkedWorktree() {
  const root = mkdtempSync(path.join(os.tmpdir(), "cao-linked-worktree-"));
  const repo = path.join(root, "repo");
  const worktree = path.join(root, "linked");
  mkdirSync(repo);
  initializeTempGitRepo(repo);
  const result = spawnSync("git", ["worktree", "add", "-qb", "linked-fixture", worktree], { cwd: repo, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return { root, repo, worktree };
}

function initializeTempGitRepo(repo) {
  spawnSync("git", ["init", "-q"], { cwd: repo });
  spawnSync("git", ["config", "user.email", "cao@example.invalid"], { cwd: repo });
  spawnSync("git", ["config", "user.name", "CAO Test"], { cwd: repo });
  writeFileSync(path.join(repo, "README.md"), "# fixture\n");
  spawnSync("git", ["add", "README.md"], { cwd: repo });
  spawnSync("git", ["commit", "-qm", "fixture"], { cwd: repo });
}
