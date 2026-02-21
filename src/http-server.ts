/**
 * HTTP Server entry point for InfraNodus MCP Server
 * Exposes the MCP server over HTTP with OAuth2-style authentication
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import crypto from "crypto";
import * as dotenv from "dotenv";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import createServer from "./index.js";
import {
	exchangeApiKeyForToken,
	verifyAccessToken,
	revokeSession,
	getSessionCount,
	registerClient,
	getClient,
	validateClient,
	validateRedirectUri,
	createAuthorizationCode,
	exchangeAuthorizationCode,
	validateApiKey,
} from "./auth/oauth-provider.js";
import {
	TokenRequest,
	ErrorResponse,
	AuthenticatedRequest,
	ClientRegistrationRequest,
} from "./auth/types.js";

// Load environment variables
dotenv.config();

// Configuration
const PORT = parseInt(process.env.PORT || "3000", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const INFRANODUS_API_BASE =
	process.env.INFRANODUS_API_BASE || "https://infranodus.com/api/v1";

// Allow HTTP only for localhost/127.0.0.1 (local dev); otherwise require HTTPS
function isRedirectUriAllowed(redirectUri: string): boolean {
	if (redirectUri.startsWith("https://")) return true;
	if (!redirectUri.startsWith("http://")) return false;
	try {
		const u = new URL(redirectUri);
		const host = u.hostname.toLowerCase();
		return host === "localhost" || host === "127.0.0.1";
	} catch {
		return false;
	}
}

// Store auth info on request (using a symbol to avoid conflicts with MCP SDK)
const AUTH_KEY = Symbol("auth");

interface AuthenticatedExpressRequest extends Request {
	[AUTH_KEY]?: AuthenticatedRequest;
}

// Create Express app
const app = express();

// Trust proxy for correct protocol detection behind reverse proxies (Fly.io, etc.)
app.set("trust proxy", true);

// Middleware
app.use(
	helmet({
		contentSecurityPolicy: false, // Disable for SSE compatibility
	})
);
app.use(
	cors({
		origin: CORS_ORIGIN,
		credentials: true,
	})
);
app.use(express.json());

// Log ALL incoming requests
app.use((req: Request, res: Response, next: NextFunction) => {
	console.log(`[HTTP] ${req.method} ${req.path} from ${req.ip}`);
	console.log(
		`[HTTP] Headers: ${JSON.stringify({
			authorization: req.headers.authorization ? "[present]" : "[missing]",
			"content-type": req.headers["content-type"],
			accept: req.headers.accept,
		})}`
	);
	next();
});

// Store transports per session for MCP (Streamable HTTP)
const transports = new Map<string, StreamableHTTPServerTransport>();

// Store SSE transports per session for legacy MCP clients
const sseTransports = new Map<string, SSEServerTransport>();

/**
 * Auth middleware - validates Bearer token and attaches auth info to request.
 * Supports both JWT access tokens (from OAuth flow) and raw InfraNodus API keys.
 */
async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
	console.log(`[AUTH] Checking auth for ${req.method} ${req.path}`);
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		console.log(`[AUTH] Missing or invalid Authorization header`);
		const baseUrl = `${req.protocol}://${req.get("host")}`;
		res.setHeader(
			"WWW-Authenticate",
			`Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`
		);
		const error: ErrorResponse = {
			error: "unauthorized",
			error_description: "Missing or invalid Authorization header",
		};
		res.status(401).json(error);
		return;
	}

	const token = authHeader.slice(7); // Remove "Bearer " prefix
	console.log(`[AUTH] Token present, verifying...`);

	// Try JWT verification first (fast path for OAuth-authenticated clients)
	const authInfo = verifyAccessToken(token);
	if (authInfo) {
		console.log(
			`[AUTH] Authenticated via JWT as ${authInfo.userName} (${authInfo.userId})`
		);
		(req as AuthenticatedExpressRequest)[AUTH_KEY] = authInfo;
		next();
		return;
	}

	// JWT failed — try treating the token as a raw InfraNodus API key
	console.log(`[AUTH] JWT verification failed, trying as raw API key...`);
	try {
		const userInfo = await validateApiKey(token);
		if (userInfo) {
			console.log(
				`[AUTH] Authenticated via raw API key as ${userInfo.userName} (${userInfo.userId})`
			);
			(req as AuthenticatedExpressRequest)[AUTH_KEY] = {
				userId: userInfo.userId,
				userName: userInfo.userName,
				apiKey: token,
				sessionId: crypto.randomUUID(),
			};
			next();
			return;
		}
	} catch (err) {
		console.log(`[AUTH] Raw API key validation error: ${err}`);
	}

	console.log(`[AUTH] All authentication methods failed`);
	const baseUrl = `${req.protocol}://${req.get("host")}`;
	res.setHeader(
		"WWW-Authenticate",
		`Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`
	);
	const error: ErrorResponse = {
		error: "invalid_token",
		error_description: "Access token is invalid or expired",
	};
	res.status(401).json(error);
}

/**
 * Helper to get auth info from request
 */
function getAuth(req: Request): AuthenticatedRequest | undefined {
	return (req as AuthenticatedExpressRequest)[AUTH_KEY];
}

// ============================================================================
// OAuth2 Endpoints
// ============================================================================

/**
 * POST /oauth/register - Dynamic Client Registration (RFC 7591)
 */
app.post("/oauth/register", (req: Request, res: Response) => {
	try {
		const body = req.body as ClientRegistrationRequest;

		if (
			!body.redirect_uris ||
			!Array.isArray(body.redirect_uris) ||
			body.redirect_uris.length === 0
		) {
			res.status(400).json({
				error: "invalid_request",
				error_description:
					"redirect_uris is required and must be a non-empty array",
			});
			return;
		}

		const clientResponse = registerClient(body);
		res.status(201).json(clientResponse);
	} catch (error) {
		console.error("Client registration error:", error);
		res.status(500).json({
			error: "server_error",
			error_description: "Internal server error",
		});
	}
});

/**
 * GET /oauth/authorize - Authorization endpoint (shows form)
 */
app.get("/oauth/authorize", (req: Request, res: Response) => {
	const {
		response_type,
		client_id,
		redirect_uri,
		scope,
		state,
		code_challenge,
		code_challenge_method,
	} = req.query;

	// Validate required parameters
	if (response_type !== "code") {
		res.status(400).json({ error: "unsupported_response_type" });
		return;
	}

	if (!client_id || typeof client_id !== "string") {
		res.status(400).json({
			error: "invalid_request",
			error_description: "client_id is required",
		});
		return;
	}

	// Accept any UUID-formatted client_id (stateless - no need for pre-registration)
	// This is necessary because client registrations don't persist across instances/restarts
	const uuidRegex =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!uuidRegex.test(client_id)) {
		res.status(400).json({
			error: "invalid_client",
			error_description: "Invalid client_id format",
		});
		return;
	}

	if (!redirect_uri || typeof redirect_uri !== "string") {
		res.status(400).json({
			error: "invalid_request",
			error_description: "redirect_uri is required",
		});
		return;
	}

	// Accept HTTPS or http://localhost / http://127.0.0.1 (for local dev)
	if (!isRedirectUriAllowed(redirect_uri)) {
		res.status(400).json({
			error: "invalid_request",
			error_description:
				"redirect_uri must use HTTPS or http://localhost or http://127.0.0.1",
		});
		return;
	}

	// Get client name from registration if available, otherwise use client_id
	const client = getClient(client_id);
	const clientName = client?.client_name || client_id;

	// Render a simple HTML authorization form
	const html = `
<!DOCTYPE html>
<html>
<head>
	<title>InfraNodus MCP - Authorize</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
		h1 { color: #333; font-size: 24px; }
		.client-name { color: #666; margin-bottom: 20px; }
		label { display: block; margin: 15px 0 5px; font-weight: 500; }
		input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
		button { width: 100%; padding: 12px; background: #4F46E5; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; margin-top: 20px; }
		button:hover { background: #4338CA; }
		.info { background: #F3F4F6; padding: 15px; border-radius: 4px; margin-bottom: 20px; font-size: 14px; color: #666; }
	</style>
</head>
<body>
	<h1>Authorize Access</h1>
	<p class="client-name">Application: <strong>${clientName}</strong></p>
	<div class="info">
		Enter your InfraNodus API key to authorize this application to access your InfraNodus data.
	</div>
	<form method="POST" action="/oauth/authorize">
		<input type="hidden" name="client_id" value="${client_id}">
		<input type="hidden" name="redirect_uri" value="${redirect_uri}">
		<input type="hidden" name="response_type" value="code">
		<input type="hidden" name="state" value="${state || ""}">
		<input type="hidden" name="scope" value="${scope || ""}">
		<input type="hidden" name="code_challenge" value="${code_challenge || ""}">
		<input type="hidden" name="code_challenge_method" value="${
			code_challenge_method || ""
		}">
		<label for="api_key">InfraNodus API Key</label>
		<input type="password" id="api_key" name="api_key" required placeholder="Enter your API key">
		<button type="submit">Authorize</button>
	</form>
</body>
</html>`;

	res.type("html").send(html);
});

/**
 * POST /oauth/authorize - Process authorization (form submission)
 */
app.post(
	"/oauth/authorize",
	express.urlencoded({ extended: true }),
	async (req: Request, res: Response) => {
		const {
			client_id,
			redirect_uri,
			response_type,
			state,
			scope,
			code_challenge,
			code_challenge_method,
			api_key,
		} = req.body;

		// Validate client_id format (stateless - accept any valid UUID)
		const uuidRegex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!client_id || !uuidRegex.test(client_id)) {
			res.status(400).json({ error: "invalid_client" });
			return;
		}

		// Validate redirect_uri (HTTPS or localhost/127.0.0.1 for local dev)
		if (!redirect_uri || !isRedirectUriAllowed(redirect_uri)) {
			res.status(400).json({
				error: "invalid_request",
				error_description: "Invalid redirect_uri",
			});
			return;
		}

		// Validate API key
		if (!api_key) {
			const redirectUrl = new URL(redirect_uri);
			redirectUrl.searchParams.set("error", "access_denied");
			redirectUrl.searchParams.set("error_description", "API key is required");
			if (state) redirectUrl.searchParams.set("state", state);
			res.redirect(redirectUrl.toString());
			return;
		}

		const userInfo = await validateApiKey(api_key);
		if (!userInfo) {
			const redirectUrl = new URL(redirect_uri);
			redirectUrl.searchParams.set("error", "access_denied");
			redirectUrl.searchParams.set("error_description", "Invalid API key");
			if (state) redirectUrl.searchParams.set("state", state);
			res.redirect(redirectUrl.toString());
			return;
		}

		// Create authorization code
		const code = createAuthorizationCode(
			client_id,
			redirect_uri,
			api_key,
			scope,
			code_challenge,
			code_challenge_method
		);

		// Redirect with code
		const redirectUrl = new URL(redirect_uri);
		redirectUrl.searchParams.set("code", code);
		if (state) redirectUrl.searchParams.set("state", state);
		res.redirect(redirectUrl.toString());
	}
);

/**
 * POST /oauth/token - Exchange authorization code or API key for access token
 */
app.post(
	"/oauth/token",
	express.urlencoded({ extended: true }),
	async (req: Request, res: Response) => {
		try {
			let {
				grant_type,
				code,
				redirect_uri,
				client_id,
				client_secret,
				code_verifier,
				api_key,
			} = req.body;

			// Support client_secret_basic authentication (credentials in Authorization header)
			const authHeader = req.headers.authorization;
			if (authHeader && authHeader.startsWith("Basic ")) {
				const base64Credentials = authHeader.slice(6);
				const credentials = Buffer.from(base64Credentials, "base64").toString(
					"utf-8"
				);
				const [headerClientId, headerClientSecret] = credentials.split(":");
				if (headerClientId) client_id = headerClientId;
				if (headerClientSecret) client_secret = headerClientSecret;
			}

			// Handle authorization_code grant
			if (grant_type === "authorization_code") {
				if (!code || !redirect_uri || !client_id) {
					res.status(400).json({
						error: "invalid_request",
						error_description:
							"Missing required parameters for authorization_code grant",
					});
					return;
				}

				// Note: We skip strict client validation here because:
				// 1. Multiple server instances don't share client registration state
				// 2. The real authentication is via the InfraNodus API key in the auth code
				// 3. The authorization code itself validates the client_id and redirect_uri

				const tokenResponse = await exchangeAuthorizationCode(
					code,
					client_id,
					redirect_uri,
					code_verifier
				);
				if (!tokenResponse) {
					res.status(400).json({
						error: "invalid_grant",
						error_description: "Invalid or expired authorization code",
					});
					return;
				}

				res.json(tokenResponse);
				return;
			}

			// Handle direct API key exchange (for backward compatibility)
			if (api_key || (!grant_type && req.body.api_key)) {
				const key = api_key || req.body.api_key;
				const tokenResponse = await exchangeApiKeyForToken(key);

				if (!tokenResponse) {
					res.status(401).json({
						error: "invalid_grant",
						error_description: "Invalid InfraNodus API key",
					});
					return;
				}

				res.json(tokenResponse);
				return;
			}

			res.status(400).json({
				error: "unsupported_grant_type",
				error_description: "Supported grant types: authorization_code, api_key",
			});
		} catch (error) {
			console.error("Token exchange error:", error);
			res.status(500).json({
				error: "server_error",
				error_description: "Internal server error",
			});
		}
	}
);

/**
 * POST /oauth/revoke - Revoke an access token
 */
app.post("/oauth/revoke", authMiddleware, (req: Request, res: Response) => {
	const auth = getAuth(req);
	if (auth) {
		revokeSession(auth.sessionId);
	}
	res.status(200).json({ revoked: true });
});

/**
 * GET /.well-known/oauth-authorization-server - OAuth2 Authorization Server Metadata (RFC 8414)
 */
app.get(
	"/.well-known/oauth-authorization-server",
	(req: Request, res: Response) => {
		const baseUrl = `${req.protocol}://${req.get("host")}`;
		res.json({
			issuer: baseUrl,
			authorization_endpoint: `${baseUrl}/oauth/authorize`,
			token_endpoint: `${baseUrl}/oauth/token`,
			registration_endpoint: `${baseUrl}/oauth/register`,
			revocation_endpoint: `${baseUrl}/oauth/revoke`,
			token_endpoint_auth_methods_supported: [
				"client_secret_basic",
				"client_secret_post",
				"none",
			],
			grant_types_supported: ["authorization_code", "refresh_token"],
			response_types_supported: ["code"],
			code_challenge_methods_supported: ["S256", "plain"],
			scopes_supported: ["mcp", "read", "write"],
			service_documentation: `${baseUrl}/`,
		});
	}
);

/**
 * GET /.well-known/openid-configuration - OpenID Connect Discovery (some clients check this)
 */
app.get("/.well-known/openid-configuration", (req: Request, res: Response) => {
	const baseUrl = `${req.protocol}://${req.get("host")}`;
	res.json({
		issuer: baseUrl,
		authorization_endpoint: `${baseUrl}/oauth/authorize`,
		token_endpoint: `${baseUrl}/oauth/token`,
		registration_endpoint: `${baseUrl}/oauth/register`,
		revocation_endpoint: `${baseUrl}/oauth/revoke`,
		token_endpoint_auth_methods_supported: [
			"client_secret_basic",
			"client_secret_post",
			"none",
		],
		grant_types_supported: ["authorization_code", "refresh_token"],
		response_types_supported: ["code"],
		code_challenge_methods_supported: ["S256", "plain"],
		scopes_supported: ["mcp", "read", "write"],
	});
});

/**
 * GET /.well-known/oauth-protected-resource - OAuth2 Protected Resource Metadata (RFC 9728)
 * MCP clients fetch this to discover the authorization server for this resource.
 */
app.get(
	"/.well-known/oauth-protected-resource",
	(req: Request, res: Response) => {
		const baseUrl = `${req.protocol}://${req.get("host")}`;
		res.json({
			resource: baseUrl,
			authorization_servers: [baseUrl],
			scopes_supported: ["mcp", "read", "write"],
			bearer_methods_supported: ["header"],
		});
	}
);

// ============================================================================
// MCP Endpoints
// ============================================================================

/**
 * Handle MCP requests with per-user sessions
 */
async function handleMcpRequest(req: Request, res: Response) {
	const auth = getAuth(req);
	if (!auth) {
		console.log("[MCP] Request rejected: no auth");
		res.status(401).json({ error: "unauthorized" });
		return;
	}

	console.log(
		`[MCP] ${req.method} request from user ${auth.userName} (${auth.userId})`
	);
	console.log(
		`[MCP] Headers:`,
		JSON.stringify({
			"content-type": req.headers["content-type"],
			"mcp-session-id": req.headers["mcp-session-id"],
			accept: req.headers["accept"],
		})
	);
	console.log(`[MCP] Body:`, JSON.stringify(req.body));

	// Use session ID as the transport key
	const sessionId = auth.sessionId;
	let transport = transports.get(sessionId);

	// Check for existing session ID in request (for session reuse)
	const existingSessionId = req.headers["mcp-session-id"] as string | undefined;
	if (existingSessionId) {
		console.log(
			`[MCP] Existing MCP session ID in header: ${existingSessionId}`
		);
	}

	// Check if this is an initialize request - if so, close old transport and create fresh one
	const isInitializeRequest = req.body?.method === "initialize";
	if (isInitializeRequest && transport) {
		console.log(
			`[MCP] Received initialize on existing session, closing old transport`
		);
		try {
			await transport.close();
		} catch (e) {
			// Ignore close errors
		}
		transports.delete(sessionId);
		transport = undefined;
	}

	if (!transport) {
		console.log(`[MCP] Creating new transport for session ${sessionId}`);
		// Create new transport for this session
		transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: () => sessionId,
			onsessioninitialized: (newSessionId) => {
				console.log(`[MCP] Session initialized: ${newSessionId}`);
			},
		});

		// Create MCP server with this user's API key
		const config = {
			apiKey: auth.apiKey,
			apiBase: INFRANODUS_API_BASE,
		};
		const server = createServer({ config });

		// Connect transport to server
		await server.connect(transport);
		console.log(`[MCP] Server connected to transport`);

		// Store transport
		transports.set(sessionId, transport);

		// Clean up on close
		transport.onclose = () => {
			console.log(`[MCP] Transport closed for session ${sessionId}`);
			transports.delete(sessionId);
		};
	} else {
		console.log(`[MCP] Reusing existing transport for session ${sessionId}`);
	}

	try {
		// Capture ALL response data for logging (including raw writes)
		const originalWrite = res.write.bind(res);
		const originalEnd = res.end.bind(res);
		const originalSetHeader = res.setHeader.bind(res);

		res.setHeader = (name: string, value: any) => {
			console.log(`[MCP] Response header: ${name} = ${value}`);
			return originalSetHeader(name, value);
		};

		res.write = (chunk: any, ...args: any[]) => {
			const data = typeof chunk === "string" ? chunk : chunk?.toString?.();
			console.log(`[MCP] Response write:`, data?.slice(0, 500));
			return (originalWrite as any)(chunk, ...args);
		};

		res.end = (chunk?: any, ...args: any[]) => {
			if (chunk) {
				const data = typeof chunk === "string" ? chunk : chunk?.toString?.();
				console.log(`[MCP] Response end with data:`, data?.slice(0, 500));
			}
			console.log(`[MCP] Response ended, status: ${res.statusCode}`);
			return (originalEnd as any)(chunk, ...args);
		};

		// Handle the request (cast to IncomingMessage for MCP SDK compatibility)
		await transport.handleRequest(
			req as unknown as import("http").IncomingMessage,
			res as unknown as import("http").ServerResponse,
			req.body
		);
		console.log(`[MCP] handleRequest completed`);
	} catch (error) {
		console.error(`[MCP] Error handling request:`, error);
		throw error;
	}
}

/**
 * POST /mcp - Handle MCP messages
 */
app.post("/mcp", authMiddleware, async (req: Request, res: Response) => {
	try {
		await handleMcpRequest(req, res);
	} catch (error) {
		console.error("MCP POST error:", error);
		if (!res.headersSent) {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

/**
 * GET /mcp - Auto-detect transport:
 *   SSE client (no mcp-session-id, Accept: text/event-stream) → SSE transport
 *   Streamable HTTP client (has mcp-session-id) → existing Streamable HTTP
 */
app.get("/mcp", authMiddleware, async (req: Request, res: Response) => {
	try {
		const wantsSSE =
			!req.headers["mcp-session-id"] &&
			req.headers.accept?.includes("text/event-stream");

		if (wantsSSE) {
			await handleSseConnection(req, res);
		} else {
			await handleMcpRequest(req, res);
		}
	} catch (error) {
		console.error("MCP GET /mcp error:", error);
		if (!res.headersSent) {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

/**
 * DELETE /mcp - End MCP session
 */
app.delete("/mcp", authMiddleware, async (req: Request, res: Response) => {
	try {
		await handleMcpRequest(req, res);
	} catch (error) {
		console.error("MCP DELETE error:", error);
		if (!res.headersSent) {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

// ============================================================================
// Legacy SSE Transport Endpoints (for clients like Make.com)
// ============================================================================

/**
 * Shared helper: establish an SSE connection for the authenticated user.
 * Creates an SSEServerTransport, wires up an MCP server, and starts streaming.
 */
async function handleSseConnection(req: Request, res: Response): Promise<void> {
	const auth = getAuth(req);
	if (!auth) {
		res.status(401).json({ error: "unauthorized" });
		return;
	}

	console.log(`[SSE] New SSE connection from ${auth.userName} (${auth.userId})`);

	const transport = new SSEServerTransport("/message", res);
	const sessionId = transport.sessionId;
	sseTransports.set(sessionId, transport);

	const config = {
		apiKey: auth.apiKey,
		apiBase: INFRANODUS_API_BASE,
	};
	const server = createServer({ config });

	transport.onclose = () => {
		console.log(`[SSE] Transport closed for session ${sessionId}`);
		sseTransports.delete(sessionId);
	};

	await server.connect(transport);
	console.log(`[SSE] Server connected, session ${sessionId}`);
}

/**
 * GET /sse - Establish SSE stream (legacy MCP transport)
 * The client connects here first to get an SSE stream, then POSTs messages to /message
 */
app.get("/sse", authMiddleware, async (req: Request, res: Response) => {
	try {
		await handleSseConnection(req, res);
	} catch (error) {
		console.error("SSE GET /sse error:", error);
		if (!res.headersSent) {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

/**
 * POST /message - Receive messages from SSE clients (legacy MCP transport)
 */
app.post("/message", authMiddleware, async (req: Request, res: Response) => {
	const sessionId = req.query.sessionId as string;
	if (!sessionId) {
		res.status(400).json({ error: "Missing sessionId query parameter" });
		return;
	}

	const transport = sseTransports.get(sessionId);
	if (!transport) {
		res.status(404).json({ error: "Session not found. The SSE connection may have been closed." });
		return;
	}

	console.log(`[SSE] POST /message for session ${sessionId}`);
	try {
		await transport.handlePostMessage(req, res, req.body);
	} catch (error) {
		console.error(`[SSE] Error handling message:`, error);
		if (!res.headersSent) {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

// ============================================================================
// Health & Status Endpoints
// ============================================================================

/**
 * GET /health - Health check endpoint
 */
app.get("/health", (req: Request, res: Response) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		sessions: getSessionCount(),
		transports: transports.size,
	});
});

/**
 * GET / - Server info (only when no auth header and not an MCP/SSE client)
 */
app.get("/", (req: Request, res: Response, next: NextFunction) => {
	// If auth header is present, treat as MCP request
	if (req.headers.authorization) {
		return next();
	}
	// If client wants SSE or MCP, let it fall through to authMiddleware (→ 401 triggers OAuth)
	if (req.headers.accept?.includes("text/event-stream")) {
		return next();
	}
	res.json({
		name: "InfraNodus MCP Server",
		version: "1.2.4",
		description: "MCP server for InfraNodus knowledge graph analysis",
		endpoints: {
			oauth: {
				token: "POST /oauth/token",
				revoke: "POST /oauth/revoke",
				metadata: "GET /.well-known/oauth-authorization-server",
			},
			mcp: {
				messages: "POST / or POST /mcp",
				notifications: "GET / or GET /mcp",
				disconnect: "DELETE / or DELETE /mcp",
			},
			health: "GET /health",
		},
		authentication: "Bearer token (obtain via /oauth/token with api_key)",
	});
});

/**
 * POST / - Handle MCP messages at root (for clients that POST to base URL)
 */
app.post("/", authMiddleware, async (req: Request, res: Response) => {
	try {
		console.log(`[MCP] Handling POST / as MCP request`);
		await handleMcpRequest(req, res);
	} catch (error) {
		console.error("MCP POST / error:", error);
		if (!res.headersSent) {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

/**
 * GET / with auth - Auto-detect transport:
 *   SSE client (no mcp-session-id, Accept: text/event-stream) → SSE transport
 *   Streamable HTTP client (has mcp-session-id) → existing Streamable HTTP
 */
app.get("/", authMiddleware, async (req: Request, res: Response) => {
	try {
		const wantsSSE =
			!req.headers["mcp-session-id"] &&
			req.headers.accept?.includes("text/event-stream");

		if (wantsSSE) {
			await handleSseConnection(req, res);
		} else {
			await handleMcpRequest(req, res);
		}
	} catch (error) {
		console.error("MCP GET / error:", error);
		if (!res.headersSent) {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

/**
 * DELETE / - End MCP session at root
 */
app.delete("/", authMiddleware, async (req: Request, res: Response) => {
	try {
		await handleMcpRequest(req, res);
	} catch (error) {
		console.error("MCP DELETE / error:", error);
		if (!res.headersSent) {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

// ============================================================================
// Start Server
// ============================================================================

// Handle graceful shutdown
process.on("SIGINT", () => {
	console.log("\nShutting down HTTP server...");
	for (const transport of transports.values()) {
		transport.close();
	}
	for (const transport of sseTransports.values()) {
		transport.close();
	}
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\nShutting down HTTP server...");
	for (const transport of transports.values()) {
		transport.close();
	}
	for (const transport of sseTransports.values()) {
		transport.close();
	}
	process.exit(0);
});

// Start the server
app.listen(PORT, () => {
	console.log(`InfraNodus MCP HTTP Server running on port ${PORT}`);
	console.log(`  - Health: http://localhost:${PORT}/health`);
	console.log(`  - OAuth token: POST http://localhost:${PORT}/oauth/token`);
	console.log(`  - MCP endpoint: http://localhost:${PORT}/mcp`);
	console.log(`  - SSE endpoint: http://localhost:${PORT}/sse (legacy)`);
	console.log("");
	console.log("Environment:");
	console.log(`  - CORS_ORIGIN: ${CORS_ORIGIN}`);
	console.log(`  - INFRANODUS_API_BASE: ${INFRANODUS_API_BASE}`);
	console.log(
		`  - JWT_SECRET: ${process.env.JWT_SECRET ? "[set]" : "[generated]"}`
	);
});
