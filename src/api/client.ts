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
				// Lets the app attribute the call to the MCP surface (lib/clientApplication.js).
				"X-Infranodus-Client": "mcp-server",
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

/**
 * Call one of the app's memory endpoints (/learnings/*, /memory/*). Unlike
 * makeInfraNodusRequest, a 4xx answer with a JSON body is returned, not
 * thrown: those endpoints answer refusals (422 redaction, 400 validation,
 * 403 anonymous) with a payload the tools pass on to the model.
 */
export async function callMemoryEndpoint(
	endpoint: string,
	body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, any> }> {
	const config = getConfig();
	const tool = getCurrentTool();
	const response = await fetch(`${config.apiBase}${endpoint}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.apiKey}`,
			"X-Infranodus-Client": "mcp-server",
		},
		body: JSON.stringify({
			...body,
			modal: "mcp_server",
			source: brandSource(),
			...(tool && { tool }),
		}),
	});
	const text = await response.text();
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		parsed = undefined;
	}
	const json =
		parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, any>)
			: null;
	if (json && response.status < 500) {
		return { status: response.status, body: json };
	}
	const detail =
		json && typeof json.error === "string" ? json.error : text.slice(0, 500);
	throw new Error(`API request failed (${response.status}): ${detail}`);
}
