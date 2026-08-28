import { z } from "zod";
import { brand } from "../config/brand.js";
import { GetProjectLearningsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import {
	GRAPH_PREFIX,
	checkEnabled,
	fetchLearningsGraph,
	isMarkerStatement,
	learningsGraphName,
	newestFirst,
	toStoredLearning,
	type StoredLearning,
} from "../utils/learnings.js";
import type { Statement } from "../types/index.js";

function textResult(payload: unknown, isError = false) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify(payload, null, 2) },
		],
		...(isError ? { isError: true } : {}),
	};
}

function toLearnings(statements: Statement[], limit: number): StoredLearning[] {
	return newestFirst(
		statements
			.filter((statement) => !isMarkerStatement(statement))
			.map(toStoredLearning)
			.filter((item): item is StoredLearning => item !== null),
	).slice(0, limit);
}

export const getProjectLearningsTool = {
	name: "get_project_learnings",
	definition: {
		title: `Get Project Learnings from ${brand.name}`,
		description:
			`Retrieve what previous sessions learned about operating in a project (saved with add_project_learnings). ` +
			`Call it at the start of a substantive task with the task as \`prompt\` to get the most relevant learnings plus an overview of what is known; with \`entity\` (a file path, module, or concept) before working on an unfamiliar area; with neither for a structural overview; or with no \`project\` to list the projects that have learnings in this account. ` +
			`Returns enabled: false with an empty list when the project has no learnings graph — that is not an error, just carry on; do not suggest enabling unless the user asks about memory.`,
		inputSchema: GetProjectLearningsSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (params: z.infer<typeof GetProjectLearningsSchema>) => {
		try {
			// No project → list the learnings graphs in the account.
			if (!params.project) {
				const response = (await makeInfraNodusRequest("/listGraphs", {
					query: GRAPH_PREFIX,
				})) as unknown;
				const graphs = Array.isArray(response)
					? (response as Array<{ contextName?: string; createdAt?: string; defaultRevisionUrl?: string | null }>)
							.filter((graph) => graph.contextName?.startsWith(GRAPH_PREFIX))
							.map((graph) => ({
								graphName: graph.contextName,
								project: graph.contextName?.slice(GRAPH_PREFIX.length),
								createdAt: graph.createdAt,
								...(graph.defaultRevisionUrl ? { url: graph.defaultRevisionUrl } : {}),
							}))
					: [];
				return textResult({
					projects: graphs,
					message:
						graphs.length === 0
							? "No project learnings graphs in this account."
							: "Use the matching project name (not the graphName) in add_project_learnings / get_project_learnings.",
				});
			}

			const graphName = learningsGraphName(params.project);
			const state = await checkEnabled(graphName);
			if (!state.enabled) {
				return textResult({
					enabled: false,
					project: params.project,
					graphName,
					learnings: [],
				});
			}

			// Entity lookup → every learning mentioning it.
			if (params.entity) {
				const response = await makeInfraNodusRequest("/search", {
					query: params.entity,
					contextNames: graphName,
				});
				if (response.error) throw new Error(response.error);
				const texts = (response as { entriesAdded?: { texts?: string[] } })
					.entriesAdded?.texts ?? [];
				return textResult({
					enabled: true,
					project: params.project,
					graphName,
					entity: params.entity,
					learnings: texts.slice(0, params.limit).map((content) => ({ content })),
				});
			}

			// Prompt → GraphRAG retrieval with a structural overview.
			if (params.prompt) {
				const queryParams = new URLSearchParams({
					doNotSave: "true",
					addStats: "true",
					includeGraph: "false",
					includeStatements: "true",
					includeGraphSummary: "true",
					extendedGraphSummary: "true",
				});
				const response = await makeInfraNodusRequest(
					`/graphAndAdvice?${queryParams.toString()}`,
					{
						name: graphName,
						aiTopics: "true",
						requestMode: "search",
						prompt: params.prompt,
						modelToUse: "gpt-4o-mini",
					},
				);
				if (response.error) throw new Error(response.error);
				const ranked = (response.statements ?? [])
					.filter((statement) => !isMarkerStatement(statement))
					.sort(
						(a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0),
					)
					.slice(0, params.limit)
					.map((statement) => ({
						...toStoredLearning(statement),
						similarity: statement.similarityScore,
					}));
				return textResult({
					enabled: true,
					project: params.project,
					graphName,
					...(response.graphSummary ? { overview: response.graphSummary } : {}),
					...(response.extendedGraphSummary?.mainTopics
						? { knownAreas: response.extendedGraphSummary.mainTopics }
						: {}),
					...(response.extendedGraphSummary?.contentGaps
						? { gaps: response.extendedGraphSummary.contentGaps }
						: {}),
					learnings: ranked,
				});
			}

			// Neither → overview + newest learnings.
			const { statements, response } = await fetchLearningsGraph(graphName);
			const summary = response.extendedGraphSummary;
			return textResult({
				enabled: true,
				project: params.project,
				graphName,
				...(state.info.url ? { url: state.info.url } : {}),
				total: statements.filter((s) => !isMarkerStatement(s)).length,
				...(summary?.mainTopics?.length ? { knownAreas: summary.mainTopics } : {}),
				...(summary?.mainConcepts?.length ? { mainConcepts: summary.mainConcepts } : {}),
				...(summary?.contentGaps?.length ? { gaps: summary.contentGaps } : {}),
				learnings: toLearnings(statements, params.limit),
			});
		} catch (error) {
			return textResult(
				{ error: error instanceof Error ? error.message : String(error) },
				true,
			);
		}
	},
};
