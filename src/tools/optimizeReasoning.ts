import { z } from "zod";
import {
	OptimizeReasoningSchema,
	OptimizeReasoningSchemaBase,
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

export const optimizeReasoningTool = {
	name: "optimize_reasoning",
	definition: {
		title: "Optimize Reasoning",
		description:
			"Analyze the structure of the model's current reasoning or chat with the user using knowledge graph analysis, and steer it toward optimal diversity and coherence at the same time to optimize balance. Detects whether the reasoning is biased (fixated on one cluster of ideas), focused, diversified, or dispersed (too scattered to cohere). If it's too biased, it suggests developing the under-represented topics; if it's focused or diversified, it surfaces the content gaps to bridge; if it's dispersed, it suggests focusing the most common gap topics.",
		inputSchema: OptimizeReasoningSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof OptimizeReasoningSchema>) => {
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

			const input = await resolveGraphInput(params);
			if (!input.ok) return errorContent(input.error);

			const requestBody = {
				...input.payload,
				aiTopics: "true",
				requestMode: "response",
				modelToUse: params.modelToUse ?? "gpt-5.4",
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
