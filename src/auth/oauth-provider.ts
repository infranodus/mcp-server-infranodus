/**
 * OAuth2-style authentication provider for the MCP HTTP server
 * Validates InfraNodus API keys and issues JWT access tokens
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
	InfraNodusUserInfo,
	TokenPayload,
	TokenResponse,
	SessionData,
	AuthenticatedRequest,
	RegisteredClient,
	ClientRegistrationRequest,
	ClientRegistrationResponse,
	AuthorizationCode,
} from "./types.js";

// In-memory stores
const sessions = new Map<string, SessionData>();
const clients = new Map<string, RegisteredClient>();
const authorizationCodes = new Map<string, AuthorizationCode>();

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_EXPIRY_SECONDS = 86400 * 365 * 100; // 100 years - effectively never expires
const INFRANODUS_API_BASE = process.env.INFRANODUS_API_BASE || "https://infranodus.com/api/v1";

/**
 * Hash an API key for storage in JWT (we don't store the actual key in the token)
 */
function hashApiKey(apiKey: string): string {
	return crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

/**
 * Validate an InfraNodus API key by calling the /api/v1/userId endpoint
 * Returns user info if valid, null if invalid
 */
export async function validateApiKey(apiKey: string): Promise<InfraNodusUserInfo | null> {
	try {
		const response = await fetch(`${INFRANODUS_API_BASE}/userId`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({}),
		});

		if (!response.ok) {
			return null;
		}

		const data = await response.json();

		// Check for valid response format: {"userId": 486, "userName": "circadian"}
		if (data && typeof data.userId === "number" && typeof data.userName === "string") {
			return {
				userId: data.userId,
				userName: data.userName,
			};
		}

		// Check for error indicators
		if (!data || data.error || typeof data === "string") {
			return null;
		}

		return null;
	} catch (error) {
		// Network error or invalid response
		return null;
	}
}

/**
 * Exchange an InfraNodus API key for a JWT access token
 */
export async function exchangeApiKeyForToken(apiKey: string): Promise<TokenResponse | null> {
	// Validate the API key against InfraNodus
	const userInfo = await validateApiKey(apiKey);
	if (!userInfo) {
		return null;
	}

	// Create a stateless session ID (just for tracking, not stored in memory)
	const sessionId = crypto.randomUUID();

	// Create JWT payload - include API key directly for stateless verification
	// The JWT is signed so it can't be tampered with
	const payload = {
		type: "access_token",
		userId: userInfo.userId,
		userName: userInfo.userName,
		apiKey: apiKey, // Include API key for stateless verification
		sessionId: sessionId,
	};

	// Sign JWT
	const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY_SECONDS });

	return {
		access_token: accessToken,
		token_type: "Bearer",
		expires_in: TOKEN_EXPIRY_SECONDS,
	};
}

/**
 * Verify a JWT access token and return the authenticated request context
 * This is now stateless - all info is in the JWT itself
 */
export function verifyAccessToken(token: string): AuthenticatedRequest | null {
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as {
			type?: string;
			userId: number;
			userName: string;
			apiKey?: string;
			apiKeyHash?: string;  // Old format
			sessionId: string;
		};

		// Check if this is an auth_code being used as access token (wrong!)
		if (decoded.type === "auth_code") {
			console.log(`[AUTH] Received auth_code instead of access_token`);
			return null;
		}

		// Need API key in the token for stateless verification
		if (!decoded.apiKey) {
			console.log(`[AUTH] Token missing apiKey - old format token, needs re-auth`);
			return null;
		}

		// All info is in the JWT - no need to look up session
		return {
			userId: decoded.userId,
			userName: decoded.userName,
			apiKey: decoded.apiKey,
			sessionId: decoded.sessionId,
		};
	} catch (error: any) {
		// Invalid or expired token
		console.log(`[AUTH] JWT verification error: ${error.message}`);
		return null;
	}
}

/**
 * Revoke a session (logout)
 */
export function revokeSession(sessionId: string): boolean {
	return sessions.delete(sessionId);
}

/**
 * Get session count (for monitoring)
 */
export function getSessionCount(): number {
	return sessions.size;
}

/**
 * Clean up expired sessions (call periodically)
 */
export function cleanupExpiredSessions(): number {
	const now = Date.now();
	const expiryMs = TOKEN_EXPIRY_SECONDS * 1000;
	let cleaned = 0;

	for (const [sessionId, session] of sessions.entries()) {
		if (now - session.createdAt > expiryMs) {
			sessions.delete(sessionId);
			cleaned++;
		}
	}

	return cleaned;
}

// Start periodic cleanup every 10 minutes
setInterval(() => {
	cleanupExpiredSessions();
	cleanupExpiredAuthCodes();
}, 10 * 60 * 1000);

// ============================================================================
// OAuth2 Dynamic Client Registration (RFC 7591)
// ============================================================================

/**
 * Register a new OAuth2 client
 */
export function registerClient(request: ClientRegistrationRequest): ClientRegistrationResponse {
	const clientId = crypto.randomUUID();
	const clientSecret = crypto.randomBytes(32).toString("hex");

	const client: RegisteredClient = {
		client_id: clientId,
		client_secret: clientSecret,
		redirect_uris: request.redirect_uris,
		client_name: request.client_name,
		created_at: Date.now(),
	};

	clients.set(clientId, client);

	return {
		client_id: clientId,
		client_secret: clientSecret,
		client_id_issued_at: Math.floor(Date.now() / 1000),
		client_secret_expires_at: 0, // Never expires
		redirect_uris: request.redirect_uris,
		client_name: request.client_name,
		token_endpoint_auth_method: request.token_endpoint_auth_method || "client_secret_post",
		grant_types: request.grant_types || ["authorization_code"],
		response_types: request.response_types || ["code"],
		scope: request.scope,
	};
}

/**
 * Get a registered client by ID
 */
export function getClient(clientId: string): RegisteredClient | null {
	return clients.get(clientId) || null;
}

/**
 * Validate client credentials
 */
export function validateClient(clientId: string, clientSecret?: string): boolean {
	const client = clients.get(clientId);
	if (!client) return false;
	if (clientSecret && client.client_secret !== clientSecret) return false;
	return true;
}

/**
 * Validate redirect URI for a client
 */
export function validateRedirectUri(clientId: string, redirectUri: string): boolean {
	const client = clients.get(clientId);
	if (!client) return false;
	return client.redirect_uris.includes(redirectUri);
}

// ============================================================================
// OAuth2 Authorization Code Flow
// ============================================================================

const AUTH_CODE_EXPIRY_SECONDS = 600; // 10 minutes

/**
 * Create an authorization code (as a signed JWT for stateless validation across instances)
 */
export function createAuthorizationCode(
	clientId: string,
	redirectUri: string,
	apiKey: string,
	scope?: string,
	codeChallenge?: string,
	codeChallengeMethod?: string
): string {
	// Create a JWT-based authorization code that can be validated by any instance
	const payload = {
		type: "auth_code",
		client_id: clientId,
		redirect_uri: redirectUri,
		api_key: apiKey, // Encrypted or hashed in production
		scope,
		code_challenge: codeChallenge,
		code_challenge_method: codeChallengeMethod,
	};

	const code = jwt.sign(payload, JWT_SECRET, { expiresIn: AUTH_CODE_EXPIRY_SECONDS });
	return code;
}

interface AuthCodePayload {
	type: string;
	client_id: string;
	redirect_uri: string;
	api_key: string;
	scope?: string;
	code_challenge?: string;
	code_challenge_method?: string;
}

// Track used codes to prevent replay — stores hash → timestamp for TTL cleanup
const usedCodes = new Map<string, number>();

/**
 * Exchange authorization code for token
 */
export async function exchangeAuthorizationCode(
	code: string,
	clientId: string,
	redirectUri: string,
	codeVerifier?: string
): Promise<TokenResponse | null> {
	try {
		// Decode the JWT-based authorization code
		const authCode = jwt.verify(code, JWT_SECRET) as AuthCodePayload;

		// Validate it's an auth code
		if (authCode.type !== "auth_code") return null;

		// Validate client_id and redirect_uri match
		if (authCode.client_id !== clientId) return null;
		if (authCode.redirect_uri !== redirectUri) return null;

		// Check if code was already used (replay protection)
		const codeHash = crypto.createHash("sha256").update(code).digest("hex").slice(0, 16);
		if (usedCodes.has(codeHash)) return null;
		usedCodes.set(codeHash, Date.now());

		// Validate PKCE if used
		if (authCode.code_challenge) {
			if (!codeVerifier) return null;

			let computedChallenge: string;
			if (authCode.code_challenge_method === "S256") {
				computedChallenge = crypto
					.createHash("sha256")
					.update(codeVerifier)
					.digest("base64url");
			} else {
				computedChallenge = codeVerifier; // plain method
			}

			if (computedChallenge !== authCode.code_challenge) return null;
		}

		// Exchange the API key for a token
		return exchangeApiKeyForToken(authCode.api_key);
	} catch (error) {
		// Invalid or expired JWT
		return null;
	}
}

/**
 * Clean up expired authorization codes
 */
function cleanupExpiredAuthCodes(): number {
	const now = Date.now();
	let cleaned = 0;

	for (const [code, authCode] of authorizationCodes.entries()) {
		if (authCode.expires_at < now) {
			authorizationCodes.delete(code);
			cleaned++;
		}
	}

	// Clean up used code hashes older than the auth code expiry window
	const usedCodeTtlMs = AUTH_CODE_EXPIRY_SECONDS * 1000;
	for (const [hash, timestamp] of usedCodes.entries()) {
		if (now - timestamp > usedCodeTtlMs) {
			usedCodes.delete(hash);
			cleaned++;
		}
	}

	return cleaned;
}
