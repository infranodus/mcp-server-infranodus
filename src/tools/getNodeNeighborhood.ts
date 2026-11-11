import { z } from "zod";
import { brand } from "../config/brand.js";
import { GetNodeNeighborhoodSchema } from "../schemas/index.js";
import { callMemoryEndpoint } from "../api/client.js";
import { savedGraphWikilinksModeBody } from "../utils/wikilinksMode.js";

function textResult(value: unknown, isError = false) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
		...(isError ? { isError: true } : {}),
	};
}

export const getNodeNeighborhoodTool = {
	name: "get_node_neighborhood",
	definition: {
		title: `What a Concept Is Connected To in an ${brand.name} Graph`,
		description:
			`What one concept is connected to in a saved ${brand.name} graph, by hop distance, computed on the server: no need to download the whole graph and walk it. ` +
			`Returns the concept's own stats (degree, betweenness, cluster), its neighbors nearest and strongest first (node, hop, weight, via: the node it was reached through, cluster), and the statements on those links with their categories and hop. ` +
			`The answer to any question about one node: what X is connected to, related to, or linked to, its neighbors, what it depends on or leads to, which types of learnings touch it (the statement categories); on any graph including memory graphs (learn-<project>, memory-<topic>, personal-<user>). ` +
			`Call it even when the graph's statements are already in context: the walk is authoritative, reading co-occurrence out of a statement list is not. ` +
			`For the statements most relevant to a question instead, use retrieve_from_knowledge_base (with hops: 2); for the graph around a term across several graphs, with the term itself left out, get_graph_around_term. ` +
			`An unknown concept returns notFound with similar node names to retry with.`,
		inputSchema: GetNodeNeighborhoodSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (params: z.infer<typeof GetNodeNeighborhoodSchema>) => {
		try {
			const nodes = Array.isArray(params.node) ? params.node : [params.node];
			const response = await callMemoryEndpoint("/nodeNeighborhood", {
				name: params.graphName,
				nodes,
				hops: params.hops ?? 2,
				maxNeighbors: params.maxNeighbors ?? 30,
				includeStatements: params.includeStatements !== false,
				...savedGraphWikilinksModeBody(params.wikilinksMode),
			});
			const body = response.body;
			if (body.errorCode === "node_not_found") {
				return textResult({
					notFound: true,
					message: body.error,
					suggestions: body.suggestions ?? [],
				});
			}
			if (response.status >= 400) {
				return textResult({ error: body.error ?? `HTTP ${response.status}` }, true);
			}
			return textResult({
				graphName: body.graphName,
				hops: body.hops,
				concept: body.nodes,
				neighbors: (body.neighbors ?? []).map((n: Record<string, unknown>) => ({
					node: n.node,
					hop: n.hop,
					weight: n.weight,
					...(n.via ? { via: n.via } : {}),
					cluster: n.community,
				})),
				...(params.includeStatements !== false
					? { statements: body.statements ?? [] }
					: {}),
			});
		} catch (error) {
			return textResult(
				{ error: error instanceof Error ? error.message : String(error) },
				true,
			);
		}
	},
};
