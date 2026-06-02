import { z } from "zod";
import {
	GenerateDifferenceGraphFromTextsSchema,
	GenerateDifferenceGraphFromTextsSchemaBase,
} from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { fetchUrlContentAsText } from "../utils/urlContent.js";
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
	const requestBody = { name: graphName, aiTopics: "false" };
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

export const generateDifferenceGraphFromTextsTool = {
	name: "difference_between_texts",
	definition: {
		title: "Generate Difference Knowledge Graph from Texts",
		description:
			"Extract the conceptial relations that are missing in the first text, url, or KeywordGraph graph but are present in the other texts",
		inputSchema: GenerateDifferenceGraphFromTextsSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof GenerateDifferenceGraphFromTextsSchema>
	) => {
		try {
			const modifyAnalyzedText = params.modifyAnalyzedText ?? "none";
			const resolvedTexts: string[] = [];
			for (let i = 0; i < params.contexts.length; i++) {
				const item = params.contexts[i];
				if ("text" in item) {
					if (!item.text.trim())
						return errorContent(`Context at index ${i} has empty text.`);
					resolvedTexts.push(item.text);
					continue;
				}
				if ("url" in item) {
					const result = await fetchUrlContentAsText(item.url);
					if (!result.ok)
						return errorContent(
							`URL at context index ${i} failed: ${result.error}`
						);
					if (!result.contentText?.trim())
						return errorContent(
							`URL at context index ${i} did not return any text content`
						);
					resolvedTexts.push(result.contentText);
					continue;
				}
				if ("graphName" in item) {
					const result = await fetchGraphTextByName(item.graphName);
					if (!result.ok)
						return errorContent(
							`Graph at context index ${i} failed: ${result.error}`
						);
					resolvedTexts.push(result.text);
					continue;
				}
				return errorContent(
					`Context at index ${i} must be { text }, { url }, or { graphName }.`
				);
			}
			const contexts: Array<{ text: string; modifyAnalyzedText?: string }> =
				resolvedTexts.map((text) => ({
					text,
					modifyAnalyzedText,
				}));

			const includeNodesAndEdges = params.addNodesAndEdges;
			const includeGraph = params.includeGraph;
			// Build query parameters
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
				compareMode: "difference",
			});

			const endpoint = `/graphsAndStatements?${queryParams.toString()}`;

			const requestBody: any = {
				contexts,
				aiTopics: "true",
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
