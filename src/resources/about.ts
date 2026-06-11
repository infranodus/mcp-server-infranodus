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
6. develop_text_tool - Comprehensive text analysis combining research questions, latent topics, and content gaps with progress tracking
7. create_knowledge_graph - Create a knowledge graph in ${brand.name} from text and provide a link to it
8. overlap_between_texts - Create knowledge graphs from two or more texts and find the overlap (similarities) between them
9. merged_graph_from_texts - Build a graph of all the texts, URLs, and existing graphs provided, providing topical clusters and gaps present in the merged graph generated from all the texts
10. difference_between_texts - Create knowledge graphs from two or more text and find what's not present in the first graph that's present in the others
11. analyze_llm_results - Ask an LLM to describe a topic and turn its answer into a knowledge graph that reveals how the model frames it (main concepts, clusters, content gaps, relations). Useful for probing model bias or comparing how different models describe the same topic. Default model: claude-opus-4.6. Saves by default; returns analytics by default and omits raw graph (includeGraph: false) to keep responses compact
12. analyze_google_search_results - Generate a Google search results graph from search queries
13. analyze_youtube_search_results - Generate a knowledge graph from YouTube results (search results, a channel's or playlist's videos, video comments, or transcribed subtitles) to reveal main topics, clusters, and content gaps
14. analyze_related_search_queries - Generate a graph of search requests related to search queries provided
15. search_queries_vs_search_results - Find what people search for but don't yet find
16. generate_seo_report - Analyze content for SEO optimization by comparing it with Google search results and search queries
17. list_graphs - List all graphs for the currently logged in user with optional filtering by name, type, date, language, or favorite status
18. search - Search through existing ${brand.name} graphs
19. fetch - Fetch a specific search result from a ${brand.name} graph

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
