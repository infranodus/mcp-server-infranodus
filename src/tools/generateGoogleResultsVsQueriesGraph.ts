import { z } from "zod";
import { GenerateGoogleResultsVsQueriesGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { transformToStructuredOutput } from "../utils/transformers.js";

export const generateGoogleResultsVsQueriesGraphTool = {
	name: "search_queries_vs_search_results",
	definition: {
		title: "Generate a Knowledge Graph of Search Queries vs Search Results",
		description:
			"Find the combinations of keywords and topics people search for that don't appear in the search results for the same queries",
		inputSchema: GenerateGoogleResultsVsQueriesGraphSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof GenerateGoogleResultsVsQueriesGraphSchema>
	) => {
		try {
			const showExtendedGraphInfo = params.showExtendedGraphInfo ? true : false;
			const includeGraph = showExtendedGraphInfo ? true : false;
			const includeStatements = params.includeSearchQueries ? true : false;
			const includeSearchQueriesOnly = params.includeSearchQueriesOnly
				? true
				: false;
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

			const endpoint = `/import/googleSearchVsIntentGraph?${queryParams.toString()}`;

			const response = await makeInfraNodusRequest(endpoint, {
				searchQuery: params.queries.join(","),
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
				false
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
