export const aboutResource = {
	name: "about",
	uri: "info://about",
	definition: {
		name: "About InfraNodus MCP Server",
		description:
			"Information about this MCP server and InfraNodus capabilities",
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
