# TODO: hop-aware retrieval and node neighborhood queries

Date: 2026-10-14
Origin: a session in the Second AI Brain project asked "what is `gpu` connected to in this graph?"
and "what learning types is `gpu` connected to?" The MCP tools could only return statements that
mention `gpu` directly; indirect (2-hop) connections required dumping the full graph and running a
BFS client-side. The app already supports hop expansion; the MCP server never exposes it.

## Current state (verified in code)

- App: `routes/entries.js:1128` reads `req.query.hops` (default 1) and `:1195` reads `req.query.topK`
  (default 8) on `/api/v1/graphAndAdvice`. With a prompt it builds a prompt graph, intersects it with
  the saved graph via `graphService.getGraphsIntersection` (`lib/graph.js`), and when `hops > 1`
  expands through `findConnectedEdges` (`lib/graph.js:1191`). Top-K edges by weight are then mapped
  back to statements with `Entry.getStatementsOfEdges`. Overlap statements get
  `similarityScore = 1 / hops`.
- MCP: `src/tools/retrieveContextForPromptFromGraph.ts` builds its query string with only
  `doNotSave`, `addStats`, `includeGraph`, `includeStatements`, `includeGraphSummary`,
  `extendedGraphSummary`. `RetrieveContextForPromptFromGraphSchema` (`src/schemas/index.ts`) has no
  `hops` or `topK`. Every retrieval is therefore 1-hop, 8 edges.
- MCP: `search` (`src/tools/searchGraphs.ts`) hits `/api/v1/search` -> `entries.findStatements` ->
  `Entry.submitFromSearch` (INTERSECTION on space-split query words). The backend returns a graph
  with statements, but `generateSearchResult` (`src/utils/transformers.ts`) keeps only graph names
  and URLs. No traversal.
- MCP: `analyze_existing_graph_by_name` with `fullGraph: true` returns edges with `context_matrix`
  (edge -> statement ids), so a client can traverse hops itself. ~0.5 MB for 150 nodes. The tool
  has no `maxNodes`, so a graph created with `maxNodes: 500` is re-read at the default 150.

## 1. Expose `hops` and `topK` on `retrieve_from_knowledge_base` (smallest change, no app change)

- [ ] Add to `RetrieveContextForPromptFromGraphSchema`:
      `hops: z.number().int().min(1).max(3).default(1)` — "How many hops from the prompt's concepts
      to expand the retrieval. 1 = statements sharing a concept with the prompt; 2 = also statements
      connected through one intermediate concept."
      `topK: z.number().int().min(1).max(50).default(8)` — "Max number of edges (and statements)
      retrieved from the overlap."
- [ ] Pass both as query params in `retrieveContextForPromptFromGraph.ts`
      (`hops: String(params.hops)`, `topK: String(params.topK)`).
- [ ] Surface `similarityScore` in the non-compact output so the client can tell hop-1 from hop-2
      statements (it is already mapped in `transformToGraphRagOutput`; confirm it is non-zero when
      hops > 1).
- [ ] Update `instructions.ts` / tool description: "For a question about a specific concept, set
      `prompt` to that concept and `hops: 2`."
- [ ] Note for the description: the intersection matches prompt words to `[[wikilink]]` nodes by
      stripping the brackets (`lib/graph.js`, `getGraphsIntersection`). There is no lemmatization
      across entity nodes, so `gpu` will not match `[[gpus]]`. Document it; do not try to fix it in
      the MCP layer.

## 2. New tool: `get_node_neighborhood` (the proper answer)

Signature: `get_node_neighborhood({ graphName, node, hops = 1, includeStatements = true, maxNeighbors? })`

Returns the ego network of one node:
```
{
  node: "[[gpu]]",
  degree, betweenness, community,
  neighbors: [
    { node: "[[alexnet]]", hop: 1, weight: 3, via: null,       statementIds: [...] },
    { node: "[[deep_learning]]", hop: 2, weight: 2, via: "[[alexnet]]", statementIds: [...] }
  ],
  statements: [ { id, content, hop } ]   // when includeStatements
}
```

- [ ] App side: new route (e.g. `POST /api/v1/nodeNeighborhood`) that takes a node name instead of a
      prompt, skips the text-to-graph step, loads the saved graph, runs the hop expansion and
      `Entry.getStatementsOfEdges`, and returns neighbors grouped by hop distance with edge weights.
      All pieces exist: `getGraphsIntersection`, `findConnectedEdges`, `getStatementsOfEdges`.
- [ ] Accept `node` with or without `[[ ]]`; try both forms. Optionally accept an array of nodes
      (`gpu`, `gpus`) so split entities can be queried together.
- [ ] MCP side: schema + tool file + transformer; register in `src/tools/index.ts`.
- [ ] Fallback if the app route is not available (older servers): call
      `analyze_existing_graph_by_name` with `fullGraph`, run BFS in the MCP server, and return the
      same shape. Keep this behind a feature check so it does not silently ship 0.5 MB responses.

### BFS note (performance)

`findConnectedEdges` (`lib/graph.js:1191`) checks every edge in `allEdges` against every selected
edge and recurses through `allEdges.some(...)` for each remaining hop. That is roughly
O(E^2 * hops) and re-serializes edges with `JSON.stringify` for the visited set. Fine at ~450
edges (the AI test graph), slow at several thousand. Replace with a set-based BFS over node
adjacency: build `Map<node, Set<edgeIdx>>` once, seed the frontier with the nodes of the selected
edges, expand `hops` times, and collect edge indices touched. Linear in E + V per hop. Do this
before shipping tool 2, since neighborhood queries on large graphs will hit it directly.

## 3. Skill guidance (tracked in InfraNodus-Skills, see its TODO)

- [ ] Once 1 or 2 ships, update the MCP server instructions text so clients know the node-question
      workflow: `search` to confirm the node and its variants -> `retrieve_from_knowledge_base`
      with `hops: 2` (or `get_node_neighborhood`) -> `analyze_existing_graph_by_name` with
      `fullGraph` only for path/distance questions.

## 4. Add `maxNodes` to `analyze_existing_graph_by_name`

- [ ] Add `maxNodes` to its schema (same shape as in `create_knowledge_graph`: int, max 1000,
      default 150) and pass it through, so a graph created at 500 nodes is re-read at 500.
- [ ] Mention in the description that the compacted view may drop low-weight nodes and their edges;
      with the AI test graph, `supervised_learning`, `reinforcement_learning` and
      `self_supervised_learning` disappeared at 150 nodes.

## Not checked

- Whether `memory_get_relations` (MEMORY graphs) has its own traversal depth.
