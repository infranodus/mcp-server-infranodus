// The two halves of the OAuth sign-in fix: sign-ins only return to a known
// app address or to localhost, and the API key cannot be read out of an
// authorization code or access token.
import assert from "node:assert/strict";
import { test, describe, before, after } from "node:test";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test-secret";
const { trustedRedirectApp, LOCAL_APP } = await import(
	"../dist/auth/redirect-allowlist.js"
);
const provider = await import("../dist/auth/oauth-provider.js");

const API_KEY = "sk-test-0123456789abcdef";
const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

describe("redirect allowlist", () => {
	test("accepts the known app callbacks", () => {
		for (const [uri, app] of [
			["https://claude.ai/api/mcp/auth_callback", "Claude"],
			["https://claude.com/api/mcp/auth_callback", "Claude"],
			["https://chatgpt.com/connector_platform_oauth_redirect", "ChatGPT"],
			["https://chatgpt.com/connector/oauth/abc123", "ChatGPT"],
			["https://www.cursor.com/agents/mcp/oauth/callback", "Cursor"],
			["cursor://anysphere.cursor-mcp/oauth/callback", "Cursor"],
			["https://grok.com/connectors-oauth-exchange-code/", "Grok"],
			["https://vscode.dev/redirect", "VS Code"],
			["https://www.perplexity.ai/rest/connections/oauth_callback", "Perplexity"],
		]) {
			assert.equal(trustedRedirectApp(uri), app, uri);
		}
	});

	test("accepts localhost on any port and path", () => {
		assert.equal(trustedRedirectApp("http://localhost:33418/callback"), LOCAL_APP);
		assert.equal(trustedRedirectApp("http://127.0.0.1:8787/"), LOCAL_APP);
	});

	test("refuses everything else", () => {
		for (const uri of [
			"https://attacker.example/cb",
			"https://claude.ai.attacker.example/api/mcp/auth_callback",
			"https://claude.ai@attacker.example/api/mcp/auth_callback",
			"https://claude.ai/some/other/path",
			"https://claude.ai/api/mcp/auth_callback/extra",
			"https://chatgpt.com/connector/oauth/../../evil",
			"https://chatgpt.com/c/123",
			"http://claude.ai/api/mcp/auth_callback",
			"http://localhost.attacker.example/cb",
			"https://localhost/cb",
			"vscode://evil/callback",
			"javascript:alert(1)",
			"not a url",
			"",
			undefined,
			["https://claude.ai/api/mcp/auth_callback"],
		]) {
			assert.equal(trustedRedirectApp(uri), null, String(uri));
		}
	});
});

describe("API key inside codes and tokens", () => {
	const realFetch = globalThis.fetch;
	before(() => {
		// Key validation calls the brand API; answer it locally.
		globalThis.fetch = async () =>
			new Response(JSON.stringify({ userId: 7, userName: "tester" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
	});
	after(() => {
		globalThis.fetch = realFetch;
	});

	test("the authorization code does not expose the key", () => {
		const code = provider.createAuthorizationCode(CLIENT_ID, REDIRECT, API_KEY);
		const payload = jwt.decode(code);
		assert.ok(!JSON.stringify(payload).includes(API_KEY));
		assert.equal(payload.api_key, undefined);
		assert.equal(provider.decryptApiKey(payload.api_key_enc), API_KEY);
	});

	test("a code exchanges for a token that works and hides the key", async () => {
		const code = provider.createAuthorizationCode(CLIENT_ID, REDIRECT, API_KEY);
		const token = await provider.exchangeAuthorizationCode(code, CLIENT_ID, REDIRECT);
		assert.ok(token?.access_token);
		const payload = jwt.decode(token.access_token);
		assert.ok(!JSON.stringify(payload).includes(API_KEY));
		assert.equal(payload.apiKey, undefined);

		const auth = provider.verifyAccessToken(token.access_token);
		assert.equal(auth.apiKey, API_KEY);
		assert.equal(auth.userId, 7);

		// A code is single use.
		assert.equal(
			await provider.exchangeAuthorizationCode(code, CLIENT_ID, REDIRECT),
			null,
		);
	});

	test("a code is bound to its client and redirect address", async () => {
		const code = provider.createAuthorizationCode(CLIENT_ID, REDIRECT, API_KEY);
		assert.equal(
			await provider.exchangeAuthorizationCode(
				code,
				CLIENT_ID,
				"https://chatgpt.com/connector_platform_oauth_redirect",
			),
			null,
		);
	});

	test("access tokens issued before the fix still work", () => {
		const legacy = jwt.sign(
			{
				type: "access_token",
				userId: 7,
				userName: "tester",
				apiKey: API_KEY,
				sessionId: "s",
			},
			"test-secret",
		);
		assert.equal(provider.verifyAccessToken(legacy).apiKey, API_KEY);
	});

	test("a tampered encrypted key is rejected", () => {
		const enc = provider.encryptApiKey(API_KEY);
		const flipped = enc.slice(0, -2) + (enc.endsWith("A") ? "B" : "A") + enc.slice(-1);
		assert.equal(provider.decryptApiKey(flipped), null);
		assert.equal(provider.decryptApiKey("garbage"), null);
	});
});
