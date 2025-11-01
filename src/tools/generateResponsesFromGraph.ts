import { z } from "zod";
import { GenerateResponsesFromGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { generateResponses } from "../utils/transformers.js";

export const generateResponsesFromGraphTool = {
	name: "generate_responses_from_graph",
	definition: {
		title: "Generate Responses and Expert Advice from an InfraNodus Graph",
		description:
			"Retrieve an existing InfraNodus knowledge graph and use the relations extracted to generate responses and expert advice based on a prompt provided",
		inputSchema: GenerateResponsesFromGraphSchema.shape,
		annotations: {
		   "readOnlyHint": true,
		   "idempotentHint": true,
		   "destructiveHint": false
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

			const requestBody: any = {
				name: params.graphName,
				aiTopics: "true",
				requestMode: "response",
				prompt: params.prompt ? params.prompt : "",
				modelToUse: params.modelToUse ? params.modelToUse : "gpt-4o",
			};

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
