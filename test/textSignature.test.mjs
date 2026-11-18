// Offline tests for analyze_text_signature. The backend computes every
// measure and the text type (network_dynamics); this server maps the public
// names to its reading shape, writes one sentence per measure, passes the
// backend's text type through as the signature, weighs a hedged AI-likeness
// estimate, and decides which fields are shown. The tool handler is tested
// with an intercepted fetch (request flags, response shape). No network.
// Part of `npm test`.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { analyzeTextSignatureTool } from "../dist/tools/analyzeTextSignature.js";
import {
	buildTextSignature,
	composeSignature,
	confidenceFor,
	estimateAiLikeness,
	interpretNetworkDynamics,
	movementBand,
	readDegreeDistribution,
	readStructure,
	toDefaultFields,
	toReadingShape,
} from "../dist/utils/textSignature.js";
import { diversityFixture, degreeDistributionFixture, parseToolResult } from "./helpers/statsSurface.mjs";

const CONFIG = { apiBase: "https://api.test/api/v1", apiKey: "test-key" };

// ---------------------------------------------------------------------------
// Fixtures: network_dynamics as the backend returns it with
// fractalExperimental=true (every field), taken from a real 2300-word text
// ---------------------------------------------------------------------------

const REFRAIN = {
	label: "refrain",
	description:
		"Has a core and keeps moving: the text keeps returning to the same core at an even rate, without settling into any part of it.",
	has_core: true,
	structure: "focused",
	stays_where_it_goes: false,
	basis: "memory",
	memory_score: -0.27,
	confidence: "clear",
};

const series = (n, global, a1, a2) => ({
	series_length: n,
	dfa_alpha_global: global,
	dfa_alpha_global_label: "regular",
	dfa_alpha1: a1,
	dfa_alpha1_label: "regular",
	dfa_alpha2: a2,
	dfa_alpha2_label: "regular",
	multifractal: null,
});

function networkDynamicsFixture(overrides = {}) {
	return {
		text_type: REFRAIN,
		fractal_variability: {
			ngram4_graph_radial_distance: series(1059, 0.714, 1.181, 0.593),
			sentence_word_count: series(191, 0.745, 0.653, 0.9),
			sentence_word_count_series_available: 191,
			node_betweenness_rank: series(1062, 0.554, 0.556, 0.563),
		},
		node_graph_path_amplitude: {
			graph_radius_rms: 113.731,
			steps: 1061,
			mean_step_relative_to_graph_radius: 0.826,
			step_cv: 0.606,
			step_lag1_autocorrelation: 0.201,
			cross_cluster_step_share: 0.359,
			cluster_dwell_cv: 1.116,
			mean_radial_distance_relative_to_graph_radius: 0.911,
			radial_distance_cv: 0.251,
		},
		sentence_rhythm: {
			prose_sentences: 112,
			prose_statements: 54,
			skipped_fragments_under_12_words: 53,
			mean_words_per_sentence: 18.3,
			words_per_sentence_cv: 0.576,
			words_per_sentence_lag1_autocorrelation: -0.104,
			share_under_8_words: 0.152,
			share_over_30_words: 0.143,
		},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Public names -> the internal reading shape, and the default field set
// ---------------------------------------------------------------------------

describe("toReadingShape", () => {
	test("maps the API's public names to the shape the readers use", () => {
		const shape = toReadingShape(networkDynamicsFixture());
		assert.deepEqual(shape.ngrams.byRadialDistance, {
			n: 1059,
			alphaBounded: 0.714,
			alphaLabel: "regular",
			alpha1: 1.181,
			alpha1Label: "regular",
			alpha2: 0.593,
			alpha2Label: "regular",
			multifractal: null,
		});
		assert.equal(shape.sentenceLength.sentences, 191);
		assert.equal(shape.sentenceLength.byWords.alphaBounded, 0.745);
		assert.equal(shape.influence.byBetweennessRank.alpha1, 0.556);
		assert.deepEqual(shape.amplitude, {
			graphRadius: 113.731,
			words: {
				n: 1061,
				meanStep: 0.826,
				cvStep: 0.606,
				lag1Autocorrelation: 0.201,
				crossClusterShare: 0.359,
				crossClusterRunCV: 1.116,
				meanRadial: 0.911,
				cvRadial: 0.251,
			},
		});
		assert.deepEqual(shape.sentenceRhythm, {
			sentences: 112,
			skippedFragments: 53,
			meanLength: 18.3,
			cvLength: 0.576,
			lag1Autocorrelation: -0.104,
			shortShare: 0.152,
			longShare: 0.143,
			statements: 54,
		});
	});

	test("a series the backend could not fit stays null, and nothing gives nothing", () => {
		const short = networkDynamicsFixture();
		short.fractal_variability.sentence_word_count = null;
		short.fractal_variability.sentence_word_count_series_available = 14;
		const shape = toReadingShape(short);
		assert.equal(shape.sentenceLength.byWords, null);
		assert.equal(shape.sentenceLength.sentences, 14);
		assert.equal(toReadingShape(null), null);
		assert.equal(toReadingShape(undefined), null);
	});
});

describe("toDefaultFields", () => {
	test("keeps the default fields and drops the experimental ones", () => {
		const shown = toDefaultFields(networkDynamicsFixture());
		assert.deepEqual(Object.keys(shown), ["fractal_variability", "node_graph_path_amplitude", "sentence_rhythm"]);
		assert.deepEqual(shown.fractal_variability.ngram4_graph_radial_distance, { series_length: 1059, dfa_alpha_global: 0.714, dfa_alpha2: 0.593 });
		assert.deepEqual(shown.fractal_variability.sentence_word_count, { series_length: 191, dfa_alpha_global: 0.745, dfa_alpha1: 0.653 });
		assert.equal(shown.fractal_variability.sentence_word_count_series_available, 191);
		assert.deepEqual(shown.fractal_variability.node_betweenness_rank, { series_length: 1062, dfa_alpha1: 0.556 });
		assert.deepEqual(Object.keys(shown.node_graph_path_amplitude), [
			"steps",
			"mean_step_relative_to_graph_radius",
			"cross_cluster_step_share",
			"cluster_dwell_cv",
			"mean_radial_distance_relative_to_graph_radius",
			"radial_distance_cv",
		]);
		assert.deepEqual(Object.keys(shown.sentence_rhythm), [
			"prose_sentences",
			"skipped_fragments_under_12_words",
			"mean_words_per_sentence",
			"share_under_8_words",
			"share_over_30_words",
		]);
		assert.equal(toDefaultFields(null), null);
	});

	test("keeps a multifractal spectrum that was computed: it is asked for with its own parameter", () => {
		const spectrum = { label: "weak", source: "correlations", significant: true, z: 3.2, p: 0.09, width: 0.18 };
		const dynamics = networkDynamicsFixture();
		dynamics.fractal_variability.ngram4_graph_radial_distance.multifractal = spectrum;
		const shown = toDefaultFields(dynamics);
		assert.deepEqual(shown.fractal_variability.ngram4_graph_radial_distance, { series_length: 1059, dfa_alpha_global: 0.714, dfa_alpha2: 0.593, multifractal: spectrum });
		// a null spectrum (not asked for, or a series too short) is not shown
		assert.equal("multifractal" in shown.fractal_variability.sentence_word_count, false);
	});
});

// ---------------------------------------------------------------------------
// Readings: one sentence per measure
// ---------------------------------------------------------------------------

describe("interpretNetworkDynamics", () => {
	const readings = interpretNetworkDynamics(toDefaultFields(networkDynamicsFixture()));

	test("is keyed like the payload, with a reliability line per series and a note per block", () => {
		const fv = readings.fractal_variability;
		assert.deepEqual(Object.keys(fv), ["ngram4_graph_radial_distance", "sentence_word_count", "node_betweenness_rank"]);
		assert.deepEqual(Object.keys(fv.ngram4_graph_radial_distance), ["reliability", "dfa_alpha_global", "dfa_alpha2", "note"]);
		assert.deepEqual(Object.keys(fv.sentence_word_count), ["reliability", "dfa_alpha_global", "dfa_alpha1", "note"]);
		assert.deepEqual(Object.keys(fv.node_betweenness_rank), ["reliability", "dfa_alpha1", "note"]);
		assert.match(fv.ngram4_graph_radial_distance.reliability, /^256 points or more/);
		assert.match(fv.sentence_word_count.reliability, /^128 to 255 points/);
		assert.equal(typeof readings.node_graph_path_amplitude.note, "string");
		assert.equal(typeof readings.sentence_rhythm.note, "string");
	});

	test("names the API field and its value at the start of each DFA sentence", () => {
		const fv = readings.fractal_variability;
		assert.match(fv.ngram4_graph_radial_distance.dfa_alpha2, /^dfa_alpha2 0\.593: /);
		assert.match(fv.sentence_word_count.dfa_alpha_global, /^dfa_alpha_global 0\.745: sentence length is moderately persistent/);
		assert.match(fv.node_betweenness_rank.dfa_alpha1, /^dfa_alpha1 0\.556: /);
	});

	test("reads the amplitude and the sentence rhythm in plain words", () => {
		const amp = readings.node_graph_path_amplitude;
		assert.match(amp.cross_cluster_step_share, /^36% of steps cross into another topic cluster/);
		assert.match(amp.mean_radial_distance_relative_to_graph_radius, /^Mean distance from the centre 0\.911 graph radii/);
		assert.match(amp.radial_distance_cv, /^Distance variation 0\.251/);
		const rhythm = readings.sentence_rhythm;
		assert.match(rhythm.mean_words_per_sentence, /^18\.3 words per sentence on average/);
		assert.match(rhythm.share_under_8_words, /^15% of sentences are under 8 words/);
		assert.match(rhythm.coverage, /112 sentences were measured; 53 statements under 12 words/);
	});

	test("reads the mean step against a path of the same length", () => {
		// 0.826 over 1061 steps sits below the 0.873 expected at that length
		assert.match(readings.node_graph_path_amplitude.mean_step_relative_to_graph_radius, /close together for a text of this length/);
		const short = networkDynamicsFixture();
		short.node_graph_path_amplitude.steps = 150; // expected about 0.608
		assert.match(
			interpretNetworkDynamics(toDefaultFields(short)).node_graph_path_amplitude.mean_step_relative_to_graph_radius,
			/jumps far across the graph .* for a text of this length/,
		);
	});

	test("says the measures are not a detector, and never mentions the calibration set", () => {
		assert.match(readings.about, /not an AI detector/);
		assert.equal(/reference corpus|calibration/i.test(JSON.stringify(readings)), false);
	});

	test("a missing sentence series says how many sentences there were", () => {
		const short = networkDynamicsFixture();
		short.fractal_variability.sentence_word_count = null;
		short.fractal_variability.sentence_word_count_series_available = 14;
		const r = interpretNetworkDynamics(toDefaultFields(short));
		assert.match(JSON.stringify(r.fractal_variability.sentence_word_count), /14 sentence/);
		assert.equal(interpretNetworkDynamics(null), null);
	});
});

describe("supporting readers", () => {
	test("movementBand judges the mean step against the length of the path", () => {
		assert.deepEqual(movementBand(0.6, 400), { movement: "close", expected: 0.741 });
		assert.deepEqual(movementBand(0.74, 400), { movement: "steady", expected: 0.741 });
		assert.deepEqual(movementBand(0.9, 400), { movement: "leaping", expected: 0.741 });
		// under 50 steps there is no reference
		assert.deepEqual(movementBand(0.7, 20), { movement: null, expected: null });
		assert.deepEqual(movementBand(null, 400), { movement: null, expected: null });
	});

	test("confidenceFor follows the series length", () => {
		assert.equal(confidenceFor(40), "none");
		assert.equal(confidenceFor(100), "indicative");
		assert.equal(confidenceFor(200), "usable");
		assert.equal(confidenceFor(600), "reliable");
		assert.equal(confidenceFor(null), "none");
	});

	test("readStructure describes the diversity statistics", () => {
		const r = readStructure(diversityFixture());
		assert.match(r.diversity, /Several distinct topics/);
		assert.equal(typeof r.topNodesEntropy, "string");
		assert.equal(readStructure(null), null);
	});

	test("readDegreeDistribution describes concentration and never claims a scale-free network", () => {
		const r = readDegreeDistribution(degreeDistributionFixture());
		assert.equal(typeof r.gini, "string");
		assert.match(r.tail, /not evidence of a scale-free network/);
		assert.match(readDegreeDistribution({ gini: 0.7, tail: null, nodes: 10, edges: 5, histogram: [] }).gini, /few hub concepts/);
		assert.equal(readDegreeDistribution(null), null);
	});
});

// ---------------------------------------------------------------------------
// Signature: the backend's text type, passed through
// ---------------------------------------------------------------------------

describe("composeSignature", () => {
	test("passes the backend's text type through with its explanations", () => {
		const sig = composeSignature(REFRAIN);
		assert.equal(sig.label, "refrain");
		assert.equal(sig.summary, REFRAIN.description);
		assert.equal(sig.has_core, true);
		assert.equal(sig.structure, "focused");
		assert.equal(sig.stays_where_it_goes, false);
		assert.equal(sig.basis, "memory");
		assert.match(sig.basis_explanation, /DFA exponents/);
		assert.equal(sig.memory_score, -0.27);
		assert.equal(sig.confidence, "clear");
		assert.match(sig.note, /never present the type as evidence/);
	});

	test("lists the four types and the four structures with what each means", () => {
		const sig = composeSignature(REFRAIN);
		assert.deepEqual(Object.keys(sig.label_possible_values), ["deep dive", "refrain", "chapters", "sweep"]);
		assert.match(sig.label_possible_values["deep dive"], /^Has a core and stays where it goes/);
		assert.match(sig.label_possible_values.refrain, /^Has a core and keeps moving/);
		assert.match(sig.label_possible_values.chapters, /^No single core and stays where it goes/);
		assert.match(sig.label_possible_values.sweep, /^No single core and keeps moving/);
		assert.deepEqual(Object.keys(sig.structure_possible_values), ["biased", "focused", "diversified", "dispersed"]);
		assert.match(sig.structure_possible_values.biased, /Has a core\.$/);
		assert.match(sig.structure_possible_values.dispersed, /No single core\.$/);
	});

	test("says so when the backend fell back on the size of the steps", () => {
		const sig = composeSignature({ ...REFRAIN, basis: "movement", memory_score: null, confidence: "borderline" });
		assert.match(sig.basis_explanation, /too short for the DFA exponents/);
		assert.equal(sig.confidence, "borderline");
	});

	test("computes nothing: no text type from the backend, no label", () => {
		for (const missing of [null, undefined]) {
			const sig = composeSignature(missing);
			assert.equal(sig.label, null);
			assert.equal(sig.summary, null);
			assert.equal(sig.has_core, null);
			assert.equal(sig.stays_where_it_goes, null);
			assert.equal(sig.basis_explanation, null);
			// the scheme is still explained
			assert.equal(Object.keys(sig.label_possible_values).length, 4);
		}
		const unnamed = composeSignature({ ...REFRAIN, label: null, description: null, stays_where_it_goes: null, basis: null });
		assert.equal(unnamed.label, null);
		assert.equal(unnamed.has_core, true);
	});
});

// ---------------------------------------------------------------------------
// AI-likeness: weighted evidence, hedged verdict
// ---------------------------------------------------------------------------

describe("estimateAiLikeness", () => {
	const inputFor = (dynamics) => {
		const shape = toReadingShape(dynamics);
		return { sentenceRhythm: shape.sentenceRhythm, amplitude: shape.amplitude, fractal: shape };
	};

	test("variably paced text leans human, with the reason in verdict_explanation", () => {
		const ai = estimateAiLikeness(inputFor(networkDynamicsFixture()));
		assert.equal(ai.verdict, "leaning human");
		assert.match(ai.verdict_explanation, /^Variably paced/);
		assert.ok(ai.score < 0);
		assert.ok(ai.evidence.some((e) => e.signal === "sentence length variability (CV)" && e.direction < 0));
	});

	test("flat, evenly paced text leans AI", () => {
		const flat = networkDynamicsFixture();
		flat.sentence_rhythm = { ...flat.sentence_rhythm, words_per_sentence_cv: 0.2, share_under_8_words: 0, share_over_30_words: 0, words_per_sentence_lag1_autocorrelation: 0 };
		flat.fractal_variability.sentence_word_count = series(191, 0.5, 0.5, 0.5);
		flat.node_graph_path_amplitude = { ...flat.node_graph_path_amplitude, step_cv: 0.3, cluster_dwell_cv: 0.2 };
		const ai = estimateAiLikeness(inputFor(flat));
		assert.equal(ai.verdict, "leaning AI");
		assert.match(ai.verdict_explanation, /^Evenly paced/);
		assert.ok(ai.score > 0);
	});

	test("the verdict is one of three, and the score stays within -1 and 1", () => {
		for (const dynamics of [networkDynamicsFixture(), networkDynamicsFixture({ sentence_rhythm: { ...networkDynamicsFixture().sentence_rhythm, words_per_sentence_cv: 0.45 } })]) {
			const ai = estimateAiLikeness(inputFor(dynamics));
			assert.ok(["leaning AI", "leaning human", "mixed"].includes(ai.verdict));
			assert.ok(ai.score >= -1 && ai.score <= 1);
			assert.equal(typeof ai.verdict_explanation, "string");
		}
	});

	test("without evidence there is no score, and the caveats are always there", () => {
		const ai = estimateAiLikeness({
			sentenceRhythm: { sentences: 0, skippedFragments: 0, meanLength: null, cvLength: null, lag1Autocorrelation: null, shortShare: null, longShare: null, statements: 0 },
			amplitude: { graphRadius: null, words: null },
			fractal: null,
		});
		assert.equal(ai.score, null);
		assert.equal(ai.verdict, "mixed");
		assert.match(ai.verdict_explanation, /^Inconclusive/);
		assert.ok(ai.caveats.length >= 3);
		assert.ok(ai.caveats.some((c) => /never treat it as proof of authorship/.test(c)));
	});
});

// ---------------------------------------------------------------------------
// The assembled output
// ---------------------------------------------------------------------------

describe("buildTextSignature", () => {
	const input = (extra = {}) => ({
		modularity: 0.71,
		diversity: diversityFixture(),
		networkDynamics: networkDynamicsFixture(),
		degreeDistribution: degreeDistributionFixture(),
		...extra,
	});

	test("assembles the signature, the structure, the numbers, the readings and the estimate", () => {
		const out = buildTextSignature(input());
		assert.deepEqual(Object.keys(out), ["signature", "structure", "network_dynamics", "readings", "ai_likeness", "notes"]);
		assert.equal(out.signature.label, "refrain");
		assert.equal(out.structure.modularity, 0.71);
		assert.deepEqual(out.structure.diversity_stats, diversityFixture());
		assert.match(out.structure.readings.diversity, /Several distinct topics/);
		assert.equal(typeof out.structure.degreeReadings.gini, "string");
		assert.equal(typeof out.readings.fractal_variability.sentence_word_count.dfa_alpha_global, "string");
		assert.ok(["leaning AI", "leaning human", "mixed"].includes(out.ai_likeness.verdict));
		assert.ok(out.notes.length >= 4);
		assert.ok(out.notes.some((n) => /not an AI detector/.test(n)));
	});

	test("shows the default fields unless the experimental ones are asked for", () => {
		const shown = buildTextSignature(input()).network_dynamics;
		assert.deepEqual(Object.keys(shown.fractal_variability.ngram4_graph_radial_distance), ["series_length", "dfa_alpha_global", "dfa_alpha2"]);
		assert.equal("step_cv" in shown.node_graph_path_amplitude, false);
		assert.equal("words_per_sentence_cv" in shown.sentence_rhythm, false);

		const everything = buildTextSignature(input({ includeExperimental: true }));
		const ngram = everything.network_dynamics.fractal_variability.ngram4_graph_radial_distance;
		assert.equal(ngram.dfa_alpha1, 1.181);
		assert.equal(ngram.dfa_alpha_global_label, "regular");
		assert.equal(everything.network_dynamics.node_graph_path_amplitude.step_cv, 0.606);
		assert.equal(everything.network_dynamics.sentence_rhythm.words_per_sentence_cv, 0.576);
		// and the experimental fields get readings too
		for (const key of ["step_cv", "step_lag1_autocorrelation", "cluster_dwell_cv"]) {
			assert.equal(typeof everything.readings.node_graph_path_amplitude[key], "string", key);
		}
		for (const key of ["words_per_sentence_cv", "words_per_sentence_lag1_autocorrelation"]) {
			assert.equal(typeof everything.readings.sentence_rhythm[key], "string", key);
		}
	});

	test("ai_likeness uses the experimental measures whether or not they are shown", () => {
		const hidden = buildTextSignature(input());
		const shown = buildTextSignature(input({ includeExperimental: true }));
		assert.deepEqual(hidden.ai_likeness, shown.ai_likeness);
		assert.ok(hidden.ai_likeness.evidence.some((e) => e.signal === "sentence length variability (CV)"));
	});

	test("the histogram of the degree distribution is trimmed to 40 rows", () => {
		const wide = buildTextSignature(input({ degreeDistribution: degreeDistributionFixture({ rows: 70 }) }));
		assert.equal(wide.structure.degree_distribution.histogram.length, 40);
		assert.equal(wide.structure.degree_distribution.histogramTruncated, true);
		const none = buildTextSignature(input({ degreeDistribution: null }));
		assert.equal(none.structure.degree_distribution, null);
		assert.equal(none.structure.degreeReadings, null);
	});

	test("a long text is named from memory, whatever the size of its steps", () => {
		const long = networkDynamicsFixture({ text_type: { ...REFRAIN, structure: "biased", memory_score: -0.57 } });
		long.node_graph_path_amplitude.steps = 6470;
		long.node_graph_path_amplitude.mean_step_relative_to_graph_radius = 1.05;
		const out = buildTextSignature(input({ networkDynamics: long }));
		assert.equal(out.signature.label, "refrain");
		assert.equal(out.signature.basis, "memory");
	});

	test("an older backend, without text_type or without network_dynamics, gives no label and does not throw", () => {
		const older = buildTextSignature(input({ networkDynamics: networkDynamicsFixture({ text_type: undefined }) }));
		assert.equal(older.signature.label, null);
		assert.equal(typeof older.readings.sentence_rhythm.mean_words_per_sentence, "string");

		const none = buildTextSignature(input({ networkDynamics: null }));
		assert.equal(none.signature.label, null);
		assert.equal(none.network_dynamics, null);
		assert.equal(none.readings, null);
		assert.equal(none.ai_likeness.score, null);
		assert.deepEqual(none.structure.diversity_stats, diversityFixture());
	});
});

// ---------------------------------------------------------------------------
// The tool handler: request flags and response shape
// ---------------------------------------------------------------------------

function fakeResponse(body) {
	return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

function graphResponse() {
	return {
		statements: [],
		graph: {
			graphologyGraph: {
				attributes: {
					modularity: 0.71,
					diversity_stats: diversityFixture(),
					network_dynamics: networkDynamicsFixture(),
					degree_distribution: degreeDistributionFixture(),
					top_clusters: [],
					gaps: [],
				},
				nodes: [],
				edges: [],
			},
		},
	};
}

async function withFakeApi(fn, body = graphResponse()) {
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : undefined });
		return fakeResponse(body);
	};
	try {
		const result = await runWithConfig(CONFIG, fn);
		return { result, calls };
	} finally {
		globalThis.fetch = originalFetch;
	}
}

describe("analyze_text_signature handler", () => {
	const params = (extra = {}) => ({ text: "Some text.\nMore text.", modifyAnalyzedText: "none", wikilinksMode: "default", ...extra });

	test("asks for the statistics and every network_dynamics field, without saving", async () => {
		const { result, calls } = await withFakeApi(() => analyzeTextSignatureTool.handler(params()));
		assert.equal(calls.length, 1);
		const query = new URL(calls[0].url).searchParams;
		assert.equal(query.get("doNotSave"), "true");
		assert.equal(query.get("addStats"), "true");
		assert.equal(query.get("fractalExperimental"), "true", "ai_likeness needs the experimental measures");
		assert.equal(query.get("includeGraph"), "true");
		assert.equal(query.get("compactGraph"), "true");
		assert.equal(query.get("includeStatements"), "true");
		assert.equal(query.get("compactStatements"), "true");
		assert.equal(query.get("includeGraphSummary"), "false");
		assert.equal(query.get("multifractal"), null, "the spectrum is off unless asked for");
		assert.equal(calls[0].body.modifyAnalyzedText, "none");

		const output = parseToolResult(result);
		assert.equal(output.signature.label, "refrain");
		assert.deepEqual(output.structure.diversity_stats, diversityFixture());
		assert.deepEqual(output.structure.degree_distribution, degreeDistributionFixture());
		// the default fields are shown although every field was fetched
		assert.equal("step_cv" in output.network_dynamics.node_graph_path_amplitude, false);
		assert.equal(typeof output.readings.sentence_rhythm.coverage, "string");
		assert.ok(output.ai_likeness.caveats.length > 0);
	});

	test("forwards the multifractal flag and maxNodes, and shows the experimental fields on request", async () => {
		const { result, calls } = await withFakeApi(() =>
			analyzeTextSignatureTool.handler(params({ multifractal: true, maxNodes: 400, includeExperimental: true })),
		);
		const query = new URL(calls[0].url).searchParams;
		assert.equal(query.get("multifractal"), "true");
		assert.equal(query.get("maxnodes"), "400");
		const output = parseToolResult(result);
		assert.equal(output.network_dynamics.node_graph_path_amplitude.step_cv, 0.606);
	});

	test("errors when the API returns no statistics", async () => {
		const { result } = await withFakeApi(() => analyzeTextSignatureTool.handler(params({ text: "Tiny." })), {
			statements: [],
			graph: { graphologyGraph: { attributes: {}, nodes: [], edges: [] } },
		});
		assert.equal(result.isError, true);
		assert.match(JSON.parse(result.content[0].text).error, /no network statistics/);
	});

	test("refuses an empty input", async () => {
		const { result, calls } = await withFakeApi(() =>
			analyzeTextSignatureTool.handler({ modifyAnalyzedText: "none", wikilinksMode: "default" }),
		);
		assert.equal(calls.length, 0);
		assert.equal(result.isError, true);
	});
});

describe("the 4-gram step series", () => {
	const withStep = () => {
		const dynamics = networkDynamicsFixture();
		dynamics.fractal_variability.ngram4_graph_step_length = series(1058, 0.62, 0.72, 0.55);
		return dynamics;
	};

	test("is shown by default with all three exponents, and read as a description", () => {
		const shown = toDefaultFields(withStep());
		assert.deepEqual(shown.fractal_variability.ngram4_graph_step_length, {
			series_length: 1058,
			dfa_alpha_global: 0.62,
			dfa_alpha1: 0.72,
			dfa_alpha2: 0.55,
		});
		const reading = interpretNetworkDynamics(shown).fractal_variability.ngram4_graph_step_length;
		assert.deepEqual(Object.keys(reading), ["reliability", "dfa_alpha_global", "dfa_alpha1", "dfa_alpha2", "note"]);
		assert.match(reading.dfa_alpha_global, /^dfa_alpha_global 0\.62: .*runs of moderate length/);
		assert.match(reading.dfa_alpha1, /^dfa_alpha1 0\.72: .*alike in size/);
		assert.match(reading.dfa_alpha2, /^dfa_alpha2 0\.55: .*no settled or restless phases/);
		assert.match(reading.note, /description only/);
	});

	test("is absent, not null, against a backend that does not return it", () => {
		const shown = toDefaultFields(networkDynamicsFixture());
		assert.ok(!("ngram4_graph_step_length" in shown.fractal_variability));
		assert.ok(!("ngram4_graph_step_length" in interpretNetworkDynamics(shown).fractal_variability));
	});
});

describe("the six-part memory score", () => {
	test("dwell CV is a default field with its own reading, and absent against an older backend", () => {
		const shown = toDefaultFields(networkDynamicsFixture());
		assert.equal(shown.node_graph_path_amplitude.cluster_dwell_cv, 1.116);
		assert.match(interpretNetworkDynamics(shown).node_graph_path_amplitude.cluster_dwell_cv, /^Variation of the stays inside a topic 1\.116: .*stays long in some topics/);
		const older = networkDynamicsFixture();
		delete older.node_graph_path_amplitude.cluster_dwell_cv;
		const olderShown = toDefaultFields(older);
		assert.ok(!("cluster_dwell_cv" in olderShown.node_graph_path_amplitude));
		assert.ok(!("cluster_dwell_cv" in interpretNetworkDynamics(olderShown).node_graph_path_amplitude));
	});

	test("the signature names the two answers with their short words and says how many parts were measured", () => {
		const signature = composeSignature({ ...REFRAIN, memory_parts: 5 });
		// the summary is the backend's own description; the possible values carry the wording
		assert.match(signature.label_possible_values.refrain, /keeps moving \(roams\)/);
		assert.match(signature.label_possible_values["deep dive"], /stays where it goes \(dwells\)/);
		assert.equal(signature.memory_parts, 5);
		assert.match(signature.basis_explanation, /cluster_dwell_cv/);
		assert.equal(composeSignature(REFRAIN).memory_parts, REFRAIN.memory_parts ?? null);
	});
});
