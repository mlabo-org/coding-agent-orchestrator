# Coding Agent Orchestrator State-Control And GUI-Subagent Specification

This specification defines the active CAO architecture. It replaces the optional-context-only design introduced by `1edad13` and restores `.CAO/` as the workflow state SSOT while retaining official GUI Codex subagents as the sole worker-execution route.

## 1. Activation Boundary

CAO activates only for a coding objective explicitly selected through a leading uppercase `CAO` invocation, `CAOで`, `CAO:`, `$coding-agent-orchestrator`, explicit skill selection, or an explicit request for the Coding Agent Orchestrator workflow. Generic coding, plugin inspection, discovery, incidental mentions, and state-directory presence do not activate it.

## 2. Required State Plane

Every activated workflow resolves or creates `<jobsite>/.CAO/` before production or delegation. That directory is the inspectable SSOT for task identity, epoch, scope, accepted decisions, TODO state, dynamic-role contracts, issued assignments, collected results, lifecycle disposition, audit evidence, finalization, and handoff.

Related requests preserve the active lineage and completed progress. Clearly unrelated work receives a fresh task ID and epoch while historical runner packets remain available. State is excluded locally through `.git/info/exclude` unless the user explicitly requests tracked records.

Legacy `.coding-agents/` remains an accepted input boundary. If `.CAO/` is absent, read-only operations use the legacy directory directly. Before the first mutation, the CLI copies the complete legacy directory to `.CAO/`, preserves the original, excludes both paths locally, and makes `.CAO/` authoritative. If both directories already exist, `.CAO/` wins without merging.

The CLI in `bin/coding-agents.mjs` is the executable owner of state structure and transitions. It may create, normalize, validate, append, collect, and finalize state. It may not launch workers or manage runtime threads.

## 3. Execution Plane

Official Codex collaboration tools are the only worker-execution surface. The parent uses `spawn_agent`, `wait_agent`, `send_message`, `followup_task`, `interrupt_agent`, and `list_agents` according to their exposed contracts. External Codex processes, hidden runners, and the state CLI never substitute for this surface.

If collaboration tools are unavailable, the workflow stops with current state preserved. Parent-only fallback is not completion of a user-selected CAO workflow unless the user separately authorizes that change.

## 4. Dynamic Responsibilities

CAO has no predefined roster, fixed role count, or role-name allowlist. The parent derives a responsibility name from the actual objective and records it only when the work is independently completable, exclusively owned, ready, sufficiently large, and useful to the critical path.

The parent owns decomposition, dependencies, scheduling, authority, safety, worker profile selection, state consistency, conflict resolution, integration, task acceptance, and reporting. Each worker owns one bounded output end to end. Simultaneous workers never share source ownership.

## 5. State Transitions

The normal transition is:

`intake or related continuation -> assign packet -> official spawn -> collect packet -> integration -> task acceptance bundle -> finalize -> verify-assignments and doctor -> handoff`

Before spawning, `assign` records the dynamic role, task identity, scope, expected output, model-neutral capability requirements, ambiguity, consequence, coupling, acceptance characteristics, hierarchy grant, and supervision contract.

After a terminal worker result, `collect` records actual status, findings, changed paths, evidence, blockers, assumptions, next action, and exactly one workflow-state lifecycle disposition. State does not claim runtime-thread closure.

`finalize` requires concrete typed evidence for active decisions, completion conditions, and source/spec coverage. It updates active TODO completion and appends the task-finalization packet atomically or restores the prior TODO bytes on failure.

## 6. Continuation Semantics

Before fresh intake, the parent reads task, TODO, decisions, assignments, audit, handoff, and runner state. It compares outcome, artifacts, scope, and completion status semantically:

- unfinished related work retains task ID and epoch;
- a later related stage retains lineage and advances epoch only when the old execution context is stale or finalized;
- only clearly unrelated work starts fresh active documents;
- runner history is preserved across fresh intake;
- undeclared ambiguity remains visible rather than being silently normalized.

## 7. Acceptance And Recovery

Producers integrate all known requirements in their first handoff. The parent runs one task-sized semantic acceptance bundle. State validation confirms the recorded task decision; it does not create implementation quality or add requirements.

An observed failure returns only the affected responsibility to its owner. The parent records the failure and lifecycle state before reassignment. Successful work is not sent to a stronger worker or a second reviewer.

## 8. Source And Runtime Boundary

The source repository is authoritative. Installed plugin cache is generated runtime material. `.CAO/`, migration backups, Git metadata, OS noise, and repository-local state are excluded from cache refresh. Source repair, cache refresh, installation, activation, restart, commit, and push remain separate operations.
