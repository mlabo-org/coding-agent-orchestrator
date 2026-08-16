---
name: coding-agent-orchestrator
description: Control explicit CAO / CAOで / $coding-agent-orchestrator coding workflows through exact-thread .CAO state, Hook rehydration, and app-server reconciliation. Native Codex owns subagents and execution topology; generic coding does not trigger CAO.
---

# Coding Agent Orchestrator

This `SKILL.md` is the local execution contract for this skill when selected. Its trigger, workflow, tool, file, and output boundaries are binding only inside this skill's scope. It does not override system or developer instructions, explicit user requests, applicable `AGENTS.md` files, or more specific local contracts.

CAO is a state-control plane, not a subagent launcher.

## Activation

Activate only when the current user explicitly selects this workflow through a leading `CAO` / `CAOで` request, `$coding-agent-orchestrator`, explicit bundled-skill selection, or an explicit continuation of an already active CAO workflow.

Do not activate from plugin inspection, a generic coding request, a generic subagent request, incidental `CAO` text, `.CAO` directory presence, or prior state alone.

## Responsibility boundary

- Native Codex owns task decomposition, official subagent use, model and reasoning selection, spawn or fork, recursive delegation, peer messaging, live supervision, result integration, and semantic acceptance.
- CAO owns exact root-thread binding, durable task facts, known work, decisions, progress, typed evidence, unresolved boundaries, finalization, and handoff.
- Official Hooks and app-server data are observations of native execution. CAO must not infer semantic completion from an agent stopping, a thread becoming idle, or a collaboration tool completing.
- Never encode a model roster, worker profile, hierarchy policy, delegation depth policy, or orchestration algorithm in CAO.

## Required workflow

1. Resolve the target workspace and read applicable instructions.
2. Inspect `.CAO/` first. If it is absent and `.coding-agents/` exists, preserve the legacy directory and let `intake` copy it non-destructively.
3. Run `intake` before material work. Bind the current root with `--root-thread-id "$CODEX_THREAD_ID"`; the CLI uses that environment value by default when available.
4. Read `context`. Treat `.CAO/task.md`, `todo.md`, `decisions.md`, `work.md`, `audit.md`, `ledger.md`, and `runtime-events/` as durable task state.
5. Open each independently meaningful material responsibility with `begin-work` before production. This is a semantic state transaction, not a dispatch instruction.
6. Let native Codex choose and use the current execution capabilities. Do not wrap `spawn_agent`, prescribe a model, flatten descendants, or reconstruct peer coordination.
7. After the parent integrates a result, record exactly one terminal work result. Record decisions, progress, and the admitted verification evidence as they become semantic facts.
8. Run `reconcile-runtime` before finalization when subagents or collaboration were used, or when Hook ancestry was unresolved. It must use the exact bound root and official app-server read APIs.
9. Finalize only after known work is closed, runtime ancestry is resolved, active decision/completion/source-spec coverage has typed evidence, and the admitted acceptance bundle passes.
10. Run `doctor`, then hand off. Success ends verification.

## Hook contract

The plugin supplies `SessionStart`, `SubagentStart`, `SubagentStop`, and `Stop` command Hooks.

- Every Hook first finds the nearest `.CAO` and compares against the exact bound root thread tree.
- `SessionStart` injects current state only into the matching root.
- `SubagentStart` uses app-server ancestry before injecting state into a descendant.
- `SubagentStop` records the observed lifecycle event but cannot close semantic work.
- `Stop` blocks only a matching root with known unfinished `.CAO` state. A finalized task passes without another review.
- Mismatched sessions receive no state context and no control effect.
- Raw prompts and assistant messages are not copied into runtime events.

Plugin Hook activation is a runtime boundary. A source edit does not make the current installed task use new Hooks. After an authorized refresh, verify Hook review/trust and active status in Codex Settings before claiming activation.

## Stop conditions

Stop and preserve exact state before scope expansion, destructive work, unrelated user-change reversal, authentication, external send or publication, plugin refresh or activation, or any action not authorized by the current request.

If official Hook or app-server ancestry cannot establish that an event belongs to the bound root tree, record it as unresolved, inject no state, and require reconciliation before finalization.
