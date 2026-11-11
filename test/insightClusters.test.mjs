// Offline test for the insight clusters: the `optimize` input of the three
// tools that generate suggestions, and the insightClusters lines in every
// response that carries content gaps. No network is used.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { optimizeKnowledgeBaseTool } from "../dist/tools/optimizeKnowledgeBase.js";
import { generateResearchQuestionsTool } from "../dist/tools/generateResearchQuestions.js";
import { generateResearchIdeasTool } from "../dist/tools/generateResearchIdeas.js";
import { generateContentGapsTool } from "../dist/tools/generateContentGaps.js";
import { generateKnowledgeGraphTool } from "../dist/tools/generateKnowledgeGraph.js";
import {
	OptimizeKnowledgeBaseSchema,
	GenerateResearchQuestionsSchemaBase,
	GenerateResearchIdeasSchemaBase,
} from "../dist/schemas/index.js";

const CONFIG = { apiBase: "https://api.test/api/v1", apiKey: "test-key" };
const TEXT = "Complex systems are made of many parts.\nNetworks describe complex systems.";
const INSIGHT = [
	"Insight clusters 1 (biased): [gap] Cluster Gaps (gap structure) + [gap] City Links (city bridge)",
	"Insight clusters 2 (biased): [gap] City Links (city bridge)",
];

function apiResponse(insightClusters) {
	return {
		graph: {
			graphologyGraph: {
				attributes: { modularity: 0.5, diversity_stats: { diversity_score: "biased" }, top_clusters: [], gaps: [] },
				nodes: [],
				edges: [],
			},
		},
		extendedGraphSummary: {
			contentGaps: ["Gap 1: a -> b"],
			mainTopics: ["Topic A: system network"],
			topicsToDevelop: ["system <-> network"],
			...(insightClusters ? { insightClusters } : {}),
		},
		aiAdvice: [{ text: "Connect gaps and cities." }],
		statements: [],
	};
}

async function call(handler, params, insightClusters = INSIGHT) {
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		calls.push({ query: new URL(String(url)).searchParams, body: JSON.parse(init.body) });
		const json = apiResponse(insightClusters);
		return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
	};
	try {
		const result = await runWithConfig(CONFIG, () => handler(params));
		return { output: JSON.parse(result.content[0].text), calls };
	} finally {
		globalThis.fetch = originalFetch;
	}
}

describe("the optimize input", () => {
	test("defaults to 'optimize' on the three tools and offers the other modes", () => {
		assert.equal(OptimizeKnowledgeBaseSchema.parse({}).optimize, "optimize");
		assert.equal(GenerateResearchQuestionsSchemaBase.parse({}).optimize, "optimize");
		assert.equal(GenerateResearchIdeasSchemaBase.parse({}).optimize, "optimize");
		for (const mode of ["develop", "latent"]) {
			assert.equal(OptimizeKnowledgeBaseSchema.parse({ optimize: mode }).optimize, mode);
			assert.equal(GenerateResearchQuestionsSchemaBase.parse({ optimize: mode }).optimize, mode);
			assert.equal(GenerateResearchIdeasSchemaBase.parse({ optimize: mode }).optimize, mode);
		}
		assert.equal(GenerateResearchQuestionsSchemaBase.parse({ optimize: "gap" }).optimize, "gap");
		assert.throws(() => OptimizeKnowledgeBaseSchema.parse({ optimize: "gap" }));
	});

	test("optimize_knowledge_base sends the mode and gap depth, and returns the insight clusters", async () => {
		const { output, calls } = await call(optimizeKnowledgeBaseTool.handler, {
			text: TEXT,
			includeLatent: false,
			gapDepth: 1,
		});
		assert.equal(calls.length, 1);
		assert.equal(calls[0].query.get("optimize"), "optimize");
		assert.equal(calls[0].query.get("gapDepth"), "1");
		assert.equal(calls[0].body.requestMode, "response");
		assert.equal(output.optimize, "optimize");
		assert.deepEqual(output.insightClusters, INSIGHT);
		assert.equal(output.gapDepth, 1);
	});

	test("optimize_knowledge_base 'optimize' is one call unless the latent pass is asked for", async () => {
		const byDefault = await call(optimizeKnowledgeBaseTool.handler, { text: TEXT });
		assert.deepEqual(byDefault.calls.map((c) => c.query.get("optimize")), ["optimize"]);
		assert.equal("latentIdeas" in byDefault.output, false);

		const withLatent = await call(optimizeKnowledgeBaseTool.handler, { text: TEXT, includeLatent: true });
		assert.deepEqual(withLatent.calls.map((c) => c.query.get("optimize")), ["optimize", "latent"]);
	});

	test("optimize_knowledge_base 'develop' keeps the latent pass as a second call", async () => {
		const { calls } = await call(optimizeKnowledgeBaseTool.handler, { text: TEXT, optimize: "develop" });
		assert.deepEqual(calls.map((c) => c.query.get("optimize")), ["develop", "latent"]);
	});

	test("optimize_knowledge_base 'latent' is one call, not two", async () => {
		const { output, calls } = await call(optimizeKnowledgeBaseTool.handler, { text: TEXT, optimize: "latent" });
		assert.equal(calls.length, 1);
		assert.equal(calls[0].query.get("optimize"), "latent");
		assert.equal(calls[0].body.requestMode, "transcend");
		assert.deepEqual(output.underdeveloped, ["system <-> network"]);
	});

	test("generate_research_questions follows the mode and returns the insight clusters", async () => {
		const byDefault = await call(generateResearchQuestionsTool.handler, { text: TEXT });
		assert.equal(byDefault.calls[0].query.get("optimize"), "optimize");
		assert.equal(byDefault.calls[0].query.get("extendedGraphSummary"), "true");
		assert.deepEqual(byDefault.output.questions, ["Connect gaps and cities."]);
		assert.deepEqual(byDefault.output.insightClusters, INSIGHT);

		const widestGap = await call(generateResearchQuestionsTool.handler, { text: TEXT, optimize: "gap", gapDepth: 2 });
		assert.equal(widestGap.calls[0].query.get("optimize"), "gap");
		assert.equal(widestGap.calls[0].query.get("gapDepth"), "2");
	});

	test("generate_research_ideas follows the mode and returns the insight clusters", async () => {
		const byDefault = await call(generateResearchIdeasTool.handler, { text: TEXT });
		assert.equal(byDefault.calls[0].query.get("optimize"), "optimize");
		assert.deepEqual(byDefault.output.insightClusters, INSIGHT);

		const latent = await call(generateResearchIdeasTool.handler, { text: TEXT, optimize: "latent", responseType: "idea" });
		assert.equal(latent.calls[0].query.get("optimize"), "latent");
		assert.deepEqual(latent.output.ideas, ["Connect gaps and cities."]);
		assert.deepEqual(latent.output.insightClusters, INSIGHT);
	});
});

describe("insightClusters beside the content gaps", () => {
	test("generate_content_gaps and generate_knowledge_graph return them", async () => {
		const gaps = await call(generateContentGapsTool.handler, { text: TEXT });
		assert.deepEqual(gaps.output.contentGaps, ["Gap 1: a -> b"]);
		assert.deepEqual(gaps.output.insightClusters, INSIGHT);

		const graph = await call(generateKnowledgeGraphTool.handler, { text: TEXT });
		assert.deepEqual(graph.output.insightClusters, INSIGHT);
	});

	test("an API that sends none leaves the field out", async () => {
		const gaps = await call(generateContentGapsTool.handler, { text: TEXT }, null);
		assert.equal("insightClusters" in gaps.output, false);
		const report = await call(optimizeKnowledgeBaseTool.handler, { text: TEXT, includeLatent: false }, []);
		assert.equal("insightClusters" in report.output, false);
		assert.equal("gapDepth" in report.output, false);
	});
});
