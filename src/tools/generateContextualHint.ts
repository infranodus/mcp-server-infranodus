import { z } from "zod";
import { generateContextualHintSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { generateContextualHint } from "../utils/transformers.js";

export const generateContextualHintTool = {
	name: "generate_contextual_hint",
	definition: {
		title: "Generate Contextual Hint for a Text",
		description:
			"Generate information about the main topics and concepts in a text to augment RAG retrieval and text analysis",
		inputSchema: generateContextualHintSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof generateContextualHintSchema>) => {
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

			const textOverview = generateContextualHint(response);

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
