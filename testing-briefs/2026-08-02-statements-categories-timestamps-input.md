# Testing Brief: `statements` / `categories` / `timestamps` content input
Date: 2026-08-02
Status: Post-implementation (commit 544ca48 + working tree), pre-merge
Scope: `src/utils/graphInput.ts`, `src/utils/wikilinksMode.ts`, `src/schemas/index.ts`, 16 tool handlers

## Summary
An optional `statements: string[]` content input now sits alongside `text`/`url` on 16 tools,
with two parallel metadata arrays (`categories`, `timestamps`). The mechanics inside this repo
are sound — the validator, the payload builder and the settings merge all do what the comments
claim. The risk is almost entirely at the **boundary**: what the InfraNodus app does with the
payload once it arrives, and what the zod union silently discards before the handler ever runs.
Nothing here fails loudly. Every meaningful failure mode I found produces a plausible-looking
graph with the wrong content, the wrong dates, or missing category nodes, and returns 200.

## What I verified vs. what I assumed
Verified by reading source (this repo + `/Users/dmt/Software/infranodus-app` +
`/Users/dmt/Software/infrasonic`):
- `contexts.every(c => c.statements && c.statements.length > 0)` — `routes/graphs.js:160`.
- Statements context without `name` is now a proper error, not a 504 — `routes/graphs.js:172-178`.
  The app also auto-names unnamed statements contexts for `doNotSave` requests
  (`lib/context.js:918-925`), so the MCP's fabricated names are belt-and-braces, not load-bearing.
- Empty-string timestamp → upload time. `generateStatementsToSubmit` (`routes/graphs.js:774`)
  guards with `timestamps && timestamps[index] ? new Date(convertAnyDate(...)) : new Date().toISOString()`.
  **The "empty string = none" contract holds.**
- `convertAnyDate` (`lib/tools/instruments.js:221-260`) — see Risk 3/4; I ran it against the
  client validator over 20 inputs.
- `contextSettings` → `textProcessingSettings` merge is gated on `!contextAlreadyExists`
  (`lib/context.js:1037-1046`). This is Risk 1.
- `categoriesAsMentions` is what turns a category into a node
  (`infrasonic/apps/api/src/graph/extractNodesFromStatement.js:314-321`); empty-string labels are
  filtered out there, so `[[""]]` is harmless.
- Statements and text take **different app submit functions** —
  `Entry.submitAsArrayFromApi` vs `Entry.submitAsStringReturnGraphStatementsApi`
  (`routes/entries.js:702-718`).
- `req.body.statements` wins over `req.body.text` on the single-graph route
  (`routes/entries.js:612-613`), so the `text: ""` this repo sends alongside statements is inert.

Not verified: whether the deployed production app matches this checkout (the timestamp-504 fix
referenced in `graphInput.ts:155-159` exists in the source I read — I cannot tell if it is live).
Treat every "app-side" claim as "true of main, unknown of prod".

## Flows Affected

### A. Single-tool statements path (13 analysis tools + generate/create/memory)
- **Current**: `text` or `url` → one text blob → `/graphAndStatements`.
- **Change**: `statements` skips splitting; `prepareStatementsPayload` emits
  `{ text: "", statements, categories?, timestamps?, contextSettings? }`.
- **Critical path**: mutual-exclusion check → `validateStatementsInput` → payload build →
  handler spread into body → app `submitAsArrayFromApi`.
- **State deps**: none client-side. Server-side: whether the target context already exists
  (Risk 1), and the account's default `doubleSquarebracketsProcessing`.

### B. `graphName`-as-content tools (content gaps, clusters, hint, research Q/ideas, responses, latent, bridges, optimize, develop_text)
- **Change**: `graphName` still checked first; statements only reached in the `else`.
- **Critical path**: `params.graphName?.trim()` truthy → statements/categories/timestamps are
  discarded with no message. Consistent across all 9 — I checked each.

### C. `graphName`-as-destination tools (`create_knowledge_graph`, `memory_add_relations`)
- **Change**: body is `{ name: graphName, ...input.payload }` — both name and statements sent.
- **Critical path**: this is the only flow where statements land in a **persisted** graph, and
  the only flow where the graph may already exist. Risk 1 lives here.

### D. Comparison contexts (overlap / difference / merged)
- **Change**: `{ statements, categories }` union member; `resolveContexts` names each statements
  context `${uuidFrag}-${i+1}`, flattens to text if any context lacks statements, and lifts a
  single shared `contextSettings` to the body top level.
- **State deps**: all-or-nothing. One `{ url }` in the array silently demotes every statements
  context to joined text and drops all categories.

### E. `generate_seo_report` (hand-rolled, does not use `resolveGraphInput`)
- Step 1 sends the real statements payload; steps 4/5 send `statements.join("\n")` as text.
  Keyword extraction sees category nodes, the gap comparisons do not.

## Risk Map

### 1. Categories silently do nothing when the target graph already exists — SILENT
- **Scenario**: user runs `memory_add_relations` (or `create_knowledge_graph`) with
  `statements` + `categories` against a graph that already exists and was created without
  categories. `lib/context.js:1037` only merges `req.body.contextSettings` into
  `textProcessingSettings` when `!contextAlreadyExists`; otherwise the stored settings are used.
  `categoriesAsMentions` is therefore never set, and `extractNodesFromStatement` skips the
  category→mention conversion entirely.
- **Likelihood**: HIGH. Appending to an existing memory graph is the primary use of that tool,
  and it only manifests on the *second* call — a fresh-graph manual test cannot see it.
- **Impact**: categories are stored as statement metadata but produce **zero** `[[label]]` nodes.
  The tool returns 200 with a normal-looking graph. The user concludes categories are broken
  at random.
- **Suggestion**: this is a documentation/design gap, not a code bug — the `categories` field
  description promises "Each label becomes a `[[label]]` node" with no caveat, while
  `wikilinksMode` already carries the "existing saved graph keeps its original setting" warning.
  The same warning belongs on `categories`. A first-call probe (list_graphs) or an explicit
  error is the alternative.

### 2. Comparison context item: zod union silently picks the wrong content source — SILENT
- **Scenario**: verified by running the actual union.
  - `{ graphName: "g", statements: [...] }` → parses to **`{ statements: [...] }`**. The graph
    reference is dropped. This is the *opposite* of the documented "graphName wins" contract
    that holds everywhere else.
  - `{ text: "...", statements: [...] }` → parses to `{ text }`; statements dropped.
  - `{ statements: [...], timestamps: [...] }` → timestamps stripped (intended per the app-side
    504 note, but with no signal to the caller).
- **Likelihood**: MEDIUM-HIGH. The union is described as "exactly one of", but LLM callers
  routinely emit an extra key, and there is no `.strict()` to reject it.
- **Impact**: the comparison runs against content the user never asked for — the most trust-
  destroying failure in the feature, because the output is a perfectly valid overlap/difference
  graph of the wrong thing.
- **Suggestion**: `.strict()` on the union members turns all three into loud errors.

### 3. `DD.MM.YYYY` vs `MM/DD/YYYY` is undecidable when both parts are ≤ 12 — SILENT
- **Scenario**: `convertAnyDate` swaps components only when one is > 12
  (`instruments.js:228-249`). `"05/06/2026"` and `"05.06.2026"` both fall through to
  `new Date(...)` → **May 6**. A caller intending 5 June gets 5 May. The `timestamps` field
  description explicitly advertises "DD.MM.YYYY and MM/DD/YYYY also parse", which invites this.
- **Likelihood**: MEDIUM. Roughly 40% of all day/month pairs are ambiguous; an LLM handed
  European-formatted source dates will use them.
- **Impact**: statements land on the wrong date, in the wrong month, in time-filtered and
  dynamic graph views. No error anywhere.
- **Suggestion**: the client validator is the only place this can be caught. Either advertise
  ISO only, or reject `\d{1,2}[./]\d{1,2}[./]\d{4}` where both parts ≤ 12.

### 4. Timestamps are re-serialized in server-local time and truncated to the minute — SILENT
- **Scenario**: `convertAnyDate` returns `` `${pad(getMonth()+1)}/${pad(getDate())}/${getFullYear()} ${pad(getHours())}:${pad(getMinutes())}` `` — all **local** getters, seconds discarded.
  On a UTC+2 server, `"2026-08-02T23:30:00Z"` becomes `08/03/2026 01:30` — **the date advances
  by one day**. Verified by running the function.
- **Likelihood**: MEDIUM (any UTC timestamp after 22:00, or before 02:00 on a negative-offset host).
- **Impact**: off-by-one-day placement in time filters; sub-minute ordering of a batch is lost,
  so statements uploaded in one call may not retain their sequence in time-ordered views.
- **Suggestion**: none client-side; document that date-only ISO is the safe form.

### 5. All-empty `categories` still flips the graph's bracket processing — SILENT
- **Scenario**: `prepareStatementsPayload` uses `categories.length > 0` (array length), not
  "any non-empty entry". So `categories: [[], [], []]` — a semantically empty array, and exactly
  what a model produces when told "empty array for statements without metadata" and none of them
  have metadata — sets `categoriesAsMentions`, `mentionsProcessing`,
  `squareBracketsProcessing: IGNORE_BRACKETS` and overwrites the mode's
  `doubleSquarebracketsProcessing`. With `wikilinksMode: "wikilinksOnly"` this replaces
  `PROCESS_AS_HASHTAGS_IGNORE_THE_REST` with `PROCESS_AS_HASHTAGS`.
- **Likelihood**: MEDIUM-HIGH.
- **Impact**: a different graph from the same content depending on whether a no-op array was
  passed. `resolveContexts` has the same shape (`item.categories?.length > 0`).
- **Note**: the text path has always behaved this way for parent modes (a heading-less document
  yields all-empty categories and still gets `categorySettings`), so this is at least *consistent*
  — but it is worth an explicit decision rather than an accident.

### 6. Same content as `text` vs as `statements` takes two different app code paths — SILENT
- **Scenario**: `submittingStatements` routes to `Entry.submitAsArrayFromApi`
  (`/contexts/fromStatements/graphWithStatements`), text routes to
  `submitAsStringReturnGraphStatementsApi`. Different endpoints, different payload shapes.
- **Likelihood**: N/A — it is the design. The risk is that equivalence is *assumed*.
- **Impact**: if the two paths tokenize or split differently, `statements: ["a","b"]` and
  `text: "a\nb"` produce different graphs, and a power user chaining
  text-analysis → statements-refinement gets an unexplained topology change mid-workflow.
- **Suggestion**: one live equivalence check (same content both ways, compare node/edge/topic
  counts). Cheap, and it either retires this risk permanently or exposes something important.

### 7. `statements: []` alongside `text` produces a misleading mutual-exclusion error — LOUD
- **Scenario**: `if (statements)` in `resolveGraphInput:75` is truthy for `[]`, so
  `{ text: "...", statements: [] }` returns *"Provide only one of: statements, text, or url"*
  even though the caller supplied exactly one usable input.
- **Likelihood**: MEDIUM (models pad optional array params).
- **Impact**: a confusing hard failure on a call that should just work; the model's likely
  recovery is to drop `text`, not `statements`.

### 8. `categories` / `timestamps` without `statements` are silently ignored — SILENT
- **Scenario**: `{ text: "...", categories: [["a"]] }` — `resolveGraphInput` never looks at
  `categories` on the text branch. No error, metadata vanishes. (Note: `routes/entries.js:670`
  *does* accept `categories` on the text path via `addCategoriesToBody`, so the app would have
  used them — this repo drops them before they get there.)
- **Likelihood**: MEDIUM. The field descriptions say "Requires `statements`" but nothing enforces it.
- **Impact**: silently unlabelled graph.

### 9. Pre-bracketed category labels do not merge with inline wikilinks — SILENT
- **Scenario**: the `categories` description promises labels become `[[label]]` nodes, so a model
  may helpfully send `categories: [["[[Alice]]"]]`. `extractNodesFromStatement:314-321` builds
  `@${category}`, then lowercases and underscores it → a node like `[[alice]]`-with-literal-
  brackets that does **not** merge with the inline `[[Alice]]` node the user expects.
- **Likelihood**: LOW-MEDIUM.
- **Impact**: duplicate/garbage nodes in exactly the namespace the design is trying to unify.
- **Suggestion**: strip surrounding `[[ ]]` from category labels client-side.

### 10. Text-path regression from the shared `bracketSettings` / `categorySettings` refactor — SILENT
- **Scenario**: the literals previously inlined in `prepareWikilinksPayload` now come from two
  shared helpers also used by the statements path. By inspection the emitted objects are
  byte-identical to the pre-refactor versions for all five modes. The live risk is future drift:
  a change to `statementsContextSettings`'s merge order silently rewrites the text path's
  parent-mode settings too.
- **Likelihood**: LOW now, HIGH over time.
- **Impact**: existing Obsidian-vault graphs stop matching graphs built before the change.
- **Suggestion**: this is the cheapest high-value suite in the whole brief — five snapshot
  assertions. Do it first.

### 11. Fabricated context names — LOW
- `${uuidFrag}-${i+1}`, unique within a call, `doNotSave=true`, and the app auto-names anyway.
  Only bites if a comparison endpoint is ever called without `doNotSave`. Worth one assertion
  (names present + unique) because the failure mode it prevents is a two-minute hang, not an error.

## Edge Cases to Automate

Layer key: **U** = pure unit (no I/O), **S** = schema-level zod parse, **H** = handler with
stubbed `globalThis.fetch`, **L** = live smoke (manual checklist, not CI).

### Input validation
- `statements: []` alone → "must not be an empty array" (**U**)
- `statements: []` + `text` → currently mutual-exclusion error; assert whichever behaviour you
  decide is correct (**U**, Risk 7)
- `statements: ["  "]` → whitespace rejected by the validator; `statements: ["a", ""]` → rejected
  by *zod*, with a different message shape. Assert which layer speaks (**U** + **S**)
- `categories.length !== statements.length`, both directions (**U**)
- `timestamps.length !== statements.length` (**U**)
- `statements` + `text`, `statements` + `url` (**U**)
- `categories` without `statements`; `timestamps` without `statements` (**U**, Risk 8)

### Timestamp boundary (the table that matters)
Build one table asserting accept/reject, then keep it next to `convertAnyDate`'s behaviour (**U**):
- accept: `2026-08-02`, `2026-08-02T14:30:00Z`, `2026-08-02T14:30:00+02:00`, `31.12.2026`,
  `31/12/2026`, `13/05/2026`, `08/02/2026`, `""`
- reject: `last tuesday`, `2026-13-45`, `1754092800` (epoch seconds), `n/a`
- **decide, then assert**: `2026` → Jan 1; `5` → 2001-05-01; `0` → 2000-01-01; `2026-02-30` →
  rolls to Mar 2. All four currently pass the validator and produce a silently invented date.
- ambiguous `05/06/2026` / `05.06.2026` (Risk 3) — assert the decision you make
- **L**: mixed array `["2026-08-02", "", "2026-08-02T23:30:00Z"]` → read back and confirm
  (a) the empty one is upload time not 1970, (b) the late-UTC one did not roll a day.

### Payload shape (`prepareStatementsPayload` / `statementsContextSettings`)
- all 5 `wikilinksMode` values × {no categories, categories} = 10 snapshots (**U**). The two that
  carry the real contract: `wikilinksOnly` + categories keeps `partOfSpeechToProcess:
  HASHTAGS_ONLY` while `doubleSquarebracketsProcessing` becomes `PROCESS_AS_HASHTAGS`;
  `plainText` + categories keeps `IGNORE_BRACKETS`.
- `categories: [[], [], []]` → assert whether `contextSettings` appears (**U**, Risk 5)
- `contextSettings` omitted entirely (not `{}`) for default mode without categories (**U**)
- `timestamps: ["", "", ""]` → currently `hasTimestamps` is true and an all-empty array is sent (**U**)
- text path: all 5 modes snapshotted, including a heading-less document under
  `obsidianStyle` (**U**, Risk 10)

### Comparison contexts (`resolveContexts`)
- all-statements → `contextSettings` present, every context has a unique non-empty `name` (**U**)
- one `{ text }` among statements → all flattened to `join("\n")`, no `contextSettings`,
  categories gone (**U**)
- one `{ graphName }` among statements, with an injected `fetchGraphTextByName` (**U**)
- invalid categories in context index 1 → error names the index (**U**)
- `{ graphName, statements }`, `{ text, statements }`, `{ statements, timestamps }` union
  precedence (**S**, Risk 2)
- `contexts` of length 2 where both are statements with `categories: [[]]` (**U**)

### Handler body construction — 6 tests cover all 16 tools
Pick one representative per body shape and assert the exact POSTed JSON:
1. `generate_content_gaps` — graphName wins, statements dropped (**H**)
2. `memory_add_relations` — `name` **and** statements both present, `text: ""` present (**H**)
3. `generate_knowledge_graph` — unconditional resolve, `modifyAnalyzedText` appended after
   payload spread (**H**)
4. `develop_text_tool` — same payload reused across three sequential requests (**H**)
5. `overlap_between_texts` — `contextSettings` at body top level, `modifyAnalyzedText` merged
   into each context without clobbering `name` (**H**)
6. `generate_seo_report` — statements payload on step 1, joined text on steps 4/5 (**H**)

### Live smoke (not CI — a checklist to re-run when settings change)
- Risk 1: create graph from plain text → second call adds statements+categories → confirm
  whether `[[label]]` nodes appear. **This is the single most important check in the brief.**
- Risk 6: identical content as `text` vs `statements` → compare node/edge/topic counts
- Risk 9: `categories: [["[[Alice]]"]]` vs `[["Alice"]]` with an inline `[[Alice]]` — do they merge
- Category case/spacing: `"Page A"` vs `"page a"` vs inline `[[Page A]]`
- 2000+ statements: payload size, latency, and whether `maxnodes` still applies on this path

## Test Layers and the Minimal Runner

The repo has **no test runner**. It needs almost nothing:

- **Zero new dependencies option**: `npm run build:inspect` (existing `tsc`) then
  `node --test "dist/**/*.test.js"`. Works today with `"type": "module"` + Node16 resolution.
  Cost: tests compile into `dist/` and ship unless `.npmignore`d.
- **Recommended**: one devDependency. `npm i -D tsx`, then
  `"test": "node --import tsx --test src/**/*.test.ts"`. `node:test` + `node:assert` only —
  no assertion library, no mocking library.

**Why no mocking library is needed**: `src/api/client.ts` calls global `fetch`, and
`getConfig()` (`src/api/config-store.ts:20-26`) falls back to a default object when no
AsyncLocalStorage context is set. A handler test is therefore: swap `globalThis.fetch` for a
recorder that returns a canned `GraphResponse`, call `tool.handler(params)`, assert on the
captured body. ~15 lines of harness, no module interception, no `--experimental-*` flags.

Three files is enough: `graphInput.test.ts` (U + one injected-dependency test for
`resolveContexts`), `wikilinksMode.test.ts` (U snapshots), `handlers.test.ts` (S + H).

## What Is NOT Worth Testing
- **Each of the 16 tools separately.** They share three lines of body construction. Six shape
  representatives is full coverage; 16 near-identical tests is a maintenance tax that will rot.
- **Zod's own semantics.** Don't assert that `.min(1)` rejects `""`. Assert the *user-visible
  consequence* — which layer produces the error and whether it names the offending field.
- **Exact validation message strings.** Assert that the message contains the field name and the
  offending value. Full-string assertions will break on every wording tweak.
- **The URL-fetch branch of `resolveGraphInput`.** Unchanged by this feature and already
  exercised elsewhere.
- **The parent-extraction regexes** (`HEADING_RE`, `PARENT_PREFIX_RE`). Untouched here. Snapshot
  the payload they feed, not the parsing.
- **`convertAnyDate`'s internals.** That belongs to infranodus-app. Encode the *boundary* as the
  accept/reject table above and re-verify with one live call.
- **Performance of huge statements arrays.** Measure the ceiling once, write the number in the
  field description, don't automate it.
- **Node merging with inline wikilinks, category→node rendering.** These are engine properties.
  They cannot regress from changes in this repo — only the `contextSettings` that trigger them
  can, and those are covered by the unit snapshots. Keep them as a live checklist item to re-run
  whenever `categorySettings` changes.

## On Your "Already Verified Manually" List
Mostly correctly covered. Three deserve automation anyway, for a different reason than you tested them:

- **`wikilinksOnly` + categories** — yes, automate as a **unit snapshot**. Not because it might be
  wrong today, but because `statementsContextSettings`'s
  `{ ...bracketSettings(mode), ...categorySettings(mode) }` merge order is the single most
  fragile line in the feature, and its correctness is invisible from the call site.
- **All-statements and mixed comparison contexts** — yes, **unit** on `resolveContexts`
  (flattening, `contextSettings` presence, name assignment). Your manual test proved the API
  accepts it; the unit test protects the branch that decides which shape to send.
- **Timestamp persistence with a time component** — your verified case (a single explicit
  timestamp) is the safe one. The unverified cases are the risky ones: a **mixed** array with
  empty strings (Risk 4 / R3 interaction) and a late-UTC time that rolls a day. Add both to the
  live checklist.

Do **not** automate: categories→nodes end-to-end, node merging with inline wikilinks, or the
validation error messages beyond one assertion each. The first two can't regress from this repo;
the third is brittle.

## Open Questions
1. **Does production match this app checkout?** The timestamp-`ReferenceError` fix and the
   statements-context-`name` validation both exist in the source I read. If prod lags, the
   working-tree decision to strip `timestamps` from comparison contexts is still required — but
   nothing in this repo records how you'll know when to restore it.
2. **Risk 1 is a product decision, not a bug**: should adding categories to a pre-existing graph
   error, warn, or silently no-op? Testability depends on the answer.
3. **13 of 16 tools have no `wikilinksMode` field** (only `GenerateGraphSchema`,
   `CreateGraphSchema`, `AnalyzeTextSchemaBase` do — `schemas/index.ts:90,155,255`). So the
   `wikilinksMode` description's claim that "`obsidianStyle` still gives the star topology" with
   `statements` + `categories` is unreachable from `generate_content_gaps`, `memory_add_relations`,
   etc., which always use mode `undefined`. Intended?
4. **`generate_ontology_graph` takes no `statements`** while the other 16 do. Deliberate omission
   or oversight?
5. **Duplicate context names in one comparison call** — `resolveContexts` guarantees uniqueness,
   but what does the app do if two contexts share a name? Unverified; relevant only if the naming
   scheme changes.
6. **Nothing enforces `categories[i]` actually describes `statements[i]`** beyond length equality.
   A model that reorders one array produces a confidently mislabelled graph. Untestable
   client-side — worth a line in the field description instead.

## Knowledge File Updates
Appended to `testing-knowledge/statements-categories-timestamps.md` (new file): the
`contextAlreadyExists` settings gate, `convertAnyDate` accept/reject/rewrite behaviour, the
empty-string-timestamp guard, the statements-vs-text submit-function split, `categoriesAsMentions`
as the category→node gate, and the zod union precedence results.
