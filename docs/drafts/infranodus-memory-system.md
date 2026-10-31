# Draft: InfraNodus memory system: automatic recall and capture across sessions

> Status: **proposal, 2026-10-30.** Nothing implemented yet. This doc describes
> WHAT should change and HOW it must behave; implementation details are the
> implementer's unless they affect behaviour. Builds on
> `project-learnings-graph.md` (read its consent section first). Per-repo task
> lists: `docs/todo/memory-system.md` here, and the `docs/todo/memory-system.md`
> files in `infranodus-app`, `Skills/InfraNodus-Skills` and
> `infranodus-memory-plugin` (which also has the step-by-step `docs/plan.md`).

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
| **Learnings** (procedural) | How to work in a project: locations, traps, conventions, decisions, workflows, approaches | "infranodus-app tests need `node -r @babel/register`" | `learn-<project>` (+ `learn-<project>-inbox`) | Memory plugin: on from install, opt-out per project. MCP tools and skills: per-project opt-in, as today |
| **Memory** (declarative) | Entities and relations in a topic, case or client | "[[Legal Play]] is operated by [[Ways Ltd]]" | `mem-<topic>` (+ `-inbox`) | Per topic, through the MCP tools. The plugin doesn't read or write topic graphs in v1 |
| **Personal** | The user's preferences and working style, across projects | "Prefers plain-language summaries before details" | `me-<user>` (+ `-inbox`) | Separate, explicit opt-in everywhere, including the plugin |

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
   No network calls on this path. Nothing is recorded when the project is
   turned off, excluded or not a project (see "Default-on in the memory
   plugin"), and secrets are redacted before anything is written.
3. **Ingest** (PreCompact, SessionEnd). A detached worker posts the queue to
   `POST /api/v1/ingest`. The server makes one AI call that extracts short
   statements with `[[entities]]` marked and classifies each as
   learning / memory / personal. Statements for kinds that aren't enabled are
   dropped. The rest are deduplicated against the target graph and either
   supersede the statements they replace or are appended. Every statement is
   tagged with a `session-<id>` category so a whole session can be undone.
4. **Auto or review** (a per-scope mode, stored with the consent marker).
   - `auto` (default for the memory plugin): writes go straight to the main
     graph. The next recall says what was saved ("Saved 4 learnings from your
     last session") and `/memory forget-last` deletes them by their
     `session-<id>` category.
   - `review` (default for writes through the MCP tools; optional for the
     plugin): writes go to the `-inbox` graph. The next recall includes "N new
     learnings waiting", and `/memory review` (or the MCP review tool)
     promotes or discards them.
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
| `infranodus-memory-plugin` (new repo) | The memory plugin and its hook runtime | Claude Code plugin (hooks + `/memory` skill); stdlib-Python hook runtime (recall, local queue, redaction, ingest worker); adapters and installers for other clients; timing tests |
| `Skills/InfraNodus-Skills` | Skills and the marketplace | Lists `infranodus-memory` in `marketplace.json` from its own GitHub repo; small edits to `project-learnings` and `infranodus`; README |
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
| `POST /recall` `{ project, prompt, client, language? }` | Fast path for the hook: searches the project's learnings and personal memory if enabled (topic graphs are not searched in v1, see open question 1); returns `{ enabled, mode, firstRun, items: [{ kind, text }], saved?, gap?, inboxCount?, quotaPaused? }`, already formatted. `enabled` is true unless the project has a `memory-disabled` marker. Target p95 < 1.5 s |
| `POST /ingest` `{ project, excerpt, client, sessionId }` | One AI call to extract and classify; creates `learn-<slug>` (with the `learnings-enabled` marker, source `memory-plugin`) on the first ingest that yields statements; writes per mode; tags statements `session-<id>`. Returns 202 at once and extracts in the background (the counts reach the user through the next recall's `saved`). Idempotent per `sessionId` (a retried flush must not double-write). Refuses projects with `memory-disabled` |
| `POST /memory/disable` `{ project, deleteGraph? }` | Adds the `memory-disabled` marker (creating a minimal graph if none exists); optionally deletes the learnings graph. `/memory/enable-project` removes the marker |
| `POST /memory/forget` `{ project, sessionId? }` | Deletes the statements of one session (the last one by default) by their `session-<id>` category |

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

### Default-on in the memory plugin

Installing the `infranodus-memory` plugin is the consent for project
learnings: the install screen shows what it does, and it asks for the API key
there. After that it works in every project without an enable step. This
applies **only to the plugin** (its hooks and the `/recall` and `/ingest`
endpoints). The MCP tools, the `project-learnings` skill and the other skills
keep the per-project opt-in and the `confirm` step.

- **Opt-out, not opt-in.** A project is on unless it has a `memory-disabled`
  marker. `/memory off` sets it (and can delete the graph); `/memory on`
  clears it.
- **No empty graphs.** `learn-<slug>` is created at the first ingest that
  yields statements, with the `learnings-enabled` marker (source
  `memory-plugin`), so the MCP tools treat it as enabled from then on.
  Projects the plugin has never written to keep the normal opt-in flow.
- **Kinds.** Learnings: on. Topic memory: off in v1; the plugin neither
  reads nor writes topic graphs (ingest drops statements classified as topic
  memory). Personal memory: opt-in,
  as everywhere else.
- **`auto` by default, with undo.** Each session's statements carry a
  `session-<id>` category; the recall line reports what was saved, and
  `/memory forget-last` removes it.
- **Told once per project.** On the first session in a project, the hook shows
  the user (not only the agent) one line: "InfraNodus memory is on for
  `<project>` → graph link. `/memory off` to stop for this project."
- **Guards on the capture path:**
  - `userConfig.exclude_paths` (globs such as `~/clients/*`)
  - no capture in the home directory, temp folders, or folders that are not a
    git repo and have no project marker
  - redaction of API keys, tokens, private keys and `.env` contents before the
    queue is written
  - text inside `<private>…</private>` is never captured
  - `INFRANODUS_MEMORY_DISABLE=1` turns everything off,
    `INFRANODUS_MEMORY_DISABLE_CAPTURE=1` keeps recall only
- **Quota.** Ingest costs one AI call per session. When the account's limit
  is reached, ingest pauses, recall keeps working, and the recall line says
  so.
- **Not in `infranodus-all`.** A bundle install would turn on background
  capture for users who only wanted the graph tools. The plugin stays a
  separate install until the bundle can ask on first run.

### Consent and data boundaries (non-negotiable)

1. Nothing is captured or sent for a project the user turned off or excluded,
   or for a topic or person scope that isn't enabled. The hook uses the
   `enabled` flag returned by the session's first recall; the server checks
   again on `/ingest`.
2. Outside the memory plugin, the per-project opt-in and `confirm` stay as
   they are, and `review` is the default mode for MCP writes.
3. Personal memory has its own opt-in and its own graph. Ingest never writes
   facts about the user into learnings or topic memory.
4. The local queue never leaves the machine except through `/ingest`. It is
   redacted before writing and deleted after a successful ingest.
5. The skills README's "What gets uploaded and where" table and the InfraNodus
   privacy policy describe the plugin's default-on behaviour.

### Performance: never slow the agent down (non-negotiable)

Memory runs on every session in every project, so it must be invisible in
speed. A user should not be able to tell from latency that the plugin is
installed. If a choice trades memory quality against agent speed, speed wins.

| Path | Budget | How |
|---|---|---|
| Recall (first prompt only) | Hard timeout 2 s, server p95 < 1.5 s, typical < 500 ms | One HTTP call, no retries in the foreground; skipped on every later prompt |
| Capture (`PostToolUse`, `Stop`, …) | < 50 ms per hook | Append one line to a local file; no network, no parsing of large payloads (truncate tool output before writing) |
| Ingest (`PreCompact`, `SessionEnd`) | Hook returns in < 100 ms | Spawns a detached worker and exits; the upload and the AI call happen in the background and never block compaction or exit |
| Hook start-up | < 100 ms | Standard-library Python only, lazy imports, no dependency checks or installs at hook time, no background daemon |
| Context size | Recall block ≤ 5 items, ≤ ~1,500 characters | Small injections keep the agent's context and token cost flat |

- **Fail open.** Any error, timeout or missing key means no output and exit 0.
  The agent never waits on InfraNodus and never sees an error from it.
- **Back off.** If recall times out twice in a session, or the API returns 429
  or 5xx, skip recall for the rest of the session. A failed ingest stays in the
  queue and is retried by a later background worker, never in the foreground.
- **Async where the client allows it.** Hooks that return no output
  (capture, ingest) are registered as asynchronous where the client supports
  it (`async: true` in Claude Code), so they can't delay a tool call at all.
- **Bounded local state.** The queue per session is capped (oldest tool
  output trimmed first) so a long session doesn't produce a large file or a
  slow upload.
- **No extra tools.** The plugin reuses the shared InfraNodus MCP server
  (merged with the other plugins), so it adds no new tool definitions to the
  agent's context.
- **Measured.** Hooks log their own duration locally; tests fail when a hook
  exceeds its budget, and `/recall` latency is tracked server-side per client.

### Authentication for hooks

Hooks cannot reuse the MCP server's OAuth session. Phase 2: a required,
sensitive `userConfig.api_key`, asked for by Claude Code at install, so the
plugin is active as soon as it is installed. Later: an `infranodus login`
device-code flow at the first session start that stores a token in
`${CLAUDE_PLUGIN_DATA}`, after which the key becomes optional. If the key is
invalid, the hooks are a no-op, the first-run line says so once, and the MCP
tools keep working.

### Why a separate plugin for the hooks

- Claude Code merges duplicate MCP servers across plugins, but it does **not**
  merge hooks. Hooks in `infranodus`, `infranodus-all` and `project-learnings`
  would capture a session two or three times.
- Installing the plugin is the consent: it is on from install (see
  "Default-on in the memory plugin"), and users who want only graph analysis
  shouldn't get background capture.
- It needs an API key the core plugin shouldn't ask for.

It stays out of `infranodus-all` at first.

### Why a separate repo

- **It is a program, not a skill.** The skills repo is mostly Markdown
  instructions. The plugin is a hook runtime with a queue, redaction, a
  background worker, client adapters, installers and timing tests, so it needs
  its own CI, versions and releases.
- **It isn't tied to Claude Code.** `infranodus-memory hook <client> <event>`
  runs from Codex, Cursor, Windsurf and others, and can ship as a standalone
  CLI. In the skills repo it would always be a Claude plugin with extras.
- **It is easier to audit.** Default-on background capture deserves its own
  issues, changelog and security review, and the privacy policy can link to it.
- **Same install path.** The InfraNodus skills marketplace lists the plugin
  with a GitHub source pointing at this repo, so users install it like the
  other plugins. Its `mcpServers.infranodus` entry matches the others, so
  Claude Code still merges it into one server.

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
From InfraNodus memory (learn-infranodus-app, me):
- [learning] tests need `node -r @babel/register` (JSX reached via lib/live.js)
- [learning] language override lives in getContextForEntry (lib/context.js)
- [learning] Legal Play's custom API quota is set by manual SQL (no isCustom yet)
- [personal] prefers drafts written to the draft/ folder
Gap: quota decisions are never connected to the rate-limiter fix.
Saved 4 learnings from your last session (/memory forget-last to undo).
```

On the first session in a project, the user also sees (as a message to them,
not hidden context):

```
InfraNodus memory is on for infranodus-app → https://infranodus.com/<user>/learn-infranodus-app
/memory off to stop for this project.
```

## Phases

| # | Work | Repos | Visible result |
|---|---|---|---|
| 1 | Learnings and memory endpoints; MCP tools moved onto them | app, mcp | None (refactor), one implementation |
| 2 | `/recall`, `/memory/disable`; create the `infranodus-memory-plugin` repo; the plugin with the required key, the recall hook, the first-run line and `/memory off`/`on`; marketplace listing | app, memory, skills | Context at session start; nothing written |
| 3 | Local capture with guards and redaction, `/ingest` (auto mode, lazy graph creation, `session-<id>` tags), `/memory/forget`, quota pause; inboxes and `/memory review` for review mode | app, memory, skills, mcp | Full cycle, on from install |
| 4 | Personal memory, device login | all | Polish |
| 5 | Hooks for other clients: shared entry point and adapters, rules-file recall, installer per client (start with Codex CLI and Cursor) | memory, app | The same cycle outside Claude Code |

Before building phase 3, test extraction quality offline: run the ingest
prompt on 5–10 real session transcripts and hand-check precision (no
user facts in learnings, no trivia, decisions with reasons, no session-diary
statements). This is the main risk in the project, and default-on `auto`
mode makes it more so: nobody reviews what is written, so precision has to be
good before phase 3 ships.

## Open questions

1. ~~Topic memory linked to a project.~~ Decided 2026-10-31: v1 recall
   searches only the project's learnings (and personal memory once enabled).
   Topic graphs aren't linked to projects, searched by recall or written by
   the plugin; they stay available through the MCP memory tools. A
   `linkedTopics` marker in `learn-<slug>` can be added later.
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
7. ~~Where the plugin and multi-client code live.~~ Decided 2026-10-31: its
   own `infranodus-memory-plugin` repo from the start (plugin name `infranodus-memory`), listed in the InfraNodus
   skills marketplace (see "Why a separate repo").
8. Should `/memory off` delete the project's graph by default, or only stop
   capture? Proposal: only stop; deleting is a separate, explicit choice.
