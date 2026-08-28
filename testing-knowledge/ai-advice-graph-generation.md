# AI Advice / Ontology Graph Generation — Known Behaviors

Domain: backend `/api/v1/aiAdvice` (handler `aiAgents.generateAiAdvice`) and the
graph-save path it triggers. Verified by reading infranodus-app source.

## Endpoint & body parsing
- `bodyParser.json({ limit: '50mb' })` is registered globally (app.js:270-274) BEFORE
  all routes. So `/api/v1/aiAdvice` accepts both `application/json` and
  `application/x-www-form-urlencoded`. JSON arrays (e.g. `prompt`) survive intact.
- `/api/v1/aiAdvice` (app.js:1074) does NOT mount `contextsListMiddleware.getContextsList()`,
  unlike `/api/v1/dify/retrieval` (app.js:1108). So `res.locals.contextslist`
  is undefined and `submitAiDataToGraph` defaults it to `[]` (ai.js:780).

## Auth (apiAuthenticated)
- `pass.apiAuthenticated(aiCall, apiCall)` populates `res.locals.user` for API-key
  users via `getInfranodusUserProperties` (pass.js:353, 381-406). `.name`, `.uid`,
  `.jwt_token`, `.plan` are present. So `submitAiDataToGraph` can read
  `res.locals.user.name` for the redirectUrl.
- EMPTY Authorization header is NOT rejected — it falls through to
  `handleAnonymousUser` (pass.js:269-271), creating a demo user. For demo users
  `submitAsArrayReturnContextStatements` sets `doNotSaveGraph = true` (entry.js:470-479):
  the graph is NOT persisted, but `generateAiAdvice` STILL returns a `redirectUrl`
  pointing to a graph that does not exist. Silent no-op save.
- For `/api/v1/aiAdvice` the wrapper computes `shouldIncreaseAiUsage = req.body?.mode == 'topics' ? false : true` (app.js:1079). Ontology graph uses `mode: 'gptchat'`, so the AI usage counter IS incremented and quota limits apply (hourly AI limit, weekly API limit, total limit — pass.js:313-331).

## Graph save semantics (the overwrite/append risk)
- `submitAiDataToGraph` (ai.js:764) builds `graphSubmitObject` with `name = req.body.contextName`
  and posts to InfraSonic `/${userId}/contexts/fromStatements/statements` (entry.js:500).
- The graph is ALWAYS saved under the authenticated user's `userId` — `contextName`
  only NAMES the graph; it cannot target another user's account. No arbitrary-user write.
- `contextslist` (empty here) is used ONLY to decide cache invalidation
  (entry.js:505-513), NOT to gate creation. Submitting an EXISTING contextName
  APPENDS statements to that graph (the fromStatements endpoint adds to the named
  context). It does not overwrite or error. Power-user risk: re-running with the
  same name silently merges new ontology statements into the prior graph.

## Model name normalization
- `defineModelToUse` (ai.js:1213) maps dotted public names to dashed internal IDs:
  `claude-opus-4.5`/`claude-opus-4.6`/`claude-opus-5` -> `claude-opus-5`;
  `claude-sonnet-4.5`/`claude-sonnet-4.6`/`claude-sonnet-5` -> `claude-sonnet-5`; `claude-fable-5` -> `claude-fable-5`;
  `gpt-5`/`gpt-5.4` -> `gpt-5.4`; `grok-4.1-fast-*` -> `grok-4-1-fast-*`; etc.
- Unknown model => silent fallback to `gpt-4o-mini` (ai.js:1298). No error surfaced.
- `generateAiResponse` returns the NORMALIZED `modelToUse` (ai.js:553/561/597...),
  which flows to `convertGPTResponsesToArray` (ai.js:799-803). That function's content
  extraction switch checks the DASHED names (ai.js:924-946). So sending dotted names
  from a JSON client is safe — but ONLY because normalization happens first. Sending
  an already-dashed internal name like `grok-4-1-fast-reasoning` also works.
- Valid public model list: `getModelsAvailable` (ai.js:892-915): gpt-4o-mini, gpt-4o,
  gpt-4, gpt-3.5-turbo, gpt-5.4, gpt-5.4-mini, gpt-5.6-terra, gpt-5.6-sol, claude-opus-5,
  claude-sonnet-5, claude-fable-5, grok-4.1-fast-non-reasoning, grok-4.1-fast-reasoning,
  gemini-2.5-flash, gemini-2.5-flash-lite (gemini-2.5-pro accepted by defineModelToUse but not advertised).
  Updated 2026-08-28 from infranodus-app routes/ai.js:979 / lib/ai.js:1267.

## numberOfResults coercion (fragile)
- `defineAiRequestParameters` (ai.js:828-831):
  `req.body.numberOfResults && req.body.numberOfResults <= 40 ? parseInt(...) : 10`.
- JSON number > 40 (e.g. 50) => `50 <= 40` false => SILENTLY clamps to 10.
- JSON number 0 => `0 && ...` falsy => defaults to 10.
- String "10" (frontend) => `"10" <= 40` coerces true => parseInt => 10. OK.
- This is the documented cap of 40; values above it are not rejected, just ignored.

## Prompt length
- `checkPromptLength` (ai.js:1138): for an array prompt the limit is `MAX_SIZE_PROMPT_GPT4 = 64000`
  characters (joined by newline). Both GPT3 and GPT4 constants are 64000 (ai.js:3-4).
  Over-limit => `{ error: 'prompt_too_long' }`. Empty/missing prompt passes the length
  check (returns true) — it does NOT validate non-empty.

## Response shape
- On save success: `res.send({ redirectUrl: '/<userName>/<contextName>/edit' })` (ai.js:103-105).
- On AI error with saveToGraphAndRedirect: `res.send({ error })` (ai.js:72-74), HTTP 200.
- On graph submission error: `res.send({ error })` (ai.js:92-94), HTTP 200.
- These plain objects have no `entriesAndGraphOfContext` key, so MCP client's
  unwrapping (client.ts:31) does NOT touch them. `redirectUrl` is read directly.
- IMPORTANT: error responses are HTTP 200 with an `{ error }` body. `makeInfraNodusRequest`
  only throws on `!response.ok`, so the tool MUST inspect `response.error` itself.

## ontology output parsing
- `convertGPTResponsesToArray` for `aiQueryType == 'ontology graph'` splits AI output
  by `\n`, trims each line, each line becomes a statement (ai.js:948-952). No filtering
  of empty lines or non-`[[wikilink]]` lines. `textProcessingSettings` =
  `{ doubleSquarebracketsProcessing: 'PROCESS_AS_HASHTAGS_IGNORE_THE_REST', partOfSpeechToProcess: 'HASHTAGS_ONLY' }`
  (ai.js:822-828). If the model returns prose without `[[ ]]`, statements have no
  hashtags => graph may be empty/sparse but the save still "succeeds".
