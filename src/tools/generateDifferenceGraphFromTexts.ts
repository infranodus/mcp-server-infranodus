import { z } from "zod";
import {
	GenerateDifferenceGraphFromTextsSchema,
	GenerateDifferenceGraphFromTextsSchemaBase,
} from "../schemas/index.js";
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

export const generateDifferenceGraphFromTextsTool = {
	name: "difference_between_texts",
	definition: {
		title: "Generate Difference Knowledge Graph from Texts",
		description:
			"Extract the conceptial relations that are not present in the first text but are in the other texts",
		inputSchema: GenerateDifferenceGraphFromTextsSchemaBase.shape,
		annotations: {
		   "readOnlyHint": true,
		   "idempotentHint": true,
		   "destructiveHint": false
		},
	},
	handler: async (
		params: z.infer<typeof GenerateDifferenceGraphFromTextsSchema>
	) => {
		try {
			let contexts: Array<{ text: string; modifyAnalyzedText?: string }>;
			if (params.urls && params.urls.length >= 2) {
				const results = await Promise.all(
					params.urls.map((url) => fetchUrlContentAsText(url))
				);
				const failed = results.findIndex((r) => !r.ok);
				if (failed >= 0)
					return errorContent(
						`URL ${params.urls[failed]} failed: ${(results[failed] as { error: string }).error}`
					);
				const contentTexts = (results as { ok: true; contentText: string }[]).map(
					(r) => r.contentText
				);
				const empty = contentTexts.findIndex((t) => !t?.trim());
				if (empty >= 0)
					return errorContent(
						`URL ${params.urls[empty]} did not return any text content`
					);
				contexts = contentTexts.map((text) => ({
					text,
					modifyAnalyzedText: params.modifyAnalyzedText ?? "none",
				}));
			} else if (params.contexts && params.contexts.length >= 2) {
				contexts = params.contexts.map((text) => ({
					text,
					modifyAnalyzedText: params.modifyAnalyzedText ?? "none",
				}));
			} else {
				return errorContent(
					"Provide either contexts or urls (at least two items - one target and one reference)."
				);
			}

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
