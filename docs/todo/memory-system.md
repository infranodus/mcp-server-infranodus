# Memory System TODO

Design: [`docs/drafts/infranodus-memory-system.md`](../drafts/infranodus-memory-system.md). The MCP server becomes a thin wrapper over new `infranodus-app` endpoints, so hooks, MCP clients and Legal Play share one implementation. Depends on the `infranodus-app` endpoints (see its `docs/todo/memory-system.md`).

## Phase 1: move learnings and memory onto the API

- [ ] `getProjectLearnings`, `addProjectLearnings`, `enableProjectLearnings` call `/api/v1/learnings/{get,add,enable}` instead of composing `/graphAndStatements` + `/search` themselves
- [ ] Keep the tool names, inputs (`project`, `statements`, `types`, `confirm`, `prompt`, `entity`, `type`, `limit`) and response shapes unchanged; clients must not notice
- [ ] Remove the logic that moved server-side from `src/utils/learnings.ts` (dedup, naming, marker handling); keep only what the tools still need for formatting
- [ ] `memory_add_relations` / `memory_get_relations` call `/api/v1/memory/{add,get}`
- [ ] Add optional `scope` (`topic` | `personal`) and `topic` to `AddMemorySchema` / the get schema, so the LLM stops inventing graph names; when only `graphName` is given, keep today's behaviour for backward compatibility
- [ ] Add `enable_memory` (topic or personal), mirroring `enable_project_learnings`: never called without an explicit user request
- [ ] Pass the `language` field through on every call
- [ ] Update `src/instructions.ts`: the three kinds of memory (learnings / topic memory / personal), which tool for which, and that personal facts never go into learnings
- [ ] Update the README tool list and the descriptions changed in `1113ec9`

## Phase 3: review

- [ ] Add `review_memory` (or `review_learnings`): list inbox items for a scope, then promote or discard by id, with dry run by default and `confirm: true` to apply (same pattern as `delete_graph`)
- [ ] `get_project_learnings` returns `inboxCount` so the agent can mention pending items

## Tests

- [ ] Update the learnings and memory tool specs to mock the new endpoints
- [ ] Backward-compatibility test: `memory_add_relations` with only `graphName` writes to that graph as before
- [ ] `add_project_learnings` still refuses when the project isn't enabled (the server enforces it, the tool surfaces the error unchanged)
