# Draft: `update_statements` — in-place editing of a saved graph's statements

> Status: **MCP side implemented 2026-08-29** (`src/tools/updateStatements.ts`,
> `UpdateStatementsSchema` + `UpdateStatementEditSchema` in `src/schemas/index.ts`,
> selector and error helpers shared with `deleteStatements.ts`,
> `DELETION AND EDITING` instructions paragraph, `test/updateStatements.test.mjs`).
> **App side in progress in parallel** (`POST /api/v1/updateStatements` in
> `infranodus-app`); the MCP side was tested only against a stubbed `fetch` —
> see "Remaining live verification". Kill switch: `INFRANODUS_DELETE=0` hides
> this tool together with `delete_statements`. Excluded from the KeywordGraph
> brand.

## Objective

Give the calling LLM one way to change statements that are already in a graph
of the user's own account — their content, categories, or timestamp — **in
place**, so that:

- a wrong or outdated statement can be corrected without losing its id, its
  original date, and its position among the other statements (which
  `delete_statements` + `create_knowledge_graph` cannot preserve: the
  re-created statement lands at the end with a new id and upload time);
- a batch can be relabelled (add a category to everything from one source,
  move a source to a new path, fix a timestamp) without re-uploading it;
- a concept or a source path can be renamed across a whole graph with one
  find-and-replace (`[[Old Name]]` → `[[New Name]]`, `docs/old.md` →
  `docs/new.md`).

It is the second mutation tool in this repo and takes its shape from the
first: dry run by default, one mode per call, own account only, an explicit
`confirm: true` (or an accepted elicitation form) before anything is written,
and a byte-identical request body for the preview and the write.

## Two modes, one per call

**Mode A — `edits`.** The model already knows which statements to change: it
has their exact text (from `analyze_existing_graph_by_name` with
`includeStatements`, `retrieve_from_knowledge_base`, or an earlier dry run) or
their ids. Each item names exactly one statement (`match` xor `statementId`)
and at least one field to change. Unmatched items are reported, not errors:
a statement someone else edited in the meantime should not block the rest.

**Mode B — selector + operation.** The same six selectors as
`delete_statements` (with `all` instead of `deleteAll`, since nothing is
deleted) pick the statements; `set` changes their metadata, `replace` runs a
substring or regex replacement on their text. Both may be given together.
`set.categories` (full replacement) is exclusive with `addCategories` /
`removeCategories`.

Giving both modes in one call is an error before any request is sent.

## Contract with the app endpoint (fixed)

`POST {apiBase}/updateStatements`

```jsonc
// Mode A
{ "name": "<graphName>", "dryRun"?: boolean,
  "edits": [{ "match"?: string,        // exact current text (whitespace-normalised)
              "statementId"?: number,  // exactly one of match / statementId
              "content"?: string,      // ≤ 1000 characters
              "categories"?: string[], // full replacement
              "timestamp"?: string }] }// ISO 8601

// Mode B
{ "name": "<graphName>", "dryRun"?: boolean,
  // exactly one selector, as for /deleteStatements:
  "categories"?: string[], "statements"?: string[], "query"?: string,
  "before"?: string, "after"?: string, "all"?: true, "statementIds"?: number[],
  "set"?: { "addCategories"?: string[], "removeCategories"?: string[],
            "categories"?: string[], "timestamp"?: string },
  "replace"?: { "pattern": string /* substring or /regex/flags */, "with": string } }
```

Response 200:

```jsonc
{ graphName, graphUrl, matchedCount, updatedCount,
  updated: [{ id, before: { content, categories, timestamp }, after: { … } }], // capped at 200
  unchanged: n, unmatched?: [...], rejected: [{ id, reason }], dryRun }
```

Errors: non-200 with `{ error }` — 400 bad body, 403 anonymous or another
user's graph, 404 unknown graph, 500.

## MCP tool

### Schema (`UpdateStatementsSchema`)

| field | type | meaning |
|---|---|---|
| `graphName` | string, required | graph in the caller's own account. There is deliberately **no `userName`**. |
| `edits` | `UpdateStatementEditSchema[]` | Mode A. Each item: `match` xor `statementId`; at least one of `content`, `categories`, `timestamp`. |
| `categories`, `statements`, `query`, `before`, `after`, `all`, `statementIds` | as in `DeleteStatementsSchema` | Mode B selector; exactly one. `all` replaces `deleteAll`. |
| `set` | object | Mode B: `addCategories`, `removeCategories`, `categories` (exclusive with add/remove), `timestamp` |
| `replace` | `{ pattern, with }` | Mode B: substring or `/regex/flags`; `with` may be empty |
| `confirm` | boolean, default `false` | without it the call is a DRY RUN |

Cross-field rules live in the handler (`buildUpdate`), not in a `.refine()`,
so `.shape` stays available for registration. Timestamps in every position
(`edits[].timestamp`, `set.timestamp`, `before`, `after`) go through
`timestampIsParsable` so an ambiguous date is refused offline. Content over
1000 characters is refused offline with the delete + create hint.

### Handler

1. `buildUpdate`: one mode, well-formed, else an error result — no network.
   Mode B reuses `buildSelector(params, "all")` from `deleteStatements.ts`.
2. Graph must exist in this account (`findGraphByName`). Error if missing;
   never creates.
3. `POST /updateStatements` with `dryRun: true` → the plan. `matchedCount: 0`
   returns `{ updated: 0, matchedCount: 0, message }` without asking anyone.
4. Consent: `confirm: true`, or an elicitation form the user accepts (the
   message names the graph, "N of the M matched", and up to three
   before → after samples; the form's boolean `apply` defaults to false).
   Decline is a real no (`declined: true`, "do not retry"). A dismissed
   dialog or a client without elicitation returns the dry run with
   `nextStep`, so the question can be asked in chat.
5. Write: `POST /updateStatements` with the **same body** and `dryRun: false`
   → `{ updated, changes, unchanged, unmatched?, rejected?, graphName, graphUrl }`
   plus a `note` when `updated` differs from the previewed `updatedCount`.

Dry-run result: `{ updated: 0, dryRun: true, matchedCount, updatedCount,
changesShown, changes (≤ 50), unchanged, unmatched?, rejected?, graphName,
graphUrl, mode, selector, filter, nextStep }`. `filter` is the request body
minus `name`/`dryRun`, i.e. exactly what the write will send.

Annotations: `readOnlyHint: false`, `idempotentHint: true` (applying the
same edit twice yields the same graph — a Mode A edit with `match` simply
finds nothing the second time), `destructiveHint: true`, `openWorldHint: false`.

### What the description must say

In place, keeping id, date and position (unlike delete + re-create); Mode A
for specific statements, Mode B for bulk relabelling or find-and-replace;
1000-character cap with the delete + create alternative; dry run by default,
show before → after, `confirm: true` applies; irreversible — old text is only
in the dry-run output; never call on own initiative.

## Things deliberately not done

- No `userName`; no confirmation bypass through environment or config.
- No client-side re-resolution between dry run and write; the response
  carries both counts so a drift is visible.
- No client-side application of `replace` to preview the result: the app is
  the only place that knows the stored (whitespace-normalised) text, so the
  before → after pairs come from its dry run.
- No length check on the *result* of a `replace` (only the app knows it);
  the app reports such statements in `rejected`.
- No content-length cap in the zod schema (`maxLength`), so the handler can
  return the helpful hint instead of a generic validation error.

## Done when

- [x] Tool registered under the `INFRANODUS_DELETE` gate, excluded from KeywordGraph
- [x] Schema as above, no `userName`, cross-field checks in the handler
- [x] Dry run default; `confirm: true` or accepted elicitation writes; decline never retries
- [x] Graph existence checked with the retrying lookup; never creates
- [x] `matchedCount: 0` short-circuits with no consent request and no write
- [x] Tests against a stubbed `fetch` (`test/updateStatements.test.mjs`)
- [x] README, instructions, EXAMPLES, llms*.txt, about resource, ai-to-api doc updated
- [ ] Live verification once `/updateStatements` is deployed (see testing brief)
