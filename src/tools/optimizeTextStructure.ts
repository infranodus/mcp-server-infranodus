import { z } from "zod";
import {
	GenerateResearchIdeasSchema,
	GenerateResearchIdeasSchemaBase,
} from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { fetchUrlContentAsText } from "../utils/urlContent.js";
import { generateResearchIdeas } from "../utils/transformers.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

export const optimizeTextStructureTool = {
	name: "optimize_text_structure",
	definition: {
		title: "Optimize Text Structure",
		description:
			"Analyze the level of bias and coherence in text. If it's too biased, develop the represented topics, if it's focused or diversified, develop the content gaps. If it's dispersed, focus the most common gap topics.",
		inputSchema: GenerateResearchIdeasSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof GenerateResearchIdeasSchema>) => {
		try {
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				optimize: "optimize",
				includeStatements: "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "false",
				includeGraph: "false",
				aiTopics: "true",
				extendedAdvice: params.useSeveralGaps ? "true" : "false",
				gapDepth: params.gapDepth ? params.gapDepth.toString() : "0",
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
					requestMode: params.shouldTranscend ? "transcend" : "response",
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
					requestMode: params.shouldTranscend ? "transcend" : "response",
					modelToUse: params.modelToUse ?? "gpt-4o",
				};
			}

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			const researchIdeas = generateResearchIdeas(response);

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
						text: JSON.stringify(researchIdeas, null, 2),
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
