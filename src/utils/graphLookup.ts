/**
 * Read-only graph lookup shared by the tools that must know whether a graph
 * exists in the caller's account before they act on it (project learnings,
 * delete_statements). Never creates anything.
 */
import { makeInfraNodusRequest } from "../api/client.js";

export interface ListedGraph {
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

export async function firstPositive<T>(
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

/**
 * Exact-name lookup through /listGraphs in the caller's own account
 * (read-only). Returns the listing entry, or null after every retry agreed
 * that the graph is absent.
 */
export async function findGraphByName(
	graphName: string,
): Promise<ListedGraph | null> {
	return firstPositive(async (n) => {
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
}
