#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config, validateConfig } from "./config/index.js";
import { SSEHandler } from "./utils/sse.js";
import { createProgressHandler } from "./utils/progressNotifications.js";
import { createStreamingTool } from "./tools/streamingExample.js";
import {
	generateKnowledgeGraphTool,
	createKnowledgeGraphTool,
	analyzeExistingGraphTool,
	generateContentGapsTool,
	generateTopicalClustersTool,
	generateResearchQuestionsTool,
	generateResearchQuestionsFromGraphTool,
	generateResponsesFromGraphTool,
	generateTextOverviewTool,
} from "./tools/index.js";
import { aboutResource } from "./resources/about.js";

// Validate configuration
if (!validateConfig()) {
	console.error(
		"ERROR: Configuration validation failed. Check stderr output above."
	);
	process.exit(1);
}

// Create MCP server with SSE support
const server = new McpServer({
	...config.server,
	capabilities: {
		...config.server.capabilities,
		progressNotifications: true,
		streaming: true,
	},
});

// Initialize SSE handler and progress handler
const sseHandler = new SSEHandler(server);
const { notifier, withProgress } = createProgressHandler(server);

// Register standard tools
server.registerTool(
	generateKnowledgeGraphTool.name,
	generateKnowledgeGraphTool.definition,
	generateKnowledgeGraphTool.handler
);

server.registerTool(
	createKnowledgeGraphTool.name,
	createKnowledgeGraphTool.definition,
	createKnowledgeGraphTool.handler
);

server.registerTool(
	analyzeExistingGraphTool.name,
	analyzeExistingGraphTool.definition,
	analyzeExistingGraphTool.handler
);

server.registerTool(
	generateContentGapsTool.name,
	generateContentGapsTool.definition,
	generateContentGapsTool.handler
);

server.registerTool(
	generateTopicalClustersTool.name,
	generateTopicalClustersTool.definition,
	generateTopicalClustersTool.handler
);

server.registerTool(
	generateResearchQuestionsTool.name,
	generateResearchQuestionsTool.definition,
	generateResearchQuestionsTool.handler
);

server.registerTool(
	generateResearchQuestionsFromGraphTool.name,
	generateResearchQuestionsFromGraphTool.definition,
	generateResearchQuestionsFromGraphTool.handler
);

server.registerTool(
	generateResponsesFromGraphTool.name,
	generateResponsesFromGraphTool.definition,
	generateResponsesFromGraphTool.handler
);

server.registerTool(
	generateTextOverviewTool.name,
	generateTextOverviewTool.definition,
	generateTextOverviewTool.handler
);

// Register streaming tool
const streamingTool = createStreamingTool(sseHandler);
server.registerTool(
	streamingTool.name,
	streamingTool.definition,
	streamingTool.handler
);

// Example of a tool with progress notifications
server.registerTool(
	"analyzeWithProgress",
	{
		title: "Analyze with Progress",
		description: "Example tool showing progress notifications",
		inputSchema: {
			text: { type: "string", description: "Text to analyze" },
			progressToken: { type: "string", description: "Progress token for notifications" },
		},
	},
	async (params: { text: string; progressToken?: string }) => {
		if (params.progressToken) {
			return await withProgress(
				params.progressToken,
				"Analyzing text",
				async (reporter) => {
					await reporter.report(params.progressToken!, "Starting analysis...", 0);

					// Simulate processing steps
					await new Promise(resolve => setTimeout(resolve, 500));
					await reporter.report(params.progressToken!, "Processing text...", 33);

					await new Promise(resolve => setTimeout(resolve, 500));
					await reporter.report(params.progressToken!, "Building graph...", 66);

					await new Promise(resolve => setTimeout(resolve, 500));
					await reporter.report(params.progressToken!, "Generating insights...", 100);

					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({
									analyzed: true,
									textLength: params.text.length,
									timestamp: new Date().toISOString(),
								}, null, 2),
							},
						],
					};
				}
			);
		}

		// Fallback to non-progress version
		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify({
						analyzed: true,
						textLength: params.text.length,
					}, null, 2),
				},
			],
		};
	}
);

// Register resources
server.registerResource(
	aboutResource.name,
	aboutResource.uri,
	aboutResource.definition,
	aboutResource.handler
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
		console.error(
			"ERROR: MCP server failed to connect. Check stderr output above."
		);
		process.exit(1);
	}
}

// Run the server
main().catch(() => {
	console.error("ERROR: Fatal error of MCP server. Check stderr output above.");
	process.exit(1);
});