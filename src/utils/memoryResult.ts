/**
 * Tool results for the memory tools, which pass the app's /learnings/* and
 * /memory/* answers through as they are. A 4xx answer (validation, 422
 * redaction, 403) is still returned as its payload, flagged as an error.
 */
export function memoryResult(
	outcome: { status: number; body: Record<string, unknown> } | unknown,
	extra: Record<string, unknown> = {},
) {
	if (outcome instanceof Error || !isResponse(outcome)) {
		const message =
			outcome instanceof Error ? outcome.message : String(outcome);
		return textResult({ error: message }, true);
	}
	return textResult({ ...outcome.body, ...extra }, outcome.status >= 400);
}

export function textResult(payload: unknown, isError = false) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify(payload, null, 2) },
		],
		...(isError ? { isError: true } : {}),
	};
}

function isResponse(
	value: unknown,
): value is { status: number; body: Record<string, unknown> } {
	return (
		!!value &&
		typeof value === "object" &&
		typeof (value as { status?: unknown }).status === "number" &&
		!!(value as { body?: unknown }).body
	);
}
