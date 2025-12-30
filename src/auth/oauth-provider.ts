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
} from "./types.js";

// In-memory session store (maps session ID to session data)
const sessions = new Map<string, SessionData>();

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour
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

	// Create session
	const sessionId = crypto.randomUUID();
	const sessionData: SessionData = {
		userId: userInfo.userId,
		userName: userInfo.userName,
		apiKey: apiKey,
		createdAt: Date.now(),
	};
	sessions.set(sessionId, sessionData);

	// Create JWT payload
	const payload: Omit<TokenPayload, "iat" | "exp"> = {
		userId: userInfo.userId,
		userName: userInfo.userName,
		apiKeyHash: hashApiKey(apiKey),
	};

	// Sign JWT
	const accessToken = jwt.sign(
		{ ...payload, sessionId },
		JWT_SECRET,
		{ expiresIn: TOKEN_EXPIRY_SECONDS }
	);

	return {
		access_token: accessToken,
		token_type: "Bearer",
		expires_in: TOKEN_EXPIRY_SECONDS,
	};
}

/**
 * Verify a JWT access token and return the authenticated request context
 */
export function verifyAccessToken(token: string): AuthenticatedRequest | null {
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload & { sessionId: string };

		// Get session data
		const sessionData = sessions.get(decoded.sessionId);
		if (!sessionData) {
			return null;
		}

		// Verify the API key hash matches
		if (hashApiKey(sessionData.apiKey) !== decoded.apiKeyHash) {
			return null;
		}

		return {
			userId: decoded.userId,
			userName: decoded.userName,
			apiKey: sessionData.apiKey,
			sessionId: decoded.sessionId,
		};
	} catch (error) {
		// Invalid or expired token
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
}, 10 * 60 * 1000);
