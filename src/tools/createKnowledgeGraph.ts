import { z } from "zod";
import { brand } from "../config/brand.js";
import { CreateGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { resolveGraphInput } from "../utils/graphInput.js";
import { transformToStructuredOutput } from "../utils/transformers.js";
import { aiKnowledgeGraphPayload } from "../utils/aiKnowledgeGraph.js";
import { ToolHandlerContext } from "../types/index.js";

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
		title: `Create a Knowledge Graph in ${brand.name} from Text`,
		description:
			`Create a knowledge graph in ${brand.name} from text or from a URL, save it, and provide its name and a link to it for future use. ` +
			"By default the graph is built from the words of the text. For a knowledge graph of entities and how they relate, set modifyAnalyzedText: 'aiKnowledgeGraph': an AI model writes [[entity]] statements about the input, a topic or a text, and only those entities become nodes (slower; uses AI credits; optional instructions steer it). " +
			"Statements you have already written as [[entity]] statements go in with wikilinksMode: 'wikilinksOnly', with no AI call.",
		inputSchema: CreateGraphSchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: false,
			openWorldHint: true,
		},
	},
	handler: async (
		params: z.infer<typeof CreateGraphSchema>,
		context?: ToolHandlerContext,
	) => {
		try {
			const input = await resolveGraphInput(params);
			if (!input.ok) return errorContent(input.error);

			// 'aiKnowledgeGraph': an AI model first writes [[entity]] statements
			// about the input, and the graph is built from those entities only.
			const aiKnowledgeGraph = params.modifyAnalyzedText === "aiKnowledgeGraph";
			let payload = input.payload;
			if (aiKnowledgeGraph) {
				const generated = await aiKnowledgeGraphPayload(
					input.payload,
					{ modelToUse: params.modelToUse, instructions: params.instructions },
					context,
				);
				if (!generated.ok) return errorContent(generated.error);
				payload = generated.payload;
			}

			const includeNodesAndEdges = params.addNodesAndEdges;
			const includeGraph = params.includeGraph;
			const fullGraph = params.fullGraph === true;
			const buildingEntitiesGraph =
				params.modifyAnalyzedText === "extractEntitiesOnly" || aiKnowledgeGraph;
			// Build query parameters. fullGraph overrides the compaction flags:
			// the API returns the raw graphology graph (all node/edge attributes,
			// edge context_matrix, nodes_to_statements_map) and, when statements
			// are requested, their full metadata.
			const queryParams = new URLSearchParams({
				doNotSave: "false",
				addStats: "true",
				...(params.multifractal ? { multifractal: "true" } : {}),
				includeStatements: params.includeStatements ? "true" : "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph:
					fullGraph || includeGraph || buildingEntitiesGraph
						? "true"
						: "false",
				compactGraph:
					!fullGraph && (includeGraph || buildingEntitiesGraph)
						? "true"
						: "false",
				compactStatements:
					!fullGraph && params.includeStatements ? "true" : "false",
				aiTopics: "true",
				optimize: "develop",
			});

			if (params.maxNodes && params.maxNodes > 0) {
				queryParams.set("maxnodes", String(params.maxNodes));
			}

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			// contextSettings are applied by the backend only when the graph
			// context is created — the first upload to a graphName fixes the
			// processing mode. Parent modes (and a caller-supplied statements
			// array) replace `text` with statements[] + per-statement categories.
			const requestBody: any = {
				name: params.graphName,
				aiTopics: "true",
				...payload,
			};

			if (aiKnowledgeGraph) {
				// Same graph type the app gives its AI entity graphs.
				requestBody.contextType = "WIKILINKS";
			} else if (
				params.modifyAnalyzedText &&
				params.modifyAnalyzedText !== "none"
			) {
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
				includeGraph || fullGraph,
				includeNodesAndEdges || fullGraph,
				buildingEntitiesGraph,
				fullGraph
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
