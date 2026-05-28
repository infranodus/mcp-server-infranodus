# Testing Brief: generate_ontology_graph MCP tool
Date: 2026-05-21
Status: Pre-implementation

## Summary
A new MCP tool would call the backend `/api/v1/aiAdvice` endpoint with
`saveToGraphAndRedirect: true` and `aiQueryType: 'ontology graph'` to make the
LLM GENERATE an ontology from a topic/prompt, save it as a graph under the
API-key owner's account, and return a link. The proposed endpoint and body are
essentially correct and verified against source. The real risks are not in the
happy path: they are silent clamping of `numberOfResults`, silent append-to-
existing-graph on name collision, HTTP-200 error envelopes the tool must parse
itself, a silent no-op save for empty/anonymous API keys, and quota consumption.

## Verdict (answers to your asks)

(a) Endpoint & body — CORRECT. `/api/v1/aiAdvice` is the right endpoint. Base
URL `https://infranodus.com/api/v1` + `/aiAdvice` resolves correctly. JSON body
works (global `bodyParser.json`, app.js:270). API-key auth populates
`res.locals.user` (pass.js:353), so the save path can read `.name`/`.uid`.

(b) Corrections to body fields:
- `numberOfResults`: the backend caps at 40 via `x <= 40` (ai.js:828-831). Send
  a NUMBER <= 40, or the frontend-style string. A number > 40 SILENTLY clamps to
  10 (not an error). 0 also falls back to 10. Validate in the tool and cap at 40.
- `modelToUse`: dotted names are fine (`claude-opus-4.6` -> normalized to
  `claude-opus-4-6` by defineModelToUse, ai.js:1255-1261). But an UNKNOWN model
  silently falls back to `gpt-4o-mini` (ai.js:1298) with no error — pick a default
  from the verified valid list (ai.js:892-915) and ideally restrict the tool's
  enum to that list.
- `saveToGraphAndRedirect`: JSON boolean `true` is fine — it's only used in a
  truthiness check (ai.js:83). No string coercion needed.
- `mode`: must be `'gptchat'` (NOT `'topics'`). With `'topics'` the AI usage
  counter is skipped (app.js:1079) AND `defineModelToUse` forces gpt-4o-mini
  (ai.js:1214) — wrong path for ontology generation.
- `replaceEntities`/`hideSearchTerms`: harmless. `replaceEntities` accepts boolean
  or string (ai.js:794-797). `hideSearchTerms` has no effect on the save path.
- `receivedModel: 'default'`, `contextDescription`: not required; omit safely.
- `contextType: 'ONTOLOGY'`: passes through to the saved graph (ai.js:830-833).

(c) Risk map — see below.
(d) Edge cases — see below.
(e) Things in the proposal that are wrong/unverified — see "Corrections" above
    and Open Questions. Nothing in the proposal is fundamentally broken, but two
    of your assumptions need qualifying: the "create a new context" assumption
    (it APPENDS on name collision) and "reads { redirectUrl }" (errors also come
    back as HTTP 200 with { error }, must be checked).

## Flows Affected

### Generate ontology graph from a topic (NEW flow)
- **Current behavior**: No MCP tool generates ontology content via the LLM. The
  closest tools (`create_knowledge_graph`, `generate_knowledge_graph`) extract a
  graph from text the caller already supplies, via `/graphAndStatements`. Confirmed
  no overlap (src/tools/index.ts, generateKnowledgeGraph.ts:65).
- **Proposed change**: New tool POSTs to `/aiAdvice` with the ontology body,
  reads `redirectUrl`, returns graph name + URL.
- **Critical path**:
  1. apiAuthenticated resolves API key -> res.locals.user (name/uid). (pass.js:296-354)
  2. checkPromptLength passes. (ai.js:42, lib/ai.js:1138)
  3. getAiAdvice -> generateAiResponse returns { success, data, modelToUse(dashed) }.
  4. submitAiDataToGraph: convertGPTResponsesToArray splits by \n; builds
     graphSubmitObject; Entry.submitAsArrayReturnContextStatements posts to
     InfraSonic. (ai.js:799-843, entry.js:500-510)
  5. res.send({ redirectUrl }). MCP client returns it unwrapped. (client.ts:31-35)
- **State dependencies**: valid non-demo API key with remaining AI quota; the LLM
  must actually emit `[[wikilink]]`-tagged lines for the graph to have nodes.

## Risk Map

### 1. Error responses arrive as HTTP 200 with { error } — tool may report false success
- **Scenario**: AI failure, prompt too long, toxicity filter, or graph submission
  error all `res.send({ error })` with status 200 (ai.js:72-94). `makeInfraNodusRequest`
  only throws on `!response.ok` (client.ts:23), so it returns `{ error }` as data.
- **Likelihood**: high — prompt-too-long and toxicity filtering are common.
- **Impact**: a naive tool that reads `response.redirectUrl` returns
  `undefined`/a broken link and reports success. User gets a dead link.
- **Suggestion**: the tool MUST check `response.error` before reading `redirectUrl`
  (the existing createKnowledgeGraph tool already does this pattern, lines 76-86).

### 2. Empty/demo API key => silent no-op save but a redirectUrl is still returned
- **Scenario**: missing or anonymous API key falls through to handleAnonymousUser
  (pass.js:269-271). submitAsArrayReturnContextStatements sets doNotSaveGraph=true
  for demo users (entry.js:470-479) — nothing is persisted — yet generateAiAdvice
  still returns `redirectUrl` (ai.js:103).
- **Likelihood**: medium — misconfigured MCP client with empty apiKey.
- **Impact**: user is told the graph was created and given a link to a graph that
  does not exist. Confusing and unverifiable.
- **Suggestion**: tool should require a configured API key; consider a follow-up
  existence check or surfacing the demo state if detectable.

### 3. Name collision silently APPENDS to an existing graph
- **Scenario**: user (or the AI workflow) reuses a contextName. The save appends
  the new ontology statements to the existing graph rather than creating fresh or
  erroring (entry.js:500-507; contextslist empty so no gating).
- **Likelihood**: high for power users who iterate ("ontology of X", run twice).
- **Impact**: graphs grow unexpectedly; re-running to "regenerate" actually merges,
  polluting an existing graph. No warning.
- **Suggestion**: document append behavior in the tool description; consider
  generating a unique/suffixed name, or expose a "create vs append" choice. Cannot
  be mitigated purely client-side without a pre-check (list_graphs already exists).

### 4. numberOfResults silently clamped/ignored
- **Scenario**: tool passes a number > 40 (50, 100) — backend resets to 10
  (ai.js:828-831). 0 also -> 10.
- **Likelihood**: medium — users asking for "a big ontology, 100 nodes".
- **Impact**: user expects 100 statements, gets 10, no feedback.
- **Suggestion**: validate/cap at 40 in the schema and surface the cap in the
  description.

### 5. AI returns prose without [[wikilinks]] => sparse/empty graph that still "succeeds"
- **Scenario**: model ignores the ontology format; lines have no `[[ ]]` so
  HASHTAGS_ONLY processing yields no entities (ai.js:822-828, 948-952).
- **Likelihood**: medium — depends on model; weaker models drift.
- **Impact**: graph saved but nearly empty; success reported.
- **Suggestion**: not fixable in the tool, but the tool could optionally fetch the
  saved graph stats and warn if node count is ~0.

### 6. Quota consumption / rate limits
- **Scenario**: mode='gptchat' increments AI usage (app.js:1079). Hourly AI limit,
  weekly API limit, total limit can each 403 (pass.js:313-331), returned via
  sendError (likely non-200 here -> client throws).
- **Likelihood**: medium under heavy power-user looping.
- **Impact**: 403 mid-workflow; some quota errors are HTTP-level (thrown), the
  saveToGraphAndRedirect error envelope is 200 — inconsistent surfaces.
- **Suggestion**: tool should map both thrown errors and `{ error }` bodies to a
  clean user message; mention quota in the description.

## Edge Cases

- **State conflicts**:
  - contextName equals an existing graph -> appends (Risk 3).
  - contextName equals a graph the user has shared/public -> appends into the
    public graph (verify accessToken path entry.js:490-493 does not change owner).
  - Rapid double-invocation with same name -> two appends / partial merge race.

- **Timing / async**:
  - logApiUsage runs AFTER next() (pass.js:357) — usage counting is async; back-to-back
    calls may both pass the quota gate before the counter updates. Verify burst behavior.
  - LLM latency: ontology generation can be slow; confirm MCP tool timeout is
    generous (compare seo report ~90s note in server instructions).

- **Data extremes**:
  - Empty prompt: passes checkPromptLength (returns true for empty); LLM may return
    nothing -> `No responses from the AI model` error (ai.js:771-775) OR a generic
    ontology. Tool should reject empty topic client-side.
  - Prompt > 64000 chars -> prompt_too_long error envelope (ai.js:44-50).
  - numberOfResults: 0, negative, 41, 100, non-numeric string, float.
  - Special characters in contextName: slashes, `..`, spaces, unicode, very long
    names — these end up in `redirectUrl` `/<userName>/<contextName>/edit`. Verify
    the InfraSonic save accepts them and the URL is valid/encoded.
  - Model name: dotted, dashed, unknown (falls back to gpt-4o-mini silently).

- **Cross-flow interference**:
  - A graph created here, then opened/edited via the host app while the same name
    is re-generated -> append into a graph the user is actively editing.
  - list_graphs cache: submitAsArrayReturnContextStatements invalidates the
    contexts cache (entry.js:512-513) only when contextAlreadyExists is false, which
    is ALWAYS the case here (empty contextslist). So new graphs should appear in
    list_graphs; confirm an appended-to existing graph also reflects updates.

## Open Questions
- Does the InfraSonic `/contexts/fromStatements/statements` endpoint reject or
  sanitize contextNames with `/`, `..`, or excessive length? Not visible from
  infranodus-app; needs verification against the InfraSonic service or a live test.
- What is the actual `language` handling for ontology mode? `defineAiRequestParameters`
  reads `req.body.language` (ai.js:809-812) defaulting to the user's inlanguage;
  the proposed body does not send `language`. Confirm ontology prompts honor a
  language param if multilingual ontologies are desired.
- Does an appended-to existing graph return a `redirectUrl` to the SAME edit page,
  and is that the desired UX, or should the tool detect collisions first?
- For a demo/anonymous key, is there any signal in the response distinguishing the
  no-op save from a real save? (Risk 2.) Not found in the response shape.

## Knowledge File Updates
- Created `testing-knowledge/ai-advice-graph-generation.md` documenting: global JSON
  body parsing, apiAuthenticated res.locals.user population, demo-user no-op save,
  AI-usage increment for non-topics modes, append-on-collision save semantics,
  dotted->dashed model normalization and silent fallback, numberOfResults<=40
  clamping, 64000-char prompt limit, and the HTTP-200 { error } envelope.
