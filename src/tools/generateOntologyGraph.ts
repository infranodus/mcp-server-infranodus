import { z } from "zod";
import { GenerateOntologyGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { getConfig } from "../api/config-store.js";
import { brand, brandApiBase } from "../config/brand.js";
import {
	extractLineSeparatedStatements,
	transformToStructuredOutput,
} from "../utils/transformers.js";
import { OntologyGraphOutput, ToolHandlerContext } from "../types/index.js";
import { ProgressReporter } from "../utils/progress.js";

/** Split on line boundaries so no statement is cut in half. */
export function chunkByLines(text: string, chunkSize: number): string[] {
	const chunks: string[] = [];
	let current: string[] = [];
	let size = 0;
	for (const line of text.split("\n")) {
		if (size + line.length + 1 > chunkSize && current.length > 0) {
			chunks.push(current.join("\n"));
			current = [];
			size = 0;
		}
		current.push(line);
		size += line.length + 1;
	}
	if (current.length > 0) chunks.push(current.join("\n"));
	return chunks.filter((chunk) => chunk.trim().length > 0);
}

const PREAMBLES: Record<"general" | "codebase", string> = {
	general:
		"Extract an ontology from the text below: the entities it contains and the relations between them, covering the whole text, not only its main theme.",
	codebase:
		"The text below is a structural digest of a software project (directories, files, imports and dependencies, exported symbols, docstring headlines) or its documentation. Extract an ontology of its ARCHITECTURE. Entities: modules and files (keep paths exactly as written), functions and classes, data stores, external services and packages, configuration, and the domain concepts they implement. Relations: prefer [dependentOn] for imports and dependencies, [partOf] for containment, [isA] for kinds of components, [hasAttribute] for exposed symbols and configuration, [relatedTo] / [derivedFrom] for the concepts a module implements. Connect the modules to the concepts, not only to each other.",
};

/** Read an existing graph's statements (doNotSave; a missing name errors). */
async function readGraphStatements(graphName: string): Promise<string[]> {
	const query = new URLSearchParams({
		doNotSave: "true",
		addStats: "false",
		includeStatements: "true",
		includeGraphSummary: "false",
		extendedGraphSummary: "false",
		includeGraph: "false",
		compactGraph: "true",
		compactStatements: "true",
		aiTopics: "false",
	});
	const response = await makeInfraNodusRequest(`/graphAndStatements?${query}`, {
		name: graphName,
		aiTopics: "false",
	});
	if (response.error) {
		throw new Error(
			typeof response.error === "object"
				? JSON.stringify(response.error)
				: String(response.error),
		);
	}
	return (response.statements ?? [])
		.map((statement: any) => statement.content)
		.filter((content: unknown): content is string => typeof content === "string" && content.trim().length > 0);
}

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
		title: "Generate an AI Ontology Graph from a Topic, Text, or Existing Graph",
		description: `Use AI to generate a reasoning ontology knowledge graph (entities and the relations between them) and optionally save it as a ${brand.name} graph. Three sources, provide exactly one: prompt (a topic — one AI call), text (a long document or a structural digest of a project, chunked server-side), or sourceGraphName (an existing graph — e.g. a fully ingested repo, vault, or corpus — whose statements are read back, chunked, and condensed into an ontology). Set ontologyMode: 'codebase' for software projects. Use to get a rich overview, a reasoning map of a topic, or a condensed 'how it fits together' graph of a large corpus.`,
		inputSchema: GenerateOntologyGraphSchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof GenerateOntologyGraphSchema>,
		context?: ToolHandlerContext,
	) => {
		try {
			const saveGraph = params.saveGraph !== false;
			const fullGraph = params.fullGraph === true;
			// fullGraph implies includeGraph and disables compaction below, so the
			// response carries the raw graphology graph (all node/edge attributes,
			// edge context_matrix, nodes_to_statements_map).
			const includeGraph = params.includeGraph === true || fullGraph;
			const includeAnalytics = params.includeAnalytics !== false;
			const includeStatements = params.includeStatements !== false;
			// Exactly one source: a topic prompt (one AI call), a long text
			// (chunked), or an existing graph's statements (read back, chunked).
			const prompt = params.prompt?.trim();
			const text = params.text?.trim();
			const sourceGraphName = params.sourceGraphName?.trim();
			const provided = [prompt, text, sourceGraphName].filter(Boolean).length;
			if (provided !== 1) {
				return errorContent(
					"Provide exactly one of: prompt (a topic), text (a document or digest to extract from), or sourceGraphName (an existing graph to condense).",
				);
			}
			const mode = params.ontologyMode ?? "general";
			let source: "prompt" | "text" | "graph";
			let chunks: string[];
			if (prompt) {
				source = "prompt";
				chunks = [prompt];
			} else if (text) {
				source = "text";
				chunks = chunkByLines(text, params.chunkSize ?? 12000);
			} else {
				source = "graph";
				const statements = await readGraphStatements(sourceGraphName as string);
				if (statements.length === 0) {
					return errorContent(
						`Graph "${sourceGraphName}" has no statements to build an ontology from.`,
					);
				}
				chunks = chunkByLines(statements.join("\n"), params.chunkSize ?? 12000);
			}
			const graphName =
				params.graphName?.trim() ||
				defaultOntologyName(
					prompt ?? sourceGraphName ?? (text as string).slice(0, 60),
				);

			// One AI call per chunk; with saveGraph every call appends to the same
			// graph. Raw statements come back only when NOT saving — saving
			// returns a redirect — so both are collected across chunks.
			const progress = new ProgressReporter(context ?? {}, chunks.length);
			const rawOntologyStatements: string[] = [];
			let response: any = null;
			let chunksProcessed = 0;
			for (const [index, chunk] of chunks.entries()) {
				await progress.report(
					index,
					`Generating ontology: chunk ${index + 1} of ${chunks.length}`,
				);
				const content =
					source === "prompt"
						? chunk
						: `${PREAMBLES[mode]}${
								chunks.length > 1 ? ` (part ${index + 1} of ${chunks.length})` : ""
							}\n\n${chunk}`;
				const requestBody: any = {
					saveToGraphAndRedirect: saveGraph,
					contextName: graphName,
					aiQueryType: "ontology graph",
					mode: "gptchat",
					modelToUse: params.modelToUse ?? "claude-opus-5",
					prompt: [{ role: "user", content }],
					modifyAnalyzedText: "none",
					contextType: "ONTOLOGY",
					replaceEntities: false,
					hideSearchTerms: true,
				};
				const chunkResponse = await makeInfraNodusRequest("/aiAdvice", requestBody);
				// The /aiAdvice endpoint returns error envelopes with HTTP 200, so
				// the request does not throw — check response.error explicitly.
				if (chunkResponse.error) {
					const message =
						typeof chunkResponse.error === "object"
							? JSON.stringify(chunkResponse.error)
							: String(chunkResponse.error);
					return errorContent(
						chunksProcessed > 0
							? `Chunk ${index + 1} of ${chunks.length} failed after ${chunksProcessed} chunk(s) were ${saveGraph ? `saved to "${graphName}"` : "generated"}: ${message}. Resend the remaining part of the source with the same graphName to continue.`
							: message,
					);
				}
				response = chunkResponse;
				chunksProcessed += 1;
				rawOntologyStatements.push(...extractLineSeparatedStatements(chunkResponse));
			}
			await progress.report(chunks.length, "Ontology generated");

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
					source,
					chunksTotal: chunks.length,
					chunksProcessed,
					saved: true,
					graphName,
					graphUrl: `${base}${viewUrl}`,
					editUrl: `${base}${redirectUrl}`,
					message:
						chunks.length > 1
							? `Ontology graph "${graphName}" generated from ${chunks.length} chunks and saved.`
							: `Ontology graph "${graphName}" generated and saved.`,
				};
			} else {
				output = {
					source,
					chunksTotal: chunks.length,
					chunksProcessed,
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
					compactGraph: includeGraph && !fullGraph ? "true" : "false",
					aiTopics,
					optimize: "develop",
				});
				if (params.maxNodes && params.maxNodes > 0) {
					graphQuery.set("maxnodes", String(params.maxNodes));
				}
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
