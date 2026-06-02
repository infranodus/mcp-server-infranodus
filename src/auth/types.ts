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
	apiKey: string; // The actual API key for making KeywordGraph requests
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

// OAuth2 Dynamic Client Registration (RFC 7591)
export interface ClientRegistrationRequest {
	redirect_uris: string[];
	client_name?: string;
	token_endpoint_auth_method?: string;
	grant_types?: string[];
	response_types?: string[];
	scope?: string;
}

export interface ClientRegistrationResponse {
	client_id: string;
	client_secret?: string;
	client_id_issued_at?: number;
	client_secret_expires_at?: number;
	redirect_uris: string[];
	client_name?: string;
	token_endpoint_auth_method: string;
	grant_types: string[];
	response_types: string[];
	scope?: string;
}

export interface RegisteredClient {
	client_id: string;
	client_secret: string;
	redirect_uris: string[];
	client_name?: string;
	created_at: number;
}

// OAuth2 Authorization Code Flow
export interface AuthorizationRequest {
	response_type: string;
	client_id: string;
	redirect_uri: string;
	scope?: string;
	state?: string;
	code_challenge?: string;
	code_challenge_method?: string;
}

export interface AuthorizationCode {
	code: string;
	client_id: string;
	redirect_uri: string;
	api_key: string; // The KeywordGraph API key provided during authorization
	scope?: string;
	code_challenge?: string;
	code_challenge_method?: string;
	expires_at: number;
}

export interface TokenRequestAuthCode {
	grant_type: "authorization_code";
	code: string;
	redirect_uri: string;
	client_id: string;
	code_verifier?: string;
}
