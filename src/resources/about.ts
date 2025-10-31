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
2. analyze_existing_graph_by_name - Retrieve and analyze graphs from your InfraNodus account
3. generate_content_gaps - Generate content gaps from text
4. generate_topical_clusters - Generate topics and clusters of keywords from text using knowledge graph analysis
5. generate_text_overview - Generate a topical overview of a text and provide insights for LLMs to generate better responses
6. generate_research_questions - Generate research questions based on content gaps
7. generate_research_ideas - Generate innovative research ideas based on content gaps that can be used to improve the text and discourse
8. research_questions_from_graph - Generate research questions based on an existing InfraNodus graph
9. generate_responses_from_graph - Generate responses from an existing InfraNodus graph or ontology
10. develop_conceptual_bridges - Analyze text and develop latent ideas based on concepts that connect this text to a broader discourse
11. develop_latent_topics - Analyze text and extract underdeveloped topics with ideas on how to develop them
12. develop_text_tool - Comprehensive text analysis combining research questions, latent topics, and content gaps with progress tracking
13. create_knowledge_graph - Create a knowledge graph in InfraNodus from text and provide a link to it
14. overlap_between_texts - Create knowledge graphs from two or more texts and find the overlap (similarities) between them
15. difference_between_texts - Create knowledge graphs from two or more text and find what's not present in the first graph that's present in the others
16. analyze_google_search_results - Generate a Google search results graph from search queries
17. analyze_related_search_queries - Generate a graph of search requests related to search queries provided
18. search_queries_vs_search_results - Find what people search for but don't yet find
19. generate_seo_report - Analyze content for SEO optimization by comparing it with Google search results and search queries
20. memory_add_relations - Add relations to InfraNodus memory from text with entity detection and save for future retrieval
21. memory_get_relations - Retrieve relations from InfraNodus memory for specific entities or contexts
22. search - Search through existing InfraNodus graphs
23. fetch - Fetch a specific search result for a graph

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
