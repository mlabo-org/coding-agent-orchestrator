# Install Coding Agent Orchestrator with Codex

This is the source-owned installation contract for an agent installing the public plugin. It applies only after the user explicitly requests installation or activation.

## Complete public bundle

Installation must use the repository as one plugin bundle. The bundle includes, at minimum:

- `.codex-plugin/plugin.json`;
- `skills/coding-agent-orchestrator/SKILL.md`;
- `bin/coding-agents.mjs`;
- `hooks/hooks.json`; and
- `scripts/cao-state-hook.mjs`.

`hooks/hooks.json` registers `SessionStart`, `SubagentStart`, `SubagentStop`, and `Stop`. Every event invokes the bundled Hook runner through `${PLUGIN_ROOT}`. Do not install the skill or CLI separately from these Hook files.

## Canonical source

Resolve the current user's home directory from the operating system. The canonical checkout is:

```text
<user-home>/plugins/coding-agent-orchestrator
```

If the repository is not there, resolve its Git origin and clone it to that exact location. If the destination already exists, continue only when it is this repository and no user change would be overwritten. Never delete, reset, move, or replace an ambiguous destination. Never edit `~/.codex/plugins/cache/` directly.

## Preconditions

- Git is available.
- Node.js 22 or later is available.
- `codex` supports `plugin add`, `plugin list`, and `plugin marketplace list` with JSON output.
- The current request authorizes the personal-marketplace write and plugin installation.
- The complete public bundle listed above is present.

## Installation sequence

1. From the canonical checkout, read this file and the installation and Hook sections of `README.md` or `README.ja.md`.
2. Run `npm test` once. Stop if it fails.
3. Run `npm run plugin:install:check`. This is read-only. Require `status: ready`, all five `bundledFiles`, and all four `bundledHooks` in its JSON output.
4. Run `npm run plugin:install` once. The installer preserves unrelated marketplace entries, registers the entire local source checkout, invokes the official `codex plugin add`, and verifies the installed name and version with `codex plugin list --json`.
5. Restart Codex. Review and trust the bundled Hooks if the app requests it, then verify the plugin from a fresh task. Do not claim that the current task hot-loaded the new manifest, skill, or Hooks.

The installer does not copy isolated Hook files or patch an installed cache. The official plugin installation consumes the complete source bundle, so the Hook declarations and Hook runner travel with the skill and CLI.

## Completion report

Report the canonical source, plugin name and version, marketplace path and name, whether its entry was created or already matched, all bundled Hook events, the installed version reported by Codex, and the remaining restart/review/trust boundary.
