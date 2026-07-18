# Coding Agents

Coding Agents is an intent-bound Codex plugin for inspectable coding workflow state. It records intake, bounded assignments, collection, finalization, audit, and handoff packets under `.coding-agents/`. Actual workers are dispatched only through official Codex subagent tools; the source CLI is record-only and never launches `codex exec` or a custom process runner.

Coding Agents can be used without Agentic Runner, from specification consultation through bounded implementation and verification. "Standalone" here means that Agentic Runner is optional; execution still belongs to the Codex main thread and, when available, official Codex subagents. The Coding Agents CLI records and validates workflow state but does not execute workers itself.

[Agentic Runner](https://github.com/mlabo-org/agentic-runner) is an optional upper control plane for work that spans multiple owners or outputs; neither plugin requires the other to be installed or invoked.

## Standalone Or Paired

- **Coding Agents alone** — discuss a new code specification, turn confirmed decisions into an instruction document, execute bounded assignments, and verify the result against that contract.
- **With Agentic Runner** — keep the same coding workflow while Agentic Runner owns shared constraints, cross-owner routing, supervision, resume checkpoints, and final convergence.

Agentic Runner can also run without Coding Agents, using any other declared owners. The pair is an optional composition, not a set-only product.

## Install

The Agentic Runner repository publishes two independent entries in one shared marketplace. For a standalone Coding Agents install:

```sh
codex plugin marketplace add mlabo-org/agentic-runner --ref main
codex plugin add coding-agents@agentic-control-plane
```

That is a complete standalone install. To add the optional upper control plane and form the pair:

```sh
codex plugin add agentic-runner@agentic-control-plane
```

Restart Codex or start a new task after installation.

## Configure Official Codex Subagents

Coding Agents dispatches work only through the official Codex subagent surface, so actual concurrency and nesting come from the host Codex configuration. The Build Week demo used the current GPT-5.6-era V2 format in `~/.codex/config.toml`:

```toml
[features]
multi_agent = true

[features.multi_agent_v2]
enabled = true
max_concurrent_threads_per_session = 30

[agents]
max_depth = 2
```

`max_concurrent_threads_per_session = 30` caps concurrently open agent threads for the whole session; it is not a 30-thread allocation per plugin or a requirement to fill every slot. `max_depth = 2` counts the root task as depth 0. A standalone Coding Agents run can dispatch bounded workers at depth 1. When the coding branch is itself delegated under Agentic Runner, that depth-1 branch may dispatch one bounded worker layer at depth 2.

Agentic Runner remains the optional upper cross-output controller, Coding Agents owns the coding workflow branch, and official Codex subagents perform the bounded assignments. Neither plugin bypasses the host limits, and either plugin can still be used alone with a shallower topology. Restart Codex or begin a fresh task after changing `config.toml`.

## State-First Start Or Continue

Use the plugin by name, or give a concrete next objective in a repository with valid `.coding-agents` state:

> Use Coding Agents explicitly to audit this repository. Inspect README.md and package.json, run npm test, make no source changes or commits, and return the workflow-state and verification evidence.

> Continue this same repository with a new specification. Inspect the existing `.coding-agents` state, preserve completed progress when it is related, and decide autonomously whether this is an addition or a clearly unrelated new task.

Mere `.coding-agents` presence does not hijack unrelated coding work. A valid state directory plus strong continuation intent does select Coding Agents even when the product name is not repeated.

## Semantic Existing-State Triage

`.coding-agents` is the workflow SSOT. Before running fresh intake, Codex reads the active task, checklist, audit, handoff, and runner history and compares their outcome, artifacts, scope, and completion state with the new request.

- Semantically related work stays in the existing task lineage. Completed checklist entries remain checked, new stable TODO items are appended after existing progress, and work resumes from the first unfinished item.
- An unfinished related task keeps its current `task_id` and `epoch`. A finalized or stale related task keeps the lineage but advances the epoch when the old execution context is no longer valid.
- Only clearly unrelated work starts fresh `task_id`, `epoch`, and `scope` through `intake`, which replaces current generated task documents while preserving `runner.md` history.
- The classification uses Codex's semantic reasoning, not a keyword-only rule or directory presence. The user is not asked to choose a routine new/continue mode.
- The relation, prior completion state, and decision reason are recorded in `.coding-agents/audit.md` or `.coding-agents/decisions.md` for later inspection.
- `state_retired` applies to worker assignment contexts, not to the repository, `.coding-agents/`, or the Coding Agents plugin.

A completed task therefore never locks the repository, but it also is not discarded merely because the next request is phrased as a new stage or purpose.

## From Specification To Execution

You can begin before a detailed implementation specification exists. Use Codex as a specification partner to discuss desired behavior, users, constraints, interfaces, edge cases, acceptance criteria, validation commands, and forbidden changes. The Coding Agents parent workflow owns this consultation and the resulting decisions.

Once the decisions are confirmed, ask Codex to turn them into an actionable instruction document such as `docs/implementation-brief.md`. A useful brief includes:

- goal and non-goals
- accepted decisions and unresolved questions
- in-scope and out-of-scope files
- functional and nonfunctional requirements
- acceptance criteria and required tests
- permissions, stop conditions, and commit policy

Then execute that contract explicitly:

> Use Coding Agents explicitly. Treat `docs/implementation-brief.md` as the implementation contract. Create the intake and bounded assignments, dispatch workers only through official Codex subagent tools, implement within the declared scope, run every listed validation, and do not commit until I approve.

Coding Agents records confirmed decisions, converts them into actionable specification, and audits the implementation against the source/spec contract before task finalization. This creates a direct path from an early design conversation to verified implementation without losing the decisions made along the way.

## Execution Boundary

- The Codex main thread owns decomposition, policy, safety, integration, verification, and the final response.
- Coding Agents records task identity, epoch, declared scope, scaffold contracts, assignments, results, lifecycle, and handoff state.
- Official Codex subagent tools are the only worker-dispatch route.
- If official subagents are unavailable, execution remains in the parent thread. The CLI does not fall back to an OS child Codex process.
- Runtime state and installed plugin cache are not source.

## Run From Source

The repository has no third-party runtime dependencies. A recent Node.js release and Git are required.

```sh
git clone https://github.com/mlabo-org/coding-agents.git
cd coding-agents
npm test
npm run doctor:self
```

Additional checks:

```sh
npm run test:cli
```

`doctor:self` validates the source-tree CLI. It does not claim that a separately installed plugin cache has been refreshed.

## Build Week Extension

The workflow baseline existed before the 2026 OpenAI Build Week eligibility window. The submission asks judges to evaluate only these later extensions:

Agentic Runner and Coding Agents had been under development long before OpenAI Build Week. With the arrival of GPT-5.6, we used GPT-5.6 Sol ULTRA to carry out a large-scale refactor so both plugins would operate correctly in the new Codex environment. GPT-5.6 Sol ULTRA accelerated architecture inspection, specification discussion, cross-file implementation and review, test execution, and the conversion of accepted decisions into public documentation. This was a modernization of a mature baseline, not a claim that the entire project was created during Build Week.

The explicit plugin path adds inspectable workflow state and executable validation gates that ULTRA mode does not define by itself. ULTRA and Coding Agents can coexist in one installation, and the plugin does not detect, disable, or claim technical exclusivity with the host's selected intelligence level. To keep orchestration ownership predictable, choose one primary orchestration route for each task: either rely on ULTRA's proactive delegation, or explicitly select Coding Agents so its intake, scope, lifecycle, collection, and finalization contract governs the coding workflow. When Coding Agents is selected, actual workers are still dispatched only through official Codex subagents.

Selecting Coding Agents does not change the host model or intelligence level, and selecting ULTRA does not by itself apply the Coding Agents workflow contract. Agentic Runner and Coding Agents remain independently installable and usable, may optionally be paired within the explicit plugin route, and keep source repositories separate from disposable plugin cache. Using GPT-5.6 Sol ULTRA for the refactor described above is distinct from choosing the primary orchestration route for a later task.

- [`a68c1b6`](https://github.com/mlabo-org/coding-agents/commit/a68c1b6585c79c11d0a5d89673659cd4d3c4c050) — removed the CLI-spawned Codex worker path and established official Codex subagents as the only worker-dispatch route.
- [`678f9a9`](https://github.com/mlabo-org/coding-agents/commit/678f9a9224a562098f5909ee1037dd7677d79a96) — centralized shared scaffold contracts and reduced workflow-state overhead while retaining lifecycle, packet, and historical-compatibility checks.

The current source suite contains 61 passing tests.

## Platform

Verified on macOS 26.5.2 with Codex CLI 0.144.2, Node.js 24.18.0, and Git 2.55.0. The implementation uses Node.js standard-library APIs and Git, but other operating systems have not yet been verified.

## License

MIT License. Copyright (c) 2026 Makoto Suzuki.
