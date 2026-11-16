// Shared checks for the "network statistics" surface of a tool response:
// the diversity_stats object and the network_dynamics object that the
// backend attaches to the graph attributes when addStats=true, and that the
// server forwards next to each other (see utils/transformers.ts).
//
// Used by test/statsSurface.test.mjs (offline, intercepted fetch) and
// test/live/statsSurface.live.mjs (real API).
import assert from "node:assert/strict";

export const DIVERSITY_KEYS = [
	"diversity_score",
	"modularity_score",
	"too_focused_on_top_nodes",
	"too_focused_on_top_clusters",
	"ratio_of_top_nodes_influence_by_betweenness",
	"top_nodes_entropy",
	"ratio_of_top_cluster_influence_by_betweenness",
	"total_clusters",
	"fair_influence_by_cluster",
];

// The three DFA series of network_dynamics.fractal_variability. Each is null
// when the text is too short for a fit (64 points; 64 sentences for the
// sentence series).
export const DYNAMICS_SERIES = ["ngram4_graph_radial_distance", "sentence_word_count", "node_betweenness_rank"];
// The text type the backend names (network_dynamics.text_type).
export const TEXT_TYPE_LABELS = ["deep dive", "refrain", "chapters", "sweep"];

export function assertDiversityStats(stats, where = "diversity_stats") {
	assert.ok(stats && typeof stats === "object", `${where} is missing`);
	for (const key of DIVERSITY_KEYS) {
		assert.ok(key in stats, `${where}.${key} is missing`);
	}
	assert.equal(typeof stats.diversity_score, "string", `${where}.diversity_score`);
	assert.equal(typeof stats.modularity_score, "string", `${where}.modularity_score`);
	assert.equal(typeof stats.too_focused_on_top_nodes, "boolean");
	assert.equal(typeof stats.too_focused_on_top_clusters, "boolean");
	assert.equal(typeof stats.total_clusters, "number");
	for (const key of [
		"ratio_of_top_nodes_influence_by_betweenness",
		"top_nodes_entropy",
		"ratio_of_top_cluster_influence_by_betweenness",
		"fair_influence_by_cluster",
	]) {
		assert.equal(typeof stats[key], "number", `${where}.${key} should be a number`);
	}
}

function assertNumberOrNull(value, where) {
	assert.ok(
		value === null || typeof value === "number",
		`${where} should be a number or null, got ${typeof value}`,
	);
}

function assertMultifractal(spectrum, where) {
	assert.equal(typeof spectrum.label, "string", `${where}.label`);
	assert.equal(typeof spectrum.width, "number", `${where}.width`);
	assert.ok(Array.isArray(spectrum.q) && spectrum.q.length > 0, `${where}.q`);
	assert.ok(Array.isArray(spectrum.hq), `${where}.hq`);
	assert.equal(spectrum.hq.length, spectrum.q.length, `${where}: q and hq lengths differ`);
	for (const key of ["hCurveSlope", "hCurveCurvature", "hCurveNonlinearity", "hMinLocation"]) {
		assert.equal(typeof spectrum[key], "number", `${where}.${key}`);
	}
}

function assertSeriesBlock(block, where, spectrum) {
	assert.equal(typeof block.series_length, "number", `${where}.series_length`);
	for (const key of ["dfa_alpha_global", "dfa_alpha1", "dfa_alpha2"]) {
		if (key in block) assertNumberOrNull(block[key], `${where}.${key}`);
	}
	if (spectrum === "null") {
		assert.ok(block.multifractal == null, `${where}.multifractal should be absent or null`);
	} else if (block.multifractal != null) {
		assertMultifractal(block.multifractal, `${where}.multifractal`);
	}
}

/**
 * Check the network_dynamics object.
 *   spectrum: "null"     - no series carries a multifractal spectrum (flag off / short input)
 *             "required" - at least one series must carry a computed spectrum
 *             "any"      - absent, null or a well-formed spectrum, all fine
 *   textType: "optional" - text_type may be absent (an older backend) (default)
 *             "required" - text_type must be there
 * A series may be null (too short); when present it must be a complete block.
 */
export function assertNetworkDynamics(dynamics, { spectrum = "any", textType = "optional", where = "network_dynamics" } = {}) {
	assert.ok(dynamics && typeof dynamics === "object", `${where} is missing`);
	const fv = dynamics.fractal_variability;
	assert.ok(fv && typeof fv === "object", `${where}.fractal_variability is missing`);
	let computedSeries = 0;
	let computedSpectra = 0;
	for (const series of DYNAMICS_SERIES) {
		const path = `${where}.fractal_variability.${series}`;
		assert.ok(series in fv, `${path} key is missing`);
		if (fv[series] === null) continue;
		computedSeries += 1;
		assertSeriesBlock(fv[series], path, spectrum);
		if (fv[series].multifractal) computedSpectra += 1;
	}
	assert.equal(typeof fv.sentence_word_count_series_available, "number", `${where}.fractal_variability.sentence_word_count_series_available`);

	assert.ok("node_graph_path_amplitude" in dynamics, `${where}.node_graph_path_amplitude key is missing`);
	const amp = dynamics.node_graph_path_amplitude;
	if (amp !== null) {
		assert.equal(typeof amp.steps, "number", `${where}.node_graph_path_amplitude.steps`);
		for (const key of ["mean_step_relative_to_graph_radius", "cross_cluster_step_share", "mean_radial_distance_relative_to_graph_radius", "radial_distance_cv"]) {
			assert.ok(key in amp, `${where}.node_graph_path_amplitude.${key} key is missing`);
			assertNumberOrNull(amp[key], `${where}.node_graph_path_amplitude.${key}`);
		}
	}

	const rhythm = dynamics.sentence_rhythm;
	assert.ok(rhythm && typeof rhythm === "object", `${where}.sentence_rhythm is missing`);
	assert.equal(typeof rhythm.prose_sentences, "number", `${where}.sentence_rhythm.prose_sentences`);
	assert.equal(typeof rhythm.skipped_fragments_under_12_words, "number", `${where}.sentence_rhythm.skipped_fragments_under_12_words`);
	for (const key of ["mean_words_per_sentence", "share_under_8_words", "share_over_30_words"]) {
		assertNumberOrNull(rhythm[key], `${where}.sentence_rhythm.${key}`);
	}

	if (textType === "required" || dynamics.text_type != null) {
		const type = dynamics.text_type;
		assert.ok(type && typeof type === "object", `${where}.text_type is missing`);
		assert.ok(type.label === null || TEXT_TYPE_LABELS.includes(type.label), `${where}.text_type.label: ${type.label}`);
		if (type.label !== null) {
			assert.equal(typeof type.description, "string", `${where}.text_type.description`);
			assert.equal(typeof type.has_core, "boolean", `${where}.text_type.has_core`);
			assert.equal(typeof type.stays_where_it_goes, "boolean", `${where}.text_type.stays_where_it_goes`);
			assert.ok(["memory", "movement"].includes(type.basis), `${where}.text_type.basis`);
			assert.ok(["clear", "borderline"].includes(type.confidence), `${where}.text_type.confidence`);
		}
	}

	if (spectrum === "required") {
		assert.ok(computedSpectra > 0, `${where}: no series carries a multifractal spectrum`);
	}
	return { computedSeries, computedSpectra };
}

/** The `statistics` block of the structured (knowledge graph) output. */
export function assertStructuredStatistics(statistics, options = {}) {
	assert.ok(statistics && typeof statistics === "object", "statistics is missing");
	assert.equal(typeof statistics.modularity, "number", "statistics.modularity");
	assert.equal(typeof statistics.clusterCount, "number", "statistics.clusterCount");
	assert.equal(typeof statistics.nodeCount, "number", "statistics.nodeCount");
	assert.equal(typeof statistics.edgeCount, "number", "statistics.edgeCount");
	assertDiversityStats(statistics.diversity_stats, "statistics.diversity_stats");
	if (options.degreeDistribution === "required" || "degree_distribution" in statistics) {
		assertDegreeDistribution(statistics.degree_distribution, "statistics.degree_distribution");
	}
	const { degreeDistribution: _degreeDistribution, ...dynamicsOptions } = options;
	return assertNetworkDynamics(statistics.network_dynamics, {
		...dynamicsOptions,
		where: "statistics.network_dynamics",
	});
}

/**
 * Check a degree_distribution object: the whole co-occurrence network before
 * the node cap. tail is null under 50 nodes. histogramTruncated is set by
 * this server when it trimmed the histogram.
 */
export function assertDegreeDistribution(distribution, where = "degree_distribution") {
	assert.ok(distribution && typeof distribution === "object", `${where} is missing`);
	assert.equal(typeof distribution.nodes, "number", `${where}.nodes`);
	assert.equal(typeof distribution.edges, "number", `${where}.edges`);
	assert.ok(Array.isArray(distribution.histogram), `${where}.histogram`);
	for (const row of distribution.histogram) {
		assert.ok(Array.isArray(row) && row.length === 2, `${where}.histogram row [degree, count]`);
		assert.equal(typeof row[0], "number");
		assert.equal(typeof row[1], "number");
	}
	assert.equal(typeof distribution.gini, "number", `${where}.gini`);
	assert.ok(distribution.gini >= 0 && distribution.gini <= 1, `${where}.gini in [0, 1]`);
	assert.ok("tail" in distribution, `${where}.tail key is missing`);
	if (distribution.tail !== null) {
		for (const key of ["alpha", "xmin", "n", "total"]) {
			assert.equal(typeof distribution.tail[key], "number", `${where}.tail.${key}`);
		}
	}
	if ("histogramTruncated" in distribution) {
		assert.equal(distribution.histogramTruncated, true, `${where}.histogramTruncated is only ever true`);
	}
}

/**
 * A degree_distribution fixture. rows: histogram length (a text of a few
 * hundred nodes has ~12 distinct degrees; a large one runs past 40).
 * tail: "present" (default) or "null" (under 50 nodes).
 */
export function degreeDistributionFixture({ rows = 12, tail = "present" } = {}) {
	// A Zipf-like histogram: many low-degree nodes, few hubs.
	const histogram = Array.from({ length: rows }, (_, i) => [i + 1, Math.max(1, Math.round(400 / (i + 1) ** 1.6))]);
	const nodes = histogram.reduce((sum, [, count]) => sum + count, 0);
	return {
		nodes,
		edges: Math.round(nodes * 1.9),
		histogram,
		gini: 0.47,
		tail: tail === "present" ? { alpha: 2.31, xmin: 4, n: 62, total: nodes } : null,
	};
}

/** Parse the JSON text a tool handler returns. */
export function parseToolResult(result) {
	assert.ok(result && Array.isArray(result.content), "tool result has no content");
	assert.ok(!result.isError, `tool returned an error: ${result.content[0]?.text}`);
	return JSON.parse(result.content[0].text);
}

/**
 * A network_dynamics fixture in the shape the backend returns by default.
 * The values come from a real 2300-word text.
 *   withSpectrum: every measured series carries a multifractal spectrum, as
 *                 under multifractal=true
 *   sentences: "present" (default) or "null" (under 64 sentences: no series)
 *   textType: "present" (default) or "absent" (an older backend)
 */
export function networkDynamicsFixture({ withSpectrum = false, sentences = "present", textType = "present" } = {}) {
	const q = [-3, -2, -1, 0, 1, 2, 3];
	const spectrum = withSpectrum
		? {
				multifractal: {
					label: "weak",
					source: "correlations",
					significant: true,
					z: 3.27,
					p: 0.09,
					width: 0.18,
					q,
					hq: [0.81, 0.78, 0.75, 0.72, 0.69, 0.66, 0.63],
					hCurveSlope: -0.03,
					hCurveCurvature: 0.01,
					hCurveNonlinearity: 0.01,
					hMinLocation: 3,
				},
			}
		: {};
	return {
		...(textType === "present"
			? {
					text_type: {
						label: "refrain",
						description:
							"Has a core and keeps moving: the text keeps returning to the same core at an even rate, without settling into any part of it.",
						has_core: true,
						structure: "focused",
						stays_where_it_goes: false,
						basis: "memory",
						memory_score: -0.27,
						confidence: "clear",
					},
				}
			: {}),
		fractal_variability: {
			ngram4_graph_radial_distance: { series_length: 1059, dfa_alpha_global: 0.714, dfa_alpha2: 0.593, ...spectrum },
			sentence_word_count: sentences === "present" ? { series_length: 191, dfa_alpha_global: 0.745, dfa_alpha1: 0.653, ...spectrum } : null,
			sentence_word_count_series_available: sentences === "present" ? 191 : 14,
			node_betweenness_rank: { series_length: 1062, dfa_alpha1: 0.556, ...spectrum },
		},
		node_graph_path_amplitude: {
			steps: 1061,
			mean_step_relative_to_graph_radius: 0.826,
			cross_cluster_step_share: 0.359,
			mean_radial_distance_relative_to_graph_radius: 0.911,
			radial_distance_cv: 0.251,
		},
		sentence_rhythm: {
			prose_sentences: sentences === "present" ? 112 : 9,
			skipped_fragments_under_12_words: 53,
			mean_words_per_sentence: 18.3,
			share_under_8_words: 0.152,
			share_over_30_words: 0.143,
		},
	};
}

export function diversityFixture() {
	return {
		diversity_score: "diversified",
		modularity_score: "high",
		too_focused_on_top_nodes: false,
		too_focused_on_top_clusters: false,
		ratio_of_top_nodes_influence_by_betweenness: 0.39,
		top_nodes_entropy: 2,
		ratio_of_top_cluster_influence_by_betweenness: 0.32,
		total_clusters: 3,
		fair_influence_by_cluster: 0.13,
	};
}
