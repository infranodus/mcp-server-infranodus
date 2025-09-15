import { z } from "zod";
import { GenerateResearchQuestionsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { transformToStructuredOutput } from "../utils/transformers.js";

export const generateResearchQuestionsTool = {
	name: "generateResearchQuestions",
	definition: {
		title: "Generate Research Questions from Text",
		description:
			"Analyze text and generate a research questions based on the gaps identified",
		inputSchema: GenerateResearchQuestionsSchema.shape,
	},
	handler: async (params: z.infer<typeof GenerateResearchQuestionsSchema>) => {
		try {
			// Build query parameters
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				optimize: "gap",
				includeStatements: "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "false",
				includeGraph: "false",
				aiTopics: "true",
				extendedAdvice: "true",
			});

			const endpoint = `/graphAndAdvice?${queryParams.toString()}`;

			const requestBody: any = {
				text: params.text,
				aiTopics: "true",
				requestMode: "question",
				modelToUse: params.modelToUse,
			};

			const response = await makeInfraNodusRequest(endpoint, requestBody);

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
						text: JSON.stringify(response.aiAdvice, null, 2),
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
