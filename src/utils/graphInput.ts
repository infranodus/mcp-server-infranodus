import { fetchUrlContentAsText } from "./urlContent.js";
import {
	prepareStatementsPayload,
	prepareWikilinksPayload,
	statementsContextSettings,
	type WikilinksMode,
	type WikilinksPayload,
} from "./wikilinksMode.js";

export interface GraphInputParams {
	text?: string;
	url?: string;
	statements?: string[];
	categories?: string[][];
	timestamps?: string[];
	wikilinksMode?: WikilinksMode;
}

export type GraphInputResult =
	| { ok: true; payload: WikilinksPayload & { text: string } }
	| { ok: false; error: string };

// ISO 8601 only, deliberately. The API's convertAnyDate() reorders D/M/Y and
// M/D/Y only when one component exceeds 12, so "03.05.2026" meant as 3 May is
// stored as 5 March — silent, plausible, wrong. And what it cannot read at all
// it returns false for, which becomes 1970-01-01 downstream. Neither failure is
// visible to the caller, so anything ambiguous is refused here instead.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function timestampIsParsable(value: string): boolean {
	const trimmed = value.trim();
	return ISO_DATE.test(trimmed) && Number.isFinite(Date.parse(trimmed));
}

/**
 * Validate a caller-supplied statements array and its parallel metadata.
 * Returns null when valid, otherwise the error message to hand back.
 */
export function validateStatementsInput(
	statements: string[],
	categories?: string[][],
	timestamps?: string[],
): string | null {
	if (statements.length === 0) return "statements must not be an empty array";
	if (statements.some((statement) => !statement?.trim()))
		return "statements must not contain empty entries — drop them (and their categories / timestamps entry) before sending";
	// Empty metadata arrays mean "none provided" — only enforce the per-statement
	// pairing when there is actual metadata to pair
	if (categories && categories.length > 0 && categories.length !== statements.length)
		return `categories must have exactly one entry per statement (got ${categories.length} categories for ${statements.length} statements); use an empty array for statements without metadata`;
	if (timestamps && timestamps.length > 0) {
		if (timestamps.length !== statements.length)
			return `timestamps must have exactly one entry per statement (got ${timestamps.length} timestamps for ${statements.length} statements); use an empty string for statements without a date`;
		const bad = timestamps.find(
			(timestamp) => timestamp?.trim() && !timestampIsParsable(timestamp),
		);
		if (bad)
			return `timestamp "${bad}" is not ISO 8601 — use 2026-08-02 or 2026-08-02T14:30:00Z. Day-first and month-first formats are refused because the API cannot tell them apart below the 13th of the month.`;
	}
	return null;
}

/**
 * Resolve the mutually exclusive content inputs (text / url / statements) into
 * the body fields of a graph request. `statements` skips the text-splitting
 * path entirely and carries optional parallel `categories` (metadata labels)
 * and `timestamps` (dates) arrays, one entry per statement.
 */
export async function resolveGraphInput(
	params: GraphInputParams,
): Promise<GraphInputResult> {
	const { statements, categories, timestamps, wikilinksMode } = params;
	const hasText = Boolean(params.text?.trim());
	const hasUrl = Boolean(params.url);

	if (statements && statements.length > 0) {
		if (hasText || hasUrl) {
			return {
				ok: false,
				error:
					"Provide only one of: statements, text, or url — not statements together with text/url",
			};
		}
		const invalid = validateStatementsInput(statements, categories, timestamps);
		if (invalid) return { ok: false, error: invalid };
		return {
			ok: true,
			payload: prepareStatementsPayload(
				statements,
				categories,
				wikilinksMode,
				timestamps,
			) as WikilinksPayload & { text: string },
		};
	}

	let contentText: string;
	if (hasUrl) {
		const result = await fetchUrlContentAsText(params.url as string);
		if (!result.ok) return { ok: false, error: result.error };
		contentText = result.contentText;
		if (!contentText?.trim())
			return { ok: false, error: "URL did not return any text content" };
	} else if (hasText) {
		contentText = params.text as string;
	} else {
		return {
			ok: false,
			error: "Provide one of: text, url, or statements for analysis",
		};
	}

	return {
		ok: true,
		payload: {
			text: contentText,
			...prepareWikilinksPayload(contentText, wikilinksMode),
		},
	};
}

export type ContextItem =
	| { text: string }
	| { url: string }
	| { graphName: string }
	| { statements: string[]; categories?: string[][]; timestamps?: string[] };

type ResolvedItem =
	| { text: string }
	| { statements: string[]; categories?: string[][]; timestamps?: string[] };

export type ResolvedContexts =
	| {
			ok: true;
			contexts: Array<Record<string, unknown>>;
			contextSettings?: Record<string, unknown>;
	  }
	| { ok: false; error: string };

/**
 * Resolve the `contexts` array of the multi-graph comparison tools into the
 * items of a /graphsAndStatements body.
 *
 * Statements are only read when EVERY context has them (routes/graphs.js:
 * `contexts.every(context => context.statements)`), so a statements item in a
 * mixed array is joined into text — what url and graphName items resolve to
 * anyway, and its categories and timestamps are dropped with it.
 *
 * Naming is the app's job: getContextForEntry (lib/context.js) gives every
 * unnamed statements context a uuid fragment, because upstream creates the
 * context by name. Sending statements to an app that predates that fix hangs
 * for two minutes and returns 504, as does sending timestamps to one that
 * predates the missing-`Instruments`-require fix in routes/graphs.js.
 */
export async function resolveContexts(
	items: ContextItem[],
	fetchGraphTextByName: (
		graphName: string,
	) => Promise<{ ok: true; text: string } | { ok: false; error: string }>,
): Promise<ResolvedContexts> {
	const resolved: ResolvedItem[] = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if ("statements" in item) {
			const invalid = validateStatementsInput(
				item.statements,
				item.categories,
				item.timestamps,
			);
			if (invalid)
				return { ok: false, error: `Context at index ${i}: ${invalid}` };
			resolved.push({
				statements: item.statements,
				...(item.categories?.length ? { categories: item.categories } : {}),
				...(item.timestamps?.length ? { timestamps: item.timestamps } : {}),
			});
			continue;
		}
		if ("text" in item) {
			if (!item.text.trim())
				return { ok: false, error: `Context at index ${i} has empty text.` };
			resolved.push({ text: item.text });
			continue;
		}
		if ("url" in item) {
			const result = await fetchUrlContentAsText(item.url);
			if (!result.ok)
				return {
					ok: false,
					error: `URL at context index ${i} failed: ${result.error}`,
				};
			if (!result.contentText?.trim())
				return {
					ok: false,
					error: `URL at context index ${i} did not return any text content`,
				};
			resolved.push({ text: result.contentText });
			continue;
		}
		if ("graphName" in item) {
			const result = await fetchGraphTextByName(item.graphName);
			if (!result.ok)
				return {
					ok: false,
					error: `Graph at context index ${i} failed: ${result.error}`,
				};
			resolved.push({ text: result.text });
			continue;
		}
		return {
			ok: false,
			error: `Context at index ${i} must be { text }, { statements }, { url }, or { graphName }.`,
		};
	}

	if (!resolved.every((item) => "statements" in item)) {
		return {
			ok: true,
			contexts: resolved.map((item) =>
				"statements" in item ? { text: item.statements.join("\n") } : item,
			),
		};
	}

	const hasCategories = resolved.some(
		(item) =>
			"categories" in item &&
			(item.categories ?? []).some((entry) => entry.length > 0),
	);
	const contextSettings = statementsContextSettings(undefined, hasCategories);
	return {
		ok: true,
		contexts: resolved as Array<Record<string, unknown>>,
		...(Object.keys(contextSettings).length > 0 ? { contextSettings } : {}),
	};
}
