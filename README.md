# Coding Agents

Coding Agents is a GUI Codex plugin for minimizing the wall-clock time to complete a coding objective through dependency-aware delegation to official GUI subagents. It has exactly one operating path: the parent GUI Codex task uses its official collaboration tools directly.

There is no CLI, script, child session, external executable, or hidden automation path. If the official collaboration tools are unavailable, Coding Agents stops and reports that boundary.

## When To Use It

Activate the workflow for a coding objective by invoking `$coding-agents`, explicitly selecting the bundled Coding Agents skill, or selecting the Coding Agents plugin and explicitly asking it to use the Coding Agents workflow. A bare plugin attachment, plugin inspection, discovery question, or troubleshooting request does not activate the coding workflow.

The bundled skill intentionally sets `allow_implicit_invocation: false`, so it is not injected into the model's ordinary skill context. This preserves the explicit-only boundary; direct skill invocation or an explicit Coding Agents coding request through the selected plugin is required. Once activated, the workflow may continue within that active Coding Agents task. Ordinary coding, a generic request for subagents, an explanation, a review, and `.coding-agents/` presence do not activate it.

## The Scheduling Goal

The parent optimizes time to a complete integrated result, not worker count or a formal-looking division of work. Before it delegates, it evaluates:

- the dependency graph and its critical path;
- which work is ready now;
- whether each ready responsibility is independent and has exclusive ownership; and
- whether the expected time saved exceeds coordination and integration cost.

Ready responsibilities that are independent and expected to reduce elapsed time are spawned immediately in the same parallel wave. Work that is tightly coupled, too small to repay its coordination cost, or blocked by an unfinished dependency stays with the parent or runs in dependency order. Available worker slots never justify artificial splitting or a fixed roster.

## Ownership And Safe Parallelism

The parent owns the user-visible outcome, declared slice, dependency and critical-path analysis, delegation decisions, authority and safety, worker-profile choices, conflict avoidance and resolution, integration, the one task-level acceptance decision, optional continuity, and final reporting.

Each worker owns one independently completable output end to end. Before spawning it, the parent provides an exact source or artifact scope with exclusive ownership, authoritative inputs, a complete expected output, stop conditions, allowed and forbidden actions, and acceptance evidence. Workers return a complete first handoff with concise integration notes; they do not alter another worker's scope, broaden policy, choose successors, or claim task-wide completion.

The plugin never creates workers solely to validate, review, or format records. It does not assign fixed roles, duplicate work, run candidate tournaments, or recheck a successful result. The parent keeps tightly coupled policy and integration decisions, preventing ownership overlap before work begins.

## Execution Shape

1. The parent resolves the requested outcome, repository, applicable instructions, source boundaries, current Git state, and any useful continuity context.
2. It models the dependency graph, identifies the critical path and ready work, and compares expected elapsed-time savings with coordination and integration cost.
3. It immediately spawns the independent, exclusive-ownership ready work that shortens completion time in one parallel wave. It retains or sequences the rest.
4. Workers produce their complete bounded responsibilities through official GUI collaboration tools only.
5. The parent integrates outputs once their dependencies are satisfied and resolves only real integration boundaries.
6. The declared slice uses one semantic acceptance bundle. When it passes, verification ends and the parent hands off the result. An observed defect returns only the affected scope to its responsible owner.

Known requirements belong in each producer's first handoff. The normal path has no draft-to-critique-to-rewrite loop, validator-driven completion, automatic repair, stronger-worker double-check, or post-success review.

## Minimal Continuity State

The GUI task is the live coordination surface. A concise `.coding-agents/context.md` is optional and used only for a real pause, handoff, or later continuation. It may record the current outcome and scope, accepted decisions, completed work, remaining dependencies, worker outcomes, blockers, and a safe resume point. It is not a required protocol, workflow state machine, or acceptance gate.

Generated local state remains outside tracked source unless the user explicitly asks for repository-owned documentation. Coding Agents does not implicitly change ignore policy.

## Source, Cache, Activation, And Git

This repository is the authoritative plugin source. Installed cache copies are runtime artifacts, not source. Source editing, refresh, activation, publication, commit, and push are separate actions and occur only with current authority. Source completion does not prove installed activation.

## License

MIT License. Copyright (c) 2026 Makoto Suzuki.
