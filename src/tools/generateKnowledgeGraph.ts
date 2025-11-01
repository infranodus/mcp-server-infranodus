import { z } from "zod";
import { GenerateGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { transformToStructuredOutput } from "../utils/transformers.js";

export const generateKnowledgeGraphTool = {
	name: "generate_knowledge_graph",
	definition: {
		title: "Generate Knowledge Graph from Text",
		description:
			"Analyze text and generate a knowledge graph with main topics, topical clusters, concepts, concepts relations and structural gaps. Only use when explicitly asked to analyze a text or generate a knowledge graph. Do not use for short clarifying questions that you already have an answer to from the context of the conversation.",
		inputSchema: GenerateGraphSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof GenerateGraphSchema>) => {
		try {
			const includeNodesAndEdges = params.addNodesAndEdges;
			const includeGraph = params.includeGraph;
			const buildingEntitiesGraph =
				params.modifyAnalyzedText == "extractEntitiesOnly" ? true : false;
			// Build query parameters
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeStatements: params.includeStatements ? "true" : "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph:
					includeGraph || buildingEntitiesGraph || includeNodesAndEdges
						? "true"
						: "false",
				compactGraph: includeGraph || buildingEntitiesGraph ? "true" : "false",
				compactStatements: params.includeStatements ? "true" : "false",
				aiTopics: "true",
				optimize: "develop",
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			const requestBody: any = {
				text: params.text,
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
