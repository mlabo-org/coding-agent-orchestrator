# Coding Agent Orchestrator

日本語 | [English](README.md)

> **アーキテクチャ更新:** 公式Codex Orchestration v2と、Lunaを含むモデル選択が、CAOの求めるsubagent実行を十分に担える状態へ更新されました。これに伴い、CAOプラグイン自身がsubagentをspawn・選択・配分・管理する仕組みは廃止しました。現在はライブオーケストレーションをすべてネイティブCodexへ任せ、公式app-serverとHookを、実行観測・記録・状態再注入・続行判定のトリガーとして使用します。

Coding Agent Orchestrator（CAO）は、コーディング時にAgentとネイティブなオーケストレーションを上位から管制し、その状態を永続的に記録するプラグインです。名前にある「Orchestrator」はworkerを直接配分する実行エンジンという意味ではなく、目的、scope、decision、work状態、runtime観測、証跡、handoffを固定する上位管制面を表しています。実際のオーケストレーションはネイティブCodexが行い、CAOはその全体を1つの永続契約へ束縛します。

CAO自身はsubagentを起動・選択・配分しません。タスク分解、モデルとreasoningの選択、spawn／fork、再帰的委任、agent間メッセージ、ライブ監督、統合、採否判断はネイティブCodexが所有します。

## 有効化条件

先頭の `CAO` / `CAOで` 指示、`$coding-agent-orchestrator`、skillの明示選択、またはactiveなCAOタスクの明示的続行時だけ有効になります。一般的なコーディング／subagent依頼、偶然の「CAO」表記、`.CAO/` の存在だけでは有効になりません。

## 状態管制

- `.CAO/` が現在のタスク状態のSSOTです。旧 `.coding-agents/` は非破壊の移行入力として残します。
- `intake` は `task_id`、`epoch`、`scope` を正確な `root_thread_id`（通常 `CODEX_THREAD_ID`）へ束縛し、同じrepoの古い状態が別セッションへ作用することを防ぎます。
- 実質的な責務は1つの `begin-work` と、completed／blocked／failed／interruptedのいずれか1つの結果で記録します。
- decision、progress、型付き証跡、runtime観測、finalization、handoffを分離して保持します。
- `verify --covers` は合格検証が裏付けるactive decision／completion IDを宣言します。`finalize` は全IDを明示的にcoverする合格済み検証、全workの終了、解決済みancestry、実在するsource/spec pathを要求します。

## Hookによる管制

公開plugin bundleには `hooks/hooks.json` と `scripts/cao-state-hook.mjs` を同梱します。各command Hookは `${PLUGIN_ROOT}` 経由で同梱runnerを呼び、`coding-agents hook-event` へイベントを渡します。Hookは最寄りの `.CAO/` を探し、その正確なroot-thread treeに属するイベントだけへ作用します。

| Hook | identity確認 | 効果 |
| --- | --- | --- |
| `SessionStart` | `session_id` が束縛済みrootと一致 | start、resume、clear、compaction後に短いtask contextを再注入。別sessionには何もしません。 |
| `SubagentStart` | 公式app-server `thread/read` のancestryが束縛済みrootへ到達 | lifecycle metadataを記録し、task、scope、decision、open work、authority、実行境界をその子孫へ注入します。 |
| `SubagentStop` | 同じ公式ancestry確認 | 停止観測を記録します。semantic workを閉じず、親による採用も意味しません。 |
| `Stop` | `session_id` が束縛済みrootと一致 | 未finalize、open work、未完了TODO、未解決ancestryがある間だけroot終了をblock。finalize済みなら追加reviewなしで通過します。 |

### 正確なthread境界とfail-closed

- root session不一致、または束縛tree外の子孫には、context注入・状態変更・stop制御を行いません。
- 子孫は公式ancestryで判定し、`cwd`、nickname、actor labelでは判定しません。
- 上限付き親チェーン内でancestryを解決できなければ `unresolved` として記録し、注入せず、finalization前のreconciliationを要求します。
- Hook観測は `.CAO/runtime-events/` 配下の冪等JSONで、再送がsemantic workを重複させません。

### 注入context

一致した `SessionStart`／`SubagentStart` は `CAO_STATE_CONTROL_ACTIVE` contextを出力します。task identity、root thread、scope、open work、governing decisions、継承authority、実行規則を含みます。assignmentが許すネイティブCodex collaborationを妨げず、親から状態責務を割り当てられていない子孫には `.CAO` を編集させず、runtime exitがsemantic acceptanceではないと伝えます。モデル、階層、委任深度、agent topologyは規定しません。

### runtime reconciliationとprivacy

`reconcile-runtime` は即時Hookを補い、正確なroot treeについて公式app-serverの `thread/list`／`thread/read` を読みます。取りこぼしや並行観測を回収し、可能ならancestryを解決し、未完了lifecycle threadを報告して、`semantic_completion_inferred: false` の型付き `runtime:<event-key>` receiptを発行します。

生のpromptやassistant messageはruntime eventへコピーしません。Hookはlifecycle metadataとlast assistant messageの有無だけを保持します。reconciliationもtool、sender、receiver、status、prompt／resultの有無という構造的事実だけを保存し、本文は保存しません。agent stop、thread idle、tool完了がsemantic progress、検証、採用へ変換されることはありません。

## 永続状態

| Path | 用途 |
| --- | --- |
| `.CAO/project.md` | workspace、Git状態、task identity、root束縛、lineage |
| `.CAO/task.md` | active task、scope、delivery mode、decision、completion contract |
| `.CAO/todo.md` | 永続progress |
| `.CAO/decisions.md` | accepted decisionとimpact |
| `.CAO/work.md` | semantic work transaction |
| `.CAO/audit.md` | 型付き証跡と未解決境界 |
| `.CAO/handoff.md` | 正確な続行状態。finalization後は `status: completed` |
| `.CAO/ledger.md` | append-only semantic transition |
| `.CAO/runtime-events/` | 冪等なHook／app-server観測 |

CAOは対象repoの `.git/info/exclude` に `.CAO/` を追加し、tracked `.gitignore` を変えずlocal task stateをversion control対象外にします。

## 標準workflow

1. `intake` でtaskとroot threadを束縛します。
2. `context` を読み、実質責務ごとに `begin-work` を開きます。
3. ネイティブCodexで実行・統合します。
4. work IDごとに1つのterminal resultと、factになったdecision／progressを記録します。
5. `verify --covers` でsealed acceptance evidenceを記録します。
6. collaboration使用後、またはHook ancestry未解決時に `reconcile-runtime` を実行します。
7. decision、completion、source/spec coverageを完全に指定して `finalize` します。
8. `doctor` を実行し、completed `handoff` を読みます。

## CLI

```text
coding-agents intake
coding-agents context
coding-agents begin-work
coding-agents complete-work | block-work | fail-work | interrupt-work
coding-agents decide
coding-agents progress
coding-agents verify
coding-agents reconcile-runtime
coding-agents finalize
coding-agents handoff
coding-agents doctor
```

`hook-event` は内部Hook entrypointでありworker runnerではありません。全引数は `coding-agents --help` で確認できます。

## Agentが自動インストールできる公開bundle

公開repoをcanonicalなpersonal plugin locationへcloneし、次を実行します。

```bash
git clone https://github.com/mlabo-org/coding-agent-orchestrator.git ~/plugins/coding-agent-orchestrator
cd ~/plugins/coding-agent-orchestrator
npm test
npm run plugin:install:check
npm run plugin:install
```

read-only checkはmanifest、skill、CLI、`hooks/hooks.json`、Hook runner、4種すべてのHook、canonical source path、Node version、marketplace planを確認します。installは無関係なpersonal-marketplace entryを保持し、checkout全体を登録して公式 `codex plugin add` を呼び、installed name／versionを検証します。installed cacheの直patchやHook単体installは行いません。

install後はCodexを再起動し、要求された場合は同梱Hookをreview／trustして、fresh taskからCAOを確認します。source edit、installation／cache materialization、Hook review／trust、activation、commit、publicationは別々の境界です。詳細は[Agent向けインストール契約](docs/INSTALL_FOR_CODEX.md)を参照してください。

## 検証

```bash
npm test
```

test suiteはidentity束縛、型付き証跡、finalization coverage、並行state write、root／descendant Hook、app-server reconciliation、prompt非保存、migration、routing metadata、Git除外、完全bundleのinstall planを対象にします。
