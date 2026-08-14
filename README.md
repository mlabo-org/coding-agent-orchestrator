# Coding Agent Orchestrator

Coding Agent Orchestrator (CAO) is an explicit-only Codex plugin that combines official GUI subagent execution with deterministic, inspectable workflow state under `.CAO/`.

| Surface | Owner |
|---|---|
| Worker execution | Official Codex collaboration tools |
| Task identity, scope, decisions, progress, assignments, collection, audit, and finalization | `.CAO/` state plus the record-only state CLI |
| Worker model and reasoning selection | Parent/root Codex at official spawn time |
| Integration and task acceptance | Parent/root Codex |

## Activation

Use a leading `CAO`, `CAOで`, `CAO:`, `$coding-agent-orchestrator`, explicit skill selection, or an explicit request for the Coding Agent Orchestrator workflow. Generic coding, plugin inspection, an incidental CAO mention, or directory presence does not activate it.

## State-First Control

For an activated workflow, `.CAO/` is the required workflow SSOT. It records:

- the active task ID, epoch, scope, delivery mode, and completion conditions;
- accepted decisions and executable TODO state;
- shared contracts for dynamically named responsibilities;
- assignment, collection, orchestration, and finalization packets;
- verification evidence, unresolved boundaries, and exact handoff state.

Related follow-up work preserves task lineage, completed progress, decisions, and runner history. Only clearly unrelated work starts fresh state. State remains untracked through `.git/info/exclude` unless the user explicitly requests repository-owned records.

If a repository has legacy `.coding-agents/` state but no `.CAO/`, CAO accepts the legacy state for reads. The first state-changing command copies it to `.CAO/`, adds both paths to `.git/info/exclude`, and leaves `.coding-agents/` untouched as a recoverable legacy copy.

## Dynamic Roles

CAO has no fixed roster and no role-name allowlist. The parent derives responsibility names from the actual objective and creates a role only when the work is bounded, independently completable, exclusively owned, ready, and worthwhile for the critical path.

## Runtime Boundary

The state CLI is record-only. It creates and validates `.CAO/`, records model-neutral job contracts, collects worker outcomes, and finalizes workflow state. It never launches Codex, chooses a worker profile, or manages runtime threads.

Actual workers are created and managed only through the official Codex collaboration surface. If that surface is unavailable, CAO stops and preserves its exact state for safe continuation.

## State CLI

```sh
node bin/coding-agents.mjs intake --target-cwd <jobsite> --task <task> --task-id <id> --epoch <epoch> --scope <scope>
node bin/coding-agents.mjs assign --target-cwd <jobsite> --role <dynamic-role> --task-id <id> --epoch <epoch> --scope <scope> --required-capabilities <text> --ambiguity <low|medium|high> --consequence <low|medium|high> --coupling <low|medium|high> --acceptance-characteristics <text> --assignment <text> --expected-output <text>
node bin/coding-agents.mjs collect --target-cwd <jobsite> --role <dynamic-role> --task-id <id> --epoch <epoch> --scope <scope> --status <status> --lifecycle-disposition <state_retired|continuation_expected>
node bin/coding-agents.mjs finalize --target-cwd <jobsite> --task-id <id> --epoch <epoch> --scope <scope> --contract-coverage required --decision-coverage <typed-refs> --completion-coverage <typed-refs> --source-spec-coverage <typed-ref>
node bin/coding-agents.mjs verify-assignments --target-cwd <jobsite>
node bin/coding-agents.mjs doctor --target-cwd <jobsite>
```

Run `node bin/coding-agents.mjs --help` for the full packet and lifecycle contract.

## Development

```sh
npm test
npm run doctor:self
```

The source repository is authoritative. Plugin cache refresh, installation, activation, commit, and push are separate operations.

## Trust Boundary

`.CAO/` is trusted, user-editable workflow state. It is not a sandbox or privilege boundary. Anyone able to modify it can alter recorded progress and resume behavior; validation detects structural inconsistency but does not make untrusted repository content safe.

## License

MIT License. Copyright (c) 2026 Makoto Suzuki.
