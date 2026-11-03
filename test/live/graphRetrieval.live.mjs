// Live retrieval test: hop-aware GraphRAG retrieval, node neighborhoods and
// memory reads with hops, through the real tools against a real server, on
// graphs with a known shape. Not part of `npm test`.
//
//   npm run test:live            (all live tests)
//   node --test test/live/graphRetrieval.live.mjs
//
// Needs INFRANODUS_API_KEY (or KEYWORDGRAPH_API_KEY). Optional
// INFRANODUS_API_BASE (default: the brand's API root). The server must have
// the app's /nodeNeighborhood route and hop-aware /learnings/get.
//
// It creates two graphs, mcp-hops-<timestamp> and learn-hoptest-<timestamp>
// (a project learnings graph), and deletes both at the end.
//
// The knowledge graph is a chain, entity-only so no word nodes get in the way:
//   alpha_node — beta_node — gamma_node — delta_node — epsilon_node
// so from alpha_node, beta is 1 hop, gamma 2, delta 3.
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../../dist/api/config-store.js";
import { brandApiBase } from "../../dist/config/brand.js";
import { createKnowledgeGraphTool } from "../../dist/tools/createKnowledgeGraph.js";
import { deleteGraphTool } from "../../dist/tools/deleteGraph.js";
import { getNodeNeighborhoodTool } from "../../dist/tools/getNodeNeighborhood.js";
import { retrieveContextForPromptFromGraphTool } from "../../dist/tools/retrieveContextForPromptFromGraph.js";
import { enableProjectLearningsTool } from "../../dist/tools/enableProjectLearnings.js";
import { addProjectLearningsTool } from "../../dist/tools/addProjectLearnings.js";
import { getProjectLearningsTool } from "../../dist/tools/getProjectLearnings.js";

const apiKey = process.env.INFRANODUS_API_KEY || process.env.KEYWORDGRAPH_API_KEY;
const apiBase = process.env.INFRANODUS_API_BASE || brandApiBase();
const live = apiKey ? test : test.skip;
if (!apiKey) console.log("# live retrieval: INFRANODUS_API_KEY not set, skipping");

const run = (tool, params) => runWithConfig({ apiBase, apiKey }, () => tool.handler(params));
const payload = (result) => {
	assert.ok(result && Array.isArray(result.content), "tool result has no content");
	assert.ok(!result.isError, `tool returned an error: ${result.content[0]?.text}`);
	return JSON.parse(result.content[0].text);
};
/** A read can run before the server sees a graph created a moment ago. */
async function eventually(fn, tries = 4) {
	for (let i = 0; ; i++) {
		try {
			return await fn();
		} catch (error) {
			if (i >= tries - 1) throw error;
			await new Promise((r) => setTimeout(r, 1500));
		}
	}
}

const stamp = Date.now();
const graphName = `mcp-hops-${stamp}`;
const project = `hoptest-${stamp}`;
const learningsGraph = `learn-${project}`;
const created = new Set();

const CHAIN = [
	"[[alpha_node]] invokes [[beta_node]]",
	"[[beta_node]] stores into [[gamma_node]]",
	"[[gamma_node]] is archived by [[delta_node]]",
	"[[delta_node]] reports to [[epsilon_node]]",
	"[[alpha_node]] listens on port 7000", // one entity: on no edge
];
const LEARNINGS = [
	"[[alpha_mod]] invokes [[beta_mod]] during boot",
	"[[beta_mod]] writes into [[gamma_store]] without locking",
	"[[gamma_store]] is compacted by [[delta_job]] overnight",
];
// With fewer than 3 direct matches the retrieval also runs its vector-search
// fallback, which can return the same statement again with its own score, so
// a statement is judged by the best score it got.
const best = (statements, text, field = "similarityScore") => {
	const found = statements.filter((s) => s.content.includes(text)).map((s) => Number(s[field].toFixed(3)));
	return found.length ? Math.max(...found) : null;
};

after(async () => {
	for (const name of created) {
		const result = await run(deleteGraphTool, { graphName: name, confirm: true });
		if (result.isError) console.log(`# live retrieval: could not delete ${name}: ${result.content[0]?.text}`);
	}
});

describe(`live retrieval against ${apiBase}`, () => {
	live("setup: a chain graph and a project with learnings", async () => {
		payload(
			await run(createKnowledgeGraphTool, {
				graphName,
				statements: CHAIN,
				modifyAnalyzedText: "extractEntitiesOnly",
				includeGraph: false,
				includeStatements: false,
				addNodesAndEdges: false,
			}),
		);
		created.add(graphName);

		const enabled = payload(await run(enableProjectLearningsTool, { project }));
		assert.equal(enabled.enabled, true);
		created.add(learningsGraph);
		const added = payload(
			await run(addProjectLearningsTool, {
				project,
				statements: LEARNINGS,
				types: ["location", "trap", "workflow"],
				confirm: true,
			}),
		);
		assert.equal(added.added ?? added.count ?? LEARNINGS.length, LEARNINGS.length, JSON.stringify(added));
	});

	describe("get_node_neighborhood", () => {
		live("hops 1: only the direct neighbor and its statement", async () => {
			const out = await eventually(async () => {
				const p = payload(await run(getNodeNeighborhoodTool, { graphName, node: "alpha_node", hops: 1 }));
				assert.ok(p.neighbors?.length, "no neighbors yet");
				return p;
			});
			assert.deepEqual(p(out.concept), ["[[alpha_node]]"]);
			assert.deepEqual(out.neighbors.map((n) => [n.node, n.hop]), [["[[beta_node]]", 1]]);
			assert.deepEqual(out.statements.map((s) => [s.content, s.hop]), [[CHAIN[0], 1]]);
		});

		live("hops 2 and 3 reach one and two steps further, each with the node it came through", async () => {
			const two = payload(await run(getNodeNeighborhoodTool, { graphName, node: "alpha_node", hops: 2 }));
			assert.deepEqual(two.neighbors.map((n) => [n.node, n.hop, n.via ?? null]), [
				["[[beta_node]]", 1, null],
				["[[gamma_node]]", 2, "[[beta_node]]"],
			]);
			assert.deepEqual(two.statements.map((s) => [s.content, s.hop]), [[CHAIN[0], 1], [CHAIN[1], 2]]);

			const three = payload(await run(getNodeNeighborhoodTool, { graphName, node: "ALPHA NODE", hops: 3 }));
			assert.deepEqual(three.neighbors.map((n) => n.node), ["[[beta_node]]", "[[gamma_node]]", "[[delta_node]]"]);
			assert.equal(three.neighbors[2].via, "[[gamma_node]]");
			assert.ok(!three.neighbors.some((n) => n.node === "[[epsilon_node]]"), "epsilon is 4 hops away");
		});

		live("several nodes: the statement linking them is hop 0, and neighbors say which node they hang off", async () => {
			const out = payload(
				await run(getNodeNeighborhoodTool, { graphName, node: ["alpha_node", "beta_node"], hops: 1 }),
			);
			assert.deepEqual(p(out.concept), ["[[alpha_node]]", "[[beta_node]]"]);
			assert.deepEqual(out.statements.map((s) => [s.content, s.hop]), [[CHAIN[0], 0], [CHAIN[1], 1]]);
			assert.deepEqual(out.neighbors.map((n) => [n.node, n.via]), [["[[gamma_node]]", "[[beta_node]]"]]);
		});

		live("an unknown node gets similar names; a lowered maxNodes still finds a small graph's node", async () => {
			const missing = payload(await run(getNodeNeighborhoodTool, { graphName, node: "alpha_nod", hops: 2 }));
			assert.equal(missing.notFound, true);
			assert.ok(missing.suggestions.includes("[[alpha_node]]"), JSON.stringify(missing.suggestions));

			const small = payload(await run(getNodeNeighborhoodTool, { graphName, node: "epsilon_node", hops: 1, maxNodes: 10 }));
			assert.deepEqual(small.neighbors.map((n) => n.node), ["[[delta_node]]"]);
		});
	});

	describe("retrieve_from_knowledge_base with hops", () => {
		live("hops 1: the direct statement scores 1 and nothing is scored as a hop", async () => {
			const out = await eventually(async () => {
				const p = payload(
					await run(retrieveContextForPromptFromGraphTool, {
						graphName,
						prompt: "[[alpha_node]]",
						hops: 1,
						includeGraphSummary: false,
					}),
				);
				assert.ok(p.retrievedStatements?.length, "nothing retrieved yet");
				return p;
			});
			assert.equal(best(out.retrievedStatements, CHAIN[0]), 1);
			assert.ok(
				!out.retrievedStatements.some((s) => [0.5, 1 / 3].some((h) => Math.abs(s.similarityScore - h) < 1e-9)),
				"no hop-scored statements at hops 1",
			);
		});

		live("hops 2 adds the statement one step further at 1/2; hops 3 adds the next at 1/3", async () => {
			const two = payload(
				await run(retrieveContextForPromptFromGraphTool, {
					graphName,
					prompt: "[[alpha_node]]",
					hops: 2,
					includeGraphSummary: false,
				}),
			);
			assert.equal(best(two.retrievedStatements, CHAIN[0]), 1, "direct still scores 1");
			assert.ok(
				two.retrievedStatements.some((s) => s.content.includes(CHAIN[1]) && s.similarityScore === 0.5),
				JSON.stringify(two.retrievedStatements),
			);
			assert.ok(
				!two.retrievedStatements.some((s) => s.content.includes(CHAIN[2]) && s.similarityScore === 0.5),
				"gamma–delta is 3 steps away",
			);

			const three = payload(
				await run(retrieveContextForPromptFromGraphTool, {
					graphName,
					prompt: "[[alpha_node]]",
					hops: 3,
					includeGraphSummary: false,
				}),
			);
			assert.ok(
				three.retrievedStatements.some((s) => s.content.includes(CHAIN[2]) && Math.abs(s.similarityScore - 1 / 3) < 1e-9),
				JSON.stringify(three.retrievedStatements),
			);
			assert.equal(three.retrievedStatements[0].similarityScore, 1, "direct matches come first");
		});
	});

	describe("project learnings with hops", () => {
		live("entity without hops: the statements mentioning it", async () => {
			const out = await eventually(async () => {
				const p = payload(await run(getProjectLearningsTool, { project, entity: "alpha_mod", limit: 15 }));
				assert.ok(p.learnings?.length, "no learnings yet");
				return p;
			});
			assert.deepEqual(out.learnings.map((l) => l.content), [LEARNINGS[0]]);
		});

		live("entity with hops 2: mentions as hop 1, the next step as hop 2, and what it is connected to", async () => {
			const out = payload(await run(getProjectLearningsTool, { project, entity: "alpha_mod", hops: 2, limit: 15 }));
			assert.deepEqual(out.matched, ["[[alpha_mod]]"]);
			assert.deepEqual(
				out.learnings.map((l) => [l.content, l.hop, l.types]),
				[[LEARNINGS[0], 1, ["location"]], [LEARNINGS[1], 2, ["trap"]]],
			);
			assert.ok(out.learnings.every((l) => l.createdAt), "createdAt is kept");
			const byNode = Object.fromEntries(out.connected.map((c) => [c.node, c]));
			assert.equal(byNode["[[beta_mod]]"].hop, 1);
			assert.equal(byNode["[[gamma_store]]"].hop, 2);
			assert.equal(byNode["[[gamma_store]]"].via, "[[beta_mod]]");
			assert.ok(!byNode["[[delta_job]]"], "delta_job is 3 hops away");

			const traps = payload(
				await run(getProjectLearningsTool, { project, entity: "alpha_mod", hops: 2, type: "trap", limit: 15 }),
			);
			assert.deepEqual(traps.learnings.map((l) => l.content), [LEARNINGS[1]], "type filters the hop read");
		});

		live("entity with hops that is not a node: not found, with suggestions", async () => {
			const out = payload(await run(getProjectLearningsTool, { project, entity: "alpha_mo", hops: 2, limit: 15 }));
			assert.equal(out.notFound, true);
			assert.ok(out.suggestions.includes("[[alpha_mod]]"), JSON.stringify(out.suggestions));
			assert.deepEqual(out.learnings, []);
		});

		live("prompt with hops 2: direct learnings score 1, the next step 0.5", async () => {
			const out = payload(
				await run(getProjectLearningsTool, { project, prompt: "[[alpha_mod]]", hops: 2, limit: 15 }),
			);
			assert.equal(best(out.learnings, LEARNINGS[0], "similarity"), 1);
			assert.ok(
				out.learnings.some((l) => l.content === LEARNINGS[1] && l.similarity === 0.5),
				JSON.stringify(out.learnings),
			);
		});

		live("recall (the plugin's first-prompt read) adds what shares an entity with a match", async () => {
			const response = await fetch(`${apiBase}/recall`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
				body: JSON.stringify({ project, prompt: "what invokes what during boot?" }),
			});
			assert.equal(response.status, 200);
			const out = await response.json();
			assert.equal(out.exists, true);
			assert.equal(out.items[0].text, LEARNINGS[0], "the direct match first");
			assert.equal(out.items[0].via, undefined);
			assert.deepEqual([out.items[1].text, out.items[1].via], [LEARNINGS[1], "beta_mod"]);
			assert.ok(out.block.includes("(linked through [[beta_mod]])"), out.block);
		});
	});
});

/** The tool answers `concept` as the matched nodes' stats; this keeps the keys. */
function p(concept) {
	return (concept || []).map((c) => c.node);
}
