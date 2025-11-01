import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { configSchema, serverInfo } from "./config/index.js";
import {
	generateKnowledgeGraphTool,
	addMemoryTool,
	getMemoryTool,
	createKnowledgeGraphTool,
	analyzeExistingGraphTool,
	generateContentGapsTool,
	generateTopicalClustersTool,
	generateResearchQuestionsTool,
	generateResearchIdeasTool,
	generateResearchQuestionsFromGraphTool,
	generateResponsesFromGraphTool,
	generateContextualHintTool,
	searchExistingGraphsTool,
	searchExistingGraphsFetchTool,
	generateOverlapGraphFromTextsTool,
	generateDifferenceGraphFromTextsTool,
	generateGoogleSearchResultsGraphTool,
	generateGoogleSearchQueriesGraphTool,
	generateGoogleResultsVsQueriesGraphTool,
	generateSEOGraphTool,
	developConceptualBridgesTool,
	developLatentTopicsTool,
	developTextTool,
} from "./tools/index.js";
import { aboutResource } from "./resources/about.js";
import { prompts } from "./prompts/index.js";
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
	const mcpServer = new McpServer(serverInfo);

	// Helper function to wrap tool handlers with server context
	const wrapHandler = (handler: any) => {
		return async (params: any, extra: any) => {
			return handler(params, {
				progressToken: extra?._meta?.progressToken,
				sendNotification: extra?.sendNotification,
			});
		};
	};

	// Register tools
	mcpServer.registerTool(
		generateKnowledgeGraphTool.name,
		generateKnowledgeGraphTool.definition,
		wrapHandler(generateKnowledgeGraphTool.handler)
	);

	mcpServer.registerTool(
		createKnowledgeGraphTool.name,
		createKnowledgeGraphTool.definition,
		wrapHandler(createKnowledgeGraphTool.handler)
	);

	mcpServer.registerTool(
		addMemoryTool.name,
		addMemoryTool.definition,
		wrapHandler(addMemoryTool.handler)
	);

	mcpServer.registerTool(
		getMemoryTool.name,
		getMemoryTool.definition,
		wrapHandler(getMemoryTool.handler)
	);

	mcpServer.registerTool(
		analyzeExistingGraphTool.name,
		analyzeExistingGraphTool.definition,
		wrapHandler(analyzeExistingGraphTool.handler)
	);

	mcpServer.registerTool(
		generateContentGapsTool.name,
		generateContentGapsTool.definition,
		wrapHandler(generateContentGapsTool.handler)
	);

	mcpServer.registerTool(
		generateTopicalClustersTool.name,
		generateTopicalClustersTool.definition,
		wrapHandler(generateTopicalClustersTool.handler)
	);

	mcpServer.registerTool(
		generateResearchQuestionsTool.name,
		generateResearchQuestionsTool.definition,
		wrapHandler(generateResearchQuestionsTool.handler)
	);

	mcpServer.registerTool(
		generateResearchIdeasTool.name,
		generateResearchIdeasTool.definition,
		wrapHandler(generateResearchIdeasTool.handler)
	);

	mcpServer.registerTool(
		generateResearchQuestionsFromGraphTool.name,
		generateResearchQuestionsFromGraphTool.definition,
		wrapHandler(generateResearchQuestionsFromGraphTool.handler)
	);

	mcpServer.registerTool(
		generateResponsesFromGraphTool.name,
		generateResponsesFromGraphTool.definition,
		wrapHandler(generateResponsesFromGraphTool.handler)
	);

	mcpServer.registerTool(
		developConceptualBridgesTool.name,
		developConceptualBridgesTool.definition,
		wrapHandler(developConceptualBridgesTool.handler)
	);

	mcpServer.registerTool(
		developLatentTopicsTool.name,
		developLatentTopicsTool.definition,
		wrapHandler(developLatentTopicsTool.handler)
	);

	mcpServer.registerTool(
		developTextTool.name,
		developTextTool.definition,
		wrapHandler(developTextTool.handler)
	);

	mcpServer.registerTool(
		generateContextualHintTool.name,
		generateContextualHintTool.definition,
		wrapHandler(generateContextualHintTool.handler)
	);

	mcpServer.registerTool(
		generateOverlapGraphFromTextsTool.name,
		generateOverlapGraphFromTextsTool.definition,
		wrapHandler(generateOverlapGraphFromTextsTool.handler)
	);

	mcpServer.registerTool(
		generateDifferenceGraphFromTextsTool.name,
		generateDifferenceGraphFromTextsTool.definition,
		wrapHandler(generateDifferenceGraphFromTextsTool.handler)
	);

	mcpServer.registerTool(
		generateGoogleSearchResultsGraphTool.name,
		generateGoogleSearchResultsGraphTool.definition,
		wrapHandler(generateGoogleSearchResultsGraphTool.handler)
	);

	mcpServer.registerTool(
		generateGoogleSearchQueriesGraphTool.name,
		generateGoogleSearchQueriesGraphTool.definition,
		wrapHandler(generateGoogleSearchQueriesGraphTool.handler)
	);

	mcpServer.registerTool(
		generateGoogleResultsVsQueriesGraphTool.name,
		generateGoogleResultsVsQueriesGraphTool.definition,
		wrapHandler(generateGoogleResultsVsQueriesGraphTool.handler)
	);

	mcpServer.registerTool(
		generateSEOGraphTool.name,
		generateSEOGraphTool.definition,
		wrapHandler(generateSEOGraphTool.handler)
	);

	mcpServer.registerTool(
		searchExistingGraphsTool.name,
		searchExistingGraphsTool.definition,
		wrapHandler(searchExistingGraphsTool.handler)
	);

	mcpServer.registerTool(
		searchExistingGraphsFetchTool.name,
		searchExistingGraphsFetchTool.definition,
		wrapHandler(searchExistingGraphsFetchTool.handler)
	);

	// Register resources
	mcpServer.registerResource(
		aboutResource.name,
		aboutResource.uri,
		aboutResource.definition,
		aboutResource.handler
	);

	// Register prompts
	prompts.forEach((prompt) => {
		mcpServer.registerPrompt(prompt.name, prompt.definition, prompt.handler);
	});

	// Return the server instance
	return mcpServer.server;
}

// Main function for STDIO compatibility (local development)
async function main() {
	// Load environment variables for local development
	dotenv.config();

	const config = {
		apiKey: process.env.INFRANODUS_API_KEY || "",
		apiBase: process.env.INFRANODUS_API_BASE || "https://infranodus.com/api/v1",
	};

	// Validate config
	if (!config.apiKey) {
		console.error(
			"WARNING: Set INFRANODUS_API_KEY in environment variables to ensure you don't hit the rate limit"
		);
		// process.exit(1);
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
