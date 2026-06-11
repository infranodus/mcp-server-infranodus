import { z } from "zod";
import { GenerateYoutubeSearchResultsGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { transformToStructuredOutput } from "../utils/transformers.js";

export const generateYoutubeSearchResultsGraphTool = {
	name: "analyze_youtube_results",
	definition: {
		title:
			"Analyze YouTube Search Results, Channels, Playlists, Videos, and Comments",
		description:
			"Generate a knowledge graph and topical clusters from YouTube results — search results, a channel's or playlist's videos, video comments, or transcribed subtitles — to reveal the main topics, clusters, and content gaps in the discourse",
		inputSchema: GenerateYoutubeSearchResultsGraphSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof GenerateYoutubeSearchResultsGraphSchema>,
	) => {
		try {
			const includeGraph = params.includeGraph ? true : false;
			const includeStatements = params.includeSearchResults ? true : false;
			const showExtendedGraphInfo = params.showExtendedGraphInfo ? true : false;
			const includeNodesAndEdges = params.includeNodesAndEdges ? true : false;
			const includeSearchResultsOnly = params.includeSearchResultsOnly
				? true
				: false;

			const searchMode = params.searchMode || "search";
			// 'searchVideos' analyzes the content of each video, so the result count
			// is hard-capped to keep the request tractable.
			const limit = searchMode === "searchVideos" ? 20 : (params.limit ?? 100);

			// First generate the graph with focus on insights
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeGraphSummary: "true",
				extendedGraphSummary: showExtendedGraphInfo ? "true" : "false",
				includeGraph: includeGraph ? "true" : "false",
				includeStatements:
					includeStatements || includeSearchResultsOnly ? "true" : "false",
				compactGraph: "true",
				compactStatements: "true",
				aiTopics: "true",
			});

			const endpoint = `/import/youtubeSearchResultsGraph?${queryParams.toString()}`;

			const response = await makeInfraNodusRequest(endpoint, {
				searchQuery: params.searchQuery,
				searchMode,
				limit,
				sortBy: params.sortBy || "Relevance",
				includeReplies: "false",
				excludeDescriptions:
					params.excludeDescriptions === false ? "false" : "true",
				includeGraph: includeGraph ? "true" : "false",
				aiTopics: "true",
				includeSearchResultsOnly: includeSearchResultsOnly ? "true" : "false",
				importLanguage: params.importLanguage || "EN",
				importRegion: params.importRegion || "US",
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
				includeNodesAndEdges,
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
