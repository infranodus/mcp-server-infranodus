# AI Tools → InfraNodus API: `requestMode` reference

This document describes how the MCP tools that send a `requestMode` field interact
with the InfraNodus API, and exactly what data each one sends **as of the current
code**. It reflects the source in `src/tools/` and `src/api/client.ts`.

## Transport

All of these tools hit a single endpoint through one helper,
`makeInfraNodusRequest()` (`src/api/client.ts`):

- **Base URL:** `https://infranodus.com/api/v1` (configurable via `apiBase`)
- **Path:** `/graphAndAdvice` (query parameters appended per tool — see tables below)
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <apiKey>`
- **Body:** the JSON request body described below, **plus** an automatically
  injected field `modal: "mcp_server"` added by `makeInfraNodusRequest()` to every
  request. (So the field is present on the wire even though no tool sets it.)

If the response contains `entriesAndGraphOfContext`, the client unwraps it and
returns that inner object; otherwise it returns the raw JSON.

## Input resolution (shared by all tools)

Every tool accepts exactly one of three input types and resolves it before building
the request body:

- `graphName` (+ optional `userName`) → sends `name` / `userName`, analyzing an
  existing saved InfraNodus graph.
- `url` → fetched and transcribed to plain text via `fetchUrlContentAsText()`, then
  sent as `text`.
- `text` → sent as-is as `text`.

`graphName` takes precedence; if it is set, `url`/`text` are ignored.

## What `requestMode` is

`requestMode` tells the InfraNodus AI backend **how to use the analyzed graph** when
generating its AI advice. The values these tools send are:

| value | meaning on the backend |
|---|---|
| `question` | generate research questions across the detected content gap |
| `response` | generate a statement/answer that bridges the gap or responds to a prompt |
| `idea` | generate an innovative idea linking the two gap clusters |
| `transcend` | go beyond the current discourse — connect to a broader context |
| `search` | retrieval mode (GraphRAG): return matching statements + overview, no generation |

The companion knob is `optimize` (a **query parameter**, not part of the body), which
selects *which structural feature* of the graph the advice targets: `gap` (content
gap between clusters), `latent` (under-developed topics), `imagine` (conceptual
bridges to outside concepts), or `optimize` (auto-detect bias/focus/dispersion).

## Tools that send `requestMode`

Eight tools send `requestMode`. The table below is the exact, current mapping of
each tool to the `optimize` query parameter and the `requestMode` value it sends.

| MCP tool | source file | `optimize` (query param) | `requestMode` sent | how `requestMode` is decided |
|---|---|---|---|---|
| `develop_text_tool` | `developTextTool.ts` | 3 calls: `optimize`, then `latent`, then `imagine` | `transcend` if `transcendDiscourse`, else `question` | `params.transcendDiscourse ? "transcend" : "question"` (same value on all 3 sub-calls) |
| `generate_research_questions` | `generateResearchQuestions.ts` | `gap` | `question` (fixed) | hard-coded |
| `generate_research_ideas` | `generateResearchIdeas.ts` | `gap` | `transcend` / `idea` / `response` | `shouldTranscend ? "transcend" : (responseType === "idea" ? "idea" : "response")`. Note: for the **graph** input path, the `idea` branch is not used — it is `shouldTranscend ? "transcend" : "response"` |
| `generate_responses_from_graph` | `generateResponses.ts` | `gap` | `response` (fixed) | hard-coded; also sends `prompt` |
| `develop_latent_topics` | `developLatentTopics.ts` | `latent` | `params.requestMode ?? "transcend"` | caller-overridable, defaults to `transcend` |
| `develop_conceptual_bridges` | `developConceptualBridges.ts` | `imagine` | `params.requestMode ?? "transcend"` | caller-overridable, defaults to `transcend` |
| `optimize_text_structure` | `optimizeTextStructure.ts` | `optimize` | `params.responseType ?? "response"` | derived from `responseType` |
| `retrieve_from_knowledge_base` | `retrieveContextForPromptFromGraph.ts` | _(none — retrieval, not advice)_ | `search` (fixed) | hard-coded; also sends `prompt` |

## Exact request payloads

Below is exactly what goes over the wire for each tool. Query parameters are shown
on the endpoint line; the JSON is the request body (before `modal: "mcp_server"` is
appended by the client). `gpt-4o` is the default model when `modelToUse` is not
provided.

### `develop_text_tool`

Makes **three** sequential `/graphAndAdvice` POSTs (research questions → latent
topics → conceptual bridges), each with `requestMode` set the same way.

Call 1 — research questions:
```
POST /graphAndAdvice?doNotSave=true&addStats=true&optimize=optimize&includeStatements=false&includeGraphSummary=false&extendedGraphSummary=true&includeGraph=false&aiTopics=true&extendedAdvice=<useSeveralGaps>&gapDepth=<gapDepth|0>
```
Call 2 — latent topics: same as above but `optimize=latent` (and no
`extendedAdvice`/`gapDepth`).
Call 3 — conceptual bridges: same but `optimize=imagine`.

Body (per call):
```json
{
  "text": "<resolved text>",        // or "name": "<graphName>" for the graph path
  "aiTopics": "true",
  "requestMode": "question",          // "transcend" if transcendDiscourse is true
  "modelToUse": "gpt-4o"
}
```

### `generate_research_questions`

```
POST /graphAndAdvice?doNotSave=true&addStats=true&optimize=gap&includeStatements=false&includeGraphSummary=<includeGraphSummary>&extendedGraphSummary=false&includeGraph=false&aiTopics=true&extendedAdvice=<useSeveralGaps>&gapDepth=<gapDepth|0>
```
```json
{
  "text": "<resolved text>",        // or { "name": "<graphName>", "userName": "<userName|''>" }
  "aiTopics": "true",
  "requestMode": "question",
  "modelToUse": "gpt-4o"
}
```

### `generate_research_ideas`

```
POST /graphAndAdvice?doNotSave=true&addStats=true&optimize=gap&includeStatements=false&includeGraphSummary=<includeGraphSummary>&extendedGraphSummary=false&includeGraph=false&aiTopics=true&extendedAdvice=<useSeveralGaps>&gapDepth=<gapDepth|0>
```
```json
{
  "text": "<resolved text>",        // or { "name": "<graphName>", "userName": "<userName|''>" }
  "aiTopics": "true",
  "requestMode": "response",          // "transcend" if shouldTranscend; "idea" if responseType==="idea" (text path only)
  "modelToUse": "gpt-4o"
}
```

### `generate_responses_from_graph`

```
POST /graphAndAdvice?doNotSave=true&addStats=true&optimize=gap&includeStatements=false&includeGraphSummary=false&extendedGraphSummary=false&includeGraph=false&aiTopics=true
```
```json
{
  "text": "<resolved text>",        // or { "name": "<graphName>", "userName": "<userName|''>" }
  "aiTopics": "true",
  "requestMode": "response",
  "prompt": "<prompt|''>",
  "modelToUse": "gpt-4o"
}
```

### `develop_latent_topics`

```
POST /graphAndAdvice?doNotSave=true&addStats=true&optimize=latent&includeStatements=false&includeGraphSummary=false&extendedGraphSummary=true&includeGraph=false&aiTopics=true
```
```json
{
  "text": "<resolved text>",        // or "name": "<graphName>"
  "aiTopics": "true",
  "requestMode": "transcend",         // overridable via params.requestMode
  "modelToUse": "gpt-4o"
}
```

### `develop_conceptual_bridges`

```
POST /graphAndAdvice?doNotSave=true&addStats=true&optimize=imagine&includeStatements=false&includeGraphSummary=false&extendedGraphSummary=true&includeGraph=false&aiTopics=true
```
```json
{
  "text": "<resolved text>",        // or "name": "<graphName>"
  "aiTopics": "true",
  "requestMode": "transcend",         // overridable via params.requestMode
  "modelToUse": "gpt-4o"
}
```

### `optimize_text_structure`

```
POST /graphAndAdvice?doNotSave=true&addStats=true&optimize=optimize&includeStatements=false&includeGraphSummary=false&extendedGraphSummary=true&includeGraph=true&aiTopics=true
```
```json
{
  "text": "<resolved text>",        // or "name": "<graphName>"
  "aiTopics": "true",
  "requestMode": "response",          // = params.responseType ?? "response"
  "modelToUse": "gpt-4o"
}
```

### `retrieve_from_knowledge_base`

Retrieval (GraphRAG), not AI advice — note the different query parameters and that
`graphName` is required.

```
POST /graphAndAdvice?doNotSave=true&addStats=true&includeGraph=<includeGraph>&includeStatements=true&includeGraphSummary=<includeGraphSummary>&extendedGraphSummary=<extendedGraphSummary>
```
```json
{
  "name": "<graphName>",
  "aiTopics": "true",
  "requestMode": "search",
  "prompt": "<prompt|''>",
  "modelToUse": "gpt-4o",
  "userName": "<userName|''>"
}
```

## Notes / things to be aware of

- Every body also carries `modal: "mcp_server"`, injected centrally in
  `makeInfraNodusRequest()`. It is not visible in the per-tool code.
- `aiTopics` is always sent as the **string** `"true"` (not a boolean), as are the
  other query-param flags.
- `requestMode` is only directly caller-overridable on `develop_latent_topics` and
  `develop_conceptual_bridges` (via `params.requestMode`). On
  `optimize_text_structure` it is set indirectly through `params.responseType`. On
  the remaining tools it is either fixed or derived from boolean flags
  (`transcendDiscourse`, `shouldTranscend`) / `responseType`.
- The backend interpretation of these `requestMode` values lives in the InfraNodus
  app (`lib/ai.js` + `lib/languages/ai_prompts.js`), where the value selects model
  parameters (max tokens, temperature, penalties) and the prompt wording used to
  generate the advice.
