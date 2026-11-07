import { z } from "zod";
import { brand } from "../config/brand.js";
import { GetGraphAroundTermSchema } from "../schemas/index.js";
import { callMemoryEndpoint } from "../api/client.js";
import { transformToStructuredOutput } from "../utils/transformers.js";

function textResult(value: unknown, isError = false) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
		...(isError ? { isError: true } : {}),
	};
}

export const getGraphAroundTermTool = {
	name: "get_graph_around_term",
	definition: {
		title: `The Graph Around a Term in Your ${brand.name} Graphs`,
		description:
			`The graph around a term: every statement in your ${brand.name} graphs that contains the term — or all of several terms (matchAll, the default), or any of them — in all your graphs or the named ones, built into one graph with the terms themselves left out, so its topics, gaps and relations describe the context the terms sit in rather than the terms. The app's search view with the searched term hidden. ` +
			`Returns which graphs the statements came from with a count each, the statistics (modularity, diversity, clusters), the topical clusters, content gaps, main concepts, top relations and conceptual gateways of that graph, the compact graph (nodes with betweenness, weighted edges) unless includeGraph is false, and the statements with their graph and cluster when includeStatements is true. ` +
			`Use it for "what surrounds X across my graphs?", "what is the context of X in these graphs?", "what do my notes say around X, without X itself?", and with two terms "what sits between X and Y in my notes?" (their shared context). ` +
			`For what one concept is linked to inside one graph, by hop distance, use get_node_neighborhood; for the statements most relevant to a question, retrieve_from_knowledge_base; to only learn which graphs mention a term, search. Your own graphs only.`,
		inputSchema: GetGraphAroundTermSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (params: z.infer<typeof GetGraphAroundTermSchema>) => {
		try {
			const terms = Array.isArray(params.terms) ? params.terms : [params.terms];
			const includeGraph = params.includeGraph !== false;
			const includeStatements = params.includeStatements === true;
			const response = await callMemoryEndpoint("/termGraph", {
				terms,
				matchAll: params.matchAll !== false,
				graphNames: params.graphNames ?? [],
				removeTerms: params.removeTerms !== false,
				includeGraph,
				includeStatements,
				maxNodes: params.maxNodes ?? 150,
			});
			const body = response.body;
			if (response.status >= 400) {
				return textResult(
					{
						error: body.error ?? `HTTP ${response.status}`,
						...(body.errorCode ? { errorCode: body.errorCode } : {}),
					},
					true,
				);
			}
			// The app answers in the /graphAndStatements shape (compact graph with
			// statistics, graphSummary, extendedGraphSummary), so the same
			// transformer reads it; an empty search carries no graph at all.
			const { statements: _copied, ...structured } = body.graph
				? transformToStructuredOutput(body as any, includeGraph, includeGraph)
				: { statements: undefined };
			return textResult({
				terms: body.terms,
				matchAll: body.matchAll,
				removedTerms: body.removedTerms,
				graphs: body.graphs,
				statementCount: body.statementCount,
				...structured,
				...(includeStatements ? { statements: body.statements ?? [] } : {}),
			});
		} catch (error) {
			return textResult(
				{ error: error instanceof Error ? error.message : String(error) },
				true,
			);
		}
	},
};
