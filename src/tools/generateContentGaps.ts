import { z } from "zod";
import { GenerateContentGapsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { generateGaps } from "../utils/transformers.js";

export const generateContentGapsTool = {
	name: "generate_content_gaps",
	definition: {
		title: "Generate Content Gaps",
		description:
			"Generate content gaps from text using knowledge graph analysis",
		inputSchema: GenerateContentGapsSchema.shape,
		annotations: {
		   "readOnlyHint": true,
		   "idempotentHint": true,
		   "destructiveHint": false
		},
	},
	handler: async (params: z.infer<typeof GenerateContentGapsSchema>) => {
		try {
			// First generate the graph with focus on insights
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
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

			const insights = generateGaps(response);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(insights, null, 2),
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
