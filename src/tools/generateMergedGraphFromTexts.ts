import { z } from "zod";
import { brand } from "../config/brand.js";
import {
	GenerateOverlapGraphFromTextsSchema,
	GenerateOverlapGraphFromTextsSchemaBase,
} from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { resolveContexts } from "../utils/graphInput.js";
import { transformToStructuredOutput } from "../utils/transformers.js";
import type { GraphResponse } from "../types/index.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

/** Fetches an existing graph by name with includeStatements and returns its statements joined as text. */
async function fetchGraphTextByName(
	graphName: string
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
	const queryParams = new URLSearchParams({
		doNotSave: "true",
		addStats: "true",
		includeStatements: "true",
		includeGraphSummary: "false",
		extendedGraphSummary: "false",
		includeGraph: "false",
		compactGraph: "true",
		compactStatements: "true",
		aiTopics: "false",
		optimize: "develop",
	});
	const endpoint = `/graphAndStatements?${queryParams.toString()}`;
	const requestBody = { name: graphName, aiTopics: "true" };
	let response: GraphResponse;
	try {
		response = await makeInfraNodusRequest(endpoint, requestBody);
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
	if (response.error) {
		return { ok: false, error: response.error };
	}
	const statements = response.statements ?? [];
	const text = statements
		.map((s) => s.content?.trim())
		.filter(Boolean)
		.join("\n");
	if (!text.trim()) {
		return {
			ok: false,
			error: `Graph "${graphName}" returned no statement content`,
		};
	}
	return { ok: true, text };
}

export const generateMergedGraphFromTextsTool = {
	name: "merged_graph_from_texts",
	definition: {
		title: "Generate Merged Knowledge Graph from Texts",
		description:
			`Build a graph of all the texts, URLs, and existing ${brand.name} graphs provided, providing topical clusters and gaps present in the merged graph generated from all the texts.`,
		inputSchema: GenerateOverlapGraphFromTextsSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof GenerateOverlapGraphFromTextsSchema>
	) => {
		try {
			const modifyAnalyzedText = params.modifyAnalyzedText ?? "none";
			const resolved = await resolveContexts(
				params.contexts,
				fetchGraphTextByName
			);
			if (!resolved.ok) return errorContent(resolved.error);
			const contexts = resolved.contexts.map((context) => ({
				...context,
				modifyAnalyzedText,
			}));

			const includeNodesAndEdges = params.addNodesAndEdges;
			const includeGraph = params.includeGraph;
			// Build query parameters (same shape as overlap tool, compareMode: merge)
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeStatements: params.includeStatements ? "true" : "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: includeGraph ? "true" : "false",
				compactGraph: "true",
				compactStatements: "true",
				aiTopics: "true",
				optimize: "develop",
				compareMode: "merge",
			});

			const endpoint = `/graphsAndStatements?${queryParams.toString()}`;

			const requestBody: any = {
				contexts,
				aiTopics: "true",
				...(resolved.contextSettings
					? { contextSettings: resolved.contextSettings }
					: {}),
			};

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
				includeNodesAndEdges
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
