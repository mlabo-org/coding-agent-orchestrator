# CAO Native Execution Observation Specification

## Ownership

Native Codex is the only execution owner. It may choose no subagents, leaf workers, collaborative agents, recursive descendants, peer messaging, or a mixture. CAO never changes that topology.

CAO observes the resulting session tree so durable state remains exact.

## Immediate events

The installed plugin contributes four official command Hooks:

| Event | Exact control effect |
| --- | --- |
| `SessionStart` | Rehydrate state only when `session_id` equals the bound root thread. |
| `SubagentStart` | Resolve `agent_id` ancestry through app-server, record the event, and inject current constraints only for a matching descendant. |
| `SubagentStop` | Resolve ancestry and record lifecycle state; never close semantic work. |
| `Stop` | Continue only a matching root with known unfinished state; finalized state passes. |

Hook payloads provide the thread/agent identity, turn, model fact, working directory, and lifecycle event. CAO stores no raw prompt or assistant-message content in runtime event records.

## App-server reconciliation

CAO starts a short-lived official `codex app-server --stdio` client and negotiates the experimental protocol. It uses:

- `thread/read` for exact `parentThreadId` ancestry and thread metadata;
- `thread/list` with `ancestorThreadId` for recursive descendants;
- `thread/read(includeTurns: true)` for `collabAgentToolCall` and `subAgentActivity` items.

The normalized observations record sender/receiver thread IDs, tool kind, status, agent path, requested model/reasoning facts when present, and agent statuses. Prompt presence may be recorded as a boolean; prompt text is omitted.

The Desktop app's active app-server is connected to its host transport. CAO does not claim to attach to that private push stream. Hooks are the immediate trigger; official app-server readback is the reconciliation and recovery plane.

## Separation invariant

An observed start, message, wait, interruption, idle state, stop, or completed collaboration call is only a runtime fact. It cannot satisfy a work transaction, progress item, verification, or finalization requirement without parent integration and explicit semantic state.
