import { z } from "zod";
import { brand } from "../config/brand.js";
import { getMemorySchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import {
	extractStatementsFromSearchResponse,
	extractStatementsFromGraphResponse,
} from "../utils/transformers.js";
import { callMemoryEndpoint } from "../api/client.js";
import { memoryResult } from "../utils/memoryResult.js";

export const getMemoryTool = {
	name: "memory_get_relations",
	definition: {
		title: `Recall from ${brand.name} Memory`,
		description:
			`Recall what the user previously saved to ${brand.name} memory about a concept or entity. Call it when the user asks "what do I have on X", "did we decide X", "check memory", or before starting a task on a topic they saved before. With no memoryContextName it searches every memory graph in the account. With scope ('topic' + topic, or 'personal') it reads the user's kept memory instead: entityName for every statement mentioning it, prompt for the most relevant ones, neither for an overview; enabled: false means that memory was never enabled — carry on.`,
		inputSchema: getMemorySchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (params: z.infer<typeof getMemorySchema>) => {
		try {
			if (params.scope) {
				// Same query string the /search path below gets.
				const entity = params.entityName.trim();
				const response = await callMemoryEndpoint("/memory/get", {
					scope: params.scope,
					...(params.topic ? { topic: params.topic } : {}),
					...(entity ? { entity } : {}),
					...(params.prompt ? { prompt: params.prompt } : {}),
					limit: params.limit,
					...(params.hops ? { hops: params.hops } : {}),
					...(params.language ? { language: params.language } : {}),
				});
				return memoryResult(response);
			}

			const searchQuery = params.entityName;
			const hasContextName =
				params.memoryContextName && params.memoryContextName.length > 0;

			// If searchQuery is empty but contextNames exist, use graphAndStatements endpoint.
			// Use the same params as analyze_existing_graph_by_name (including aiTopics: "true")
			// so the backend resolves the graph by name the same way.
			if (!searchQuery && hasContextName) {
				const queryParams = new URLSearchParams({
					doNotSave: "true",
					addStats: "true",
					includeStatements: "true",
					includeGraphSummary: "false",
					extendedGraphSummary: "false",
					includeGraph: "true",
					compactGraph: "true",
					compactStatements: "true",
					aiTopics: "false",
					optimize: "develop",
				});

				const endpoint = `/graphAndStatements?${queryParams.toString()}`;

				const requestBody = {
					name: params.memoryContextName,
					aiTopics: "false",
				};

				const response = await makeInfraNodusRequest(endpoint, requestBody);

				if (response.error) {
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({ error: response.error }),
							},
						],
						isError: true,
					};
				}

				const structuredOutput = extractStatementsFromGraphResponse(
					response,
					params.memoryContextName
				);

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(structuredOutput, null, 2),
						},
					],
				};
			}

			// Original search endpoint logic
			const endpoint = `/search`;

			const requestBody = {
				query: searchQuery,
				contextNames: hasContextName ? params.memoryContextName : "",
			};

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			if (response.error) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ error: response.error }),
						},
					],
					isError: true,
				};
			}

			const results = extractStatementsFromSearchResponse(response);

			// Check if statements exist
			if (!results || results?.statements?.length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({
								error: "No statements found in memory for the given entity",
							}),
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(results, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							error: error instanceof Error ? error.message : String(error),
						}),
					},
				],
				isError: true,
			};
		}
	},
};
