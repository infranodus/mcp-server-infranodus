import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { configSchema, serverInfo } from "./config/index.js";
import {
	brand,
	brandApiKey,
	brandApiBase,
	isToolEnabled,
} from "./config/brand.js";
import {
	generateKnowledgeGraphTool,
	createKnowledgeGraphTool,
	generateOntologyGraphTool,
	analyzeLlmResultsTool,
	addMemoryTool,
	getMemoryTool,
	analyzeExistingGraphTool,
	analyzeTextTool,
	generateContentGapsTool,
	generateTopicalClustersTool,
	generateResearchQuestionsTool,
	generateResearchIdeasTool,
	generateResponsesFromGraphTool,
	generateContextualHintTool,
	retrieveContextForPromptFromGraphTool,
	developConceptualBridgesTool,
	developLatentTopicsTool,
	optimizeTextStructureTool,
	optimizeReasoningTool,
	listGraphsTool,
	searchExistingGraphsTool,
	searchExistingGraphsFetchTool,
	generateOverlapGraphFromTextsTool,
	generateMergedGraphFromTextsTool,
	generateDifferenceGraphFromTextsTool,
	generateGoogleSearchResultsGraphTool,
	generateYoutubeSearchResultsGraphTool,
	generateGoogleSearchQueriesGraphTool,
	generateGoogleResultsVsQueriesGraphTool,
	generateSEOGraphTool,
	developTextTool,
} from "./tools/index.js";
import { aboutResource } from "./resources/about.js";
import { llmsTxtResource, llmsFullTxtResource } from "./resources/llms-txt.js";
import { prompts } from "./prompts/index.js";
import { serverInstructions } from "./instructions.js";
import * as dotenv from "dotenv";
import * as mcpcat from "mcpcat";
import { runWithConfig } from "./api/config-store.js";

// Export the config schema for Smithery
export { configSchema };

// Main function that creates and returns the server
export default function createServer({
	config,
}: {
	config: z.infer<typeof configSchema>;
}) {
	// Store config globally as fallback for STDIO mode (single-user)
	(global as any).brandConfig = config;

	// Create MCP server with instructions for LLM context
	const mcpServer = new McpServer(serverInfo, {
		instructions: serverInstructions,
	});

	// Wrap tool handlers so each invocation runs in an AsyncLocalStorage
	const wrapHandler = (handler: any) => {
		return async (params: any, extra: any) => {
			return runWithConfig(config, () =>
				handler(params, {
					progressToken: extra?._meta?.progressToken,
					sendNotification: extra?.sendNotification,
				}),
			);
		};
	};

	// All tools are compiled in; the active brand decides which are exposed
	// (see excludedTools in config/brand.ts). New tools added here appear in
	// every brand automatically unless explicitly excluded.
	const allTools: { name: string; definition: any; handler: any }[] = [
		generateKnowledgeGraphTool,
		createKnowledgeGraphTool,
		generateOntologyGraphTool,
		addMemoryTool,
		getMemoryTool,
		analyzeExistingGraphTool,
		analyzeTextTool,
		generateContentGapsTool,
		generateTopicalClustersTool,
		generateResearchQuestionsTool,
		generateResearchIdeasTool,
		generateResponsesFromGraphTool,
		generateContextualHintTool,
		retrieveContextForPromptFromGraphTool,
		developConceptualBridgesTool,
		developLatentTopicsTool,
		optimizeTextStructureTool,
		optimizeReasoningTool,
		developTextTool,
		listGraphsTool,
		searchExistingGraphsTool,
		searchExistingGraphsFetchTool,
		generateOverlapGraphFromTextsTool,
		generateMergedGraphFromTextsTool,
		generateDifferenceGraphFromTextsTool,
		generateGoogleSearchResultsGraphTool,
		generateYoutubeSearchResultsGraphTool,
		generateGoogleSearchQueriesGraphTool,
		generateGoogleResultsVsQueriesGraphTool,
		analyzeLlmResultsTool,
		generateSEOGraphTool,
	];

	// Register tools enabled for the active brand
	for (const tool of allTools) {
		if (!isToolEnabled(tool.name)) continue;
		mcpServer.registerTool(
			tool.name,
			tool.definition,
			wrapHandler(tool.handler),
		);
	}

	// Register resources
	mcpServer.registerResource(
		aboutResource.name,
		aboutResource.uri,
		aboutResource.definition,
		aboutResource.handler,
	);

	mcpServer.registerResource(
		llmsTxtResource.name,
		llmsTxtResource.uri,
		llmsTxtResource.definition,
		llmsTxtResource.handler,
	);

	mcpServer.registerResource(
		llmsFullTxtResource.name,
		llmsFullTxtResource.uri,
		llmsFullTxtResource.definition,
		llmsFullTxtResource.handler,
	);

	// Register prompts
	prompts.forEach((prompt) => {
		mcpServer.registerPrompt(prompt.name, prompt.definition, prompt.handler);
	});

	mcpcat.track(mcpServer.server, "proj_3AiICLoMV0iZakDgdJGLoipgOor", {
		...(config.userId && {
			identify: async () => ({
				userId: String(config.userId),
				userName: config.userName,
			}),
		}),
	});

	// Return the server instance
	return mcpServer.server;
}

// Main function for STDIO compatibility (local development)
async function main() {
	// Load environment variables for local development
	dotenv.config();

	const config = {
		apiKey: brandApiKey(),
		apiBase: brandApiBase(),
	};

	// Validate config
	if (!config.apiKey) {
		console.error(
			`WARNING: Set ${brand.envPrefix}_API_KEY in environment variables to ensure you don't hit the rate limit`,
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
