# Coding Agents

Coding Agents is an intent-bound Codex plugin for inspectable coding workflow state. It records intake, bounded model-neutral job requirements, assignments, collection, finalization, audit, and handoff packets under `.coding-agents/`. Actual workers are dispatched only through official Codex subagent tools; the source CLI is record-only and never launches `codex exec` or a custom process runner.

Coding Agents covers the workflow from specification consultation through bounded implementation and verification. Execution belongs to the Codex main thread and, when available, official Codex subagents. The Coding Agents CLI records and validates workflow state but does not execute workers itself.

## Delivery Modes

Coding Agents inherits the global delivery constitution and records the selected mode in task, assignment, handoff, audit, and runner state.

- `ITERATIVE_DELIVERY` is the default for every coding/source task. The workflow drives first to a specification-consistent, user-usable acceptance candidate that integrates every known requirement in the declared slice, runs the primary path end to end, performs minimum relevant smoke verification, and fixes observed critical blockers. It then uses real operation and short root-cause repair cycles to learn quickly.
- Hypothetical rare failures, exhaustive failure-route enumeration, future abstraction, comprehensive defensive layers, and nonessential refactors do not block the first iterative release.
- `ONE_SHOT_QUALITY` is an explicit task-local option for broader declared-slice coverage and exhaustive in-scope hardening. Intake requires both `--delivery-mode ONE_SHOT_QUALITY` and `--one-shot-authority user_request:<task-local-ref>`. General phrases such as “complete it,” “production-ready,” or “high quality” do not activate it, and the mode never carries into a later task.
- Ordinary iterative source edits do not automatically receive the exhaustive before/after and cross-feature completion gate. Observed debug/repair and source/cache/runtime contract mismatches still require concrete root-cause evidence; one-shot source work retains the broad gate.

Both modes require the first acceptance candidate to integrate every known requirement in their declared slice. Iterative delivery differs by scope and verification breadth, not by permission for knowingly incomplete output. Post-result audit only confirms the integrated candidate; it does not supply missing quality, and repair after the candidate is limited to observed failures.

## Install

Add the Coding Agents repository as its own marketplace, then install the plugin from that marketplace:

```sh
codex plugin marketplace add mlabo-org/coding-agents --ref main
codex plugin add coding-agents@coding-agents-marketplace
```

Restart Codex or start a new task after installation.

## Configure Official Codex Subagents

Coding Agents dispatches work only through the official Codex subagent surface, so actual concurrency, nesting, and exposed worker profiles come from the host Codex configuration. The Build Week demo used the current GPT-5.6-era V2 format in `~/.codex/config.toml`:

```toml
[features]
multi_agent = true

[features.multi_agent_v2]
enabled = true
max_concurrent_threads_per_session = 30

[agents]
max_depth = 2
```

`max_concurrent_threads_per_session = 30` caps concurrently open agent threads for the whole session; it is not a 30-thread allocation per plugin or a requirement to fill every slot. `max_depth = 2` counts the root task as depth 0. A Coding Agents run can dispatch bounded workers at depth 1, and any deeper delegation remains subject to the host limit and the assigned responsibility boundary.

Coding Agents owns the coding workflow state and model-neutral job requirements, while official Codex subagents perform bounded assignments. Root Sol chooses the actual model and reasoning effort from the exposed spawn surface for each job; the plugin does not make or persist that choice and does not bypass host limits. Restart Codex or begin a fresh task after changing `config.toml`.

## Model-Neutral Worker Routing

Every modern assignment and record-only orchestration packet carries `job_routing_contract_version: model_neutral_job_v1` plus explicit `required_capabilities`, `ambiguity`, `consequence`, `coupling`, and `acceptance_characteristics`. These fields describe the job without naming a model, fixing a reasoning-effort value, preferring a strongest profile, or inheriting a previous worker profile.

Root Sol consumes that contract and selects a sufficient official worker profile only at spawn time. A worker may report a blocker or failure with evidence, but it cannot choose a successor. Root Sol classifies the cause and may reassign only the affected scope at a higher sufficient profile or take ownership. An accepted successful result does not trigger a stronger-profile review or an automatic repair loop.

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

Coding Agents records confirmed decisions, converts them into actionable specification and implementation input, and requires the first acceptance candidate to integrate them. Audit then confirms the candidate against the source/spec contract before task finalization; it is not a later quality-construction phase. This creates a direct path from an early design conversation to verified implementation without losing the decisions made along the way.

## Execution Boundary

- The Codex main thread owns decomposition, policy, safety, integration, verification, and the final response.
- Coding Agents records task identity, epoch, declared scope, model-neutral routing requirements, scaffold contracts, assignments, results, lifecycle, and handoff state.
- Root Sol exclusively owns worker model/reasoning selection at official spawn time and cause-bound affected-scope reassignment or ownership transfer after a blocker or failure.
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

Coding Agents had been under development long before OpenAI Build Week. With the arrival of GPT-5.6, we used GPT-5.6 Sol ULTRA to carry out a large-scale refactor for the new Codex environment. GPT-5.6 Sol ULTRA accelerated architecture inspection, specification discussion, cross-file implementation and review, test execution, and the conversion of accepted decisions into public documentation. This was a modernization of a mature baseline, not a claim that the entire project was created during Build Week.

The explicit plugin path adds inspectable workflow state and executable validation gates that ULTRA mode does not define by itself. ULTRA and Coding Agents can coexist in one installation, and the plugin does not detect, disable, or claim technical exclusivity with the host's selected intelligence level. To keep orchestration ownership predictable, choose one primary orchestration route for each task: either rely on ULTRA's proactive delegation, or explicitly select Coding Agents so its intake, scope, lifecycle, collection, and finalization contract governs the coding workflow. When Coding Agents is selected, actual workers are still dispatched only through official Codex subagents.

Selecting Coding Agents does not change the host model or intelligence level, and selecting ULTRA does not by itself apply the Coding Agents workflow contract. The source repository remains separate from disposable plugin cache. Using GPT-5.6 Sol ULTRA for the refactor described above is distinct from choosing the primary orchestration route for a later task.

- [`a68c1b6`](https://github.com/mlabo-org/coding-agents/commit/a68c1b6585c79c11d0a5d89673659cd4d3c4c050) — removed the CLI-spawned Codex worker path and established official Codex subagents as the only worker-dispatch route.
- [`678f9a9`](https://github.com/mlabo-org/coding-agents/commit/678f9a9224a562098f5909ee1037dd7677d79a96) — centralized shared scaffold contracts and reduced workflow-state overhead while retaining lifecycle, packet, and historical-compatibility checks.

The source suite includes focused state, routing-metadata, lifecycle, and official-spawn-only contract coverage.

## Platform

Verified on macOS 26.5.2 with Codex CLI 0.144.2, Node.js 24.18.0, and Git 2.55.0. The implementation uses Node.js standard-library APIs and Git, but other operating systems have not yet been verified.

## License

MIT License. Copyright (c) 2026 Makoto Suzuki.
