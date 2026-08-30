/**
 * delete_statements — remove statements from a graph in the caller's own
 * account by a filter the app resolves (see docs/drafts/delete-statements-tool.md).
 *
 * The first destructive tool in this server. Its safety comes from the
 * shape of the call, not from trust in the model: exactly one selector, the
 * graph must already exist, a dry run is the default, and the write only
 * happens with `confirm: true` or an elicitation form the user accepts.
 * The same filter is sent for the preview and for the write, so what the
 * user approved is what gets removed.
 */
import { z } from "zod";
import { brand } from "../config/brand.js";
import { DeleteStatementsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { errorText, findGraphByName } from "../utils/graphLookup.js";
import { timestampIsParsable } from "../utils/graphInput.js";
import type { ToolExtra } from "../types/index.js";

type Params = z.infer<typeof DeleteStatementsSchema>;

function textResult(payload: unknown, isError = false) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify(payload, null, 2) },
		],
		...(isError ? { isError: true } : {}),
	};
}

/** How many matched statements the dry run echoes back to the model. */
export const MATCHED_SHOWN = 50;
/** How many matched statements the elicitation prompt quotes. */
const SAMPLE_IN_PROMPT = 5;
const SAMPLE_LENGTH = 160;

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

/** The filter part of the /deleteStatements body (everything but name/dryRun). */
export type Selector =
	| { categories: string[] }
	| { statements: string[] }
	| { query: string }
	| { before?: string; after?: string }
	| { all: true }
	| { statementIds: number[] };

export type SelectorResult =
	| { ok: true; selector: Selector; kind: string }
	| { ok: false; error: string };

/** The selector fields shared by delete_statements and update_statements. */
export interface SelectorParams {
	categories?: string[];
	statements?: string[];
	query?: string;
	before?: string;
	after?: string;
	deleteAll?: boolean;
	all?: boolean;
	statementIds?: number[];
}

/**
 * Resolve exactly one selector from the parameters. Empty arrays, blank
 * strings and `deleteAll: false` count as "not given". `before` and `after`
 * are one selector together (a time window). Pure; no network.
 *
 * `allField` names the whole-graph flag: `deleteAll` for delete_statements,
 * `all` for update_statements (both are sent to the app as `all: true`).
 */
export function buildSelector(
	params: SelectorParams,
	allField: "deleteAll" | "all" = "deleteAll",
): SelectorResult {
	const given: { kind: string; selector: Selector }[] = [];

	if (Array.isArray(params.categories) && params.categories.length > 0) {
		given.push({ kind: "categories", selector: { categories: params.categories } });
	}
	if (Array.isArray(params.statements) && params.statements.length > 0) {
		given.push({ kind: "statements", selector: { statements: params.statements } });
	}
	const query = params.query?.trim();
	if (query) given.push({ kind: "query", selector: { query } });

	const before = params.before?.trim();
	const after = params.after?.trim();
	if (before || after) {
		for (const [label, value] of [
			["before", before],
			["after", after],
		] as const) {
			if (value && !timestampIsParsable(value)) {
				return {
					ok: false,
					error: `${label} must be an ISO 8601 date or datetime (e.g. 2026-08-01 or 2026-08-01T12:00:00Z); got "${value}". Ambiguous formats such as 03.05.2026 are refused because the server could misread the month and day.`,
				};
			}
		}
		given.push({
			kind: before && after ? "before/after" : before ? "before" : "after",
			selector: { ...(before ? { before } : {}), ...(after ? { after } : {}) },
		});
	}
	if (params[allField] === true) given.push({ kind: allField, selector: { all: true } });
	if (Array.isArray(params.statementIds) && params.statementIds.length > 0) {
		given.push({ kind: "statementIds", selector: { statementIds: params.statementIds } });
	}

	if (given.length === 0) {
		return {
			ok: false,
			error:
				`No selector given. Provide exactly one of: categories, statements, query, before/after, ${allField}: true, or statementIds.`,
		};
	}
	if (given.length > 1) {
		return {
			ok: false,
			error: `Exactly one selector per call; got ${given.map((g) => g.kind).join(" and ")}. Split the ${allField === "all" ? "update" : "deletion"} into separate calls.`,
		};
	}
	return { ok: true, selector: given[0].selector, kind: given[0].kind };
}

// ---------------------------------------------------------------------------
// App endpoint
// ---------------------------------------------------------------------------

export interface MatchedStatement {
	id: number;
	content: string;
	categories?: string[];
	timestamp?: string;
}

interface DeleteResponse {
	graphName?: string;
	graphUrl?: string;
	matchedCount?: number;
	matched?: MatchedStatement[];
	matchedByCategory?: Record<string, number>;
	removedIds?: number[];
	removedCount?: number;
	ignoredIds?: number[];
	remaining?: number;
	dryRun?: boolean;
	error?: unknown;
}

/**
 * makeInfraNodusRequest throws `API request failed (status): body` on a
 * non-2xx; the body is `{ error }`. Turn that into one readable line, with
 * the status-specific meaning the model needs to act on it. Shared with
 * update_statements, whose endpoint answers the same status codes.
 */
export function describeRequestError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	const match = /^API request failed \((\d+)\): ([\s\S]*)$/.exec(message);
	if (!match) return message;
	const status = Number(match[1]);
	let detail = match[2].trim();
	try {
		const parsed = JSON.parse(detail) as { error?: unknown; message?: unknown };
		detail = errorText(parsed.error ?? parsed.message ?? parsed);
	} catch {
		// plain-text body; keep as is
	}
	const hint =
		status === 400
			? "The request was rejected."
			: status === 403
				? "The graph is not in this account (or the request was anonymous); only your own graphs can be edited."
				: status === 404
					? "The graph was not found in this account."
					: "";
	return [`${status}: ${detail}`, hint].filter(Boolean).join(" ");
}

async function requestDeletion(
	graphName: string,
	selector: Selector,
	dryRun: boolean,
): Promise<{ ok: true; data: DeleteResponse } | { ok: false; error: string }> {
	try {
		const data = (await makeInfraNodusRequest("/deleteStatements", {
			name: graphName,
			...selector,
			dryRun,
		})) as unknown as DeleteResponse;
		if (!data || typeof data !== "object") {
			return { ok: false, error: "Unexpected response from /deleteStatements." };
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

function sampleLine(statement: MatchedStatement, index: number): string {
	const content = (statement.content ?? "").replace(/\s+/g, " ").trim();
	const shown =
		content.length > SAMPLE_LENGTH ? `${content.slice(0, SAMPLE_LENGTH - 1)}…` : content;
	const labels = statement.categories?.length
		? ` [${statement.categories.join(", ")}]`
		: "";
	return `${index + 1}. ${shown}${labels}`;
}

/**
 * Ask the user directly through MCP elicitation. The dialog is a plain
 * Accept / Decline: the spec defines "accept" as the user's explicit
 * approval, so no extra checkbox is asked for (a checkbox defaulting to
 * false made a plain Accept read as a decline in Claude Code). "decline"
 * is a real no. A dismissed dialog, a client without the capability, or a
 * transport error is "unavailable": the caller then returns the dry run so
 * the question can be asked in chat.
 */
async function elicitApproval(
	extra: ToolExtra | undefined,
	graphName: string,
	plan: DeleteResponse,
): Promise<ElicitOutcome> {
	if (!extra?.elicit || !extra.clientCapabilities?.elicitation) {
		return { kind: "unavailable", detail: "client does not support elicitation" };
	}
	const matchedCount = plan.matchedCount ?? 0;
	const sample = (plan.matched ?? []).slice(0, SAMPLE_IN_PROMPT).map(sampleLine);
	const more = matchedCount - sample.length;
	const lines = [
		`Permanently delete ${matchedCount} statement(s) from "${graphName}" in ${brand.name}? This cannot be undone.`,
		"",
		...sample,
		...(more > 0 ? [`… and ${more} more`] : []),
	];
	try {
		const result = await extra.elicit({
			message: lines.join("\n"),
			requestedSchema: { type: "object", properties: {} },
		});
		if (result.action === "accept") return { kind: "accepted" };
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

export const deleteStatementsTool = {
	name: "delete_statements",
	definition: {
		title: `Delete Statements from a ${brand.name} Graph`,
		description:
			`Delete statements from a graph in the user's own ${brand.name} account, selected by a filter the server resolves. IRREVERSIBLE once confirmed: deleted statements cannot be recovered. ` +
			`Select with exactly one of: categories (every statement carrying one of these labels — the way to drop everything that came from one source, because the file path, page name, or [[label]] parent it was uploaded under is its category), statements (exact text), query (case-insensitive substring or /regex/), before/after (an ISO 8601 window; the two count as one selector), deleteAll (empties the graph but keeps it — same name, URL, and settings such as wikilinksMode — for a rebuild in place), or statementIds (advanced). ` +
			`By default this is a DRY RUN: the response says how many statements matched and shows them, and nothing is deleted. Show that to the user; only if they agree, call again with the SAME filter and confirm: true. If the client supports elicitation the user is asked directly and the deletion happens in the same call. A filter that matches nothing returns deleted: 0 without asking. ` +
			`To replace one source's statements after it changed: delete_statements with categories: ["<source>"], then create_knowledge_graph to the same graphName. To rebuild a whole graph in place: deleteAll, then create_knowledge_graph to the same graphName. ` +
			`Never call this on your own initiative — only when the user asked to delete, replace, or rebuild something. The graph must already exist in the user's account (there is no userName parameter; other users' graphs cannot be targeted) and this tool never creates one.`,
		inputSchema: DeleteStatementsSchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: true,
			openWorldHint: false,
		},
	},
	handler: async (params: Params, extra?: ToolExtra) => {
		try {
			// 1. Exactly one selector — no network until this holds.
			const resolved = buildSelector(params);
			if (!resolved.ok) return textResult({ error: resolved.error }, true);
			const { selector, kind } = resolved;
			const graphName = params.graphName.trim();

			// 2. The graph must exist in this account. Never create.
			const graph = await findGraphByName(graphName);
			if (!graph) {
				return textResult(
					{
						error: `No graph named "${graphName}" in this ${brand.name} account. Nothing was deleted. Use list_graphs to check the exact name; this tool never creates graphs.`,
					},
					true,
				);
			}

			// 3. Preview with the same filter that the write will use.
			const preview = await requestDeletion(graphName, selector, true);
			if (!preview.ok) {
				return textResult({ error: `Dry run failed — nothing was deleted. ${preview.error}` }, true);
			}
			const plan = preview.data;
			const matchedCount = plan.matchedCount ?? plan.matched?.length ?? 0;
			const graphUrl = plan.graphUrl ?? graph.defaultRevisionUrl ?? undefined;

			if (matchedCount === 0) {
				return textResult({
					deleted: 0,
					matchedCount: 0,
					graphName,
					...(graphUrl ? { graphUrl } : {}),
					filter: selector,
					message: "Nothing matched — no deletion performed.",
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
						deleted: 0,
						declined: true,
						matchedCount,
						graphName,
						message: "The user declined the deletion. Nothing was deleted. Do not retry.",
					});
				} else {
					elicitationDetail = answer.detail;
				}
			}

			if (!approved) {
				const matched = plan.matched ?? [];
				return textResult({
					deleted: 0,
					dryRun: true,
					matchedCount,
					matchedShown: Math.min(matched.length, MATCHED_SHOWN),
					matched: matched.slice(0, MATCHED_SHOWN),
					...(plan.matchedByCategory ? { matchedByCategory: plan.matchedByCategory } : {}),
					graphName,
					...(graphUrl ? { graphUrl } : {}),
					selector: kind,
					filter: selector,
					...(elicitationDetail ? { elicitation: elicitationDetail } : {}),
					nextStep:
						"Nothing was deleted. Show these to the user; if they agree, call delete_statements again with the SAME filter and confirm: true.",
				});
			}

			// 5. Write with the identical filter.
			const write = await requestDeletion(graphName, selector, false);
			if (!write.ok) {
				return textResult({ error: `Deletion failed. ${write.error}` }, true);
			}
			const result = write.data;
			const deleted = result.removedCount ?? result.removedIds?.length ?? 0;
			return textResult({
				deleted,
				removedIds: result.removedIds ?? [],
				...(result.ignoredIds?.length ? { ignoredIds: result.ignoredIds } : {}),
				...(typeof result.remaining === "number" ? { remaining: result.remaining } : {}),
				graphName: result.graphName ?? graphName,
				...(result.graphUrl ?? graphUrl ? { graphUrl: result.graphUrl ?? graphUrl } : {}),
				...(deleted !== matchedCount
					? {
							note: `The dry run matched ${matchedCount} statement(s) but ${deleted} were removed — the graph changed between preview and deletion.`,
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
