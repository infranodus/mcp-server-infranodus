/**
 * MCP Server Instructions
 *
 * Injected into the LLM's system prompt during the MCP handshake.
 * Focuses on cross-tool workflow patterns, constraints, and conventions
 * that individual tool descriptions cannot convey.
 *
 * See: https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/
 */

import { brand } from "./config/brand.js";

export const serverInstructions = `${brand.name} MCP server for knowledge graph generation and text network analysis using graph theory algorithms.

INPUT TYPES: All analysis tools accept text (string), url (webpage or YouTube video URL — automatically transcribed), or graphName (existing ${brand.name} graph). Provide exactly one input type per call.

ENTITY DETECTION MODES: Use modifyAnalyzedText parameter — 'none' (default, word co-occurrence graph), 'detectEntities' (mix entities and words), 'extractEntitiesOnly' (entity-only graph, best for ontologies and knowledge graphs).

WORKFLOW PATTERNS:
1. Quick structural overview: generate_knowledge_graph or generate_topical_clusters → get main topics, clusters, gaps.
2. Deep text development: develop_text_tool (combines optimize + latent topics + conceptual bridges in one call with progress tracking).
3. Research ideation: generate_content_gaps → generate_research_questions or generate_research_ideas. Use useSeveralGaps for diversity, gapDepth for less prominent gaps.
4. Text optimization: optimize_text_structure (auto-detects bias/focus/dispersion and suggests appropriate development).
5. Outside-the-box thinking: develop_conceptual_bridges (connects discourse to broader context) or set shouldTranscend/transcendDiscourse: true.
6. RAG augmentation: generate_contextual_hint (lightweight structural summary) or retrieve_from_knowledge_base with includeGraphSummary (GraphRAG retrieval).
7. Comparing texts: overlap_between_texts (similarities), difference_between_texts (what's missing in first text), merged_graph_from_texts (combined overview).
8. SEO/content optimization: generate_seo_report (comprehensive, ~90s timeout needed) or run analyze_google_search_results → analyze_related_search_queries → search_queries_vs_search_results individually.
9. Memory: memory_add_relations to persist knowledge graphs, memory_get_relations to retrieve. Use [[wikilinks]] for entity marking.
10. Graph management: list_graphs to discover existing graphs, search + fetch for content retrieval.

AI MODELS: Tools that generate AI responses accept modelToUse parameter. Available: gpt-4o, gpt-4o-mini, gpt-5.4, gpt-5.4-mini, claude-sonnet-4.6, claude-opus-4.6, gemini-2.5-flash, gemini-2.5-flash-lite. No additional API keys needed.

RESPONSE TYPES: For idea-generating tools, responseType can be 'response' (default analytical), 'idea' (business-oriented), 'question' (research questions), or 'transcend' (broader discourse connection).

DIVERSITY METRICS: Graph analysis returns diversity_score (biased/focused/diversified/dispersed) indicating text structure balance. Use this to choose the right development approach.

PERFORMANCE: generate_seo_report requires extended timeout (~90 seconds) as it chains multiple Google API calls. All other tools respond within standard timeouts.

MULTI-SOURCE INPUTS: overlap_between_texts, merged_graph_from_texts, and difference_between_texts accept a 'contexts' array where each item can be {text: "..."}, {url: "..."}, or {graphName: "..."}. Minimum 2 contexts required.`;
