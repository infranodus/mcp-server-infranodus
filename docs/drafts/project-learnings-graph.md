# Draft: project learnings graph — agent self-reflection saved to InfraNodus

> Status: **implemented 2026-08-28** (`src/utils/learnings.ts`,
> `src/tools/{enable,add,get}ProjectLearnings.ts`, `save-learnings` prompt,
> `PROJECT LEARNINGS` instructions paragraph). See "Implementation notes"
> at the end for where the live API forced deviations from this spec.
> Originally written 2026-08-28 as a prompt-style spec for a coding agent or a human. Describes WHAT should change and HOW it must
> behave; implementation details are the implementer's unless they affect
> behaviour. Companion to `workflow-feedback-tool.md` — read the
> "Relationship to the feedback tool" section before assuming they share code.

## Objective

Let the LLM that operates inside a user's project (a repo, a vault, any named
body of work) reflect at the end of a task on what it learned about *working
in that project*, and save those learnings as statements in a per-project
InfraNodus graph — so the next session, on any client and any machine, can
retrieve them by query, by file, or by structure, and so the accumulated
learnings can be analyzed as a graph (traps cluster where? which modules have
code but no learnings?).

Everything is implemented in the **MCP server**. It must work with no skill,
no manifest, no local filesystem access, and in HTTP mode where the server
runs on Fly and never sees the user's machine. The `infranodus` Claude Code
skill may add conveniences on top later; nothing here depends on it.

## Non-negotiable: consent and data boundaries (read first)

Learnings are the user's own content — file paths, module names, decisions,
sometimes fragments of error output. They go to a cloud account. Therefore:

1. **Nothing is written unless the user enabled it, per project, explicitly.**
   Consent is recorded server-side as the existence of a graph the user
   created on purpose (see `enable_project_learnings`). No graph → the write
   tool refuses. The write tool never creates a graph.
2. **The user sees every batch before it is written** (elicitation form or a
   question relayed by the model), unless they said in their own words that
   they don't want to be asked — a per-conversation choice, never a stored
   default the server invented.
3. **Only project knowledge, never user knowledge.** "The model list lives in
   9 files" is a learning. "The user prefers short answers" is not — that is
   client-local memory and must never be written to a shared graph.
4. **Redaction before composition.** No secrets, tokens, hostnames, env
   values, customer data, verbatim error output, or file *contents*. Paths and
   descriptions only.
5. **Learnings never touch telemetry.** Nothing from these tools goes to
   `log_ai` or MCPcat beyond the ordinary "tool X was called" event.
6. **Instance-level kill switch.** `INFRANODUS_LEARNINGS=0` (and the
   KeywordGraph brand by default) removes all three tools and the prompt from
   the tool list, so no client ever sees them.

## Scope

One repo: `mcp-server-infranodus`. Three tools, one MCP prompt, one
instructions paragraph, one handler-wrapper extension for elicitation. No
changes to `infranodus-app`: everything is done with existing endpoints
(`/api/v1/graphAndStatements`, `/api/v1/search`, `/api/v1/listGraphs`).

Out of scope for v1: gap analysis between the learnings graph and repo graphs
(possible with existing `difference_between_texts`, document it, don't build
it), cross-project merges, any UI.

---

## Part 1 — Naming and the graph itself

- Graph name: `learn-<slug>`, where `<slug>` is the `project` parameter
  lower-cased, non-alphanumerics → `-`, truncated so the whole name is ≤ 28
  characters (the existing `AddMemorySchema` limit; keep the same rule).
- Created once by `enable_project_learnings` with `modifyAnalyzedText:
  "detectEntities"` (statements carry explicit `[[wikilinks]]`; free words are
  still useful for retrieval) and a **marker statement** as its first
  statement:
  `[[learnings:enabled]] Project [[<slug>]] learnings enabled on <ISO date> from <client name>.`
  The marker is how the write tool verifies consent (see 2.2). A graph with
  the right name but no marker is treated as *not enabled*.
- Append-only. Nothing is ever deleted by these tools. A learning that turns
  out wrong or stale is superseded by a new statement with a later timestamp
  (see 2.2 dedupe).

### Statement contract

One statement per learning. ≤ 2 sentences. Every statement has at least two
`[[entities]]` — file paths, modules, concepts, tools. Per-statement
metadata via the existing `categories` + `timestamps` fields:

- `type:<one of>` — `location` (where X lives), `trap`, `convention`,
  `decision` (must include the rationale), `workflow` (run/test/deploy/build),
  `question` (open), `approach` (self-assessment: what worked well and
  should be repeated, or what to do differently next time), `superseded`
  (points at what it replaces)
- `source:<client>` — from the client info the SDK exposes, else `unknown`
- ISO-8601 timestamp, server-stamped (not model-supplied)

Example (a real one from the session that produced this draft):

> `The list of available AI model names is duplicated in 9 places: the modelToUse enums in [[src/schemas/index.ts]], [[src/instructions.ts]], [[src/resources/about.ts]], [[README.md]], and the tool defaults in [[generateOntologyGraph.ts]] and [[analyzeLlmResults.ts]]. Source of truth is [[infranodus-app]] routes/ai.js getModelsAvailable and lib/ai.js defineModelToUse, which keeps old names as aliases.`
> categories: `["type:location"]`

### How `type` is submitted — plain per-statement metadata, not a node

`types[]` is converted server-side into the per-statement `categories:
string[][]` payload (`[["type-location"]]`) with parallel `timestamps`, sent
as a plain statements upload — **without** `categoriesAsMentions`.

Verified 2026-08-28 (`learn-zz-test-plaincats`): stored this way, each
statement comes back with `categories: ["type-trap"]`, the graph's nodes are
only the real `[[entities]]`, and `/search` by entity works. With
`categoriesAsMentions` on (the first implementation) every label became a
`[[type_x]]` mention node connected to every statement of that type — the
highest-betweenness nodes in the graph, which distorted clusters and gaps.
The user asked why the labels were not simply statement categories; they now
are.

Consequences:

- Filtering by type is client-side on `statement.categories`
  (`get_project_learnings` has a `type` parameter for the overview and prompt
  modes); the InfraNodus UI shows the categories on each statement.
- The "fragile areas" view is `get_project_learnings` with `type: "trap"`,
  not a `[[type_trap]]` neighbourhood.
- Consent is the marker statement (category `learnings-enabled` on the first
  statement), not a text-processing setting. Graphs created by the first
  implementation (`categoriesAsMentions: true`) keep working; their labels
  are nodes until the graph is deleted and re-enabled.
- Label naming still uses hyphens (`type-trap`).

### Admission criteria (what counts as a learning)

The tool description and the instructions paragraph must state all five:

- not derivable from the code, docs, or git history in a few reads
- would have saved time if known at the start of the task
- survived verification — only after the thing actually worked
- about the project, not about the person
- **adds insight, not just facts**: preferred are learnings that connect
  things that are not obviously connected — a cross-module dependency, a
  pattern that recurs across files, a non-obvious consequence of a design
  choice, a hypothesis about *why* something is the way it is — so that the
  graph accumulates original understanding of the project rather than a
  restatement of its structure. A `location` fact is admissible; a
  `location` fact with the reason it is scattered is better.

Zero learnings is a normal outcome for most tasks. The model must not pad.

---

## Part 2 — The tools

All three live in `src/tools/`, are exported from `src/tools/index.ts`, and
are added to `allTools` in `src/index.ts`. Schemas go in
`src/schemas/index.ts`. Gate all three plus the prompt behind
`process.env.INFRANODUS_LEARNINGS !== "0"` **and** `isToolEnabled`; add all
three to KeywordGraph's `excludedTools` in `src/config/brand.ts`.

### 2.1 `enable_project_learnings`

```ts
{ project: z.string().min(1) }
```

- Description (the model reads this): call **only when the user has
  explicitly asked** to start saving learnings for a project. Before calling,
  tell the user: what will be stored (project-operating knowledge, never
  personal data), where (their InfraNodus account, graph `learn-<slug>`,
  private), that it is append-only and can be deleted from InfraNodus at any
  time, and that each batch will be shown before saving unless they say
  otherwise.
- Behaviour: if `learn-<slug>` already exists with the marker → return
  `{ enabled: true, alreadyEnabled: true, graphName, url }`. Otherwise create
  it with the marker statement via the same path `memory_add_relations` uses,
  then return `{ enabled: true, graphName, url }`.
- Annotations: `readOnlyHint: false`, `destructiveHint: false`,
  `idempotentHint: true`, `openWorldHint: false`.

### 2.2 `add_project_learnings`

```ts
{
  project:    z.string().min(1),
  statements: z.array(z.string().min(1)).min(1).max(10),
  types:      z.array(z.enum(["location","trap","convention","decision","workflow","question","approach"])),
              // parallel to statements
  confirm:    z.boolean().default(false),
}
```

Behaviour, in order:

1. **Consent check.** Resolve `learn-<slug>`; fetch it (`graphAndStatements`
   with `includeStatements: true`, small `maxNodes`). If missing or without
   the marker → return `{ enabled: false, message: "Learnings are not enabled for <project>. Ask the user whether to enable them; if yes call enable_project_learnings." }`
   with `isError: false`. Do **not** create anything.
2. **Redaction lint** (server-side, cheap regexes): reject the batch with a
   clear message if any statement matches secret-like patterns (`sk-`,
   `Bearer `, `api[_-]?key\s*[:=]`, AWS-style keys, `://[^/]+@`, `.env`
   values) or is > 400 characters. Rejection message names the statement
   index, not its content.
3. **Dedupe.** For each statement, `/api/v1/search` against the graph (same
   call `search` tool uses). If a near-duplicate exists (top hit score above
   a threshold the implementer picks and documents), mark it
   `reinforced` and rewrite it to a one-line `Confirmed again: <original
   statement head>` with `type:<original>`; otherwise `new`.
4. **Dry run by default.** With `confirm: false` return the plan and write
   nothing:
   `{ enabled: true, wouldWrite: [{ statement, type, status: "new"|"reinforced" }], skipped: [...], graphName }`.
   The description says: show this to the user and call again with
   `confirm: true` only on their yes — or directly with `confirm: true` if
   the user has said they don't want to be asked.
5. **Elicitation path** (see Part 3). If the client supports elicitation and
   `confirm` is false, the server asks the user itself with a yes/no form
   listing the statements; on accept it writes immediately and returns
   `{ written: n }`; on decline/cancel it returns `{ written: 0, declined: true }`.
   Either way the model does not need to relay a question.
6. **Write.** `confirm: true` (or elicitation accepted) → append via the
   memory-add path with `statements`, `categories` = `["type:<t>",
   "source:<client>"]` per statement, server-stamped `timestamps`. Return
   `{ written: n, reinforced: m, graphName, url }`.

Annotations: `readOnlyHint: false`, `destructiveHint: false`,
`idempotentHint: false`, `openWorldHint: false`.

The response must be flat and unrewarding — no praise, no "great learnings" —
so clients don't start calling it to please.

### 2.3 `get_project_learnings`

```ts
{
  project: z.string().optional(),   // omit → list the user's learn-* graphs
  prompt:  z.string().optional(),   // task description → GraphRAG retrieval
  entity:  z.string().optional(),   // file path / module → relations for it
  limit:   z.number().int().min(1).max(50).default(15),
}
```

- No `project` → `listGraphs` filtered to `learn-*`; return names + slugs so
  the model matches an existing project name instead of guessing a new one.
- Graph missing → `{ enabled: false, learnings: [] }`, **not an error**, so
  this can be called freely at task start.
- `prompt` → the `retrieve_from_knowledge_base` path (`includeGraphSummary:
  true` so the model gets the structural hint — which areas have accumulated
  knowledge — plus the top statements).
- `entity` → the `memory_get_relations` path for that entity.
- Neither → `generate_contextual_hint` on the graph (overview only).
- Always return statements with their `type:` and timestamp; sort newest
  first within equal relevance so superseding statements win.

Annotations: `readOnlyHint: true`, `idempotentHint: true`.

---

## Part 3 — Prompting the user from the server (no skill involved)

Three routes; implement all three.

### 3.1 MCP elicitation (when the client supports it)

- Extend `wrapHandler` in `src/index.ts` so the `extra` object passed to
  handlers also carries `elicit` and `clientCapabilities`:
  `mcpServer.server.elicitInput` and `mcpServer.server.getClientCapabilities()`
  (SDK ≥ 1.18 has both; the repo is on 1.18.2). Only `add_project_learnings`
  uses them.
- Capability check: `clientCapabilities?.elicitation` truthy → use it.
  Otherwise fall through to 3.2.
- Form: message lists the statements (numbered, with type), schema is a
  single boolean `save` plus optional string `note` ("anything to change?").
  `action: "accept"` with `save: true` → write. `accept` with `save: false`
  or `action: "decline"` → an explicit no: `{ written: 0, declined: true,
  note? }`, do not retry (adjust once if a note asks for a change).
  `action: "cancel"` (dialog dismissed) or any transport error → **not** a
  decline: return the dry-run plan with an `elicitation` field explaining
  why, so the model asks in chat instead. (First live run from Claude Code
  on 2026-08-28 came back non-accept and was reported as "declined, do not
  retry" — indistinguishable from a failed request; fixed the same day.)
- Timeout: if the elicitation request errors or times out, behave as
  `confirm: false` (dry-run result with `elicitation: "elicitation failed: …"`),
  never as accepted and never as declined.

### 3.2 Model-relayed question (universal fallback)

- The dry-run response from 2.2 carries an explicit `nextStep` string:
  *"Show these to the user and ask whether to save them. Call again with
  confirm: true only if they agree."*
- The `instructions.ts` paragraph (Part 4) carries the same rule so it holds
  even when the model skips reading the tool response closely.

### 3.3 User-initiated: an MCP prompt `save-learnings`

Add to `src/prompts/index.ts` (same shape as the existing prompts). Optional
argument `project`. The prompt text instructs the model to: reflect on the
current session against the five admission criteria; produce 0–5 candidate
statements in the statement contract; call `get_project_learnings` to see
whether the project is enabled and what is already known; then
`add_project_learnings` (dry run → confirm). This is the route for clients
whose prompt menu exposes MCP prompts, and for users who want to save
mid-session rather than at the end.

---

## Part 4 — Making the model reflect at the right time

Add a `PROJECT LEARNINGS` paragraph to `src/instructions.ts`, after
WORKFLOW PATTERNS:

- At the **start** of a substantive task inside a named project, call
  `get_project_learnings` with the task as `prompt`. If `enabled: false`,
  carry on; do not suggest enabling unless the user asks about memory or
  repeats a discovery the model already made this session.
- At the **end** of a substantive task (multi-step, involved discovery,
  corrections, or a non-obvious fix), reflect against the five admission
  criteria and, if the project is enabled, propose learnings via
  `add_project_learnings` (dry run). Zero is fine.
- Before a first write for a project in a conversation, confirm with the
  user unless they have said not to. Never call `enable_project_learnings`
  without an explicit request.
- Never store anything about the user; only about the project.

Keep the paragraph under ~120 words; it is loaded into every session.

---

## Part 5 — Relationship to the feedback tool (`workflow-feedback-tool.md`)

Separate tools, separate sinks, opposite privacy constraints:

| | `submit_workflow_feedback` | project learnings |
|---|---|---|
| About | InfraNodus *tools* | the user's *project* |
| Reader | InfraNodus team | the user's next agent session |
| Sink | MCPcat + `log_ai` | the user's own graph |
| Contains user content | short paraphrases only (`workflow`, `usedExample`), same policy as stored prompts | only |
| Consent model | existing telemetry (`MCPCAT_ANONYMOUS` opt-out) | explicit per-project opt-in + review |

Shared: the discipline (observations, not opinions; only after verification)
and the moment (end of a workflow). The instructions paragraph may mention
both in one breath, but the implementation must not share a code path that
could route a learning into telemetry. One legitimate overlap — "in this
project, tool X needs option Y" — is both a `taskFit`/`defects` observation
and a `type:workflow` learning; the model may emit it to both, each through
its own tool.

---

## Part 6 — Optional skill layer (not part of this work)

When the `infranodus` Claude Code skill is present it can: record
`learn-<slug>` in `infranodus/manifest.json` for question routing, add a
Stop-hook reminder to reflect, and redirect learnings to local file memory
when the project isn't enabled. None of that is required for the server
behaviour above, and nothing above may assume it.

---

## Done when

- [x] `enable_project_learnings`, `add_project_learnings`, `get_project_learnings` registered; hidden when `INFRANODUS_LEARNINGS=0`; excluded for KeywordGraph
- [x] Write tool refuses (non-error) when the graph or marker is missing and never creates a graph
- [x] Redaction lint rejects secret-like statements with an index-only message
- [x] Dedupe marks near-duplicates `reinforced` and writes the short form — implemented as local word-set Jaccard (threshold 0.6) over the graph's statements, not via `/api/v1/search`; deterministic and no extra API semantics
- [x] `confirm` defaults to false and the dry run writes nothing
- [x] Elicitation used when `clientCapabilities.elicitation` is present; decline/timeout never writes
- [x] `get_project_learnings` lists `learn-*` graphs with no `project`, returns `enabled: false` without error when missing, supports `prompt` / `entity` / overview — the `entity` path returns content only (the `/search` endpoint carries no categories/timestamps)
- [x] `save-learnings` MCP prompt registered
- [x] `PROJECT LEARNINGS` paragraph in `instructions.ts` (130 words); README + `src/resources/about.ts` get one line each
- [ ] Tests in the repo — the repo has no test runner; consent refusal, marker check, redaction, dedupe, dry-run/confirm, elicitation accept/decline/error, and slug length were verified with ad-hoc scripts against the live API (2026-08-28), not committed
- [ ] Manual check from a client without elicitation (Claude Desktop) and one with (VS Code) — elicitation was exercised with stubs only; not yet tried from a real client

Spec items deliberately not implemented (see Implementation notes):

- `source-<client>` category — dropped (hub node)
- `type-superseded` — not offered as a type; a stale learning is corrected by adding a newer statement, and retrieval sorts newest first
- `modifyAnalyzedText: "detectEntities"` at creation — not set; nodes come from the explicit `[[wikilinks]]` the statement contract requires, which keeps the graph free of NER noise

---

## Implementation notes (what the live API taught us)

Verified end to end against infranodus.com on 2026-08-28 with a throwaway
graph `learn-zz-test-learnings` (delete it in InfraNodus when done).

1. **Reading a graph by name** through `/graphAndStatements` with
   `doNotSave=true` is a safe consent check: a missing name errors
   ("select an existing graph context") and is never created. (An earlier
   observation that only `includeGraph=true` + `optimize=develop` resolved a
   MEMORY graph was wrong — it was the cache in point 2; once the cache
   expired every parameter combination read the graph 8/8.)
2. **Multi-instance stale cache (app bug, not fixable here).** The app runs on
   more than one instance; each keeps a per-user contexts-list cache (6 min
   TTL, `lib/middleware/getOwnerContextsList.js`) that is only invalidated on
   the instance that handled the write. For minutes after a graph is
   created, a read on the other instance says it does not exist, and an
   *append* on that instance is treated as a create and rejected by the
   engine with `Context with this name already exists`. Mitigation in
   `src/utils/learnings.ts`: reads retry up to `READ_ATTEMPTS` (4) fresh
   requests and accept the first positive (a graph cannot be listed unless
   it exists); appends retry only on the "already exists" error. A negative
   consent check is trusted only when every attempt agreed — the residual
   failure mode is a false "not enabled" right after enabling, which refuses
   to write (the safe direction). `memory_add_relations` →
   `memory_get_relations` is exposed to the same lag today.
3. **Category labels are stored as statement metadata, not nodes** (the
   first implementation made them `[[type_location]]`-style nodes via
   `categoriesAsMentions`; replaced the same day — see "How `type` is
   submitted").
4. **No `source-*` category.** As a mention node the per-client label became
   the single most central node (betweenness 0.73). Dropped; the marker
   statement records the enabling client in its text. Moot now that
   categories are metadata, but not reinstated — the client name adds
   nothing a future session needs.
5. **An unfiltered `/listGraphs` omits MEMORY-type contexts**; listing with
   `query: "learn-"` includes them, which is what `get_project_learnings`
   uses when no project is given.
6. **`error` from the API can be an object** (`{ statusCode, message[] }`);
   `errorText()` normalises it.
