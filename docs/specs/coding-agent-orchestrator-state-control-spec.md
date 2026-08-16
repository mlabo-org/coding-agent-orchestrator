# CAO Durable State-Control Specification

## State identity

Every active task has `task_id`, `epoch`, `scope`, and `root_thread_id`. All semantic writes must match the active identity exactly. `.CAO/` is local untracked state. `.coding-agents/` is read or copied only for non-destructive migration.

Directory presence is not activation. The exact root binding prevents stale state from controlling unrelated Codex tasks in the same workspace.

## Semantic state

The semantic ledger records:

- task intake;
- work begin and one terminal result;
- accepted decisions;
- progress changes;
- verification observations;
- task finalization.

Completed work and passed verification require typed evidence references. Finalization requires closed work, resolved runtime ancestry, complete decision and completion coverage, source/spec evidence, and consistent TODO state.

Every semantic write acquires the exact-state `.semantic-write.lock` directory before reading or mutating task files. Contending writers wait for the owner and fail closed on timeout; they do not race independent read-modify-write snapshots. The lock is released after the complete state transition.

## Runtime state

`.CAO/runtime-events/` contains one idempotent JSON record per normalized Hook or app-server observation. Event keys are hashed into exclusive-create filenames, so concurrent Hook processes cannot overwrite one another or duplicate an identical event.

Unrelated intake retains those files as historical observations. Active context, unresolved-ancestry checks, finalization, and `doctor` consider only events whose `task_id` and `epoch` match the active task; historical events remain inspectable but never invalidate or block the new task.

Runtime observations are not written into the semantic ledger and cannot close semantic state.

## State rehydration and stop control

Matching root starts and descendant starts receive a compact current contract. Descendants are told to remain inside inherited scope, avoid editing root-owned state unless explicitly assigned, and return complete integration evidence.

The root `Stop` Hook checks only already-known state. If the task is not finalized it returns the exact open work, pending TODO count, and unresolved ancestry. It does not run another reviewer or create new acceptance criteria. Once finalization is recorded, the Hook has no control effect.

## Finalization and handoff

Finalization is atomic with TODO completion: a ledger write failure restores the prior TODO bytes. `doctor` validates required state files, exact root binding, semantic ledger shape, runtime event identity, open work, unresolved ancestry, finalization/TODO agreement, and local Git exclusion.

Source update, plugin refresh, Hook review/trust, activation, Git commit, and publication are separate boundaries.
