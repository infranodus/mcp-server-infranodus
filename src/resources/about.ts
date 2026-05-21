export const aboutResource = {
	name: "about",
	uri: "info://about",
	definition: {
		name: "About InfraNodus MCP Server",
		description:
			"InfraNodus MCP server can generate knowledge graphs and perform text analysis using the InfraNodus API. It can work with your existing InfraNodus graphs or with the text you submit via your LLM workflows or Claude desktop client. InfraNodus MCP can extract the main topics and identify the content gaps in any text and use the built-in AI with the model of your choice (no additional keys needed) to generate research questions that can be used as prompts to augment your LLM's responses.",
		mimeType: "text/plain",
	},
	handler: async () => {
		return {
			contents: [
				{
					uri: "info://about",
					mimeType: "text/plain",
					text: `InfraNodus MCP Server

This server provides tools for text analysis and knowledge graph generation using InfraNodus API.

Available Tools:
1. generate_knowledge_graph - Convert any text into a knowledge graph with topics, concepts, and structural analysis
2. analyze_existing_graph_by_name - Retrieve and analyze graphs content from your InfraNodus account
3. analyze_text - Analyze a text, URL, or YouTube transcript; extract and analyze a graph from text or URL (provide either text or url)
4. generate_content_gaps - Generate content gaps from text
5. generate_topical_clusters - Generate topics and clusters of keywords from text using knowledge graph analysis; by default also returns AI-generated summaries of each topical cluster (topicalClusterSummaries, useful for SEO-optimized content creation) — set generateTopicalSummaries: false to increase processing speed or if the summary request fails
6. generate_contextual_hint - Generate a topical overview of a text and provide insights for LLMs to generate better responses
7. generate_research_questions - Generate research questions from text, URL, or an existing InfraNodus graph (content gaps)
8. generate_research_ideas - Generate innovative research ideas based on content gaps that can be used to improve the text and discourse
9. optimize_text_structure - Analyze the level of bias and coherence in text; if too biased, develop the represented topics; if focused or diversified, develop the content gaps; if dispersed, focus the most common gap topics
10. generate_responses_from_graph - Generate responses from an existing InfraNodus graph or ontology
11. develop_conceptual_bridges - Analyze text and develop latent ideas based on concepts that connect this text to a broader discourse
12. develop_latent_topics - Analyze text and extract underdeveloped topics with ideas on how to develop them
13. develop_text_tool - Comprehensive text analysis combining research questions, latent topics, and content gaps with progress tracking
14. create_knowledge_graph - Create a knowledge graph in InfraNodus from text and provide a link to it
15. overlap_between_texts - Create knowledge graphs from two or more texts and find the overlap (similarities) between them
16. merged_graph_from_texts - Build a graph of all the texts, URLs, and existing graphs provided, providing topical clusters and gaps present in the merged graph generated from all the texts
17. difference_between_texts - Create knowledge graphs from two or more text and find what's not present in the first graph that's present in the others
18. analyze_google_search_results - Generate a Google search results graph from search queries
19. analyze_related_search_queries - Generate a graph of search requests related to search queries provided
20. search_queries_vs_search_results - Find what people search for but don't yet find
21. generate_seo_report - Analyze content for SEO optimization by comparing it with Google search results and search queries
22. memory_add_relations - Add relations to InfraNodus memory from text with entity detection and save for future retrieval
23. memory_get_relations - Retrieve relations from InfraNodus memory for specific entities or contexts
24. retrieve_from_knowledge_base - Retrieve context from an existing InfraNodus knowledge graph using GraphRAG for prompt augmentation
25. list_graphs - List all graphs for the currently logged in user with optional filtering by name, type, date, language, or favorite status
26. search - Search through existing InfraNodus graphs
27. fetch - Fetch a specific search result from an InfraNodus graph

Key Features:
- Topic modeling and clustering
- Content gap detection (finding missing connections)
- Network statistics (modularity, centrality, etc.)
- AI-powered topic naming (optional)
- Entity detection for cleaner graphs

Configuration:
- Requires INFRANODUS_API_KEY environment variable
- Get your API key at: https://infranodus.com/api-access

InfraNodus uses advanced graph theory algorithms to:
- Identify clusters of related ideas
- Highlight influential concepts
- Reveal gaps in discourse
- Generate research questions
- Optimize knowledge base structure

Learn more: https://infranodus.com`,
				},
			],
		};
	},
};
