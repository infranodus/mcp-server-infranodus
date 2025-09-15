import { z } from "zod";
import { AnalyzeExistingGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { transformToStructuredOutput } from "../utils/transformers.js";

export const analyzeExistingGraphTool = {
	name: "analyzeExistingGraphByName",
	definition: {
		title: "Analyze Existing InfraNodus Graph",
		description:
			"Retrieve and analyze an existing graph from your InfraNodus account",
		inputSchema: AnalyzeExistingGraphSchema.shape,
	},
	handler: async (params: z.infer<typeof AnalyzeExistingGraphSchema>) => {
		try {
			const includeNodesAndEdges = params.addNodesAndEdges;
			const includeGraph = params.includeGraph;
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeStatements: params.includeStatements.toString(),
				includeGraphSummary: params.includeGraphSummary.toString(),
				extendedGraphSummary: "true",
				includeGraph: includeGraph ? "true" : "false",
				aiTopics: "true",
				optimize: "develop",
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			const requestBody = {
				name: params.graphName,
				aiTopics: "true",
			};

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			if (response.error) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ error: response.error }),
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
