// Offline tests for analyze_text_signature: the pure signature builder
// (amplitude of the path through the graph, sentence rhythm, readings,
// composite label, AI-likeness) and the tool handler with an intercepted
// fetch (request flags, response shape). No network. Part of `npm test`.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { analyzeTextSignatureTool } from "../dist/tools/analyzeTextSignature.js";
import {
	buildTextSignature,
	computeAmplitude,
	computeSentenceRhythm,
	composeSignature,
	estimateAiLikeness,
	rhythmBand,
	readStepAlpha,
	readScales,
	readMultifractal,
	confidenceFor,
	splitSentences,
	readSentenceAlpha,
	summariseSentenceScaling,
	readInfluence,
	readDegreeDistribution,
	PROSE_MIN_WORDS,
} from "../dist/utils/textSignature.js";
import { fractalFixture, diversityFixture, degreeDistributionFixture, parseToolResult } from "./helpers/statsSurface.mjs";

const CONFIG = { apiBase: "https://api.test/api/v1", apiKey: "test-key" };

// ---------------------------------------------------------------------------
// Fixtures: a small graph with two clusters far apart, and statements that
// walk through it
// ---------------------------------------------------------------------------

// Cluster 0 around the origin, cluster 1 far along x.
const NODES = [
	{ key: "a", attributes: { x: 0, y: 0, z: 0, community: 0 } },
	{ key: "b", attributes: { x: 1, y: 0, z: 0, community: 0 } },
	{ key: "c", attributes: { x: 0, y: 1, z: 0, community: 0 } },
	{ key: "d", attributes: { x: 100, y: 0, z: 0, community: 1 } },
	{ key: "e", attributes: { x: 101, y: 0, z: 0, community: 1 } },
	{ key: "f", attributes: { x: 100, y: 1, z: 0, community: 1 } },
	{ key: "nopos", attributes: { community: 1 } },
];

const prose = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ") + ".";

function statement(id, hashtags, community, coords, content) {
	return {
		sortId: id,
		content,
		statementHashtags: hashtags,
		topStatementCommunity: String(community),
		graphCoordinates: coords,
	};
}

/** Statements that stay in cluster 0 then jump to cluster 1: two blocks. */
const BLOCK_STATEMENTS = [
	statement(1, ["a", "b", "c", "a"], 0, { x: 0.3, y: 0.3, z: 0 }, "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu. Short one here. Then a much longer sentence follows with many more words in it than the others had."),
	statement(2, ["#b", "c", "a", "b"], 0, { x: 0.4, y: 0.4, z: 0 }, prose(14)),
	statement(3, ["d", "e", "f", "d"], 1, { x: 100.3, y: 0.3, z: 0 }, prose(20) + " " + prose(5)),
	statement(4, ["e", "f", "nopos", "unknown"], 1, { x: 100.4, y: 0.4, z: 0 }, prose(30)),
	statement(5, ["Heading"], 0, null, "Just a heading"),
];

describe("computeAmplitude", () => {
	test("rebuilds the word and statement paths and measures them in graph-radius units", () => {
		const amp = computeAmplitude(NODES, BLOCK_STATEMENTS);
		assert.ok(amp.graphRadius > 0);
		// Word path: 4 + 4 + 4 + 2 positioned words (nopos and unknown dropped) = 14 points, 13 steps.
		assert.equal(amp.words.n, 13);
		// Statement path: 4 positioned statements (the heading has no coordinates), 3 steps.
		assert.equal(amp.statements.n, 3);
		// Exactly one word step crosses the clusters (c -> d), out of 13.
		assert.equal(amp.words.crossClusterShare, Number((1 / 13).toFixed(3)));
		// One statement step crosses (2 -> 3) out of 3.
		assert.equal(amp.statements.crossClusterShare, Number((1 / 3).toFixed(3)));
		// The jump dominates: p95 far above the median, high CV.
		assert.ok(amp.words.p95Step > amp.words.medianStep * 5);
		assert.ok(amp.words.cvStep > 1);
		// Too few crossings for a run CV.
		assert.equal(amp.words.crossClusterRunCV, null);
	});

	test("returns nulls without positions", () => {
		const amp = computeAmplitude([{ key: "a", attributes: {} }], BLOCK_STATEMENTS);
		assert.equal(amp.graphRadius, null);
		assert.equal(amp.words, null);
		assert.equal(amp.statements, null);
	});
});

describe("sentence rhythm", () => {
	test("splitSentences keeps abbreviations together", () => {
		const parts = splitSentences("We use e.g. graphs. They work! Do they? Yes.");
		assert.deepEqual(parts, ["We use e.g. graphs.", "They work!", "Do they?", "Yes."]);
	});

	test("skips fragments below the prose threshold and measures the rest", () => {
		const rhythm = computeSentenceRhythm(BLOCK_STATEMENTS);
		assert.equal(rhythm.skippedFragments, 1, "the heading is a fragment");
		assert.equal(rhythm.statements.n, 4);
		// Statement 1: 3 sentences; 2: 1; 3: 2; 4: 1.
		assert.equal(rhythm.sentences, 7);
		assert.ok(rhythm.cvLength > 0.4, "a short sentence next to long ones is bursty");
		assert.ok(rhythm.shortShare > 0);
		assert.ok(PROSE_MIN_WORDS > 1);
	});

	test("flat text reads flat", () => {
		const flat = Array.from({ length: 12 }, (_, i) => statement(i + 1, [], 0, null, prose(15) + " " + prose(15)));
		const rhythm = computeSentenceRhythm(flat);
		assert.equal(rhythm.sentences, 24);
		assert.equal(rhythm.cvLength, 0);
		assert.equal(rhythm.shortShare, 0);
	});
});

describe("readings", () => {
	test("rhythmBand follows the text-specific table", () => {
		assert.equal(rhythmBand(0.4), "alternating");
		assert.equal(rhythmBand(0.5), "random");
		assert.equal(rhythmBand(0.75), "fractal");
		assert.equal(rhythmBand(0.95), "persistent");
		assert.equal(rhythmBand(1.1), "blocks");
		assert.equal(rhythmBand(null), null);
		assert.equal(readStepAlpha(NaN), null);
		assert.match(readStepAlpha(0.75), /keeps coming back/);
		assert.match(readStepAlpha(1.2), /chapters or sections/);
	});

	test("readScales contrasts short and long scales", () => {
		assert.match(readScales({ alpha1: 0.8, alpha2: 0.5 }), /document as a whole does not/);
		assert.match(readScales({ alpha1: 0.5, alpha2: 0.8 }), /overall arc is planned/);
		assert.equal(readScales({ alpha1: 0.8, alpha2: null }), null);
	});

	test("readMultifractal distinguishes the source of the width", () => {
		assert.match(readMultifractal({ multifractal: { label: "multifractal", source: "correlations", significant: true } }), /rare big leaps/);
		assert.match(readMultifractal({ multifractal: { label: "multifractal", source: "distribution", significant: true } }), /not placed in any pattern/);
		assert.match(readMultifractal({ multifractal: { label: "monofractal", significant: false } }), /no multifractal structure/);
		assert.equal(readMultifractal({ multifractal: null }), null);
	});

	test("confidenceFor follows the backend length table", () => {
		assert.equal(confidenceFor(10), "none");
		assert.equal(confidenceFor(100), "indicative");
		assert.equal(confidenceFor(200), "usable");
		assert.equal(confidenceFor(600), "reliable");
	});
});

describe("sentence-length level (fractal_variability.sentenceLength.byWords)", () => {
	test("readSentenceAlpha speaks about pace, not topics", () => {
		assert.match(readSentenceAlpha(0.5), /no rhythm across sentences/);
		assert.match(readSentenceAlpha(0.75), /1\/f rhythm/);
		assert.match(readSentenceAlpha(1.2), /pace drifts/);
		assert.equal(readSentenceAlpha(null), null);
	});

	test("summarises the series from the fixture", () => {
		const summary = summariseSentenceScaling(fractalFixture({ withSpectrum: false }));
		assert.equal(summary.n, 450);
		assert.equal(summary.alphaBounded, 0.561);
		assert.equal(summary.alphaLabel, "regular");
		assert.equal(summary.alpha1, 0.682);
		assert.equal(summary.alpha2, 0.53);
		assert.equal(summary.multifractalLabel, null);
		assert.match(summary.readings.alpha, /no rhythm across sentences/);
		assert.match(summary.readings.scales, /does not carry across paragraphs/, "alpha1 fractal, alpha2 random");
		assert.equal(summary.readings.multifractal, null);
		assert.equal(summary.readings.confidence, "reliable");
	});

	test("reads the spectrum when present", () => {
		const summary = summariseSentenceScaling(fractalFixture({ withSpectrum: true }));
		assert.equal(summary.multifractalLabel, "multifractal");
		assert.match(summary.readings.multifractal, /rare big leaps/);
	});

	test("is null under 64 sentences and on older backends", () => {
		assert.equal(summariseSentenceScaling(fractalFixture({ sentenceLength: "null" })), null);
		assert.equal(summariseSentenceScaling(fractalFixture({ sentenceLength: "absent" })), null);
		assert.equal(summariseSentenceScaling(null), null);
	});
});

describe("influence level and degree distribution", () => {
	test("readInfluence reads the rank series only", () => {
		const readings = readInfluence(fractalFixture({ withSpectrum: true }));
		assert.match(readInfluence({ influence: { byBetweennessRank: { n: 300, alphaBounded: 0.75, alpha1: 0.75, alpha2: 0.75, multifractal: null } } }).byBetweennessRank, /nested cycles/);
		assert.match(readings.byBetweennessRank, /without pattern/, "0.557 is memoryless");
		assert.match(readings.multifractal, /rare big leaps/);
		assert.equal(readings.confidence, "reliable");
		assert.equal(readInfluence(fractalFixture({ influence: "null" })), null);
		assert.equal(readInfluence(fractalFixture({ influence: "absent" })), null);
	});

	test("readDegreeDistribution describes concentration and never says scale-free", () => {
		const readings = readDegreeDistribution(degreeDistributionFixture());
		assert.match(readings.gini, /moderately concentrated/);
		assert.match(readings.tail, /tail exponent of 2\.31/);
		assert.match(readings.tail, /not evidence of a scale-free/);
		assert.match(readings.nodes, /before the node cap/);
		assert.match(readDegreeDistribution(degreeDistributionFixture({ tail: "null" })).tail, /Too few concepts/);
		assert.match(readDegreeDistribution({ gini: 0.7, tail: null, nodes: 10, edges: 5, histogram: [] }).gini, /few hub concepts/);
		assert.equal(readDegreeDistribution(null), null);
	});
});

describe("composeSignature", () => {
	const series = (alpha, n = 300) => ({ byStepLength: { n, alphaBounded: alpha, alpha1: alpha, alpha2: alpha, multifractal: null }, byRadialDistance: null });

	test("reads structure from diversity and rhythm from the statements level when long enough", () => {
		const sig = composeSignature({ diversity_score: "diversified" }, { statements: series(0.75), words: series(0.5) });
		assert.equal(sig.label, "narrative");
		assert.equal(sig.rhythmSource, "statements");
		assert.match(sig.summary, /woven together/);
	});

	test("falls back to the words level when the statement series is short", () => {
		const sig = composeSignature({ diversity_score: "focused" }, { statements: series(0.75, 70), words: series(0.5) });
		assert.equal(sig.label, "report");
		assert.equal(sig.rhythmSource, "words");
	});

	test("maps persistent to the fractal column and blocks to its own", () => {
		assert.equal(composeSignature({ diversity_score: "biased" }, { words: series(0.95) }).label, "deep dive");
		assert.equal(composeSignature({ diversity_score: "dispersed" }, { words: series(1.2) }).label, "drift");
	});

	test("is null without data", () => {
		const sig = composeSignature(null, null);
		assert.equal(sig.label, null);
		assert.equal(sig.rhythmSource, null);
	});
});

describe("estimateAiLikeness", () => {
	const rhythm = (cv, sentences = 60, shortShare = 0.1) => ({ sentences, skippedFragments: 0, meanLength: 15, cvLength: cv, lag1Autocorrelation: 0, shortShare, longShare: 0, statements: { n: 10, meanLength: 90, cvLength: cv } });
	const amplitude = (cvStep, runCV) => ({ graphRadius: 1, statements: null, words: { n: 300, meanStep: 0.7, medianStep: 0.5, p95Step: 1.5, cvStep, lag1Autocorrelation: 0.2, crossClusterShare: 0.3, crossClusterRunCV: runCV, meanRadial: 0.8, cvRadial: 0.3 } });
	const fractal = (alpha) => ({ statements: { byStepLength: null, byRadialDistance: null }, words: { byStepLength: { n: 300, alphaBounded: alpha, alpha1: alpha, alpha2: alpha, multifractal: null }, byRadialDistance: null } });

	test("flat, evenly paced, memoryless text leans generated", () => {
		const ai = estimateAiLikeness({ sentenceRhythm: rhythm(0.2, 60, 0), amplitude: amplitude(0.3, 0.5), fractal: fractal(0.5) });
		assert.equal(ai.verdict, "leans generated");
		assert.ok(ai.score > 0.5);
		assert.equal(ai.confidence, "medium");
		assert.ok(ai.evidence.every((e) => e.direction > 0));
	});

	test("bursty, fractal text leans human", () => {
		const ai = estimateAiLikeness({ sentenceRhythm: rhythm(0.8, 60, 0.25), amplitude: amplitude(1.0, 1.5), fractal: fractal(0.75) });
		assert.equal(ai.verdict, "leans human");
		assert.ok(ai.score < -0.5);
	});

	test("short texts are inconclusive with low confidence", () => {
		const ai = estimateAiLikeness({ sentenceRhythm: rhythm(0.2, 12, 0), amplitude: amplitude(0.3, 0.5), fractal: fractal(0.5) });
		assert.equal(ai.verdict, "inconclusive");
		assert.equal(ai.confidence, "low");
	});

	test("sentence rhythm outweighs the topic-path memory", () => {
		// Generated prose with one topic per paragraph reads fractal on the path; the flat rhythm must still win.
		const ai = estimateAiLikeness({ sentenceRhythm: rhythm(0.25, 60, 0), amplitude: { graphRadius: 1, statements: null, words: null }, fractal: fractal(0.75) });
		assert.equal(ai.verdict, "leans generated");
	});

	test("the sentence-length DFA counts as evidence once it has 128 sentences", () => {
		const withSentences = (alpha, n) => ({ ...fractal(0.75), sentenceLength: { byWords: { n, alphaBounded: alpha, alpha1: alpha, alpha2: alpha, multifractal: null } } });
		const flat = estimateAiLikeness({ sentenceRhythm: rhythm(0.5, 60, 0.1), amplitude: { graphRadius: 1, statements: null, words: null }, fractal: withSentences(0.5, 300) });
		const flatSignal = flat.evidence.find((e) => e.signal.startsWith("sentence-length rhythm"));
		assert.ok(flatSignal, "sentence-length evidence present");
		assert.equal(flatSignal.direction, 1);
		const literary = estimateAiLikeness({ sentenceRhythm: rhythm(0.5, 60, 0.1), amplitude: { graphRadius: 1, statements: null, words: null }, fractal: withSentences(0.8, 300) });
		assert.equal(literary.evidence.find((e) => e.signal.startsWith("sentence-length rhythm")).direction, -1);
		const short = estimateAiLikeness({ sentenceRhythm: rhythm(0.5, 60, 0.1), amplitude: { graphRadius: 1, statements: null, words: null }, fractal: withSentences(0.5, 100) });
		assert.ok(!short.evidence.some((e) => e.signal.startsWith("sentence-length rhythm")), "under 128 sentences it is not evidence");
	});

	test("always carries the caveats", () => {
		const ai = estimateAiLikeness({ sentenceRhythm: rhythm(null, 0), amplitude: { graphRadius: null, statements: null, words: null }, fractal: null });
		assert.equal(ai.score, null);
		assert.equal(ai.verdict, "inconclusive");
		assert.ok(ai.caveats.length >= 3);
	});
});

describe("buildTextSignature", () => {
	test("assembles every block with readings", () => {
		const out = buildTextSignature({
			modularity: 0.71,
			diversity: diversityFixture(),
			fractal: fractalFixture(),
			nodes: NODES,
			statements: BLOCK_STATEMENTS,
		});
		assert.equal(out.structure.modularity, 0.71);
		assert.deepEqual(out.structure.diversity_stats, diversityFixture());
		assert.match(out.structure.readings.diversity, /Several distinct topics/);
		assert.deepEqual(out.rhythm.fractal_variability, fractalFixture());
		for (const level of ["statements", "words", "ngrams"]) {
			assert.ok(out.rhythm.readings[level], `${level} readings`);
			assert.equal(typeof out.rhythm.readings[level].stepLength, "string");
			assert.ok(["none", "indicative", "usable", "reliable"].includes(out.rhythm.readings[level].confidence));
		}
		assert.equal(out.amplitude.words.n, 13);
		assert.equal(typeof out.amplitude.readings.words.cvStep, "string");
		assert.equal(out.sentence_rhythm.sentences, 7);
		assert.equal(typeof out.sentence_rhythm.readings.cvLength, "string");
		assert.equal(out.structure.degree_distribution, null, "no degree distribution given");
		assert.equal(out.structure.degreeReadings, null);
		assert.match(out.rhythm.readings.influence.byBetweennessRank, /without pattern/);
		const wide = buildTextSignature({ modularity: 0.5, diversity: diversityFixture(), fractal: fractalFixture(), degreeDistribution: degreeDistributionFixture({ rows: 70 }), nodes: NODES, statements: BLOCK_STATEMENTS });
		assert.equal(wide.structure.degree_distribution.histogram.length, 40, "histogram trimmed like the other tools");
		assert.equal(wide.structure.degree_distribution.histogramTruncated, true);
		assert.match(wide.structure.degreeReadings.gini, /concentrated/);
		assert.equal(out.sentence_rhythm.scaling.n, 450, "the backend's sentence-length DFA is summarised");
		assert.equal(typeof out.sentence_rhythm.scaling.readings.alpha, "string");
		assert.ok(out.rhythm.fractal_variability.sentenceLength, "and passed through unchanged");
		const older = buildTextSignature({ modularity: 0.5, diversity: diversityFixture(), fractal: fractalFixture({ sentenceLength: "absent" }), nodes: NODES, statements: BLOCK_STATEMENTS });
		assert.equal(older.sentence_rhythm.scaling, null);
		assert.ok(out.signature.label);
		assert.ok(["leans generated", "leans human", "inconclusive"].includes(out.ai_likeness.verdict));
		assert.ok(out.notes.length >= 2);
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
		statements: BLOCK_STATEMENTS,
		graph: {
			graphologyGraph: {
				attributes: {
					modularity: 0.71,
					diversity_stats: diversityFixture(),
					fractal_variability: fractalFixture(),
					degree_distribution: degreeDistributionFixture(),
					top_clusters: [],
					gaps: [],
				},
				nodes: NODES,
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
	test("asks for the raw graph and statements, forwards the multifractal flag, and returns the signature", async () => {
		const { result, calls } = await withFakeApi(() =>
			analyzeTextSignatureTool.handler({ text: "Some text.\nMore text.", multifractal: true, modifyAnalyzedText: "none", wikilinksMode: "default" }),
		);
		assert.equal(calls.length, 1);
		const query = new URL(calls[0].url).searchParams;
		assert.equal(query.get("addStats"), "true");
		assert.equal(query.get("multifractal"), "true");
		assert.equal(query.get("includeGraph"), "true");
		assert.equal(query.get("compactGraph"), "false");
		assert.equal(query.get("includeStatements"), "true");
		assert.equal(query.get("compactStatements"), "false");
		assert.equal(query.get("doNotSave"), "true");
		assert.equal(calls[0].body.modifyAnalyzedText, "none");

		const output = parseToolResult(result);
		assert.ok(output.signature);
		assert.deepEqual(output.structure.diversity_stats, diversityFixture());
		assert.deepEqual(output.rhythm.fractal_variability, fractalFixture());
		assert.equal(output.amplitude.words.n, 13);
		assert.equal(output.sentence_rhythm.sentences, 7);
		assert.deepEqual(output.structure.degree_distribution, degreeDistributionFixture());
		assert.equal(typeof output.structure.degreeReadings.gini, "string");
		assert.equal(typeof output.rhythm.readings.influence.byBetweennessRank, "string");
		assert.ok(output.ai_likeness.caveats.length > 0);
	});

	test("omits the multifractal flag when off and passes maxNodes", async () => {
		const { calls } = await withFakeApi(() =>
			analyzeTextSignatureTool.handler({ text: "Some text.", multifractal: false, maxNodes: 400, modifyAnalyzedText: "none", wikilinksMode: "default" }),
		);
		const query = new URL(calls[0].url).searchParams;
		assert.equal(query.get("multifractal"), null);
		assert.equal(query.get("maxnodes"), "400");
	});

	test("errors when the API returns no statistics", async () => {
		const { result } = await withFakeApi(
			() => analyzeTextSignatureTool.handler({ text: "Tiny.", multifractal: true, modifyAnalyzedText: "none", wikilinksMode: "default" }),
			{ statements: [], graph: { graphologyGraph: { attributes: {}, nodes: [], edges: [] } } },
		);
		assert.equal(result.isError, true);
		assert.match(JSON.parse(result.content[0].text).error, /no network statistics/);
	});

	test("refuses an empty input", async () => {
		const { result, calls } = await withFakeApi(() =>
			analyzeTextSignatureTool.handler({ multifractal: true, modifyAnalyzedText: "none", wikilinksMode: "default" }),
		);
		assert.equal(calls.length, 0);
		assert.equal(result.isError, true);
	});
});
