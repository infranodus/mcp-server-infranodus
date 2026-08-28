import { z } from "zod";
import { AnalyzeLlmResultsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { getConfig } from "../api/config-store.js";
import { brand, brandApiBase } from "../config/brand.js";
import {
	extractLineSeparatedStatements,
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
	const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:T]/g, "");
	const slug = slugify(prompt.split(" ").slice(0, 3).join(" "));
	return slug ? `llm_view_${slug}_${timestamp}` : `llm_view_${timestamp}`;
}

export const analyzeLlmResultsTool = {
	name: "analyze_llm_results",
	definition: {
		title: "Analyze How an LLM Sees a Topic",
		description:
			"Ask an LLM to describe a topic, then turn its response into a knowledge graph that reveals how the model frames it — main concepts, clusters, content gaps, and the relations between them. Useful for probing model bias, surfacing the implicit structure of an LLM's view on a subject, or comparing how different models describe the same topic. ",
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
			const includeStatements = params.includeStatements !== false;
			const modifyAnalyzedText = params.modifyAnalyzedText ?? "none";
			const contextType =
				modifyAnalyzedText === "none" ? "STANDARD" : "WIKILINKS";
			const graphName =
				params.graphName?.trim() || defaultGraphName(params.prompt);

			const requestBody: any = {
				saveToGraphAndRedirect: saveGraph,
				contextName: graphName,
				aiQueryType: "llm graph",
				mode: "gptchat",
				modelToUse: params.modelToUse ?? "claude-opus-5",
				prompt: [{ role: "user", content: params.prompt }],
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

			// Raw completions are present in the /aiAdvice response only when NOT
			// saving — saving returns a redirect instead. For the 'llm graph'
			// query each completion is a newline-separated list of statements, so
			// split on newlines the same way the host app does (convertGPTResponses
			// ToArray). The graph builder (/graphAndStatements) returns the
			// statements in their final, post-processing shape (entity detection
			// applied, etc.), so those are preferred for llmStatements whenever the
			// graph is built; these raw ones are the fallback.
			const rawChoiceStatements = extractLineSeparatedStatements(response);

			let output: OntologyGraphOutput;

			if (saveGraph) {
				const redirectUrl = response.redirectUrl;
				if (!redirectUrl) {
					return errorContent(
						`The LLM overview was generated but no graph link was returned, so it may not have been saved. Check that your ${brand.name} API key is valid (an anonymous/demo key does not persist graphs).`,
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
					message:
						rawChoiceStatements.length > 0
							? `LLM overview generated (not saved): ${rawChoiceStatements.length} statement(s) returned. Use saveGraph: true to persist it as a ${brand.name} graph.`
							: "The LLM did not return any statements. Try a more specific prompt or a different model.",
				};
			}

			// We hit the graph builder for analytics/graph, and also for the
			// final-shape statements when the caller wants them — except in the
			// non-saved, statements-only case, where the raw completions are
			// already in hand and an extra build (plus its AI topics call) would
			// be wasteful.
			const needStatementsFromGraph =
				includeStatements && (saveGraph || includeGraph || includeAnalytics);
			const aiTopics = includeAnalytics ? "true" : "false";

			if (includeGraph || includeAnalytics || needStatementsFromGraph) {
				const graphQuery = new URLSearchParams({
					doNotSave: "true",
					addStats: "true",
					includeStatements: includeStatements ? "true" : "false",
					includeGraphSummary: "false",
					extendedGraphSummary: includeAnalytics ? "true" : "false",
					includeGraph: includeGraph ? "true" : "false",
					compactGraph: includeGraph ? "true" : "false",
					aiTopics,
					optimize: "develop",
				});
				const graphEndpoint = `/graphAndStatements?${graphQuery.toString()}`;

				const graphRequestBody: any = saveGraph
					? { name: graphName, aiTopics, userName: "" }
					: {
							text: rawChoiceStatements.join("\n"),
							aiTopics,
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
					if (includeStatements && Array.isArray(graphResponse.statements)) {
						const stmts = graphResponse.statements
							.map((s: any) =>
								(typeof s === "string" ? s : (s?.content ?? "")).trim(),
							)
							.filter((s: string) => s.length > 0);
						if (stmts.length > 0) {
							output.llmStatements = stmts;
						}
					}
				}
			}

			// Fallback: if the builder's final-shape statements weren't obtained
			// (no graph call ran, or it failed/returned none), surface the raw
			// completions when we have them.
			if (
				includeStatements &&
				!output.llmStatements &&
				rawChoiceStatements.length > 0
			) {
				output.llmStatements = rawChoiceStatements;
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
