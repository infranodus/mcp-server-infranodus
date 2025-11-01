import { z } from "zod";
import { SearchExistingGraphsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { generateSearchResult } from "../utils/transformers.js";

export const searchExistingGraphsTool = {
	name: "search",
	definition: {
		title: "Search through Existing InfraNodus Graphs",
		description: "Find the concepts and terms in existing InfraNodus graphs",
		inputSchema: SearchExistingGraphsSchema.shape,
		annotations: {
		   "readOnlyHint": true,
		   "idempotentHint": true,
		   "destructiveHint": false
		},
	},
	handler: async (params: z.infer<typeof SearchExistingGraphsSchema>) => {
		try {
			const endpoint = `/search`;

			const searchQuery = params.query;
			const requestBody = {
				query: searchQuery,
				contextNames:
					params.contextNames && params.contextNames.length > 0
						? params.contextNames.join(",")
						: "",
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

			const structuredOutput = generateSearchResult(response, searchQuery);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(structuredOutput, null, 2),
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
