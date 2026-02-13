import { z } from "zod";
import {
	generateContextualHintSchema,
	generateContextualHintSchemaBase,
} from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { fetchUrlContentAsText } from "../utils/urlContent.js";
import { generateContextualHint } from "../utils/transformers.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

export const generateContextualHintTool = {
	name: "generate_contextual_hint",
	definition: {
		title: "Generate Contextual Hint for Text or Graph",
		description:
			"Generate information about the main topics and concepts in a text to augment RAG retrieval and text analysis. Provide either text, url, or graphName.",
		inputSchema: generateContextualHintSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof generateContextualHintSchema>) => {
		try {
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

			let requestBody: { text?: string; name?: string };
			if (params.graphName?.trim()) {
				requestBody = { name: params.graphName };
			} else {
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
					return errorContent("Provide either text, url, or graphName for analysis");
				}
				requestBody = { text: contentText };
			}

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
