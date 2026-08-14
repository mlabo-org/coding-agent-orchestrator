# Coding Agent Orchestrator (CAO)

Coding Agent Orchestrator (CAO; コーディング・エージェント・オーケストレーター) is a GUI Codex plugin for minimizing the wall-clock time to complete a coding objective through dependency-aware delegation to official GUI subagents.

| Surface | Canonical value |
| --- | --- |
| Product name | Coding Agent Orchestrator |
| Short invocation alias | `CAO` |
| Plugin, skill, and repository ID | `coding-agent-orchestrator` |
| Japanese name | コーディング・エージェント・オーケストレーター |
| Repository | [mlabo-org/coding-agent-orchestrator](https://github.com/mlabo-org/coding-agent-orchestrator) |
| Optional continuity directory | `.coding-agent-orchestrator/` |

CAO and CLI Agent Runner are separate capabilities. CAO coordinates official subagents inside the current GUI Codex task; it does not invoke vendor-selectable CLI workers or act as the CLI Agent Runner.

CAO has exactly one operating path: the parent GUI Codex task uses its official collaboration tools directly. There is no CLI, script, child session, external executable, or hidden automation path. If the official collaboration tools are unavailable, Coding Agent Orchestrator stops and reports that boundary.

## When To Use It

Activate the workflow for a coding objective by starting the request with uppercase `CAO` as `CAO <objective>`, `CAOで<objective>`, or `CAO: <objective>`; invoking `$coding-agent-orchestrator`; explicitly selecting the bundled Coding Agent Orchestrator skill; or explicitly requesting the Coding Agent Orchestrator / コーディング・エージェント・オーケストレーター workflow. A bare plugin attachment, product-name discussion, incidental or non-leading `CAO`, lowercase `cao`, plugin inspection, discovery question, or troubleshooting request does not activate the coding workflow.

The bundled skill sets `allow_implicit_invocation: true` so it can appear in normal fresh-task catalogs. This is discovery permission only, not authorization for automatic selection. Selection remains restricted to the explicit activation forms above. Once activated, the workflow may continue within that active Coding Agent Orchestrator task. Ordinary coding, a generic request for subagents, an explanation, a review, and `.coding-agent-orchestrator/` presence do not activate it.

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

The GUI task is the live coordination surface. A concise `.coding-agent-orchestrator/context.md` is optional and used only for a real pause, handoff, or later continuation. It may record the current outcome and scope, accepted decisions, completed work, remaining dependencies, worker outcomes, blockers, and a safe resume point. It is not a required protocol, workflow state machine, or acceptance gate.

Generated local state remains outside tracked source unless the user explicitly asks for repository-owned documentation. Coding Agent Orchestrator does not implicitly change ignore policy.

### Trust Model / 信頼モデル

Coding Agent Orchestrator is designed for trusted, full-access local development environments. `.coding-agent-orchestrator/` is user-editable trusted workflow state: anyone or any process that can modify it can change recorded plans, progress, and resume behavior. It is not a sandbox or a privilege boundary, and operators running untrusted repositories, workers, or local processes are responsible for providing any required isolation. Direct state editing is supported, but state remains declarative and is not executable runner configuration or authority to expand the current user's permissions.

Coding Agent Orchestratorは、信頼されたフルアクセスのローカル開発環境での利用を前提としています。`.coding-agent-orchestrator/` はユーザーが直接編集できる信頼済みのワークフロー状態であり、これを書き換えられるユーザーやプロセスは、記録された計画・進捗・resume時の挙動を変更できます。これはsandboxや権限境界ではないため、信頼できないリポジトリ、worker、ローカルプロセスを扱う場合に必要な隔離は利用者が用意してください。状態の直接編集はサポートされますが、状態は宣言的データであり、実行可能なrunner設定や現在のユーザー権限を拡張する根拠としては扱われません。

## Source, Cache, Activation, And Git

This repository is the authoritative plugin source. Installed cache copies are runtime artifacts, not source. Source editing, refresh, activation, publication, commit, and push are separate actions and occur only with current authority. Source completion does not prove installed activation.

## License

MIT License. Copyright (c) 2026 Makoto Suzuki.
