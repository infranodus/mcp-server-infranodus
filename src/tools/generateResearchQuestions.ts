import { z } from "zod";
import {
	GenerateResearchQuestionsSchema,
	GenerateResearchQuestionsSchemaBase,
} from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { resolveGraphInput } from "../utils/graphInput.js";
import { generateResearchQuestions } from "../utils/transformers.js";
import { DEFAULT_AI_MODEL } from "../config/models.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

export const generateResearchQuestionsTool = {
	name: "generate_research_questions",
	definition: {
		title: "Generate Research Questions from Text",
		description:
			"Analyze text or an existing graph and generate innovative research questions that bridge its topical clusters. By default (optimize: 'optimize') the questions bridge the insight clusters: the clusters picked from the structure of the graph (biased / focused / diversified / dispersed) whose connection moves it toward a balanced shape; they are returned as insightClusters. Set optimize to 'gap' for the widest content gap, 'develop' for the main topics, 'latent' for under-developed ones. Provide either text, url, or graphName. Can be used to improve the text and the discourse it relates to",
		inputSchema: GenerateResearchQuestionsSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
			openWorldHint: true,
		},
	},
	handler: async (params: z.infer<typeof GenerateResearchQuestionsSchema>) => {
		try {
			// Build query parameters
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				optimize: params.optimize ?? "optimize",
				includeStatements: "false",
				includeGraphSummary: params.includeGraphSummary ? "true" : "false",
				// the insight clusters arrive in the extended summary
				extendedGraphSummary: "true",
				includeGraph: "false",
				aiTopics: "true",
				extendedAdvice: params.useSeveralGaps ? "true" : "false",
				gapDepth: params.gapDepth ? params.gapDepth.toString() : "0",
			});

			const endpoint = `/graphAndAdvice?${queryParams.toString()}`;

			let requestBody: {
				text?: string;
				statements?: string[];
				categories?: string[][];
				timestamps?: string[];
				contextSettings?: Record<string, unknown>;
				name?: string;
				userName?: string;
				aiTopics: string;
				requestMode: string;
				modelToUse: string;
			};

			if (params.graphName?.trim()) {
				requestBody = {
					name: params.graphName,
					userName: params.userName ?? "",
					aiTopics: "true",
					requestMode: "question",
					modelToUse: params.modelToUse ?? DEFAULT_AI_MODEL,
				};
			} else {
				const input = await resolveGraphInput(params);
				if (!input.ok) return errorContent(input.error);
				requestBody = {
					...input.payload,
					aiTopics: "true",
					requestMode: "question",
					modelToUse: params.modelToUse ?? DEFAULT_AI_MODEL,
				};
			}

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			const researchQuestions = generateResearchQuestions(response);

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
						text: JSON.stringify(researchQuestions, null, 2),
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
