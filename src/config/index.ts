import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const config = {
	apiKey: process.env.INFRANODUS_API_KEY,
	apiBase: process.env.INFRANODUS_API_BASE || "https://infranodus.com/api/v1",
	server: {
		name: "infranodus-mcp-server",
		version: "1.0.0",
		description:
			"MCP server for InfraNodus knowledge graph generation and text analysis",
	},
};

export function validateConfig(): boolean {
	if (!config.apiKey) {
		// Log to stderr so it appears in Claude's logs without interfering with MCP protocol
		console.error(
			"ERROR: INFRANODUS_API_KEY is not set in environment variables"
		);
		return false;
	}
	return true;
}
