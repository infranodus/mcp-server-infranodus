import { z } from "zod";
import { GenerateContentGapsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { fetchUrlContentAsText } from "../utils/urlContent.js";
import { generateGaps } from "../utils/transformers.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

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
			let contentText: string;
			if (params.url) {
				const result = await fetchUrlContentAsText(params.url);
				if (!result.ok) return errorContent(result.error);
				contentText = result.contentText;
				if (!contentText?.trim())
					return errorContent("URL did not return any text content");
			} else if (params.text?.trim()) {
				contentText = params.text;
			} else {
				return errorContent("Provide either url or text for analysis");
			}

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
				text: contentText,
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
