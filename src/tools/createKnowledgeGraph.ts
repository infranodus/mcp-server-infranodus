import { z } from "zod";
import { CreateGraphSchema } from "../schemas/index.js";
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

export const createKnowledgeGraphTool = {
	name: "create_knowledge_graph",
	definition: {
		title: "Create a Knowledge Graph in InfraNodus from Text",
		description:
			"Create a knowledge graph in InfraNodus from text or from a URL, save it, and provide its name and a link to it for future use. ",
		inputSchema: CreateGraphSchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof CreateGraphSchema>) => {
		try {
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
				return errorContent("Provide either url or text for analysis");
			}

			const includeNodesAndEdges = params.addNodesAndEdges;
			const includeGraph = params.includeGraph;
			const buildingEntitiesGraph =
				params.modifyAnalyzedText == "extractEntitiesOnly" ? true : false;
			// Build query parameters
			const queryParams = new URLSearchParams({
				doNotSave: "false",
				addStats: "true",
				includeStatements: params.includeStatements ? "true" : "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: includeGraph || buildingEntitiesGraph ? "true" : "false",
				compactGraph: includeGraph || buildingEntitiesGraph ? "true" : "false",
				compactStatements: params.includeStatements ? "true" : "false",
				aiTopics: "true",
				optimize: "develop",
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			const requestBody: any = {
				name: params.graphName,
				text: contentText,
				aiTopics: "true",
			};

			if (params.modifyAnalyzedText && params.modifyAnalyzedText !== "none") {
				requestBody.modifyAnalyzedText = params.modifyAnalyzedText;
			}

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
