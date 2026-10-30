# Draft: InfraNodus memory system: automatic recall and capture across sessions

> Status: **proposal, 2026-10-30.** Nothing implemented yet. This doc describes
> WHAT should change and HOW it must behave; implementation details are the
> implementer's unless they affect behaviour. Builds on
> `project-learnings-graph.md` (read its consent section first). Per-repo task
> lists: `docs/todo/memory-system.md` here, and the `docs/todo/memory-system.md`
> files in `infranodus-app` and `Skills/InfraNodus-Skills`.

## Objective

Give agents a memory that learns from sessions automatically and brings the
right context back at the start of the next one, stored as InfraNodus graphs in
the user's own account. Because memory is a graph, recall can also say what the
memory is missing: which topics dominate, which never connect, which modules
have traps but no conventions. Similarity-based memory stores can't do that,
and it is the reason to build this on InfraNodus.

## What exists today

| Piece | Where | What it does | What's missing |
|---|---|---|---|
| Project learnings | `src/utils/learnings.ts`, `src/tools/{enable,add,get}ProjectLearnings.ts` | Per-project `learn-<slug>` graph; 7 types as statement metadata; Jaccard dedup (0.6); consent marker `learnings-enabled`; `confirm` before writing | Depends on the agent deciding to reflect and to retrieve |
| Memory tools | `src/tools/addMemory.ts`, `getMemory.ts` (`memory_add_relations`, `memory_get_relations`) | Saves `[[entity]]` statements to a graph with `contextType: "memory"`; recall by entity name via `/search` or by whole graph | No naming rules (the LLM invents the graph name), no dedup, no supersession, no scopes, no consent |

Logic that should be shared across clients currently lives in the MCP server, in
TypeScript, on top of the generic REST endpoints. Hooks are shell commands and
cannot reuse it.

## The three kinds of memory

| Kind | Holds | Example | Graph | Consent |
|---|---|---|---|---|
| **Learnings** (procedural) | How to work in a project: locations, traps, conventions, decisions, workflows, approaches | "infranodus-app tests need `node -r @babel/register`" | `learn-<project>` (+ `learn-<project>-inbox`) | Per project, as today |
| **Memory** (declarative) | Entities and relations in a topic, case or client | "[[Legal Play]] is operated by [[Ways Ltd]]" | `mem-<topic>` (+ `-inbox`) | Per topic |
| **Personal** | The user's preferences and working style, across projects | "Prefers plain-language summaries before details" | `me-<user>` (+ `-inbox`) | Separate, explicit opt-in |

Project learnings keep their rule "never anything about the person". Personal
memory is the only place facts about the user may go, and only after its own
opt-in.

## The cycle

```
 session start ──► RECALL ──► work ──► CAPTURE (local) ──► session end ──► INGEST (server)
       ▲                                                                       │
       └───────────── next session starts with what was learned ◄──────────────┘
```

1. **Recall** (first prompt of a session). A hook sends the prompt and the
   project identity to `POST /api/v1/recall` with a 2 s timeout. The server
   searches the enabled graphs and returns a short, labelled block: up to 5
   items in total across learnings, memory and personal, plus at most one gap
   line. The hook injects it as `additionalContext`. On timeout or error it
   injects nothing and says nothing.
2. **Capture** (during the session). Hooks append to a local queue in the
   plugin's data folder: prompts, tool failures, files touched, final answers.
   No network calls on this path. If the project isn't enabled, nothing is
   recorded.
3. **Ingest** (PreCompact, SessionEnd). A detached worker posts the queue to
   `POST /api/v1/ingest`. The server makes one AI call that extracts short
   statements with `[[entities]]` marked and classifies each as
   learning / memory / personal. Statements for kinds that aren't enabled are
   dropped. The rest are deduplicated against the target graph and either
   supersede the statements they replace or are appended.
4. **Review or auto** (a per-scope mode, stored with the consent marker).
   - `review` (default): writes go to the `-inbox` graph. The next recall
     includes "N new learnings waiting", and `/memory review` (or the MCP
     review tool) promotes or discards them.
   - `auto`: writes go straight to the main graph.
5. **On demand.** The MCP tools keep working mid-task:
   `get_project_learnings`, `memory_get_relations`, `retrieve_from_knowledge_base`.

Clients without hooks (Claude web, ChatGPT) get recall and saving through MCP
when the agent chooses. Automatic capture is for clients with hooks, starting
with Claude Code (see "Hooks for other clients" below).

## Architecture: where each piece lives

| Repo | Role | Change |
|---|---|---|
| `infranodus-app` | **The single implementation**: naming, types, extraction, dedup, supersession, consent and mode, recall ranking | New `/api/v1/learnings/*`, `/memory/*`, `/recall`, `/ingest` |
| `mcp-server-infranodus` | Thin wrapper so every MCP client gets the same behaviour | Tools call the new endpoints; small schema additions; instructions |
| `Skills/InfraNodus-Skills` | Automation in Claude Code | New `infranodus-memory` plugin (hooks + skill); small edits to `project-learnings` and `infranodus` |
| `infranodus-backend` | Storage | Probably none: markers and inboxes are graphs and statements; `contextType: "memory"` exists |
| `legal-help` (Legal Play) | Consumer | Calls `/memory/*` and `/learnings/*` with its service key |

### API (`infranodus-app`)

| Endpoint | Behaviour |
|---|---|
| `POST /learnings/enable` `{ project, mode? }` | Creates `learn-<slug>` with the `learnings-enabled` marker (and a mode marker). Idempotent. Same semantics as today's tool |
| `POST /learnings/get` `{ project, prompt?, entity?, type?, limit? }` | Same as `get_project_learnings`; returns `enabled: false` without error when the graph is missing |
| `POST /learnings/add` `{ project, statements[], types[], confirm }` | Same as `add_project_learnings`: dry run unless `confirm`, refuses when not enabled, dedups |
| `POST /memory/enable` `{ scope: "topic"\|"personal", topic?, mode? }` | Creates `mem-<topic>` or `me-<user>` with a marker |
| `POST /memory/add` `{ scope, topic?, statements[], timestamps?[], confirm }` | Requires ≥ 2 `[[entities]]` per statement; dedups; supersedes by entity pair + relation |
| `POST /memory/get` `{ scope, topic?, entity?, prompt?, limit? }` | Entity lookup, or GraphRAG over the graph when `prompt` is given |
| `POST /recall` `{ project, prompt, language? }` | Fast path for the hook: searches enabled learnings, the topics linked to the project, and personal memory; returns `{ items: [{ kind, text }], gap?, inboxCount? }`, already formatted. Target p95 < 1.5 s |
| `POST /ingest` `{ project, excerpt, client, sessionId }` | One AI call to extract and classify; writes per mode; returns counts per kind. Idempotent per `sessionId` (a retried flush must not double-write) |

Usage: `recall` counts as an API call, `ingest` as an AI call (see the API quota
notes in the backend's `docs/custom-api-quota.md`). All endpoints take the
`language` body field added on `feat/api-processing-language`.

### Supersession rule

A new statement supersedes an existing one when both have the same entity pair
and the same type (learnings) or relation (memory), and the new one contradicts
or updates the old. The extraction call decides "updates or adds", given the
candidate old statements. The old statement is kept with its timestamp and a
`superseded` category, so time-filtered queries still find it, and is excluded
from recall.

### Consent and data boundaries (non-negotiable)

1. Nothing is captured or sent for a project, topic or person scope that isn't
   enabled. The hook checks locally first (cached enable state), the server
   checks again.
2. `review` is the default mode. `auto` is set only by the user's own request.
3. Personal memory has its own opt-in and its own graph. Ingest never writes
   facts about the user into learnings or topic memory.
4. The local queue never leaves the machine except through `/ingest` for an
   enabled scope. It is deleted after a successful ingest.
5. The skills README's "What gets uploaded and where" table gets a row for the
   memory plugin.

### Authentication for hooks

Hooks cannot reuse the MCP server's OAuth session. Phase 1: a sensitive
`userConfig.api_key` in the plugin. Later: an
`infranodus login` device-code flow that stores a token in
`${CLAUDE_PLUGIN_DATA}`. Without a credential, the hooks are a no-op and the MCP
tools keep working.

### Why a separate plugin for the hooks

- Claude Code merges duplicate MCP servers across plugins, but it does **not**
  merge hooks. Hooks in `infranodus`, `infranodus-all` and `project-learnings`
  would capture a session two or three times.
- Installing the plugin is part of the consent: hooks run on every prompt, and
  users who want only graph analysis shouldn't get background capture.
- It needs an API key the core plugin shouldn't ask for.

It stays out of `infranodus-all` at first.

## Hooks for other clients

Several coding agents besides Claude Code run shell hooks on session and tool
events (Codex CLI, Cursor, Windsurf, Gemini CLI, Kimi and others; OpenCode and
OpenClaw take in-process JS plugins instead). The memory cycle should work in
all of them without a separate implementation per client.

### One entry point, one adapter per client

Every client calls the same command with the client and the event:

```
infranodus-memory hook <client> <event>      # e.g. hook cursor prompt, hook codex stop
```

- **Normalize input.** Each client sends a different JSON payload on stdin
  (different field names for session id, prompt, tool name, file edits). A
  small adapter per client maps it to one internal event:
  `{ client, sessionId, cwd, event, prompt?, tool?, toolInput?, toolResult?, filePath?, toolUseId? }`.
  The events are the same four everywhere: `start`, `prompt`, `tool`, `stop`
  (plus `compact` where the client has it).
- **Shared core.** Recall, the local queue, the enable-state cache and the
  ingest worker are the same code for every client. Adapters never call the
  API themselves.
- **Format output.** Each adapter turns the core's result into what its client
  accepts: `hookSpecificOutput.additionalContext` where the client supports
  context injection (Claude Code, Codex), a plain `{ continue: true }` where
  it doesn't.
- **Unknown clients** fall back to a `raw` adapter that reads the internal
  event shape directly, so a new client can be wired up from its config file
  before it gets its own adapter.

### Clients that can't inject context: a rules file

Some clients let a hook observe prompts and tools but not add text to the
conversation. For those, recall writes its block to the client's
always-applied rules file in the project instead (for example
`.cursor/rules/infranodus-memory.mdc` with `alwaysApply: true`, or the
`.windsurf/rules/` equivalent). The file is refreshed on `prompt` and after a
successful ingest, carries a "generated, do not edit" header, and is added to
the project's `.gitignore` by the installer so recalled memory isn't
committed. The agent then sees the same block it would see in Claude Code.

### Clients without hooks

- **In-process plugins** (OpenCode, OpenClaw): a thin JS plugin that calls the
  same command (or the same endpoints) on the client's own events.
- **No hooks at all** (Claude web, ChatGPT, Copilot chat): MCP only, as today;
  the agent recalls and saves through the tools when it chooses. A later
  option is reading the client's local session transcripts at the next session
  start and ingesting them then, but only where those transcripts are
  documented and stable.

### Installer and registration

- `infranodus-memory install --client <name>` writes the client's hook config
  (its `hooks.json` or equivalent, user- or project-level), the MCP server
  entry if missing, and the rules file where needed. `uninstall` removes
  exactly what it wrote. Claude Code keeps using the plugin instead.
- Each client kills a hook after its own timeout. Keep a single table of the
  timeouts the installer registers per client, size the recall request budget
  from it (the client limit minus process start-up), and test that the
  registered configs match the table.
- Every hook command checks an off switch first
  (`INFRANODUS_MEMORY_DISABLE=1`, or `..._DISABLE_CAPTURE=1` to keep recall
  only) and exits 0 when it is set.
- `client` is sent with every `recall` and `ingest`, so usage and extraction
  quality can be compared per client, and `toolUseId` (where the client
  provides it) dedups repeated tool events in the queue.

## Recall output (what the agent sees)

```
From InfraNodus memory (learn-infranodus-app, mem-legal-play, me):
- [learning] tests need `node -r @babel/register` (JSX reached via lib/live.js)
- [learning] language override lives in getContextForEntry (lib/context.js)
- [memory] Legal Play → custom API quota PARTNER_LEGALPLAY (manual SQL, no isCustom yet)
- [personal] prefers drafts written to the draft/ folder
Gap: quota decisions are never connected to the rate-limiter fix.
3 new learnings waiting for review (/memory review).
```

## Phases

| # | Work | Repos | Visible result |
|---|---|---|---|
| 1 | Learnings and memory endpoints; MCP tools moved onto them | app, mcp | None (refactor), one implementation |
| 2 | `/recall` and the plugin with the recall hook only | app, skills | Context at session start; nothing written |
| 3 | Local capture, `/ingest`, inboxes, `/memory review` | app, skills, mcp | Full cycle in review mode |
| 4 | `auto` mode, personal memory, device login | all | Polish |
| 5 | Hooks for other clients: shared entry point and adapters, rules-file recall, installer per client (start with Codex CLI and Cursor) | skills, app | The same cycle outside Claude Code |

Before building phase 3, test extraction quality offline: run the ingest
prompt on 5–10 real session transcripts and hand-check precision (no
user facts in learnings, no trivia, decisions with reasons). This is the main
risk in the project.

## Open questions

1. Topic memory linked to a project: how does recall know which `mem-*` graphs
   belong to the project? Proposal: a `linkedTopics` marker in `learn-<slug>`.
2. Does `ingest` need the full excerpt, or should the hook pre-trim locally
   (last N turns, failures, final answers) to bound cost and data sent?
   Proposal: pre-trim to ≤ 6k tokens.
3. Personal memory scope: per InfraNodus account, or per client? Proposal:
   per account (`me-<username>`), readable from every client.
4. Old `memory_add_relations` graphs with free names: leave as they are, or
   offer a one-off migration into `mem-*`? Proposal: leave them; new writes
   use the naming rules.
5. Should a user's `CLAUDE.md`/memory files and InfraNodus personal memory
   stay separate? Proposal: yes; never sync automatically.
6. Runtime for the multi-client hook command: standard-library Python (no
   install, matches `repo2statements.py`, but needs Python 3 on the machine)
   or a Node CLI shipped with the npm MCP package (`npx` already used for the
   server, but Claude Code's native installer doesn't guarantee Node).
   Proposal: Python stdlib; revisit if a client's plugin API is JS-only.
7. Where the multi-client code lives: in `Skills/InfraNodus-Skills`
   (`skill-memory/`) next to the Claude Code plugin, or in its own repo once
   there are installers for several clients. Proposal: start in the skills
   repo, split later.
