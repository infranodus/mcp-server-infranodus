import { z } from "zod";
import { AnalyzeLlmResultsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { getConfig } from "../api/config-store.js";
import { brandApiBase } from "../config/brand.js";
import {
	extractAiChoiceTexts,
	transformToStructuredOutput,
} from "../utils/transformers.js";
import { OntologyGraphOutput } from "../types/index.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

function appBaseUrl(): string {
	const apiBase = getConfig().apiBase || brandApiBase();
	return apiBase.replace(/\/api\/v1\/?$/, "");
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 30);
}

function defaultGraphName(prompt: string): string {
	const timestamp = new Date()
		.toISOString()
		.slice(2, 16)
		.replace(/[-:T]/g, "");
	const slug = slugify(prompt.split(" ").slice(0, 3).join(" "));
	return slug ? `llm_view_${slug}_${timestamp}` : `llm_view_${timestamp}`;
}

export const analyzeLlmResultsTool = {
	name: "analyze_llm_results",
	definition: {
		title: "Analyze How an LLM Sees a Topic",
		description:
			"Ask an LLM to describe a topic, then turn its response into a knowledge graph that reveals how the model frames it — main concepts, clusters, content gaps, and the relations between them. Useful for probing model bias, surfacing the implicit structure of an LLM's view on a subject, or comparing how different models describe the same topic. By default the graph is saved (saveGraph: true), analytics are returned (includeAnalytics: true), and the raw graph structure is omitted (includeGraph: false).",
		inputSchema: AnalyzeLlmResultsSchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof AnalyzeLlmResultsSchema>) => {
		try {
			const saveGraph = params.saveGraph !== false;
			const includeGraph = params.includeGraph === true;
			const includeAnalytics = params.includeAnalytics !== false;
			const modifyAnalyzedText = params.modifyAnalyzedText ?? "detectEntities";
			const contextType =
				modifyAnalyzedText === "none" ? "STANDARD" : "WIKILINKS";
			const graphName =
				params.graphName?.trim() || defaultGraphName(params.prompt);

			const requestBody: any = {
				saveToGraphAndRedirect: saveGraph,
				contextName: graphName,
				aiQueryType: "intro search",
				mode: "gptchat",
				modelToUse: params.modelToUse ?? "claude-opus-4.6",
				prompt: [{ role: "user", content: params.prompt }],
				numberOfResults: String(params.numberOfResults ?? 20),
				modifyAnalyzedText,
				contextType,
				replaceEntities: false,
				hideSearchTerms: true,
			};

			const response = await makeInfraNodusRequest("/aiAdvice", requestBody);

			if (response.error) {
				return errorContent(
					typeof response.error === "object"
						? JSON.stringify(response.error)
						: String(response.error),
				);
			}

			const llmStatements = extractAiChoiceTexts(response);

			let output: OntologyGraphOutput;

			if (saveGraph) {
				const redirectUrl = response.redirectUrl;
				if (!redirectUrl) {
					return errorContent(
						"The LLM overview was generated but no graph link was returned, so it may not have been saved. Check that your API key is valid (an anonymous/demo key does not persist graphs).",
					);
				}

				const base = appBaseUrl();
				const viewUrl = redirectUrl.replace(/\/edit\/?$/, "");

				output = {
					saved: true,
					graphName,
					graphUrl: `${base}${viewUrl}`,
					editUrl: `${base}${redirectUrl}`,
					message: `LLM overview graph "${graphName}" generated and saved.`,
				};
			} else {
				output = {
					saved: false,
					llmStatements,
					message:
						llmStatements.length > 0
							? `LLM overview generated (not saved): ${llmStatements.length} completion(s) returned. Use saveGraph: true to persist it as a graph.`
							: "The LLM did not return any statements. Try a more specific prompt or a different model.",
				};
			}

			if (includeGraph || includeAnalytics) {
				const graphQuery = new URLSearchParams({
					doNotSave: "true",
					addStats: "true",
					includeStatements: "false",
					includeGraphSummary: "false",
					extendedGraphSummary: includeAnalytics ? "true" : "false",
					includeGraph: includeGraph ? "true" : "false",
					compactGraph: includeGraph ? "true" : "false",
					aiTopics: "true",
					optimize: "develop",
				});
				const graphEndpoint = `/graphAndStatements?${graphQuery.toString()}`;

				const graphRequestBody: any = saveGraph
					? { name: graphName, aiTopics: "true", userName: "" }
					: {
							text: llmStatements.join("\n"),
							aiTopics: "true",
							modifyAnalyzedText,
					  };

				const graphResponse = await makeInfraNodusRequest(
					graphEndpoint,
					graphRequestBody,
				);

				if (!graphResponse.error) {
					// Tie includeNodesAndEdges to includeGraph so the transformer
					// doesn't strip nodes/edges when the caller wants the graph.
					const structured = transformToStructuredOutput(
						graphResponse,
						includeGraph,
						includeGraph,
						modifyAnalyzedText !== "none",
					);

					if (includeAnalytics) {
						output.statistics = structured.statistics;
						output.graphSummary = structured.graphSummary;
						output.contentGaps = structured.contentGaps;
						output.mainTopicalClusters = structured.mainTopicalClusters;
						output.mainConcepts = structured.mainConcepts;
						output.conceptualGateways = structured.conceptualGateways;
						output.topRelations = structured.topRelations;
						output.topBigrams = structured.topBigrams;
						output.topInfluentialNodes = structured.topInfluentialNodes;
						output.topClusters = structured.topClusters;
						output.knowledgeGraphByCluster = structured.knowledgeGraphByCluster;
					}
					if (includeGraph) {
						output.knowledgeGraph = structured.knowledgeGraph;
					}
				}
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(output, null, 2),
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
