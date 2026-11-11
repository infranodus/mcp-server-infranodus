// wikilinksMode on the tools that read a saved graph: what the two handlers
// send to the app's /graphAndAdvice and /graphAndStatements (infranodus-app
// lib/wikilinksMode.js applies it), through an intercepted fetch (no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { retrieveContextForPromptFromGraphTool } from "../dist/tools/retrieveContextForPromptFromGraph.js";
import { analyzeExistingGraphTool } from "../dist/tools/analyzeExistingGraph.js";
import {
	AnalyzeExistingGraphSchema,
	CreateGraphSchema,
	RetrieveContextForPromptFromGraphSchema,
} from "../dist/schemas/index.js";

/** Runs a handler and returns the one request it made. The API answers with
 * an error, which ends the handler once the request has been recorded. */
async function requestOf(tool, schema, params) {
	const originalFetch = globalThis.fetch;
	const calls = [];
	globalThis.fetch = async (url, init) => {
		calls.push({ path: new URL(url).pathname, body: JSON.parse(init.body) });
		const json = { error: "stop here" };
		return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
	};
	try {
		await runWithConfig({ apiBase: "https://api.test", apiKey: "k" }, () =>
			tool.handler(schema.parse(params)),
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
	assert.equal(calls.length, 1);
	return calls[0];
}

const retrieve = (params) =>
	requestOf(retrieveContextForPromptFromGraphTool, RetrieveContextForPromptFromGraphSchema, {
		graphName: "site",
		prompt: "tide table",
		...params,
	});
const analyze = (params) =>
	requestOf(analyzeExistingGraphTool, AnalyzeExistingGraphSchema, { graphName: "site", ...params });

test("retrieve_from_knowledge_base sends no mode by default or for 'saved'", async () => {
	for (const params of [{}, { wikilinksMode: "saved" }]) {
		const { path, body } = await retrieve(params);
		assert.equal(path, "/graphAndAdvice");
		assert.equal("wikilinksMode" in body, false);
	}
});

test("retrieve_from_knowledge_base passes the requested mode to the API", async () => {
	for (const mode of ["wikilinksOnly", "wikilinksAndConcepts", "plainText"]) {
		const { body } = await retrieve({ wikilinksMode: mode });
		assert.equal(body.wikilinksMode, mode);
		assert.equal(body.name, "site");
	}
});

test("analyze_existing_graph_by_name does the same on /graphAndStatements", async () => {
	const saved = await analyze({});
	assert.equal(saved.path, "/graphAndStatements");
	assert.equal("wikilinksMode" in saved.body, false);
	const both = await analyze({ wikilinksMode: "wikilinksAndConcepts" });
	assert.equal(both.body.wikilinksMode, "wikilinksAndConcepts");
});

test("the read modes and the upload modes are separate lists", () => {
	// Parent modes need an upload's statements and categories; 'default' is one
	// processing, not "as saved".
	for (const mode of ["default", "obsidianStyle", "parentAndConcepts"]) {
		assert.equal(
			RetrieveContextForPromptFromGraphSchema.safeParse({ graphName: "g", prompt: "p", wikilinksMode: mode }).success,
			false,
		);
	}
	assert.equal(CreateGraphSchema.shape.wikilinksMode.safeParse("saved").success, false);
});
