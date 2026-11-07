// get_term_graph through the real handler and an intercepted fetch (no
// network), against the app's /termGraph contract (infranodus-app
// routes/termGraph.js). The search and the build are the app's and
// infrasonic's; here: what is sent, and how the answer is passed on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { getTermGraphTool } from "../dist/tools/getTermGraph.js";
import { GetTermGraphSchema } from "../dist/schemas/index.js";

function withFetch(handler, fn) {
	return async () => {
		const originalFetch = globalThis.fetch;
		const calls = [];
		globalThis.fetch = async (url, init) => {
			const path = String(url).replace("https://api.test", "").split("?")[0];
			const body = JSON.parse(init.body);
			calls.push({ path, body });
			const [json, status = 200] = handler(path, body);
			return {
				ok: status < 400,
				status,
				json: async () => json,
				text: async () => JSON.stringify(json),
			};
		};
		try {
			await fn(calls);
		} finally {
			globalThis.fetch = originalFetch;
		}
	};
}

const run = (params) =>
	runWithConfig({ apiBase: "https://api.test", apiKey: "k" }, () =>
		getTermGraphTool.handler(GetTermGraphSchema.parse(params)),
	);
const payload = (result) => JSON.parse(result.content[0].text);

const appAnswer = (withNodes) => ({
	terms: ["gpu"],
	matchAll: true,
	removedTerms: ["gpu"],
	graphs: [{ graphName: "learn-app", statements: 2 }],
	statementCount: 2,
	graphSummary: "<Main Concepts> cuda </Main Concepts>",
	extendedGraphSummary: {
		mainTopics: ["Build: [[cuda]] [[driver]]"],
		contentGaps: ["Gap 1: Build -> Deploy"],
		mainConcepts: ["[[cuda]]"],
		topRelations: ["[[cuda]] <-> [[driver]]"],
		conceptualGateways: [],
		topBigrams: [],
	},
	graph: {
		graphologyGraph: {
			attributes: {
				modularity: 0.4,
				diversity_stats: { diversity_score: "diversified", total_clusters: 2 },
				top_influential_nodes: [{ node: "[[cuda]]", bc: 0.5, degree: 3 }],
			},
			...(withNodes
				? {
						nodes: [{ key: "[[cuda]]", attributes: { bc: 0.5 } }],
						edges: [{ source: "[[cuda]]", target: "[[driver]]", attributes: { weight: 2 } }],
					}
				: {}),
		},
	},
	statements: [
		{ id: 5, content: "[[gpu]] needs [[cuda]]", categories: [], graphName: "learn-app", topStatementCommunity: "1" },
	],
});

test(
	"get_term_graph sends the terms with the defaults and returns the structure of the term-less graph",
	withFetch(
		() => [appAnswer(true)],
		async (calls) => {
			const out = payload(await run({ terms: "gpu" }));
			assert.equal(calls[0].path, "/termGraph");
			assert.deepEqual(calls[0].body.terms, ["gpu"]);
			assert.deepEqual(calls[0].body.graphNames, []);
			assert.equal(calls[0].body.matchAll, true);
			assert.equal(calls[0].body.removeTerms, true);
			assert.equal(calls[0].body.includeGraph, true);
			assert.equal(calls[0].body.includeStatements, false);
			assert.equal(calls[0].body.maxNodes, 150);

			assert.deepEqual(out.terms, ["gpu"]);
			assert.equal(out.matchAll, true);
			assert.deepEqual(out.removedTerms, ["gpu"]);
			assert.deepEqual(out.graphs, [{ graphName: "learn-app", statements: 2 }]);
			assert.equal(out.statementCount, 2);
			assert.equal(out.statistics.modularity, 0.4);
			assert.equal(out.statistics.clusterCount, 2);
			assert.equal(out.statistics.nodeCount, 1);
			assert.deepEqual(out.mainTopicalClusters, ["Build: [[cuda]] [[driver]]"]);
			assert.deepEqual(out.contentGaps, ["Gap 1: Build -> Deploy"]);
			assert.deepEqual(out.topRelations, ["[[cuda]] <-> [[driver]]"]);
			assert.equal(out.knowledgeGraph.nodes.length, 1, "the compact graph is in by default");
			assert.equal(out.knowledgeGraph.edges.length, 1);
			assert.equal(out.statements, undefined, "statements are opt-in");
		},
	),
);

test(
	"get_term_graph passes the scope and the options through, and keeps the statistics without the graph",
	withFetch(
		() => [appAnswer(false)],
		async (calls) => {
			const out = payload(
				await run({
					terms: ["[[GPU]]", "driver"],
					graphNames: ["learn-app", "notes"],
					matchAll: false,
					removeTerms: false,
					includeGraph: false,
					includeStatements: true,
					maxNodes: 300,
				}),
			);
			assert.deepEqual(calls[0].body.terms, ["[[GPU]]", "driver"]);
			assert.deepEqual(calls[0].body.graphNames, ["learn-app", "notes"]);
			assert.equal(calls[0].body.matchAll, false);
			assert.equal(calls[0].body.removeTerms, false);
			assert.equal(calls[0].body.includeGraph, false);
			assert.equal(calls[0].body.includeStatements, true);
			assert.equal(calls[0].body.maxNodes, 300);

			assert.equal(out.statistics.modularity, 0.4, "statistics come either way");
			assert.equal(out.knowledgeGraph, undefined);
			assert.equal(out.statements.length, 1);
			assert.equal(out.statements[0].graphName, "learn-app");
		},
	),
);

test(
	"get_term_graph answers an empty search without a graph, and passes refusals on",
	withFetch(
		(path, body) =>
			body.terms[0] === "nothing"
				? [{ terms: ["nothing"], removedTerms: ["nothing"], graphs: [], statementCount: 0 }]
				: [{ error: 'Graph "nope" not found.', errorCode: "graph_not_found" }, 404],
		async () => {
			const empty = payload(await run({ terms: "nothing" }));
			assert.deepEqual(empty, { terms: ["nothing"], removedTerms: ["nothing"], graphs: [], statementCount: 0 });

			const refused = await run({ terms: "gpu", graphNames: ["nope"] });
			assert.equal(refused.isError, true);
			assert.equal(payload(refused).errorCode, "graph_not_found");
		},
	),
);
