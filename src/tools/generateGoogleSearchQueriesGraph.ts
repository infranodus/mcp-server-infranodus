import { z } from "zod";
import { GenerateGoogleSearchQueriesGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { transformToStructuredOutput } from "../utils/transformers.js";

export const generateGoogleSearchQueriesGraphTool = {
	name: "analyze_related_search_queries",
	definition: {
		title: "Analyze Google Search Intent Related to Given Queries",
		description:
			"Generate a knowledge graph and identifymain topical clusters in the search requests related to the search queries provided",
		inputSchema: GenerateGoogleSearchQueriesGraphSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof GenerateGoogleSearchQueriesGraphSchema>
	) => {
		try {
			const includeGraph = params.includeGraph ? true : false;
			const includeStatements = params.includeSearchQueries ? true : false;
			const showExtendedGraphInfo = params.showExtendedGraphInfo ? true : false;
			const includeNodesAndEdges = params.includeNodesAndEdges ? true : false;
			const includeSearchQueriesOnly = params.includeSearchQueriesOnly
				? true
				: false;

			// First generate the graph with focus on insights
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeGraphSummary: "true",
				extendedGraphSummary: showExtendedGraphInfo ? "true" : "false",
				includeGraph: includeGraph ? "true" : "false",
				includeStatements:
					includeStatements || includeSearchQueriesOnly ? "true" : "false",
				compactGraph: "true",
				compactStatements: "true",
				aiTopics: "true",
			});

			const endpoint = `/import/googleSearchIntentGraph?${queryParams.toString()}`;

			const response = await makeInfraNodusRequest(endpoint, {
				searchQuery: params.queries.join(","),
				includeSearchQueriesOnly: includeSearchQueriesOnly ? "true" : "false",
				keywordsSource:
					params.keywordsSource == "adwords" ? "adwords" : "related",
				aiTopics: "true",
				importLanguage: params.importLanguage || "EN",
				importCountry: params.importCountry || "US",
			});

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

			const textOverview = transformToStructuredOutput(
				response,
				includeGraph,
				includeNodesAndEdges
			);

			if (!includeStatements && !includeSearchQueriesOnly) {
				delete textOverview.statements;
			}

			if (showExtendedGraphInfo || includeGraph) {
				delete textOverview.graphSummary;
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(textOverview, null, 2),
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
