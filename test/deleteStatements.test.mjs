// Drive delete_statements through its real handler and an intercepted
// fetch (no network): the consent flow, the selector rule, and the request
// shape against the app's /deleteStatements contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { deleteStatementsTool, buildSelector } from "../dist/tools/deleteStatements.js";
import { DeleteStatementsSchema } from "../dist/schemas/index.js";

const GRAPH = "repo-x-docs";
const GRAPH_URL = "https://infranodus.com/u/repo-x-docs";

function fakeResponse(json, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => json,
		text: async () => JSON.stringify(json),
	};
}

const MATCHED = [
	{ id: 11, content: "The [[router]] delegates to [[handlers]].", categories: ["src/router.ts"], timestamp: "2026-08-01T10:00:00Z" },
	{ id: 12, content: "Every [[handler]] returns a text block.", categories: ["src/router.ts"], timestamp: "2026-08-01T10:00:01Z" },
	{ id: 13, content: "[[Errors]] never throw past the wrapper.", categories: ["src/router.ts"], timestamp: "2026-08-01T10:00:02Z" },
];

/**
 * Stub the API: /listGraphs answers from `graphs`; /deleteStatements
 * answers a plan on dryRun and a write result otherwise. Returns the
 * recorded calls.
 */
function stubFetch({ graphs = [{ id: 1, contextName: GRAPH, defaultRevisionUrl: GRAPH_URL }], matched = MATCHED } = {}) {
	const calls = [];
	globalThis.fetch = async (url, init) => {
		const body = JSON.parse(init.body);
		const entry = { url: String(url), body };
		calls.push(entry);
		if (entry.url.includes("/listGraphs")) return fakeResponse(graphs);
		if (entry.url.includes("/deleteStatements")) {
			if (body.dryRun) {
				return fakeResponse({
					graphName: GRAPH,
					graphUrl: GRAPH_URL,
					matchedCount: matched.length,
					matched,
					matchedByCategory: { "src/router.ts": matched.length },
					removedIds: [],
					removedCount: 0,
					remaining: 40,
					dryRun: true,
				});
			}
			return fakeResponse({
				graphName: GRAPH,
				graphUrl: GRAPH_URL,
				matchedCount: matched.length,
				matched,
				removedIds: matched.map((m) => m.id),
				removedCount: matched.length,
				remaining: 40 - matched.length,
				dryRun: false,
			});
		}
		throw new Error(`unexpected request: ${entry.url}`);
	};
	return calls;
}

const deleteCalls = (calls) => calls.filter((c) => c.url.includes("/deleteStatements"));

async function run(params, extra) {
	return runWithConfig({ apiBase: "https://api.test", apiKey: "k" }, () =>
		deleteStatementsTool.handler(params, extra),
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
	"(a) without confirm the only /deleteStatements call is a dry run and nothing is deleted",
	withStub({}, async (calls) => {
		const result = await run({ graphName: GRAPH, categories: ["src/router.ts"], confirm: false });
		assert.ok(!result.isError, JSON.stringify(result));
		const deletes = deleteCalls(calls);
		assert.equal(deletes.length, 1, "exactly one /deleteStatements call");
		assert.equal(deletes[0].body.dryRun, true);
		assert.equal(deletes[0].body.name, GRAPH);
		assert.deepEqual(deletes[0].body.categories, ["src/router.ts"]);

		const report = JSON.parse(result.content[0].text);
		assert.equal(report.deleted, 0);
		assert.equal(report.dryRun, true);
		assert.equal(report.matchedCount, 3);
		assert.equal(report.matched.length, 3);
		assert.deepEqual(report.matchedByCategory, { "src/router.ts": 3 });
		assert.deepEqual(report.filter, { categories: ["src/router.ts"] });
		assert.equal(report.graphUrl, GRAPH_URL);
		assert.match(report.nextStep, /confirm: true/);
	}),
);

test(
	"(b) confirm: true previews then writes once with the same filter",
	withStub({}, async (calls) => {
		const result = await run({ graphName: GRAPH, categories: ["src/router.ts"], confirm: true });
		assert.ok(!result.isError, JSON.stringify(result));
		const deletes = deleteCalls(calls);
		assert.equal(deletes.length, 2, "dry run then write");
		assert.equal(deletes[0].body.dryRun, true);
		assert.equal(deletes[1].body.dryRun, false);
		const { dryRun: _a, ...filterA } = deletes[0].body;
		const { dryRun: _b, ...filterB } = deletes[1].body;
		assert.deepEqual(filterB, filterA, "identical filter on both calls");

		const report = JSON.parse(result.content[0].text);
		assert.equal(report.deleted, 3, "deleted equals the stubbed removedCount");
		assert.deepEqual(report.removedIds, [11, 12, 13]);
		assert.equal(report.remaining, 37);
		assert.equal(report.graphName, GRAPH);
		assert.equal(report.dryRun, undefined);
		assert.equal(report.note, undefined, "no drift note when counts agree");
	}),
);

test(
	"(c) two selectors is an error before any request",
	withStub({}, async (calls) => {
		const result = await run({ graphName: GRAPH, categories: ["a"], query: "b", confirm: true });
		assert.equal(result.isError, true);
		assert.equal(calls.length, 0, "zero fetch calls");
		assert.match(JSON.parse(result.content[0].text).error, /Exactly one selector/);
	}),
);

test(
	"(c') before and after together count as one selector; a bad date is refused offline",
	withStub({}, async (calls) => {
		const ok = await run({ graphName: GRAPH, before: "2026-08-01", after: "2026-07-01" });
		assert.ok(!ok.isError, JSON.stringify(ok));
		assert.deepEqual(deleteCalls(calls)[0].body.before, "2026-08-01");
		assert.deepEqual(deleteCalls(calls)[0].body.after, "2026-07-01");

		const before = calls.length;
		const bad = await run({ graphName: GRAPH, before: "03.05.2026" });
		assert.equal(bad.isError, true);
		assert.equal(calls.length, before, "no request for an ambiguous date");
		assert.match(JSON.parse(bad.content[0].text).error, /ISO 8601/);
	}),
);

test(
	"(d) an unknown graph is an error and no delete call is made",
	withStub({ graphs: [] }, async (calls) => {
		const result = await run({ graphName: "does-not-exist", deleteAll: true, confirm: true });
		assert.equal(result.isError, true);
		assert.equal(deleteCalls(calls).length, 0);
		assert.ok(calls.every((c) => c.url.includes("/listGraphs")), "only lookups went out");
		assert.match(JSON.parse(result.content[0].text).error, /No graph named "does-not-exist"/);
	}),
);

test(
	"(e) matchedCount 0 short-circuits: no consent needed, no write call",
	withStub({ matched: [] }, async (calls) => {
		let elicited = false;
		const extra = {
			clientCapabilities: { elicitation: {} },
			elicit: async () => {
				elicited = true;
				return { action: "accept", content: {} };
			},
		};
		const result = await run({ graphName: GRAPH, query: "nothing-like-this" }, extra);
		assert.ok(!result.isError, JSON.stringify(result));
		const deletes = deleteCalls(calls);
		assert.equal(deletes.length, 1, "only the dry run");
		assert.equal(deletes[0].body.dryRun, true);
		assert.equal(elicited, false, "the user is not asked about an empty match");
		const report = JSON.parse(result.content[0].text);
		assert.equal(report.deleted, 0);
		assert.equal(report.matchedCount, 0);
		assert.match(report.message, /no deletion performed/i);
	}),
);

test("(f) the schema has no userName and confirm defaults to false", () => {
	assert.ok(!("userName" in DeleteStatementsSchema.shape));
	assert.ok("graphName" in DeleteStatementsSchema.shape);
	assert.equal(DeleteStatementsSchema.parse({ graphName: "g" }).confirm, false);
});

test(
	"(g) an accepted elicitation form deletes in the same call; the prompt quotes the count and a sample",
	withStub({}, async (calls) => {
		let message = "";
		const extra = {
			clientCapabilities: { elicitation: {} },
			elicit: async (request) => {
				message = request.message;
				return { action: "accept", content: {} };
			},
		};
		const result = await run({ graphName: GRAPH, deleteAll: true }, extra);
		assert.ok(!result.isError, JSON.stringify(result));
		assert.equal(deleteCalls(calls).length, 2);
		assert.deepEqual(deleteCalls(calls)[1].body.all, true);
		assert.equal(deleteCalls(calls)[1].body.dryRun, false);
		assert.match(message, /3 statement/);
		assert.match(message, /router/);
		assert.equal(JSON.parse(result.content[0].text).deleted, 3);
	}),
);

test(
	"(h) declined or dismissed elicitation never writes",
	withStub({}, async (calls) => {
		const outcomes = [
			{ answer: { action: "decline" }, expect: "declined" },
			{ answer: { action: "cancel" }, expect: "dryRun" },
		];
		for (const { answer, expect } of outcomes) {
			const before = deleteCalls(calls).length;
			const extra = { clientCapabilities: { elicitation: {} }, elicit: async () => answer };
			const result = await run({ graphName: GRAPH, statements: ["x"] }, extra);
			assert.ok(!result.isError, JSON.stringify(result));
			assert.equal(deleteCalls(calls).length - before, 1, "dry run only");
			const report = JSON.parse(result.content[0].text);
			assert.equal(report.deleted, 0);
			assert.equal(report[expect], true, `${JSON.stringify(answer)} → ${expect}`);
		}
	}),
);

test(
	"(i) an API error on the dry run surfaces as isError and nothing is written",
	async () => {
		const originalFetch = globalThis.fetch;
		const calls = [];
		globalThis.fetch = async (url, init) => {
			calls.push(String(url));
			if (String(url).includes("/listGraphs")) return fakeResponse([{ contextName: GRAPH }]);
			return fakeResponse({ error: "graph belongs to another user" }, 403);
		};
		try {
			const result = await run({ graphName: GRAPH, query: "x", confirm: true });
			assert.equal(result.isError, true);
			assert.equal(calls.filter((u) => u.includes("/deleteStatements")).length, 1);
			const { error } = JSON.parse(result.content[0].text);
			assert.match(error, /403/);
			assert.match(error, /another user/);
			assert.match(error, /nothing was deleted/i);
		} finally {
			globalThis.fetch = originalFetch;
		}
	},
);

test("buildSelector treats empty arrays, blank strings and deleteAll: false as absent", () => {
	assert.equal(buildSelector({ categories: [], query: "  ", deleteAll: false }).ok, false);
	assert.deepEqual(buildSelector({ categories: [], query: "x" }), { ok: true, selector: { query: "x" }, kind: "query" });
	assert.deepEqual(buildSelector({ statementIds: [1, 2] }).selector, { statementIds: [1, 2] });
	assert.equal(buildSelector({ deleteAll: true, statementIds: [1] }).ok, false);
});
