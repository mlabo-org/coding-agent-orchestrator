# Coding Agents GUI Official-Subagent Specification

This specification defines the active Coding Agents architecture. It replaces the earlier state-machine design rather than preserving compatibility with it.

## 1. Product Boundary

Coding Agents coordinates coding work inside the parent GUI Codex task. It uses the official collaboration surface for all worker creation, communication, waiting, interruption, and status inspection.

There is no alternate operating path. External executables, scripts, child Codex sessions, and hidden automation do not perform Coding Agents delegation. If the official collaboration surface is unavailable, the workflow stops and reports the missing capability.

## 2. Outcome And Ownership

The product goal is to coordinate coding work through official subagents without diluting ownership.

The parent/root owns:

- the user-visible outcome and declared delivery slice;
- repository and instruction resolution;
- decomposition and integration order;
- authority, safety, scope, and external-effect decisions;
- decomposition and every official worker-profile choice;
- conflict resolution and cross-worker integration;
- task-level acceptance, optional continuity state, and final reporting.

Each worker owns one bounded independent output from authoritative inputs to a complete first handoff. It owns acceptance evidence for that output but not task-wide acceptance. Simultaneous workers never share source ownership.

## 3. Work Decomposition

Before dispatch, the parent models competent human responsibility boundaries and identifies dependencies. It creates a worker boundary only when the responsibility:

1. can be completed independently;
2. has exclusive source or artifact ownership;
3. has a stable handoff into the parent integration point; and
4. does not transfer parent-owned policy, authority, conflict-resolution, or task-acceptance decisions.

The parent dispatches each selected responsibility directly through the official collaboration surface. Available worker slots do not create artificial work or justify fragmenting one coherent responsibility. The plugin does not define a fixed team.

## 4. Official Collaboration Boundary

The parent uses the official collaboration tools according to their exposed contracts:

- `spawn_agent` creates a direct worker with a bounded job contract;
- `wait_agent` receives lifecycle updates without busy polling;
- `send_message` supplies relevant information to an active worker;
- `followup_task` gives a completed or idle worker a new bounded responsibility;
- `interrupt_agent` stops work only for an actual supersession, authority issue, or scope problem; and
- `list_agents` inspects current worker state when that information changes a coordination decision.

The parent alone selects model, reasoning effort, context inheritance, and finite descendant permission for every spawn. Coding Agents does not encode a predefined worker roster.

## 5. Worker Job Contract

Every worker receives, before production:

- objective;
- exact source scope and exclusive ownership;
- authoritative inputs and necessary context;
- expected completed output;
- allowed and forbidden actions;
- stop conditions;
- acceptance evidence; and
- explicit finite descendant-delegation permission.

The worker returns completed outcome, owned paths or artifacts, evidence already produced, concrete blockers or unresolved decisions, and concise integration notes. It does not return a rough draft for routine parent repair, select another worker, broaden scope, or claim task-wide completion.

## 6. Integration And Acceptance

The parent integrates worker outputs when their dependencies are satisfied. It resolves conflicts against authoritative inputs and does not create a separate evaluator to choose a preferred candidate.

Each producer incorporates every known requirement into its first acceptance candidate. The ordinary success path contains one task-sized semantic acceptance bundle and no critique-to-rewrite, ranking, automatic fixer, stronger-worker recheck, or post-success review.

After an observed failure, the parent identifies the cause and responsible owner, repairs only the affected scope, and repeats only the invalidated evidence boundary. Success ends verification.

## 7. Optional State

The active GUI Codex task is the live coordination surface. Persistent state is optional and is created only when a genuine pause, handoff, or later continuation makes it useful.

A minimal `.coding-agents/context.md` may contain:

- current outcome and scope;
- accepted decisions;
- completed work;
- remaining dependencies;
- worker outcomes;
- blockers; and
- safe resume point.

The parent maintains this file directly. It is not a protocol, state machine, formatting requirement, or acceptance gate. Existing material is read semantically; current useful facts are preserved and stale facts are replaced. No predefined roster, packet family, lifecycle-field ceremony, or compatibility layer is retained.

Generated local state remains outside tracked source unless the user explicitly requests repository-owned documentation. The workflow does not modify tracked ignore policy implicitly.

## 8. Delivery And Recovery

Coding/source work defaults to `ITERATIVE_DELIVERY`. `ONE_SHOT_QUALITY` activates only from the current user's explicit selection and does not carry to another task. Both modes require a complete first candidate for the declared slice; they differ in authorized scope and verification breadth.

A blocker in one independent branch does not stop other safe work. Missing authority, unresolved source ownership, overlapping unrelated edits, unavailable official collaboration tools, or an unsafe external effect stops only the affected action and is reported to the user.

## 9. Source And Activation Boundaries

Authoritative plugin source, installed cache, activation, publication, and Git history are distinct. Source edits target this repository. Installed cache copies are never maintained as source. Refresh, activation, commit, push, and publication require their own current authority and are not implied by a source change.

Source completion does not prove installed activation. When activation is separately requested, use the source-first plugin refresh boundary and report whether a fresh GUI task is required.
