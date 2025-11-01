import { z } from "zod";
import { GenerateResearchQuestionsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { generateResearchQuestions } from "../utils/transformers.js";

export const generateResearchQuestionsTool = {
	name: "generate_research_questions",
	definition: {
		title: "Generate Research Questions from Text",
		description:
			"Analyze text and generate innovative research questions based on the content gaps identified between the topical clusters inside the text that can be used to improve the text and the discourse it relates to",
		inputSchema: GenerateResearchQuestionsSchema.shape,
		annotations: {
		   "readOnlyHint": true,
		   "idempotentHint": true,
		   "destructiveHint": false
		},
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
				extendedAdvice: params.useSeveralGaps ? "true" : "false",
				gapDepth: params.gapDepth ? params.gapDepth.toString() : "0",
			});

			const endpoint = `/graphAndAdvice?${queryParams.toString()}`;

			const requestBody: any = {
				text: params.text,
				aiTopics: "true",
				requestMode: "question",
				modelToUse: params.modelToUse ? params.modelToUse : "gpt-4o",
			};

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
