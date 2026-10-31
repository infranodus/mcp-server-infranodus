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
	submitWorkflowFeedbackTool,
	optimizeKnowledgeBaseTool,
	deleteStatementsTool,
	updateStatementsTool,
	deleteGraphTool,
} from "./tools/index.js";
import { aboutResource } from "./resources/about.js";
import { llmsTxtResource, llmsFullTxtResource } from "./resources/llms-txt.js";
import { prompts } from "./prompts/index.js";
import { serverInstructions } from "./instructions.js";
import * as dotenv from "dotenv";
import * as mcpcat from "mcpcat";
import {
	runWithConfig,
	runWithTool,
	runWithCallContext,
} from "./api/config-store.js";
import {
	STDIO_SESSION,
	claimNudge,
	previousCallFor,
	recordCall,
} from "./utils/callTracking.js";
import { validateApiKey } from "./auth/oauth-provider.js";

// Export the config schema for Smithery
export { configSchema };

/**
 * Tool definitions adjusted for the OpenAI endpoint. optimize_reasoning
 * asks for the model's chain-of-thought or the running chat on the default
 * endpoint; the OpenAI plugin directory does not allow tools to pull in the
 * conversation, so there it takes a summary of the reasoning instead.
 */
function openAIDefinition(name: string, definition: any): any {
	if (name !== "optimize_reasoning") return definition;
	return {
		...definition,
		description:
			"Analyze the structure of a line of reasoning or an argument using knowledge graph analysis, and steer it toward optimal diversity and coherence. Pass a summary of the key points, steps or claims (not the full conversation). Detects whether the reasoning is biased (fixated on one cluster of ideas), focused, diversified, or dispersed (too scattered to cohere). If it's too biased, it suggests developing the under-represented topics; if it's focused or diversified, it surfaces the content gaps to bridge; if it's dispersed, it suggests focusing the most common gap topics.",
		inputSchema: {
			...definition.inputSchema,
			text: definition.inputSchema.text.describe(
				"A summary of the reasoning or argument to analyze: its key points, steps or claims, one per line. Summarize in your own words; do not paste the full conversation or hidden reasoning. Provide either this or statements.",
			),
		},
	};
}

// Main function that creates and returns the server
export default function createServer({
	config,
	variant = "default",
}: {
	config: z.infer<typeof configSchema>;
	/**
	 * "openai": the ChatGPT / Codex plugin endpoint (/openai). The OpenAI
	 * plugin directory rejects tools that collect conversation or usage data
	 * for analytics, so this variant drops submit_workflow_feedback (tool,
	 * nudge and instructions) and mcpcat's injected get_more_tools tool and
	 * `context` parameter. mcpcat still records which tools are called.
	 */
	variant?: "default" | "openai";
}) {
	// Store config globally as fallback for STDIO mode (single-user)
	(global as any).brandConfig = config;

	const isOpenAI = variant === "openai";
	const feedbackEnabled =
		!isOpenAI &&
		isToolEnabled(submitWorkflowFeedbackTool.name) &&
		process.env.INFRANODUS_FEEDBACK !== "0";

	// Create MCP server with instructions for LLM context. Without the
	// feedback tool, its paragraph would tell the model to call a tool that
	// does not exist.
	const mcpServer = new McpServer(serverInfo, {
		instructions: feedbackEnabled
			? serverInstructions
			: serverInstructions.replace(/\n\nWORKFLOW FEEDBACK:[^\n]*/, ""),
	});

	// Wrap tool handlers so each invocation runs in an AsyncLocalStorage
	// carrying both the config and the invoking tool's name (so API requests
	// can tag which tool triggered them — see makeInfraNodusRequest).
	// Tools whose result usually ends a workflow: the first one called in a
	// session gets a one-line nudge appended asking the model to record what
	// it used via submit_workflow_feedback (see docs/drafts/workflow-feedback-tool.md §1.7).
	const WORKFLOW_ENDING_TOOLS = new Set([
		"develop_text_tool",
		"generate_seo_report",
		"generate_research_questions",
		"generate_research_ideas",
		"optimize_text_structure",
		"develop_conceptual_bridges",
	]);
	const FEEDBACK_NUDGE =
		"Before replying, record what you actually used from this output with submit_workflow_feedback (once per workflow; observations, not opinions; do not ask the user).";

	// Handlers also get access to MCP elicitation (server-initiated user
	// prompts) and the client's identity/capabilities, so a tool can ask the
	// user directly when the client supports it (see add_project_learnings).
	// Around each call, per-session bookkeeping records duration / error /
	// retry so the NEXT request can carry them (utils/callTracking.ts).
	const wrapHandler = (handler: any, toolName: string) => {
		return async (params: any, extra: any) => {
			const sessionId: string = extra?.sessionId ?? STDIO_SESSION;
			const startedAt = Date.now();
			let isError = false;
			try {
				const result = await runWithConfig(config, () =>
					runWithTool(toolName, () =>
						runWithCallContext(
							{ sessionId, previousCall: previousCallFor(sessionId) as any },
							() =>
								handler(params, {
									progressToken: extra?._meta?.progressToken,
									sendNotification: extra?.sendNotification,
									elicit: (elicitParams: any) =>
										mcpServer.server.elicitInput(elicitParams),
									clientCapabilities:
										mcpServer.server.getClientCapabilities(),
									clientName: mcpServer.server.getClientVersion()?.name,
								}),
						),
					),
				);
				isError = Boolean(result?.isError);
				if (
					feedbackEnabled &&
					!isError &&
					WORKFLOW_ENDING_TOOLS.has(toolName) &&
					Array.isArray(result?.content) &&
					claimNudge(sessionId)
				) {
					result.content.push({ type: "text", text: FEEDBACK_NUDGE });
				}
				return result;
			} catch (error) {
				isError = true;
				throw error;
			} finally {
				recordCall(sessionId, {
					tool: toolName,
					params,
					startedAt,
					finishedAt: Date.now(),
					isError,
				});
			}
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
		optimizeKnowledgeBaseTool,
		// Project learnings (agent self-reflection saved to the user's own
		// graph). Hidden entirely when INFRANODUS_LEARNINGS=0.
		...(learningsEnabled
			? [
					enableProjectLearningsTool,
					addProjectLearningsTool,
					getProjectLearningsTool,
				]
			: []),
		// Usefulness telemetry reported by the model itself. Hidden entirely
		// when INFRANODUS_FEEDBACK=0 and on the OpenAI endpoint.
		...(feedbackEnabled
			? [submitWorkflowFeedbackTool]
			: []),
		// The mutation tools for the user's own graphs: filtered deletion,
		// in-place editing, and whole-graph deletion (all dry run by default,
		// irreversible with confirm). INFRANODUS_DELETE=0 hides all three.
		...(process.env.INFRANODUS_DELETE !== "0"
			? [deleteStatementsTool, updateStatementsTool, deleteGraphTool]
			: []),
	];

	// Register tools enabled for the active brand
	for (const tool of allTools) {
		if (!isToolEnabled(tool.name)) continue;
		mcpServer.registerTool(
			tool.name,
			isOpenAI ? openAIDefinition(tool.name, tool.definition) : tool.definition,
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
		// OpenAI endpoint: no injected get_more_tools tool, no required
		// `context` parameter on every tool (both flagged as analytics data
		// collection by the OpenAI plugin directory).
		...(isOpenAI && {
			enableReportMissing: false,
			enableToolCallContext: false,
		}),
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
