# Statements / Categories / Timestamps Upload Path — Known Behaviors

Domain: MCP `statements` content input → infranodus-app `/api/v1/graphAndStatements` and
`/api/v1/graphsAndStatements` → infrasonic `fromStatements/graphWithStatements`.
Verified 2026-08-02 by reading infranodus-app + infrasonic source and by executing
`convertAnyDate` and the zod schemas.

## contextSettings are applied ONLY at context creation
- `contextService.getContextForEntry()` (`lib/context.js:1037-1046`) merges
  `req.body.contextSettings` into `contextsObject.textProcessingSettings` **only when
  `!contextAlreadyExists`**. `contextAlreadyExists` is computed from `res.locals.contextslist`
  by exact `contextName` match (`lib/context.js:960-967`).
- Both `/graphAndStatements` and `/graphsAndStatements` run this same middleware
  (`app.js:1355-1376`), so the rule is uniform.
- Consequence: sending `categoriesAsMentions` (or any wikilinks bracket setting) to a graph that
  already exists is a **silent no-op**. The graph keeps the `textProcessingSettings` it was
  created with (`{...contextFound.textProcessingSettings}`).
- Practical trap: a graph first created from plain text, then appended to with
  `statements` + `categories`, produces **no `[[label]]` nodes** — the categories are stored as
  statement metadata and never tokenized. Returns 200, looks normal.
- For `doNotSave` requests with no name, `getContextForEntry` fabricates
  `uuidv4().split('-')[0]` (`lib/context.js:908-911`), which never collides with an existing
  context — so ephemeral analysis calls always get their settings applied.

## categoriesAsMentions is the category→node gate
- `infrasonic/apps/api/src/graph/extractNodesFromStatement.js:314-321`: when
  `categoriesAsMentions` is set, each non-empty category becomes a token
  `{ tag: 'mention', value: '@' + category }` appended to that statement's tokens.
  Without the setting, categories produce no nodes at all.
- `.filter(category => category)` drops empty-string labels — `categories: [[""]]` is harmless.
- Mention values are then `underscore()`d and `toLowerCase()`d (line ~338), so `"Page A"` and
  `"page a"` converge. A label that already contains brackets (`"[[Alice]]"`) does **not** get
  them stripped — it becomes a literal-bracket node that will not merge with the inline
  `[[Alice]]` node.

## Timestamps: Instruments.convertAnyDate (lib/tools/instruments.js:221-260)
- Only two formats get rewritten: `^\d{1,2}\.\d{1,2}\.\d{4}$` and `^\d{1,2}/\d{1,2}/\d{4}$`.
  Components are swapped **only when one part is > 12**. So `31/12/2026` and `13.05.2026` are
  correctly read as day-first, but `05/06/2026` and `05.06.2026` are **ambiguous and resolve to
  MM/DD (May 6)** — a day-first caller silently gets the wrong month for days 1-12.
- Everything else goes straight to `new Date(input)` (V8 tolerant parsing), so `"2026"`,
  `"5"`, `"0"`, `"Aug 2"` and the invalid `"2026-02-30"` all produce a date rather than an error.
- Returns `false` only when the resulting Date is invalid. The caller does
  `new Date(convertAnyDate(x))`, and **`new Date(false)` is 1970-01-01** — this is why the MCP
  validates client-side.
- Output is re-serialized with **local** getters: `MM/DD/YYYY HH:mm`. Two consequences:
  (a) seconds are truncated, so intra-minute ordering of a batch is lost;
  (b) a UTC instant near midnight shifts by the server's offset — `2026-08-02T23:30:00Z` on a
  UTC+2 host becomes `08/03/2026 01:30`, i.e. **the date advances by one day**.
- Empty string is safe: `generateStatementsToSubmit` (`routes/graphs.js:774-797` and the same
  helper used by `routes/entries.js:616`) guards with
  `timestamps && timestamps[index] ? new Date(convertAnyDate(...)) : new Date().toISOString()`,
  so `""` (and any falsy entry) becomes upload time, not 1970.
- Note the resulting array is heterogeneous: `Date` objects for supplied timestamps, ISO
  **strings** for the empty ones. Both survive `JSON.stringify`, but anything doing string or
  Date-method operations downstream would see two types.

## statements vs text take different app code paths
- `routes/entries.js:612-613`: `submittingStatements = req.body.statements && length > 0`.
  When true, `req.body.text` is **ignored entirely** — so sending `text: ""` alongside
  `statements` (as the MCP does) is inert.
- Statements → `Entry.submitAsArrayFromApi` → `/{userId}/contexts[/{id}]/fromStatements/graphWithStatements`.
  Text → `Entry.submitAsStringReturnGraphStatementsApi`. Different endpoints and payload shapes;
  equivalence of the resulting graph for identical content is **unverified**.
- `submitAsArrayFromApi` (`lib/entry.js:658-747`) posts to the `/{contextId}/` variant when the
  context already exists, i.e. it **appends** to that graph. Anonymous/demo users are forced to
  `doNotSaveGraph = true`.
- `maxNodes` is stripped from the body and moved to the query string on both paths.

## Multi-context (/graphsAndStatements) rules
- Statements are read only when `contextsToProcess.every(c => c.statements && c.statements.length > 0)`
  (`routes/graphs.js:160-162`). One text/url/graphName context demotes the whole array to the
  text branch, where `categories` are still forwarded per context but `timestamps` are not.
- A statements context **must** have a non-empty `name`, otherwise infrasonic's
  `fromStatements` route hangs (504 after ~2 min). The app now rejects this explicitly
  (`routes/graphs.js:172-178`) and also auto-names unnamed statements contexts for `doNotSave`
  requests (`lib/context.js:918-925`).
- `textProcessingSettings` is per-context with a shared fallback:
  `context.textProcessingSettings || textProcessingSettings` (`routes/graphs.js:224`), where the
  fallback derives from `req.body.contextSettings` via the first context's name.
- `addedContexts` for the multi route is taken from `req.body.contexts[0].name`
  (`lib/context.js:902-907`) — so the *first* context's name determines whether
  `contextAlreadyExists` blocks the shared settings for **all** contexts.

## Zod union precedence in the comparison context item (verified by execution)
The context-item union (`src/schemas/index.ts:1083-1124`) uses non-strict objects, so extra keys
are stripped and the **first matching member wins**:
- `{ text, statements }` → `{ text }` — statements silently dropped
- `{ graphName, statements }` → `{ statements }` — **graphName silently dropped**, the opposite
  of the single-tool contract where graphName wins
- `{ statements, timestamps }` → `{ statements }` — timestamps silently dropped
- `{ statements: [] }` → rejected by zod (the union member has `.min(1)`), whereas the
  single-tool `statementsField` has no `.min(1)` and relies on `validateStatementsInput`
- `{ statements: ["a", ""] }` → rejected by zod with a path-based message, so
  `validateStatementsInput`'s friendlier empty-entry message is unreachable through the MCP
  boundary; only whitespace-only entries (`"  "`) reach it

## Testing the MCP server without a mocking library
`src/api/client.ts` calls global `fetch`, and `getConfig()` (`src/api/config-store.ts:20-26`)
falls back to a default `{ apiKey: "", apiBase }` when no AsyncLocalStorage context is active.
A handler-level test therefore needs only: replace `globalThis.fetch` with a recorder returning a
canned `GraphResponse`, call `tool.handler(params)`, assert on the captured request body. No
module interception, no DI, no experimental flags.
