// Drive optimize_knowledge_base with saveAs through its real handler and an
// intercepted fetch: checks the request-body shape of the save call and that
// the analysis then targets the saved graph (no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { optimizeKnowledgeBaseTool } from "../dist/tools/optimizeKnowledgeBase.js";

function fakeResponse(json) {
	return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
}

test("saveAs saves the digest as a parent-mode graph, then analyses that graph", async () => {
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		const body = JSON.parse(init.body);
		calls.push({ url: String(url), body });
		if (String(url).includes("/graphAndStatements")) return fakeResponse({ ok: true });
		return fakeResponse({
			extendedGraphSummary: { diversityStatistics: { diversity_score: "Diversified" } },
			aiAdvice: "",
		});
	};
	try {
		const result = await runWithConfig(
			{ apiBase: "https://api.test", apiKey: "k" },
			() =>
				optimizeKnowledgeBaseTool.handler({
					text: "## [[Tools]]\nEvery tool lives in [[src/tools]] and is registered in [[src/index.ts]].\nHandlers never throw so the [[MCP client]] sees an error block.\n",
					saveAs: "repo-x-digest",
					focus: "codebase",
					includeLatent: false,
				}),
		);
		assert.ok(!result.isError, JSON.stringify(result));
		assert.equal(calls.length, 2, "one save call, one develop call");

		const [save, develop] = calls;
		assert.ok(save.url.includes("/graphAndStatements?"));
		assert.ok(save.url.includes("doNotSave=false"));
		assert.equal(save.body.name, "repo-x-digest");
		assert.deepEqual(save.body.statements, [
			"Every tool lives in [[src/tools]] and is registered in [[src/index.ts]].",
			"Handlers never throw so the [[MCP client]] sees an error block.",
		]);
		assert.deepEqual(save.body.categories, [["Tools"], ["Tools"]], "heading becomes the parent");
		assert.ok(save.body.contextSettings, "parentAndConcepts context settings are sent");
		assert.equal(save.body.text, "", "text is replaced by statements in parent mode");

		assert.ok(develop.url.includes("/graphAndAdvice?"));
		assert.equal(develop.body.name, "repo-x-digest", "analysis runs on the saved graph");
		assert.equal(develop.body.text, undefined);

		const report = JSON.parse(result.content[0].text);
		assert.equal(report.source, "repo-x-digest");
		assert.equal(report.state, "diversified");
		assert.equal(report.focus, "codebase");
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("compareWith is accepted with saveAs (primary becomes the saved graph)", async () => {
	const urls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		urls.push(String(url));
		if (String(url).includes("/graphAndStatements")) {
			const body = JSON.parse(init.body);
			// the difference calls carry contexts, the save call carries name
			return fakeResponse(body.contexts ? { mainTopicalClusters: [] } : { ok: true });
		}
		return fakeResponse({ extendedGraphSummary: { diversityStatistics: { diversity_score: "focused" } } });
	};
	try {
		const result = await runWithConfig({ apiBase: "https://api.test", apiKey: "k" }, () =>
			optimizeKnowledgeBaseTool.handler({
				statements: ["[[a]] uses [[b]]", "[[b]] calls [[c]]"],
				saveAs: "repo-x-digest",
				compareWith: ["repo-x-structure"],
				includeLatent: false,
			}),
		);
		assert.ok(!result.isError, JSON.stringify(result));
		const report = JSON.parse(result.content[0].text);
		assert.equal(report.comparisons.length, 1);
		assert.equal(report.comparisons[0].against, "repo-x-structure");
		assert.equal(urls.length, 4, "save + develop + two difference calls");
	} finally {
		globalThis.fetch = originalFetch;
	}
});
