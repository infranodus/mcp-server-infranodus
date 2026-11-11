// wikilinksMode and maxNodes on the tools that search a saved graph: what the
// handlers send to the app's /graphAndAdvice and /nodeNeighborhood
// (infranodus-app lib/wikilinksMode.js applies the mode), through an
// intercepted fetch (no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { retrieveContextForPromptFromGraphTool } from "../dist/tools/retrieveContextForPromptFromGraph.js";
import { getNodeNeighborhoodTool } from "../dist/tools/getNodeNeighborhood.js";
import {
	AnalyzeExistingGraphSchema,
	CreateGraphSchema,
	GetNodeNeighborhoodSchema,
	RetrieveContextForPromptFromGraphSchema,
} from "../dist/schemas/index.js";

/** Runs a handler and returns the one request it made. The API answers with
 * an error, which ends the handler once the request has been recorded. */
async function requestOf(tool, schema, params) {
	const originalFetch = globalThis.fetch;
	const calls = [];
	globalThis.fetch = async (url, init) => {
		const { pathname, searchParams } = new URL(url);
		calls.push({ path: pathname, query: searchParams, body: JSON.parse(init.body) });
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
const neighbors = (params) =>
	requestOf(getNodeNeighborhoodTool, GetNodeNeighborhoodSchema, { graphName: "site", node: "tide", ...params });

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

test("get_node_neighborhood does the same on /nodeNeighborhood", async () => {
	const saved = await neighbors({});
	assert.equal(saved.path, "/nodeNeighborhood");
	assert.equal("wikilinksMode" in saved.body, false);
	const both = await neighbors({ wikilinksMode: "wikilinksAndConcepts" });
	assert.equal(both.body.wikilinksMode, "wikilinksAndConcepts");
});

test("retrieve_from_knowledge_base sends maxNodes only when asked, within 150-1000", async () => {
	assert.equal((await retrieve({})).query.has("maxnodes"), false);
	assert.equal((await retrieve({ maxNodes: 600 })).query.get("maxnodes"), "600");
	for (const maxNodes of [100, 3000]) {
		const parsed = RetrieveContextForPromptFromGraphSchema.safeParse({ graphName: "g", prompt: "p", maxNodes });
		assert.equal(parsed.success, false);
	}
});

test("the option is for widening a search: not on the analysis tool, and its description stays short", () => {
	assert.equal("wikilinksMode" in AnalyzeExistingGraphSchema.shape, false);
	for (const schema of [RetrieveContextForPromptFromGraphSchema, GetNodeNeighborhoodSchema]) {
		const { description } = schema.shape.wikilinksMode;
		assert.ok(description.length <= 400, `${description.length} characters`);
		assert.match(description, /too few statements/);
		assert.match(description, /Keep 'saved'/);
	}
	assert.ok(RetrieveContextForPromptFromGraphSchema.shape.maxNodes.description.length <= 250);
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
