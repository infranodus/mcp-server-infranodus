# Testing Brief: `update_statements` — in-place editing of a saved graph's statements
Date: 2026-08-29
Status: MCP side implemented (branch `feat/update-statements-tool`), app endpoint in progress in parallel, **not yet verified live**
Scope: `src/tools/updateStatements.ts`, `UpdateStatementsSchema` / `UpdateStatementEditSchema` in `src/schemas/index.ts`, the `buildSelector(params, "all")` / `describeRequestError` exports added to `src/tools/deleteStatements.ts`, wiring in `src/index.ts` / `src/config/brand.ts`, `test/updateStatements.test.mjs`

## Summary
The second mutation tool in this server, built to the `delete_statements` shape. It sends one
request body to a new app endpoint `POST /api/v1/updateStatements`, first with `dryRun: true`
(the plan: before → after per statement), then — only after `confirm: true` or an accepted
elicitation form — with `dryRun: false`. Everything on the MCP side was exercised against a
stubbed `fetch`; the endpoint contract was taken from the plan, not from running code. The risk
concentrates at the boundary: what the app actually matches and rewrites for each mode, whether
`match` really is whitespace-normalised exact text, and how `replace` treats `[[wikilinks]]`.

## What can be irreversibly lost
- The previous content of every statement the request changes. There is no undo; the old text
  exists only in the dry-run output the model received (and in whatever the client logged).
- With `replace` on `all: true` and a short pattern (e.g. `"the"`), text everywhere in the graph.
  The dry run's `updatedCount` and `changes` are the only guard.
- With `set.categories`, the whole label list of every selected statement — including the
  source label that `delete_statements` `categories` later relies on for a per-source replace.
- With `set.timestamp` on a wide selector, the time axis of the graph (dynamic graphs, `before`/
  `after` filters).
- Nothing structural: ids, positions, the graph itself, and its settings are meant to survive
  every update — **unverified**.

## What I verified vs. what I assumed
Verified by running `test/updateStatements.test.mjs` (stubbed `fetch`, real handler, real
`runWithConfig`, built `dist/`):
- Without `confirm`, exactly one `/updateStatements` request goes out with `dryRun: true`; the
  result has `updated: 0`, `dryRun: true`, `matchedCount`, `updatedCount`, `changes`, `unchanged`,
  `mode`, `filter`, `nextStep`.
- With `confirm: true`, two requests: preview then write, byte-identical apart from `dryRun`
  (asserted on the JSON string, so key order too), in both modes.
- Both modes in one call, two selectors, no mode at all, Mode B without `set`/`replace`, an empty
  `set`, `set.categories` with `addCategories`, and an ambiguous date in any position fail before
  any request (zero fetch calls).
- `/listGraphs` returning `[]` (after `findGraphByName`'s 4 retries) is an error and no update
  request is sent.
- `matchedCount: 0` returns without invoking `elicit` and without a write.
- Elicitation: `accept` + `apply: true` writes in the same call and the prompt quotes "N of the M
  matched" and a before → after line; `decline`, `accept` with `apply: false`, and `cancel` never
  write.
- A non-200 on the preview surfaces as `isError` with the status, the app's `{ error }` text, and
  "nothing was changed".
- A write whose `updatedCount` differs from the preview adds `note`; `unmatched` and `rejected`
  are passed through.
- The schema has no `userName`; `confirm` defaults to `false`; `.shape` is intact.
- `buildUpdate` trims `match`/`content`, drops empty `addCategories`/`removeCategories`, refuses
  content over 1000 characters with the delete + create hint, treats `all: false` as absent.
- `deleteStatements.test.mjs` still passes after `buildSelector` gained the `allField` parameter
  and `describeRequestError` was exported (its 400 hint now reads "The request was rejected.").

Assumed (from the plan's contract, not observed):
- The endpoint path is `/updateStatements` under the same `apiBase`, accepts both body shapes,
  and returns `matchedCount`, `updatedCount`, `updated[].before/after`, `unchanged`,
  `unmatched`, `rejected`, `graphUrl`.
- `match` is compared whitespace-normalised against the stored content, like `statements` in
  `/deleteStatements`; the MCP trims but does not otherwise normalise.
- `replace.pattern` written as `/pattern/flags` is a regex, anything else a literal substring
  (every occurrence); `with` supports `$1` backreferences for regex patterns.
- `content` in Mode A is re-tokenised by the app so the graph's nodes and edges follow the new
  text; `replace` likewise. A statement whose new text is identical is counted in `unchanged`.
- `matchedCount` in Mode A counts the edits that found a statement; `unmatched` lists the ones
  that did not (by their `match`/`statementId`).
- The app enforces the 1000-character limit on the *result* of `replace` and reports the
  statement in `rejected` rather than truncating or failing the whole request.
- Ids, positions, and the statement's original `createdAt`/`timestamp` survive a content edit.
- 403 for another user's graph; the MCP never sends `userName`.

## Flows Affected

### A. Dry run (default)
- `buildUpdate` → `findGraphByName` (≤ 4× `/listGraphs`) → `POST /updateStatements {dryRun: true}`
  → result with `changes` capped at `CHANGES_SHOWN` (50) client-side.

### B. Confirmed write
- Same as A, then `POST /updateStatements {dryRun: false}` with the identical body.
- `updated !== updatedCount(preview)` adds a `note`.

### C. Elicitation
- Only when `extra.elicit` and `extra.clientCapabilities.elicitation` are present. The form has
  one boolean, `apply`, defaulting to **false**.

### D. Rename across a graph (the motivating Mode B workflow)
- `update_statements {all: true, replace: {pattern: "[[Old]]", with: "[[New]]"}}` → user agrees
  → `confirm: true`. One tool, one consent. Compare with the delete + re-create path, which
  needs two consents and loses positions.

### E. Fix one statement (the motivating Mode A workflow)
- `analyze_existing_graph_by_name {includeStatements: true}` → copy the exact text →
  `update_statements {edits: [{match, content}]}` → user agrees → `confirm: true`.

## Risk Map

### 1. `match` does not find the statement the model copied — SILENT (reported as unmatched)
The model copies text from an analysis result that may have been reformatted (wikilinks
rendered, whitespace collapsed, quotes normalised). If the app compares strictly, every edit
lands in `unmatched` and the dry run shows `matchedCount: 0`. **Live check**: copy a statement
verbatim from `analyze_existing_graph_by_name` output and from `retrieve_from_knowledge_base`,
edit it by `match`; then repeat with the same text with doubled spaces and a trailing newline.

### 2. `replace` inside `[[wikilinks]]` — SILENT, changes the graph structure
`[[router]]` → `[[dispatcher]]` is the point of the tool, but a substring pattern `router` also
hits `[[router-config]]` and plain-text "router". The dry run's before → after shows it; the
elicitation prompt shows only three. **Live check**: replace a substring that occurs both inside
and outside wikilinks, inspect `changes`, and verify node names in the graph afterwards.

### 3. Preview and write disagree — SILENT on the app, visible in the tool
As for deletion. **Live check**: edit a statement through the web UI between a dry run and a
confirmed call and see `note` / `unmatched`.

### 4. `set.categories` drops the source label — SILENT, breaks a later per-source replace
A model that means "add the label reviewed" but sends `set.categories: ["reviewed"]` wipes the
file-path label. The schema text says "replaces the current list" and `addCategories` exists;
the dry run's `before.categories` → `after.categories` shows the loss. **Live check**: confirm
the dry run renders both lists.

### 5. Result over 1000 characters after `replace` — LOUD (rejected) or SILENT (truncated)?
The contract says `rejected: [{ id, reason }]`. **Live check**: replace a short token with a
long one on a 990-character statement.

### 6. Re-tokenisation on content edit — SILENT
If the app updates the stored text but not the graph (nodes/edges), the visualisation and
`retrieve_from_knowledge_base` disagree. **Live check**: rename a concept with `replace`, then
`analyze_existing_graph_by_name` — the old node must be gone, the new one present.

### 7. Model calls with `confirm: true` on the first call — by design, but worth watching
As for deletion; look in MCPcat for `update_statements` calls with `confirm: true` and no
preceding dry run in the session.

## Edge Cases to Automate
Covered in `test/updateStatements.test.mjs`: (a) dry run only, (b) confirm → preview + write with
the identical body in both modes, (c) both modes / two selectors / nothing → offline error,
(d) Mode B without an operation, empty `set`, exclusive `set.categories` → offline error,
(e) unknown graph → error, no update call, (f) zero matches → no consent and no write, (g) no
`userName` / `confirm` default / all fields present, (h) ambiguous timestamp refused offline in
every position and a valid one passed through, (i) elicitation accept writes and the prompt
quotes count + sample, (j) decline / unticked / cancel never write, (k) API error → `isError`,
(l) drift `note` + `unmatched`/`rejected` pass-through, plus `buildUpdate` units.

Not automated (needs the live endpoint): every "Assumed" item above, and Risks 1–6.

## Live smoke checklist (run once `/updateStatements` is deployed)
1. Create `mcp-update-smoke` with `create_knowledge_graph`: 6 statements mentioning
   `[[alpha]]`, categories `["a.md"]` ×3 and `["b.md"]` ×3, timestamps spanning two days.
2. Mode A dry run: `edits: [{ match: "<exact text of statement 1>", content: "<new text>" }]`
   → `matchedCount: 1`, `changes[0].before.content` equals the original, `after.content` the new.
3. Same with `confirm: true` → `updated: 1`; `retrieve_from_knowledge_base` shows the new text
   with the **same id** and the graph's node list reflects the new wording.
4. Mode A with a `match` that does not exist and one that does → `matchedCount: 1`,
   `unmatched` lists the missing one, the write still updates the found one.
5. Mode B `categories: ["a.md"], set: { addCategories: ["reviewed"] }` with confirm →
   `updated: 3`, `after.categories` is `["a.md", "reviewed"]` (source label kept).
6. Mode B `all: true, replace: { pattern: "[[alpha]]", with: "[[beta]]" }` dry run →
   `matchedCount: 6`, `updatedCount` equals the statements containing `[[alpha]]`; with confirm
   → `analyze_existing_graph_by_name` has a `beta` node and no `alpha` node.
7. Mode B `query: "/beta/i", set: { timestamp: "2026-08-21" }` with confirm → timestamps changed,
   `before: "2026-08-22"` dry run on `delete_statements` now matches them.
8. Mode A `statementId` with a foreign id → listed in `unmatched`, no error.
9. `replace` that would push a statement over 1000 characters → `rejected: [{ id, reason }]`,
   the rest updated.
10. Another account's graph name → 403 surfaced as `isError` with the hint; unknown name → error
    from the lookup, no `/updateStatements` call.
11. Claude Desktop or another elicitation-capable client: the form appears with "N of the M
    matched" and before → after lines; `Cancel` returns the dry run; ticking the box applies.

## Open Questions
- Is `match` compared after the same normalisation the app applies on upload (whitespace,
  smart quotes, trailing punctuation)?
- Does `replace` with a plain substring match case-sensitively? (Assumed yes; the schema text
  says so.)
- Does a content edit change the statement's `updatedAt` only, or also its `timestamp` when no
  explicit timestamp was given? (Assumed: `timestamp` untouched.)
- Does `updated` in the write response repeat the full before/after list (cost on a large
  `all: true` replace)?
- Should `all: true` with `replace` be capped behind a second flag on the app side?
