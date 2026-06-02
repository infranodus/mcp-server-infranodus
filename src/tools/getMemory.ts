import { z } from "zod";
import { getMemorySchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import {
	extractStatementsFromSearchResponse,
	extractStatementsFromGraphResponse,
} from "../utils/transformers.js";

export const getMemoryTool = {
	name: "memory_get_relations",
	definition: {
		title: "Get Relations from Memory",
		description:
			"Provide a list of relations from the memory for a given concept or entity",
		inputSchema: getMemorySchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof getMemorySchema>) => {
		try {
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
