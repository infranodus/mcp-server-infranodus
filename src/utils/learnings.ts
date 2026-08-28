/**
 * Project learnings: an append-only, per-project graph (`learn-<slug>`) where
 * the calling LLM saves what it learned about operating in a project, so the
 * next session — on any client — can retrieve it.
 *
 * Consent model (see docs/drafts/project-learnings-graph.md): the graph only
 * exists if the user explicitly asked for it via `enable_project_learnings`.
 * `add_project_learnings` refuses when the graph is missing and never creates
 * one. Category processing (which turns `type-*` / `source-*` labels into
 * [[label]] mention nodes) binds when the graph is FIRST created, so creation
 * must always go through `createLearningsGraph` below.
 */
import { makeInfraNodusRequest } from "../api/client.js";
import { prepareStatementsPayload } from "./wikilinksMode.js";
import type { GraphResponse, Statement } from "../types/index.js";

export const GRAPH_PREFIX = "learn-";
export const MAX_GRAPH_NAME_LENGTH = 28;
export const MARKER_CATEGORY = "learnings-enabled";

export const LEARNING_TYPES = [
	"location",
	"trap",
	"convention",
	"decision",
	"workflow",
	"question",
] as const;
export type LearningType = (typeof LEARNING_TYPES)[number];

export const TYPE_CATEGORY_PREFIX = "type-";
export const SOURCE_CATEGORY_PREFIX = "source-";

/** Near-duplicate threshold on word-set Jaccard similarity. */
export const DEDUPE_THRESHOLD = 0.6;
export const MAX_STATEMENT_LENGTH = 400;

export function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

export function learningsGraphName(project: string): string {
	const slug = slugify(project) || "project";
	const room = MAX_GRAPH_NAME_LENGTH - GRAPH_PREFIX.length;
	return GRAPH_PREFIX + slug.slice(0, room).replace(/-+$/g, "");
}

/**
 * Not attached to statements any more: a per-client label links every
 * statement of that client and became the most central node of the graph in
 * testing. Kept so `toStoredLearning` can still read graphs written before
 * that change.
 */
export function sourceCategory(clientName?: string): string {
	return SOURCE_CATEGORY_PREFIX + (slugify(clientName ?? "") || "unknown");
}

export function typeCategory(type: LearningType): string {
	return TYPE_CATEGORY_PREFIX + type;
}

// ---------------------------------------------------------------------------
// Redaction lint
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: RegExp[] = [
	/\bsk-[A-Za-z0-9_-]{8,}/, // OpenAI/Anthropic-style keys
	/\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
	/\bbearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
	/\bapi[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9._-]{8,}/i,
	/\b(?:password|passwd|secret|token)\s*[:=]\s*['"]?\S{6,}/i,
	/-----BEGIN [A-Z ]*PRIVATE KEY-----/,
	/:\/\/[^\s/@]+:[^\s/@]+@/, // user:pass@host in a URL
	/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
];

export interface RedactionIssue {
	index: number;
	reason: "secret-like" | "too-long" | "empty";
}

/** Returns the indices (never the content) of statements that must not be stored. */
export function redactionIssues(statements: string[]): RedactionIssue[] {
	const issues: RedactionIssue[] = [];
	statements.forEach((statement, index) => {
		if (!statement || !statement.trim()) {
			issues.push({ index, reason: "empty" });
			return;
		}
		if (statement.length > MAX_STATEMENT_LENGTH) {
			issues.push({ index, reason: "too-long" });
			return;
		}
		if (SECRET_PATTERNS.some((pattern) => pattern.test(statement))) {
			issues.push({ index, reason: "secret-like" });
		}
	});
	return issues;
}

// ---------------------------------------------------------------------------
// Dedupe
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
	"the", "and", "for", "that", "this", "with", "from", "are", "was", "were",
	"has", "have", "not", "but", "its", "into", "when", "which", "also", "than",
	"then", "there", "their", "they", "them", "been", "being", "use", "used",
	"confirmed", "again",
]);

export function tokenize(statement: string): Set<string> {
	const words = statement
		.toLowerCase()
		.replace(/\[\[|\]\]/g, " ")
		.split(/[^a-z0-9._/-]+/)
		.map((word) => word.replace(/^[._/-]+|[._/-]+$/g, ""))
		.filter((word) => word.length >= 3 && !STOPWORDS.has(word));
	return new Set(words);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 || b.size === 0) return 0;
	let intersection = 0;
	for (const word of a) if (b.has(word)) intersection += 1;
	const union = a.size + b.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

export interface DedupeResult {
	statement: string;
	status: "new" | "reinforced";
	/** The existing statement this one reinforces (when status is "reinforced"). */
	matches?: string;
	similarity?: number;
}

/**
 * Compare candidates against what the graph already holds. A near-duplicate
 * is not dropped — it is rewritten as a short "Confirmed again" statement so
 * the repeat still raises the weight of the same entity links (that is how
 * frequently re-learned things become central) without duplicating the text.
 */
export function dedupeAgainstExisting(
	candidates: string[],
	existing: string[],
	threshold: number = DEDUPE_THRESHOLD,
): DedupeResult[] {
	const existingTokens = existing.map((statement) => ({
		statement,
		tokens: tokenize(statement),
	}));
	const accepted: Set<string>[] = [];

	return candidates.map((candidate) => {
		const tokens = tokenize(candidate);
		let best: { statement: string; similarity: number } | null = null;
		for (const entry of existingTokens) {
			const similarity = jaccard(tokens, entry.tokens);
			if (similarity >= threshold && (!best || similarity > best.similarity)) {
				best = { statement: entry.statement, similarity };
			}
		}
		// Also collapse duplicates within the same batch.
		if (!best) {
			for (const prior of accepted) {
				if (jaccard(tokens, prior) >= threshold) {
					best = { statement: "(earlier statement in this batch)", similarity: 1 };
					break;
				}
			}
		}
		accepted.push(tokens);
		if (best) {
			return {
				statement: best.statement.startsWith("(")
					? candidate
					: `Confirmed again: ${stripConfirmedPrefix(best.statement)}`,
				status: "reinforced",
				matches: best.statement,
				similarity: Number(best.similarity.toFixed(2)),
			};
		}
		return { statement: candidate, status: "new" };
	});
}

function stripConfirmedPrefix(statement: string): string {
	return statement.replace(/^(?:confirmed again:\s*)+/i, "");
}

// ---------------------------------------------------------------------------
// Graph access
// ---------------------------------------------------------------------------

export interface LearningsGraphInfo {
	exists: boolean;
	/** True when the graph was created with category processing on. */
	categoriesOn: boolean;
	id?: number;
	url?: string;
	createdAt?: string;
}

interface ListedGraph {
	id?: number;
	contextName?: string;
	createdAt?: string;
	defaultRevisionUrl?: string | null;
	textProcessingSettings?: { categoriesAsMentions?: boolean };
}

/**
 * The API runs on several instances, each with its own per-user contexts-list
 * cache (6 min TTL) that is only invalidated on the instance that handled a
 * write. Right after a graph is created, a read may therefore land on an
 * instance that still says it does not exist. A positive answer is
 * authoritative (a graph cannot be listed unless it exists), so reads retry a
 * few times and accept the first positive; a negative is trusted only after
 * every attempt agreed.
 */
export const READ_ATTEMPTS = 4;

async function firstPositive<T>(
	attempt: (n: number) => Promise<T | null>,
	attempts: number = READ_ATTEMPTS,
): Promise<T | null> {
	for (let n = 0; n < attempts; n++) {
		const result = await attempt(n);
		if (result !== null) return result;
	}
	return null;
}

/** The API sometimes returns `error` as an object ({ statusCode, message[] }). */
export function errorText(error: unknown): string {
	if (typeof error === "string") return error;
	if (error && typeof error === "object") {
		const message = (error as { message?: unknown }).message;
		if (Array.isArray(message)) return message.join("; ");
		if (typeof message === "string") return message;
		return JSON.stringify(error);
	}
	return String(error);
}

/** Exact-name lookup through /listGraphs (read-only; never creates anything). */
export async function findLearningsGraph(
	graphName: string,
): Promise<LearningsGraphInfo> {
	const found = await firstPositive(async (n) => {
		const response = (await makeInfraNodusRequest("/listGraphs", {
			query: graphName,
			// Varies the body so no intermediate layer can collapse the retries.
			attempt: n,
		})) as unknown;
		if (!Array.isArray(response)) return null;
		const match = (response as ListedGraph[]).find(
			(graph) => graph.contextName === graphName,
		);
		return match ?? null;
	});
	if (!found) return { exists: false, categoriesOn: false };
	return {
		exists: true,
		categoriesOn: found.textProcessingSettings?.categoriesAsMentions === true,
		id: found.id,
		url: found.defaultRevisionUrl ?? undefined,
		createdAt: found.createdAt,
	};
}

export interface StoredLearning {
	content: string;
	types: string[];
	source?: string;
	categories: string[];
	createdAt?: string;
}

export function toStoredLearning(statement: Statement): StoredLearning | null {
	if (!statement.content) return null;
	const categories = statement.categories ?? [];
	return {
		content: statement.content,
		types: categories
			.filter((category) => category.startsWith(TYPE_CATEGORY_PREFIX))
			.map((category) => category.slice(TYPE_CATEGORY_PREFIX.length)),
		source: categories
			.find((category) => category.startsWith(SOURCE_CATEGORY_PREFIX))
			?.slice(SOURCE_CATEGORY_PREFIX.length),
		categories,
		createdAt: statement.createdAt,
	};
}

export function isMarkerStatement(statement: Statement): boolean {
	return (
		(statement.categories ?? []).includes(MARKER_CATEGORY) ||
		(statement.content ?? "").includes(`[[${MARKER_CATEGORY}]]`)
	);
}

/**
 * Read every statement of the graph (doNotSave; the graph must already exist —
 * a missing name errors and is never created). "Select an existing graph
 * context" on a graph that does exist means the request hit an instance
 * with a stale contexts list (see firstPositive), not a parameter problem.
 */
export async function fetchLearningsGraph(graphName: string): Promise<{
	statements: Statement[];
	response: GraphResponse;
}> {
	const queryParams = new URLSearchParams({
		doNotSave: "true",
		addStats: "true",
		includeStatements: "true",
		includeGraphSummary: "false",
		extendedGraphSummary: "true",
		includeGraph: "false",
		compactGraph: "true",
		compactStatements: "false",
		aiTopics: "false",
	});
	let lastError = "Graph not found";
	const response = await firstPositive(async (n) => {
		try {
			const result = await makeInfraNodusRequest(
				`/graphAndStatements?${queryParams.toString()}`,
				{ name: graphName, aiTopics: "false", attempt: n },
			);
			if (result.error) {
				lastError = errorText(result.error);
				return null;
			}
			return result;
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
			return null;
		}
	});
	if (!response) throw new Error(lastError);
	return { statements: response.statements ?? [], response };
}

/**
 * Resolve whether learnings are enabled for a graph name. Cheap path: the
 * graph exists and was created with categories on. Fallback (older graphs or
 * a listing without settings): look for the marker statement.
 */
export async function checkEnabled(graphName: string): Promise<{
	enabled: boolean;
	info: LearningsGraphInfo;
	reason?: "missing" | "not-a-learnings-graph";
}> {
	const info = await findLearningsGraph(graphName);
	if (info.exists && info.categoriesOn) return { enabled: true, info };

	// Either the listing lags behind a graph created moments ago, or the graph
	// exists without the category flag. Reading by name is authoritative and
	// never creates anything (a missing graph errors).
	let statements: Statement[];
	try {
		({ statements } = await fetchLearningsGraph(graphName));
	} catch {
		return { enabled: false, info, reason: "missing" };
	}
	if (statements.some(isMarkerStatement)) {
		return { enabled: true, info: { ...info, exists: true } };
	}
	return {
		enabled: false,
		info: { ...info, exists: true },
		reason: "not-a-learnings-graph",
	};
}

export interface AppendResult {
	graphName?: string;
	graphUrl?: string;
	response: GraphResponse;
}

/** Append statements (with parallel categories/timestamps) to an existing graph. */
export async function appendLearnings(params: {
	graphName: string;
	statements: string[];
	categories: string[][];
	timestamps: string[];
}): Promise<AppendResult> {
	const payload = prepareStatementsPayload(
		params.statements,
		params.categories,
		"default",
		params.timestamps,
	);
	const queryParams = new URLSearchParams({
		doNotSave: "false",
		addStats: "false",
		includeStatements: "false",
		includeGraphSummary: "false",
		extendedGraphSummary: "false",
		includeGraph: "false",
		compactGraph: "true",
		compactStatements: "true",
		aiTopics: "false",
	});
	// An instance with a stale contexts list (see firstPositive) treats an
	// append to an existing graph as a create and the engine rejects it with
	// "Context with this name already exists". That error is the only one
	// worth retrying: it means the graph exists and another instance will
	// append correctly.
	let lastError = "Append failed";
	for (let n = 0; n < READ_ATTEMPTS; n++) {
		const response = await makeInfraNodusRequest(
			`/graphAndStatements?${queryParams.toString()}`,
			{
				name: params.graphName,
				aiTopics: "false",
				contextType: "memory",
				...payload,
				...(n > 0 ? { attempt: n } : {}),
			},
		);
		if (!response.error) {
			return {
				graphName: response.graphName ?? params.graphName,
				graphUrl: response.graphUrl,
				response,
			};
		}
		lastError = errorText(response.error);
		if (!/already exists/i.test(lastError)) break;
	}
	throw new Error(lastError);
}

/**
 * Create the learnings graph. The marker statement carries a category so the
 * graph is created with category processing ON — the only way later `type-*`
 * labels become nodes (settings bind at creation).
 */
export async function createLearningsGraph(params: {
	graphName: string;
	slug: string;
	clientName?: string;
}): Promise<AppendResult> {
	const now = new Date().toISOString();
	const client = params.clientName?.trim() || "unknown client";
	return appendLearnings({
		graphName: params.graphName,
		statements: [
			`[[${MARKER_CATEGORY}]] Project [[${params.slug}]] learnings enabled on ${now.slice(0, 10)} from ${client}. Append-only graph of what agents learned about operating in this project.`,
		],
		categories: [[MARKER_CATEGORY]],
		timestamps: [now],
	});
}

export function newestFirst<T extends { createdAt?: string }>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
		const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
		return tb - ta;
	});
}
