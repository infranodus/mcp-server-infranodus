import { GraphResponse } from "../types/index.js";
import { getConfig, getCurrentTool } from "./config-store.js";
import { brandSource } from "../config/brand.js";

export async function makeInfraNodusRequest(
	endpoint: string,
	body: any,
	method: string = "POST",
	options: { signal?: AbortSignal } = {},
): Promise<GraphResponse> {
	try {
		const config = getConfig();

		const tool = getCurrentTool();
		const requestBody = {
			...body,
			modal: "mcp_server",
			source: brandSource(),
			...(tool && { tool }),
		};

		const response = await fetch(`${config.apiBase}${endpoint}`, {
			method,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${config.apiKey}`,
			},
			...(method !== "GET" && { body: JSON.stringify(requestBody) }),
			...(options.signal && { signal: options.signal }),
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
