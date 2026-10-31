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
		title: `Save to ${brand.name} Memory`,
		description:
			`Save statements to a named persistent memory graph in the user's ${brand.name} account and return its name and URL. Use whenever the user says "remember this", "save this to memory", "add to ${brand.name} memory", or wants ideas, plans, or decisions from the conversation kept. Writes immediately: no opt-in, no dry run. Mark entities with [[wikilinks]], pass categories and timestamps for later filtering, reuse graphName to append. Distinct from add_project_learnings, which is gated operational knowledge about a codebase.`,
		inputSchema: AddMemorySchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: false,
			openWorldHint: false,
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
				...(params.multifractal ? { multifractal: "true" } : {}),
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
