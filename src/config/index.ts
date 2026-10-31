import { readFileSync } from "fs";
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

// Single source of truth for the version: package.json (bumped by `npm version`)
const { version } = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);

// Server metadata
export const serverInfo = {
	name: brand.serverName,
	version,
	description: `MCP server for ${brand.name} knowledge graph generation, comparison, entity extraction, content gap, and SEO analysis.`,
};

export { brand };
