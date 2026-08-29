# Testing Brief: `delete_statements` — filtered deletion from a saved graph
Date: 2026-08-29
Status: MCP side implemented (branch `feat/delete-statements-tool`), app endpoint in progress in parallel, **not yet verified live**
Scope: `src/tools/deleteStatements.ts`, `DeleteStatementsSchema` in `src/schemas/index.ts`, `src/utils/graphLookup.ts` (extracted from `learnings.ts`), wiring in `src/index.ts` / `src/config/brand.ts`, `test/deleteStatements.test.mjs`

## Summary
The first destructive tool in this server. It sends one server-resolved filter to a new app
endpoint `POST /api/v1/deleteStatements`, first with `dryRun: true` (the plan), then — only after
`confirm: true` or an accepted elicitation form — with `dryRun: false`. Everything on the MCP side
was exercised against a stubbed `fetch`; the endpoint contract was taken from the plan, not from
running code. The risk is therefore concentrated at the boundary: what the app actually matches
for each selector, and whether the preview and the write agree on a live graph.

## What can be irreversibly lost
- Any statement in a graph of the caller's account that the filter matches. There is no undo,
  no trash, no versioning on the statement level.
- With `deleteAll`, every statement of the graph. The graph itself (name, URL, settings) is meant
  to survive — **unverified**; if the app removes an emptied context, the "rebuild in place"
  promise in the description is wrong.
- With `categories`, everything uploaded under a label. Labels are exact strings; a label used by
  two sources (e.g. a generic `notes` category) takes both.
- With `query` as a bare substring, everything containing that text anywhere — `"the"` would match
  most of an English graph. The dry run shows the count, which is the only guard.
- With `before` only (no `after`), everything older than the date — including a graph's original
  content when the caller meant "the batch I uploaded yesterday".

## What I verified vs. what I assumed
Verified by running `test/deleteStatements.test.mjs` (stubbed `fetch`, real handler, real
`runWithConfig`, built `dist/`):
- Without `confirm`, exactly one `/deleteStatements` request goes out and it carries
  `dryRun: true`; the result has `deleted: 0`, `dryRun: true`, the sample, `filter`, `nextStep`.
- With `confirm: true`, two requests: preview then write, with a byte-identical selector; the
  result's `deleted` is the stub's `removedCount`.
- Two selectors, or an ambiguous date, fail before any request (zero fetch calls).
- `/listGraphs` returning `[]` (after the 4 retries of `findGraphByName`) is an error and no
  delete request is sent.
- `matchedCount: 0` returns without invoking `elicit` and without a write.
- Elicitation: `accept` + `delete: true` writes in the same call; `decline`, `accept` with
  `delete: false`, and `cancel` never write (the first two return `declined: true`, the last
  returns the dry run).
- A non-200 on the preview surfaces as `isError` with the status and the app's `{ error }` text.
- The schema has no `userName`; `confirm` defaults to `false`; `.shape` is intact (no `.refine()`).
- `learnings.test.mjs` still passes after `READ_ATTEMPTS` / `errorText` moved to `graphLookup.ts`.

Assumed (from the plan's contract, not observed):
- The endpoint path is `/deleteStatements` under the same `apiBase`, accepts the body shape above,
  and returns `matchedCount`, `matched`, `removedCount`, `removedIds`, `remaining`, `graphUrl`.
- `before`/`after` are compared against the statement timestamp the API stores (the
  `timestamps` a caller uploaded, else upload time), inclusive/exclusive bounds unknown.
- `statements` exact match is whitespace-normalised on the app side; the MCP sends the strings
  untouched.
- `query` written as `/pattern/flags` is parsed as a regex by the app; anything else is a
  substring. An invalid regex is a 400.
- `all: true` keeps the context and its `textProcessingSettings`.
- 403 for another user's graph. The MCP only ever sends `name`, never `userName`, so a graph of
  the same name in another account cannot be addressed — but this depends on the app resolving
  `name` strictly within the authenticated user.

## Flows Affected

### A. Dry run (default)
- `buildSelector` → `findGraphByName` (4× `/listGraphs`) → `POST /deleteStatements {dryRun: true}` →
  result with `matched` capped at `MATCHED_SHOWN` (50) client-side.
- State deps: the app's per-instance contexts-list cache (a just-created graph may need the
  retries); the graph's current content.

### B. Confirmed write
- Same as A, then `POST /deleteStatements {dryRun: false}` with the identical selector.
- `deleted !== matchedCount` adds a `note` (graph changed between the two calls).

### C. Elicitation
- Only when `extra.elicit` and `extra.clientCapabilities.elicitation` are present. The form has
  one boolean, `delete`, defaulting to **false**.

### D. Per-source replace (the motivating workflow)
- `delete_statements {categories: [source]}` → user agrees → `confirm: true` →
  `create_knowledge_graph {graphName, statements, categories}`. Two tools, two consents.

## Risk Map

### 1. Preview and write disagree — SILENT on the app, visible in the tool
The selector is resolved twice. Between the calls another client may append or delete. The tool
reports both numbers; nothing else can be done client-side without ids. **Live check**: append
a statement between a dry run and a confirmed call and see `note`.

### 2. `deleteAll` removes the graph, not just its statements — LOUD later
If the app deletes an emptied context, the follow-up `create_knowledge_graph` creates a new graph
with default settings and a new URL. **Live check**: `deleteAll` on a small graph, then
`list_graphs` — the entry and its `textProcessingSettings` must still be there.

### 3. Category label case and whitespace — SILENT
The contract says exact string. Uploads through `create_knowledge_graph` send categories as
given, but the app lower-cases mention values when it builds nodes (see
`testing-knowledge/statements-categories-timestamps.md`). If matching is against the stored
metadata (case-preserved) a label typed in a different case matches nothing → `matchedCount: 0`,
which the tool reports as "nothing matched". **Live check**: upload with `["Docs/README.md"]`,
delete with `["docs/readme.md"]`.

### 4. `before` without `after` on a graph with mixed dates — SILENT
Expected by the contract, dangerous in practice. The dry-run count is the only signal. Consider
(app side) refusing `before` alone when it would match more than N% of the graph — out of scope
here; noted.

### 5. Retry lookup hides a transient listing failure as "unknown graph" — LOUD, wrong reason
`findGraphByName` treats a non-array `/listGraphs` response as "not found". Four 500s in a row
become "No graph named …". Acceptable (nothing is deleted), but the message misleads.

### 6. Model calls with `confirm: true` on the first call — by design, but worth watching
Nothing in the tool prevents a model from skipping the dry run. The description and the
`DELETION` instructions paragraph say not to; MCPcat will show whether models comply (look for
`delete_statements` calls whose params carry `confirm: true` with no preceding dry-run call in
the session).

## Edge Cases to Automate
Covered in `test/deleteStatements.test.mjs`: (a) dry run only, (b) confirm → preview + write with
the same filter, (c) two selectors → offline error, (c') before+after is one selector and a bad
date is refused offline, (d) unknown graph → error, no delete call, (e) zero matches → no consent
and no write, (f) no `userName` / `confirm` default, (g) elicitation accept writes, (h)
decline / unticked / cancel never write, (i) API error → `isError`, plus `buildSelector` units.

Not automated (needs the live endpoint): every "Assumed" item above, and Risks 1–3.

## Live smoke checklist (run once `/deleteStatements` is deployed)
1. Create `mcp-delete-smoke` with `create_knowledge_graph`: 6 statements, categories
   `["a.md"]` ×3 and `["b.md"]` ×3, timestamps spanning two days.
2. Dry run `categories: ["a.md"]` → `matchedCount: 3`, `matchedByCategory: {"a.md": 3}`.
3. Same with `confirm: true` → `deleted: 3`, `remaining: 3`; `retrieve_from_knowledge_base` shows
   only `b.md` statements.
4. `query: "/B\\.MD/i"` dry run → 0 (content, not category) — confirms `query` scope.
5. `before: <day 2>` dry run → count equals the day-1 statements still present.
6. `statementIds: [<one real id>, 999999999]` with confirm → `deleted: 1`, `ignoredIds: [999999999]`.
7. `deleteAll: true` with confirm → `remaining: 0`; `list_graphs` still lists the graph with the
   same `defaultRevisionUrl`; `create_knowledge_graph` to the same name refills it.
8. Another account's graph name → 403 surfaced as `isError` with the hint.
9. Unknown name → error from the lookup, no `/deleteStatements` call (check MCPcat / app logs).
10. Claude Desktop or another elicitation-capable client: the form appears with the count and the
    sample; `Cancel` returns the dry run; ticking the box deletes.

## Open Questions
- Are `before`/`after` inclusive? Timezone of a date-only value?
- Does `matched` in the write response repeat the preview list (cost on large deletions)?
- Should the app cap `all: true` or `before`-only deletions behind a second flag?
- Should `learn-*` graphs get a warning in the dry run? (Deliberately not special-cased now.)
