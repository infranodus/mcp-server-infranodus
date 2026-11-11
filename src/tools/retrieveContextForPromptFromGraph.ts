import { z } from "zod";
import { brand } from "../config/brand.js";
import { RetrieveContextForPromptFromGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { transformToGraphRagOutput } from "../utils/transformers.js";
import { savedGraphWikilinksModeBody } from "../utils/wikilinksMode.js";

export const retrieveContextForPromptFromGraphTool = {
	name: "retrieve_from_knowledge_base",
	definition: {
		title: `Retrieve Context for a Prompt from an Existing ${brand.name} Graph`,
		description:
			`Retrieve the statements and general overview of an existing ${brand.name} knowledge graph based on the user's prompt for GraphRAG based retrieval. Set hops: 2 to also get statements connected to the prompt's concepts through an intermediate concept. The prompt's words match graph nodes by name, without stemming (gpu doesn't match [[gpus]]). For what one concept is connected to, by hop distance, use get_node_neighborhood.`,
		inputSchema: RetrieveContextForPromptFromGraphSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof RetrieveContextForPromptFromGraphSchema>,
	) => {
		try {
			// Build query parameters
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeGraph: params.includeGraph ? "true" : "false",
				includeStatements: "true",
				includeGraphSummary: params.includeGraphSummary ? "true" : "false",
				extendedGraphSummary: params.extendedGraphSummary ? "true" : "false",
				hops: String(params.hops ?? 1),
				topK: String(params.topK ?? 8),
			});

			const endpoint = `/graphAndAdvice?${queryParams.toString()}`;

			const requestBody: any = {
				name: params.graphName,
				aiTopics: "true",
				requestMode: "search",
				prompt: params.prompt ? params.prompt : "",
				modelToUse: "gpt-4o",
				userName: params.userName ?? "",
				...savedGraphWikilinksModeBody(params.wikilinksMode),
			};

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			const outputToReturn = transformToGraphRagOutput({
				data: response,
				includeGraph: params.includeGraph,
				compactStatements: params.compactStatements,
				includeGraphSummary: params.includeGraphSummary,
				extendedGraphSummary: params.extendedGraphSummary,
			});

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
						text: JSON.stringify(outputToReturn, null, 2),
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
