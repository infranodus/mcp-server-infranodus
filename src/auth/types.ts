/**
 * Auth-related types for the HTTP server
 */

export interface InfraNodusUserInfo {
	userId: number;
	userName: string;
}

export interface TokenPayload {
	userId: number;
	userName: string;
	apiKeyHash: string; // Hash of the API key for verification
	iat: number;
	exp: number;
}

export interface TokenResponse {
	access_token: string;
	token_type: "Bearer";
	expires_in: number;
}

export interface TokenRequest {
	api_key: string;
	grant_type?: "api_key"; // We use api_key as the grant type
}

export interface SessionData {
	userId: number;
	userName: string;
	apiKey: string; // The actual API key for making InfraNodus requests
	createdAt: number;
}

export interface AuthenticatedRequest {
	userId: number;
	userName: string;
	apiKey: string;
	sessionId: string;
}

export interface ErrorResponse {
	error: string;
	error_description?: string;
}
