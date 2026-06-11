import { z } from "zod";
import { GenerateOntologyGraphSchema } from "../schemas/index.js";
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

// Derive the app base URL (e.g. https://infranodus.com) from the
// API base URL (e.g. https://infranodus.com/api/v1) so we can build graph links.
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

function defaultOntologyName(prompt: string): string {
	const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:T]/g, "");
	const slug = slugify(prompt.split(" ").slice(0, 3).join(" "));
	return slug ? `ai_onto_${slug}_${timestamp}` : `ai_onto_${timestamp}`;
}

export const generateOntologyGraphTool = {
	name: "generate_ontology_graph",
	definition: {
		title: "Generate an AI Ontology Graph from a Topic or Prompt",
		description: `Use AI to generate a reasoning ontology knowledge graph (entities and the relations between them) for a topic, prompt, or text, and optionally save it as a ${brand.name} graph. Use to get a rich overview or to produce a reasoning map of a topic for expert workflows.`,
		inputSchema: GenerateOntologyGraphSchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof GenerateOntologyGraphSchema>) => {
		try {
			const saveGraph = params.saveGraph !== false;
			const includeGraph = params.includeGraph === true;
			const includeAnalytics = params.includeAnalytics !== false;
			const includeStatements = params.includeStatements !== false;
			const graphName =
				params.graphName?.trim() || defaultOntologyName(params.prompt);

			const requestBody: any = {
				saveToGraphAndRedirect: saveGraph,
				contextName: graphName,
				aiQueryType: "ontology graph",
				mode: "gptchat",
				modelToUse: params.modelToUse ?? "claude-opus-4.6",
				prompt: [{ role: "user", content: params.prompt }],
				modifyAnalyzedText: "none",
				contextType: "ONTOLOGY",
				replaceEntities: false,
				hideSearchTerms: true,
			};

			const response = await makeInfraNodusRequest("/aiAdvice", requestBody);

			// The /aiAdvice endpoint returns error envelopes with HTTP 200, so the
			// request does not throw — we must check response.error explicitly.
			if (response.error) {
				return errorContent(
					typeof response.error === "object"
						? JSON.stringify(response.error)
						: String(response.error),
				);
			}

			// Raw statements are present in the /aiAdvice response only when NOT
			// saving — saving returns a redirect instead. Each completion is a
			// newline-separated list of entity-relation statements, split the same
			// way the host app does (convertGPTResponsesToArray). The graph builder
			// (/graphAndStatements) returns the statements in their final,
			// post-processing shape, so those are preferred for ontologyStatements
			// whenever the graph is built; these raw ones are the fallback.
			const rawOntologyStatements = extractLineSeparatedStatements(response);

			let output: OntologyGraphOutput;

			if (saveGraph) {
				const redirectUrl = response.redirectUrl;
				if (!redirectUrl) {
					return errorContent(
						`The ontology was generated but no graph link was returned, so it may not have been saved. Check that your ${brand.name} API key is valid (an anonymous/demo key does not persist graphs).`,
					);
				}

				const base = appBaseUrl();
				// redirectUrl looks like /<userName>/<contextName>/edit
				const viewUrl = redirectUrl.replace(/\/edit\/?$/, "");

				output = {
					saved: true,
					graphName,
					graphUrl: `${base}${viewUrl}`,
					editUrl: `${base}${redirectUrl}`,
					message: `Ontology graph "${graphName}" generated and saved.`,
				};
			} else {
				output = {
					saved: false,
					message:
						rawOntologyStatements.length > 0
							? `Ontology generated (not saved): ${rawOntologyStatements.length} statement(s) returned. Use saveGraph: true to persist it as a ${brand.name} graph.`
							: "The AI did not return any ontology statements. Try a more specific prompt or a more capable model.",
				};
			}

			// We hit the graph builder for analytics/graph, and also for the
			// final-shape statements when the caller wants them — except in the
			// non-saved, statements-only case, where the raw statements are already
			// in hand and an extra build (plus its AI topics call) would be wasteful.
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
							text: rawOntologyStatements.join("\n"),
							aiTopics,
							modifyAnalyzedText: "extractEntitiesOnly",
						};

				const graphResponse = await makeInfraNodusRequest(
					graphEndpoint,
					graphRequestBody,
				);

				if (!graphResponse.error) {
					// For an ontology graph, nodes (entities) and edges (relations) are
					// the point — tie includeNodesAndEdges to includeGraph so the
					// transformer keeps them instead of stripping them.
					const structured = transformToStructuredOutput(
						graphResponse,
						includeGraph,
						includeGraph,
						true,
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
							output.ontologyStatements = stmts;
						}
					}
				}
			}

			// Fallback: if the builder's final-shape statements weren't obtained
			// (no graph call ran, or it failed/returned none), surface the raw
			// statements when we have them.
			if (
				includeStatements &&
				!output.ontologyStatements &&
				rawOntologyStatements.length > 0
			) {
				output.ontologyStatements = rawOntologyStatements;
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
