#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from "dotenv";

// Load environment variables (dotenv v16 doesn't output to stdout by default)
dotenv.config();

// Environment configuration
const INFRANODUS_API_KEY = process.env.INFRANODUS_API_KEY;
const INFRANODUS_API_BASE = "http://localhost:3000/api/v1";

if (!INFRANODUS_API_KEY) {
	// Exit silently without console output that could interfere with MCP protocol
	process.exit(1);
}

// Define Zod schemas for input validation

const GenerateGraphSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe("Text that you'd like to analyze"),
	includeStatements: z
		.boolean()
		.default(false)
		.describe("Include processed statements in response"),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal), detectEntities (detect entities and keywords), extractEntitiesOnly (only entities)"
		),
});

const AnalyzeExistingGraphSchema = z.object({
	graphName: z
		.string()
		.min(1, "Graph name is required")
		.describe(
			"Name of the existing InfraNodus graph in your account to retrieve"
		),
	includeStatements: z
		.boolean()
		.default(true)
		.describe("Include processed statements in response"),
	includeGraphSummary: z
		.boolean()
		.default(false)
		.describe("Include AI-generated graph summary for RAG prompt augmentation"),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal), detectEntities (detect entities and keywords), extractEntitiesOnly (only entities)"
		),
});

const GenerateContentGapsSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe("Text that you'd like to retrieve content gaps from"),
});

// This below is used for adding options later to each tool
const _GenerateGeneralGraphSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe("Text that you'd like to analyze"),
	doNotSave: z
		.boolean()
		.default(true)
		.describe("Don't save the text to the InfraNodus graph"),
	addStats: z.boolean().default(true).describe("Include network statistics"),
	includeStatements: z
		.boolean()
		.default(true)
		.describe("Include processed statements in response"),
	includeGraphSummary: z
		.boolean()
		.default(true)
		.describe("Include AI-generated graph summary for RAG prompt augmentation"),
	extendedGraphSummary: z
		.boolean()
		.default(true)
		.describe("Include extended graph summary"),
	includeGraph: z
		.boolean()
		.default(true)
		.describe("Include full graph structure"),
	aiTopics: z
		.boolean()
		.default(true)
		.describe("Generate AI names for topics (uses OpenAI)"),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal), detectEntities (detect entities and keywords), extractEntitiesOnly (only entities)"
		),
});

// Type definitions for API responses
interface GraphNode {
	id: string;
	label: string;
	degree: number;
	bc: number; // betweenness centrality
	community: number;
	x: number;
	y: number;
	weighedDegree: number;
}

interface GraphEdge {
	source: string;
	target: string;
	id: string;
	weight: number;
}

interface TopCluster {
	community: string;
	nodes: Array<{
		nodeName: string;
		degree: number;
		bc: number;
	}>;
	statements?: number[];
	statementIds?: number[];
	topStatementId: number;
	aiName?: string;
}

interface GraphGap {
	source: string;
	target: string;
	weight: number;
	concepts: string[];
}

interface Statement {
	id: number;
	content: string;
	contextId: number;
	categories: string[];
	createdAt: string;
	sortId: number;
	statementHashtags: string[];
	statementCommunities: string[];
	topStatementCommunity: string;
	topStatementOfCommunity: string;
}

interface GraphResponse {
	statements?: Statement[];
	graph?: {
		graphologyGraph: {
			attributes: {
				modularity: number;
				top_nodes: string[];
				top_clusters: TopCluster[];
				gaps: GraphGap[];
			};
			nodes: GraphNode[];
			edges: GraphEdge[];
		};
		statementHasthags: any[];
	};
	graphSummary?: string;
	extendedGraphSummary?: {
		contentGaps?: string[];
		mainTopics?: string[];
		mainConcepts?: string[];
		conceptualGateways?: string[];
		topRelations?: string[];
		topBigrams?: string[];
	};
	userName?: string;
	isPublic?: boolean;
	error?: string;
}

// Structured output types
interface KnowledgeGraphOutput {
	statistics: {
		modularity: number;
		nodeCount: number;
		edgeCount: number;
		clusterCount: number;
	};
	graphSummary?: string;
	contentGaps?: string[];
	mainTopics?: string[];
	mainConcepts?: string[];
	conceptualGateways?: string[];
	topRelations?: string[];
	topBigrams?: string[];
	statements?: Array<Statement>;
	graphologyGraph?: any; // Full graph data if needed
	userName?: string;
	isPublic?: boolean;
}

interface GapsOutput {
	contentGaps?: string[];
}

interface InsightsOutput {
	summary?: string;
	topics?: Array<{
		name: string;
		concepts: string[];
	}>;
	gaps?: Array<{
		description: string;
		concepts: [string, string];
		bridges?: string[];
	}>;
	questions?: string[];
	keyInsights?: string[];
}

// Helper function to make API requests
async function makeInfraNodusRequest(
	endpoint: string,
	body: any
): Promise<GraphResponse> {
	try {
		const response = await fetch(`${INFRANODUS_API_BASE}${endpoint}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${INFRANODUS_API_KEY}`,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API request failed (${response.status}): ${errorText}`);
		}

		const data = await response.json();

		// Handle wrapped response format
		if (data.entriesAndGraphOfContext) {
			return data.entriesAndGraphOfContext;
		}

		return data;
	} catch (error) {
		// Don't log to console as it interferes with MCP protocol
		throw error;
	}
}

// Transform API response to structured output
function transformToStructuredOutput(
	data: GraphResponse,
	includeRaw: boolean = false
): KnowledgeGraphOutput {
	const output: KnowledgeGraphOutput = {
		statistics: {
			modularity: 0,
			nodeCount: 0,
			edgeCount: 0,
			clusterCount: 0,
		},
	};

	if (data.graphSummary) {
		output.graphSummary = data.graphSummary;
	}

	if (data.extendedGraphSummary) {
		output.contentGaps = data.extendedGraphSummary.contentGaps;
		output.mainTopics = data.extendedGraphSummary.mainTopics;
		output.mainConcepts = data.extendedGraphSummary.mainConcepts;
		output.conceptualGateways = data.extendedGraphSummary.conceptualGateways;
		output.topRelations = data.extendedGraphSummary.topRelations;
		output.topBigrams = data.extendedGraphSummary.topBigrams;
	}

	if (data.graph?.graphologyGraph) {
		const graph = data.graph.graphologyGraph;

		// Statistics
		output.statistics = {
			modularity: graph.attributes?.modularity || 0,
			nodeCount: graph.nodes?.length || 0,
			edgeCount: graph.edges?.length || 0,
			clusterCount: graph.attributes?.top_clusters?.length || 0,
		};

		// Include raw graph if requested
		if (includeRaw) {
			output.graphologyGraph = graph;
		}
	}

	// Statements
	if (data.statements) {
		output.statements = data.statements;
	}

	return output;
}

// Generate insights from graph data
function generateGaps(data: GraphResponse): GapsOutput {
	const gaps: GapsOutput = {};

	if (data.extendedGraphSummary?.contentGaps) {
		gaps.contentGaps = data.extendedGraphSummary.contentGaps;
	}

	return gaps;
}

// Generate insights from graph data
function generateInsights(
	data: GraphResponse,
	insightType: string
): InsightsOutput {
	const insights: InsightsOutput = {};

	if (insightType === "all" || insightType === "summary") {
		insights.summary = data.graphSummary;
	}

	if (
		(insightType === "all" || insightType === "topics") &&
		data.graph?.graphologyGraph.attributes.top_clusters
	) {
		insights.topics = data.graph.graphologyGraph.attributes.top_clusters
			.slice(0, 7)
			.map((cluster) => ({
				name: cluster.aiName || `Topic ${cluster.community}`,
				concepts: cluster.nodes.slice(0, 10).map((n) => n.nodeName),
			}));
	}

	if (
		(insightType === "all" || insightType === "gaps") &&
		data.graph?.graphologyGraph.attributes.gaps
	) {
		insights.gaps = data.graph.graphologyGraph.attributes.gaps
			.slice(0, 7)
			.map((gap) => ({
				description: `Potential connection between "${gap.source}" and "${gap.target}"`,
				concepts: [gap.source, gap.target],
				bridges: gap.concepts,
			}));
	}

	if (insightType === "all" || insightType === "questions") {
		insights.questions = [];

		if (data.graph?.graphologyGraph.attributes.gaps) {
			data.graph.graphologyGraph.attributes.gaps.slice(0, 5).forEach((gap) => {
				insights.questions!.push(
					`How might "${gap.source}" relate to or influence "${gap.target}"?`
				);
			});
		}

		if (data.graph?.graphologyGraph.attributes.top_nodes) {
			const topNodes = data.graph.graphologyGraph.attributes.top_nodes.slice(
				0,
				3
			);
			topNodes.forEach((node) => {
				insights.questions!.push(
					`What role does "${node}" play in connecting different aspects of this topic?`
				);
			});
		}
	}

	// Generate key insights
	if (insightType === "all") {
		insights.keyInsights = [];

		if (data.graph?.graphologyGraph.attributes) {
			const attrs = data.graph.graphologyGraph.attributes;

			if (attrs.modularity > 0.4) {
				insights.keyInsights.push(
					"The text has well-defined, distinct topic clusters"
				);
			} else if (attrs.modularity < 0.2) {
				insights.keyInsights.push(
					"The text is highly interconnected with overlapping themes"
				);
			}

			if (attrs.gaps && attrs.gaps.length > 5) {
				insights.keyInsights.push(
					`Found ${attrs.gaps.length} potential connections between disparate topics`
				);
			}

			if (attrs.top_clusters && attrs.top_clusters.length > 0) {
				const dominantCluster = attrs.top_clusters[0];
				const statementCount =
					dominantCluster.statementIds?.length ||
					dominantCluster.statements?.length ||
					0;
				const dominanceRatio = statementCount / (data.statements?.length || 1);
				if (dominanceRatio > 0.5) {
					insights.keyInsights.push(
						`The text is strongly focused on "${
							dominantCluster.aiName || "one main topic"
						}"`
					);
				}
			}
		}
	}

	return insights;
}

// Create MCP server
const server = new McpServer({
	name: "infranodus-mcp-server",
	version: "1.0.0",
	description:
		"MCP server for InfraNodus knowledge graph generation and text analysis",
});

// Tool 1: Generate knowledge graph from text
server.registerTool(
	"generateKnowledgeGraph",
	{
		title: "Generate Knowledge Graph from Text",
		description:
			"Analyze text and generate a knowledge graph with topics, concepts, and structural gaps",
		inputSchema: GenerateGraphSchema.shape,
	},
	async (params: z.infer<typeof GenerateGraphSchema>) => {
		try {
			const includeGraph = true;
			// Build query parameters
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeStatements: params.includeStatements.toString(),
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: includeGraph ? "true" : "false",
				aiTopics: "true",
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			const requestBody: any = {
				text: params.text,
				aiTopics: "true",
			};

			if (params.modifyAnalyzedText && params.modifyAnalyzedText !== "none") {
				requestBody.modifyAnalyzedText = params.modifyAnalyzedText;
			}

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			if (response.error) {
				return {
					content: [
						{
							type: "text",
							text: `Error: ${response.error}`,
						},
					],
					isError: true,
				};
			}

			const structuredOutput = transformToStructuredOutput(
				response,
				includeGraph
			);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(structuredOutput, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							error: error instanceof Error ? error.message : String(error),
						}),
					},
				],
				isError: true,
			};
		}
	}
);

// Tool 2: Analyze existing graph
server.registerTool(
	"analyzeExistingGraphByName",
	{
		title: "Analyze Existing InfraNodus Graph",
		description:
			"Retrieve and analyze an existing graph from your InfraNodus account",
		inputSchema: AnalyzeExistingGraphSchema.shape,
	},
	async (params: z.infer<typeof AnalyzeExistingGraphSchema>) => {
		try {
			const includeGraph = true;
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeStatements: params.includeStatements.toString(),
				includeGraphSummary: params.includeGraphSummary.toString(),
				extendedGraphSummary: "true",
				includeGraph: includeGraph ? "true" : "false",
				aiTopics: "true",
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			const requestBody = {
				name: params.graphName,
				aiTopics: "true",
			};

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			if (response.error) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ error: response.error }),
						},
					],
					isError: true,
				};
			}

			const structuredOutput = transformToStructuredOutput(
				response,
				includeGraph
			);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(structuredOutput, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							error: error instanceof Error ? error.message : String(error),
						}),
					},
				],
				isError: true,
			};
		}
	}
);

// Tool 3: Generate insights and research questions
server.registerTool(
	"generateContentGaps",
	{
		title: "Generate Content Gaps",
		description:
			"Generate content gaps from text using knowledge graph analysis",
		inputSchema: GenerateContentGapsSchema.shape,
	},
	async (params: z.infer<typeof GenerateContentGapsSchema>) => {
		try {
			// First generate the graph with focus on insights
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: "false",
				includeStatements: "false",
				aiTopics: "true",
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			const response = await makeInfraNodusRequest(endpoint, {
				text: params.text,
			});

			if (response.error) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ error: response.error }),
						},
					],
					isError: true,
				};
			}

			const insights = generateGaps(response);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(insights, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							error: error instanceof Error ? error.message : String(error),
						}),
					},
				],
				isError: true,
			};
		}
	}
);

// Add a resource with API information
server.registerResource(
	"about",
	"info://about",
	{
		name: "About InfraNodus MCP Server",
		description:
			"Information about this MCP server and InfraNodus capabilities",
		mimeType: "text/plain",
	},
	async () => {
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
	}
);

// Main function
async function main(): Promise<void> {
	const transport = new StdioServerTransport();

	// Handle graceful shutdown
	process.on("SIGINT", async () => {
		await server.close();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		await server.close();
		process.exit(0);
	});

	try {
		await server.connect(transport);
		// Server is running - no console output to avoid protocol interference
	} catch (error) {
		// Exit silently on error
		process.exit(1);
	}
}

// Run the server
main().catch((error: unknown) => {
	// Exit silently on fatal error
	process.exit(1);
});
