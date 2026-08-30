# Draft: `delete_statements` — filtered deletion from a saved graph

> Status: **MCP side implemented 2026-08-29** (`src/tools/deleteStatements.ts`,
> `DeleteStatementsSchema` in `src/schemas/index.ts`, shared graph lookup in
> `src/utils/graphLookup.ts`, `DELETION` instructions paragraph,
> `test/deleteStatements.test.mjs`). **App side in progress in parallel**
> (`POST /api/v1/deleteStatements` in `infranodus-app`); the MCP side was
> tested only against a stubbed `fetch` — see "Remaining live verification".
> Kill switch: `INFRANODUS_DELETE=0` hides the tool. Excluded from the
> KeywordGraph brand.

## Objective

Give the calling LLM one way to remove statements from a graph in the user's
own account, selected by a filter the **server** resolves (never by content
the model re-types), so that:

- a source that changed (a file, a page, a note) can be replaced: delete the
  statements that came from it, then `create_knowledge_graph` the new version
  to the same graph name;
- a graph can be rebuilt in place (`deleteAll`) without losing its name, URL,
  or settings such as `wikilinksMode`;
- mistaken or stale batches (a wrong upload, everything before a date) can
  be undone.

It is the first destructive tool in this repo. Everything about its shape
follows from that: dry run by default, one selector per call, own account
only, and an explicit `confirm: true` (or an accepted elicitation form)
before anything is removed.

## Why a filter, not ids

The model rarely holds statement ids; it holds *what it uploaded*: a file
path or page name it put in `categories`, a batch date, a phrase. Making the
app resolve the selection means the same filter is used for the preview and
for the write, so what the user approved is what gets deleted. `statementIds`
exists for the advanced case (ids returned by an earlier dry run or by
`retrieve_from_knowledge_base`) but is not the recommended path.

## Contract with the app endpoint (fixed)

`POST {apiBase}/deleteStatements`

```jsonc
{ "name": "<graphName>",
  "categories"?: string[],      // statements whose categories[] intersects (exact string)
  "statements"?: string[],      // exact content match (whitespace-normalised)
  "query"?: string,             // case-insensitive substring, or /regex/flags
  "before"?: string, "after"?: string,  // ISO dates; together they count as ONE selector
  "all"?: true,
  "statementIds"?: number[],    // advanced; foreign ids → ignoredIds
  "dryRun"?: boolean }
```

Exactly one selector. Response 200:

```jsonc
{ graphName, graphUrl, matchedCount,
  matched: [{ id, content, categories, timestamp }],   // capped at 200
  matchedByCategory?: { [category]: n },
  removedIds: number[], removedCount: n, ignoredIds?: number[],
  remaining: m, dryRun: boolean }
```

Errors: non-200 with `{ error }` — 400 bad selector, 403 anonymous or another
user's graph, 404 unknown graph, 500.

## MCP tool

### Schema (`DeleteStatementsSchema`)

| field | type | meaning |
|---|---|---|
| `graphName` | string, required | graph in the caller's own account. There is deliberately **no `userName`**: the tool cannot address another account's graph. |
| `categories` | string[] | statements carrying any of these labels — the per-source path (file path, page name, `[[label]]` parent) |
| `statements` | string[] | exact statement text |
| `query` | string | case-insensitive substring, or `/regex/flags` |
| `before`, `after` | ISO 8601 | time window; together they count as one selector. Validated client-side with the same rule as upload timestamps (`src/utils/graphInput.ts`) so an ambiguous date is refused rather than misread. |
| `deleteAll` | boolean | empties the graph but keeps it — name, URL and settings survive |
| `statementIds` | number[] | advanced only |
| `confirm` | boolean, default `false` | without it the call is a DRY RUN |

Cross-field validation (exactly one selector) is in the handler; a
`.refine()` on the schema would hide `.shape`, which registration needs.

### Handler

1. Exactly one selector, else an error result — no network.
2. Graph must exist in this account: retrying `/listGraphs` exact-name lookup
   (`findGraphByName`, extracted from the learnings code because the API's
   per-instance contexts-list cache can say "no" right after a create). Error
   if missing; never creates.
3. `POST /deleteStatements` with `dryRun: true` → the plan. `matchedCount: 0`
   returns `{ deleted: 0, matchedCount: 0, message }` without asking anyone.
4. Consent: `confirm: true`, or an elicitation form the user accepts (the
   message names the graph, the count, and up to five sample statements).
   Decline is a real no (`declined: true`, "do not retry"). A dismissed
   dialog or a client without elicitation returns the dry run with
   `nextStep`, so the question can be asked in chat.
5. Write: `POST /deleteStatements` with the **same filter** and
   `dryRun: false` → `{ deleted, removedIds, ignoredIds?, remaining, graphName, graphUrl }`.

Annotations: `readOnlyHint: false`, `idempotentHint: false`,
`destructiveHint: true`, `openWorldHint: false`.

### What the description must say

Irreversible; dry run by default; never call on your own initiative — only
when the user asked to delete, replace, or rebuild; `categories` is the
per-source replace path (delete, then `create_knowledge_graph` to the same
graphName); `deleteAll` is the in-place rebuild; a second call with the same
filter and `confirm: true` performs the deletion.

## Things deliberately not done

- No `userName`. Other users' graphs are read-only through this server.
- No confirmation bypass through environment or config. The only way to skip
  the dry run is `confirm: true` in the call, which the model must justify to
  the user.
- No client-side re-resolution of the filter between dry run and write. If
  the graph changed in between, the write reports what it actually removed
  (`deleted` may differ from the previewed `matchedCount`); the response
  carries both numbers so the difference is visible.
- No special casing of `learn-*` graphs. Deleting a learning the user no
  longer wants is a legitimate use.

## Done when

- [x] Tool registered, hidden by `INFRANODUS_DELETE=0`, excluded from KeywordGraph
- [x] Schema as above, no `userName`, cross-field check in the handler
- [x] Dry run default; `confirm: true` or accepted elicitation writes; decline never retries
- [x] Graph existence checked with the retrying lookup; never creates
- [x] `matchedCount: 0` short-circuits with no consent request and no write
- [x] Tests against a stubbed `fetch` (`test/deleteStatements.test.mjs`)
- [x] README, instructions, EXAMPLES, llms*.txt, about resource, ai-to-api doc updated
- [ ] Live verification once `/deleteStatements` is deployed (see testing brief)
