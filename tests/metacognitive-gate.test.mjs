import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(REPO_ROOT, "bin", "coding-agents.mjs");

test("semantic writes reject task, epoch, and scope mismatches", () => {
  const repo = fixture("identity-state");
  try {
    for (const [flag, value, expected] of [
      ["--task-id", "wrong", /task_id mismatch/],
      ["--epoch", "wrong", /epoch mismatch/],
      ["--scope", "wrong", /scope mismatch/],
    ]) {
      const args = ["begin-work", "--task-id", "identity-state", "--epoch", "e1", "--scope", "README.md", "--work-id", `W-${flag}`, "--responsibility", "owner", "--objective", "do work", "--expected-output", "result"];
      args[args.indexOf(flag) + 1] = value;
      const result = run(repo, args);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expected);
    }
    assert.doesNotMatch(readFileSync(path.join(repo, ".CAO", "ledger.md"), "utf8"), /work-begin/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("completed semantic work requires typed evidence while blocked work preserves its blocker", () => {
  const repo = fixture("typed-evidence");
  try {
    assert.equal(run(repo, beginArgs("typed-evidence", "W-complete")).status, 0);
    const weak = run(repo, ["complete-work", ...identity("typed-evidence"), "--work-id", "W-complete", "--summary", "done", "--evidence-refs", "checked carefully"]);
    assert.notEqual(weak.status, 0);
    assert.match(weak.stderr, /must use typed references/);
    const accepted = run(repo, ["complete-work", ...identity("typed-evidence"), "--work-id", "W-complete", "--summary", "done", "--evidence-refs", "command:node --check bin/coding-agents.mjs exit:0"]);
    assert.equal(accepted.status, 0, accepted.stderr);

    assert.equal(run(repo, beginArgs("typed-evidence", "W-blocked")).status, 0);
    const missingBlocker = run(repo, ["block-work", ...identity("typed-evidence"), "--work-id", "W-blocked", "--summary", "cannot proceed"]);
    assert.notEqual(missingBlocker.status, 0);
    const blocked = run(repo, ["block-work", ...identity("typed-evidence"), "--work-id", "W-blocked", "--summary", "cannot proceed", "--blockers", "external authority required"]);
    assert.equal(blocked.status, 0, blocked.stderr);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("finalization coverage is sealed against every active decision and completion condition", () => {
  const repo = fixture("coverage-state");
  try {
    const missing = run(repo, [
      "finalize", ...identity("coverage-state"),
      "--decision-coverage", "D-coverage-state-001 file:.CAO/task.md",
      "--completion-coverage", "C-coverage-state-001 test:focused result:pass",
      "--source-spec-coverage", "file:bin/coding-agents.mjs",
    ]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /decision coverage missing D-coverage-state-002/);
    assert.match(readFileSync(path.join(repo, ".CAO", "todo.md"), "utf8"), /^- \[ \]/m);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

function fixture(taskId) {
  const repo = mkdtempSync(path.join(os.tmpdir(), "cao-integrity-"));
  spawnSync("git", ["init", "-q"], { cwd: repo });
  writeFileSync(path.join(repo, "README.md"), "# fixture\n");
  const intake = run(repo, ["intake", "--task", "Maintain exact state", "--task-id", taskId, "--epoch", "e1", "--scope", "README.md", "--root-thread-id", "01911111-1111-7111-8111-111111111111", "--state-transition", "initialize-unrelated"]);
  assert.equal(intake.status, 0, intake.stderr);
  return repo;
}

function identity(taskId) {
  return ["--task-id", taskId, "--epoch", "e1", "--scope", "README.md"];
}

function beginArgs(taskId, workId) {
  return ["begin-work", ...identity(taskId), "--work-id", workId, "--responsibility", "owner", "--objective", "do work", "--expected-output", "complete result"];
}

function run(repo, args) {
  return spawnSync(process.execPath, [CLI, ...args, "--target-cwd", repo], { cwd: repo, encoding: "utf8", timeout: 10_000 });
}
