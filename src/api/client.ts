import { GraphResponse } from "../types/index.js";

export async function makeInfraNodusRequest(
	endpoint: string,
	body: any
): Promise<GraphResponse> {
	try {
		// Get config from global scope (set by Smithery)
		const config = (global as any).infranodusConfig;

		const response = await fetch(`${config.apiBase}${endpoint}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${config.apiKey}`,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API request failed (${response.status}): ${errorText}`);
		}

		const data = await response.json();

		// Handle wrapped response format
		if (data.entriesAndGraphOfContext) {
			return data.entriesAndGraphOfContext;
		}

		return data;
	} catch (error) {
		// Don't log to console as it interferes with MCP protocol
		throw error;
	}
}