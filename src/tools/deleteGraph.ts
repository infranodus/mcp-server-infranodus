/**
 * delete_graph — remove one graph from the caller's own account entirely:
 * statements, revisions, settings, and URL. The companion of
 * delete_statements (which keeps the graph) for the case where the graph
 * itself should go.
 *
 * Same safety shape: the graph must exist in this account, a dry run is
 * the default, and the write only happens with `confirm: true` or an
 * elicitation form the user accepts. Ownership is enforced by the app
 * (the graph is resolved from the API key's own contexts list; userName
 * is refused) and again by the backend, which scopes the delete to the
 * same user.
 */
import { z } from "zod";
import { brand } from "../config/brand.js";
import { DeleteGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { errorText, findGraphByName } from "../utils/graphLookup.js";
import { describeRequestError } from "./deleteStatements.js";
import type { ToolExtra } from "../types/index.js";

type Params = z.infer<typeof DeleteGraphSchema>;

function textResult(payload: unknown, isError = false) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify(payload, null, 2) },
		],
		...(isError ? { isError: true } : {}),
	};
}

interface DeleteGraphResponse {
	graphName?: string;
	graphUrl?: string;
	isLive?: boolean;
	deleted?: boolean;
	dryRun?: boolean;
	error?: unknown;
}

async function requestGraphDeletion(
	graphName: string,
	dryRun: boolean,
): Promise<{ ok: true; data: DeleteGraphResponse } | { ok: false; error: string }> {
	try {
		const data = (await makeInfraNodusRequest("/deleteGraph", {
			name: graphName,
			dryRun,
		})) as unknown as DeleteGraphResponse;
		if (!data || typeof data !== "object") {
			return { ok: false, error: "Unexpected response from /deleteGraph." };
		}
		if (data.error) return { ok: false, error: errorText(data.error) };
		return { ok: true, data };
	} catch (error) {
		return { ok: false, error: describeRequestError(error) };
	}
}

type ElicitOutcome =
	| { kind: "accepted" }
	| { kind: "declined" }
	| { kind: "unavailable"; detail: string };

/**
 * Ask the user directly through MCP elicitation: a plain Accept / Decline
 * (the spec defines "accept" as explicit approval; no extra form field, see
 * delete_statements). A dismissed dialog or a client without the capability
 * is "unavailable": the caller then returns the dry run so the question can
 * be asked in chat.
 */
async function elicitApproval(
	extra: ToolExtra | undefined,
	graphName: string,
	plan: DeleteGraphResponse,
): Promise<ElicitOutcome> {
	if (!extra?.elicit || !extra.clientCapabilities?.elicitation) {
		return { kind: "unavailable", detail: "client does not support elicitation" };
	}
	const lines = [
		`Permanently delete the graph "${graphName}" from ${brand.name}, with all of its statements? This cannot be undone.`,
		...(plan.isLive ? ["It is a live graph: its scheduled imports will stop."] : []),
		...(plan.graphUrl ? ["", plan.graphUrl] : []),
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

export const deleteGraphTool = {
	name: "delete_graph",
	definition: {
		title: `Delete a ${brand.name} Graph`,
		description:
			`Delete one graph from the user's own ${brand.name} account entirely — all of its statements, revisions, settings, and its URL; the name becomes free again. IRREVERSIBLE once confirmed. ` +
			`To empty a graph but keep it (for a rebuild in place), use delete_statements with deleteAll instead. ` +
			`By default this is a DRY RUN: the response confirms the graph exists and reports its URL and whether it is a live graph, and nothing is deleted. Show that to the user; only if they agree, call again with the SAME graphName and confirm: true. If the client supports elicitation the user is asked directly and the deletion happens in the same call. ` +
			`Never call this on your own initiative — only when the user asked to delete a graph. Only graphs in the user's own account can be targeted (there is no userName parameter); a name that is not in the account is an error and nothing is deleted.`,
		inputSchema: DeleteGraphSchema.shape,
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		},
	},
	handler: async (params: Params, extra?: ToolExtra) => {
		try {
			const graphName = params.graphName.trim();

			// 1. The graph must exist in this account.
			const graph = await findGraphByName(graphName);
			if (!graph) {
				return textResult(
					{
						error: `No graph named "${graphName}" in this ${brand.name} account. Nothing was deleted. Use list_graphs to check the exact name.`,
					},
					true,
				);
			}

			// 2. Preview: the app resolves the same graph it will delete.
			const preview = await requestGraphDeletion(graphName, true);
			if (!preview.ok) {
				return textResult({ error: `Dry run failed — nothing was deleted. ${preview.error}` }, true);
			}
			const plan = preview.data;
			const graphUrl = plan.graphUrl ?? graph.defaultRevisionUrl ?? undefined;

			// 3. Consent: confirm: true from the caller, or an accepted form.
			let approved = params.confirm === true;
			let elicitationDetail: string | undefined;
			if (!approved) {
				const answer = await elicitApproval(extra, graphName, plan);
				if (answer.kind === "accepted") {
					approved = true;
				} else if (answer.kind === "declined") {
					return textResult({
						deleted: false,
						declined: true,
						graphName,
						message: "The user declined the deletion. Nothing was deleted. Do not retry.",
					});
				} else {
					elicitationDetail = answer.detail;
				}
			}

			if (!approved) {
				return textResult({
					deleted: false,
					dryRun: true,
					graphName,
					...(graphUrl ? { graphUrl } : {}),
					isLive: plan.isLive === true,
					...(elicitationDetail ? { elicitation: elicitationDetail } : {}),
					nextStep:
						"Nothing was deleted. Ask the user to confirm; if they agree, call delete_graph again with the SAME graphName and confirm: true.",
				});
			}

			// 4. Delete.
			const write = await requestGraphDeletion(graphName, false);
			if (!write.ok) {
				return textResult({ error: `Deletion failed. ${write.error}` }, true);
			}
			return textResult({
				deleted: write.data.deleted === true,
				graphName: write.data.graphName ?? graphName,
				message: `The graph "${graphName}" and all of its statements were deleted.`,
			});
		} catch (error) {
			return textResult(
				{ error: error instanceof Error ? error.message : String(error) },
				true,
			);
		}
	},
};
