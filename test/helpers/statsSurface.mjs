// Shared checks for the "network statistics" surface of a tool response:
// the diversity_stats object and the fractal_variability object that the
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

export const FRACTAL_SERIES = ["statements", "words", "ngrams"];
// Older backends omit the ngrams level; the tests keep a fixture without it.
export const OPTIONAL_FRACTAL_SERIES = ["ngrams"];
export const FRACTAL_MEASURES = ["byStepLength", "byRadialDistance"];
// The fourth level is not a path: one measure, byWords (words per sentence,
// in order), null under 64 sentences. Older backends omit it.
export const SENTENCE_LEVEL = "sentenceLength";
export const SENTENCE_MEASURE = "byWords";
// The influence level is not a path either: three series over the word path
// (node betweenness, node degree, betweenness rank in [0, 1]); the rank series
// is the one to read and the only one that can carry a spectrum. Older
// backends omit the level.
export const INFLUENCE_LEVEL = "influence";
export const INFLUENCE_MEASURES = ["byBetweenness", "byDegree", "byBetweennessRank"];
export const INFLUENCE_SPECTRUM_MEASURE = "byBetweennessRank";

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

function assertScaling(scaling, where, spectrum) {
	assert.equal(typeof scaling.n, "number", `${where}.n`);
	assert.equal(typeof scaling.alphaBounded, "number", `${where}.alphaBounded`);
	assert.equal(typeof scaling.alphaLabel, "string", `${where}.alphaLabel`);
	assertNumberOrNull(scaling.alpha1, `${where}.alpha1`);
	assertNumberOrNull(scaling.alpha2, `${where}.alpha2`);
	assert.ok("multifractal" in scaling, `${where}.multifractal key is missing`);
	if (spectrum === "null") {
		assert.equal(scaling.multifractal, null, `${where}.multifractal should be null`);
	} else if (scaling.multifractal !== null) {
		assertMultifractal(scaling.multifractal, `${where}.multifractal`);
	}
}

/**
 * Check the fractal_variability object.
 *   spectrum: "null"     — every multifractal must be null (flag off / short input)
 *             "required" — at least one series must carry a computed spectrum
 *             "any"      — null or a well-formed spectrum, either is fine
 *   ngrams:   "required" — the ngrams level must be present (default)
 *             "optional" — may be absent (response from an older backend)
 * Each measure may be null (series too short); when present it must be a
 * complete scaling record.
 */
export function assertFractalVariability(
	fractal,
	{ spectrum = "any", ngrams = "required", sentenceLength = "optional", influence = "optional", where = "fractal_variability" } = {},
) {
	assert.ok(fractal && typeof fractal === "object", `${where} is missing`);
	let computedSpectra = 0;
	let computedSeries = 0;
	if (influence === "required" || INFLUENCE_LEVEL in fractal) {
		const level = fractal[INFLUENCE_LEVEL];
		assert.ok(level && typeof level === "object", `${where}.${INFLUENCE_LEVEL}`);
		for (const measure of INFLUENCE_MEASURES) {
			const path = `${where}.${INFLUENCE_LEVEL}.${measure}`;
			assert.ok(measure in level, `${path} key is missing`);
			if (level[measure] === null) continue;
			computedSeries += 1;
			assertScaling(level[measure], path, spectrum);
			if (measure !== INFLUENCE_SPECTRUM_MEASURE) {
				assert.equal(level[measure].multifractal, null, `${path}.multifractal: only the rank series carries a spectrum`);
			} else if (level[measure].multifractal) {
				computedSpectra += 1;
			}
		}
	}
	// sentenceLength does not fit the series x measures iteration below.
	if (sentenceLength === "required" || SENTENCE_LEVEL in fractal) {
		const level = fractal[SENTENCE_LEVEL];
		const path = `${where}.${SENTENCE_LEVEL}.${SENTENCE_MEASURE}`;
		assert.ok(level && typeof level === "object", `${where}.${SENTENCE_LEVEL}`);
		assert.ok(SENTENCE_MEASURE in level, `${path} key is missing`);
		assert.ok(!("byStepLength" in level) && !("byRadialDistance" in level), `${where}.${SENTENCE_LEVEL} is not a path level`);
		if (level[SENTENCE_MEASURE] !== null) {
			computedSeries += 1;
			assertScaling(level[SENTENCE_MEASURE], path, spectrum);
			if (level[SENTENCE_MEASURE].multifractal) computedSpectra += 1;
		}
	}
	for (const series of FRACTAL_SERIES) {
		if (ngrams === "optional" && OPTIONAL_FRACTAL_SERIES.includes(series) && !(series in fractal)) continue;
		assert.ok(fractal[series] && typeof fractal[series] === "object", `${where}.${series}`);
		for (const measure of FRACTAL_MEASURES) {
			const path = `${where}.${series}.${measure}`;
			assert.ok(measure in fractal[series], `${path} key is missing`);
			const scaling = fractal[series][measure];
			if (scaling === null) continue;
			computedSeries += 1;
			assertScaling(scaling, path, spectrum);
			if (scaling.multifractal) computedSpectra += 1;
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
	return assertFractalVariability(statistics.fractal_variability, {
		...options,
		where: "statistics.fractal_variability",
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
 * A fractal_variability fixture in the shape the backend returns. The values
 * follow the sample in the backend's docs/fractal-variability-response.md.
 *   withSpectrum: the word and ngram levels carry a multifractal spectrum
 *   ngrams: "present" (default), "null" (short text: both measures null), or
 *           "absent" (response from an older backend without the level)
 */
export function fractalFixture({ withSpectrum = true, ngrams = "present", sentenceLength = "present", influence = "present" } = {}) {
	const q = [-3, -2, -1, 0, 1, 2, 3];
	const spectrum = withSpectrum
		? {
				label: "multifractal",
				source: "correlations",
				significant: true,
				z: 3.27,
				p: 0.09,
				width: 1.18,
				q,
				hq: [1.66, 1.53, 1.41, 0.56, 0.53, 0.51, 0.5],
				hCurveSlope: -0.16,
				hCurveCurvature: 0.02,
				hCurveNonlinearity: 0.21,
				hMinLocation: 5,
			}
		: null;
	const scaling = (n, alpha, label, multifractal) => ({
		n,
		alphaBounded: alpha,
		alphaLabel: label,
		alpha1: alpha - 0.02,
		alpha1Label: label,
		alpha2: alpha + 0.02,
		alpha2Label: label,
		multifractal,
	});
	return {
		statements: {
			byStepLength: scaling(149, 0.557, "regular", null),
			byRadialDistance: scaling(150, 1.594, "complex", null),
		},
		words: {
			byStepLength: scaling(899, 0.476, "random", spectrum),
			byRadialDistance: scaling(900, 1.506, "complex", spectrum),
		},
		...(ngrams === "present"
			? {
					ngrams: {
						byStepLength: scaling(896, 0.643, "regular", spectrum),
						byRadialDistance: scaling(897, 1.571, "complex", spectrum),
					},
				}
			: ngrams === "null"
				? { ngrams: { byStepLength: null, byRadialDistance: null } }
				: {}),
		// Sample numbers from the backend's docs/fractal-variability-response.md.
		...(sentenceLength === "present"
			? {
					sentenceLength: {
						byWords: {
							n: 450,
							alphaBounded: 0.561,
							alphaLabel: "regular",
							alpha1: 0.682,
							alpha1Label: "regular",
							alpha2: 0.53,
							alpha2Label: "random",
							multifractal: spectrum,
						},
					},
				}
			: sentenceLength === "null"
				? { sentenceLength: { byWords: null } }
				: {}),
		// Sample numbers from docs/fractal-variability-response.md; the spectrum
		// only on the rank series.
		...(influence === "present"
			? {
					influence: {
						byBetweenness: scaling(900, 0.538, "random", null),
						byDegree: scaling(900, 0.51, "random", null),
						byBetweennessRank: scaling(900, 0.557, "regular", spectrum),
					},
				}
			: influence === "null"
				? { influence: { byBetweenness: null, byDegree: null, byBetweennessRank: null } }
				: {}),
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
