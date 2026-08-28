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
	enableProjectLearningsTool,
	addProjectLearningsTool,
	getProjectLearningsTool,
} from "./tools/index.js";
import { aboutResource } from "./resources/about.js";
import { llmsTxtResource, llmsFullTxtResource } from "./resources/llms-txt.js";
import { prompts } from "./prompts/index.js";
import { serverInstructions } from "./instructions.js";
import * as dotenv from "dotenv";
import * as mcpcat from "mcpcat";
import { runWithConfig, runWithTool } from "./api/config-store.js";
import { validateApiKey } from "./auth/oauth-provider.js";

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
	// carrying both the config and the invoking tool's name (so API requests
	// can tag which tool triggered them — see makeInfraNodusRequest).
	// Handlers also get access to MCP elicitation (server-initiated user
	// prompts) and the client's identity/capabilities, so a tool can ask the
	// user directly when the client supports it (see add_project_learnings).
	const wrapHandler = (handler: any, toolName: string) => {
		return async (params: any, extra: any) => {
			return runWithConfig(config, () =>
				runWithTool(toolName, () =>
					handler(params, {
						progressToken: extra?._meta?.progressToken,
						sendNotification: extra?.sendNotification,
						elicit: (elicitParams: any) =>
							mcpServer.server.elicitInput(elicitParams),
						clientCapabilities: mcpServer.server.getClientCapabilities(),
						clientName: mcpServer.server.getClientVersion()?.name,
					}),
				),
			);
		};
	};

	const learningsEnabled = process.env.INFRANODUS_LEARNINGS !== "0";

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
		// Project learnings (agent self-reflection saved to the user's own
		// graph). Hidden entirely when INFRANODUS_LEARNINGS=0.
		...(learningsEnabled
			? [
					enableProjectLearningsTool,
					addProjectLearningsTool,
					getProjectLearningsTool,
				]
			: []),
	];

	// Register tools enabled for the active brand
	for (const tool of allTools) {
		if (!isToolEnabled(tool.name)) continue;
		mcpServer.registerTool(
			tool.name,
			tool.definition,
			wrapHandler(tool.handler, tool.name),
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
		if (prompt.name === "save-learnings" && !learningsEnabled) return;
		if (
			prompt.name === "save-learnings" &&
			!isToolEnabled("add_project_learnings")
		)
			return;
		mcpServer.registerPrompt(prompt.name, prompt.definition, prompt.handler);
	});

	// Usage telemetry (which tools are called) via mcpcat, used to improve the
	// product. MCPCAT_ANONYMOUS=1 keeps the stats but skips user identification.
	const anonymous = process.env.MCPCAT_ANONYMOUS === "1";
	mcpcat.track(mcpServer.server, "proj_3AiICLoMV0iZakDgdJGLoipgOor", {
		...(!anonymous && {
			identify: async () => {
				// HTTP mode: identity already resolved during auth
				if (config.userId) {
					return {
						userId: String(config.userId),
						userName: config.userName,
					};
				}
				// STDIO/npx mode: resolve identity from the API key
				// (validateApiKey caches results, so this costs one API
				// round-trip per process, not one per event)
				if (config.apiKey) {
					const userInfo = await validateApiKey(config.apiKey);
					if (userInfo) {
						return {
							userId: String(userInfo.userId),
							userName: userInfo.userName,
						};
					}
				}
				return null;
			},
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
