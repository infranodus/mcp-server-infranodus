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
import { analyzeTextSignatureTool } from "../../dist/tools/analyzeTextSignature.js";
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
	assertNetworkDynamics,
	parseToolResult,
	assertDegreeDistribution,
	TEXT_TYPE_LABELS,
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
// Under 70 words: the node path has fewer than 64 steps, so no series of
// network_dynamics.fractal_variability can be fitted and all three are null.
const TINY_TEXT = PARAGRAPHS[0];
// 300+ statements: every series is long enough for a fit.
const VERY_LONG_TEXT = Array.from({ length: 14 }, () => PARAGRAPHS).flat().join("\n");
// The multifractal spectrum needs a series of at least 512 points
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
	const graphParams = (text, extra = {}) => ({ text, includeGraph: true, includeStatements: false, addNodesAndEdges: false, ...extra });

	live("generate_knowledge_graph (defaults) returns network_dynamics without a spectrum", async () => {
		const output = parseToolResult(await run(() => generateKnowledgeGraphTool.handler(graphParams(SHORT_TEXT))));
		assertStructuredStatistics(output.statistics, { spectrum: "null" });
		assertNetworkDynamics(output.knowledgeGraph.attributes.network_dynamics, { spectrum: "null", where: "knowledgeGraph.attributes.network_dynamics" });
	});

	live("analyze_text with multifractal on a long text returns a computed spectrum", async () => {
		const output = parseToolResult(await run(() => analyzeTextTool.handler(graphParams(LONG_TEXT, { multifractal: true }))));
		const { computedSpectra } = assertStructuredStatistics(output.statistics, { spectrum: "required" });
		assert.ok(computedSpectra >= 1, "at least one series carries the spectrum");
		assert.deepEqual(output.knowledgeGraph.attributes.network_dynamics, output.statistics.network_dynamics, "graph attributes and statistics agree");
	});

	live("generate_knowledge_graph on 300+ statements returns all three series, the text type and the degree distribution", async () => {
		const output = parseToolResult(await run(() => generateKnowledgeGraphTool.handler(graphParams(VERY_LONG_TEXT))));
		const { computedSeries } = assertStructuredStatistics(output.statistics, { spectrum: "null", textType: "required", degreeDistribution: "required" });
		assert.equal(computedSeries, 3, "the 4-gram, sentence and influence series are all fitted");
		const dynamics = output.statistics.network_dynamics;
		const fv = dynamics.fractal_variability;
		assert.equal(typeof fv.ngram4_graph_radial_distance.dfa_alpha2, "number");
		assert.equal(typeof fv.sentence_word_count.dfa_alpha_global, "number");
		assert.equal(typeof fv.node_betweenness_rank.dfa_alpha1, "number");
		assert.ok(fv.ngram4_graph_radial_distance.series_length <= dynamics.node_graph_path_amplitude.steps, "the 4-gram path is shorter than the node path");
		// a text this long is named from memory, never from the size of its steps
		assert.ok(TEXT_TYPE_LABELS.includes(dynamics.text_type.label), `text type: ${dynamics.text_type.label}`);
		assert.equal(dynamics.text_type.basis, "memory");
		assert.equal(typeof dynamics.text_type.memory_score, "number");
		const degrees = output.statistics.degree_distribution;
		assert.ok(degrees.nodes > output.statistics.nodeCount, "the distribution counts the whole network, the graph shows the capped one");
		assert.ok(degrees.tail && typeof degrees.tail.alpha === "number", "tail fitted on 50+ nodes");
	});

	live("generate_knowledge_graph on a text under 70 words returns null series, no text type from memory, and a null tail", async () => {
		const output = parseToolResult(await run(() => generateKnowledgeGraphTool.handler(graphParams(TINY_TEXT))));
		const { computedSeries } = assertStructuredStatistics(output.statistics, { spectrum: "null", degreeDistribution: "required" });
		assert.equal(computedSeries, 0, "no series can be fitted on a path this short");
		const dynamics = output.statistics.network_dynamics;
		assert.equal(dynamics.fractal_variability.sentence_word_count, null);
		assert.ok(dynamics.fractal_variability.sentence_word_count_series_available < 64);
		assert.notEqual(dynamics.text_type?.basis, "memory", "there is no exponent to judge memory by");
		assert.equal(output.statistics.degree_distribution.tail, null);
	});

	live("analyze_text with fullGraph keeps the statistics on the non-compacted graph", async () => {
		const output = parseToolResult(await run(() => analyzeTextTool.handler({ text: SHORT_TEXT, fullGraph: true, includeStatements: false })));
		assertStructuredStatistics(output.statistics, { spectrum: "null" });
		assertNetworkDynamics(output.knowledgeGraph.attributes.network_dynamics, { where: "knowledgeGraph.attributes.network_dynamics" });
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
			assertNetworkDynamics(output.knowledgeGraph.attributes.network_dynamics, { where: "knowledgeGraph.attributes.network_dynamics" });
		});
	}

	live("create_knowledge_graph, analyze_existing_graph_by_name, memory_add_relations on a saved graph", async () => {
		const created = parseToolResult(await run(() => createKnowledgeGraphTool.handler({ graphName, ...graphParams(SHORT_TEXT) })));
		graphCreated = true;
		assertStructuredStatistics(created.statistics, { spectrum: "null" });

		const analyzed = parseToolResult(
			await run(() => analyzeExistingGraphTool.handler({ graphName, includeGraph: true, includeStatements: false, addNodesAndEdges: false, multifractal: true })),
		);
		assertStructuredStatistics(analyzed.statistics, { spectrum: "any" });

		const remembered = parseToolResult(
			await run(() => addMemoryTool.handler({ graphName, ...graphParams(PARAGRAPHS.slice(8, 12).join("\n")) })),
		);
		assertStructuredStatistics(remembered.statistics, { spectrum: "null" });
	});

	live("analyze_text_signature returns the backend's text type with readings and ai_likeness", async () => {
		const output = parseToolResult(await run(() => analyzeTextSignatureTool.handler({ text: LONG_TEXT, multifractal: true })));
		assertDiversityStats(output.structure.diversity_stats, "structure.diversity_stats");
		assertNetworkDynamics(output.network_dynamics, { spectrum: "required" });
		assert.ok(TEXT_TYPE_LABELS.includes(output.signature.label), `signature: ${output.signature.label}`);
		assert.equal(output.signature.basis, "memory");
		assert.equal(typeof output.signature.summary, "string");
		assert.equal(Object.keys(output.signature.label_possible_values).length, 4);
		// the default fields are shown; the experimental ones only on request
		assert.ok(!("step_cv" in output.network_dynamics.node_graph_path_amplitude));
		assert.ok(output.network_dynamics.node_graph_path_amplitude.steps >= 512, "a node path long enough for the spectrum");
		assert.ok(output.network_dynamics.sentence_rhythm.prose_sentences >= 60);
		assert.equal(typeof output.readings.fractal_variability.sentence_word_count.dfa_alpha_global, "string");
		assert.equal(typeof output.readings.node_graph_path_amplitude.mean_step_relative_to_graph_radius, "string");
		assert.equal(typeof output.readings.sentence_rhythm.coverage, "string");
		assertDegreeDistribution(output.structure.degree_distribution, "structure.degree_distribution");
		assert.ok(["leaning AI", "leaning human", "mixed"].includes(output.ai_likeness.verdict));
		assert.equal(typeof output.ai_likeness.verdict_explanation, "string");
		assert.ok(output.ai_likeness.evidence.length >= 1);
	});

	live("analyze_text_signature on a short note has no sentence series and says how many sentences there were", async () => {
		const output = parseToolResult(await run(() => analyzeTextSignatureTool.handler({ text: SHORT_TEXT })));
		assert.equal(output.network_dynamics.fractal_variability.sentence_word_count, null);
		assert.ok(output.network_dynamics.fractal_variability.sentence_word_count_series_available < 64);
		assert.equal(output.readings.fractal_variability.sentence_word_count.dfa_alpha_global, undefined, "no reading for an exponent that was not fitted");
	});

	liveAi("optimize_text_structure returns top-level diversity_stats and network_dynamics", async () => {
		const output = parseToolResult(await run(() => optimizeTextStructureTool.handler({ text: SHORT_TEXT })));
		assertDiversityStats(output.diversity_stats);
		assertNetworkDynamics(output.network_dynamics);
	});

	liveAi("optimize_reasoning returns top-level diversity_stats and network_dynamics", async () => {
		const output = parseToolResult(await run(() => optimizeReasoningTool.handler({ text: SHORT_TEXT })));
		assertDiversityStats(output.diversity_stats);
		assertNetworkDynamics(output.network_dynamics);
	});

	liveAi("optimize_knowledge_base nests network_dynamics inside statistics", async () => {
		const report = parseToolResult(await run(() => optimizeKnowledgeBaseTool.handler({ text: SHORT_TEXT, includeLatent: false })));
		assert.ok(report.statistics, "report.statistics missing");
		const { network_dynamics, degree_distribution: _degrees, ...diversity } = report.statistics;
		assertDiversityStats(diversity, "report.statistics");
		assertNetworkDynamics(network_dynamics, { where: "report.statistics.network_dynamics" });
	});
});
