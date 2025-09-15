import { z } from "zod";
import { GenerateTextOverviewSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { generateTextOverview } from "../utils/transformers.js";

export const generateTextOverviewTool = {
	name: "generateTextOverview",
	definition: {
		title: "Generate an Overview of a Text",
		description:
			"Generate a topical overview of a text and provide insights for LLMs to generate better responses",
		inputSchema: GenerateTextOverviewSchema.shape,
	},
	handler: async (params: z.infer<typeof GenerateTextOverviewSchema>) => {
		try {
			// First generate the graph with focus on insights
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeGraphSummary: "true",
				extendedGraphSummary: "false",
				includeGraph: "false",
				includeStatements: "false",
				aiTopics: "true",
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			const response = await makeInfraNodusRequest(endpoint, {
				text: params.text,
			});

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

			const textOverview = generateTextOverview(response);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(textOverview, null, 2),
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
