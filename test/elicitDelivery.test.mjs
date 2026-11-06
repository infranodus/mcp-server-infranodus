// How an elicitation reaches the client (utils/elicitApproval.js,
// elicitOnCallStream), over a real Streamable HTTP transport on localhost.
//
// The case that failed in production: a claude.ai connector declares the
// elicitation capability but opens no standalone GET stream. A request from
// the server that is not tied to the tool call was dropped by the SDK without
// an error, the server waited its default 60 s, and the client gave up on the
// tool call first ("The operation timed out").
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
	CallToolRequestSchema,
	ElicitRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { elicitApproval, elicitOnCallStream } from "../dist/utils/elicitApproval.js";

const DIALOG = {
	message: "Save these 1 project learning(s) to learn-demo?",
	requestedSchema: {
		type: "object",
		properties: { save: { type: "boolean", title: "Save", default: true } },
		required: ["save"],
	},
};

/**
 * An MCP server on localhost whose one tool asks the user the way the real
 * tools do. `ask(server, requestId)` is the delivery under test.
 */
async function startServer(ask) {
	const server = new Server({ name: "t", version: "0" }, { capabilities: { tools: {} } });
	server.setRequestHandler(CallToolRequestSchema, async (_request, extra) => {
		const startedAt = Date.now();
		const outcome = await elicitApproval(
			{
				clientCapabilities: server.getClientCapabilities(),
				elicit: (params) => ask(server, extra.requestId, params),
			},
			DIALOG.message,
			"Save",
		);
		return {
			content: [{ type: "text", text: JSON.stringify({ outcome, ms: Date.now() - startedAt }) }],
		};
	});
	const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => "s1" });
	await server.connect(transport);
	const httpServer = http.createServer((req, res) => transport.handleRequest(req, res));
	await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
	return {
		url: new URL(`http://127.0.0.1:${httpServer.address().port}/mcp`),
		close: async () => {
			await server.close();
			httpServer.closeAllConnections();
			await new Promise((resolve) => httpServer.close(resolve));
		},
	};
}

/** Like a claude.ai connector: the standalone GET stream is refused with 405. */
const noGetStream = (input, init) =>
	(init?.method ?? "GET") === "GET"
		? Promise.resolve(new Response(null, { status: 405 }))
		: fetch(input, init);

async function connectClient(url, onElicit) {
	const client = new Client({ name: "c", version: "0" }, { capabilities: { elicitation: {} } });
	const asked = [];
	client.setRequestHandler(ElicitRequestSchema, async (request) => {
		asked.push(request.params);
		return onElicit(request.params);
	});
	await client.connect(new StreamableHTTPClientTransport(url, { fetch: noGetStream }));
	return { client, asked };
}

const outcomeOf = (result) => JSON.parse(result.content[0].text);

test("a client without a GET stream gets the dialog on the tool call's stream and its answer counts", async () => {
	const server = await startServer((s, requestId, params) => elicitOnCallStream(s, requestId, params));
	const { client, asked } = await connectClient(server.url, async () => ({
		action: "accept",
		content: { save: true },
	}));
	try {
		const { outcome, ms } = outcomeOf(await client.callTool({ name: "save", arguments: {} }));
		assert.deepEqual(outcome, { kind: "accepted", save: true });
		assert.equal(asked.length, 1);
		assert.equal(asked[0].message, DIALOG.message);
		assert.ok(ms < 2000, `answered in ${ms} ms`);
	} finally {
		await client.close();
		await server.close();
	}
});

test("not tied to the tool call, the same client never sees the dialog (the production failure)", async () => {
	// What the server did before: server.elicitInput(params) with no related
	// request. A short timeout stands in for the SDK's default 60 s.
	const server = await startServer((s, _requestId, params) => s.elicitInput(params, { timeout: 400 }));
	const { client, asked } = await connectClient(server.url, async () => ({
		action: "accept",
		content: { save: true },
	}));
	try {
		const { outcome, ms } = outcomeOf(await client.callTool({ name: "save", arguments: {} }));
		assert.equal(outcome.kind, "unavailable");
		assert.match(outcome.detail, /timed out/i);
		assert.equal(asked.length, 0, "the request was dropped, the user was never asked");
		assert.ok(ms >= 400, "the server waited out the whole timeout");
	} finally {
		await client.close();
		await server.close();
	}
});

test("a client that never answers requests from the server gets the plan back after the short check, not after the answer time", async () => {
	const server = await startServer((s, requestId, params) =>
		elicitOnCallStream(s, requestId, params, { reachableMs: 300, answerMs: 30_000 }),
	);
	// A bare HTTP client: declares elicitation, reads the call's stream, and
	// answers nothing the server asks (no ping reply, no dialog).
	const post = (body, sessionId) =>
		fetch(server.url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
				...(sessionId ? { "mcp-session-id": sessionId, "mcp-protocol-version": "2025-06-18" } : {}),
			},
			body: JSON.stringify(body),
		});
	try {
		const init = await post({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-06-18",
				capabilities: { elicitation: {} },
				clientInfo: { name: "silent", version: "0" },
			},
		});
		const sessionId = init.headers.get("mcp-session-id");
		await init.text();
		await (await post({ jsonrpc: "2.0", method: "notifications/initialized" }, sessionId)).text();

		const startedAt = Date.now();
		const call = await post(
			{ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "save", arguments: {} } },
			sessionId,
		);
		const stream = await call.text();
		const elapsed = Date.now() - startedAt;

		const messages = stream
			.split("\n")
			.filter((line) => line.startsWith("data: "))
			.map((line) => JSON.parse(line.slice(6)));
		assert.equal(messages[0].method, "ping", "the check goes out on the call's own stream");
		assert.ok(!messages.some((m) => m.method === "elicitation/create"), "no dialog is sent to a client that does not answer");
		const result = messages.find((m) => m.id === 2 && m.result);
		const { outcome } = JSON.parse(result.result.content[0].text);
		assert.deepEqual(outcome, {
			kind: "unavailable",
			detail: "elicitation failed: the client did not answer a request from the server",
		});
		assert.ok(elapsed < 3000, `the tool answered in ${elapsed} ms`);
	} finally {
		await server.close();
	}
});

test("the dialog is tied to the call and both waits are bounded; stdio (no call stream) still asks", async () => {
	const calls = [];
	const fake = {
		request: async (request, _schema, options) => {
			calls.push(["request", request.method, options]);
			return {};
		},
		elicitInput: async (params, options) => {
			calls.push(["elicitInput", params.message, options]);
			return { action: "decline" };
		},
	};
	assert.deepEqual(await elicitOnCallStream(fake, 7, DIALOG), { action: "decline" });
	assert.deepEqual(calls, [
		["request", "ping", { relatedRequestId: 7, timeout: 3_000 }],
		["elicitInput", DIALOG.message, { relatedRequestId: 7, timeout: 45_000 }],
	]);

	calls.length = 0;
	await elicitOnCallStream(fake, undefined, DIALOG);
	assert.deepEqual(calls.map((c) => c[2]), [{ timeout: 3_000 }, { timeout: 45_000 }]);
});

test("a client that fails the check is never sent the dialog", async () => {
	let elicited = false;
	const fake = {
		request: async () => {
			throw new Error("Request timed out");
		},
		elicitInput: async () => {
			elicited = true;
			return { action: "accept", content: { save: true } };
		},
	};
	await assert.rejects(
		elicitOnCallStream(fake, 7, DIALOG),
		/the client did not answer a request from the server/,
	);
	assert.equal(elicited, false);
});
