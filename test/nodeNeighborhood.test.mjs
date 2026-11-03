// get_node_neighborhood and the hops settings, through the real handlers and
// an intercepted fetch (no network), against the app's /nodeNeighborhood,
// /graphAndAdvice and memory contracts (infranodus-app routes/entries.js,
// routes/memory.js). The traversal itself is tested in the app.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { getNodeNeighborhoodTool } from "../dist/tools/getNodeNeighborhood.js";
import { retrieveContextForPromptFromGraphTool } from "../dist/tools/retrieveContextForPromptFromGraph.js";
import { getProjectLearningsTool } from "../dist/tools/getProjectLearnings.js";
import { GetNodeNeighborhoodSchema, RetrieveContextForPromptFromGraphSchema } from "../dist/schemas/index.js";

function withFetch(handler, fn) {
	return async () => {
		const originalFetch = globalThis.fetch;
		const calls = [];
		globalThis.fetch = async (url, init) => {
			const [path, query] = String(url).replace("https://api.test", "").split("?");
			const body = JSON.parse(init.body);
			calls.push({ path, query: new URLSearchParams(query || ""), body });
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

const run = (tool, params) =>
	runWithConfig({ apiBase: "https://api.test", apiKey: "k" }, () => tool.handler(params));
const payload = (result) => JSON.parse(result.content[0].text);

test(
	"get_node_neighborhood sends the node spellings and returns neighbors by hop",
	withFetch(
		() => [
			{
				graphName: "learn-app",
				hops: 2,
				matched: ["[[gpu]]"],
				nodes: [{ node: "[[gpu]]", degree: 2, community: 1 }],
				neighbors: [
					{ node: "[[alexnet]]", hop: 1, weight: 3, via: null, community: 1, statementIds: [10] },
					{ node: "[[deep_learning]]", hop: 2, weight: 2, via: "[[alexnet]]", community: 0, statementIds: [12] },
				],
				statements: [{ id: 10, content: "s10", categories: ["type-trap"], hop: 1 }],
			},
		],
		async (calls) => {
			const params = GetNodeNeighborhoodSchema.parse({ graphName: "learn-app", node: ["gpu", "gpus"] });
			const out = payload(await run(getNodeNeighborhoodTool, params));
			assert.equal(calls[0].path, "/nodeNeighborhood");
			assert.deepEqual(calls[0].body.nodes, ["gpu", "gpus"]);
			assert.equal(calls[0].body.hops, 2, "defaults to 2 hops");
			assert.deepEqual(out.neighbors, [
				{ node: "[[alexnet]]", hop: 1, weight: 3, cluster: 1 },
				{ node: "[[deep_learning]]", hop: 2, weight: 2, via: "[[alexnet]]", cluster: 0 },
			]);
			assert.equal(out.statements[0].hop, 1);
		},
	),
);

test(
	"get_node_neighborhood passes on similar names for an unknown concept",
	withFetch(
		() => [{ error: "No node", errorCode: "node_not_found", suggestions: ["[[nodemon.json]]"] }, 404],
		async () => {
			const out = payload(
				await run(getNodeNeighborhoodTool, GetNodeNeighborhoodSchema.parse({ graphName: "g", node: "nodemon" })),
			);
			assert.equal(out.notFound, true);
			assert.deepEqual(out.suggestions, ["[[nodemon.json]]"]);
		},
	),
);

test(
	"retrieve_from_knowledge_base and get_project_learnings pass hops through",
	withFetch(
		(path) => (path === "/graphAndAdvice" ? [{ statements: [] }] : [{ enabled: true, learnings: [] }]),
		async (calls) => {
			await run(
				retrieveContextForPromptFromGraphTool,
				RetrieveContextForPromptFromGraphSchema.parse({ graphName: "g", prompt: "p", hops: 2, topK: 12 }),
			);
			assert.equal(calls[0].query.get("hops"), "2");
			assert.equal(calls[0].query.get("topK"), "12");
			await run(getProjectLearningsTool, { project: "app", entity: "parser", hops: 2, limit: 15 });
			assert.equal(calls[1].path, "/learnings/get");
			assert.equal(calls[1].body.hops, 2);
		},
	),
);
