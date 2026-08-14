---
name: coding-agent-orchestrator
description: >-
  Run explicit-only Coding Agent Orchestrator (CAO) coding workflows with official Codex subagents and deterministic .CAO state control. Trigger through a leading CAO or CAOで invocation, $coding-agent-orchestrator, explicit skill selection, or an explicit request for this workflow; generic coding and plugin inspection do not activate it.
---

# Coding Agent Orchestrator

This `SKILL.md` is the local execution contract for this skill when the skill is selected.
Codex must treat this file's trigger assumptions, workflow, tool boundaries, file boundaries, and output shape as binding instructions within this skill's scope.
This file does not override system instructions, developer instructions, explicit user requests, applicable `AGENTS.md` files, or more specific local execution contracts.

## Purpose And Trigger Boundary

Use Coding Agent Orchestrator to coordinate a coding objective through official GUI Codex subagents while preserving exact, inspectable workflow state under the target repository's `.CAO/` directory.

Activate only when the current coding request:

- begins with uppercase `CAO` as `CAO <objective>`, `CAOで<objective>`, or `CAO: <objective>`;
- directly invokes `$coding-agent-orchestrator`;
- explicitly selects the bundled Coding Agent Orchestrator skill; or
- explicitly requests the Coding Agent Orchestrator workflow.

A bare plugin attachment, product discussion, incidental or lowercase `cao`, plugin inspection, discovery question, or troubleshooting request does not activate execution. After explicit activation, continuation may proceed in the same active workflow without repeating the name. Directory presence alone never activates CAO.

## State-Control Ownership

For every activated coding workflow, `.CAO/` is the workflow state SSOT. It is not an optional memory note. The parent owns its semantic correctness and the co-located `bin/coding-agents.mjs` CLI owns deterministic creation, packet recording, transition validation, normalization, and finalization.

The state surface contains:

- `task.md`: active task identity, epoch, scope, delivery mode, and completion conditions;
- `todo.md`: current executable progress;
- `decisions.md`: accepted decisions and their implementation impact;
- `assignments.md`: shared dynamic-role assignment contracts;
- `runner.md`: issued assignment, collection, orchestration, and finalization packets;
- `audit.md`: admitted verification evidence and unresolved boundaries;
- `handoff.md`: exact continuation input;
- `project.md` and `README.md`: resolved jobsite and reader order.

Before production or delegation, inspect existing state semantically. Preserve related task identity, completed progress, decisions, runner history, and unresolved work. Start a fresh task identity only for clearly unrelated work. Never replace related state merely because the wording, stage, or requested artifact changes.

Keep `.CAO/` outside tracked source through `.git/info/exclude`. Do not add it to tracked `.gitignore` unless the user explicitly requests repository-owned state. Do not copy workflow state into plugin cache.

When `.CAO/` is absent and legacy `.coding-agents/` exists, accept that directory as the current state for read-only commands. Before the first state-changing command, copy it non-destructively to `.CAO/`, locally exclude both directories, continue from `.CAO/`, and preserve `.coding-agents/` unchanged. When both exist, `.CAO/` is authoritative.

## CLI And Official-Subagent Boundary

Use the CLI co-located with the selected plugin runtime only for workflow state:

```text
node <plugin-root>/bin/coding-agents.mjs <command> --target-cwd <jobsite> ...
```

The CLI may create and validate `.CAO/`, record model-neutral job contracts, collect worker results, and finalize task state. It must never launch Codex, create OS child agents, choose worker models, interrupt runtime threads, or substitute for official collaboration tools.

Use only `spawn_agent`, `wait_agent`, `send_message`, `followup_task`, `interrupt_agent`, and `list_agents` for actual worker lifecycle. If official collaboration tools are unavailable, stop the CAO execution branch and preserve the current workflow state and safe resume point. Do not emulate delegation with a CLI or hidden runner.

## Dynamic Responsibility Model

There is no fixed roster and no role-name allowlist. Derive role names from the actual human responsibility split for the current objective. A role exists only for a bounded responsibility that is ready, independently completable, exclusively owned, and materially useful to the critical path.

The parent owns decomposition, dependency graph, scheduling, authority, safety, worker-profile selection, conflict resolution, integration, task acceptance, state consistency, and final reporting. Each worker owns one complete bounded output and its evidence. Workers may not change CAO policy, another worker's files, or task-wide state.

Before `spawn_agent`, record the exact dynamic role and model-neutral job contract with `assign`. After a worker returns, integrate its output and record `collect` with the actual lifecycle disposition. A successful worker is not sent to another worker for review.

## State-First Workflow

1. Resolve the target repository, instruction chain, authoritative source, Git state, requested outcome, and existing `.CAO/` or accepted legacy `.coding-agents/` state.
2. Classify the request as related continuation or clearly unrelated fresh work. For fresh work, run `intake` with exact task ID, epoch, scope, work type, and any typed evidence reference. For related work, preserve state and continue from the first unfinished responsibility.
3. Read `task.md`, `todo.md`, `decisions.md`, `assignments.md`, `audit.md`, `handoff.md`, and `runner.md` when present before assigning work.
4. Model responsibilities and dependencies. Create only dynamic roles justified by the objective; never preallocate roles.
5. Record each ready worker contract with `assign`, then dispatch it through `spawn_agent`. Pass exact scope, exclusive ownership, authoritative inputs, complete output, allowed and forbidden actions, stop conditions, acceptance evidence, and finite descendant permission.
6. While workers run, advance parent-owned critical-path work. Record returned results with `collect`; preserve blockers and unresolved decisions rather than filling them by inference.
7. Integrate results once dependencies are satisfied. Update task, decisions, TODO, audit, and handoff whenever their governed facts change.
8. Run one task-sized semantic acceptance bundle containing only checks required by the request, owning source contract, primary path, or an observed distinct failure.
9. When completion conditions and accepted decisions have concrete typed evidence, run `finalize`, then `verify-assignments` and `doctor` as the state-integrity boundary. Success ends verification and moves directly to handoff.

## First-Pass And Recovery Contract

- Give each worker every known decision-relevant requirement before production.
- Require a complete first handoff for the owned responsibility; do not plan draft, critique, rewrite, tournament, or stronger-worker recheck loops.
- Verification confirms the integrated candidate and state. It does not invent requirements or finish implementation.
- Repair only an observed defect, explicit user feedback, or higher-priority requirement. Return only the affected scope to its owner and rerun only invalidated evidence.
- Preserve exact failed, blocked, interrupted, superseded, and continuation states in `.CAO/`; do not convert limits or silence into completion.

## Stop Conditions

Stop the affected branch and preserve state when the target repository or current task identity cannot be resolved, state contradicts the request at the same authority, unrelated edits overlap an owned file, official collaboration tools are unavailable, a state command fails validation, or completion needs unauthorized destructive, external, authentication, activation, or publication work.

## Final Handoff

The final response leads with the usable outcome and reports changed authoritative paths, the single acceptance bundle, `.CAO` finalization and integrity status, separate refresh/activation/Git status, and concrete unresolved risk. Do not expose raw worker transcripts or claim completion when state remains unfinalized.
