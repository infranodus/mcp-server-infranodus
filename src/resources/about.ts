import { brand } from "../config/brand.js";

export const aboutResource = {
	name: "about",
	uri: "info://about",
	definition: {
		name: `About ${brand.name} MCP Server`,
		description: `${brand.name} MCP server can generate knowledge graphs and perform text analysis. It can work with your existing ${brand.name} graphs or with the text you submit via your LLM workflows or Claude desktop client. ${brand.name} MCP can extract the main topics and identify the content gaps in any text and use the built-in AI with the model of your choice (no additional keys needed) to generate research questions that can be used as prompts to augment your LLM's responses.`,
		mimeType: "text/plain",
	},
	handler: async () => {
		return {
			contents: [
				{
					uri: "info://about",
					mimeType: "text/plain",
					text: `${brand.name} MCP Server

This server provides tools for text analysis and knowledge graph generation using the ${brand.name} API.

Available Tools:
1. analyze_existing_graph_by_name - Retrieve and analyze graphs content from your ${brand.name} account
2. analyze_text - Analyze a text, URL, or YouTube transcript; extract and analyze a graph from text or URL (provide either text or url)
3. generate_content_gaps - Generate content gaps from text
4. generate_topical_clusters - Generate topics and clusters of keywords from text using knowledge graph analysis; by default also returns AI-generated summaries of each topical cluster (topicalClusterSummaries, useful for SEO-optimized content creation) — set generateTopicalSummaries: false to increase processing speed or if the summary request fails
5. optimize_text_structure - Analyze the level of bias and coherence in text; if too biased, develop the represented topics; if focused or diversified, develop the content gaps; if dispersed, focus the most common gap topics
6. optimize_reasoning - Apply the same bias/coherence analysis to the model's own reasoning trace or chat with the user (pass it as text); detects whether the reasoning is biased, focused, diversified, or dispersed and suggests how to continue thinking toward optimal diversity and coherence at the same time
7. develop_text_tool - Comprehensive text analysis combining research questions, latent topics, and content gaps with progress tracking
8. create_knowledge_graph - Create a knowledge graph in ${brand.name} from text and provide a link to it
9. overlap_between_texts - Create knowledge graphs from two or more texts and find the overlap (similarities) between them
10. merged_graph_from_texts - Build a graph of all the texts, URLs, and existing graphs provided, providing topical clusters and gaps present in the merged graph generated from all the texts
11. difference_between_texts - Create knowledge graphs from two or more text and find what's not present in the first graph that's present in the others
12. analyze_llm_results - Ask an LLM to describe a topic and turn its answer into a knowledge graph that reveals how the model frames it (main concepts, clusters, content gaps, relations). Useful for probing model bias or comparing how different models describe the same topic. Default model: claude-opus-5. Saves by default; returns analytics by default and omits raw graph (includeGraph: false) to keep responses compact
13. analyze_google_search_results - Generate a Google search results graph from search queries
14. analyze_youtube_results - Generate a knowledge graph from YouTube results (search results, a channel's or playlist's videos, video comments, or transcribed subtitles) to reveal main topics, clusters, and content gaps
15. analyze_related_search_queries - Generate a graph of search requests related to search queries provided
16. search_queries_vs_search_results - Find what people search for but don't yet find
17. generate_seo_report - Analyze content for SEO optimization by comparing it with Google search results and search queries
18. list_graphs - List all graphs for the currently logged in user with optional filtering by name, type, date, language, or favorite status
19. search - Search through existing ${brand.name} graphs
20. fetch - Fetch a specific search result from a ${brand.name} graph
21. enable_project_learnings - Create the opt-in, per-project, append-only learnings graph (learn-<project>) in the user's account; call only on the user's explicit request, idempotent
22. add_project_learnings - Save what the assistant learned about operating in a project (where things live, traps, conventions, decisions, workflows, plus a self-assessment of what worked well and what to do differently) as typed statements; refuses when the project is not enabled, dry run by default, writes with confirm: true or via an MCP elicitation form the user approves
23. get_project_learnings - Retrieve a project's learnings by prompt (GraphRAG), by entity (file path, module, concept), or as an overview; with no project, lists the projects that have learnings. Returns enabled: false without error when there is no learnings graph
24. optimize_knowledge_base - Structural feedback on a code base, document vault, or set of rules/frameworks from its digest graph (or a digest passed as text, saved with saveAs; generate_ontology_graph in 'procedural' mode writes one from an uploaded graph): diagnosis (biased/focused/diversified/dispersed) read for the chosen focus, dominant and under-developed areas, missing bridges, AI suggestions; compareWith other layers of the same project to find what one has that the other lacks
25. submit_workflow_feedback - Internal telemetry: after a workflow, the assistant reports what it actually used from the output (observations, not a score) so the tools can be improved; never asks the user

Key Features:
- Topic modeling and clustering
- Content gap detection (finding missing connections)
- Network statistics (modularity, centrality, etc.)
- AI-powered topic naming (optional)
- Entity detection for cleaner graphs

Configuration:
- Requires ${brand.envPrefix}_API_KEY environment variable
- Get your API key at: https://${brand.domain}/api-access

${brand.name} uses advanced graph theory algorithms to:
- Identify clusters of related ideas
- Highlight influential concepts
- Reveal gaps in discourse
- Generate research questions
- Optimize knowledge base structure

Learn more: https://${brand.domain}`,
				},
			],
		};
	},
};
