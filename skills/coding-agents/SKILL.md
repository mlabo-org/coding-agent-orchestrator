---
name: coding-agents
description: >-
  Coordinate coding work in GUI Codex with official subagents to minimize total time-to-completion. Trigger only when the user explicitly names Coding Agents or invokes $coding-agents; continuation is limited to that active workflow. Generic subagent requests and .coding-agents presence never trigger.
---

# Coding Agents

This `SKILL.md` is the local execution contract for this skill when the skill is selected.
Codex must treat this file's trigger assumptions, workflow, tool boundaries, file boundaries, and output shape as binding instructions within this skill's scope.
This file does not override system instructions, developer instructions, explicit user requests, applicable `AGENTS.md` files, or more specific local execution contracts.

## Purpose And Trigger Boundary

Use Coding Agents to minimize total wall-clock time for coding work by giving bounded responsibilities to official GUI Codex subagents while the parent retains task control and integration. Optimize time-to-completion, not agent count.

Select this skill only when the user explicitly names `Coding Agents` or invokes `$coding-agents` in the current workflow. After that explicit selection, a continuation request may proceed inside the same active workflow without repeating the name.

Do not select it for generic coding, debugging, review, explanation, subagent decomposition, multi-agent coordination, team coordination, or continuation outside an already active explicitly selected Coding Agents workflow. Never infer activation from repository contents or the presence of `.coding-agents/`.

## GUI-Only Execution Boundary

- Operate only through the parent GUI Codex task and its official collaboration tools.
- Use `spawn_agent` for direct worker creation; use `wait_agent`, `send_message`, `followup_task`, `interrupt_agent`, and `list_agents` only for their documented lifecycle purposes.
- Do not use a CLI. Do not invoke external executables, scripts, child Codex sessions, or hidden automation as a substitute for the official collaboration surface.
- If the official collaboration tools are unavailable, stop the Coding Agents workflow and report that boundary. Do not emulate delegation through another mechanism.
- Treat plugin source, installed cache, activation, publication, and Git history as separate boundaries. Change or activate one only when the current request authorizes it; never edit an installed cache as source.

## Parent And Worker Ownership

The parent/root owns:

- the user-visible outcome, declared slice, dependency graph, critical path, scheduling waves, and integration order;
- responsibility decomposition and the decision to keep tightly coupled work parent-owned;
- authority, safety, scope, external effects, and user consultation;
- every worker model, reasoning-effort, context-inheritance, and descendant-delegation choice exposed by the official spawn surface;
- conflict resolution, cross-worker integration, the task-level acceptance decision, optional continuity state, and final reporting.

Each worker owns one bounded, independently completable output end to end. Its first handoff must be complete for that responsibility and concise enough to integrate directly. A worker does not choose policy, broaden scope, select a successor, alter another worker's files, or claim task-wide completion.

Do not give the same source ownership to multiple workers. Keep tightly coupled policy and integration decisions in the parent. A worker boundary is justified only when its completed output remains independently ownable and the expected elapsed-time saving exceeds coordination and integration cost.

## GUI Subagent Workflow

1. Resolve the target repository, applicable instruction chain, requested outcome, source-of-truth paths, current Git state, and any relevant prior continuity material before edits or delegation.
2. Model how competent humans would divide the work. Identify responsibility owners, authoritative inputs, complete outputs, handoff boundaries, dependencies, and the parent integration point. Build the dependency graph and identify the current critical path before delegation.
3. For each candidate responsibility, evaluate readiness, independence, size, expected duration, source overlap, coordination cost, integration cost, and whether delegation changes the critical-path finish time.
4. Classify work before dispatch:
   - Put ready, independent, sufficiently large work in the same parallel wave when concurrent execution is expected to reduce total elapsed time.
   - Keep tightly coupled, dependency-blocked, overlapping, or too-small work in the parent or execute it in dependency order.
   - Do not split work merely to occupy available agent slots.
5. Dispatch every selected item in the current ready wave through `spawn_agent` without serial delay between independent items. Do not preallocate a roster or create placeholder roles.
6. Give each worker a complete job contract containing:
   - objective and exact source scope;
   - exclusive file or artifact ownership;
   - authoritative inputs and required context;
   - expected completed output and concise return shape;
   - allowed and forbidden actions;
   - stop conditions and acceptance evidence;
   - whether descendant delegation is permitted and its finite bound.
7. Select the minimum sufficient exposed worker model and reasoning effort from ambiguity, consequence, coupling, context breadth, capability needs, transformation complexity, and acceptance determinism. Choose context inheritance independently and pass only what the worker needs.
8. While a wave is active, advance parent-owned critical-path work and prepare known integration boundaries. Use lifecycle tools to receive results, provide decision-relevant context, or address a concrete blocker; do not poll ceremonially or create work merely to keep workers busy.
9. As dependencies complete, update readiness and dispatch the next time-saving wave without waiting for unrelated work. Integrate successful outputs once their actual dependencies are satisfied.
10. Resolve overlap or conflicting conclusions in the parent against authoritative inputs. Do not create validator-only, reviewer-only, state-formatting, or duplicate-investigation roles; state and verification remain the minimum needed to support implementation and the final acceptance decision.
11. If a worker is blocked or fails, classify the cause and return only the affected responsibility to a suitable owner. Do not recheck a successful worker with a stronger worker or create an automatic repair cycle.
12. Execute one task-sized semantic acceptance bundle containing only checks required by the request, owning source contract, primary path, or an observed distinct failure. Success ends verification and moves directly to handoff.

## First-Pass Quality

- Give every worker all known decision-relevant requirements before production.
- Require the first returned artifact to satisfy its complete responsibility; do not plan a draft, critique, rewrite, ranking, or validator-driven completion path.
- Do not spend a worker slot on routine review, validation, state bookkeeping, formatting conformity, or duplicated research. Keep these parent-owned and minimal unless they are themselves an independently requested implementation deliverable.
- Verification confirms a completed candidate. It does not invent requirements, finish semantic work, or trigger post-success review.
- Repair only an observed defect, explicit user feedback, or a higher-priority requirement, and repeat only the invalidated evidence boundary.
- Default coding/source work to `ITERATIVE_DELIVERY`. Use `ONE_SHOT_QUALITY` only when the current user explicitly selects that named mode; it is task-local and non-sticky.

## Optional Continuity State

State is optional and exists only to preserve useful context across a genuine pause, handoff, or later continuation. The active Codex task remains the live coordination surface.

- When continuity would materially help, maintain a short file such as `.coding-agents/context.md` directly from the parent GUI task.
- Record only the current outcome, scope, accepted decisions, completed work, remaining dependencies, worker outcomes, blockers, and safe resume point.
- Read existing state semantically. Preserve still-current decisions and completed work; replace stale or contradictory material instead of layering compatibility fields.
- Do not require a predefined roster, packet schemas, lifecycle fields, repeated mappings, or validator approval. State formatting is never a completion gate.
- Keep generated local state outside tracked source unless the user explicitly requests repository-owned documentation. Do not modify tracked ignore policy without explicit authority.

## Stop Conditions

Stop the affected action and report the exact boundary when:

- the target repository or authoritative source cannot be resolved;
- applicable instructions conflict at the same authority;
- unrelated changes overlap an owned file and cannot be preserved;
- a required official collaboration tool or authorized worker profile is unavailable;
- completion would require destructive work, external publication, authentication, activation, or broader scope not authorized by the user.

Continue safe independent work when only one branch is blocked.

## Worker Return And Final Handoff

Require each worker to return only:

- completed outcome and owned paths or artifacts;
- acceptance evidence already produced;
- concrete blocker or unresolved decision, if any;
- concise integration notes.

The parent final response leads with the usable outcome, then reports changed authoritative paths, the single acceptance bundle, separate activation or Git status when relevant, and concrete unresolved risk. Raw worker transcripts and internal scheduling detail stay out of the final response unless requested.
