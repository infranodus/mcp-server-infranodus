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
	text: z.string().min(1, "Text is required for analysis"),
	doNotSave: z
		.boolean()
		.default(true)
		.describe("Don't save the graph to InfraNodus database"),
	addStats: z.boolean().default(true).describe("Include network statistics"),
	includeStatements: z
		.boolean()
		.default(true)
		.describe("Include original statements in response"),
	includeGraphSummary: z
		.boolean()
		.default(true)
		.describe("Include AI-generated graph summary"),
	includeGraph: z
		.boolean()
		.default(true)
		.describe("Include full graph structure"),
	aiTopics: z
		.boolean()
		.default(false)
		.describe("Generate AI names for topics (uses OpenAI)"),
	modifyAnalyzedText: z
		.enum(["detectEntities", "extractEntitiesOnly", "none"])
		.optional()
		.describe("Entity detection mode for sparser graphs"),
});

const AnalyzeExistingGraphSchema = z.object({
	graphName: z.string().min(1, "Graph name is required"),
	doNotSave: z.boolean().default(true),
	addStats: z.boolean().default(true),
	includeGraphSummary: z.boolean().default(true),
	includeStatements: z.boolean().default(false),
	includeGraph: z.boolean().default(true),
});

const GenerateInsightsSchema = z.object({
	text: z.string().min(1, "Text is required for analysis"),
	insightType: z
		.enum(["gaps", "topics", "summary", "questions", "all"])
		.default("all")
		.describe("Type of insights to generate"),
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
	statementHashtags: string[];
	statementCommunities: string[];
	topStatementCommunity: string;
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
	};
	graphSummary?: string;
	error?: string;
}

// Structured output types
interface KnowledgeGraphOutput {
	summary?: string;
	statistics: {
		modularity: number;
		nodeCount: number;
		edgeCount: number;
		clusterCount: number;
	};
	topConcepts: string[];
	topics: Array<{
		id: string;
		name?: string;
		concepts: string[];
		statementCount: number;
	}>;
	gaps: Array<{
		from: string;
		to: string;
		bridgeConcepts: string[];
		weight: number;
	}>;
	statements?: Array<{
		id: number;
		content: string;
		concepts: string[];
		topicId: string;
	}>;
	rawGraph?: any; // Full graph data if needed
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
async function makeInfraNodeusRequest(
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
			return {
				statements: data.entriesAndGraphOfContext.statements,
				graph: data.entriesAndGraphOfContext.graph,
				graphSummary: data.entriesAndGraphOfContext.graphSummary,
			};
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
		topConcepts: [],
		topics: [],
		gaps: [],
		statements: [],
	};

	if (data.graphSummary) {
		output.summary = data.graphSummary;
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

		// Top concepts
		if (graph.attributes?.top_nodes) {
			output.topConcepts = graph.attributes.top_nodes.slice(0, 15);
		}

		// Topics/Clusters
		if (graph.attributes?.top_clusters) {
			output.topics = graph.attributes.top_clusters.map((cluster) => ({
				id: cluster.community,
				name: cluster.aiName,
				concepts: cluster.nodes.slice(0, 10).map((n) => n.nodeName),
				statementCount: cluster.statementIds?.length || cluster.statements?.length || 0,
			}));
		}

		// Gaps
		if (graph.attributes?.gaps) {
			output.gaps = graph.attributes.gaps.map((gap) => ({
				from: gap.source,
				to: gap.target,
				bridgeConcepts: gap.concepts || [],
				weight: gap.weight,
			}));
		}

		// Include raw graph if requested
		if (includeRaw) {
			output.rawGraph = graph;
		}
	}

	// Statements
	if (data.statements) {
		output.statements = data.statements.slice(0, 20).map((stmt) => ({
			id: stmt.id,
			content: stmt.content,
			concepts: stmt.statementHashtags.slice(0, 10),
			topicId: stmt.topStatementCommunity,
		}));
	}

	return output;
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
				const statementCount = dominantCluster.statementIds?.length || dominantCluster.statements?.length || 0;
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
			// Build query parameters
			const queryParams = new URLSearchParams({
				doNotSave: params.doNotSave.toString(),
				addStats: params.addStats.toString(),
				includeStatements: params.includeStatements.toString(),
				includeGraphSummary: params.includeGraphSummary.toString(),
				includeGraph: params.includeGraph.toString(),
			});

			if (params.aiTopics) {
				queryParams.append("aiTopics", "true");
			}

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			const requestBody: any = {
				text: params.text,
			};

			if (params.modifyAnalyzedText && params.modifyAnalyzedText !== "none") {
				requestBody.modifyAnalyzedText = params.modifyAnalyzedText;
			}

			const response = await makeInfraNodeusRequest(endpoint, requestBody);

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
				params.includeGraph
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
	"analyzeExistingGraph",
	{
		title: "Analyze Existing InfraNodus Graph",
		description:
			"Retrieve and analyze an existing graph from your InfraNodus account",
		inputSchema: AnalyzeExistingGraphSchema.shape,
	},
	async (params: z.infer<typeof AnalyzeExistingGraphSchema>) => {
		try {
			const queryParams = new URLSearchParams({
				doNotSave: params.doNotSave.toString(),
				addStats: params.addStats.toString(),
				includeStatements: params.includeStatements.toString(),
				includeGraphSummary: params.includeGraphSummary.toString(),
				includeGraph: params.includeGraph.toString(),
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			const requestBody = {
				name: params.graphName,
			};

			const response = await makeInfraNodeusRequest(endpoint, requestBody);

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
				params.includeGraph
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
	"generateTextInsights",
	{
		title: "Generate Text Insights",
		description:
			"Generate insights, research questions, and content gaps from text using knowledge graph analysis",
		inputSchema: GenerateInsightsSchema.shape,
	},
	async (params: z.infer<typeof GenerateInsightsSchema>) => {
		try {
			// First generate the graph with focus on insights
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeGraphSummary: "true",
				includeGraph: "true",
				includeStatements: "false",
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			const response = await makeInfraNodeusRequest(endpoint, {
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

			const insights = generateInsights(response, params.insightType);

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
2. analyzeExistingGraph - Retrieve and analyze graphs from your InfraNodus account
3. generateTextInsights - Generate research questions, content gaps, and insights from text

Key Features:
- Topic modeling and clustering
- Structural gap detection (finding missing connections)
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
