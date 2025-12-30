/**
 * HTTP Server entry point for InfraNodus MCP Server
 * Exposes the MCP server over HTTP with OAuth2-style authentication
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import createServer from "./index.js";
import {
	exchangeApiKeyForToken,
	verifyAccessToken,
	revokeSession,
	getSessionCount,
} from "./auth/oauth-provider.js";
import { TokenRequest, ErrorResponse, AuthenticatedRequest } from "./auth/types.js";

// Load environment variables
dotenv.config();

// Configuration
const PORT = parseInt(process.env.PORT || "3000", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const INFRANODUS_API_BASE = process.env.INFRANODUS_API_BASE || "https://infranodus.com/api/v1";

// Store auth info on request (using a symbol to avoid conflicts with MCP SDK)
const AUTH_KEY = Symbol("auth");

interface AuthenticatedExpressRequest extends Request {
	[AUTH_KEY]?: AuthenticatedRequest;
}

// Create Express app
const app = express();

// Middleware
app.use(helmet({
	contentSecurityPolicy: false, // Disable for SSE compatibility
}));
app.use(cors({
	origin: CORS_ORIGIN,
	credentials: true,
}));
app.use(express.json());

// Store transports per session for MCP
const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * Auth middleware - validates Bearer token and attaches auth info to request
 */
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		const error: ErrorResponse = {
			error: "unauthorized",
			error_description: "Missing or invalid Authorization header",
		};
		res.status(401).json(error);
		return;
	}

	const token = authHeader.slice(7); // Remove "Bearer " prefix
	const authInfo = verifyAccessToken(token);

	if (!authInfo) {
		const error: ErrorResponse = {
			error: "invalid_token",
			error_description: "Access token is invalid or expired",
		};
		res.status(401).json(error);
		return;
	}

	(req as AuthenticatedExpressRequest)[AUTH_KEY] = authInfo;
	next();
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
 * POST /oauth/token - Exchange InfraNodus API key for access token
 */
app.post("/oauth/token", async (req: Request, res: Response) => {
	try {
		const body = req.body as TokenRequest;

		if (!body.api_key) {
			const error: ErrorResponse = {
				error: "invalid_request",
				error_description: "Missing api_key parameter",
			};
			res.status(400).json(error);
			return;
		}

		const tokenResponse = await exchangeApiKeyForToken(body.api_key);

		if (!tokenResponse) {
			const error: ErrorResponse = {
				error: "invalid_grant",
				error_description: "Invalid InfraNodus API key",
			};
			res.status(401).json(error);
			return;
		}

		res.json(tokenResponse);
	} catch (error) {
		console.error("Token exchange error:", error);
		const errorResponse: ErrorResponse = {
			error: "server_error",
			error_description: "Internal server error",
		};
		res.status(500).json(errorResponse);
	}
});

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
 * GET /.well-known/oauth-authorization-server - OAuth2 metadata
 */
app.get("/.well-known/oauth-authorization-server", (req: Request, res: Response) => {
	const baseUrl = `${req.protocol}://${req.get("host")}`;
	res.json({
		issuer: baseUrl,
		token_endpoint: `${baseUrl}/oauth/token`,
		revocation_endpoint: `${baseUrl}/oauth/revoke`,
		token_endpoint_auth_methods_supported: ["none"],
		grant_types_supported: ["api_key"],
		response_types_supported: ["token"],
	});
});

// ============================================================================
// MCP Endpoints
// ============================================================================

/**
 * Handle MCP requests with per-user sessions
 */
async function handleMcpRequest(req: Request, res: Response) {
	const auth = getAuth(req);
	if (!auth) {
		res.status(401).json({ error: "unauthorized" });
		return;
	}

	// Use session ID as the transport key
	const sessionId = auth.sessionId;
	let transport = transports.get(sessionId);

	// Check for existing session ID in request (for session reuse)
	const existingSessionId = req.headers["mcp-session-id"] as string | undefined;

	if (!transport) {
		// Create new transport for this session
		transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: () => sessionId,
			onsessioninitialized: (newSessionId) => {
				// Session initialized
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

		// Store transport
		transports.set(sessionId, transport);

		// Clean up on close
		transport.onclose = () => {
			transports.delete(sessionId);
		};
	}

	// Handle the request (cast to IncomingMessage for MCP SDK compatibility)
	await transport.handleRequest(
		req as unknown as import("http").IncomingMessage,
		res as unknown as import("http").ServerResponse,
		req.body
	);
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
 * GET /mcp - SSE endpoint for server-to-client notifications
 */
app.get("/mcp", authMiddleware, async (req: Request, res: Response) => {
	try {
		await handleMcpRequest(req, res);
	} catch (error) {
		console.error("MCP GET error:", error);
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
 * GET / - Server info
 */
app.get("/", (req: Request, res: Response) => {
	res.json({
		name: "InfraNodus MCP Server",
		version: "1.0.0",
		description: "MCP server for InfraNodus knowledge graph analysis",
		endpoints: {
			oauth: {
				token: "POST /oauth/token",
				revoke: "POST /oauth/revoke",
				metadata: "GET /.well-known/oauth-authorization-server",
			},
			mcp: {
				messages: "POST /mcp",
				notifications: "GET /mcp",
				disconnect: "DELETE /mcp",
			},
			health: "GET /health",
		},
		authentication: "Bearer token (obtain via /oauth/token with api_key)",
	});
});

// ============================================================================
// Start Server
// ============================================================================

// Handle graceful shutdown
process.on("SIGINT", () => {
	console.log("\nShutting down HTTP server...");
	// Close all transports
	for (const transport of transports.values()) {
		transport.close();
	}
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\nShutting down HTTP server...");
	for (const transport of transports.values()) {
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
	console.log("");
	console.log("Environment:");
	console.log(`  - CORS_ORIGIN: ${CORS_ORIGIN}`);
	console.log(`  - INFRANODUS_API_BASE: ${INFRANODUS_API_BASE}`);
	console.log(`  - JWT_SECRET: ${process.env.JWT_SECRET ? "[set]" : "[generated]"}`);
});
