# `update_statements` — Known Behaviors

Domain: MCP `update_statements` → infranodus-app `POST /api/v1/updateStatements` (new endpoint,
implemented in parallel). Written 2026-08-29 from the MCP implementation and its stubbed-fetch
tests; app-side statements are the contract, not observed behaviour, until the live checklist in
`testing-briefs/2026-08-29-update-statements.md` has been run. Shares its consent shape, graph
lookup, and error surface with `delete_statements` (see `testing-knowledge/delete-statements.md`).

## Two modes, decided offline
- `buildUpdate` (pure) decides the mode: a non-empty `edits` array is Mode A; any selector field,
  `set`, or `replace` is Mode B. Both present → error with zero requests. Neither → error
  ("Nothing to do").
- Mode A: every item must have exactly one of `match` / `statementId` and at least one of
  `content` / `categories` / `timestamp`. `match` and `content` are trimmed; `categories` is
  sent as given (an empty array means "no categories"). Content over `MAX_CONTENT_LENGTH`
  (1000) is refused offline with the delete_statements + create_knowledge_graph hint.
- Mode B reuses `buildSelector(params, "all")` from `deleteStatements.ts`: same six selectors,
  same "exactly one" rule, same ISO-only date rule; the whole-graph flag is `all` (sent as
  `all: true`, the same wire field `deleteAll` maps to). Then `set` and/or `replace` is required.
- `set`: empty arrays in `addCategories` / `removeCategories` count as absent; `set.categories`
  with either of them is an error; `set.timestamp` goes through `timestampIsParsable`. An empty
  `set` object without `replace` is an error; with `replace` it is simply dropped from the body.
- `replace.with` may be the empty string (removes the match). `pattern` must be non-empty.

## The consent shape is structural, not a prompt
- `confirm` defaults to `false`; without it the handler sends only `dryRun: true` and returns
  `updated: 0, dryRun: true`.
- The write reuses the body object built for the preview (`buildUpdate` runs once). The two
  request bodies differ only in `dryRun`; the test asserts equality of the JSON strings, so key
  order is identical too.
- Elicitation is attempted only when both `extra.elicit` and
  `extra.clientCapabilities.elicitation` are present. The form's single boolean `apply`
  defaults to `false`; only `action: "accept"` with `apply: true` writes. `decline` and an
  unticked accept return `declined: true` ("do not retry"); `cancel` and transport errors
  return the dry run so the question can be asked in chat.
- The prompt says "Edit N of the M matched statement(s)" (N = `updatedCount`, M =
  `matchedCount`) and quotes up to 3 before → after lines, each side clipped to 120 characters,
  content in quotes, categories in brackets, timestamp bare.
- `matchedCount: 0` returns before consent is considered — the user is never asked about an
  empty update, and no write request is sent. The response still carries `unmatched` when the
  app sent it, so a Mode A call whose every `match` missed explains itself.

## Response shape
- Dry run: `updated: 0, dryRun: true, matchedCount, updatedCount, changesShown, changes (≤ 50 of
  the app's ≤ 200), unchanged?, unmatched?, rejected?, graphName, graphUrl?, mode
  ("edits" | "bulk"), selector (the selector kind, or "edits"), filter (the body minus
  name/dryRun), elicitation? (why the form was not used), nextStep`.
- Write: `updated, changesShown, changes, unchanged?, unmatched?, rejected?, graphName,
  graphUrl?, note?` — `note` only when `updated` differs from the preview's `updatedCount`.
- `updated` is the app's `updatedCount`, falling back to `updated.length`, then 0. A missing
  `matchedCount` in the plan counts as 0 and short-circuits — an app that omits it would make
  the tool a no-op rather than a silent writer.
- `unmatched` items are passed through untouched (the app decides their shape; the tests use
  `{ match }`), as are `rejected: [{ id, reason }]`.

## Graph existence and errors
- `findGraphByName` as for deletion: up to 4 `/listGraphs` calls, first positive wins, a
  negative costs four round-trips and yields "No graph named … Nothing was changed".
- `describeRequestError` is shared with deletion; the 400 hint reads "The request was rejected."
  (changed from "The filter was rejected." so it fits both tools). The tool never throws; every
  failure is `isError: true` with `{ error }`, and "nothing was changed" when the failure
  preceded the write.

## Wiring
- Registered from `src/index.ts` in the same spread as `delete_statements`, behind
  `process.env.INFRANODUS_DELETE !== "0"` — one kill switch hides both mutation tools.
- Excluded for the `keywordgraph` brand in `src/config/brand.ts`, so the `llms*.keywordgraph.txt`
  files do not mention it.
- Annotations: `destructiveHint: true` (old text is lost), `idempotentHint: true` (unlike
  deletion: re-applying the same body yields the same graph — a `match` edit finds nothing the
  second time, a `replace` finds nothing to replace). Clients that gate on `destructiveHint`
  add their own confirmation layer on top of the dry run.
- No `maxLength` on `content` in the zod schema, on purpose: a schema-level cap would surface
  as a generic SDK validation error instead of the handler's hint pointing to
  delete_statements + create_knowledge_graph.
