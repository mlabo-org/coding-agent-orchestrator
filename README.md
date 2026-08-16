# Coding Agent Orchestrator

Coding Agent Orchestrator (CAO) is an explicit-only state-control plugin for coding work in Codex.

CAO does not launch or route subagents. Native Codex owns decomposition, model and reasoning selection, spawn and fork behavior, recursive delegation, peer messaging, live supervision, integration, and acceptance. CAO keeps the work anchored to a durable contract even when that runtime topology changes.

## What CAO controls

- `.CAO/` is the current task-state SSOT. Legacy `.coding-agents/` is accepted only as non-destructive migration input.
- Intake binds the task to the exact `CODEX_THREAD_ID` root, so an old state directory cannot affect an unrelated session in the same repository.
- `SessionStart` rehydrates the matching root after start, resume, clear, or compaction.
- `SubagentStart` resolves the child ancestry through the official Codex app-server and injects the current task contract only into descendants of the bound root.
- `SubagentStop` records lifecycle facts without treating the result as accepted work.
- `Stop` continues the root only when known `.CAO` work is still unresolved; it does not invent review requirements.
- `reconcile-runtime` reads official app-server thread and collaboration items to recover missed ancestry, nested activity, and cross-agent messaging facts.
- Semantic work, decisions, progress, typed evidence, finalization, and handoff remain separate from runtime observations.

## Activation

Activate only through a leading `CAO` / `CAOで` request, `$coding-agent-orchestrator`, explicit skill selection, or an explicit continuation of an already active CAO task. Generic coding and generic subagent requests do not activate CAO.

## State CLI

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

`hook-event` is the plugin Hook entrypoint. It is not a worker runner.

## Runtime boundary

The source repository is authoritative. Installation, cache refresh, Hook review/trust, activation, commit, and publication are separate operations. Plugin Hooks use `hooks/hooks.json` and require a refreshed installation plus any review/trust required by the active Codex app.

## Verification

```bash
npm test
```
