import { z } from "zod";
import { AnalyzeTextSchema, AnalyzeTextSchemaBase } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { fetchUrlContentAsText } from "../utils/urlContent.js";
import { transformToStructuredOutput } from "../utils/transformers.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

export const analyzeTextTool = {
	name: "analyze_text",
	definition: {
		title: "Analyze a Text, URL, or YouTube transcript",
		description:
			"Extract and analyze a graph from text, URL, YouTube video transcript, or an existing graph.",
		inputSchema: AnalyzeTextSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof AnalyzeTextSchema>) => {
		try {
			const includeNodesAndEdges = params.addNodesAndEdges;
			const includeGraph = params.includeGraph;
			const buildingEntitiesGraph =
				params.modifyAnalyzedText == "extractEntitiesOnly" ? true : false;
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeStatements: params.includeStatements ? "true" : "false",
				includeGraphSummary: params.includeGraphSummary ? "true" : "false",
				extendedGraphSummary: "true",
				includeGraph: includeGraph || buildingEntitiesGraph ? "true" : "false",
				compactGraph: includeGraph || buildingEntitiesGraph ? "true" : "false",
				compactStatements: params.includeStatements ? "true" : "false",
				aiTopics: "true",
				optimize: "develop",
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			let contentText: string;
			if (params.url) {
				const result = await fetchUrlContentAsText(params.url);
				if (!result.ok) return errorContent(result.error);
				contentText = result.contentText;
				if (!contentText?.trim())
					return errorContent("URL did not return any text content");
			} else if (params.text?.trim()) {
				contentText = params.text;
			} else {
				return errorContent("Provide either text or url for analysis");
			}

			const requestBody = { text: contentText, aiTopics: "true" };
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
				includeNodesAndEdges,
				buildingEntitiesGraph
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
