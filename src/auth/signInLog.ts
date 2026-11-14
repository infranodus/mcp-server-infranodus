/**
 * Reports each OAuth sign-in attempt on the hosted server to the brand app,
 * which stores it (Supabase `log_mcp_signin`). It answers two questions: which
 * apps sign in from which addresses, and whether a real app is being refused
 * by the redirect allowlist (redirect-allowlist.ts).
 *
 * Off unless MCP_SIGNIN_LOG_SECRET is set, so local installs report nothing.
 * Never carries API keys, codes or tokens: the redirect address is stored
 * without its query string.
 */
import { brand, brandApiBase } from "../config/brand.js";

export type SignInOutcome =
	| "form_shown"
	| "refused_redirect"
	| "invalid_key"
	| "success";

const SECRET = process.env.MCP_SIGNIN_LOG_SECRET;

function addressOnly(redirectUri: unknown): string {
	if (typeof redirectUri !== "string") return "";
	try {
		const url = new URL(redirectUri);
		return `${url.protocol}//${url.host}${url.pathname}`.slice(0, 500);
	} catch {
		return redirectUri.split(/[?#]/)[0].slice(0, 500);
	}
}

export function recordSignIn(event: {
	outcome: SignInOutcome;
	redirectUri: unknown;
	clientId?: unknown;
	app?: string | null;
	userId?: number;
}): void {
	if (!SECRET) return;
	// Fire and forget: a slow or failing log must never affect the sign-in.
	fetch(`${brandApiBase()}/mcpSignIn`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Infranodus-Client": "mcp-server",
			"X-Mcp-Signin-Secret": SECRET,
		},
		body: JSON.stringify({
			brand: brand.id,
			outcome: event.outcome,
			redirect_uri: addressOnly(event.redirectUri),
			client_id:
				typeof event.clientId === "string" ? event.clientId.slice(0, 200) : null,
			app: event.app ?? null,
			user_id: event.userId ?? null,
		}),
		signal: AbortSignal.timeout(5000),
	}).catch(() => {});
}
