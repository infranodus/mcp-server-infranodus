import { z } from "zod";
import { brand } from "../config/brand.js";
import {
	GenerateResponsesFromGraphSchema,
	GenerateResponsesFromGraphSchemaBase,
} from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { resolveGraphInput } from "../utils/graphInput.js";
import { generateResponses } from "../utils/transformers.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

export const generateResponsesFromGraphTool = {
	name: "generate_responses_from_graph",
	definition: {
		title: "Generate Responses and Expert Advice from Text or Graph",
		description:
			`Use text, URL, or an existing ${brand.name} knowledge graph and generate responses and expert advice based on a prompt provided.`,
		inputSchema: GenerateResponsesFromGraphSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof GenerateResponsesFromGraphSchema>) => {
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
			});

			const endpoint = `/graphAndAdvice?${queryParams.toString()}`;

			let requestBody: {
				name?: string;
				userName?: string;
				text?: string;
				statements?: string[];
				categories?: string[][];
				timestamps?: string[];
				contextSettings?: Record<string, unknown>;
				aiTopics: string;
				requestMode: string;
				prompt: string;
				modelToUse: string;
			};
			if (params.graphName?.trim()) {
				requestBody = {
					name: params.graphName,
					userName: params.userName ?? "",
					aiTopics: "true",
					requestMode: "response",
					prompt: params.prompt ?? "",
					modelToUse: params.modelToUse ?? "gpt-4o",
				};
			} else {
				const input = await resolveGraphInput(params);
				if (!input.ok) return errorContent(input.error);
				requestBody = {
					...input.payload,
					aiTopics: "true",
					requestMode: "response",
					prompt: params.prompt ?? "",
					modelToUse: params.modelToUse ?? "gpt-4o",
				};
			}

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			const responses = generateResponses(response);

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
						text: JSON.stringify(responses, null, 2),
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
