import { z } from "zod";

// Define the configuration schema for Smithery
export const configSchema = z.object({
	apiKey: z.string().optional().describe("Your KeywordGraph API key"),
	apiBase: z
		.string()
		.default("https://keywordgraph.com/api/v1")
		.describe("KeywordGraph API base URL"),
	userId: z.number().optional().describe("Authenticated user ID"),
	userName: z.string().optional().describe("Authenticated user name"),
});

// Export the type for use in other files
export type Config = z.infer<typeof configSchema>;

// Server metadata
export const serverInfo = {
	name: "keywordgraph-mcp-server",
	version: "1.1.0",
	description:
		"MCP server for KeywordGraph knowledge graph generation, comparison, entity extraction, content gap, and SEO analysis.",
};
