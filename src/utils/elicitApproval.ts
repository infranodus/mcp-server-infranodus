import { EmptyResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ToolExtra } from "../types/index.js";

/** How long the client gets to answer a ping before it counts as unreachable for a dialog. */
export const CLIENT_REACHABLE_TIMEOUT_MS = 3_000;
/**
 * How long the user gets to answer the dialog. Clients give up on a tool call
 * after about a minute (the claude.ai connector at 60 s), and the dry-run
 * plan has to get back to them before that.
 */
export const ELICIT_ANSWER_TIMEOUT_MS = 45_000;

/** The two calls of the SDK's Server that asking the user needs. */
interface DialogServer {
	request(request: { method: "ping" }, resultSchema: any, options?: any): Promise<unknown>;
	elicitInput(params: any, options?: any): Promise<any>;
}

/**
 * Send an elicitation to the client on the stream of the tool call that asks
 * for it (`requestId`), after checking the client answers on that stream.
 *
 * Over Streamable HTTP a request from the server that is not tied to a call
 * goes to the client's standalone GET stream. A client that never opens one
 * (claude.ai connectors do not) can still declare the elicitation capability:
 * the SDK then drops the request without an error and waits its default 60 s,
 * which is as long as such clients wait for the tool result, so the call
 * failed with a timeout. Tied to the call, the request travels on the
 * response stream of the tool call itself.
 *
 * The ping settles in a few seconds whether requests from the server reach
 * this client at all; a human answering a dialog needs longer than that, and
 * without the check an unreachable client would cost the whole answer time on
 * every dry run. Throws when the client cannot be reached or does not answer
 * in time; the caller treats that as "ask in chat instead".
 */
export async function elicitOnCallStream(
	server: DialogServer,
	requestId: string | number | undefined,
	params: any,
	timeouts: { reachableMs?: number; answerMs?: number } = {},
): Promise<any> {
	const onCallStream = requestId === undefined ? {} : { relatedRequestId: requestId };
	try {
		await server.request({ method: "ping" }, EmptyResultSchema, {
			...onCallStream,
			timeout: timeouts.reachableMs ?? CLIENT_REACHABLE_TIMEOUT_MS,
		});
	} catch {
		throw new Error("the client did not answer a request from the server");
	}
	return server.elicitInput(params, {
		...onCallStream,
		timeout: timeouts.answerMs ?? ELICIT_ANSWER_TIMEOUT_MS,
	});
}

export type ElicitOutcome =
	| { kind: "accepted"; save: boolean; note?: string }
	| { kind: "declined"; note?: string }
	| { kind: "unavailable"; detail: string };

/**
 * Ask the user directly through MCP elicitation whether to save a batch.
 * Only an explicit answer counts: "accept" carries the form values,
 * "decline" is a real no. A dismissed dialog ("cancel"), a client without
 * the capability, or any transport error is "unavailable" — the caller then
 * returns the dry-run plan so the question can be asked in chat instead.
 * Nothing is ever written by default.
 */
export async function elicitApproval(
	extra: ToolExtra | undefined,
	message: string,
	title: string,
): Promise<ElicitOutcome> {
	if (!extra?.elicit || !extra.clientCapabilities?.elicitation) {
		return { kind: "unavailable", detail: "client does not support elicitation" };
	}
	try {
		const result = await extra.elicit({
			message,
			requestedSchema: {
				type: "object",
				properties: {
					save: { type: "boolean", title, default: true },
					note: { type: "string", title: "Anything to change? (optional)" },
				},
				required: ["save"],
			},
		});
		const content = (result.content ?? {}) as { save?: unknown; note?: unknown };
		const note =
			typeof content.note === "string" && content.note.trim()
				? content.note.trim()
				: undefined;
		if (result.action === "accept") {
			return { kind: "accepted", save: content.save === true, ...(note ? { note } : {}) };
		}
		if (result.action === "decline") return { kind: "declined", ...(note ? { note } : {}) };
		return { kind: "unavailable", detail: "the user dismissed the dialog without answering" };
	} catch (error) {
		return {
			kind: "unavailable",
			detail: `elicitation failed: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

interface PlanItem {
	statement: string;
	type?: string;
	status?: string;
}

/**
 * The dry-run → ask → write cycle shared by add_project_learnings and
 * memory_add_relations (scope mode). `write(confirm)` calls the app endpoint;
 * the first call without confirm returns the plan (`wouldWrite`). When the
 * user approves through elicitation, the same request is sent again with
 * confirm: true. Returns the response to hand back plus any fields to add.
 */
export async function dryRunAskWrite(
	write: (confirm: boolean) => Promise<{ status: number; body: Record<string, any> }>,
	options: {
		confirm: boolean;
		extra?: ToolExtra;
		question: (graphName: string, count: number) => string;
		saveTitle: string;
		noun: string;
	},
): Promise<{ status: number; body: Record<string, any> }> {
	if (options.confirm) return write(true);

	const plan = await write(false);
	const items: PlanItem[] = Array.isArray(plan.body.wouldWrite) ? plan.body.wouldWrite : [];
	if (plan.status >= 400 || !plan.body.dryRun || items.length === 0) return plan;

	const lines = items.map(
		(item, index) =>
			`${index + 1}. [${[item.type, item.status === "reinforced" ? `reinforces an existing ${options.noun}` : null]
				.filter(Boolean)
				.join(", ") || "new"}] ${item.statement}`,
	);
	const answer = await elicitApproval(
		options.extra,
		`${options.question(plan.body.graphName, items.length)}\n\n${lines.join("\n")}`,
		options.saveTitle,
	);

	if (answer.kind === "unavailable") {
		return { ...plan, body: { ...plan.body, elicitation: answer.detail } };
	}
	if (answer.kind === "accepted" && answer.save) return write(true);

	const note = answer.note;
	return {
		status: 200,
		body: {
			enabled: true,
			written: 0,
			declined: true,
			graphName: plan.body.graphName,
			...(note ? { note } : {}),
			message:
				answer.kind === "accepted" && note
					? `The user did not save these as-is and left a note. Adjust the ${options.noun}s accordingly and, if appropriate, try once more.`
					: answer.kind === "accepted"
						? `The user chose not to save these ${options.noun}s. Do not retry.`
						: `The user declined to save these ${options.noun}s. Do not retry.`,
		},
	};
}
