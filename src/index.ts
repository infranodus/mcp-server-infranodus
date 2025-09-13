#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config, validateConfig } from "./config/index.js";
import {
	generateKnowledgeGraphTool,
	analyzeExistingGraphTool,
	generateContentGapsTool,
} from "./tools/index.js";
import { aboutResource } from "./resources/about.js";

// Validate configuration
if (!validateConfig()) {
	// Exit silently without console output that could interfere with MCP protocol
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
		process.exit(1);
	}
}

// Run the server
main().catch(() => {
	// Exit silently on fatal error
	process.exit(1);
});