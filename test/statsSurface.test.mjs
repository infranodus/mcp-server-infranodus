// Offline surface test for every tool that returns network statistics.
//
// Drives each tool through its real handler with an intercepted fetch and
// checks two things per tool:
//   1. the request: addStats=true is always sent, and multifractal=true is
//      sent only when the tool's `multifractal` flag is set (for tools that
//      have it);
//   2. the response surface: diversity_stats and fractal_variability arrive
//      side by side, unchanged, in the place documented for that tool.
// No network is used. Runs as part of `npm test`.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { generateKnowledgeGraphTool } from "../dist/tools/generateKnowledgeGraph.js";
import { analyzeTextTool } from "../dist/tools/analyzeText.js";
import { analyzeExistingGraphTool } from "../dist/tools/analyzeExistingGraph.js";
import { createKnowledgeGraphTool } from "../dist/tools/createKnowledgeGraph.js";
import { addMemoryTool } from "../dist/tools/addMemory.js";
import { generateOntologyGraphTool } from "../dist/tools/generateOntologyGraph.js";
import { analyzeLlmResultsTool } from "../dist/tools/analyzeLlmResults.js";
import { generateMergedGraphFromTextsTool } from "../dist/tools/generateMergedGraphFromTexts.js";
import { generateOverlapGraphFromTextsTool } from "../dist/tools/generateOverlapGraphFromTexts.js";
import { generateDifferenceGraphFromTextsTool } from "../dist/tools/generateDifferenceGraphFromTexts.js";
import { optimizeTextStructureTool } from "../dist/tools/optimizeTextStructure.js";
import { optimizeReasoningTool } from "../dist/tools/optimizeReasoning.js";
import { optimizeKnowledgeBaseTool } from "../dist/tools/optimizeKnowledgeBase.js";
import {
	assertStructuredStatistics,
	assertDiversityStats,
	assertFractalVariability,
	parseToolResult,
	fractalFixture,
	diversityFixture,
} from "./helpers/statsSurface.mjs";

const CONFIG = { apiBase: "https://api.test/api/v1", apiKey: "test-key" };
const TEXT = "Complex systems are made of many parts.\nNetworks describe complex systems.\nEmergence arises from local interactions.";
const CONTEXTS = [{ text: TEXT }, { text: "Ecosystems show resilience.\nCities grow along fractal patterns." }];

const DIVERSITY = diversityFixture();
const FRACTAL = fractalFixture();

/** A compact /graphAndStatements-style response with both stats objects. */
function graphResponse() {
	return {
		graph: {
			graphologyGraph: {
				attributes: {
					modularity: 0.71,
					diversity_stats: DIVERSITY,
					fractal_variability: FRACTAL,
					top_clusters: [{ community: "0", nodes: [{ nodeName: "system", bc: 0.3 }], bcRatio: 0.5 }],
					gaps: [],
					top_influential_nodes: [{ node: "system", bc: 0.3, degree: 5 }],
				},
				nodes: [{ key: "system" }, { key: "network" }],
				edges: [{ source: "system", target: "network" }],
			},
			statementHasthags: [],
		},
		extendedGraphSummary: {
			contentGaps: ["Gap 1: a -> b"],
			mainTopics: ["Topic A: system network"],
			mainConcepts: ["system", "network"],
			conceptualGateways: ["network"],
			topRelations: ["1) system <-> network"],
			topBigrams: ["system network"],
			topicsToDevelop: ["system <-> network"],
			diversityStatistics: { modularity: "0.71", ...DIVERSITY },
		},
		statements: [],
		userName: "tester",
		graphName: "test-graph",
		graphUrl: "https://app.test/tester/test-graph/edit",
	};
}

/** /graphAndAdvice: the graph plus an AI suggestion. */
function adviceResponse() {
	return { ...graphResponse(), aiAdvice: [{ text: "Connect system and network." }] };
}

/** /aiAdvice for the ontology and LLM tools when not saving: raw completions. */
function completionsResponse() {
	return { choices: [{ text: "[[system]] contains [[network]]\n[[network]] links [[node]]" }] };
}

function fakeResponse(json) {
	return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
}

/** Run `fn` with fetch intercepted; returns the calls it made. */
async function withFakeApi(fn) {
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		const href = String(url);
		calls.push({ url: href, body: init?.body ? JSON.parse(init.body) : undefined });
		if (href.includes("/aiAdvice")) return fakeResponse(completionsResponse());
		if (href.includes("/graphAndAdvice")) return fakeResponse(adviceResponse());
		return fakeResponse(graphResponse());
	};
	try {
		const result = await runWithConfig(CONFIG, fn);
		return { result, calls };
	} finally {
		globalThis.fetch = originalFetch;
	}
}

function queryOf(url) {
	return new URL(url).searchParams;
}

// ---------------------------------------------------------------------------
// Graph-generation tools: `statistics` block, optional `multifractal` flag,
// and the stats object echoed in knowledgeGraph.attributes when the graph is
// included. Ontology and LLM tools build the graph in a second call.
// ---------------------------------------------------------------------------
const GRAPH_TOOLS = [
	{
		name: "generate_knowledge_graph",
		tool: generateKnowledgeGraphTool,
		endpoint: "/graphAndStatements",
		params: (flag) => ({ text: TEXT, includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: flag }),
	},
	{
		name: "analyze_text",
		tool: analyzeTextTool,
		endpoint: "/graphAndStatements",
		params: (flag) => ({ text: TEXT, includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: flag }),
	},
	{
		name: "analyze_existing_graph_by_name",
		tool: analyzeExistingGraphTool,
		endpoint: "/graphAndStatements",
		params: (flag) => ({ graphName: "test-graph", includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: flag }),
	},
	{
		name: "create_knowledge_graph",
		tool: createKnowledgeGraphTool,
		endpoint: "/graphAndStatements",
		params: (flag) => ({ graphName: "test-graph", text: TEXT, includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: flag }),
	},
	{
		name: "memory_add_relations",
		tool: addMemoryTool,
		endpoint: "/graphAndStatements",
		params: (flag) => ({ graphName: "test-graph", text: TEXT, includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: flag }),
	},
	{
		name: "generate_ontology_graph",
		tool: generateOntologyGraphTool,
		endpoint: "/graphAndStatements",
		params: (flag) => ({ prompt: "complex systems", saveGraph: false, includeGraph: true, includeAnalytics: true, includeStatements: false, multifractal: flag }),
	},
	{
		name: "analyze_llm_results",
		tool: analyzeLlmResultsTool,
		endpoint: "/graphAndStatements",
		params: (flag) => ({ prompt: "complex systems", saveGraph: false, includeGraph: true, includeAnalytics: true, includeStatements: false, multifractal: flag }),
	},
	{
		name: "merged_graph_from_texts",
		tool: generateMergedGraphFromTextsTool,
		endpoint: "/graphsAndStatements",
		params: (flag) => ({ contexts: CONTEXTS, includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: flag }),
	},
	{
		name: "overlap_between_texts",
		tool: generateOverlapGraphFromTextsTool,
		endpoint: "/graphsAndStatements",
		params: (flag) => ({ contexts: CONTEXTS, includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: flag }),
	},
	{
		name: "difference_between_texts",
		tool: generateDifferenceGraphFromTextsTool,
		endpoint: "/graphsAndStatements",
		params: (flag) => ({ contexts: CONTEXTS, includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: flag }),
	},
];

describe("graph tools: statistics surface and multifractal flag", () => {
	for (const { name, tool, endpoint, params } of GRAPH_TOOLS) {
		for (const flag of [false, true]) {
			test(`${name} (multifractal: ${flag})`, async () => {
				const { result, calls } = await withFakeApi(() => tool.handler(params(flag)));
				const output = parseToolResult(result);

				const graphCalls = calls.filter((c) => c.url.includes(`${endpoint}?`));
				assert.equal(graphCalls.length, 1, `expected exactly one ${endpoint} call, got ${calls.map((c) => c.url).join(", ")}`);
				const query = queryOf(graphCalls[0].url);
				assert.equal(query.get("addStats"), "true", "addStats=true must be sent");
				assert.equal(
					query.get("multifractal"),
					flag ? "true" : null,
					flag ? "multifractal=true must be sent when the flag is on" : "multifractal must be absent when the flag is off",
				);

				assertStructuredStatistics(output.statistics, { spectrum: "any" });
				assert.deepEqual(output.statistics.diversity_stats, DIVERSITY, "diversity_stats is forwarded unchanged");
				assert.deepEqual(output.statistics.fractal_variability, FRACTAL, "fractal_variability is forwarded unchanged");
				assert.equal(output.statistics.modularity, 0.71);
				assert.equal(output.statistics.clusterCount, DIVERSITY.total_clusters);
				assert.equal(output.statistics.nodeCount, 2);
				assert.equal(output.statistics.edgeCount, 1);

				assert.ok(output.knowledgeGraph?.attributes, `${name}: knowledgeGraph.attributes missing with includeGraph`);
				assert.deepEqual(output.knowledgeGraph.attributes.diversity_stats, DIVERSITY);
				assert.deepEqual(output.knowledgeGraph.attributes.fractal_variability, FRACTAL);
			});
		}
	}

	test("statistics fall back to the placeholder when the graph is not in the response", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async () => {
			const { graph, ...withoutGraph } = graphResponse();
			return fakeResponse(withoutGraph);
		};
		try {
			const result = await runWithConfig(CONFIG, () =>
				analyzeTextTool.handler({ text: TEXT, includeGraph: false, includeStatements: false, addNodesAndEdges: false }),
			);
			const output = parseToolResult(result);
			assert.deepEqual(output.statistics, { modularity: 0, diversity_stats: {}, clusterCount: 0 });
			assert.equal(output.statistics.fractal_variability, undefined);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("fractal_variability is omitted, not fabricated, when the backend does not send it", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async () => {
			const response = graphResponse();
			delete response.graph.graphologyGraph.attributes.fractal_variability;
			return fakeResponse(response);
		};
		try {
			const result = await runWithConfig(CONFIG, () =>
				generateKnowledgeGraphTool.handler({ text: TEXT, includeGraph: true, includeStatements: false, addNodesAndEdges: false }),
			);
			const output = parseToolResult(result);
			assert.deepEqual(output.statistics.diversity_stats, DIVERSITY);
			assert.ok(!("fractal_variability" in output.statistics));
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

// ---------------------------------------------------------------------------
// Optimize tools: top-level diversity_stats and fractal_variability, always
// requested with the graph (no flag: /graphAndAdvice does not honor it).
// ---------------------------------------------------------------------------
describe("optimize tools: top-level statistics surface", () => {
	for (const [name, tool] of [
		["optimize_text_structure", optimizeTextStructureTool],
		["optimize_reasoning", optimizeReasoningTool],
	]) {
		test(name, async () => {
			const { result, calls } = await withFakeApi(() => tool.handler({ text: TEXT }));
			const output = parseToolResult(result);

			assert.equal(calls.length, 1);
			const query = queryOf(calls[0].url);
			assert.ok(calls[0].url.includes("/graphAndAdvice?"));
			assert.equal(query.get("addStats"), "true");
			assert.equal(query.get("includeGraph"), "true", "the graph must be requested or the stats never arrive");

			assertDiversityStats(output.diversity_stats);
			assertFractalVariability(output.fractal_variability);
			assert.deepEqual(output.diversity_stats, DIVERSITY);
			assert.deepEqual(output.fractal_variability, FRACTAL);
			assert.ok(Array.isArray(output.suggestions) && output.suggestions.length > 0);
		});
	}

	test("optimize_knowledge_base nests fractal_variability inside statistics", async () => {
		const { result, calls } = await withFakeApi(() =>
			optimizeKnowledgeBaseTool.handler({ text: TEXT, includeLatent: false }),
		);
		const report = parseToolResult(result);

		const develop = calls.find((c) => c.url.includes("/graphAndAdvice?"));
		assert.ok(develop, "the develop step calls /graphAndAdvice");
		assert.equal(queryOf(develop.url).get("addStats"), "true");

		assert.ok(report.statistics, "report.statistics missing");
		const { fractal_variability, ...diversity } = report.statistics;
		assertDiversityStats(diversity, "report.statistics");
		assert.deepEqual(diversity, DIVERSITY);
		assertFractalVariability(fractal_variability, { where: "report.statistics.fractal_variability" });
		assert.deepEqual(fractal_variability, FRACTAL);
		assert.equal(report.state, "diversified");
	});
});
