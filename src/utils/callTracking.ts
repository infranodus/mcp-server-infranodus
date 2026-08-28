/**
 * Per-session bookkeeping used by wrapHandler (src/index.ts):
 *
 * - `previousCall`: the last tool call's metrics (duration, error, retry),
 *   piggybacked on the *next* API request body so the app can store it in
 *   `log_ai.previous_call`. The MCP server only knows a call's outcome after
 *   the app has already logged it, so this is the zero-extra-request way to
 *   get objective metrics next to the model's self-reports.
 * - once-per-session gating for the feedback nudge appended to
 *   workflow-ending tools.
 *
 * State is in-memory and per process; on multi-instance deploys a session
 * that hops instances may miss a retry or see the nudge twice. Acceptable.
 */
import { createHash } from "node:crypto";

export const RETRY_WINDOW_MS = 60_000;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const SWEEP_EVERY = 200;

export interface PreviousCall {
	tool: string;
	durationMs: number;
	isError: boolean;
	retry: boolean;
	at: string;
}

interface SessionState {
	lastTool?: string;
	lastParamsHash?: string;
	lastAt?: number;
	previousCall?: PreviousCall;
	nudged: boolean;
	touched: number;
}

const sessions = new Map<string, SessionState>();
let opsSinceSweep = 0;

export const STDIO_SESSION = "stdio";

function state(sessionId: string): SessionState {
	let entry = sessions.get(sessionId);
	if (!entry) {
		entry = { nudged: false, touched: Date.now() };
		sessions.set(sessionId, entry);
	}
	entry.touched = Date.now();
	if (++opsSinceSweep >= SWEEP_EVERY) sweep();
	return entry;
}

function sweep(now: number = Date.now()): void {
	opsSinceSweep = 0;
	for (const [id, entry] of sessions) {
		if (now - entry.touched > SESSION_TTL_MS) sessions.delete(id);
	}
}

export function hashParams(params: unknown): string {
	return createHash("sha1")
		.update(JSON.stringify(params ?? null))
		.digest("hex")
		.slice(0, 12);
}

/** Metrics of the previous call in this session, to attach to the next request. */
export function previousCallFor(sessionId: string): PreviousCall | undefined {
	return sessions.get(sessionId)?.previousCall;
}

/**
 * Record a finished call. Returns the metrics that the *next* request will
 * carry. A retry is the same tool again within RETRY_WINDOW_MS with different
 * params — the objective "first result wasn't usable" signal.
 */
export function recordCall(
	sessionId: string,
	call: {
		tool: string;
		params: unknown;
		startedAt: number;
		finishedAt: number;
		isError: boolean;
	},
): PreviousCall {
	const entry = state(sessionId);
	const paramsHash = hashParams(call.params);
	const retry =
		entry.lastTool === call.tool &&
		entry.lastAt !== undefined &&
		call.startedAt - entry.lastAt < RETRY_WINDOW_MS &&
		entry.lastParamsHash !== paramsHash;
	const previous: PreviousCall = {
		tool: call.tool,
		durationMs: Math.max(0, Math.round(call.finishedAt - call.startedAt)),
		isError: call.isError,
		retry,
		at: new Date(call.finishedAt).toISOString(),
	};
	entry.lastTool = call.tool;
	entry.lastParamsHash = paramsHash;
	entry.lastAt = call.finishedAt;
	entry.previousCall = previous;
	return previous;
}

/** True the first time it is asked in a session, false afterwards. */
export function claimNudge(sessionId: string): boolean {
	const entry = state(sessionId);
	if (entry.nudged) return false;
	entry.nudged = true;
	return true;
}

/** Test hook. */
export function resetCallTracking(): void {
	sessions.clear();
	opsSinceSweep = 0;
}
