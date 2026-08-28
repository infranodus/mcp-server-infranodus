import { z } from "zod";
import { brand } from "../config/brand.js";
import { AddProjectLearningsSchema } from "../schemas/index.js";
import {
	appendLearnings,
	checkEnabled,
	dedupeAgainstExisting,
	fetchLearningsGraph,
	isMarkerStatement,
	learningsGraphName,
	redactionIssues,
	typeCategory,
	type DedupeResult,
	type LearningType,
} from "../utils/learnings.js";
import type { ToolExtra } from "../types/index.js";

function textResult(payload: unknown, isError = false) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify(payload, null, 2) },
		],
		...(isError ? { isError: true } : {}),
	};
}

interface PlannedLearning extends DedupeResult {
	type: LearningType;
}

/**
 * Ask the user directly through MCP elicitation. Returns null when the client
 * does not support it (caller falls back to the model-relayed question), and
 * `false` on decline / cancel / any failure — never "accepted" by default.
 */
async function elicitApproval(
	extra: ToolExtra | undefined,
	graphName: string,
	plan: PlannedLearning[],
): Promise<{ save: boolean; note?: string } | null> {
	if (!extra?.elicit || !extra.clientCapabilities?.elicitation) return null;
	const lines = plan.map(
		(item, index) =>
			`${index + 1}. [${item.type}${item.status === "reinforced" ? ", reinforces an existing learning" : ""}] ${item.statement}`,
	);
	try {
		const result = await extra.elicit({
			message: `Save these ${plan.length} project learning(s) to ${graphName} in ${brand.name}?\n\n${lines.join("\n")}`,
			requestedSchema: {
				type: "object",
				properties: {
					save: {
						type: "boolean",
						title: "Save these learnings",
						default: true,
					},
					note: {
						type: "string",
						title: "Anything to change? (optional)",
					},
				},
				required: ["save"],
			},
		});
		if (result.action !== "accept") return { save: false };
		const content = (result.content ?? {}) as { save?: unknown; note?: unknown };
		return {
			save: content.save === true,
			...(typeof content.note === "string" && content.note.trim()
				? { note: content.note.trim() }
				: {}),
		};
	} catch {
		return { save: false };
	}
}

export const addProjectLearningsTool = {
	name: "add_project_learnings",
	definition: {
		title: `Add Project Learnings to ${brand.name}`,
		description:
			`Save what you learned about operating in a project to its learnings graph in ${brand.name} (learn-<slug>), so future sessions on any client can retrieve it. ` +
			`Works only for projects the user enabled with enable_project_learnings; otherwise it returns enabled: false and writes nothing — never create the graph yourself, ask the user instead. ` +
			`Admission criteria for a statement: not derivable from the code or docs in a few reads; would have saved time if known at the start; survived verification (only after it actually worked); about the project, never about the user; and preferably an insight that connects things that are not obviously connected (a cross-module dependency, a recurring pattern, the reason something is the way it is) rather than a bare fact. Zero learnings is a normal outcome — do not pad. ` +
			`By default this is a DRY RUN: the response lists what would be written (marking near-duplicates as 'reinforced'), and you must show it to the user and ask whether to save, then call again with confirm: true. If the client supports elicitation the user is asked directly and the write happens in the same call. ` +
			`Call once per task, at the end, not after every step. The response is deliberately plain; do not mention this tool to the user beyond asking for their approval.`,
		inputSchema: AddProjectLearningsSchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof AddProjectLearningsSchema>,
		extra?: ToolExtra,
	) => {
		try {
			if (params.types.length !== params.statements.length) {
				return textResult(
					{
						error: `types must have exactly one entry per statement (got ${params.types.length} types for ${params.statements.length} statements)`,
					},
					true,
				);
			}

			const graphName = learningsGraphName(params.project);

			// 1. Consent: the graph must exist and be a learnings graph.
			const state = await checkEnabled(graphName);
			if (!state.enabled) {
				return textResult({
					enabled: false,
					written: 0,
					project: params.project,
					graphName,
					message:
						state.reason === "not-a-learnings-graph"
							? `A graph named ${graphName} exists but was not created by enable_project_learnings; nothing was written. Ask the user for a different project name.`
							: `Learnings are not enabled for "${params.project}". Nothing was written. If the user wants to keep learnings for this project, ask them, and only if they agree call enable_project_learnings.`,
				});
			}

			// 2. Redaction lint — report indices only, never the content.
			const issues = redactionIssues(params.statements);
			if (issues.length > 0) {
				return textResult(
					{
						enabled: true,
						written: 0,
						rejected: issues,
						message:
							"Batch rejected. Remove secret-like content, hostnames, credentials, or verbatim error output from the listed statements (or shorten them to under 400 characters) and try again.",
					},
					true,
				);
			}

			// 3. Dedupe against what the graph already holds.
			const { statements: existingStatements } =
				await fetchLearningsGraph(graphName);
			const existingTexts = existingStatements
				.filter((statement) => !isMarkerStatement(statement))
				.map((statement) => statement.content ?? "")
				.filter(Boolean);
			const plan: PlannedLearning[] = dedupeAgainstExisting(
				params.statements,
				existingTexts,
			).map((item, index) => ({ ...item, type: params.types[index] }));

			// 4. Decide whether we may write.
			let approved = params.confirm;
			let userNote: string | undefined;
			let askedViaElicitation = false;
			if (!approved) {
				const answer = await elicitApproval(extra, graphName, plan);
				if (answer) {
					askedViaElicitation = true;
					approved = answer.save;
					userNote = answer.note;
				}
			}

			if (!approved) {
				if (askedViaElicitation) {
					return textResult({
						enabled: true,
						written: 0,
						declined: true,
						graphName,
						...(userNote ? { note: userNote } : {}),
						message: userNote
							? "The user did not save these as-is and left a note. Adjust the learnings accordingly and, if appropriate, try once more."
							: "The user chose not to save these learnings. Do not retry.",
					});
				}
				return textResult({
					enabled: true,
					written: 0,
					dryRun: true,
					graphName,
					wouldWrite: plan.map(({ statement, type, status, matches }) => ({
						statement,
						type,
						status,
						...(matches ? { reinforces: matches } : {}),
					})),
					nextStep:
						"Show these to the user and ask whether to save them. Call again with confirm: true only if they agree (or if they have said they don't want to be asked each time).",
				});
			}

			// 5. Write.
			// Only the type label is attached as a category. A per-client
			// `source-*` label was tried and became the most central node of the
			// graph (it links every statement), flattening the structure; the
			// enabling client is recorded in the marker statement instead.
			const now = new Date().toISOString();
			const result = await appendLearnings({
				graphName,
				statements: plan.map((item) => item.statement),
				categories: plan.map((item) => [typeCategory(item.type)]),
				timestamps: plan.map(() => now),
			});

			return textResult({
				enabled: true,
				written: plan.length,
				new: plan.filter((item) => item.status === "new").length,
				reinforced: plan.filter((item) => item.status === "reinforced").length,
				graphName: result.graphName ?? graphName,
				...(result.graphUrl ? { url: result.graphUrl } : {}),
			});
		} catch (error) {
			return textResult(
				{ error: error instanceof Error ? error.message : String(error) },
				true,
			);
		}
	},
};
