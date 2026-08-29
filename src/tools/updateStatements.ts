/**
 * update_statements — edit statements of a graph in the caller's own account
 * IN PLACE (content, categories, timestamp), keeping their id, date and
 * position (see docs/drafts/update-statements-tool.md).
 *
 * The editing counterpart of delete_statements and built to the same shape:
 * exactly one mode (targeted `edits`, or one selector plus `set`/`replace`),
 * the graph must already exist, a dry run is the default, and the write only
 * happens with `confirm: true` or an elicitation form the user accepts. The
 * request body is identical for the preview and for the write, so what the
 * user approved is what gets changed.
 */
import { z } from "zod";
import { brand } from "../config/brand.js";
import { UpdateStatementsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { errorText, findGraphByName } from "../utils/graphLookup.js";
import { timestampIsParsable } from "../utils/graphInput.js";
import { buildSelector, describeRequestError, type Selector } from "./deleteStatements.js";
import type { ToolExtra } from "../types/index.js";

type Params = z.infer<typeof UpdateStatementsSchema>;
type Edit = NonNullable<Params["edits"]>[number];

function textResult(payload: unknown, isError = false) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify(payload, null, 2) },
		],
		...(isError ? { isError: true } : {}),
	};
}

/** Longest statement the app accepts; longer text must be re-created. */
export const MAX_CONTENT_LENGTH = 1000;
/** How many before→after pairs the dry run echoes back to the model. */
export const CHANGES_SHOWN = 50;
/** How many before→after pairs the elicitation prompt quotes. */
const SAMPLE_IN_PROMPT = 3;
const SAMPLE_LENGTH = 120;

const TOO_LONG_HINT = `Statements are at most ${MAX_CONTENT_LENGTH} characters. For longer text, remove the statement with delete_statements and add the new one with create_knowledge_graph to the same graphName.`;

function timestampError(label: string, value: string): string {
	return `${label} must be an ISO 8601 date or datetime (e.g. 2026-08-01 or 2026-08-01T12:00:00Z); got "${value}". Ambiguous formats such as 03.05.2026 are refused because the server could misread the month and day.`;
}

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

/** Mode A body (everything but name/dryRun). */
export interface EditsBody {
	edits: Edit[];
}

/** Mode B body (everything but name/dryRun). */
export type BulkBody = Selector & {
	set?: NonNullable<Params["set"]>;
	replace?: NonNullable<Params["replace"]>;
};

export type Mode = "edits" | "bulk";

export type BuildResult =
	| { ok: true; mode: Mode; body: EditsBody | BulkBody; kind: string }
	| { ok: false; error: string };

function hasItems(value: unknown): boolean {
	return Array.isArray(value) && value.length > 0;
}

/** Normalise one Mode A edit; returns an error string when it is malformed. */
function checkEdit(edit: Edit, index: number): string | null {
	const at = `edits[${index}]`;
	const match = edit.match?.trim();
	const hasMatch = Boolean(match);
	const hasId = typeof edit.statementId === "number";
	if (hasMatch === hasId) {
		return `${at}: give exactly one of match (the statement's exact current text) or statementId.`;
	}
	const content = edit.content?.trim();
	const changes =
		(content ? 1 : 0) +
		(Array.isArray(edit.categories) ? 1 : 0) +
		(edit.timestamp?.trim() ? 1 : 0);
	if (changes === 0) {
		return `${at}: nothing to change — give at least one of content, categories, timestamp.`;
	}
	if (content && content.length > MAX_CONTENT_LENGTH) {
		return `${at}: content is ${content.length} characters. ${TOO_LONG_HINT}`;
	}
	if (edit.timestamp?.trim() && !timestampIsParsable(edit.timestamp)) {
		return timestampError(`${at}.timestamp`, edit.timestamp);
	}
	return null;
}

/**
 * Resolve the request body from the parameters: Mode A (`edits`) xor Mode B
 * (one selector plus `set` and/or `replace`). Pure; no network.
 */
export function buildUpdate(params: Partial<Params>): BuildResult {
	const editsGiven = hasItems(params.edits);
	const selectorGiven =
		hasItems(params.categories) ||
		hasItems(params.statements) ||
		Boolean(params.query?.trim()) ||
		Boolean(params.before?.trim()) ||
		Boolean(params.after?.trim()) ||
		params.all === true ||
		hasItems(params.statementIds);
	const setGiven = Boolean(params.set && Object.keys(params.set).length > 0);
	const replaceGiven = Boolean(params.replace);
	const bulkGiven = selectorGiven || setGiven || replaceGiven;

	if (editsGiven && bulkGiven) {
		return {
			ok: false,
			error:
				"Use one mode per call: either edits (rewrite specific statements) or a selector with set/replace (bulk change). Split the update into separate calls.",
		};
	}
	if (!editsGiven && !bulkGiven) {
		return {
			ok: false,
			error:
				"Nothing to do. Either give edits (Mode A: one item per statement, with match or statementId and the fields to change), or one selector (categories, statements, query, before/after, all: true, or statementIds) with set and/or replace (Mode B).",
		};
	}

	// Mode A
	if (editsGiven) {
		const edits: Edit[] = [];
		for (const [index, raw] of (params.edits as Edit[]).entries()) {
			const error = checkEdit(raw, index);
			if (error) return { ok: false, error };
			const edit: Edit = {};
			if (raw.match?.trim()) edit.match = raw.match.trim();
			if (typeof raw.statementId === "number") edit.statementId = raw.statementId;
			if (raw.content?.trim()) edit.content = raw.content.trim();
			if (Array.isArray(raw.categories)) edit.categories = raw.categories;
			if (raw.timestamp?.trim()) edit.timestamp = raw.timestamp.trim();
			edits.push(edit);
		}
		return { ok: true, mode: "edits", body: { edits }, kind: "edits" };
	}

	// Mode B
	const resolved = buildSelector(params, "all");
	if (!resolved.ok) return resolved;
	if (!setGiven && !replaceGiven) {
		return {
			ok: false,
			error:
				"Mode B needs an operation: give set (addCategories, removeCategories, categories, timestamp) and/or replace ({ pattern, with }) together with the selector.",
		};
	}

	const body: BulkBody = { ...resolved.selector };
	if (setGiven) {
		const set = params.set as NonNullable<Params["set"]>;
		const add = hasItems(set.addCategories) ? set.addCategories : undefined;
		const remove = hasItems(set.removeCategories) ? set.removeCategories : undefined;
		const categories = Array.isArray(set.categories) ? set.categories : undefined;
		const timestamp = set.timestamp?.trim() || undefined;
		if (categories && (add || remove)) {
			return {
				ok: false,
				error:
					"set.categories replaces the whole label list and cannot be combined with set.addCategories or set.removeCategories; use one or the other.",
			};
		}
		if (timestamp && !timestampIsParsable(timestamp)) {
			return { ok: false, error: timestampError("set.timestamp", timestamp) };
		}
		if (!add && !remove && !categories && !timestamp) {
			if (!replaceGiven) {
				return {
					ok: false,
					error:
						"set is empty — give at least one of addCategories, removeCategories, categories, timestamp (or use replace).",
				};
			}
		} else {
			body.set = {
				...(add ? { addCategories: add } : {}),
				...(remove ? { removeCategories: remove } : {}),
				...(categories ? { categories } : {}),
				...(timestamp ? { timestamp } : {}),
			};
		}
	}
	if (replaceGiven) {
		const replace = params.replace as NonNullable<Params["replace"]>;
		if (!replace.pattern || replace.pattern.length === 0) {
			return { ok: false, error: "replace.pattern must not be empty." };
		}
		if (typeof replace.with !== "string") {
			return { ok: false, error: "replace.with must be a string (it may be empty to remove the match)." };
		}
		body.replace = { pattern: replace.pattern, with: replace.with };
	}
	return { ok: true, mode: "bulk", body, kind: resolved.kind };
}

// ---------------------------------------------------------------------------
// App endpoint
// ---------------------------------------------------------------------------

export interface StatementState {
	content?: string;
	categories?: string[];
	timestamp?: string;
}

export interface UpdatedStatement {
	id: number;
	before?: StatementState;
	after?: StatementState;
}

interface UpdateResponse {
	graphName?: string;
	graphUrl?: string;
	matchedCount?: number;
	updatedCount?: number;
	updated?: UpdatedStatement[];
	unchanged?: number;
	unmatched?: unknown[];
	rejected?: { id?: number; reason?: string }[];
	dryRun?: boolean;
	error?: unknown;
}

async function requestUpdate(
	graphName: string,
	body: EditsBody | BulkBody,
	dryRun: boolean,
): Promise<{ ok: true; data: UpdateResponse } | { ok: false; error: string }> {
	try {
		const data = (await makeInfraNodusRequest("/updateStatements", {
			name: graphName,
			...body,
			dryRun,
		})) as unknown as UpdateResponse;
		if (!data || typeof data !== "object") {
			return { ok: false, error: "Unexpected response from /updateStatements." };
		}
		if (data.error) return { ok: false, error: errorText(data.error) };
		return { ok: true, data };
	} catch (error) {
		return { ok: false, error: describeRequestError(error) };
	}
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

type ElicitOutcome =
	| { kind: "accepted" }
	| { kind: "declined" }
	| { kind: "unavailable"; detail: string };

function clip(text: string | undefined): string {
	const oneLine = (text ?? "").replace(/\s+/g, " ").trim();
	return oneLine.length > SAMPLE_LENGTH ? `${oneLine.slice(0, SAMPLE_LENGTH - 1)}…` : oneLine;
}

function describeState(state: StatementState | undefined): string {
	if (!state) return "(unknown)";
	const parts: string[] = [];
	if (typeof state.content === "string") parts.push(`"${clip(state.content)}"`);
	if (state.categories) parts.push(`[${state.categories.join(", ")}]`);
	if (state.timestamp) parts.push(state.timestamp);
	return parts.join(" ") || "(no change shown)";
}

/** One "before → after" line for the elicitation prompt. */
function sampleLine(change: UpdatedStatement, index: number): string {
	return `${index + 1}. ${describeState(change.before)} → ${describeState(change.after)}`;
}

/**
 * Ask the user directly through MCP elicitation. Only an explicit "accept"
 * with the box ticked writes. "decline", or accept with the box unticked,
 * is a real no. A dismissed dialog, a client without the capability, or a
 * transport error is "unavailable": the caller then returns the dry run so
 * the question can be asked in chat. The form's default is NOT to apply.
 */
async function elicitApproval(
	extra: ToolExtra | undefined,
	graphName: string,
	plan: UpdateResponse,
): Promise<ElicitOutcome> {
	if (!extra?.elicit || !extra.clientCapabilities?.elicitation) {
		return { kind: "unavailable", detail: "client does not support elicitation" };
	}
	const matchedCount = plan.matchedCount ?? 0;
	const updatedCount = plan.updatedCount ?? plan.updated?.length ?? matchedCount;
	const sample = (plan.updated ?? []).slice(0, SAMPLE_IN_PROMPT).map(sampleLine);
	const more = updatedCount - sample.length;
	const lines = [
		`Edit ${updatedCount} of the ${matchedCount} matched statement(s) in "${graphName}" in ${brand.name}? The previous text is not kept.`,
		"",
		...sample,
		...(more > 0 ? [`… and ${more} more`] : []),
	];
	try {
		const result = await extra.elicit({
			message: lines.join("\n"),
			requestedSchema: {
				type: "object",
				properties: {
					apply: {
						type: "boolean",
						title: `Apply these ${updatedCount} change(s)`,
						default: false,
					},
				},
				required: ["apply"],
			},
		});
		const content = (result.content ?? {}) as { apply?: unknown };
		if (result.action === "accept") {
			return content.apply === true ? { kind: "accepted" } : { kind: "declined" };
		}
		if (result.action === "decline") return { kind: "declined" };
		return { kind: "unavailable", detail: "the user dismissed the dialog without answering" };
	} catch (error) {
		return {
			kind: "unavailable",
			detail: `elicitation failed: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

/** The optional response parts every result carries when the app sent them. */
function reportParts(data: UpdateResponse) {
	return {
		...(typeof data.unchanged === "number" ? { unchanged: data.unchanged } : {}),
		...(data.unmatched?.length ? { unmatched: data.unmatched } : {}),
		...(data.rejected?.length ? { rejected: data.rejected } : {}),
	};
}

export const updateStatementsTool = {
	name: "update_statements",
	definition: {
		title: `Update Statements in a ${brand.name} Graph`,
		description:
			`Edit statements of a graph in the user's own ${brand.name} account IN PLACE — their content, categories, or timestamp — keeping each statement's id, date and position in the graph (unlike deleting and re-creating it). ` +
			`Two modes, one per call. Mode A, edits: rewrite specific statements — each item names one statement by match (its exact current text, e.g. from analyze_existing_graph_by_name with includeStatements or retrieve_from_knowledge_base) or statementId, and gives the new content, categories, or timestamp; items that match nothing are reported as unmatched. Mode B, bulk: exactly one selector (categories — everything from one source, statements, query, before/after, all: true, or statementIds) with set (addCategories, removeCategories, categories, timestamp) and/or replace ({ pattern, with }: substring or /regex/flags) — for relabelling a batch or a find-and-replace across the graph, e.g. renaming a [[concept]] or a source path everywhere. ` +
			`New content must be at most ${MAX_CONTENT_LENGTH} characters; for longer text use delete_statements and then create_knowledge_graph. ` +
			`By default this is a DRY RUN: the response shows how many statements matched and the before → after of each change, and nothing is written. Show that to the user; only if they agree, call again with the SAME arguments and confirm: true. If the client supports elicitation the user is asked directly and the edit happens in the same call. A request that matches nothing returns updated: 0 without asking. ` +
			`IRREVERSIBLE once confirmed: the previous text survives only in the dry-run output. Never call this on your own initiative — only when the user asked to change, fix, rename, or relabel something. The graph must already exist in the user's account (there is no userName parameter; other users' graphs cannot be targeted) and this tool never creates one.`,
		inputSchema: UpdateStatementsSchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: true,
			destructiveHint: true,
			openWorldHint: false,
		},
	},
	handler: async (params: Params, extra?: ToolExtra) => {
		try {
			// 1. Exactly one mode, well-formed — no network until this holds.
			const resolved = buildUpdate(params);
			if (!resolved.ok) return textResult({ error: resolved.error }, true);
			const { mode, body, kind } = resolved;
			const graphName = params.graphName.trim();

			// 2. The graph must exist in this account. Never create.
			const graph = await findGraphByName(graphName);
			if (!graph) {
				return textResult(
					{
						error: `No graph named "${graphName}" in this ${brand.name} account. Nothing was changed. Use list_graphs to check the exact name; this tool never creates graphs.`,
					},
					true,
				);
			}

			// 3. Preview with the same body that the write will use.
			const preview = await requestUpdate(graphName, body, true);
			if (!preview.ok) {
				return textResult({ error: `Dry run failed — nothing was changed. ${preview.error}` }, true);
			}
			const plan = preview.data;
			const matchedCount = plan.matchedCount ?? 0;
			const plannedCount = plan.updatedCount ?? plan.updated?.length ?? 0;
			const graphUrl = plan.graphUrl ?? graph.defaultRevisionUrl ?? undefined;

			if (matchedCount === 0) {
				return textResult({
					updated: 0,
					matchedCount: 0,
					graphName,
					...(graphUrl ? { graphUrl } : {}),
					mode,
					filter: body,
					...reportParts(plan),
					message: "Nothing matched — no update performed.",
				});
			}

			// 4. Consent: confirm: true from the caller, or an accepted form.
			let approved = params.confirm === true;
			let elicitationDetail: string | undefined;
			if (!approved) {
				const answer = await elicitApproval(extra, graphName, plan);
				if (answer.kind === "accepted") {
					approved = true;
				} else if (answer.kind === "declined") {
					return textResult({
						updated: 0,
						declined: true,
						matchedCount,
						graphName,
						message: "The user declined the update. Nothing was changed. Do not retry.",
					});
				} else {
					elicitationDetail = answer.detail;
				}
			}

			if (!approved) {
				const changes = plan.updated ?? [];
				return textResult({
					updated: 0,
					dryRun: true,
					matchedCount,
					updatedCount: plannedCount,
					changesShown: Math.min(changes.length, CHANGES_SHOWN),
					changes: changes.slice(0, CHANGES_SHOWN),
					...reportParts(plan),
					graphName,
					...(graphUrl ? { graphUrl } : {}),
					mode,
					selector: kind,
					filter: body,
					...(elicitationDetail ? { elicitation: elicitationDetail } : {}),
					nextStep:
						"Nothing was changed. Show these to the user; if they agree, call update_statements again with the SAME arguments and confirm: true.",
				});
			}

			// 5. Write with the identical body.
			const write = await requestUpdate(graphName, body, false);
			if (!write.ok) {
				return textResult({ error: `Update failed. ${write.error}` }, true);
			}
			const result = write.data;
			const updated = result.updatedCount ?? result.updated?.length ?? 0;
			const changes = result.updated ?? [];
			return textResult({
				updated,
				changesShown: Math.min(changes.length, CHANGES_SHOWN),
				changes: changes.slice(0, CHANGES_SHOWN),
				...reportParts(result),
				graphName: result.graphName ?? graphName,
				...(result.graphUrl ?? graphUrl ? { graphUrl: result.graphUrl ?? graphUrl } : {}),
				...(updated !== plannedCount
					? {
							note: `The dry run would have updated ${plannedCount} statement(s) but ${updated} were updated — the graph changed between preview and write.`,
						}
					: {}),
			});
		} catch (error) {
			return textResult(
				{ error: error instanceof Error ? error.message : String(error) },
				true,
			);
		}
	},
};
