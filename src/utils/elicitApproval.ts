import type { ToolExtra } from "../types/index.js";

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
