# Coding Agents

Coding Agents is a GUI Codex plugin for coordinating coding work with official subagents. The parent task decomposes the outcome, dispatches bounded responsibilities, integrates completed worker outputs, and makes the final acceptance decision.

Coding Agents has one operating path: the official collaboration tools exposed to the parent GUI Codex task.

## What It Owns

The parent owns decomposition, task-control decisions, authority and safety, worker model and reasoning selection, conflict resolution, integration, acceptance, and final reporting.

Each worker owns one bounded independent output end to end. A worker receives exact source ownership, authoritative inputs, expected completed output, allowed and forbidden actions, stop conditions, acceptance evidence, and a finite descendant-delegation boundary. It returns concise integration material instead of an internal transcript.

Coding Agents creates worker boundaries only for bounded, independently completable responsibilities. Tightly coupled policy and integration decisions remain with the parent, and the plugin does not preallocate a roster.

## Typical Use

Invoke `$coding-agents` when you want Codex to:

- split a coding objective into independent repository responsibilities;
- dispatch those responsibilities directly through official subagents;
- integrate results without overlapping file ownership; or
- continue a prior Coding Agents task from useful context.

Ordinary single-owner edits, explanations, and reviews do not need this plugin. The existence of `.coding-agents/` by itself does not activate it.

## Execution Shape

1. The parent resolves the repository, applicable instructions, source boundaries, current Git state, requested outcome, and prior continuity material.
2. It models human responsibility boundaries and keeps task-control and integration decisions in the parent.
3. It dispatches selected bounded responsibilities directly through the official collaboration surface.
4. Workers return complete bounded outputs with evidence and short integration notes.
5. The parent integrates against authoritative inputs, resolves conflicts, and performs one task-sized semantic acceptance bundle.
6. A successful bundle ends verification and produces the user handoff. A concrete failure returns only the affected scope to the responsible owner.

The normal successful path has no candidate tournament, critique-to-rewrite cycle, stronger-worker recheck, or validator-driven completion. Known quality belongs in each producer's first handoff.

## Optional Continuity

The GUI task is the live coordination surface. File-backed state is optional and useful only for a genuine pause, handoff, or later continuation.

When persistence materially helps, the parent may maintain a concise `.coding-agents/context.md` containing the current outcome, scope, decisions, completed work, remaining dependencies, worker outcomes, blockers, and safe resume point. This file is a memory aid, not a protocol, required schema, or acceptance gate. Existing state is interpreted semantically; stale fields do not create compatibility obligations.

Generated local state stays outside tracked source unless the user explicitly requests repository-owned documentation. Tracked ignore policy is not changed implicitly.

## Source, Cache, Activation, And Git

This repository is the authoritative plugin source. Installed cache copies are runtime artifacts and are not edited as source. Source editing, cache refresh, activation, publication, commit, and push are separate actions; perform only the actions the current user request authorizes.

Changing source does not prove installed activation. Activation, when requested, follows the source-first plugin refresh boundary and may require a fresh Codex task.

## Availability Boundary

If official collaboration tools are unavailable, Coding Agents stops and reports that boundary. It does not substitute external executables, scripts, child sessions, or hidden automation.

## License

MIT License. Copyright (c) 2026 Makoto Suzuki.
