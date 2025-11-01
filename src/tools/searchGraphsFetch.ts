import { z } from "zod";
import { SearchExistingGraphsFetchSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { generateFetchResult } from "../utils/transformers.js";

export const searchExistingGraphsFetchTool = {
	name: "fetch",
	definition: {
		title: "Fetch a Search Result",
		description:
			"Fetch a specific search result for an InfraNodus knowledge graph",
		inputSchema: SearchExistingGraphsFetchSchema.shape,
		annotations: {
		   "readOnlyHint": true,
		   "idempotentHint": true,
		   "destructiveHint": false
		},
	},
	handler: async (params: z.infer<typeof SearchExistingGraphsFetchSchema>) => {
		try {
			const endpoint = `/search`;

			const searchId = params.id;

			const searchIdArray = searchId.split(":");

			if (searchIdArray.length < 2) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ error: "Invalid search ID" }),
						},
					],
					isError: true,
				};
			}

			const searchUserName = searchIdArray[0];
			const searchGraphName = searchIdArray[1];
			const searchQuery = searchIdArray[2];

			const requestBody = {
				query: searchQuery,
				contextNames: searchGraphName,
				userName: searchUserName,
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

			const structuredOutput = generateFetchResult(response, searchQuery);

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
