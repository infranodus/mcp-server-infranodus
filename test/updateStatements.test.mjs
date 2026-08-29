// Drive update_statements through its real handler and an intercepted
// fetch (no network): the consent flow, the one-mode rule, and the request
// shape against the app's /updateStatements contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { updateStatementsTool, buildUpdate } from "../dist/tools/updateStatements.js";
import { UpdateStatementsSchema } from "../dist/schemas/index.js";

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

const UPDATED = [
	{
		id: 11,
		before: { content: "The [[router]] delegates to [[handlers]].", categories: ["src/router.ts"], timestamp: "2026-08-01T10:00:00Z" },
		after: { content: "The [[dispatcher]] delegates to [[handlers]].", categories: ["src/router.ts"], timestamp: "2026-08-01T10:00:00Z" },
	},
	{
		id: 12,
		before: { content: "Every [[router]] call returns a text block.", categories: ["src/router.ts"], timestamp: "2026-08-01T10:00:01Z" },
		after: { content: "Every [[dispatcher]] call returns a text block.", categories: ["src/router.ts"], timestamp: "2026-08-01T10:00:01Z" },
	},
];

/**
 * Stub the API: /listGraphs answers from `graphs`; /updateStatements
 * answers a plan on dryRun and a write result otherwise. Returns the
 * recorded calls.
 */
function stubFetch({
	graphs = [{ id: 1, contextName: GRAPH, defaultRevisionUrl: GRAPH_URL }],
	updated = UPDATED,
	matchedCount = updated.length + 1,
} = {}) {
	const calls = [];
	globalThis.fetch = async (url, init) => {
		const body = JSON.parse(init.body);
		const entry = { url: String(url), body };
		calls.push(entry);
		if (entry.url.includes("/listGraphs")) return fakeResponse(graphs);
		if (entry.url.includes("/updateStatements")) {
			return fakeResponse({
				graphName: GRAPH,
				graphUrl: GRAPH_URL,
				matchedCount,
				updatedCount: updated.length,
				updated,
				unchanged: matchedCount - updated.length,
				rejected: [],
				dryRun: body.dryRun,
			});
		}
		throw new Error(`unexpected request: ${entry.url}`);
	};
	return calls;
}

const updateCalls = (calls) => calls.filter((c) => c.url.includes("/updateStatements"));

async function run(params, extra) {
	return runWithConfig({ apiBase: "https://api.test", apiKey: "k" }, () =>
		updateStatementsTool.handler(params, extra),
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

const BULK = { graphName: GRAPH, categories: ["src/router.ts"], replace: { pattern: "[[router]]", with: "[[dispatcher]]" } };
const EDITS = {
	graphName: GRAPH,
	edits: [
		{ match: "The [[router]] delegates to [[handlers]].", content: "The [[dispatcher]] delegates to [[handlers]]." },
		{ statementId: 12, categories: ["src/dispatcher.ts"] },
	],
};

test(
	"(a) without confirm the only /updateStatements call is a dry run and nothing is written",
	withStub({}, async (calls) => {
		const result = await run({ ...BULK, confirm: false });
		assert.ok(!result.isError, JSON.stringify(result));
		const updates = updateCalls(calls);
		assert.equal(updates.length, 1, "exactly one /updateStatements call");
		assert.equal(updates[0].body.dryRun, true);
		assert.equal(updates[0].body.name, GRAPH);
		assert.deepEqual(updates[0].body.categories, ["src/router.ts"]);
		assert.deepEqual(updates[0].body.replace, { pattern: "[[router]]", with: "[[dispatcher]]" });
		assert.equal(updates[0].body.set, undefined);

		const report = JSON.parse(result.content[0].text);
		assert.equal(report.updated, 0);
		assert.equal(report.dryRun, true);
		assert.equal(report.matchedCount, 3);
		assert.equal(report.updatedCount, 2, "how many the write would update");
		assert.equal(report.changes.length, 2);
		assert.equal(report.changes[0].before.content, UPDATED[0].before.content);
		assert.equal(report.changes[0].after.content, UPDATED[0].after.content);
		assert.equal(report.unchanged, 1);
		assert.equal(report.mode, "bulk");
		assert.deepEqual(report.filter, { categories: ["src/router.ts"], replace: { pattern: "[[router]]", with: "[[dispatcher]]" } });
		assert.equal(report.graphUrl, GRAPH_URL);
		assert.match(report.nextStep, /update_statements again with the SAME arguments and confirm: true/);
	}),
);

test(
	"(b) confirm: true previews then writes once with the identical body (both modes)",
	withStub({}, async (calls) => {
		for (const params of [BULK, EDITS]) {
			const before = updateCalls(calls).length;
			const result = await run({ ...params, confirm: true });
			assert.ok(!result.isError, JSON.stringify(result));
			const updates = updateCalls(calls).slice(before);
			assert.equal(updates.length, 2, "dry run then write");
			assert.equal(updates[0].body.dryRun, true);
			assert.equal(updates[1].body.dryRun, false);
			const { dryRun: _a, ...bodyA } = updates[0].body;
			const { dryRun: _b, ...bodyB } = updates[1].body;
			assert.deepEqual(bodyB, bodyA, "identical body on both calls");
			assert.equal(JSON.stringify(bodyB), JSON.stringify(bodyA), "same key order too");

			const report = JSON.parse(result.content[0].text);
			assert.equal(report.updated, 2, "updated equals the stubbed updatedCount");
			assert.equal(report.changes.length, 2);
			assert.equal(report.unchanged, 1);
			assert.equal(report.graphName, GRAPH);
			assert.equal(report.dryRun, undefined);
			assert.equal(report.note, undefined, "no drift note when counts agree");
		}
		const editsWrite = updateCalls(calls).at(-1).body;
		assert.deepEqual(editsWrite.edits, EDITS.edits, "Mode A sends the edits array");
		assert.equal(editsWrite.categories, undefined, "no selector leaks into Mode A");
	}),
);

test(
	"(c) edits together with a selector or set/replace is an error before any request",
	withStub({}, async (calls) => {
		const both = await run({ ...EDITS, categories: ["src/router.ts"], confirm: true });
		assert.equal(both.isError, true);
		assert.match(JSON.parse(both.content[0].text).error, /one mode per call/);

		const withReplace = await run({ ...EDITS, replace: { pattern: "a", with: "b" } });
		assert.equal(withReplace.isError, true);

		const twoSelectors = await run({ ...BULK, query: "router" });
		assert.equal(twoSelectors.isError, true);
		assert.match(JSON.parse(twoSelectors.content[0].text).error, /Exactly one selector/);

		const nothing = await run({ graphName: GRAPH });
		assert.equal(nothing.isError, true);
		assert.match(JSON.parse(nothing.content[0].text).error, /Nothing to do/);

		assert.equal(calls.length, 0, "zero fetch calls");
	}),
);

test(
	"(d) Mode B without set or replace is an error before any request",
	withStub({}, async (calls) => {
		const bare = await run({ graphName: GRAPH, categories: ["src/router.ts"], confirm: true });
		assert.equal(bare.isError, true);
		assert.match(JSON.parse(bare.content[0].text).error, /needs an operation/);

		const emptySet = await run({ graphName: GRAPH, all: true, set: {} });
		assert.equal(emptySet.isError, true);

		const exclusive = await run({
			graphName: GRAPH,
			all: true,
			set: { categories: ["x"], addCategories: ["y"] },
		});
		assert.equal(exclusive.isError, true);
		assert.match(JSON.parse(exclusive.content[0].text).error, /set\.categories/);

		assert.equal(calls.length, 0, "zero fetch calls");
	}),
);

test(
	"(e) an unknown graph is an error and no update call is made",
	withStub({ graphs: [] }, async (calls) => {
		const result = await run({ graphName: "does-not-exist", all: true, set: { addCategories: ["x"] }, confirm: true });
		assert.equal(result.isError, true);
		assert.equal(updateCalls(calls).length, 0);
		assert.ok(calls.every((c) => c.url.includes("/listGraphs")), "only lookups went out");
		assert.match(JSON.parse(result.content[0].text).error, /No graph named "does-not-exist"/);
	}),
);

test(
	"(f) matchedCount 0 short-circuits: no consent needed, no write call",
	withStub({ updated: [], matchedCount: 0 }, async (calls) => {
		let elicited = false;
		const extra = {
			clientCapabilities: { elicitation: {} },
			elicit: async () => {
				elicited = true;
				return { action: "accept", content: { apply: true } };
			},
		};
		const result = await run({ graphName: GRAPH, query: "nothing-like-this", replace: { pattern: "a", with: "b" } }, extra);
		assert.ok(!result.isError, JSON.stringify(result));
		const updates = updateCalls(calls);
		assert.equal(updates.length, 1, "only the dry run");
		assert.equal(updates[0].body.dryRun, true);
		assert.equal(elicited, false, "the user is not asked about an empty match");
		const report = JSON.parse(result.content[0].text);
		assert.equal(report.updated, 0);
		assert.equal(report.matchedCount, 0);
		assert.match(report.message, /no update performed/i);
	}),
);

test("(g) the schema has no userName and confirm defaults to false", () => {
	assert.ok(!("userName" in UpdateStatementsSchema.shape));
	assert.ok("graphName" in UpdateStatementsSchema.shape);
	for (const field of ["edits", "categories", "statements", "query", "before", "after", "all", "statementIds", "set", "replace"]) {
		assert.ok(field in UpdateStatementsSchema.shape, field);
	}
	assert.equal(UpdateStatementsSchema.parse({ graphName: "g" }).confirm, false);
});

test(
	"(h) an ambiguous timestamp is refused offline in every position",
	withStub({}, async (calls) => {
		const cases = [
			{ graphName: GRAPH, edits: [{ statementId: 1, timestamp: "03.05.2026" }] },
			{ graphName: GRAPH, all: true, set: { timestamp: "03.05.2026" } },
			{ graphName: GRAPH, before: "03.05.2026", set: { addCategories: ["x"] } },
		];
		for (const params of cases) {
			const result = await run(params);
			assert.equal(result.isError, true, JSON.stringify(params));
			assert.match(JSON.parse(result.content[0].text).error, /ISO 8601/);
		}
		assert.equal(calls.length, 0, "no request for an ambiguous date");

		const ok = await run({ graphName: GRAPH, edits: [{ statementId: 1, timestamp: "2026-05-03T10:00:00Z" }] });
		assert.ok(!ok.isError, JSON.stringify(ok));
		assert.equal(updateCalls(calls)[0].body.edits[0].timestamp, "2026-05-03T10:00:00Z");
	}),
);

test(
	"(i) an accepted elicitation form writes in the same call; the prompt quotes the count and a before → after sample",
	withStub({}, async (calls) => {
		let message = "";
		const extra = {
			clientCapabilities: { elicitation: {} },
			elicit: async (request) => {
				message = request.message;
				return { action: "accept", content: { apply: true } };
			},
		};
		const result = await run(BULK, extra);
		assert.ok(!result.isError, JSON.stringify(result));
		assert.equal(updateCalls(calls).length, 2);
		assert.equal(updateCalls(calls)[1].body.dryRun, false);
		assert.match(message, /2 of the 3 matched statement/);
		assert.match(message, /\[\[router\]\].*→.*\[\[dispatcher\]\]/);
		assert.equal(JSON.parse(result.content[0].text).updated, 2);
	}),
);

test(
	"(j) declined, unticked, or dismissed elicitation never writes",
	withStub({}, async (calls) => {
		const outcomes = [
			{ answer: { action: "decline" }, expect: "declined" },
			{ answer: { action: "accept", content: { apply: false } }, expect: "declined" },
			{ answer: { action: "cancel" }, expect: "dryRun" },
		];
		for (const { answer, expect } of outcomes) {
			const before = updateCalls(calls).length;
			const extra = { clientCapabilities: { elicitation: {} }, elicit: async () => answer };
			const result = await run(EDITS, extra);
			assert.ok(!result.isError, JSON.stringify(result));
			assert.equal(updateCalls(calls).length - before, 1, "dry run only");
			const report = JSON.parse(result.content[0].text);
			assert.equal(report.updated, 0);
			assert.equal(report[expect], true, `${JSON.stringify(answer)} → ${expect}`);
		}
	}),
);

test("(k) an API error on the dry run surfaces as isError and nothing is written", async () => {
	const originalFetch = globalThis.fetch;
	const calls = [];
	globalThis.fetch = async (url) => {
		calls.push(String(url));
		if (String(url).includes("/listGraphs")) return fakeResponse([{ contextName: GRAPH }]);
		return fakeResponse({ error: "graph belongs to another user" }, 403);
	};
	try {
		const result = await run({ ...BULK, confirm: true });
		assert.equal(result.isError, true);
		assert.equal(calls.filter((u) => u.includes("/updateStatements")).length, 1);
		const { error } = JSON.parse(result.content[0].text);
		assert.match(error, /403/);
		assert.match(error, /another user/);
		assert.match(error, /nothing was changed/i);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test(
	"(l) a write count that differs from the preview adds a note; rejected and unmatched are passed through",
	async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (url, init) => {
			const body = JSON.parse(init.body);
			if (String(url).includes("/listGraphs")) return fakeResponse([{ contextName: GRAPH }]);
			return fakeResponse({
				graphName: GRAPH,
				matchedCount: 2,
				updatedCount: body.dryRun ? 2 : 1,
				updated: body.dryRun ? UPDATED : UPDATED.slice(0, 1),
				unchanged: 0,
				unmatched: [{ match: "gone" }],
				rejected: body.dryRun ? [] : [{ id: 12, reason: "content exceeds 1000 characters" }],
				dryRun: body.dryRun,
			});
		};
		try {
			const result = await run({ ...EDITS, confirm: true });
			assert.ok(!result.isError, JSON.stringify(result));
			const report = JSON.parse(result.content[0].text);
			assert.equal(report.updated, 1);
			assert.match(report.note, /would have updated 2 .* but 1 were updated/);
			assert.deepEqual(report.unmatched, [{ match: "gone" }]);
			assert.equal(report.rejected[0].id, 12);
		} finally {
			globalThis.fetch = originalFetch;
		}
	},
);

test("buildUpdate: per-edit rules and the content cap are checked offline", () => {
	assert.match(buildUpdate({ edits: [{ content: "x" }] }).error, /exactly one of match/);
	assert.match(buildUpdate({ edits: [{ match: "a", statementId: 1, content: "x" }] }).error, /exactly one of match/);
	assert.match(buildUpdate({ edits: [{ match: "a" }] }).error, /nothing to change/);
	assert.match(buildUpdate({ edits: [{ match: "a", content: "x".repeat(1001) }] }).error, /1000 characters.*delete_statements.*create_knowledge_graph/);
	const ok = buildUpdate({ edits: [{ match: "  a  ", content: " b " }] });
	assert.deepEqual(ok, { ok: true, mode: "edits", body: { edits: [{ match: "a", content: "b" }] }, kind: "edits" });

	const bulk = buildUpdate({ all: true, set: { addCategories: ["x"], removeCategories: [] }, replace: { pattern: "a", with: "" } });
	assert.deepEqual(bulk, {
		ok: true,
		mode: "bulk",
		body: { all: true, set: { addCategories: ["x"] }, replace: { pattern: "a", with: "" } },
		kind: "all",
	});
	assert.equal(buildUpdate({ all: false, replace: { pattern: "a", with: "b" } }).ok, false, "all: false is not a selector");
});
