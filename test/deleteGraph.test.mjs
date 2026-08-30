// Drive delete_graph through its real handler and an intercepted fetch
// (no network): the consent flow and the request shape against the app's
// /deleteGraph contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { deleteGraphTool } from "../dist/tools/deleteGraph.js";
import { DeleteGraphSchema } from "../dist/schemas/index.js";

const GRAPH = "repo-x-docs";
const GRAPH_URL = "https://infranodus.com/u/repo-x-docs/edit";

function fakeResponse(json, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => json,
		text: async () => JSON.stringify(json),
	};
}

function stubFetch({ graphs = [{ id: 1, contextName: GRAPH, defaultRevisionUrl: GRAPH_URL }], isLive = false, failWrite = null } = {}) {
	const calls = [];
	globalThis.fetch = async (url, init) => {
		const body = JSON.parse(init.body);
		const entry = { url: String(url), body };
		calls.push(entry);
		if (entry.url.includes("/listGraphs")) return fakeResponse(graphs);
		if (entry.url.includes("/deleteGraph")) {
			if (!body.dryRun && failWrite) return fakeResponse({ error: failWrite.error }, failWrite.status);
			return fakeResponse({
				graphName: GRAPH,
				graphUrl: GRAPH_URL,
				isLive,
				deleted: !body.dryRun,
				dryRun: !!body.dryRun,
			});
		}
		throw new Error(`unexpected request: ${entry.url}`);
	};
	return calls;
}

const deleteCalls = (calls) => calls.filter((c) => c.url.includes("/deleteGraph"));

async function run(params, extra) {
	return runWithConfig({ apiBase: "https://api.test", apiKey: "k" }, () =>
		deleteGraphTool.handler(params, extra),
	);
}

function withStub(options, fn) {
	return async () => {
		const originalFetch = globalThis.fetch;
		const calls = stubFetch(options);
		try {
			await fn(calls);
		} finally {
			globalThis.fetch = originalFetch;
		}
	};
}

test(
	"(a) without confirm the only /deleteGraph call is a dry run and nothing is deleted",
	withStub({ isLive: true }, async (calls) => {
		const result = await run({ graphName: GRAPH, confirm: false });
		assert.ok(!result.isError, JSON.stringify(result));
		const deletes = deleteCalls(calls);
		assert.equal(deletes.length, 1, "exactly one /deleteGraph call");
		assert.equal(deletes[0].body.name, GRAPH);
		assert.equal(deletes[0].body.dryRun, true);
		const report = JSON.parse(result.content[0].text);
		assert.equal(report.deleted, false);
		assert.equal(report.dryRun, true);
		assert.equal(report.isLive, true);
		assert.equal(report.graphUrl, GRAPH_URL);
		assert.match(report.nextStep, /confirm: true/);
	}),
);

test(
	"(b) confirm: true previews then deletes once with the same name",
	withStub({}, async (calls) => {
		const result = await run({ graphName: GRAPH, confirm: true });
		assert.ok(!result.isError, JSON.stringify(result));
		const deletes = deleteCalls(calls);
		assert.equal(deletes.length, 2, "dry run then write");
		assert.equal(deletes[0].body.dryRun, true);
		assert.equal(deletes[1].body.dryRun, false);
		assert.equal(deletes[1].body.name, GRAPH);
		const report = JSON.parse(result.content[0].text);
		assert.equal(report.deleted, true);
		assert.equal(report.graphName, GRAPH);
	}),
);

test(
	"(c) a graph that is not in the account is an error before any /deleteGraph call",
	withStub({ graphs: [] }, async (calls) => {
		const result = await run({ graphName: "missing", confirm: true });
		assert.ok(result.isError);
		assert.equal(deleteCalls(calls).length, 0);
		assert.match(JSON.parse(result.content[0].text).error, /No graph named "missing"/);
	}),
);

test(
	"(d) the request never carries a userName and the schema has none",
	withStub({}, async (calls) => {
		await run({ graphName: GRAPH, confirm: true });
		for (const call of deleteCalls(calls)) assert.equal("userName" in call.body, false);
		assert.equal("userName" in DeleteGraphSchema.shape, false);
		assert.equal(DeleteGraphSchema.parse({ graphName: "g" }).confirm, false);
	}),
);

test(
	"(e) an accepted elicitation deletes in the same call; the prompt names the graph",
	withStub({ isLive: true }, async (calls) => {
		let message = "";
		const extra = {
			clientCapabilities: { elicitation: {} },
			elicit: async (request) => {
				message = request.message;
				return { action: "accept", content: {} };
			},
		};
		const result = await run({ graphName: GRAPH }, extra);
		assert.ok(!result.isError, JSON.stringify(result));
		assert.equal(deleteCalls(calls).length, 2);
		assert.equal(deleteCalls(calls)[1].body.dryRun, false);
		assert.match(message, new RegExp(GRAPH));
		assert.match(message, /live graph/);
		assert.equal(JSON.parse(result.content[0].text).deleted, true);
	}),
);

test(
	"(f) declined or dismissed elicitation never deletes",
	withStub({}, async (calls) => {
		const outcomes = [
			{ answer: { action: "decline" }, expect: "declined" },
			{ answer: { action: "cancel" }, expect: "dryRun" },
		];
		for (const { answer, expect } of outcomes) {
			const before = deleteCalls(calls).length;
			const extra = { clientCapabilities: { elicitation: {} }, elicit: async () => answer };
			const result = await run({ graphName: GRAPH }, extra);
			assert.ok(!result.isError, JSON.stringify(result));
			assert.equal(deleteCalls(calls).length - before, 1, "dry run only");
			const report = JSON.parse(result.content[0].text);
			assert.equal(report.deleted, false);
			assert.equal(report[expect], true, `${JSON.stringify(answer)} → ${expect}`);
		}
	}),
);

test(
	"(g) a refused write surfaces the app's status and message as isError",
	withStub({ failWrite: { status: 403, error: "Only your own graphs can be deleted." } }, async () => {
		const result = await run({ graphName: GRAPH, confirm: true });
		assert.ok(result.isError);
		const report = JSON.parse(result.content[0].text);
		assert.match(report.error, /Deletion failed/);
		assert.match(report.error, /403: Only your own graphs/);
	}),
);
