# `delete_statements` — Known Behaviors

Domain: MCP `delete_statements` → infranodus-app `POST /api/v1/deleteStatements` (new endpoint,
implemented in parallel). Written 2026-08-29 from the MCP implementation and its stubbed-fetch
tests; app-side statements are the contract, not observed behaviour, until the live checklist in
`testing-briefs/2026-08-29-delete-statements.md` has been run.

## The consent shape is structural, not a prompt
- `confirm` defaults to `false` in the zod schema; without it the handler sends only
  `dryRun: true` and returns `deleted: 0, dryRun: true`.
- The write reuses the selector object built for the preview (`buildSelector` runs once). The
  two request bodies differ only in `dryRun`. Tests assert byte-equality of the rest.
- Elicitation is attempted only when both `extra.elicit` and
  `extra.clientCapabilities.elicitation` are present. The form's single boolean `delete`
  defaults to `false`; only `action: "accept"` with `delete: true` writes. `decline` and an
  unticked accept return `declined: true` ("do not retry"); `cancel` and transport errors return
  the dry run so the question can be asked in chat.
- `matchedCount: 0` returns before consent is considered — the user is never asked about an
  empty deletion, and no write request is sent.

## Selector rules (client-side, `buildSelector`)
- Empty arrays, blank strings, and `deleteAll: false` count as "not given".
- `before` and `after` are one selector; either alone is also valid.
- Dates use the same ISO-8601-only rule as upload timestamps (`timestampIsParsable` in
  `graphInput.ts`), for the same reason: the app's `convertAnyDate` reorders `03.05.2026`
  silently. A refused date costs zero requests.
- `deleteAll: true` is sent to the app as `all: true`.
- Cross-field validation lives in the handler, not in a `.refine()`, so `DeleteStatementsSchema.shape`
  stays available for `registerTool`.

## Graph existence
- `findGraphByName` (`src/utils/graphLookup.ts`, extracted from `learnings.ts`) does up to
  `READ_ATTEMPTS = 4` `/listGraphs` calls with `attempt: n` in the body and accepts the first
  exact `contextName` match. A negative costs four round-trips; tests for the unknown-graph case
  see four `/listGraphs` calls and zero `/deleteStatements` calls.
- A non-array `/listGraphs` response (e.g. a 500 body) is treated as "not found" — the error
  message then says "No graph named …" even though the real cause was the listing.
- There is no `userName` parameter anywhere in the schema or the request; the app resolves
  `name` inside the authenticated account and answers 403 otherwise (contract).

## Error surface
- `makeInfraNodusRequest` throws `API request failed (<status>): <body>` on non-2xx.
  `describeRequestError` parses the JSON body's `error` (or `message`, via `errorText`) and adds a
  one-line hint for 400 / 403 / 404. The tool never throws; every failure is `isError: true`
  with `{ error }` and a "nothing was deleted" sentence when the failure preceded the write.
- A 2xx body carrying `error` is also treated as failure (`errorText` handles the
  `{ statusCode, message[] }` envelope).

## Response sizes
- The app caps `matched` at 200; the tool shows at most `MATCHED_SHOWN = 50` of them in the
  dry-run result and reports `matchedShown` alongside `matchedCount`. The elicitation prompt
  quotes 5, each truncated to 160 characters, plus "… and N more".
- The write response echoes `removedIds` in full (contract: `removedIds: number[]`); for a
  `deleteAll` on a large graph this can be thousands of integers.

## Wiring
- Registered from `src/index.ts` behind `process.env.INFRANODUS_DELETE !== "0"`, mirroring
  `INFRANODUS_LEARNINGS` and `INFRANODUS_FEEDBACK`.
- Excluded for the `keywordgraph` brand in `src/config/brand.ts` (`excludedTools`), so the
  `llms*.keywordgraph.txt` files do not mention it.
- Annotations: `destructiveHint: true` — the first tool in this repo with it. Clients that gate
  on the hint (Claude Desktop shows an extra confirmation for destructive tools) add their own
  layer on top of the dry run.
