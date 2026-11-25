// modifyAnalyzedText 'aiKnowledgeGraph' on generate/create_knowledge_graph, and
// the ontology tool's unsaved build, driven through the real handlers with an
// intercepted fetch (no network).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { generateKnowledgeGraphTool } from "../dist/tools/generateKnowledgeGraph.js";
import { createKnowledgeGraphTool } from "../dist/tools/createKnowledgeGraph.js";
import { generateOntologyGraphTool } from "../dist/tools/generateOntologyGraph.js";
import { connectsTwoEntities } from "../dist/utils/aiKnowledgeGraph.js";
import { GenerateGraphSchema, CreateGraphSchema } from "../dist/schemas/index.js";

const WIKILINKS_ONLY = {
	doubleSquarebracketsProcessing: "PROCESS_AS_HASHTAGS_IGNORE_THE_REST",
	partOfSpeechToProcess: "HASHTAGS_ONLY",
};

const AI_ANSWER = [
	"```",
	"[[Allen Ginsberg]] wrote [[Howl]] in [[San Francisco]].",
	"[[City Lights Books]] published [[Howl]].",
	"The Beat Generation",
	"[[Jack Kerouac]] was a novelist.",
	"```",
].join("\n");

function fakeResponse(json) {
	return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
}

const GRAPH = {
	statements: [],
	graph: { graphologyGraph: { attributes: { top_clusters: [], gaps: [] }, nodes: [], edges: [] } },
};

function stubFetch({ aiAnswer = AI_ANSWER, aiError } = {}) {
	const calls = [];
	globalThis.fetch = async (url, init) => {
		const entry = { url: String(url), body: init?.body ? JSON.parse(init.body) : undefined };
		calls.push(entry);
		if (entry.url.includes("/aiAdvice")) {
			return fakeResponse(aiError ? { error: aiError } : { choices: [{ message: { content: aiAnswer } }] });
		}
		if (entry.url.includes("/graphAndStatements")) return fakeResponse(GRAPH);
		throw new Error(`unexpected request: ${entry.url}`);
	};
	return calls;
}

async function run(tool, schema, params) {
	const originalFetch = globalThis.fetch;
	const calls = stubFetch(params.__stub);
	delete params.__stub;
	try {
		const result = await runWithConfig({ apiBase: "https://api.test", apiKey: "k" }, () =>
			tool.handler(schema.parse(params)),
		);
		return { result, calls };
	} finally {
		globalThis.fetch = originalFetch;
	}
}

const aiCalls = (calls) => calls.filter((c) => c.url.includes("/aiAdvice"));
const graphCalls = (calls) => calls.filter((c) => c.url.includes("/graphAndStatements"));

test("connectsTwoEntities keeps only statements that link two [[entities]]", () => {
	assert.equal(connectsTwoEntities("[[a]] relates to [[b]]"), true);
	assert.equal(connectsTwoEntities("[[a]] is alone"), false);
	assert.equal(connectsTwoEntities("no entities"), false);
});

describe("generate_knowledge_graph with aiKnowledgeGraph", () => {
	test("asks the AI for entity statements, then builds the graph from them with wikilinksOnly", async () => {
		const { result, calls } = await run(generateKnowledgeGraphTool, GenerateGraphSchema, {
			text: "the Beat Generation",
			modifyAnalyzedText: "aiKnowledgeGraph",
			modelToUse: "claude-sonnet-5-5",
			instructions: "  only people and works  ",
		});
		assert.equal(result.isError, undefined);
		assert.equal(calls.length, 2);

		const [ai] = aiCalls(calls);
		assert.equal(ai.body.aiQueryType, "entity graph");
		assert.equal(ai.body.saveToGraphAndRedirect, false);
		assert.equal(ai.body.modelToUse, "claude-sonnet-5-5");
		assert.equal(ai.body.systemPrompt, "only people and works");
		assert.deepEqual(ai.body.prompt, [{ role: "user", content: "the Beat Generation" }]);

		const [graph] = graphCalls(calls);
		assert.equal(new URL(graph.url).searchParams.get("doNotSave"), "true");
		assert.equal(new URL(graph.url).searchParams.get("includeGraph"), "true");
		assert.deepEqual(graph.body.statements, [
			"[[Allen Ginsberg]] wrote [[Howl]] in [[San Francisco]].",
			"[[City Lights Books]] published [[Howl]].",
		]);
		assert.deepEqual(graph.body.contextSettings, WIKILINKS_ONLY);
		assert.equal(graph.body.modifyAnalyzedText, undefined, "no entity detection on top");
	});

	test("sends no systemPrompt without instructions and defaults the model", async () => {
		const { calls } = await run(generateKnowledgeGraphTool, GenerateGraphSchema, {
			text: "coral reefs",
			modifyAnalyzedText: "aiKnowledgeGraph",
		});
		const [ai] = aiCalls(calls);
		assert.equal("systemPrompt" in ai.body, false);
		assert.equal(ai.body.modelToUse, "claude-opus-5-5");
	});

	test("splits a long text into one AI call per chunk", async () => {
		const line = "Statement about [[A]] and [[B]] in some detail.".padEnd(100, ".");
		const text = Array.from({ length: 300 }, () => line).join("\n");
		const { calls } = await run(generateKnowledgeGraphTool, GenerateGraphSchema, {
			text,
			modifyAnalyzedText: "aiKnowledgeGraph",
		});
		assert.equal(aiCalls(calls).length, 3);
		assert.equal(graphCalls(calls).length, 1);
		assert.equal(graphCalls(calls)[0].body.statements.length, 6);
	});

	test("uses the statements of the input as its text", async () => {
		const { calls } = await run(generateKnowledgeGraphTool, GenerateGraphSchema, {
			statements: ["Ginsberg wrote Howl.", "Ferlinghetti published it."],
			modifyAnalyzedText: "aiKnowledgeGraph",
		});
		assert.equal(aiCalls(calls)[0].body.prompt[0].content, "Ginsberg wrote Howl.\nFerlinghetti published it.");
	});

	test("returns an error and builds nothing when the AI writes no entity statements", async () => {
		const { result, calls } = await run(generateKnowledgeGraphTool, GenerateGraphSchema, {
			text: "the Beat Generation",
			modifyAnalyzedText: "aiKnowledgeGraph",
			__stub: { aiAnswer: "Just prose without entities." },
		});
		assert.equal(result.isError, true);
		assert.match(result.content[0].text, /no statements with two \[\[entities\]\]/);
		assert.equal(graphCalls(calls).length, 0);
	});

	test("passes an AI error through", async () => {
		const { result, calls } = await run(generateKnowledgeGraphTool, GenerateGraphSchema, {
			text: "the Beat Generation",
			modifyAnalyzedText: "aiKnowledgeGraph",
			__stub: { aiError: "AI quota exceeded" },
		});
		assert.equal(result.isError, true);
		assert.match(result.content[0].text, /AI quota exceeded/);
		assert.equal(graphCalls(calls).length, 0);
	});

	test("other modes make no AI call", async () => {
		const { calls } = await run(generateKnowledgeGraphTool, GenerateGraphSchema, {
			text: "Ginsberg wrote Howl.",
			modifyAnalyzedText: "extractEntitiesOnly",
		});
		assert.equal(aiCalls(calls).length, 0);
		assert.equal(graphCalls(calls)[0].body.modifyAnalyzedText, "extractEntitiesOnly");
	});

	test("is not marked idempotent: the AI answer varies", () => {
		assert.equal(generateKnowledgeGraphTool.definition.annotations.idempotentHint, false);
	});
});

describe("create_knowledge_graph with aiKnowledgeGraph", () => {
	test("saves the AI entity statements as a WIKILINKS graph", async () => {
		const { calls } = await run(createKnowledgeGraphTool, CreateGraphSchema, {
			graphName: "beat-generation",
			text: "the Beat Generation",
			modifyAnalyzedText: "aiKnowledgeGraph",
		});
		const [graph] = graphCalls(calls);
		assert.equal(new URL(graph.url).searchParams.get("doNotSave"), "false");
		assert.equal(graph.body.name, "beat-generation");
		assert.equal(graph.body.contextType, "WIKILINKS");
		assert.deepEqual(graph.body.contextSettings, WIKILINKS_ONLY);
		assert.equal(graph.body.statements.length, 2);
		assert.equal(graph.body.modifyAnalyzedText, undefined);
	});
});

describe("generate_ontology_graph without saving", () => {
	test("builds the graph from its [[entity]] statements with wikilinksOnly, not entity detection", async () => {
		const { calls } = await run(generateOntologyGraphTool, { parse: (p) => p }, {
			prompt: "the Beat Generation",
			saveGraph: false,
			__stub: { aiAnswer: "[[Allen Ginsberg]] [wrote] [[Howl]]" },
		});
		const [graph] = graphCalls(calls);
		assert.deepEqual(graph.body.contextSettings, WIKILINKS_ONLY);
		assert.equal(graph.body.modifyAnalyzedText, undefined);
		assert.equal(graph.body.text, "[[Allen Ginsberg]] [wrote] [[Howl]]");
	});

	const aiCalls = (calls) => calls.filter((c) => c.url.includes("/aiAdvice"));

	test("sends the user's relation codes in the prompt and instructions as systemPrompt", async () => {
		const { calls } = await run(generateOntologyGraphTool, { parse: (p) => p }, {
			prompt: "the Beat Generation",
			relations: ["influenced", "[published]", "  "],
			instructions: "only people and books",
			saveGraph: false,
		});
		const [ai] = aiCalls(calls);
		assert.equal(
			ai.body.prompt[0].content,
			"the Beat Generation\n\nUse only these relation codes: [influenced], [published]",
		);
		assert.equal(ai.body.systemPrompt, "only people and books");
	});

	test("applies relations to every text chunk, and neither field when absent", async () => {
		const text = Array.from({ length: 300 }, (_, i) => `Line ${i} about the Beats.`).join("\n");
		const { calls } = await run(generateOntologyGraphTool, { parse: (p) => p }, {
			text,
			chunkSize: 2000,
			relations: ["influenced"],
			saveGraph: false,
		});
		const ai = aiCalls(calls);
		assert.ok(ai.length > 1);
		for (const call of ai) {
			assert.ok(call.body.prompt[0].content.endsWith("\n\nUse only these relation codes: [influenced]"));
			assert.equal(call.body.systemPrompt, undefined);
		}

		const plain = await run(generateOntologyGraphTool, { parse: (p) => p }, {
			prompt: "the Beat Generation",
			saveGraph: false,
		});
		const [plainAi] = aiCalls(plain.calls);
		assert.equal(plainAi.body.prompt[0].content, "the Beat Generation");
		assert.equal(plainAi.body.systemPrompt, undefined);
	});

	test("procedural mode ignores relations but keeps instructions", async () => {
		const { calls } = await run(generateOntologyGraphTool, { parse: (p) => p }, {
			text: "The router hands requests to the handler.",
			ontologyMode: "procedural",
			relations: ["calls"],
			instructions: "focus on the request path",
			saveGraph: false,
		});
		const [ai] = aiCalls(calls);
		assert.equal(ai.body.aiQueryType, "digest");
		assert.ok(!ai.body.prompt[0].content.includes("relation codes"));
		assert.equal(ai.body.systemPrompt, "focus on the request path");
	});
});

describe("analyze_llm_results", async () => {
	const { analyzeLlmResultsTool, splitModelAnswers } = await import("../dist/tools/analyzeLlmResults.js");
	const { AnalyzeLlmResultsSchema } = await import("../dist/schemas/index.js");
	const aiCalls = (calls) => calls.filter((c) => c.url.includes("/aiAdvice"));
	const MODEL_ANSWERS = [
		"```",
		"? recommendation | What is the best espresso machine for beginners?",
		"The Breville Bambino is a common pick.",
		"Gaggia Classic is a sturdier option.",
		"? cost | How much should I spend?",
		"Expect 300 to 700 dollars.",
		"```",
	].join("\n");

	test("splitModelAnswers turns question lines into categories, as the app does", () => {
		const { statements, categories, answers } = splitModelAnswers([
			"? Comparison | A or B?",
			"A is cheaper.",
			"? untagged question",
			"B lasts longer.",
		]);
		assert.deepEqual(statements, ["A is cheaper.", "B lasts longer."]);
		assert.deepEqual(categories, [["intent: comparison", "A or B?"], ["untagged question"]]);
		assert.deepEqual(answers, [
			{ intent: "comparison", question: "A or B?", answers: ["A is cheaper."] },
			{ question: "untagged question", answers: ["B lasts longer."] },
		]);
	});

	test("overview sends instructions as systemPrompt and hides search terms the way the server reads it", async () => {
		const { calls } = await run(analyzeLlmResultsTool, AnalyzeLlmResultsSchema, {
			prompt: "espresso",
			instructions: "only home machines",
			context: "x",
		});
		const [ai] = aiCalls(calls);
		assert.equal(ai.body.aiQueryType, "llm graph");
		assert.equal(ai.body.systemPrompt, "only home machines");
		assert.equal(ai.body.excludesearchquery, "1");
		assert.equal(ai.body.hideSearchTerms, undefined);
	});

	test("modelAnswers sends 'model answers', drops instructions, and builds the graph with question categories", async () => {
		const { result, calls } = await run(analyzeLlmResultsTool, AnalyzeLlmResultsSchema, {
			prompt: "espresso machines",
			answerMode: "modelAnswers",
			instructions: "ignored here",
			context: "x",
			__stub: { aiAnswer: MODEL_ANSWERS },
		});
		const [ai] = aiCalls(calls);
		assert.equal(ai.body.aiQueryType, "model answers");
		assert.equal(ai.body.systemPrompt, undefined);
		const [graph] = graphCalls(calls);
		assert.deepEqual(graph.body.statements, [
			"The Breville Bambino is a common pick.",
			"Gaggia Classic is a sturdier option.",
			"Expect 300 to 700 dollars.",
		]);
		assert.deepEqual(graph.body.categories[2], ["intent: cost", "How much should I spend?"]);
		const output = JSON.parse(result.content[0].text);
		assert.equal(output.modelAnswers.length, 2);
		assert.equal(output.modelAnswers[0].intent, "recommendation");
		assert.equal(output.modelAnswers[0].answers.length, 2);
	});
});
