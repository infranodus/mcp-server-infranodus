import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { configSchema, serverInfo } from "./config/index.js";
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
import * as dotenv from "dotenv";

// Export the config schema for Smithery
export { configSchema };

// Main function that creates and returns the server
export default function createServer({
	config,
}: {
	config: z.infer<typeof configSchema>;
}) {
	// Store config globally for use in tools
	(global as any).infranodusConfig = config;

	// Create MCP server
	const server = new McpServer(serverInfo);

	// Register tools
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

	// Register resources
	server.registerResource(
		aboutResource.name,
		aboutResource.uri,
		aboutResource.definition,
		aboutResource.handler
	);

	// Return the server instance
	return server.server;
}

// Main function for STDIO compatibility (local development)
async function main() {
	// Load environment variables for local development
	dotenv.config();

	const config = {
		apiKey: process.env.INFRANODUS_API_KEY!,
		apiBase: process.env.INFRANODUS_API_BASE || "https://infranodus.com/api/v1",
	};

	// Validate config
	if (!config.apiKey) {
		console.error(
			"ERROR: INFRANODUS_API_KEY is not set in environment variables"
		);
		process.exit(1);
	}

	// Create server with config
	const server = createServer({ config });

	// Create STDIO transport
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
		console.error("ERROR: MCP server failed to connect");
		process.exit(1);
	}
}

// Run the server if this is the main module (for local development)
// When using Smithery CLI, this won't execute as the module is imported
// Use a simple check that works in both ESM and CJS
if (
	process.argv[1]?.endsWith("index.js") ||
	process.argv[1]?.endsWith("index.ts")
) {
	main().catch((error) => {
		console.error("ERROR: Fatal error of MCP server", error);
		process.exit(1);
	});
}
