import { z } from "zod";
import {
	OptimizeTextStructureSchema,
	OptimizeTextStructureSchemaBase,
} from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { resolveGraphInput } from "../utils/graphInput.js";
import { generateOptimizationResult } from "../utils/transformers.js";

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
		inputSchema: OptimizeTextStructureSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof OptimizeTextStructureSchema>) => {
		try {
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				optimize: "optimize",
				includeStatements: "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: "true",
				aiTopics: "true",
			});

			const endpoint = `/graphAndAdvice?${queryParams.toString()}`;

			let requestBody: {
				text?: string;
				statements?: string[];
				categories?: string[][];
				timestamps?: string[];
				contextSettings?: Record<string, unknown>;
				name?: string;
				aiTopics: string;
				requestMode: string;
				modelToUse: string;
			};
			const requestMode = params.responseType ?? "response";

			if (params.graphName?.trim()) {
				requestBody = {
					name: params.graphName,
					aiTopics: "true",
					requestMode,
					modelToUse: params.modelToUse ?? "gpt-5.4",
				};
			} else {
				const input = await resolveGraphInput(params);
				if (!input.ok) return errorContent(input.error);
				requestBody = {
					...input.payload,
					aiTopics: "true",
					requestMode,
					modelToUse: params.modelToUse ?? "gpt-5.4",
				};
			}

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

			const optimizationResult = generateOptimizationResult(response);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(optimizationResult, null, 2),
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
