#!/usr/bin/env node

import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";

const STATE_DIR_NAME = ".CAO";
const LEGACY_STATE_DIR_NAME = ".coding-agents";
const STATE_CONTRACT_VERSION = "semantic_state_v1";
const RUNTIME_EVENT_VERSION = "cao_runtime_event_v1";
const DELIVERY_MODE_VERSION = "delivery_mode_v1";
const ITERATIVE_DELIVERY = "ITERATIVE_DELIVERY";
const ONE_SHOT_QUALITY = "ONE_SHOT_QUALITY";
const GENERATED_START = "<!-- cao-state:start -->";
const GENERATED_END = "<!-- cao-state:end -->";
const OLD_GENERATED_START = "<!-- coding-agents-mvp:start -->";
const OLD_GENERATED_END = "<!-- coding-agents-mvp:end -->";
const REQUIRED_STATE_FILES = [
  "README.md",
  "project.md",
  "task.md",
  "todo.md",
  "decisions.md",
  "work.md",
  "audit.md",
  "handoff.md",
  "ledger.md",
];
const WORK_RESULT_STATUSES = new Set(["completed", "blocked", "failed", "interrupted"]);
const PROGRESS_STATUSES = new Set(["pending", "in_progress", "completed", "blocked"]);
const VERIFICATION_STATUSES = new Set(["passed", "failed", "skipped"]);
const TYPED_REFERENCE_FORMS =
  "file:<path>, path:<path>, artifact:<ref>, work:<id>, decision:<id>, verification:<id>, command:<command> exit:<integer>, or test:<name> result:<pass|fail|integer>";

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.command) return printHelp();
    rejectUnknownOptions(args);
    switch (args.command) {
      case "intake": return withSemanticWriteLock(args, () => intake(args));
      case "context": return context(args);
      case "hook-event": return await hookEvent(args);
      case "reconcile-runtime": return await reconcileRuntime(args);
      case "begin-work": return withSemanticWriteLock(args, () => beginWork(args));
      case "complete-work": return withSemanticWriteLock(args, () => finishWork(args, "completed"));
      case "block-work": return withSemanticWriteLock(args, () => finishWork(args, "blocked"));
      case "fail-work": return withSemanticWriteLock(args, () => finishWork(args, "failed"));
      case "interrupt-work": return withSemanticWriteLock(args, () => finishWork(args, "interrupted"));
      case "decide": return withSemanticWriteLock(args, () => decide(args));
      case "progress": return withSemanticWriteLock(args, () => progress(args));
      case "verify": return withSemanticWriteLock(args, () => verify(args));
      case "finalize": return withSemanticWriteLock(args, () => finalize(args));
      case "handoff": return handoff(args);
      case "doctor": return doctor(args);
      default: throw new CliError(`unknown command: ${args.command}`);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      parsed.help = true;
      continue;
    }
    if (!parsed.command && !token.startsWith("--")) {
      parsed.command = token;
      continue;
    }
    if (!token.startsWith("--")) throw new CliError(`unexpected argument: ${token}`);
    const key = toCamel(token.slice(2));
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new CliError(`missing value for ${token}`);
    if (Object.hasOwn(parsed, key)) throw new CliError(`duplicate option: ${token}`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toKebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const COMMON_OPTIONS = new Set(["command", "help", "targetCwd"]);
const COMMAND_OPTIONS = {
  intake: new Set(["task", "taskId", "epoch", "scope", "evidenceRef", "workType", "deliveryMode", "oneShotAuthority", "stateTransition", "rootThreadId"]),
  context: new Set(["taskId"]),
  "hook-event": new Set(["codexBinary"]),
  "reconcile-runtime": new Set(["taskId", "codexBinary"]),
  "begin-work": new Set(["taskId", "epoch", "scope", "workId", "responsibility", "objective", "expectedOutput", "actorRef"]),
  "complete-work": new Set(["taskId", "epoch", "scope", "workId", "summary", "changedPaths", "evidenceRefs", "blockers", "unresolved", "next", "actorRef"]),
  "block-work": new Set(["taskId", "epoch", "scope", "workId", "summary", "changedPaths", "evidenceRefs", "blockers", "unresolved", "next", "actorRef"]),
  "fail-work": new Set(["taskId", "epoch", "scope", "workId", "summary", "changedPaths", "evidenceRefs", "blockers", "unresolved", "next", "actorRef"]),
  "interrupt-work": new Set(["taskId", "epoch", "scope", "workId", "summary", "changedPaths", "evidenceRefs", "blockers", "unresolved", "next", "actorRef"]),
  decide: new Set(["taskId", "epoch", "scope", "decisionId", "decision", "impact", "evidenceRefs"]),
  progress: new Set(["taskId", "epoch", "scope", "itemId", "status", "summary", "evidenceRefs"]),
  verify: new Set(["taskId", "epoch", "scope", "checkId", "status", "detail", "evidenceRefs"]),
  finalize: new Set(["taskId", "epoch", "scope", "decisionCoverage", "completionCoverage", "sourceSpecCoverage"]),
  handoff: new Set(["taskId"]),
  doctor: new Set([]),
};

function rejectUnknownOptions(args) {
  const allowed = new Set([...COMMON_OPTIONS, ...(COMMAND_OPTIONS[args.command] ?? [])]);
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) throw new CliError(`unsupported option for ${args.command}: --${toKebab(key)}`);
  }
}

function intake(args) {
  const targetCwd = resolveTargetCwd(args);
  const task = requiredText(args.task, "--task");
  const taskId = identity(args.taskId, "--task-id");
  const epoch = identity(args.epoch, "--epoch");
  const scope = requiredText(args.scope, "--scope");
  const evidenceRef = args.evidenceRef ?? "none";
  if (evidenceRef !== "none") validateReferenceList(evidenceRef, "--evidence-ref");
  const workType = args.workType ?? "source-change";
  const deliveryMode = resolveDeliveryMode(args);
  const oneShotAuthority = resolveOneShotAuthority(args, deliveryMode);
  const state = prepareStateWrite(targetCwd);
  const previous = readActiveTaskIfPresent(state.stateDir);
  const rootThreadId = resolveRootThreadId(args.rootThreadId, previous?.rootThreadId);
  const inferredTransition = previous?.taskId === taskId && previous?.epoch === epoch
    ? "continue-related"
    : "initialize-unrelated";
  const stateTransition = args.stateTransition ?? inferredTransition;
  if (!new Set(["continue-related", "initialize-unrelated"]).has(stateTransition)) {
    throw new CliError("--state-transition must be continue-related or initialize-unrelated");
  }
  if (stateTransition === "continue-related" && previous && (previous.taskId !== taskId || previous.epoch !== epoch)) {
    throw new CliError("continue-related requires the active task_id and epoch");
  }
  const timestamp = new Date().toISOString();
  const value = {
    targetCwd,
    stateDir: state.stateDir,
    gitRoot: state.gitRoot,
    gitStatus: readGitStatus(targetCwd),
    task,
    taskId,
    epoch,
    scope,
    evidenceRef,
    workType,
    deliveryMode,
    oneShotAuthority,
    rootThreadId,
    stateTransition,
    timestamp,
  };
  for (const [name, body] of Object.entries(renderStateDocs(value))) {
    upsertGenerated(path.join(state.stateDir, name), body);
  }
  ensureLedger(state.stateDir);
  appendPacket(state.stateDir, "state-intake", {
    task_id: taskId,
    epoch,
    scope,
    state_transition: stateTransition,
    root_thread_id: rootThreadId,
    evidence_refs: evidenceRef,
    recorded_at: timestamp,
  });
  process.stdout.write([
    `ok intake: updated ${state.stateDir}`,
    `ok task_id: ${taskId}`,
    `ok epoch: ${epoch}`,
    `ok scope: ${scope}`,
    `ok state_transition: ${stateTransition}`,
    `ok root_thread_id: ${rootThreadId}`,
    `ok delivery_mode: ${deliveryMode}`,
    `ok state_contract_version: ${STATE_CONTRACT_VERSION}`,
    state.legacyCopied ? `hint preserved ${state.legacyDir} and copied it non-destructively to ${state.stateDir}` : null,
  ].filter(Boolean).join("\n") + "\n");
}

function context(args) {
  const state = resolveReadableState(resolveTargetCwd(args));
  const active = readActiveTask(state.stateDir);
  if (args.taskId && identity(args.taskId, "--task-id") !== active.taskId) {
    throw new CliError(`task_id mismatch: active=${active.taskId}`);
  }
  for (const name of ["task.md", "todo.md", "decisions.md", "work.md", "audit.md", "handoff.md"]) {
    const file = path.join(state.stateDir, name);
    if (!existsSync(file)) continue;
    process.stdout.write(`\n===== ${name} =====\n${readFileSync(file, "utf8").trim()}\n`);
  }
  const runtimeEvents = runtimeEventsForActiveTask(state.stateDir, active);
  if (runtimeEvents.length > 0) {
    process.stdout.write(`\n===== runtime-events =====\n${runtimeEvents.map(renderRuntimeEventLine).join("\n")}\n`);
  }
}

async function hookEvent(args) {
  const payload = await readJsonStdin();
  const eventName = requiredText(payload.hook_event_name, "hook_event_name");
  if (!["SessionStart", "SubagentStart", "SubagentStop", "Stop"].includes(eventName)) return;
  const state = findNearestState(payload.cwd);
  if (!state) return;
  const active = readActiveTask(state.stateDir);
  if (!active.rootThreadId || active.rootThreadId === "unbound") return;

  if (eventName === "SessionStart" || eventName === "Stop") {
    const bindingStatus = payload.session_id === active.rootThreadId ? "matched" : "mismatched";
    if (bindingStatus !== "matched") return;
    recordHookObservation(state.stateDir, active, payload, bindingStatus, null);
    if (eventName === "SessionStart") {
      process.stdout.write(buildStateContext(state.stateDir, active));
      return;
    }
    const reason = stopContinuationReason(state.stateDir, active);
    if (reason) process.stdout.write(`${JSON.stringify({ decision: "block", reason })}\n`);
    return;
  }

  const agentId = identity(payload.agent_id, "agent_id");
  let binding;
  try {
    binding = await resolveAgentBinding(agentId, active.rootThreadId, args.codexBinary);
  } catch (error) {
    binding = { status: "unresolved", error: singleLine(error.message), chain: [] };
  }
  if (binding.status === "mismatched") return;
  recordHookObservation(state.stateDir, active, payload, binding.status, binding);
  if (eventName === "SubagentStart" && binding.status === "matched") {
    process.stdout.write(buildStateContext(state.stateDir, active));
  }
}

async function reconcileRuntime(args) {
  const state = resolveReadableState(resolveTargetCwd(args));
  const active = readActiveTask(state.stateDir);
  if (args.taskId && identity(args.taskId, "--task-id") !== active.taskId) {
    throw new CliError(`task_id mismatch: active=${active.taskId}`);
  }
  if (!active.rootThreadId || active.rootThreadId === "unbound") {
    throw new CliError("runtime reconciliation requires a root_thread_id bound at intake");
  }
  const observations = await collectAppServerObservations(active.rootThreadId, args.codexBinary);
  let created = 0;
  let duplicate = 0;
  for (const observation of observations) {
    const event = {
      version: RUNTIME_EVENT_VERSION,
      event_key: observation.event_key,
      observed_at: new Date().toISOString(),
      source: "codex-app-server-readback",
      binding_status: "matched",
      task_id: active.taskId,
      epoch: active.epoch,
      root_thread_id: active.rootThreadId,
      observation: observation.data,
    };
    if (writeRuntimeEvent(state.stateDir, event)) created += 1;
    else duplicate += 1;
  }
  for (const agentId of unresolvedRuntimeAgentIds(state.stateDir, active)) {
    let binding;
    try {
      binding = await resolveAgentBinding(agentId, active.rootThreadId, args.codexBinary);
    } catch (error) {
      binding = { status: "unresolved", error: singleLine(error.message), chain: [] };
    }
    const resolution = {
      version: RUNTIME_EVENT_VERSION,
      event_key: `app-server:binding-resolution:${agentId}:${binding.status}`,
      observed_at: new Date().toISOString(),
      source: "codex-app-server-readback",
      binding_status: binding.status,
      task_id: active.taskId,
      epoch: active.epoch,
      root_thread_id: active.rootThreadId,
      observation: {
        kind: "binding_resolution",
        agent_id: agentId,
        thread_id: agentId,
        error: binding.error ?? null,
        chain: binding.chain,
      },
    };
    if (writeRuntimeEvent(state.stateDir, resolution)) created += 1;
    else duplicate += 1;
  }
  process.stdout.write([
    `ok runtime-reconcile: ${active.rootThreadId}`,
    `ok observations_created: ${created}`,
    `ok observations_existing: ${duplicate}`,
    "ok semantic_completion_inferred: false",
  ].join("\n") + "\n");
}

function beginWork(args) {
  const packet = activePacket(args);
  const workId = identity(args.workId, "--work-id");
  const ledger = readLedger(packet.stateDir);
  if (workRecords(ledger).has(workId)) throw new CliError(`work_id already exists: ${workId}`);
  const fields = {
    work_id: workId,
    responsibility: requiredText(args.responsibility, "--responsibility"),
    objective: requiredText(args.objective, "--objective"),
    expected_output: requiredText(args.expectedOutput, "--expected-output"),
    actor_ref: args.actorRef ?? "unknown",
    status: "open",
    task_id: packet.taskId,
    epoch: packet.epoch,
    scope: packet.scope,
    recorded_at: new Date().toISOString(),
  };
  appendPacket(packet.stateDir, "work-begin", fields);
  appendStateSection(path.join(packet.stateDir, "work.md"), `Open Work ${workId}`, fields);
  process.stdout.write(`ok work-begin: ${workId}\nok status: open\n`);
}

function finishWork(args, status) {
  if (!WORK_RESULT_STATUSES.has(status)) throw new CliError(`invalid work result status: ${status}`);
  const packet = activePacket(args);
  const workId = identity(args.workId, "--work-id");
  const records = workRecords(readLedger(packet.stateDir));
  const record = records.get(workId);
  if (!record) throw new CliError(`unknown work_id: ${workId}`);
  if (record.terminal) throw new CliError(`work_id already resolved: ${workId}`);
  const evidenceRefs = status === "completed"
    ? requiredReferences(args.evidenceRefs, "--evidence-refs")
    : (args.evidenceRefs ?? "none");
  if (evidenceRefs !== "none") validateReferenceList(evidenceRefs, "--evidence-refs");
  const blockers = args.blockers ?? "none";
  if (status === "blocked" && blockers === "none") throw new CliError("block-work requires --blockers");
  const fields = {
    work_id: workId,
    status,
    summary: requiredText(args.summary, "--summary"),
    changed_paths: args.changedPaths ?? "none",
    evidence_refs: evidenceRefs,
    blockers,
    unresolved: args.unresolved ?? "none",
    next: args.next ?? "none",
    actor_ref: args.actorRef ?? record.actorRef ?? "unknown",
    task_id: packet.taskId,
    epoch: packet.epoch,
    scope: packet.scope,
    recorded_at: new Date().toISOString(),
  };
  appendPacket(packet.stateDir, "work-result", fields);
  appendStateSection(path.join(packet.stateDir, "work.md"), `Work Result ${workId}`, fields);
  process.stdout.write(`ok work-result: ${workId}\nok status: ${status}\n`);
}

function decide(args) {
  const packet = activePacket(args);
  const decisionId = identity(args.decisionId, "--decision-id");
  rejectDuplicateField(packet.stateDir, "decision_id", decisionId);
  const fields = {
    decision_id: decisionId,
    decision: requiredText(args.decision, "--decision"),
    impact: requiredText(args.impact, "--impact"),
    evidence_refs: requiredReferences(args.evidenceRefs, "--evidence-refs"),
    task_id: packet.taskId,
    epoch: packet.epoch,
    scope: packet.scope,
    recorded_at: new Date().toISOString(),
  };
  appendPacket(packet.stateDir, "accepted-decision", fields);
  appendStateSection(path.join(packet.stateDir, "decisions.md"), `Accepted Decision ${decisionId}`, fields);
  process.stdout.write(`ok decision: ${decisionId}\n`);
}

function progress(args) {
  const packet = activePacket(args);
  const itemId = identity(args.itemId, "--item-id");
  const status = requiredText(args.status, "--status");
  if (!PROGRESS_STATUSES.has(status)) throw new CliError(`--status must be one of ${[...PROGRESS_STATUSES].join(", ")}`);
  const summary = requiredText(args.summary, "--summary");
  const evidenceRefs = status === "completed"
    ? requiredReferences(args.evidenceRefs, "--evidence-refs")
    : (args.evidenceRefs ?? "none");
  if (evidenceRefs !== "none") validateReferenceList(evidenceRefs, "--evidence-refs");
  const todoPath = path.join(packet.stateDir, "todo.md");
  const current = readFileSync(todoPath, "utf8");
  const pattern = new RegExp(`^- \\[([ x])\\] ${escapeRegExp(itemId)}(?=\\s|$)`, "m");
  if (!pattern.test(current)) throw new CliError(`unknown TODO item: ${itemId}`);
  const checked = status === "completed" ? "x" : " ";
  atomicWrite(todoPath, current.replace(pattern, `- [${checked}] ${itemId}`));
  const fields = {
    item_id: itemId,
    status,
    summary,
    evidence_refs: evidenceRefs,
    task_id: packet.taskId,
    epoch: packet.epoch,
    scope: packet.scope,
    recorded_at: new Date().toISOString(),
  };
  appendPacket(packet.stateDir, "progress-update", fields);
  appendStateSection(path.join(packet.stateDir, "work.md"), `Progress ${itemId}`, fields);
  process.stdout.write(`ok progress: ${itemId}\nok status: ${status}\n`);
}

function verify(args) {
  const packet = activePacket(args);
  const checkId = identity(args.checkId, "--check-id");
  rejectDuplicateField(packet.stateDir, "check_id", checkId);
  const status = requiredText(args.status, "--status");
  if (!VERIFICATION_STATUSES.has(status)) throw new CliError(`--status must be one of ${[...VERIFICATION_STATUSES].join(", ")}`);
  const evidenceRefs = status === "passed"
    ? requiredReferences(args.evidenceRefs, "--evidence-refs")
    : (args.evidenceRefs ?? "none");
  if (evidenceRefs !== "none") validateReferenceList(evidenceRefs, "--evidence-refs");
  const fields = {
    check_id: checkId,
    status,
    detail: requiredText(args.detail, "--detail"),
    evidence_refs: evidenceRefs,
    task_id: packet.taskId,
    epoch: packet.epoch,
    scope: packet.scope,
    recorded_at: new Date().toISOString(),
  };
  appendPacket(packet.stateDir, "verification-observation", fields);
  appendStateSection(path.join(packet.stateDir, "audit.md"), `Verification ${checkId}`, fields);
  process.stdout.write(`ok verification: ${checkId}\nok status: ${status}\n`);
}

function finalize(args) {
  const packet = activePacket(args);
  const active = readActiveTask(packet.stateDir);
  if (!active.rootThreadId || active.rootThreadId === "unbound") {
    throw new CliError("cannot finalize unbound state; intake must bind root_thread_id");
  }
  const openWork = [...workRecords(readLedger(packet.stateDir)).entries()]
    .filter(([, value]) => !value.terminal)
    .map(([workId]) => workId);
  if (openWork.length > 0) throw new CliError(`cannot finalize with open work: ${openWork.join(", ")}`);
  const unresolvedRuntime = unresolvedRuntimeAgentIds(packet.stateDir, active);
  if (unresolvedRuntime.length > 0) {
    throw new CliError(`cannot finalize with unresolved runtime ancestry: ${unresolvedRuntime.join(", ")}; run reconcile-runtime`);
  }
  const taskText = readFileSync(path.join(packet.stateDir, "task.md"), "utf8");
  const decisionIds = [...taskText.matchAll(/^- (D-[A-Za-z0-9_.-]+):/gm)].map((match) => match[1]);
  const completionIds = [...taskText.matchAll(/^- (C-[A-Za-z0-9_.-]+):/gm)].map((match) => match[1]);
  const decisionCoverage = requiredText(args.decisionCoverage, "--decision-coverage");
  const completionCoverage = requiredText(args.completionCoverage, "--completion-coverage");
  const sourceSpecCoverage = requiredReferences(args.sourceSpecCoverage, "--source-spec-coverage");
  validateCoverage(decisionCoverage, decisionIds, "decision coverage");
  validateCoverage(completionCoverage, completionIds, "completion coverage");
  const todoPath = path.join(packet.stateDir, "todo.md");
  const currentTodo = readFileSync(todoPath, "utf8");
  const completedTodo = currentTodo.replace(/^- \[ \]/gm, "- [x]");
  atomicWrite(todoPath, completedTodo);
  try {
    appendPacket(packet.stateDir, "task-finalization", {
      task_id: packet.taskId,
      epoch: packet.epoch,
      scope: packet.scope,
      status: "completed",
      decision_coverage: decisionCoverage,
      completion_coverage: completionCoverage,
      source_spec_coverage: sourceSpecCoverage,
      recorded_at: new Date().toISOString(),
    });
  } catch (error) {
    atomicWrite(todoPath, currentTodo);
    throw error;
  }
  process.stdout.write(`ok task-finalization: ${packet.taskId}\nok status: completed\n`);
}

function handoff(args) {
  const state = resolveReadableState(resolveTargetCwd(args));
  const active = readActiveTask(state.stateDir);
  const taskId = identity(args.taskId, "--task-id");
  if (taskId !== active.taskId) throw new CliError(`task_id mismatch: active=${active.taskId}`);
  process.stdout.write(readFileSync(path.join(state.stateDir, "handoff.md"), "utf8"));
}

function doctor(args) {
  const state = resolveReadableState(resolveTargetCwd(args));
  const results = [];
  let fatal = false;
  for (const name of REQUIRED_STATE_FILES) {
    if (!existsSync(path.join(state.stateDir, name))) {
      results.push(["ERROR", `missing ${name}`]);
      fatal = true;
    } else {
      results.push(["OK", name]);
    }
  }
  if (!fatal) {
    const active = readActiveTask(state.stateDir);
    results.push(["OK", `active task ${active.taskId}`]);
    if (!active.rootThreadId || active.rootThreadId === "unbound") {
      results.push(["ERROR", "active task is not bound to root_thread_id"]);
      fatal = true;
    } else {
      results.push(["OK", `root thread ${active.rootThreadId}`]);
    }
    const task = readFileSync(path.join(state.stateDir, "task.md"), "utf8");
    if (!task.includes(`state_contract_version: ${STATE_CONTRACT_VERSION}`)) {
      results.push(["ERROR", `task.md missing ${STATE_CONTRACT_VERSION}`]);
      fatal = true;
    }
    const ledger = readLedger(state.stateDir);
    if (!/^# CAO Semantic State Ledger/m.test(ledger)) {
      results.push(["ERROR", "ledger.md header is invalid"]);
      fatal = true;
    }
    const openWork = [...workRecords(ledger).entries()].filter(([, value]) => !value.terminal).map(([workId]) => workId);
    if (openWork.length > 0) results.push(["WARN", `open work: ${openWork.join(", ")}`]);
    const allRuntimeEvents = readRuntimeEvents(state.stateDir);
    const runtimeEvents = runtimeEventsForActiveTask(state.stateDir, active);
    const invalidRuntime = runtimeEvents.filter((event) => event.version !== RUNTIME_EVENT_VERSION || event.root_thread_id !== active.rootThreadId);
    if (invalidRuntime.length > 0) {
      results.push(["ERROR", `invalid runtime events: ${invalidRuntime.length}`]);
      fatal = true;
    } else {
      results.push(["OK", `runtime events ${runtimeEvents.length} active, ${allRuntimeEvents.length - runtimeEvents.length} historical`]);
    }
    const unresolvedRuntime = unresolvedRuntimeAgentIds(state.stateDir, active);
    if (unresolvedRuntime.length > 0) results.push(["WARN", `unresolved runtime ancestry: ${unresolvedRuntime.join(", ")}`]);
    if (/^- type: task-finalization$/m.test(ledger)) {
      const todo = readFileSync(path.join(state.stateDir, "todo.md"), "utf8");
      if (/^- \[ \]/m.test(todo)) {
        results.push(["ERROR", "finalized state still has incomplete TODO items"]);
        fatal = true;
      }
      if (openWork.length > 0) {
        results.push(["ERROR", "finalized state contains open work"]);
        fatal = true;
      }
    }
  }
  if (state.gitRoot) {
    const excludePath = path.join(state.gitRoot, ".git", "info", "exclude");
    const exclude = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";
    if (!hasExclude(exclude, STATE_DIR_NAME)) {
      results.push(["ERROR", `${STATE_DIR_NAME} is not locally excluded`]);
      fatal = true;
    } else {
      results.push(["OK", `${STATE_DIR_NAME} locally excluded`]);
    }
    if (isTracked(state.gitRoot, STATE_DIR_NAME)) {
      results.push(["ERROR", `${STATE_DIR_NAME} must not be tracked`]);
      fatal = true;
    }
  }
  for (const [level, message] of results) process.stdout.write(`${level} ${message}\n`);
  if (fatal) process.exit(1);
}

function resolveRootThreadId(explicit, previous) {
  const candidate = explicit ?? process.env.CODEX_THREAD_ID ?? previous ?? "unbound";
  if (candidate === "unbound") return candidate;
  return identity(candidate, "--root-thread-id");
}

function findNearestState(startCwd) {
  if (!startCwd || !existsSync(startCwd)) return null;
  let current = path.resolve(startCwd);
  for (;;) {
    const stateDir = path.join(current, STATE_DIR_NAME);
    if (existsSync(path.join(stateDir, "task.md"))) return { stateDir, targetCwd: current };
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function runtimeEventsDir(stateDir) {
  return path.join(stateDir, "runtime-events");
}

function writeRuntimeEvent(stateDir, event) {
  const directory = runtimeEventsDir(stateDir);
  mkdirSync(directory, { recursive: true });
  const digest = createHash("sha256").update(event.event_key).digest("hex");
  const file = path.join(directory, `${digest}.json`);
  try {
    writeFileSync(file, `${JSON.stringify(event, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw error;
  }
}

function readRuntimeEvents(stateDir) {
  const directory = runtimeEventsDir(stateDir);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(directory, name), "utf8")));
}

function runtimeEventsForActiveTask(stateDir, active) {
  return readRuntimeEvents(stateDir)
    .filter((event) => event.task_id === active.taskId && event.epoch === active.epoch);
}

function renderRuntimeEventLine(event) {
  const observation = event.observation ?? {};
  const hook = event.hook ?? {};
  return [
    `- ${event.observed_at}`,
    `source=${event.source}`,
    `binding=${event.binding_status}`,
    `kind=${observation.kind ?? hook.hook_event_name ?? "unknown"}`,
    `thread=${observation.thread_id ?? hook.agent_id ?? hook.session_id ?? "unknown"}`,
  ].join(" ");
}

function recordHookObservation(stateDir, active, payload, bindingStatus, binding) {
  const safeHook = {
    hook_event_name: payload.hook_event_name,
    session_id: payload.session_id ?? null,
    turn_id: payload.turn_id ?? null,
    agent_id: payload.agent_id ?? null,
    agent_type: payload.agent_type ?? null,
    cwd: payload.cwd ?? null,
    model: payload.model ?? null,
    permission_mode: payload.permission_mode ?? null,
    source: payload.source ?? null,
    transcript_path: payload.transcript_path ?? null,
    agent_transcript_path: payload.agent_transcript_path ?? null,
    last_assistant_message_present: typeof payload.last_assistant_message === "string" && payload.last_assistant_message.length > 0,
  };
  const eventKey = ["hook", safeHook.hook_event_name, safeHook.session_id, safeHook.turn_id, safeHook.agent_id].join(":");
  writeRuntimeEvent(stateDir, {
    version: RUNTIME_EVENT_VERSION,
    event_key: eventKey,
    observed_at: new Date().toISOString(),
    source: "codex-hook",
    binding_status: bindingStatus,
    task_id: active.taskId,
    epoch: active.epoch,
    root_thread_id: active.rootThreadId,
    hook: safeHook,
    ancestry: binding ? {
      status: binding.status,
      error: binding.error ?? null,
      chain: binding.chain ?? [],
    } : null,
  });
}

function buildStateContext(stateDir, active) {
  const task = readFileSync(path.join(stateDir, "task.md"), "utf8");
  const taskText = field(task, "task") ?? "unavailable";
  const decisions = [...task.matchAll(/^- (D-[A-Za-z0-9_.-]+): (.+)$/gm)]
    .map((match) => `${match[1]}: ${match[2]}`)
    .slice(0, 12);
  const openWork = [...workRecords(readLedger(stateDir)).entries()]
    .filter(([, value]) => !value.terminal)
    .map(([workId]) => workId);
  return [
    "CAO_STATE_CONTROL_ACTIVE",
    `task_id: ${active.taskId}`,
    `epoch: ${active.epoch}`,
    `root_thread_id: ${active.rootThreadId}`,
    `scope: ${active.scope}`,
    `task: ${taskText}`,
    `open_work: ${openWork.length > 0 ? openWork.join(", ") : "none"}`,
    "governing_decisions:",
    ...decisions.map((decision) => `- ${decision}`),
    "execution_contract:",
    "- Stay inside the assignment and inherited authority; do not expand scope.",
    "- Use native Codex collaboration features freely when the assignment permits; CAO does not prescribe model or topology.",
    "- Do not edit .CAO state from a descendant unless the parent explicitly assigns that state responsibility.",
    "- Return a contract-complete result or a concrete blocker with changed paths and typed evidence.",
    "- Runtime exit or completion is not semantic acceptance; the root integrates and records that decision.",
    "",
  ].join("\n");
}

function stopContinuationReason(stateDir, active) {
  const ledger = readLedger(stateDir);
  const finalized = packetBlocks(ledger).some((block) => packetField(block, "type") === "task-finalization"
    && packetField(block, "task_id") === active.taskId
    && packetField(block, "epoch") === active.epoch
    && packetField(block, "status") === "completed");
  if (finalized) return null;
  const openWork = [...workRecords(ledger).entries()]
    .filter(([, value]) => !value.terminal)
    .map(([workId]) => workId);
  const todoText = readFileSync(path.join(stateDir, "todo.md"), "utf8");
  const pendingTodo = (todoText.match(/^- \[ \]/gm) ?? []).length;
  const unresolved = unresolvedRuntimeAgentIds(stateDir, active);
  return `CAO state control: task ${active.taskId} is not finalized. open_work=${openWork.join(",") || "none"}; pending_todo=${pendingTodo}; unresolved_runtime_ancestry=${unresolved.join(",") || "none"}. Continue from .CAO and finalize only after the known contract is satisfied.`;
}

function unresolvedRuntimeAgentIds(stateDir, active) {
  const events = runtimeEventsForActiveTask(stateDir, active);
  const resolved = new Set();
  for (const event of events) {
    if (!new Set(["matched", "mismatched"]).has(event.binding_status)) continue;
    const agentId = event.hook?.agent_id ?? event.observation?.thread_id ?? event.observation?.agent_id;
    if (agentId) resolved.add(agentId);
  }
  return [...new Set(events
    .filter((event) => event.binding_status === "unresolved" && event.hook?.agent_id)
    .map((event) => event.hook.agent_id))]
    .filter((agentId) => !resolved.has(agentId));
}

async function readJsonStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  if (!text.trim()) throw new CliError("hook-event requires JSON on stdin");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CliError(`invalid hook JSON: ${error.message}`);
  }
}

async function resolveAgentBinding(agentId, rootThreadId, codexBinary) {
  return withAppServer(codexBinary, async (request) => {
    const chain = [];
    let currentId = agentId;
    for (let depth = 0; depth < 16; depth += 1) {
      const result = await request("thread/read", { threadId: currentId, includeTurns: false });
      const thread = result.thread;
      chain.push(sanitizeThread(thread));
      if (thread.id === rootThreadId) return { status: "matched", chain };
      if (!thread.parentThreadId) return { status: "mismatched", chain };
      currentId = thread.parentThreadId;
    }
    return { status: "unresolved", error: "ancestry depth exceeded 16", chain };
  });
}

function sanitizeThread(thread) {
  return {
    id: thread.id,
    parent_thread_id: thread.parentThreadId ?? null,
    forked_from_id: thread.forkedFromId ?? null,
    agent_nickname: thread.agentNickname ?? null,
    agent_role: thread.agentRole ?? null,
    status: thread.status?.type ?? "unknown",
    cwd: thread.cwd ?? null,
    source: sanitizeThreadSource(thread.source),
    created_at: thread.createdAt ?? null,
    updated_at: thread.updatedAt ?? null,
  };
}

function sanitizeThreadSource(source) {
  if (typeof source === "string" || source === null || source === undefined) return source ?? null;
  const spawnSource = source.subAgent?.thread_spawn ?? source.subagent?.thread_spawn;
  if (!spawnSource) return "subagent";
  return {
    kind: "thread_spawn",
    parent_thread_id: spawnSource.parent_thread_id ?? null,
    depth: spawnSource.depth ?? null,
    agent_path: spawnSource.agent_path ?? null,
    agent_nickname: spawnSource.agent_nickname ?? null,
    agent_role: spawnSource.agent_role ?? null,
  };
}

async function collectAppServerObservations(rootThreadId, codexBinary) {
  return withAppServer(codexBinary, async (request) => {
    const descendants = [];
    let cursor = null;
    do {
      const result = await request("thread/list", {
        ancestorThreadId: rootThreadId,
        cursor,
        limit: 100,
        sourceKinds: ["subAgent", "subAgentReview", "subAgentCompact", "subAgentThreadSpawn", "subAgentOther"],
      });
      descendants.push(...result.data);
      cursor = result.nextCursor;
    } while (cursor);

    const observations = descendants.map((thread) => ({
      event_key: `app-server:thread:${thread.id}:${thread.updatedAt}:${thread.status?.type ?? "unknown"}`,
      data: { kind: "thread", thread_id: thread.id, ...sanitizeThread(thread) },
    }));
    for (const threadId of [rootThreadId, ...descendants.map((thread) => thread.id)]) {
      const result = await request("thread/read", { threadId, includeTurns: true });
      for (const turn of result.thread.turns ?? []) {
        for (const item of turn.items ?? []) {
          const data = sanitizeCollaborationItem(item, turn.id, threadId);
          if (!data) continue;
          const transition = data.status ?? data.activity_kind ?? "observed";
          observations.push({
            event_key: `app-server:item:${threadId}:${turn.id}:${item.id}:${transition}`,
            data,
          });
        }
      }
    }
    return observations;
  });
}

function sanitizeCollaborationItem(item, turnId, owningThreadId) {
  if (item.type === "subAgentActivity") {
    return {
      kind: "subagent_activity",
      item_id: item.id,
      turn_id: turnId,
      owning_thread_id: owningThreadId,
      thread_id: item.agentThreadId,
      agent_path: item.agentPath,
      activity_kind: item.kind,
    };
  }
  if (item.type !== "collabAgentToolCall") return null;
  return {
    kind: "collaboration_tool_call",
    item_id: item.id,
    turn_id: turnId,
    owning_thread_id: owningThreadId,
    tool: item.tool,
    status: item.status,
    sender_thread_id: item.senderThreadId,
    receiver_thread_ids: item.receiverThreadIds ?? [],
    requested_model: item.model ?? null,
    requested_reasoning_effort: item.reasoningEffort ?? null,
    prompt_present: typeof item.prompt === "string" && item.prompt.length > 0,
    agents_states: Object.fromEntries(Object.entries(item.agentsStates ?? {}).map(([id, state]) => [id, state.status])),
  };
}

function resolveCodexBinary(explicit) {
  const candidates = [explicit, process.env.CAO_CODEX_BINARY, process.env.CODEX_BINARY];
  try {
    candidates.push(execFileSync("which", ["codex"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
  } catch {
    // PATH lookup is optional.
  }
  candidates.push("/Applications/ChatGPT.app/Contents/Resources/codex");
  for (const candidate of candidates.filter(Boolean)) {
    if (!candidate.includes(path.sep) || existsSync(candidate)) return candidate;
  }
  throw new CliError("Codex app-server binary not found; set CAO_CODEX_BINARY");
}

async function withAppServer(codexBinary, operation) {
  const binary = resolveCodexBinary(codexBinary);
  const child = spawn(binary, ["app-server", "--stdio"], { stdio: ["pipe", "pipe", "pipe"] });
  let buffer = "";
  let stderr = "";
  let nextId = 1;
  const pending = new Map();
  const failAll = (error) => {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  };
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", (error) => failAll(error));
  child.on("exit", (code, signal) => {
    if (pending.size > 0) failAll(new CliError(`app-server exited before response: code=${code} signal=${signal} ${singleLine(stderr)}`));
  });
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message.id === undefined || !pending.has(message.id)) continue;
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiter.reject(new CliError(`app-server ${waiter.method} failed: ${JSON.stringify(message.error)}`));
      else waiter.resolve(message.result);
    }
  });
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, method });
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
  });
  const timeout = setTimeout(() => failAll(new CliError(`app-server request timed out: ${singleLine(stderr)}`)), 10_000);
  try {
    await request("initialize", {
      clientInfo: { name: "coding-agent-orchestrator", title: "CAO State Control", version: "0.3.0" },
      capabilities: { experimentalApi: true, requestAttestation: false },
    });
    child.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
    return await operation(request);
  } finally {
    clearTimeout(timeout);
    child.stdin.end();
    child.kill();
  }
}

function withSemanticWriteLock(args, operation) {
  const targetCwd = resolveTargetCwd(args);
  const stateDir = prepareStateWrite(targetCwd).stateDir;
  const lockDir = path.join(stateDir, ".semantic-write.lock");
  const deadline = Date.now() + 5_000;
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) throw new CliError(`timed out waiting for semantic state lock: ${lockDir}`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try {
    return operation();
  } finally {
    rmdirSync(lockDir);
  }
}

function activePacket(args) {
  const state = prepareStateWrite(resolveTargetCwd(args));
  const active = readActiveTask(state.stateDir);
  const taskId = identity(args.taskId, "--task-id");
  const epoch = identity(args.epoch, "--epoch");
  const scope = requiredText(args.scope, "--scope");
  if (active.taskId !== taskId) throw new CliError(`task_id mismatch: active=${active.taskId}`);
  if (active.epoch !== epoch) throw new CliError(`epoch mismatch: active=${active.epoch}`);
  if (active.scope !== scope) throw new CliError(`scope mismatch: active=${active.scope}`);
  return { stateDir: state.stateDir, taskId, epoch, scope };
}

function workRecords(ledger) {
  const records = new Map();
  for (const block of packetBlocks(ledger)) {
    const type = packetField(block, "type");
    const workId = packetField(block, "work_id");
    if (!workId) continue;
    if (type === "work-begin") records.set(workId, { terminal: false, actorRef: packetField(block, "actor_ref") });
    if (type === "work-result" && records.has(workId)) records.get(workId).terminal = true;
  }
  return records;
}

function packetBlocks(ledger) {
  return ledger.split(/(?=^- type: )/m).filter((block) => /^- type: /m.test(block));
}

function packetField(block, name) {
  const match = block.match(new RegExp(`^- ${escapeRegExp(name)}: (.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

function rejectDuplicateField(stateDir, name, value) {
  const pattern = new RegExp(`^- ${escapeRegExp(name)}: ${escapeRegExp(value)}$`, "m");
  if (pattern.test(readLedger(stateDir))) throw new CliError(`duplicate ${name}: ${value}`);
}

function resolveDeliveryMode(args) {
  const mode = args.deliveryMode ?? ITERATIVE_DELIVERY;
  if (![ITERATIVE_DELIVERY, ONE_SHOT_QUALITY].includes(mode)) {
    throw new CliError(`--delivery-mode must be ${ITERATIVE_DELIVERY} or ${ONE_SHOT_QUALITY}`);
  }
  return mode;
}

function resolveOneShotAuthority(args, deliveryMode) {
  const authority = args.oneShotAuthority ?? "none";
  if (deliveryMode === ONE_SHOT_QUALITY && !/^user_request:\S+/.test(authority)) {
    throw new CliError("ONE_SHOT_QUALITY requires --one-shot-authority user_request:<task-local-ref>");
  }
  if (deliveryMode === ITERATIVE_DELIVERY && authority !== "none") {
    throw new CliError("ITERATIVE_DELIVERY requires one_shot_authority=none");
  }
  return authority;
}

function renderStateDocs(value) {
  const completion = completionConditions(value);
  const decisions = governingDecisions(value);
  const modeText = value.deliveryMode === ONE_SHOT_QUALITY
    ? "The declared task-local one-shot slice must be complete before native Codex reports acceptance."
    : "The declared iterative slice must be a complete usable first acceptance candidate; optional hardening remains outside this task.";
  return {
    "README.md": `# CAO Durable State\n\nRead these files in order:\n\n1. \`project.md\` — resolved jobsite, root-thread binding, and lineage.\n2. \`task.md\` — current task facts and completion contract.\n3. \`todo.md\` — durable progress.\n4. \`decisions.md\` — accepted decisions and impact.\n5. \`work.md\` — open and resolved semantic work transactions.\n6. \`audit.md\` — typed evidence and unresolved boundaries.\n7. \`handoff.md\` — exact continuation input.\n8. \`ledger.md\` — append-only semantic state transitions.\n9. \`runtime-events/\` — idempotent official Hook and app-server observations; runtime status never proves semantic completion.\n\nNative Codex owns execution. CAO owns durable state, exact session-tree binding, and known-work closure; it does not prescribe runtime topology.`,
    "project.md": `# Project Intake\n\n- target_cwd: ${value.targetCwd}\n- state_dir: ${value.stateDir}\n- git_root: ${value.gitRoot ?? "unavailable"}\n- git_status: ${value.gitStatus}\n- task_id: ${value.taskId}\n- epoch: ${value.epoch}\n- root_thread_id: ${value.rootThreadId}\n- scope: ${value.scope}\n- evidence_ref: ${value.evidenceRef}\n- state_transition: ${value.stateTransition}`,
    "task.md": `# Active Task\n\n- task_id: ${value.taskId}\n- epoch: ${value.epoch}\n- root_thread_id: ${value.rootThreadId}\n- scope: ${value.scope}\n- evidence_ref: ${value.evidenceRef}\n- work_type: ${value.workType}\n- delivery_mode_contract_version: ${DELIVERY_MODE_VERSION}\n- delivery_mode: ${value.deliveryMode}\n- one_shot_authority: ${value.oneShotAuthority}\n- state_contract_version: ${STATE_CONTRACT_VERSION}\n- runtime_event_contract_version: ${RUNTIME_EVENT_VERSION}\n- state_contract_effective_at: ${value.timestamp}\n- task: ${value.task}\n\n## Native Execution Boundary\n\n- Native Codex owns decomposition, subagent use, model and reasoning selection, spawn or fork, cross-agent messaging, recursive delegation, live supervision, integration, and task acceptance.\n- CAO never launches workers and never reduces a collaborative agent to a leaf contract.\n- Official SessionStart, SubagentStart, SubagentStop, and Stop hooks provide immediate state rehydration, descendant context injection, lifecycle observation, and premature-stop enforcement only for the exact bound root thread tree.\n- Official app-server thread/read and thread/list data reconcile ancestry and collaboration activity after missed or concurrent events.\n- Hook and app-server observations are runtime facts only. They never convert agent exit, idle state, or tool-call completion into semantic progress or task completion.\n- CAO requires a durable work-begin transaction before material work and one terminal work-result transaction after native integration.\n- CAO records task facts, decisions, progress, typed evidence, blockers, unresolved work, finalization, and handoff.\n\n## Delivery Contract\n\n- ${modeText}\n\n## Governing Decisions\n\n${decisions.map(({ id, text }) => `- ${id}: ${text}`).join("\n")}\n\n## Completion Conditions\n\n${completion.map(({ id, text }) => `- ${id}: ${text}`).join("\n")}`,
    "todo.md": `# TODO\n\n- [x] ${value.taskId}.1 Intake current task facts and governing specifications.\n- [x] ${value.taskId}.2 Expose accepted decisions, scope, constraints, completion conditions, evidence, and safe resume state.\n- [ ] ${value.taskId}.3 Record material work through begin and terminal result transactions.\n- [ ] ${value.taskId}.4 Record the sealed acceptance evidence and unresolved boundaries.\n- [ ] ${value.taskId}.5 Finalize the durable state and handoff.`,
    "decisions.md": `# Decisions\n\n${decisions.map(({ id, text }) => `## ${id}\n\n- accepted: ${text}`).join("\n\n")}`,
    "work.md": `# Durable Work Transactions\n\n- Every material responsibility receives one work-begin record before execution and exactly one completed, blocked, failed, or interrupted result after native integration.\n- Optional actor references are opaque identifiers; they do not prove model, ancestry, liveness, capability, or thread closure.\n- Raw worker transcripts are not durable state. Record only semantic integration material.`,
    "audit.md": `# Audit\n\n## Intake\n\n- status: ok\n- recorded_at: ${value.timestamp}\n- task_id: ${value.taskId}\n- epoch: ${value.epoch}\n- scope: ${value.scope}\n- evidence_ref: ${value.evidenceRef}\n\n## Pending Acceptance\n\n- Native Codex supplies the task acceptance decision and the minimum admitted evidence.\n- CAO verifies identity, open-work closure, typed-reference coverage, durable progress, and finalization consistency; it does not create semantic acceptance requirements.\n- Record skipped checks and unresolved boundaries without converting them into success.`,
    "handoff.md": `# Durable Handoff\n\nContinue task \`${value.taskId}\` at epoch \`${value.epoch}\`.\n\n- target_cwd: ${value.targetCwd}\n- root_thread_id: ${value.rootThreadId}\n- task: ${value.task}\n- scope: ${value.scope}\n- evidence_ref: ${value.evidenceRef}\n- delivery_mode: ${value.deliveryMode}\n\nRead \`${STATE_DIR_NAME}/task.md\`, \`todo.md\`, \`decisions.md\`, \`work.md\`, \`audit.md\`, \`ledger.md\`, and \`runtime-events/\`. Use semantic state as the completion authority and runtime events only as execution observations. Native Codex independently chooses its current execution topology and tools. Surround each material responsibility with CAO begin-work and a terminal work result, then record accepted decisions, progress, and verification evidence. Stop before scope expansion, destructive work, external writes, authentication, activation, publication, or any other action outside current authority.`,
  };
}

function governingDecisions(value) {
  return [
    { id: `D-${value.taskId}-001`, text: `Complete the declared task under task_id=${value.taskId}, epoch=${value.epoch}, and scope=${value.scope}.` },
    { id: `D-${value.taskId}-002`, text: "Native Codex exclusively owns live coding execution and task acceptance; CAO does not own or constrain runtime topology." },
    { id: `D-${value.taskId}-003`, text: `CAO binds state to root_thread_id=${value.rootThreadId}; official Hooks trigger immediate rehydration and lifecycle observation, and official app-server readback reconciles ancestry and collaboration events.` },
    { id: `D-${value.taskId}-004`, text: "CAO exclusively owns deterministic durable state under .CAO, accepts legacy .coding-agents only as non-destructive migration input, and keeps runtime observations separate from semantic completion." },
    { id: `D-${value.taskId}-005`, text: "Every material responsibility is opened before execution and resolved exactly once; finalization fails while work or runtime ancestry remains unresolved." },
    { id: `D-${value.taskId}-006`, text: `Use delivery_mode=${value.deliveryMode}; finalization requires typed evidence for every active decision, completion condition, and source/spec boundary.` },
  ];
}

function completionConditions(value) {
  return [
    { id: `C-${value.taskId}-001`, text: `The first acceptance candidate completes the declared ${value.deliveryMode === ONE_SHOT_QUALITY ? "one-shot" : "iterative"} slice: ${value.task}` },
    { id: `C-${value.taskId}-002`, text: "Native Codex retained ownership of decomposition, agent and model use, messaging, recursive delegation, supervision, integration, and acceptance; CAO recorded only durable semantic state." },
    { id: `C-${value.taskId}-003`, text: "Matching root and descendant starts receive current .CAO constraints; root premature stop is blocked by known unresolved state without inventing a new review requirement." },
    { id: `C-${value.taskId}-004`, text: "Official Hook and app-server observations preserve exact thread identity, ancestry, coordination tool, and lifecycle facts without treating runtime completion as semantic completion." },
    { id: `C-${value.taskId}-005`, text: "Every recorded material work transaction has exactly one terminal semantic result and no work or runtime ancestry remains unresolved." },
    { id: `C-${value.taskId}-006`, text: "The minimum admitted primary-path verification passes and every observed release-critical defect is resolved or recorded as blocking." },
    { id: `C-${value.taskId}-007`, text: "Source, state, cache/runtime, external-effect, and Git boundaries are preserved or explicitly reported." },
    { id: `C-${value.taskId}-008`, text: "Finalization maps every active decision, completion condition, and source/spec boundary to deterministic typed evidence, and doctor passes." },
  ];
}

function upsertGenerated(file, body) {
  const wrapped = `${GENERATED_START}\n${body.trim()}\n${GENERATED_END}`;
  if (!existsSync(file)) {
    writeFileSync(file, `${wrapped}\n`, "utf8");
    return;
  }
  const current = readFileSync(file, "utf8");
  const replacement = replaceMarkedSection(current, GENERATED_START, GENERATED_END, wrapped)
    ?? replaceMarkedSection(current, OLD_GENERATED_START, OLD_GENERATED_END, wrapped);
  writeFileSync(file, `${(replacement ?? `${wrapped}\n\n${current.trim()}`).trim()}\n`, "utf8");
}

function replaceMarkedSection(text, start, end, replacement) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);
  if (startIndex < 0 || endIndex < startIndex) return null;
  return `${text.slice(0, startIndex)}${replacement}${text.slice(endIndex + end.length)}`;
}

function ensureLedger(stateDir) {
  const file = path.join(stateDir, "ledger.md");
  if (!existsSync(file)) writeFileSync(file, "# CAO Semantic State Ledger\n\n", "utf8");
}

function readLedger(stateDir) {
  ensureLedger(stateDir);
  return readFileSync(path.join(stateDir, "ledger.md"), "utf8");
}

function appendPacket(stateDir, type, fields) {
  ensureLedger(stateDir);
  const lines = ["", `- type: ${singleLine(type)}`];
  for (const [key, value] of Object.entries(fields)) lines.push(`- ${key}: ${singleLine(value)}`);
  appendFileSync(path.join(stateDir, "ledger.md"), `${lines.join("\n")}\n`, "utf8");
}

function appendStateSection(file, heading, fields) {
  const lines = ["", `## ${singleLine(heading)}`, ""];
  for (const [key, value] of Object.entries(fields)) lines.push(`- ${key}: ${singleLine(value)}`);
  appendFileSync(file, `${lines.join("\n")}\n`, "utf8");
}

function validateCoverage(text, ids, label) {
  if (ids.length === 0) throw new CliError(`no active IDs found for ${label}`);
  const clauses = text.split(";").map((value) => value.trim()).filter(Boolean);
  for (const id of ids) {
    const clause = clauses.find((value) => value.includes(id));
    if (!clause) throw new CliError(`${label} missing ${id}`);
    if (!containsTypedReference(clause)) throw new CliError(`${label} for ${id} lacks typed evidence`);
  }
}

function requiredReferences(value, flag) {
  const text = requiredText(value, flag);
  validateReferenceList(text, flag);
  return text;
}

function validateReferenceList(text, flag) {
  const refs = text.split(";").map((value) => value.trim()).filter(Boolean);
  if (refs.length === 0 || refs.some((ref) => !containsTypedReference(ref))) {
    throw new CliError(`${flag} must use typed references (${TYPED_REFERENCE_FORMS})`);
  }
}

function containsTypedReference(value) {
  return /(?:^|\s)(?:file|path|artifact|work|decision|verification):\S+/u.test(value)
    || /(?:^|\s)command:.+\sexit:-?\d+(?:\s|$)/u.test(value)
    || /(?:^|\s)test:.+\sresult:(?:pass|fail|-?\d+)(?:\s|$)/u.test(value);
}

function readActiveTask(stateDir) {
  const result = readActiveTaskIfPresent(stateDir);
  if (!result) throw new CliError(`missing or invalid active task: ${path.join(stateDir, "task.md")}`);
  return result;
}

function readActiveTaskIfPresent(stateDir) {
  const file = path.join(stateDir, "task.md");
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const taskId = field(text, "task_id");
  const epoch = field(text, "epoch");
  const scope = field(text, "scope");
  const rootThreadId = field(text, "root_thread_id") ?? "unbound";
  return taskId && epoch && scope ? { taskId, epoch, scope, rootThreadId } : null;
}

function field(text, name) {
  const match = text.match(new RegExp(`^- ${escapeRegExp(name)}: (.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

function resolveTargetCwd(args) {
  const target = path.resolve(args.targetCwd ?? process.cwd());
  if (!existsSync(target) || !statSync(target).isDirectory()) throw new CliError(`invalid target cwd: ${target}`);
  return target;
}

function resolveReadableState(targetCwd) {
  const stateDir = path.join(targetCwd, STATE_DIR_NAME);
  const legacyDir = path.join(targetCwd, LEGACY_STATE_DIR_NAME);
  if (existsSync(stateDir)) return { stateDir, legacy: false, gitRoot: findGitRoot(targetCwd) };
  if (existsSync(legacyDir)) return { stateDir: legacyDir, legacy: true, gitRoot: findGitRoot(targetCwd) };
  throw new CliError(`missing workflow state: ${stateDir}`);
}

function prepareStateWrite(targetCwd) {
  const stateDir = path.join(targetCwd, STATE_DIR_NAME);
  const legacyDir = path.join(targetCwd, LEGACY_STATE_DIR_NAME);
  const gitRoot = findGitRoot(targetCwd);
  let legacyCopied = false;
  if (!existsSync(stateDir) && existsSync(legacyDir)) {
    cpSync(legacyDir, stateDir, { recursive: true, errorOnExist: true });
    legacyCopied = true;
  }
  mkdirSync(stateDir, { recursive: true });
  if (gitRoot) {
    if (isTracked(gitRoot, STATE_DIR_NAME)) throw new CliError(`${STATE_DIR_NAME} is tracked; state writes require untracked local state`);
    ensureLocalExclude(gitRoot, STATE_DIR_NAME);
    if (existsSync(legacyDir)) ensureLocalExclude(gitRoot, LEGACY_STATE_DIR_NAME);
  }
  return { stateDir, legacyDir, gitRoot, legacyCopied };
}

function findGitRoot(targetCwd) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: targetCwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

function readGitStatus(targetCwd) {
  try {
    return execFileSync("git", ["status", "--short"], { cwd: targetCwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "clean";
  } catch {
    return "unavailable";
  }
}

function isTracked(gitRoot, name) {
  try {
    return execFileSync("git", ["ls-files", "--", name], { cwd: gitRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().length > 0;
  } catch {
    return false;
  }
}

function ensureLocalExclude(gitRoot, name) {
  const infoDir = path.join(gitRoot, ".git", "info");
  const excludePath = path.join(infoDir, "exclude");
  mkdirSync(infoDir, { recursive: true });
  const current = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";
  if (hasExclude(current, name)) return;
  const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
  appendFileSync(excludePath, `${prefix}/${name}/\n`, "utf8");
}

function hasExclude(text, name) {
  return text.split(/\r?\n/).some((line) => [name, `${name}/`, `/${name}`, `/${name}/`].includes(line.trim()));
}

function atomicWrite(file, text) {
  const temporary = `${file}.tmp-${process.pid}`;
  try {
    writeFileSync(temporary, text, "utf8");
    renameSync(temporary, file);
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

function requiredText(value, flag) {
  if (value === undefined || value === null || !String(value).trim()) throw new CliError(`missing ${flag}`);
  return singleLine(value);
}

function identity(value, flag) {
  const result = requiredText(value, flag);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(result)) throw new CliError(`${flag} contains invalid characters`);
  return result;
}

function singleLine(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function printHelp() {
  process.stdout.write(`coding-agents durable state-control CLI\n\nUsage:\n  coding-agents intake --target-cwd <path> --task <text> --task-id <id> --epoch <id> --scope <text> [--root-thread-id <id>] [--evidence-ref <typed-ref>] [--state-transition continue-related|initialize-unrelated] [--work-type <type>] [--delivery-mode ITERATIVE_DELIVERY|ONE_SHOT_QUALITY] [--one-shot-authority user_request:<ref>]\n  coding-agents context --target-cwd <path> [--task-id <id>]\n  coding-agents hook-event [--codex-binary <path>] < hook-event.json\n  coding-agents reconcile-runtime --target-cwd <path> [--task-id <id>] [--codex-binary <path>]\n  coding-agents begin-work --target-cwd <path> --task-id <id> --epoch <id> --scope <text> --work-id <id> --responsibility <text> --objective <text> --expected-output <text> [--actor-ref <opaque-ref>]\n  coding-agents complete-work|block-work|fail-work|interrupt-work --target-cwd <path> --task-id <id> --epoch <id> --scope <text> --work-id <id> --summary <text> [--changed-paths <text>] [--evidence-refs <typed-refs>] [--blockers <text>] [--unresolved <text>] [--next <text>] [--actor-ref <opaque-ref>]\n  coding-agents decide --target-cwd <path> --task-id <id> --epoch <id> --scope <text> --decision-id <id> --decision <text> --impact <text> --evidence-refs <typed-refs>\n  coding-agents progress --target-cwd <path> --task-id <id> --epoch <id> --scope <text> --item-id <id> --status pending|in_progress|completed|blocked --summary <text> [--evidence-refs <typed-refs>]\n  coding-agents verify --target-cwd <path> --task-id <id> --epoch <id> --scope <text> --check-id <id> --status passed|failed|skipped --detail <text> [--evidence-refs <typed-refs>]\n  coding-agents finalize --target-cwd <path> --task-id <id> --epoch <id> --scope <text> --decision-coverage <text> --completion-coverage <text> --source-spec-coverage <typed-refs>\n  coding-agents handoff --target-cwd <path> --task-id <id>\n  coding-agents doctor --target-cwd <path>\n\nNative Codex owns live execution. CAO owns exact root-tree binding, deterministic semantic state, known-work closure, Hook triggers, and app-server reconciliation. Runtime completion never implies semantic completion.\n`);
}

await main();
