#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config, validateConfig } from "./config/index.js";
import {
	generateKnowledgeGraphTool,
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
	// Log to stderr before exiting
	console.error(
		"ERROR: Configuration validation failed. Check stderr output above."
	);
	process.exit(1);
}

// Create MCP server
const server = new McpServer(config.server);

// Register tools
server.registerTool(
	generateKnowledgeGraphTool.name,
	generateKnowledgeGraphTool.definition,
	generateKnowledgeGraphTool.handler
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
		// Exit silently on error
		console.error(
			"ERROR: MCP server failed to connect. Check stderr output above."
		);
		process.exit(1);
	}
}

// Run the server
main().catch(() => {
	// Exit silently on fatal error
	console.error("ERROR: Fatal error of MCP server. Check stderr output above.");
	process.exit(1);
});
