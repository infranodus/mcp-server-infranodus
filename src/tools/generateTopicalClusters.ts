import { z } from "zod";
import {
	GenerateTopicalClustersSchema,
	GenerateTopicalClustersSchemaBase,
} from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { resolveGraphInput } from "../utils/graphInput.js";
import { generateTopics } from "../utils/transformers.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

export const generateTopicalClustersTool = {
	name: "generate_topical_clusters",
	definition: {
		title: "Generate Topical Clusters",
		description:
			"Generate topics and clusters of keywords from text, URL, or an existing graph using knowledge graph analysis. ",
		inputSchema: GenerateTopicalClustersSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof GenerateTopicalClustersSchema>) => {
		try {
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: "false",
				includeStatements: "false",
				aiTopics: "true",
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			let requestBody: {
				text?: string;
				statements?: string[];
				categories?: string[][];
				timestamps?: string[];
				contextSettings?: Record<string, unknown>;
				name?: string;
				userName?: string;
			};
			if (params.graphName?.trim()) {
				requestBody = {
					name: params.graphName,
					userName: params.userName ?? "",
				};
			} else {
				const input = await resolveGraphInput(params);
				if (!input.ok) return errorContent(input.error);
				requestBody = { ...input.payload };
			}

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			if (response.error) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ error: response.error }),
						},
					],
					isError: true,
				};
			}

			// Optionally generate AI summaries of the topical clusters using the
			// same flow as generate_responses_from_graph, but with the
			// "graph summary" request mode and the gpt-5.4-mini model.
			let summaryResponse: typeof response | undefined;
			if (params.generateTopicalSummaries) {
				const summaryQueryParams = new URLSearchParams({
					doNotSave: "true",
					addStats: "true",
					optimize: "develop",
					includeStatements: "false",
					includeGraphSummary: "false",
					extendedGraphSummary: "false",
					includeGraph: "false",
					aiTopics: "true",
				});

				const summaryEndpoint = `/graphAndAdvice?${summaryQueryParams.toString()}`;

				const summaryRequestBody = {
					...requestBody,
					aiTopics: "true",
					requestMode: "graph summary",
					modelToUse: "gpt-5.4-mini",
				};

				summaryResponse = await makeInfraNodusRequest(
					summaryEndpoint,
					summaryRequestBody,
				);

				if (summaryResponse.error) {
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({ error: summaryResponse.error }),
							},
						],
						isError: true,
					};
				}
			}

			const insights = generateTopics(response, summaryResponse);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(insights, null, 2),
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
