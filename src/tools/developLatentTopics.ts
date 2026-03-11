import { z } from "zod";
import {
	DevelopLatentConceptsSchema,
	DevelopLatentConceptsSchemaBase,
} from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { fetchUrlContentAsText } from "../utils/urlContent.js";
import { extractLatentTopicsIdeas } from "../utils/transformers.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

export const developLatentTopicsTool = {
	name: "develop_latent_topics",
	definition: {
		title: "Develop Latent Topics in Text or Graph",
		description:
			"Analyze text or an existing graph, extract underdeveloped topics and get an idea on how to develop them. Provide either text, url, or graphName.",
		inputSchema: DevelopLatentConceptsSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof DevelopLatentConceptsSchema>) => {
		try {
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				optimize: "latent",
				includeStatements: "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: "false",
				aiTopics: "true",
			});

			const endpoint = `/graphAndAdvice?${queryParams.toString()}`;

			let requestBody: {
				text?: string;
				name?: string;
				aiTopics: string;
				requestMode: string;
				modelToUse: string;
			};
			if (params.graphName?.trim()) {
				requestBody = {
					name: params.graphName,
					aiTopics: "true",
					requestMode: params.requestMode ?? "transcend",
					modelToUse: params.modelToUse ?? "gpt-4o",
				};
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
					return errorContent(
						"Provide either text, url, or graphName for analysis"
					);
				}
				requestBody = {
					text: contentText,
					aiTopics: "true",
					requestMode: params.requestMode ?? "transcend",
					modelToUse: params.modelToUse ?? "gpt-4o",
				};
			}

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			const latentConceptsIdeas = extractLatentTopicsIdeas(response);

			if (response.error) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: ${response.error}`,
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(latentConceptsIdeas, null, 2),
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
