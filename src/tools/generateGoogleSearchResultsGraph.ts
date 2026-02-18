import { z } from "zod";
import { GenerateGoogleSearchResultsGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { transformToStructuredOutput } from "../utils/transformers.js";

export const generateGoogleSearchResultsGraphTool = {
	name: "analyze_google_search_results",
	definition: {
		title: "Analyze the Main Topics in Google Search Results ",
		description:
			"Generate a knowledge graph and topical clusters from Google search results for provided search queries",
		inputSchema: GenerateGoogleSearchResultsGraphSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof GenerateGoogleSearchResultsGraphSchema>
	) => {
		try {
			const includeGraph = params.includeGraph ? true : false;
			const includeStatements = params.includeSearchResults ? true : false;
			const showExtendedGraphInfo = params.showExtendedGraphInfo ? true : false;
			const includeNodesAndEdges = params.includeNodesAndEdges ? true : false;
			const includeSearchResultsOnly = params.includeSearchResultsOnly
				? true
				: false;
			// First generate the graph with focus on insights
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeGraphSummary: "true",
				extendedGraphSummary: showExtendedGraphInfo ? "true" : "false",
				includeGraph: includeGraph ? "true" : "false",
				includeStatements: includeStatements ? "true" : "false",
				compactGraph: "true",
				compactStatements: "true",
				aiTopics: "true",
			});

			const endpoint = `/import/googleSearchResultsGraph?${queryParams.toString()}`;

			const response = await makeInfraNodusRequest(endpoint, {
				searchQuery: params.queries.join(","),
				includeGraph: includeGraph ? "true" : "false",
				aiTopics: "true",
				includeSearchResultsOnly: includeSearchResultsOnly ? "true" : "false",
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

			if (!includeStatements && !includeSearchResultsOnly) {
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
