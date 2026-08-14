# Coding Agent Orchestrator GUI Official-Subagent Specification

This is the active Coding Agent Orchestrator design. Its purpose is to minimize wall-clock time to a complete coding result through dependency-aware parallel delegation, while preserving clear ownership and a single acceptance decision. It replaces earlier state-machine and CLI-assisted designs; no compatibility route is retained.

## 1. Product And Activation Boundary

Coding Agent Orchestrator operates only inside the parent GUI Codex task through official collaboration tools. There is no CLI, script, external executable, child Codex session, or hidden automation route for delegation, coordination, state management, or acceptance.

The workflow activates for a coding objective only when the current request begins with uppercase `CAO` as an invocation prefix (`CAO <objective>`, `CAOで<objective>`, or `CAO: <objective>`), directly invokes `$coding-agent-orchestrator`, explicitly selects the bundled Coding Agent Orchestrator skill, or explicitly requests the Coding Agent Orchestrator / コーディング・エージェント・オーケストレーター workflow. A bare plugin attachment, product-name discussion, incidental or non-leading `CAO`, lowercase `cao`, plugin inspection, discovery question, troubleshooting request, generic coding request, generic subagent request, repository contents, and `.coding-agent-orchestrator/` state do not activate it. Continuation is permitted only within an already active, explicitly selected Coding Agent Orchestrator task.

The bundled skill sets `policy.allow_implicit_invocation: true` so it can appear in normal fresh-task catalogs. This is discovery permission only, not authorization for automatic selection. Selection remains restricted to the explicit activation forms above.

If the official collaboration surface is unavailable, the parent stops the affected workflow and reports the missing capability. It does not emulate delegation by another route.

## 2. Scheduling Objective

The scheduling objective is minimum time to a complete integrated outcome, not maximum agent count, utilization, or formal decomposition.

Before any dispatch, the parent evaluates the coding objective as a dependency graph. It identifies the critical path, ready work, exclusive ownership boundaries, and the integration point for each candidate responsibility. For every ready candidate, the parent compares its expected wall-clock savings with its coordination and integration cost.

The dispatch rule is:

1. Spawn all ready responsibilities in the same parallel wave when they are independent, exclusively owned, and expected to reduce total completion time after their coordination and integration cost.
2. Spawn those responsibilities immediately through the official GUI collaboration surface; do not serialize independent beneficial work to preserve an artificial phase order.
3. Keep work in the parent, or execute it after its dependencies, when it is tightly coupled, too small to repay coordination cost, dependent on an unfinished result, or would create an ownership conflict.

Worker availability never creates a reason to divide coherent work, create a fixed team, or add a worker whose output does not shorten time to completion.

## 3. Parent And Worker Responsibilities

The parent/root owns:

- the user-visible outcome and declared delivery slice;
- repository, instruction, and authoritative-source resolution;
- the dependency graph, critical-path analysis, ready-work decision, and parallel-wave composition;
- authority, safety, scope, external-effect decisions, and user consultation;
- every worker model, reasoning-effort, context-inheritance, and finite descendant-delegation choice;
- exclusive ownership allocation, conflict avoidance, integration order, and conflict resolution;
- the task-level semantic acceptance bundle, optional continuity state, and final reporting.

Each worker owns one bounded, independently completable output from its authoritative inputs to a complete first handoff. A worker may edit only its exclusive source or artifact scope and returns concise integration material with evidence already required for its output. A worker does not make policy decisions, change another worker's files, broaden scope, choose successors, or claim task-wide completion.

The parent remains the owner of tightly coupled policy, cross-worker integration, and any work whose dependency or coordination cost makes delegation slower.

## 4. Official GUI Collaboration Surface

The parent uses the official collaboration tools directly according to their exposed contracts:

- `spawn_agent` creates a bounded worker for a ready responsibility;
- `wait_agent` receives lifecycle updates without ceremonial polling;
- `send_message` supplies newly relevant information to an active worker;
- `followup_task` gives an idle or completed worker a new separately bounded responsibility only when it is ready and beneficial;
- `interrupt_agent` stops work only for supersession, authority, or scope reasons; and
- `list_agents` is used only when worker state changes a coordination decision.

The parent chooses worker profile and context independently for each actual responsibility. Coding Agent Orchestrator has no predefined roster, fixed role, or alternate operating path.

## 5. Worker Job Contract And Parallel Safety

Before production, every worker receives:

- objective and exact exclusive source or artifact scope;
- authoritative inputs and decision-relevant context;
- expected complete output and integration boundary;
- allowed and forbidden actions;
- stop conditions;
- acceptance evidence already required for that output; and
- explicit finite descendant-delegation permission.

No two simultaneous workers receive overlapping ownership. The parent expresses dependencies in the assignment and only spawns work whose required inputs are ready. This preserves conflict-free parallelism without an extra coordination worker or record-formatting stage.

Workers are producers, not validators, reviewers, or record-formatters. The workflow does not create a worker solely to inspect another candidate, reformat coordination records, rank alternatives, or duplicate another worker's responsibility. A successful worker receives no stronger-worker recheck or post-success confirmation.

## 6. Integration And One Acceptance Bundle

The parent integrates a worker output when its dependencies are satisfied. It resolves a real cross-worker conflict against authoritative inputs itself; it does not create a reviewer to select a candidate.

Each producer incorporates known requirements into its first acceptance candidate. The declared slice has one semantic acceptance bundle containing only the evidence required for the release decision. Verification confirms completed work; it does not finish, rewrite, normalize, decorate, rank, or choose it.

On an observed defect, the parent identifies the smallest cause and responsible owner, returns only the affected scope, and repeats only invalidated evidence. When the acceptance bundle passes, verification ends and the parent proceeds directly to handoff or the next unconditional construction stage already in the declared slice.

## 7. Minimal Continuity State

The active GUI task is the live coordination surface. Persistent state is optional and is used only when a genuine pause, handoff, or later continuation materially benefits from it.

A concise `.coding-agent-orchestrator/context.md` may contain the current outcome and scope, accepted decisions, completed work, remaining dependencies, worker outcomes, blockers, and a safe resume point. The parent maintains it directly. It is not a required schema, protocol, state machine, worker packet, formatting target, or acceptance gate. Existing material is read semantically: useful current facts are preserved and stale material is replaced.

Generated local state remains outside tracked source unless the user explicitly requests repository-owned documentation. The workflow does not change tracked ignore policy implicitly.

## 8. Delivery, Blocking, And Recovery

Coding/source work defaults to `ITERATIVE_DELIVERY`. `ONE_SHOT_QUALITY` applies only when the current user explicitly selects that named mode and never carries into another goal. Both modes require a complete first candidate for the declared slice.

A blocked dependent branch does not stop independently ready work. The parent stops and reports only the affected action when source ownership is unresolved, unrelated edits overlap an owned file, authority is missing, the official collaboration surface is unavailable, or an unsafe external effect would be required.

## 9. Source And Activation Boundaries

Authoritative plugin source, installed cache, activation, publication, and Git history are distinct. Source changes target this repository; installed cache copies are not edited as source. Refresh, activation, commit, push, and publication require their own current authority and are not implied by source completion.
