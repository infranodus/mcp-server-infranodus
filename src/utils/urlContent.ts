import { makeInfraNodusRequest } from "../api/client.js";

/** Parsed result from /convert/url */
export interface UrlConvertResult {
	url: string;
	title: string;
	tags: string[];
	headers: string[];
	selectedElementsText: string[];
	language: string;
	canonicalLink: string;
	linksText: string[];
	text: string;
}

const HEADER_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"];

export function parseUrlConvertResponse(
	url: string,
	raw: Record<string, unknown>
): UrlConvertResult {
	const firstPage = (raw.firstPage ?? raw) as {
		title?: string;
		statements?: Array<{ tag?: string; content?: string }>;
		headers?: string[];
		linksText?: string[];
		text?: string;
	};
	const statements = firstPage?.statements ?? [];
	const headers =
		Array.isArray(firstPage?.headers) && firstPage.headers.length > 0
			? firstPage.headers
			: statements
					.filter((s) => HEADER_TAGS.includes((s.tag ?? "").toLowerCase()))
					.map((s) => s.content ?? "")
					.filter(Boolean);
	const linksText =
		Array.isArray(firstPage?.linksText) && firstPage.linksText.length > 0
			? firstPage.linksText
			: statements
					.filter((s) => (s.tag ?? "").toLowerCase().includes("a"))
					.map((s) => s.content ?? "")
					.filter(Boolean);
	const text = typeof firstPage?.text === "string" ? firstPage.text : "";
	return {
		url,
		title: typeof firstPage?.title === "string" ? firstPage.title : "",
		tags: [],
		headers,
		selectedElementsText: [],
		language: "",
		canonicalLink: url,
		linksText,
		text,
	};
}

export function extractContentByType(
	result: UrlConvertResult,
	contentToExtract: string
): string {
	const mode = (contentToExtract ?? "all").toLowerCase();
	if (mode === "header tags") return result.headers.join("\n");
	if (mode === "link tags") return result.linksText.join("\n");
	return result.text;
}

/** Heuristic: true if content looks like no usable plain text (e.g. JS only) */
export function isNoUsableText(content: string): boolean {
	if (!content || !content.trim()) return true;
	const trimmed = content.trim();
	// Very short and no space → likely code/minified
	if (trimmed.length < 100 && !trimmed.includes(" ")) return true;
	// Almost no letters → likely not readable text
	const letters = (trimmed.match(/\p{L}/gu) ?? []).length;
	return letters < 20;
}

export async function fetchUrlContent(
	url: string,
	proxy: boolean
): Promise<Record<string, unknown>> {
	const query = new URLSearchParams({ url });
	if (proxy) query.set("proxy", "true");
	const response = await makeInfraNodusRequest(
		`/convert/url?${query.toString()}`,
		{},
		"GET"
	);
	if (response && typeof response === "object" && "error" in response) {
		throw new Error(
			(response as { error?: string }).error ?? "Failed to fetch URL"
		);
	}
	return (response ?? {}) as Record<string, unknown>;
}

export type FetchUrlContentAsTextOptions = {
	contentToExtract?: string;
	useProxy?: boolean;
};

export type FetchUrlContentAsTextResult =
	| { ok: true; contentText: string }
	| { ok: false; error: string };

/**
 * Fetches content from a URL via InfraNodus /convert/url, optionally retrying
 * with proxy if the initial response has no usable text. Returns extracted text
 * by content type (all, header tags, link tags).
 */
export async function fetchUrlContentAsText(
	url: string,
	options: FetchUrlContentAsTextOptions = {}
): Promise<FetchUrlContentAsTextResult> {
	const contentToExtract = options.contentToExtract ?? "all";
	const useProxy = options.useProxy === true;
	try {
		let raw = await fetchUrlContent(url, useProxy);
		let parsed = parseUrlConvertResponse(url, raw);
		let contentText = extractContentByType(parsed, contentToExtract);
		if (!useProxy && isNoUsableText(contentText)) {
			raw = await fetchUrlContent(url, true);
			parsed = parseUrlConvertResponse(url, raw);
			contentText = extractContentByType(parsed, contentToExtract);
		}
		return { ok: true, contentText };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
