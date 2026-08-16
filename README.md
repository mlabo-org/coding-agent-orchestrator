# Coding Agent Orchestrator

[日本語](README.ja.md) | English

Coding Agent Orchestrator (CAO) is the plugin that provides higher-level control and durable records for Agents and native orchestration during coding. “Orchestrator” in the name describes this supervisory control plane: CAO anchors the objective, scope, decisions, work state, runtime observations, evidence, and handoff while native Codex performs the actual orchestration.

CAO does not launch, select, or route subagents. Native Codex owns decomposition, models and reasoning, spawn and fork behavior, recursive delegation, peer messaging, live supervision, integration, and acceptance. CAO keeps that changing execution topology bound to one durable contract.

## Activation

CAO activates only through a leading `CAO` / `CAOで` request, `$coding-agent-orchestrator`, explicit skill selection, or explicit continuation of an active CAO task. Generic coding, generic subagent requests, incidental “CAO” text, and `.CAO/` presence alone do not activate it.

## State control

- `.CAO/` is the current task-state SSOT. Legacy `.coding-agents/` remains non-destructive migration input.
- `intake` binds `task_id`, `epoch`, and `scope` to the exact `root_thread_id` (normally `CODEX_THREAD_ID`), preventing old repository state from controlling another session.
- Every material responsibility has one `begin-work` transaction and exactly one completed, blocked, failed, or interrupted result.
- Decisions, progress, typed evidence, runtime observations, finalization, and handoff remain separate.
- `verify --covers` names the active decision and completion IDs supported by a passed check. `finalize` accepts only passed verifications explicitly covering every active contract ID, with all work closed, ancestry resolved, and existing source/spec paths named.

## Hook-based control

The public plugin bundle includes `hooks/hooks.json` and `scripts/cao-state-hook.mjs`. Each registered command Hook calls the bundled runner through `${PLUGIN_ROOT}`, which forwards the event to `coding-agents hook-event`. Hooks locate the nearest `.CAO/` and act only when the event belongs to its exact bound root-thread tree.

| Hook | Identity check | Effect |
| --- | --- | --- |
| `SessionStart` | `session_id` equals the bound root | Rehydrates compact task context after start, resume, clear, or compaction. Other sessions receive nothing. |
| `SubagentStart` | Official app-server `thread/read` ancestry reaches the bound root | Records lifecycle metadata and injects task, scope, decisions, open work, authority, and execution boundaries into that descendant. |
| `SubagentStop` | Same official ancestry check | Records the stop observation. It never closes semantic work or means the parent accepted the result. |
| `Stop` | `session_id` equals the bound root | Blocks root termination only while known CAO work is unfinished: not finalized, open work, pending TODOs, or unresolved ancestry. Finalized work passes without another review. |

### Exact-thread, fail-closed behavior

- Mismatched root sessions and descendants outside the bound tree get no context, state mutation, or stop control.
- Descendants are identified by official ancestry, not `cwd`, nickname, or an actor label.
- If ancestry cannot be resolved within the bounded parent chain, the event is recorded as `unresolved`, no state is injected, and reconciliation is required before finalization.
- Hook observations are idempotent JSON under `.CAO/runtime-events/`; repeated delivery does not duplicate semantic work.

### Injected context

A matching `SessionStart` or `SubagentStart` emits compact `CAO_STATE_CONTROL_ACTIVE` context: task identity, root thread, scope, open work, governing decisions, inherited authority, and execution rules. It permits native Codex collaboration when the assignment permits it, tells descendants not to edit `.CAO` unless assigned that responsibility, and states that runtime exit is not semantic acceptance. It does not prescribe models, hierarchy, delegation depth, or topology.

### Runtime reconciliation and privacy

`reconcile-runtime` complements immediate Hooks by reading official app-server `thread/list` and `thread/read` data for the exact root tree. It recovers missed or concurrent observations, resolves ancestry where possible, reports incomplete lifecycle threads, and emits a typed `runtime:<event-key>` receipt with `semantic_completion_inferred: false`.

CAO does not copy raw prompts or assistant messages into runtime events. Hook records keep lifecycle metadata and only whether a last assistant message existed. Reconciliation keeps structural collaboration facts—tool, sender, receivers, status, and presence of prompt or result—without storing their bodies. Agent stop, idle thread state, and tool completion never become semantic progress, verification, or acceptance.

## Durable state layout

| Path | Purpose |
| --- | --- |
| `.CAO/project.md` | Workspace, Git state, task identity, root binding, lineage |
| `.CAO/task.md` | Active task, scope, delivery mode, decisions, completion contract |
| `.CAO/todo.md` | Durable progress |
| `.CAO/decisions.md` | Accepted decisions and impact |
| `.CAO/work.md` | Semantic work transactions |
| `.CAO/audit.md` | Typed evidence and unresolved boundaries |
| `.CAO/handoff.md` | Exact continuation state; `status: completed` after finalization |
| `.CAO/ledger.md` | Append-only semantic transitions |
| `.CAO/runtime-events/` | Idempotent Hook and app-server observations |

CAO adds `.CAO/` to the target repository’s `.git/info/exclude`, keeping local task state out of version control without changing tracked `.gitignore`.

## Typical workflow

1. `intake` the task and bind its root thread.
2. Read `context`; open each material responsibility with `begin-work`.
3. Let native Codex execute and integrate the work.
4. Record one terminal result per work ID and any factual decisions or progress.
5. Record the sealed acceptance evidence with `verify --covers`.
6. After collaboration or unresolved Hook ancestry, run `reconcile-runtime`.
7. `finalize` with complete decision, completion, and source/spec coverage.
8. Run `doctor`, then read the completed `handoff`.

## CLI

```text
coding-agents intake
coding-agents context
coding-agents begin-work
coding-agents complete-work | block-work | fail-work | interrupt-work
coding-agents decide
coding-agents progress
coding-agents verify
coding-agents reconcile-runtime
coding-agents finalize
coding-agents handoff
coding-agents doctor
```

`hook-event` is the internal Hook entrypoint, not a worker runner. Run `coding-agents --help` for full arguments.

## Agent-installable public bundle

Clone the public repository to the canonical personal-plugin location:

```bash
git clone https://github.com/mlabo-org/coding-agent-orchestrator.git ~/plugins/coding-agent-orchestrator
cd ~/plugins/coding-agent-orchestrator
npm test
npm run plugin:install:check
npm run plugin:install
```

The read-only check verifies the manifest, skill, CLI, `hooks/hooks.json`, Hook runner, all four Hook events, canonical source path, Node version, and marketplace plan. Installation preserves unrelated personal-marketplace entries, registers the complete checkout, invokes official `codex plugin add`, and verifies the installed name and version. It never patches the installed cache or installs Hooks separately.

Restart Codex after installation. Review/trust the bundled Hooks if prompted, then verify CAO from a fresh task. Source editing, installation/cache materialization, Hook review/trust, activation, commit, and publication are separate boundaries. See [the agent installation contract](docs/INSTALL_FOR_CODEX.md).

## Verification

```bash
npm test
```

The suite covers identity binding, typed evidence, finalization coverage, concurrent state writes, root and descendant Hooks, app-server reconciliation, prompt exclusion, migration, routing metadata, Git exclusion, and complete-bundle installation planning.
