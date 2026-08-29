import { z } from "zod";
import { brand } from "../config/brand.js";
import { OptimizeKnowledgeBaseSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { resolveGraphInput } from "../utils/graphInput.js";
import {
	generateOptimizationResult,
	extractLatentTopicsIdeas,
	transformToStructuredOutput,
} from "../utils/transformers.js";
import {
	dedupeList,
	normalizeState,
	readState,
	type Focus,
} from "../utils/knowledgeBase.js";
import type { GraphResponse, ToolHandlerContext } from "../types/index.js";
import { ProgressReporter } from "../utils/progress.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

function errorText(error: unknown): string {
	if (typeof error === "string") return error;
	if (error && typeof error === "object") {
		const message = (error as { message?: unknown }).message;
		if (Array.isArray(message)) return message.join("; ");
		if (typeof message === "string") return message;
		return JSON.stringify(error);
	}
	return String(error);
}

interface Comparison {
	against: string;
	/** Topics present in the other layer but absent from the primary one. */
	missingFromPrimary: string[];
	/** Topics present in the primary layer but absent from the other one. */
	missingFromOther: string[];
	note: string;
}

async function differenceTopics(
	first: string,
	second: string,
): Promise<{ topics: string[]; concepts: string[] } | { error: string }> {
	const queryParams = new URLSearchParams({
		doNotSave: "true",
		addStats: "true",
		includeStatements: "false",
		includeGraphSummary: "false",
		extendedGraphSummary: "true",
		includeGraph: "false",
		compactGraph: "true",
		compactStatements: "true",
		aiTopics: "true",
		optimize: "develop",
		compareMode: "difference",
	});
	const response = await makeInfraNodusRequest(
		`/graphsAndStatements?${queryParams.toString()}`,
		{
			contexts: [{ graphName: first }, { graphName: second }],
			aiTopics: "true",
		},
	);
	if (response.error) return { error: errorText(response.error) };
	const structured = transformToStructuredOutput(response, false, false, false);
	return {
		topics: dedupeList(structured.mainTopicalClusters ?? [], 8),
		concepts: dedupeList(structured.mainConcepts ?? [], 12),
	};
}

export const optimizeKnowledgeBaseTool = {
	name: "optimize_knowledge_base",
	definition: {
		title: `Optimize the Structure of a Knowledge Base, Code Base, or Rule Set`,
		description:
			`Structural feedback on a whole body of knowledge — a code base, a document vault, or procedural knowledge (rules, frameworks, principles) — from its ${brand.name} graph. ` +
			`Give it the graph built from the project (graphName: e.g. repo-<project>-principles, repo-<project>-digest, repo-<project>-docs, vault-<project>-*, learn-<project>) or a digest as statements/text, and set focus to how the reading should be framed (codebase, vault, procedural, general). ` +
			`It diagnoses the structure (biased / focused / diversified / dispersed) and translates it: what dominates, which areas are under-developed, which clusters never connect (missing integrations, missing bridge notes, missing hand-offs between frameworks), with AI suggestions for what to develop next. ` +
			`compareWith names other layers of the same project (e.g. principles vs digest, docs vs code) and reports what each layer has that the other lacks — rules without code, code without documentation, features claimed but not built. ` +
			`Use it after the infranodus skill has ingested a repo or vault, or on any saved graph, when the user asks to optimize, review, or find what is missing or under-developed in a project, vault, or set of rules.`,
		inputSchema: OptimizeKnowledgeBaseSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof OptimizeKnowledgeBaseSchema>,
		context?: ToolHandlerContext,
	) => {
		try {
			const focus: Focus = params.focus ?? "general";
			const modelToUse = params.modelToUse ?? "gpt-5.4";
			const includeLatent = params.includeLatent !== false;
			const compareWith = dedupeList(params.compareWith ?? [], 2);
			const steps = 1 + (includeLatent ? 1 : 0) + compareWith.length * 2;
			const progress = new ProgressReporter(context ?? {}, steps);
			let step = 0;

			// Primary source: an existing graph, or statements/text resolved the
			// same way optimize_text_structure does.
			let sourceBody: Record<string, unknown>;
			let sourceLabel: string;
			if (params.graphName?.trim()) {
				sourceBody = { name: params.graphName.trim() };
				sourceLabel = params.graphName.trim();
			} else {
				const input = await resolveGraphInput(params);
				if (!input.ok) return errorContent(input.error);
				sourceBody = { ...input.payload };
				sourceLabel = "submitted statements";
			}
			if (compareWith.length > 0 && !params.graphName?.trim()) {
				return errorContent(
					"compareWith needs the primary source to be a saved graph (graphName) so the layers can be compared on the server.",
				);
			}

			// 1. Structure diagnosis + development suggestions.
			await progress.report(step++, "Diagnosing structure");
			const developQuery = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				includeStatements: "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: "true",
				compactGraph: "true",
				aiTopics: "true",
				optimize: "develop",
			});
			const develop: GraphResponse = await makeInfraNodusRequest(
				`/graphAndAdvice?${developQuery.toString()}`,
				{
					...sourceBody,
					aiTopics: "true",
					requestMode: "response",
					modelToUse,
				},
			);
			if (develop.error) return errorContent(errorText(develop.error));
			const optimization = generateOptimizationResult(develop);
			const stateRaw =
				develop.extendedGraphSummary?.diversityStatistics?.diversity_score ??
				(develop.graph?.graphologyGraph?.attributes?.diversity_stats as any)
					?.diversity_score;
			const state = normalizeState(stateRaw);

			// 2. Under-developed (latent) topics.
			let latentIdeas: string[] = [];
			let latentTopics: string[] = [];
			if (includeLatent) {
				await progress.report(step++, "Finding under-developed areas");
				const latentQuery = new URLSearchParams({
					doNotSave: "true",
					addStats: "true",
					includeStatements: "false",
					includeGraphSummary: "false",
					extendedGraphSummary: "true",
					includeGraph: "false",
					aiTopics: "true",
					optimize: "latent",
				});
				const latent: GraphResponse = await makeInfraNodusRequest(
					`/graphAndAdvice?${latentQuery.toString()}`,
					{
						...sourceBody,
						aiTopics: "true",
						requestMode: "transcend",
						modelToUse,
					},
				);
				if (!latent.error) {
					const extracted = extractLatentTopicsIdeas(latent);
					latentIdeas = dedupeList(extracted.ideas ?? [], 6);
					latentTopics = dedupeList(extracted.latentTopicsToDevelop ?? [], 8);
				}
			}

			// 3. Layer comparisons, both directions.
			const comparisons: Comparison[] = [];
			const primary = params.graphName?.trim() as string;
			for (const other of compareWith) {
				await progress.report(step++, `Comparing with ${other}`);
				const missingFromPrimary = await differenceTopics(primary, other);
				await progress.report(step++, `Comparing ${other} back`);
				const missingFromOther = await differenceTopics(other, primary);
				comparisons.push({
					against: other,
					missingFromPrimary:
						"error" in missingFromPrimary ? [] : missingFromPrimary.topics,
					missingFromOther:
						"error" in missingFromOther ? [] : missingFromOther.topics,
					note:
						"error" in missingFromPrimary || "error" in missingFromOther
							? `comparison failed: ${
									("error" in missingFromPrimary && missingFromPrimary.error) ||
									("error" in missingFromOther && missingFromOther.error)
								}`
							: `missingFromPrimary = what ${other} covers that ${primary} does not; missingFromOther = what ${primary} covers that ${other} does not.`,
				});
			}
			await progress.report(steps, "Done");

			const reading = state ? readState(focus, state) : undefined;
			const mainClusters = dedupeList(optimization.mainTopicalClusters ?? [], 10);
			const report = {
				source: sourceLabel,
				focus,
				state: state ?? "unknown",
				...(reading ? { meaning: reading.meaning, action: reading.action } : {}),
				dominant: mainClusters[0],
				mainClusters,
				underdeveloped: dedupeList(
					[...(optimization.topicsToDevelop ?? []), ...latentTopics],
					10,
				),
				missingBridges: dedupeList(optimization.contentGaps ?? [], 8),
				gateways: dedupeList(optimization.conceptualGateways ?? [], 8),
				suggestions: dedupeList(optimization.suggestions ?? [], 6),
				...(latentIdeas.length ? { latentIdeas } : {}),
				...(comparisons.length ? { comparisons } : {}),
				...(optimization.diversity_stats
					? { statistics: optimization.diversity_stats }
					: {}),
			};

			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(report, null, 2) },
				],
			};
		} catch (error) {
			return errorContent(error instanceof Error ? error.message : String(error));
		}
	},
};
