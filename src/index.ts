import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
