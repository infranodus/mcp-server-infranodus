// statementFilter: sent in the body of every request that reads a saved graph
// by name, driven through the real handlers with an intercepted fetch.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { statementFilterBody } from "../dist/utils/statementFilter.js";
import { analyzeExistingGraphTool } from "../dist/tools/analyzeExistingGraph.js";
import { generateContentGapsTool } from "../dist/tools/generateContentGaps.js";
import { generateDifferenceGraphFromTextsTool } from "../dist/tools/generateDifferenceGraphFromTexts.js";
import { generateOverlapGraphFromTextsTool } from "../dist/tools/generateOverlapGraphFromTexts.js";
import { generateOntologyGraphTool } from "../dist/tools/generateOntologyGraph.js";
import { getNodeNeighborhoodTool } from "../dist/tools/getNodeNeighborhood.js";
import { AnalyzeExistingGraphSchema } from "../dist/schemas/index.js";

const SUMMARY = { matched: 40, selected: 8, total: 40 };
const GRAPH = {
	statements: [{ content: "[[a]] links to [[b]]" }],
	statementFilter: SUMMARY,
	graph: { graphologyGraph: { attributes: { top_clusters: [], gaps: [] }, nodes: [], edges: [] } },
};

function fakeResponse(json) {
	return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
}

async function run(tool, params) {
	const originalFetch = globalThis.fetch;
	const calls = [];
	globalThis.fetch = async (url, init) => {
		const entry = { url: String(url), body: init?.body ? JSON.parse(init.body) : undefined };
		calls.push(entry);
		if (entry.url.includes("/aiAdvice")) {
			return fakeResponse({ choices: [{ message: { content: "[[a]] [causes] [[b]]" } }] });
		}
		return fakeResponse(GRAPH);
	};
	try {
		const result = await runWithConfig({ apiBase: "https://api.test", apiKey: "k" }, () =>
			tool.handler({ context: "x", ...params }),
		);
		return { result, calls };
	} finally {
		globalThis.fetch = originalFetch;
	}
}

const LATEST = { slice: { from: 0.8, to: 1 } };
const EARLIER = { slice: { from: 0, to: 0.8 } };

test("statementFilterBody sends nothing for a filter that narrows nothing", () => {
	assert.deepEqual(statementFilterBody(undefined), {});
	assert.deepEqual(statementFilterBody({ categoryMatch: "all", categories: [] }), {});
	assert.deepEqual(statementFilterBody({ categories: ["a"] }), { statementFilter: { categories: ["a"] } });
	assert.deepEqual(statementFilterBody(LATEST), { statementFilter: LATEST });
});

test("the schema accepts a filter and fills the open end of a slice", () => {
	const parsed = AnalyzeExistingGraphSchema.parse({
		graphName: "g",
		context: "x",
		statementFilter: { categories: ["Pricing"], categoryMatch: "all", from: "2026-03-01", slice: { from: 0.8 } },
	});
	assert.deepEqual(parsed.statementFilter.slice, { from: 0.8, to: 1 });
	assert.throws(() =>
		AnalyzeExistingGraphSchema.parse({ graphName: "g", context: "x", statementFilter: { slice: { from: 1.5 } } }),
	);
});

describe("tools that read a saved graph", () => {
	test("analyze_existing_graph_by_name sends the filter and returns its counts", async () => {
		const { result, calls } = await run(analyzeExistingGraphTool, { graphName: "g", statementFilter: LATEST });
		assert.deepEqual(calls[0].body.statementFilter, LATEST);
		assert.equal(calls[0].body.name, "g");
		assert.deepEqual(JSON.parse(result.content[0].text).statementFilter, SUMMARY);
	});

	test("no filter, no field", async () => {
		const { calls } = await run(analyzeExistingGraphTool, { graphName: "g" });
		assert.equal("statementFilter" in calls[0].body, false);
	});

	test("generate_content_gaps and get_node_neighborhood send it", async () => {
		const gaps = await run(generateContentGapsTool, { graphName: "g", statementFilter: { categories: ["a"] } });
		assert.deepEqual(gaps.calls[0].body.statementFilter, { categories: ["a"] });
		const hood = await run(getNodeNeighborhoodTool, { graphName: "g", node: "a", statementFilter: LATEST });
		assert.deepEqual(hood.calls[0].body.statementFilter, LATEST);
	});

	test("generate_ontology_graph filters the statements of sourceGraphName", async () => {
		const { calls } = await run(generateOntologyGraphTool, {
			sourceGraphName: "g",
			saveGraph: false,
			statementFilter: LATEST,
		});
		const read = calls.find((c) => c.body?.name === "g");
		assert.deepEqual(read.body.statementFilter, LATEST);
	});
});

describe("compare tools", () => {
	test("one graph twice, each context read with its own slice", async () => {
		for (const tool of [generateDifferenceGraphFromTextsTool, generateOverlapGraphFromTextsTool]) {
			const { calls } = await run(tool, {
				contexts: [
					{ graphName: "g", statementFilter: EARLIER },
					{ graphName: "g", statementFilter: LATEST },
				],
			});
			const reads = calls.filter((c) => c.url.includes("/graphAndStatements?"));
			assert.deepEqual(reads.map((c) => c.body.statementFilter), [EARLIER, LATEST]);
			const compare = calls.find((c) => c.url.includes("/graphsAndStatements"));
			assert.equal(compare.body.contexts.length, 2);
			assert.equal(JSON.stringify(compare.body).includes("statementFilter"), false);
		}
	});

	test("a graph context without a filter is read whole", async () => {
		const { calls } = await run(generateOverlapGraphFromTextsTool, {
			contexts: [{ graphName: "g" }, { text: "some text" }],
		});
		assert.equal("statementFilter" in calls[0].body, false);
	});
});
