import { z } from "zod";
import { GenerateDifferenceGraphFromTextsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { transformToStructuredOutput } from "../utils/transformers.js";

export const generateDifferenceGraphFromTextsTool = {
	name: "difference_between_texts",
	definition: {
		title: "Generate Difference Knowledge Graph from Texts",
		description:
			"Extract the conceptial relations that are not present in the first text but are in the other texts",
		inputSchema: GenerateDifferenceGraphFromTextsSchema.shape,
		annotations: {
		   "readOnlyHint": true,
		   "idempotentHint": true,
		   "destructiveHint": false
		},
	},
	handler: async (
		params: z.infer<typeof GenerateDifferenceGraphFromTextsSchema>
	) => {
		try {
			const includeNodesAndEdges = params.addNodesAndEdges;
			const includeGraph = params.includeGraph;
			// Build query parameters
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeStatements: params.includeStatements ? "true" : "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: includeGraph ? "true" : "false",
				compactGraph: "true",
				compactStatements: "true",
				aiTopics: "true",
				optimize: "develop",
				compareMode: "difference",
			});

			const endpoint = `/graphsAndStatements?${queryParams.toString()}`;

			const requestBody: any = {
				contexts: params.contexts,
				aiTopics: "true",
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

			const structuredOutput = transformToStructuredOutput(
				response,
				includeGraph,
				includeNodesAndEdges
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(structuredOutput, null, 2),
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
