/**
 * Where an OAuth sign-in may send the user back to.
 *
 * Client registration is open (RFC 7591), so a registered client_id proves
 * nothing about who is asking: anyone can register an app with their own
 * redirect address. The only thing that stops a crafted authorize link from
 * delivering a sign-in to an attacker's site is this fixed list of addresses
 * belonging to known apps, plus the user's own computer.
 *
 * To support a new app, add its published callback address here. Refused
 * addresses are recorded (see signInLog.ts), so a real app that gets turned
 * away shows up there.
 */

interface TrustedRedirect {
	app: string;
	/** Scheme and host, exactly as in the callback address. */
	origin: string;
	/** Exact path, or a prefix when `prefix` is true. */
	path: string;
	prefix?: boolean;
}

const TRUSTED_REDIRECTS: TrustedRedirect[] = [
	{ app: "Claude", origin: "https://claude.ai", path: "/api/mcp/auth_callback" },
	{ app: "Claude", origin: "https://claude.com", path: "/api/mcp/auth_callback" },
	{
		app: "ChatGPT",
		origin: "https://chatgpt.com",
		path: "/connector_platform_oauth_redirect",
	},
	// ChatGPT gives each connector its own callback: /connector/oauth/{callback_id}
	{
		app: "ChatGPT",
		origin: "https://chatgpt.com",
		path: "/connector/oauth/",
		prefix: true,
	},
	{
		app: "Cursor",
		origin: "https://www.cursor.com",
		path: "/agents/mcp/oauth/callback",
	},
	{
		app: "Cursor",
		origin: "cursor://anysphere.cursor-mcp",
		path: "/oauth/callback",
	},
	{
		app: "Grok",
		origin: "https://grok.com",
		path: "/connectors-oauth-exchange-code/",
		prefix: true,
	},
	{ app: "VS Code", origin: "https://vscode.dev", path: "/redirect" },
	{ app: "VS Code", origin: "https://insiders.vscode.dev", path: "/redirect" },
	{
		app: "Perplexity",
		origin: "https://www.perplexity.ai",
		path: "/rest/connections/oauth_callback",
	},
	{
		app: "Perplexity",
		origin: "https://enterprise.perplexity.ai",
		path: "/rest/connections/oauth_callback",
	},
];

/** Shown on the sign-in page for a redirect to the user's own machine. */
export const LOCAL_APP = "an app on this computer";

/**
 * The app a redirect address belongs to, or null when the address is not
 * trusted and the sign-in must be refused.
 */
export function trustedRedirectApp(redirectUri: unknown): string | null {
	if (typeof redirectUri !== "string") return null;
	let url: URL;
	try {
		url = new URL(redirectUri);
	} catch {
		return null;
	}
	// user@host tricks and fragments have no place in a callback address
	if (url.username || url.password || url.hash) return null;

	if (url.protocol === "http:") {
		const host = url.hostname.toLowerCase();
		return host === "localhost" || host === "127.0.0.1" ? LOCAL_APP : null;
	}

	const origin = `${url.protocol}//${url.host}`.toLowerCase();
	for (const entry of TRUSTED_REDIRECTS) {
		if (entry.origin !== origin) continue;
		if (entry.prefix ? url.pathname.startsWith(entry.path) : url.pathname === entry.path) {
			return entry.app;
		}
	}
	return null;
}

/** The destination as shown to the user: the host only, never the full address. */
export function redirectDisplayHost(redirectUri: string): string {
	try {
		return new URL(redirectUri).host;
	} catch {
		return "";
	}
}
