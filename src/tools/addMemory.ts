import { z } from "zod";
import { brand } from "../config/brand.js";
import { AddMemorySchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { resolveGraphInput } from "../utils/graphInput.js";
import { transformToStructuredOutput } from "../utils/transformers.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

export const addMemoryTool = {
	name: "memory_add_relations",
	definition: {
		title: `Add Relations to the ${brand.name} Memory`,
		description:
			`Add relations to the ${brand.name} memory from text, save it, and provide its name and a link to it for future use. `,
		inputSchema: AddMemorySchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof AddMemorySchema>) => {
		try {
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

			// graphName here is where the memory is saved, not a content source,
			// so the content still comes from text or statements.
			const input = await resolveGraphInput(params);
			if (!input.ok) return errorContent(input.error);

			const requestBody: any = {
				name: params.graphName,
				aiTopics: "true",
				contextType: "memory",
				...input.payload,
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
				buildingEntitiesGraph,
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
