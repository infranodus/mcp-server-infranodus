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
1. generateKnowledgeGraph - Convert any text into a knowledge graph with topics, concepts, and structural analysis
2. analyzeExistingGraphByName - Retrieve and analyze graphs from your InfraNodus account
3. generateContentGaps - Generate content gaps from text
4. generateTopicalClusters - Generate topics and clusters of keywords from text using knowledge graph analysis
5. generateResearchQuestions - Generate research questions based on content gaps
6. generateResearchQuestionsFromGraph - Generate research questions based on an existing InfraNodus graph
7. generateResponsesFromGraph - Generate responses from an existing InfraNodus graph or ontology
8. generateTextOverview - Generate a topical overview of a text and provide insights for LLMs to generate better responses
9. createKnowledgeGraph - Create a knowledge graph in InfraNodus from text and provide a link to it

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
