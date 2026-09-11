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
	{ spectrum = "any", ngrams = "required", where = "fractal_variability" } = {},
) {
	assert.ok(fractal && typeof fractal === "object", `${where} is missing`);
	let computedSpectra = 0;
	let computedSeries = 0;
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
	return assertFractalVariability(statistics.fractal_variability, {
		...options,
		where: "statistics.fractal_variability",
	});
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
export function fractalFixture({ withSpectrum = true, ngrams = "present" } = {}) {
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
