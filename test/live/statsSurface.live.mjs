// Live surface test: calls the real API through every tool that returns
// network statistics and checks the returned data surface (shape, presence,
// and the multifractal flag behavior). Not part of `npm test`.
//
//   npm run test:live
//
// Needs INFRANODUS_API_KEY (or KEYWORDGRAPH_API_KEY). Optional:
//   INFRANODUS_API_BASE  — API root, default https://infranodus.com/api/v1
//   LIVE_SKIP_AI=1       — skip the tools that call an LLM (ontology, LLM
//                          results, the three optimize tools)
//
// The saving tools create one graph named mcp-stats-surface-<timestamp> and
// delete it at the end.
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../../dist/api/config-store.js";
import { brandApiBase } from "../../dist/config/brand.js";
import { generateKnowledgeGraphTool } from "../../dist/tools/generateKnowledgeGraph.js";
import { analyzeTextTool } from "../../dist/tools/analyzeText.js";
import { analyzeExistingGraphTool } from "../../dist/tools/analyzeExistingGraph.js";
import { createKnowledgeGraphTool } from "../../dist/tools/createKnowledgeGraph.js";
import { addMemoryTool } from "../../dist/tools/addMemory.js";
import { deleteGraphTool } from "../../dist/tools/deleteGraph.js";
import { generateOntologyGraphTool } from "../../dist/tools/generateOntologyGraph.js";
import { analyzeLlmResultsTool } from "../../dist/tools/analyzeLlmResults.js";
import { generateMergedGraphFromTextsTool } from "../../dist/tools/generateMergedGraphFromTexts.js";
import { generateOverlapGraphFromTextsTool } from "../../dist/tools/generateOverlapGraphFromTexts.js";
import { generateDifferenceGraphFromTextsTool } from "../../dist/tools/generateDifferenceGraphFromTexts.js";
import { optimizeTextStructureTool } from "../../dist/tools/optimizeTextStructure.js";
import { optimizeReasoningTool } from "../../dist/tools/optimizeReasoning.js";
import { optimizeKnowledgeBaseTool } from "../../dist/tools/optimizeKnowledgeBase.js";
import {
	assertStructuredStatistics,
	assertDiversityStats,
	assertFractalVariability,
	parseToolResult,
} from "../helpers/statsSurface.mjs";

const apiKey = process.env.INFRANODUS_API_KEY || process.env.KEYWORDGRAPH_API_KEY;
const apiBase = process.env.INFRANODUS_API_BASE || brandApiBase();
const skipAi = process.env.LIVE_SKIP_AI === "1";

const live = apiKey ? test : test.skip;
const liveAi = apiKey && !skipAi ? test : test.skip;
if (!apiKey) console.log("# live stats surface: INFRANODUS_API_KEY not set, skipping");

const run = (fn) => runWithConfig({ apiBase, apiKey }, fn);

const PARAGRAPHS = [
	"Complex systems are made of many interacting parts whose collective behavior cannot be predicted from the parts alone. The whole is not simply the sum of the components, because the relationships between them carry as much information as the components themselves.",
	"Networks provide a natural language for describing complex systems. Nodes represent components and edges represent interactions, and the topology of the network constrains which dynamics are possible and which are not.",
	"Emergence happens when local interactions between agents produce global patterns that no single agent intended. A flock of birds has no leader, yet it turns as one body, because each bird follows a few simple rules about distance and alignment with its neighbors.",
	"Feedback loops amplify or dampen change. Positive feedback drives growth and collapse, negative feedback restores balance, and the interplay between them decides whether a system settles, oscillates, or drifts toward a new regime.",
	"Ecosystems show resilience when diversity allows some species to compensate for the loss of others. A forest with many kinds of trees survives a pest that would wipe out a plantation of a single species, because functional redundancy spreads the risk across the community.",
	"Cities grow along fractal patterns, with streets and neighborhoods repeating similar structures at different scales. The branching of roads resembles the branching of rivers and lungs, a signature of systems that must distribute flows efficiently across space.",
	"The human brain is a network of neurons whose modular organization supports both specialization and integration. Regions dedicated to vision, language, and movement work in relative isolation, yet long-range connections bind them into coherent experience.",
	"Language evolves through the interactions of speakers, and word frequencies follow power laws across many languages. A few words are used constantly while most are rare, and this distribution emerges from the tension between the effort of the speaker and the needs of the listener.",
	"Markets aggregate the decisions of millions of traders, and price fluctuations show heavy tails and volatility clustering. Calm periods are interrupted by bursts of activity, and large moves are far more common than a normal distribution would predict.",
	"Self-organized criticality describes systems that naturally move toward a state where small events can trigger avalanches of any size. Sand piles, earthquakes, and forest fires all display this behavior, with event sizes following a power law rather than a characteristic scale.",
	"Scale-free networks have hubs with many connections, making them robust to random failure but fragile to targeted attack. Removing a random node rarely matters, but removing a hub can fragment the entire system into disconnected islands.",
	"Information spreads through social networks in cascades whose size depends on the structure of communities and bridges. Ideas circulate quickly within tight clusters, but only cross to other clusters through the weak ties that connect otherwise separate groups.",
	"Adaptation occurs when a system changes its internal structure in response to the environment while keeping its identity. Immune systems, economies, and cultures all learn in this way, preserving what works and discarding what fails.",
	"Modeling complex systems requires simulation because analytical solutions rarely exist for nonlinear interactions. Agent-based models let researchers watch macroscopic patterns emerge from microscopic rules, and sensitivity analysis reveals which parameters matter most.",
	"Understanding the fractal and multiscale structure of discourse helps reveal whether thinking is repetitive, random, or complex. A text that returns to the same ideas at regular intervals has a different signature from one that wanders without memory or one that balances recurrence with novelty.",
	"Time series from complex systems often show long-range correlations, meaning that what happens now is influenced by what happened long ago. Detrended fluctuation analysis measures this memory with a scaling exponent that separates random noise from persistent structure.",
	"Multifractal analysis extends this idea by asking whether the scaling exponent itself varies across the series. A monofractal signal scales the same way everywhere, while a multifractal signal has regions of different roughness, which is common in turbulence, heartbeat intervals, and natural language.",
	"Phase transitions occur when a small change in a control parameter produces a sudden qualitative change in the system. Water freezes, magnets align, and traffic jams form abruptly once density crosses a threshold, and near these points fluctuations grow without bound.",
	"Robustness and evolvability pull in opposite directions. A system that resists all perturbation cannot adapt, while one that changes with every disturbance cannot maintain its function, so living systems settle into a regime that is stable enough to persist and flexible enough to learn.",
	"Networks of networks add another layer of complexity. Power grids depend on communication networks that depend on power, and failures in one layer can cascade into the other, producing outages far larger than either network would suffer alone.",
	"Collective intelligence arises when groups solve problems that no individual could solve. Ant colonies find shortest paths, markets discover prices, and scientific communities accumulate knowledge, all through distributed processes with no central coordinator.",
	"The study of complex systems draws on physics, biology, economics, and computer science, and its central lesson is that structure and dynamics cannot be separated. To understand what a system does, one must understand how its parts are connected and how those connections change over time.",
];
const SHORT_TEXT = PARAGRAPHS.slice(0, 8).join("\n");
// The multifractal spectrum needs a word series of at least 512 steps
// (MIN_STEPS_FOR_MULTIFRACTAL in the backend); three passes over the sample
// get there with the default 150-node cap.
const LONG_TEXT = [...PARAGRAPHS, ...PARAGRAPHS, ...PARAGRAPHS].join("\n");
const CONTEXTS = [
	{ text: PARAGRAPHS.slice(0, 11).join("\n") },
	{ text: PARAGRAPHS.slice(11).join("\n") },
];

const graphName = `mcp-stats-surface-${Date.now()}`;
let graphCreated = false;

after(async () => {
	if (!graphCreated) return;
	const result = await run(() => deleteGraphTool.handler({ graphName, confirm: true }));
	if (result.isError) console.log(`# live stats surface: could not delete ${graphName}: ${result.content[0]?.text}`);
});

describe(`live stats surface against ${apiBase}`, () => {
	live("generate_knowledge_graph (defaults) returns fractal_variability with a null spectrum", async () => {
		const output = parseToolResult(
			await run(() => generateKnowledgeGraphTool.handler({ text: SHORT_TEXT, includeGraph: true, includeStatements: false, addNodesAndEdges: false })),
		);
		assertStructuredStatistics(output.statistics, { spectrum: "null" });
		assertFractalVariability(output.knowledgeGraph.attributes.fractal_variability, { spectrum: "null", where: "knowledgeGraph.attributes.fractal_variability" });
	});

	live("analyze_text with multifractal on a long text returns a computed spectrum", async () => {
		const output = parseToolResult(
			await run(() => analyzeTextTool.handler({ text: LONG_TEXT, includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: true })),
		);
		const { computedSpectra } = assertStructuredStatistics(output.statistics, { spectrum: "required" });
		assert.ok(computedSpectra >= 1, "at least one word series carries the spectrum");
		assert.deepEqual(output.knowledgeGraph.attributes.fractal_variability, output.statistics.fractal_variability, "graph attributes and statistics agree");
	});

	live("analyze_text with fullGraph keeps the statistics on the non-compacted graph", async () => {
		const output = parseToolResult(
			await run(() => analyzeTextTool.handler({ text: SHORT_TEXT, fullGraph: true, includeStatements: false })),
		);
		assertStructuredStatistics(output.statistics, { spectrum: "null" });
		assertFractalVariability(output.knowledgeGraph.attributes.fractal_variability, { where: "knowledgeGraph.attributes.fractal_variability" });
		assert.ok(Array.isArray(output.knowledgeGraph.nodes) && output.knowledgeGraph.nodes.length > 0, "fullGraph returns nodes");
	});

	for (const [name, tool] of [
		["merged_graph_from_texts", generateMergedGraphFromTextsTool],
		["overlap_between_texts", generateOverlapGraphFromTextsTool],
		["difference_between_texts", generateDifferenceGraphFromTextsTool],
	]) {
		live(`${name} with includeGraph returns both statistics objects`, async () => {
			const output = parseToolResult(
				await run(() => tool.handler({ contexts: CONTEXTS, includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: true })),
			);
			assertStructuredStatistics(output.statistics, { spectrum: "any" });
			assertFractalVariability(output.knowledgeGraph.attributes.fractal_variability, { where: "knowledgeGraph.attributes.fractal_variability" });
		});
	}

	live("create_knowledge_graph, analyze_existing_graph_by_name, memory_add_relations on a saved graph", async () => {
		const created = parseToolResult(
			await run(() => createKnowledgeGraphTool.handler({ graphName, text: SHORT_TEXT, includeGraph: true, includeStatements: false, addNodesAndEdges: false })),
		);
		graphCreated = true;
		assertStructuredStatistics(created.statistics, { spectrum: "null" });

		const analyzed = parseToolResult(
			await run(() => analyzeExistingGraphTool.handler({ graphName, includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: true })),
		);
		assertStructuredStatistics(analyzed.statistics, { spectrum: "any" });

		const remembered = parseToolResult(
			await run(() => addMemoryTool.handler({ graphName, text: PARAGRAPHS.slice(8, 12).join("\n"), includeGraph: true, includeStatements: false, addNodesAndEdges: false })),
		);
		assertStructuredStatistics(remembered.statistics, { spectrum: "null" });
	});

	liveAi("optimize_text_structure returns top-level diversity_stats and fractal_variability", async () => {
		const output = parseToolResult(await run(() => optimizeTextStructureTool.handler({ text: SHORT_TEXT })));
		assertDiversityStats(output.diversity_stats);
		assertFractalVariability(output.fractal_variability);
	});

	liveAi("optimize_reasoning returns top-level diversity_stats and fractal_variability", async () => {
		const output = parseToolResult(await run(() => optimizeReasoningTool.handler({ text: SHORT_TEXT })));
		assertDiversityStats(output.diversity_stats);
		assertFractalVariability(output.fractal_variability);
	});

	liveAi("optimize_knowledge_base nests fractal_variability inside statistics", async () => {
		const report = parseToolResult(await run(() => optimizeKnowledgeBaseTool.handler({ text: SHORT_TEXT, includeLatent: false })));
		assert.ok(report.statistics, "report.statistics missing");
		const { fractal_variability, ...diversity } = report.statistics;
		assertDiversityStats(diversity, "report.statistics");
		assertFractalVariability(fractal_variability, { where: "report.statistics.fractal_variability" });
	});

	liveAi("generate_ontology_graph (not saved) returns statistics from the graph build", async () => {
		const output = parseToolResult(
			await run(() => generateOntologyGraphTool.handler({ prompt: "complex systems and networks", saveGraph: false, includeGraph: true, includeAnalytics: true, includeStatements: false, multifractal: true })),
		);
		assert.equal(output.saved, false);
		assertStructuredStatistics(output.statistics, { spectrum: "any" });
	});

	liveAi("analyze_llm_results (not saved) returns statistics from the graph build", async () => {
		const output = parseToolResult(
			await run(() => analyzeLlmResultsTool.handler({ prompt: "What are complex systems?", saveGraph: false, includeGraph: true, includeAnalytics: true, includeStatements: false, multifractal: true })),
		);
		assert.equal(output.saved, false);
		assertStructuredStatistics(output.statistics, { spectrum: "any" });
	});
});
