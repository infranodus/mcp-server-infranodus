import { z } from "zod";
import { brand } from "./brand.js";

// Define the configuration schema for Smithery
export const configSchema = z.object({
	apiKey: z.string().optional().describe(`Your ${brand.name} API key`),
	apiBase: z
		.string()
		.default(brand.apiBase)
		.describe(`${brand.name} API base URL`),
	userId: z.number().optional().describe("Authenticated user ID"),
	userName: z.string().optional().describe("Authenticated user name"),
});

// Export the type for use in other files
export type Config = z.infer<typeof configSchema>;

// Server metadata
export const serverInfo = {
	name: brand.serverName,
	version: "1.1.0",
	description: `MCP server for ${brand.name} knowledge graph generation, comparison, entity extraction, content gap, and SEO analysis.`,
};

export { brand };
