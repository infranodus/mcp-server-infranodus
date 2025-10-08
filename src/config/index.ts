import { z } from "zod";

// Define the configuration schema for Smithery
export const configSchema = z.object({
	apiKey: z.string().optional().describe("Your InfraNodus API key"),
	apiBase: z
		.string()
		.default("https://infranodus.com/api/v1")
		.describe("InfraNodus API base URL"),
});

// Export the type for use in other files
export type Config = z.infer<typeof configSchema>;

// Server metadata
export const serverInfo = {
	name: "infranodus-mcp-server",
	version: "1.1.0",
	description:
		"MCP server for InfraNodus knowledge graph generation, comparison, entity extraction, content gap, and SEO analysis.",
};
