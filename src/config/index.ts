import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const config = {
	apiKey: process.env.INFRANODUS_API_KEY,
	apiBase: process.env.INFRANODUS_API_BASE || "http://localhost:3000/api/v1",
	server: {
		name: "infranodus-mcp-server",
		version: "1.0.0",
		description:
			"MCP server for InfraNodus knowledge graph generation and text analysis",
	},
};

export function validateConfig(): boolean {
	if (!config.apiKey) {
		// Exit silently without console output that could interfere with MCP protocol
		return false;
	}
	return true;
}