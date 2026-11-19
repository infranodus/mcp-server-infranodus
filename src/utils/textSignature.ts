/**
 * Text signature: the structural and rhythmic profile of a text, built from
 * the graph statistics the backend already returns (diversity_stats,
 * network_dynamics) plus what this module derives from the raw graph —
 * the amplitude of the text's movement through its own concept network
 * (mean step, burstiness, cluster crossings) and the classic sentence-length
 * rhythm of the source text.
 *
 * Every number gets a one-sentence plain-language reading, the readings are
 * joined by a named signature (the backend's text type), and a final layer
 * weighs the rhythm evidence into a hedged AI-likeness estimate. The
 * thresholds are provisional: they come from the DFA literature and from the
 * backend's own reading table (infranodus-backend/docs/fractal-variability.md),
 * not from a labelled corpus. Everything is pure so it can be unit-tested.
 */
import type {
	TextType,
	Amplitude,
	AmplitudeStats,
	DegreeDistribution,
	FractalScaling,
	FractalSeries,
	DfaSeriesBlock,
	FractalVariability,
	SentenceRhythm,
	NetworkDynamics,
} from "../types/index.js";

// Re-exported so existing importers of these shapes keep working now that
// they are declared next to the response type they arrive in.
export type { Amplitude, AmplitudeStats, SentenceRhythm };
import { trimDegreeDistribution } from "./transformers.js";

// ---------------------------------------------------------------------------
// Statistics kept for the readings below
// ---------------------------------------------------------------------------

// Amplitude and sentence rhythm used to be computed here, from a path
// rebuilt out of the raw graph and statements. That is why this server asked
// for uncompacted graphs and statements. The backend now computes both
// alongside the fractal exponents and ships them inside network_dynamics
// (see infranodus-backend/src/graph/fractalVariability.js), so this file only
// reads them. The shapes live in ../types.

const round = (value: number | null, digits = 3): number | null =>
	value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));

// ---------------------------------------------------------------------------
// Readings: one plain sentence per measure
// ---------------------------------------------------------------------------

export type RhythmBand = "alternating" | "random" | "fractal" | "persistent" | "blocks";

/** The text-specific reading bands of a DFA exponent on the step-length series. */
export function rhythmBand(alpha: number | null | undefined): RhythmBand | null {
	if (alpha == null || !Number.isFinite(alpha)) return null;
	if (alpha < 0.45) return "alternating";
	if (alpha < 0.6) return "random";
	if (alpha <= 0.9) return "fractal";
	if (alpha < 1.0) return "persistent";
	return "blocks";
}

const STEP_READINGS: Record<RhythmBand, string> = {
	alternating: "The text keeps switching back and forth between two or more topics, like a dialogue or a comparison.",
	random: "Each idea has little to do with the one before it: a list, a thread, or loose notes.",
	fractal: "The text moves between topics but keeps coming back to them, the way an essay or a story does.",
	persistent: "The text stays with each topic for a long time before moving on, but still returns to earlier ones.",
	blocks: "The text works through one topic at a time and rarely goes back, like chapters or sections.",
};

export function readStepAlpha(alpha: number | null | undefined): string | null {
	const band = rhythmBand(alpha);
	return band ? STEP_READINGS[band] : null;
}

export function readRadialAlpha(alpha: number | null | undefined): string | null {
	const band = rhythmBand(alpha);
	if (!band) return null;
	switch (band) {
		case "alternating":
			return "The text swings in and out of its main theme in quick alternation.";
		case "random":
			return "The text stays at a roughly constant distance from its main theme, with no pattern to its excursions.";
		case "fractal":
		case "persistent":
			return "The text leaves its main theme and comes back to it, repeatedly.";
		case "blocks":
			return "The text drifts away from where it started and does not return.";
	}
}

export function readScales(series: FractalScaling | null | undefined): string | null {
	if (!series || series.alpha1 == null || series.alpha2 == null) return null;
	const short = rhythmBand(series.alpha1);
	const long = rhythmBand(series.alpha2);
	if (!short || !long) return null;
	const shortCoherent = short === "fractal" || short === "persistent" || short === "blocks";
	const longCoherent = long === "fractal" || long === "persistent" || long === "blocks";
	if (shortCoherent && !longCoherent) return "Paragraphs hold together, but the document as a whole does not follow a thread.";
	if (!shortCoherent && longCoherent) return "Sentences jump around, but the overall arc is planned.";
	if (shortCoherent && longCoherent) return "Both the local flow and the overall arc hold together.";
	return "Neither the local flow nor the overall arc follows a thread.";
}

export function readMultifractal(series: FractalScaling | null | undefined): string | null {
	const mf = series?.multifractal;
	if (!mf) return null;
	if (mf.significant === false) return "The pacing shows no multifractal structure beyond what its length would produce by chance.";
	switch (mf.label) {
		case "multifractal":
			return mf.source === "distribution"
				? "Some leaps are very large, but they are not placed in any pattern."
				: "Long calm stretches broken by rare big leaps.";
		case "weak":
			return "The pacing is slightly uneven: a few leaps stand out from the rest.";
		case "monofractal":
			return "The pacing is steady throughout.";
		default:
			return null;
	}
}

export type Confidence = "none" | "indicative" | "usable" | "reliable";

/** From the backend's minimum-length table. */
export function confidenceFor(n: number | null | undefined): Confidence {
	if (n == null || n < 64) return "none";
	if (n < 128) return "indicative";
	if (n < 256) return "usable";
	return "reliable";
}

export interface LevelReadings {
	stepLength: string | null;
	radialDistance: string | null;
	scales: string | null;
	multifractal: string | null;
	confidence: Confidence;
}

export function readLevel(level: FractalSeries | null | undefined): LevelReadings | null {
	if (!level || (!level.byStepLength && !level.byRadialDistance)) return null;
	const step = level.byStepLength;
	return {
		stepLength: readStepAlpha(step?.alphaBounded),
		radialDistance: readRadialAlpha(level.byRadialDistance?.alphaBounded),
		scales: readScales(step),
		multifractal: readMultifractal(step),
		confidence: confidenceFor(step?.n ?? level.byRadialDistance?.n),
	};
}

// The sentence-length level is not a path: it says nothing about topics,
// only about rhythm, so it gets its own wording.
const SENTENCE_ALPHA_READINGS: Record<RhythmBand, string> = {
	alternating: "Long and short sentences alternate in a regular beat.",
	random: "Each sentence's length has nothing to do with the one before: no rhythm across sentences.",
	fractal: "Runs of long and short sentences nest at every scale, the 1/f rhythm of literary prose.",
	persistent: "Long stretches of similar sentence length, with some return to the earlier pace.",
	blocks: "The pace drifts: whole sections run long or short and do not come back.",
};

export function readSentenceAlpha(alpha: number | null | undefined): string | null {
	const band = rhythmBand(alpha);
	return band ? SENTENCE_ALPHA_READINGS[band] : null;
}

export interface SentenceScalingSummary {
	n: number;
	alphaBounded: number;
	alphaLabel: string;
	alpha1: number | null;
	alpha2: number | null;
	multifractalLabel: string | null;
	readings: {
		alpha: string | null;
		scales: string | null;
		multifractal: string | null;
		confidence: Confidence;
	};
}

/** Summary of the backend's DFA on the sentence-length series (network_dynamics.fractal_variability.sentence_word_count; internally sentenceLength.byWords). */
export function summariseSentenceScaling(
	fractal: FractalVariability | null | undefined,
): SentenceScalingSummary | null {
	const series = fractal?.sentenceLength?.byWords;
	if (!series) return null;
	const short = rhythmBand(series.alpha1);
	const long = rhythmBand(series.alpha2);
	let scales: string | null = null;
	if (short && long && short !== long) {
		const coherent = (b: RhythmBand) => b === "fractal" || b === "persistent" || b === "blocks";
		if (coherent(short) && !coherent(long)) scales = "Neighbouring sentences follow a rhythm, but it does not carry across paragraphs.";
		else if (!coherent(short) && coherent(long)) scales = "Sentence to sentence the pace is unpatterned, but sections as a whole run long or short.";
	}
	return {
		n: series.n,
		alphaBounded: series.alphaBounded,
		alphaLabel: series.alphaLabel,
		alpha1: series.alpha1 ?? null,
		alpha2: series.alpha2 ?? null,
		multifractalLabel: series.multifractal?.label ?? null,
		readings: {
			alpha: readSentenceAlpha(series.alphaBounded),
			scales,
			multifractal: readMultifractal(series),
			confidence: confidenceFor(series.n),
		},
	};
}

// The influence level: how the text moves between its hub concepts and its
// periphery. Read on the betweenness-rank series only.
const INFLUENCE_READINGS: Record<RhythmBand, string> = {
	alternating: "The text swings between its central concepts and peripheral ones in a regular beat.",
	random: "Central and peripheral concepts follow each other without pattern.",
	fractal: "The text returns to its central concepts in nested cycles, at every scale.",
	persistent: "Long stretches near the central concepts, or away from them, with some return.",
	blocks: "The text stays with its central concepts for whole sections, then leaves them, or the reverse, without return.",
};

export function readInfluenceAlpha(alpha: number | null | undefined): string | null {
	const band = rhythmBand(alpha);
	return band ? INFLUENCE_READINGS[band] : null;
}

export interface InfluenceReadings {
	byBetweennessRank: string | null;
	scales: string | null;
	multifractal: string | null;
	confidence: Confidence;
}

export function readInfluence(fractal: FractalVariability | null | undefined): InfluenceReadings | null {
	const series = fractal?.influence?.byBetweennessRank;
	if (!series) return null;
	return {
		// alpha1, not alphaBounded. On the 111-text corpus alphaBounded on this
		// series separated 0.66 on one AI group and 0.51 - chance - on the
		// other, with the direction flipping between them; alpha1 was weaker in
		// absolute terms, 0.61/0.67, but pointed the same way in both. Of the
		// numbers this series offers it is the only one worth a sentence.
		byBetweennessRank: readInfluenceAlpha(series.alpha1),
		scales: readScales(series),
		multifractal: readMultifractal(series),
		confidence: confidenceFor(series.n),
	};
}

/** Concentration of connectivity in the whole network; a descriptor, never a scale-free verdict. */
export function readDegreeDistribution(distribution: DegreeDistribution | null | undefined): Record<string, string | null> | null {
	if (!distribution) return null;
	const out: Record<string, string | null> = {};
	if (typeof distribution.gini === "number") {
		out.gini =
			distribution.gini < 0.3
				? "Connections are spread evenly across the concepts."
				: distribution.gini <= 0.5
					? "Connections are moderately concentrated: some concepts are far better connected than most."
					: "A few hub concepts hold most of the connections.";
	}
	out.tail = distribution.tail
		? `The top ${distribution.tail.n} concepts (degree ${distribution.tail.xmin} and above) thin out with a tail exponent of ${distribution.tail.alpha.toFixed(2)}: lower is heavier. This describes concentration only; it is not evidence of a scale-free network.`
		: "Too few concepts (under 50) to describe the tail.";
	if (typeof distribution.nodes === "number") {
		out.nodes = `The whole co-occurrence network has ${distribution.nodes} concepts before the node cap.`;
	}
	return out;
}

export function readAmplitude(stats: AmplitudeStats | null): Record<string, string | null> | null {
	if (!stats) return null;
	const out: Record<string, string | null> = {};
	if (stats.meanStep != null) {
		out.meanStep =
			stats.meanStep < 0.5
				? "Consecutive ideas sit close together in the concept network."
				: stats.meanStep < 1.0
					? "Consecutive ideas are a moderate distance apart in the concept network."
					: "Consecutive ideas are typically far apart in the concept network.";
	}
	if (stats.cvStep != null) {
		out.cvStep =
			stats.cvStep < 0.4
				? "Every move between ideas is about the same size; the pacing is even."
				: stats.cvStep <= 0.8
					? "The moves between ideas vary in size; the pacing is varied."
					: "Mostly small moves with a few big leaps; the pacing is uneven.";
	}
	if (stats.lag1Autocorrelation != null) {
		out.lag1Autocorrelation =
			stats.lag1Autocorrelation > 0.15
				? "Big moves tend to follow big moves: the text has stretches of leaping and stretches of staying."
				: stats.lag1Autocorrelation < -0.15
					? "Big moves tend to be followed by small ones: the text leaps and then settles."
					: "The size of one move says little about the next.";
	}
	if (stats.crossClusterShare != null) {
		const share = stats.crossClusterShare;
		out.crossClusterShare =
			share === 0
				? "The text never crosses into a different topic."
				: share > 0.6
					? `Most moves (${Math.round(share * 100)}%) cross into a different topic.`
					: `About one move in ${Math.round(1 / share)} crosses into a different topic.`;
	}
	if (stats.crossClusterRunCV != null) {
		out.crossClusterRunCV =
			stats.crossClusterRunCV < 0.7
				? "Topic changes come at regular intervals, like items in an outline."
				: stats.crossClusterRunCV <= 1.3
					? "Topic changes come at irregular but unpatterned intervals."
					: "Topic changes come in bursts: several in a row, then a long stay.";
	}
	if (stats.cvRadial != null) {
		out.cvRadial =
			stats.cvRadial < 0.3
				? "The text keeps a steady distance from its core theme."
				: "The text alternates between its core theme and its edges.";
	}
	return out;
}

export function readSentenceRhythm(rhythm: SentenceRhythm): Record<string, string | null> {
	const out: Record<string, string | null> = {};
	if (rhythm.cvLength != null) {
		out.cvLength =
			rhythm.cvLength < 0.35
				? "Sentences are all about the same length; the rhythm is flat."
				: rhythm.cvLength < 0.55
					? "Sentence length varies moderately."
					: "Sentence length varies a lot: long sentences next to short ones.";
	}
	if (rhythm.shortShare != null) {
		out.shortShare =
			rhythm.shortShare < 0.05
				? "Almost no short sentences."
				: rhythm.shortShare > 0.2
					? "Many short sentences."
					: "Some short sentences.";
	}
	if (rhythm.lag1Autocorrelation != null) {
		out.lag1Autocorrelation =
			rhythm.lag1Autocorrelation > 0.15
				? "Long sentences cluster together, and so do short ones."
				: rhythm.lag1Autocorrelation < -0.15
					? "Long and short sentences alternate."
					: "Sentence lengths do not follow one another in any pattern.";
	}
	return out;
}

// ---------------------------------------------------------------------------
// Structure readings from diversity_stats
// ---------------------------------------------------------------------------

export interface DiversityStats {
	diversity_score?: string;
	modularity_score?: string;
	too_focused_on_top_nodes?: boolean;
	too_focused_on_top_clusters?: boolean;
	ratio_of_top_nodes_influence_by_betweenness?: number;
	top_nodes_entropy?: number;
	ratio_of_top_cluster_influence_by_betweenness?: number;
	total_clusters?: number;
	fair_influence_by_cluster?: number;
}

const DIVERSITY_READINGS: Record<string, string> = {
	biased: "One topic dominates; the discourse has few places to move between.",
	focused: "A main topic with some satellites; developed but narrow.",
	diversified: "Several distinct topics with comparable weight; the discourse has room to move.",
	dispersed: "Many weakly connected fragments; the text is scattered rather than structured.",
};

export function readStructure(stats: DiversityStats | null | undefined): Record<string, string | null> | null {
	if (!stats) return null;
	const out: Record<string, string | null> = {};
	const score = stats.diversity_score?.toLowerCase();
	out.diversity = (score && DIVERSITY_READINGS[score]) || null;
	if (stats.top_nodes_entropy != null) {
		out.topNodesEntropy =
			stats.top_nodes_entropy >= 1.5
				? "Influence is spread across many concepts."
				: stats.top_nodes_entropy >= 0.8
					? "A few concepts carry most of the influence."
					: "The text hinges on one or two hub concepts.";
	}
	if (stats.ratio_of_top_cluster_influence_by_betweenness != null && stats.fair_influence_by_cluster) {
		const times = stats.ratio_of_top_cluster_influence_by_betweenness / stats.fair_influence_by_cluster;
		out.clusterDominance =
			times >= 2.5
				? `The largest topic carries about ${times.toFixed(1)}x its fair share of the discourse.`
				: times >= 1.5
					? `The largest topic carries about ${times.toFixed(1)}x its fair share of the discourse; the rest still have weight.`
					: "The topics share the discourse fairly evenly.";
	}
	return out;
}

// ---------------------------------------------------------------------------
// Signature: the backend's text type
// ---------------------------------------------------------------------------

type Structure = "biased" | "focused" | "diversified" | "dispersed";
type Movement = "close" | "steady" | "leaping";

/*
  The signature is the backend's diagnosis, network_dynamics.text_type: one of
  four names from two yes-or-no questions.

      Does the text have a core?    structure: biased or focused -> yes,
                                    diversified or dispersed -> no.
      Does it stay where it goes?   memory, from the DFA exponents that held
                                    up once text length was controlled for.

                       stays (memory)    keeps moving (no memory)
      has a core       deep dive         refrain
      no single core   chapters          sweep

  It is computed in the backend (infranodus-backend docs/fractal-variability.md,
  "Text type") so that this server and the graph interface name a text the
  same way. Nothing here recomputes it: a backend that does not return it
  gives a signature with no label.

  It replaced a grid of twelve names built from structure and the size of the
  steps (close / steady / leaping). Step size was standing in for memory and
  follows text length; the exponents now decide. The mean-step reference below
  is still used to read the mean step itself against texts of the same length.
*/
const MOVEMENT_REFERENCE = { intercept: -0.0697, slope: 0.1353, close: -0.0276, leaping: 0.0293, minSteps: 50 };

const STRUCTURE_VALUES: Record<Structure, string> = {
	biased: "One topical cluster or node dominates the network. Has a core.",
	focused: "A main topical cluster or node with a few supporting ones. Has a core.",
	diversified: "Several topical clusters of comparable weight. No single core.",
	dispersed: "Many loosely connected fragments with no clear centre. No single core.",
};

const TEXT_TYPE_VALUES: Record<NonNullable<TextType["label"]>, string> = {
	"deep dive":
		"Has a core and stays where it goes (dwells): the text goes into its main topic, stays there for a while, comes back to the core and goes out again.",
	refrain:
		"Has a core and keeps moving (roams): the text keeps returning to the same core at an even rate, without settling into any part of it.",
	chapters: "No single core and stays where it goes (dwells): the text moves through several topics and stays in each for a while.",
	sweep: "No single core and keeps moving (roams): the text touches many topics at an even rate, never settling.",
};

const BASIS_TEXTS: Record<NonNullable<TextType["basis"]>, string> = {
	memory:
		"Judged from up to six measures, averaged with equal weight. Three DFA exponents (ngram4_graph_radial_distance.dfa_alpha2, node_betweenness_rank.dfa_alpha1, sentence_word_count.dfa_alpha_global): whether the path, the core concepts and the sentence lengths come in lasting phases. And three measures of how the text moves between topics, each read against a path of the same length (cross_cluster_step_share reversed, cluster_dwell_cv, ngram4_graph_step_length.dfa_alpha1): a text that stays where it goes (dwells) switches topic less, has more uneven stays and takes steps that come in runs. memory_parts says how many of the six could be measured.",
	movement:
		"The text is too short for the DFA exponents, so this is judged from the size of its steps and is a weak reading.",
};

export interface Signature {
	/** the text type, as the backend named it; null when it gave none */
	label: TextType["label"];
	/** every value `label` can take, with what each means */
	label_possible_values: Record<NonNullable<TextType["label"]>, string>;
	summary: string | null;
	/** does the text have a core: from `structure` */
	has_core: boolean | null;
	structure: Structure | null;
	/** every value `structure` can take, with what each means */
	structure_possible_values: Record<Structure, string>;
	/** does the text stay where it goes: memory, from the DFA exponents */
	stays_where_it_goes: boolean | null;
	/** what the stays / keeps moving reading rests on */
	basis: TextType["basis"];
	basis_explanation: string | null;
	/** mean distance of the measured parts from their typical values, in standard deviations; above 0 = stays where it goes (dwells) */
	memory_score: number | null;
	/** how many of the six parts the score is the mean of; null from a backend that does not say */
	memory_parts: number | null;
	/** "borderline": close to the dividing line, the neighbouring type is nearly as likely */
	confidence: TextType["confidence"];
	note: string;
}

export function movementBand(
	meanStep: number | null | undefined,
	steps: number | null | undefined,
): { movement: Movement | null; expected: number | null } {
	if (meanStep == null || steps == null || !Number.isFinite(meanStep) || steps < MOVEMENT_REFERENCE.minSteps)
		return { movement: null, expected: null };
	const expected = MOVEMENT_REFERENCE.intercept + MOVEMENT_REFERENCE.slope * Math.log(steps);
	const difference = meanStep - expected;
	const movement: Movement =
		difference < MOVEMENT_REFERENCE.close ? "close" : difference > MOVEMENT_REFERENCE.leaping ? "leaping" : "steady";
	return { movement, expected: Number(expected.toFixed(3)) };
}

export function composeSignature(textType: TextType | null | undefined): Signature {
	const type = textType ?? null;
	return {
		label: type?.label ?? null,
		label_possible_values: TEXT_TYPE_VALUES,
		summary: type?.description ?? (type?.label ? TEXT_TYPE_VALUES[type.label] : null),
		has_core: type?.has_core ?? null,
		structure: type?.structure ?? null,
		structure_possible_values: STRUCTURE_VALUES,
		stays_where_it_goes: type?.stays_where_it_goes ?? null,
		basis: type?.basis ?? null,
		basis_explanation: type?.basis ? BASIS_TEXTS[type.basis] : null,
		memory_score: type?.memory_score ?? null,
		memory_parts: type?.memory_parts ?? null,
		confidence: type?.confidence ?? null,
		note: "The text type describes how a text moves through its own graph. Human-written text tends towards the types that stay where they go (deep dive, chapters) and AI-generated text towards sweep, but these are tendencies of moderate strength: never present the type as evidence of who wrote a text.",
	};
}

// ---------------------------------------------------------------------------
// AI-likeness: weighted evidence, hedged verdict
// ---------------------------------------------------------------------------

export interface Evidence {
	signal: string;
	value: number | string;
	/** +1 generated-like ... -1 human-like */
	direction: number;
	weight: number;
	reading: string;
}

export interface AiLikeness {
	verdict: "leaning AI" | "leaning human" | "mixed";
	/** why: the pacing the verdict was read from (evenly paced, variably paced, or inconclusive) */
	verdict_explanation: string;
	/** -1 (human-like) to +1 (generated-like) */
	score: number | null;
	confidence: "low" | "medium";
	evidence: Evidence[];
	caveats: string[];
}

const CAVEATS = [
	"This is a stylistic tendency read from rhythm and structure, not a detection result; never treat it as proof of authorship.",
	"The thresholds are heuristics from the DFA literature and a one-author reference corpus of about 100 texts graphed at 150 concepts; with a different concept cap the radial-persistence signal is not calibrated. On held-out texts the score ranked AI drafts below human ones (AUC 0.87), but AI-drafted pages that were edited or humanized can still read as human here.",
	"Even pacing is also typical of human technical, legal, and non-native writing; uneven pacing can be prompted or paraphrased into generated text.",
	"Under about 30 sentences or 128 path steps the rhythm measures are noisy and the verdict should be read as inconclusive.",
];

export function estimateAiLikeness(input: {
	sentenceRhythm: SentenceRhythm;
	amplitude: Amplitude;
	fractal: FractalVariability | null | undefined;
}): AiLikeness {
	const evidence: Evidence[] = [];
	const { sentenceRhythm, amplitude, fractal } = input;

	// Persistence of the distance from the core theme along the 4-gram path:
	// the strongest structural signal we have measured. When a human text moves
	// away from its core into a tangent or a detail, it stays away for a while
	// and then comes back (higher alpha); AI drafts touch the tangent and snap
	// back to the core (lower alpha). AUC 0.86 on 77 held-out texts and 8/10 in
	// a blind test, calibrated at the default 150-node cap (November 2026,
	// infranodus-backend docs/todo/vector-search-and-embedding-dfa.md).
	// Linear from +1 at 0.72 to -1 at 0.88, centred on 0.80.
	const radial = fractal?.ngrams?.byRadialDistance;
	if (radial?.alphaBounded != null && confidenceFor(radial.n) !== "none" && confidenceFor(radial.n) !== "indicative") {
		const direction = Math.round(Math.max(-1, Math.min(1, (0.8 - radial.alphaBounded) / 0.08)) * 100) / 100;
		evidence.push({
			signal: "persistence of distance from the core theme (4-gram radial DFA alpha)",
			value: radial.alphaBounded,
			direction,
			weight: 3,
			reading:
				direction > 0
					? "After a tangent the text snaps back to its core theme: distance from the core has little memory."
					: "When the text moves away from its core into a tangent or a detail, it stays away for a while and then comes back.",
		});
	}

	// Sentence-length CV and the share of short sentences are not used: on the
	// same held-out texts both pointed the wrong way (AUC 0.18 and 0.12) and
	// pulled the score below chance. They stay in the readings as descriptors.

	// The classic sentence-length series (Drozdz et al.): 1/f rhythm across
	// sentences is the literary signature; no memory across sentences is the
	// flat one. Measured by the backend on every sentence, fragments included.
	const sentenceSeries = fractal?.sentenceLength?.byWords;
	if (sentenceSeries && confidenceFor(sentenceSeries.n) !== "none" && confidenceFor(sentenceSeries.n) !== "indicative") {
		const band = rhythmBand(sentenceSeries.alphaBounded);
		const direction = band === "random" ? 1 : band === "fractal" || band === "persistent" ? -1 : band ? -0.5 : 0;
		if (direction !== 0)
			evidence.push({
				signal: "sentence-length rhythm across scales (DFA alpha)",
				value: sentenceSeries.alphaBounded,
				direction,
				weight: 1,
				reading:
					direction > 0
						? "Sentence lengths carry no rhythm from one to the next."
						: "Sentence lengths follow a rhythm across scales, as in human prose.",
			});
	}

	// Memory of the topic path: memoryless hopping vs. fractal return. Weighted
	// below the sentence rhythm: generated prose with one topic per paragraph
	// reads fractal here too, so the signal separates lists from prose more
	// than machines from people.
	const levels: Array<["statements" | "words", FractalScaling | null | undefined]> = [
		["statements", fractal?.statements?.byStepLength],
		["words", fractal?.words?.byStepLength],
	];
	for (const [level, series] of levels) {
		if (!series || confidenceFor(series.n) === "none" || confidenceFor(series.n) === "indicative") continue;
		const band = rhythmBand(series.alphaBounded);
		if (!band) continue;
		const direction = band === "random" ? 1 : band === "fractal" || band === "persistent" ? -1 : 0;
		if (direction === 0) continue;
		evidence.push({
			signal: `${level}-level topic path memory (DFA alpha)`,
			value: series.alphaBounded,
			direction,
			weight: 1,
			reading:
				direction > 0
					? "The text hops between topics without memory of where it has been."
					: "The text returns to its topics at every scale, as human narrative does.",
		});
	}

	// Multifractality on the word path, only when the surrogate test is meaningful.
	const mf = fractal?.words?.byStepLength?.multifractal;
	if (mf && (fractal?.words?.byStepLength?.n ?? 0) >= 512 && mf.significant != null) {
		const humanLike = mf.significant && mf.label === "multifractal" && mf.source !== "distribution";
		const direction = humanLike ? -1 : mf.label === "monofractal" ? 0.5 : 0;
		if (direction !== 0)
			evidence.push({
				signal: "multifractality of the topic path",
				value: mf.label,
				direction,
				weight: 0.75,
				reading: humanLike
					? "Calm stretches punctuated by rare big leaps: intermittent pacing typical of human writing."
					: "Steady pacing with no scale-dependent leaps.",
			});
	}

	// Burstiness of movement through the graph and regularity of topic changes.
	const words = amplitude.words;
	if (words && words.n >= 128) {
		if (words.cvStep != null) {
			const direction = words.cvStep < 0.5 ? 0.7 : words.cvStep > 0.9 ? -0.7 : 0;
			if (direction !== 0)
				evidence.push({
					signal: "step-length variability of the topic path (CV)",
					value: words.cvStep,
					direction,
					weight: 0.5,
					reading:
						direction > 0
							? "Moves between ideas are all about the same size."
							: "Mostly small moves with occasional long leaps.",
				});
		}
		if (words.crossClusterRunCV != null) {
			const direction = words.crossClusterRunCV < 0.7 ? 1 : words.crossClusterRunCV > 1.3 ? -0.5 : 0;
			if (direction !== 0)
				evidence.push({
					signal: "regularity of topic changes",
					value: words.crossClusterRunCV,
					direction,
					weight: 0.5,
					reading:
						direction > 0
							? "Topic changes come at regular intervals, like items in an outline."
							: "Topic changes come in bursts.",
				});
		}
	}

	const totalWeight = evidence.reduce((sum, e) => sum + e.weight, 0);
	const score = totalWeight > 0 ? round(evidence.reduce((sum, e) => sum + e.weight * e.direction, 0) / totalWeight, 2) : null;
	// Radial persistence carries a third of the usual weight on its own, so with
	// it one more agreeing or disagreeing signal is enough to read a verdict.
	const radialUsed = evidence.some((e) => e.signal.startsWith("persistence of distance from the core theme"));
	const enough = (evidence.length >= 3 || (radialUsed && evidence.length >= 2)) && sentenceRhythm.sentences >= 30;
	const verdict: AiLikeness["verdict"] =
		score == null || !enough ? "mixed" : score >= 0.25 ? "leaning AI" : score <= -0.25 ? "leaning human" : "mixed";
	const verdict_explanation =
		score == null || !enough
			? "Inconclusive: too little text or too few signals to read the pacing."
			: score >= 0.25
				? "Evenly paced: the text snaps back to its core after each tangent and its moves between ideas are uniform, which is more common in generated text."
				: score <= -0.25
					? "Variably paced: the text stays with its tangents before coming back to the core, and its moves between ideas vary, which is more common in human writing."
					: "Inconclusive: the pacing signals point in different directions.";
	// Medium confidence only for a clear-cut profile with several agreeing
	// signals; anything near the middle stays low.
	const clearCut = score != null && Math.abs(score) >= 0.5;
	return {
		verdict,
		verdict_explanation,
		score,
		confidence: enough && clearCut && evidence.length >= 4 ? "medium" : "low",
		evidence,
		caveats: CAVEATS,
	};
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export interface TextSignatureOutput {
	signature: Signature;
	structure: {
		modularity: number | null;
		diversity_stats: DiversityStats | null;
		/** whole-network degree distribution, histogram trimmed to 40 rows; null on older backends */
		degree_distribution: DegreeDistribution | null;
		readings: Record<string, string | null> | null;
		degreeReadings: Record<string, string | null> | null;
	};
	/** the numbers, exactly as the API returns them, under their public names */
	network_dynamics: NetworkDynamics | null;
	/**
	 * One plain sentence per measure, keyed exactly like network_dynamics, with a
	 * `reliability` per DFA series and a `note` per block stating what limits
	 * the reading. See interpretNetworkDynamics.
	 */
	readings: NetworkDynamicsReadings | null;
	ai_likeness: AiLikeness;
	notes: string[];
}

const NOTES = [
	"network_dynamics has three kinds of measure: fractal_variability holds DFA scaling exponents (dfa_alpha_global over scales 4 to N/4, dfa_alpha1 over 4 to 16, dfa_alpha2 over 16 to N/4); node_graph_path_amplitude and sentence_rhythm hold plain statistics, not fits.",
	"Compare a DFA series only with the same series of another text of similar length: several of these measures change with text length alone.",
	"node_graph_path_amplitude distances are divided by the graph radius (RMS distance of the nodes from their centroid), so they are comparable across graphs of different size.",
	"sentence_rhythm counts prose statements only (fragments under 12 words are skipped); fractal_variability.sentence_word_count is a DFA over every sentence of the text, needs 64 sentences, and degenerates on scripts written without spaces.",
	"structure.degree_distribution describes how concentrated connectivity is in the whole network before the node cap. Its gini and tail exponent are descriptors, never a scale-free or power-law finding: word networks are heavy-tailed for any text.",
	"These measures describe how a text is built. They are not an AI detector: on held-out AI-written texts a composite of them caught one in four at the false-positive rate where a commercial detector caught three.",
];

// ---------------------------------------------------------------------------
// From the API's public names to the internal reading shape
// ---------------------------------------------------------------------------

const toScaling = (block: DfaSeriesBlock | null | undefined): FractalScaling | null =>
	block
		? ({
				n: block.series_length,
				alphaBounded: block.dfa_alpha_global ?? null,
				alphaLabel: block.dfa_alpha_global_label ?? null,
				alpha1: block.dfa_alpha1 ?? null,
				alpha1Label: block.dfa_alpha1_label ?? null,
				alpha2: block.dfa_alpha2 ?? null,
				alpha2Label: block.dfa_alpha2_label ?? null,
				multifractal: block.multifractal ?? null,
			} as unknown as FractalScaling)
		: null;

/** network_dynamics, as returned by the API, in the shape the readers below were written for. */
export function toReadingShape(dynamics: NetworkDynamics | null | undefined): FractalVariability | null {
	if (!dynamics) return null;
	const fv = dynamics.fractal_variability;
	const amp = dynamics.node_graph_path_amplitude;
	const rhythm = dynamics.sentence_rhythm;
	return {
		ngrams: { byRadialDistance: toScaling(fv?.ngram4_graph_radial_distance) },
		sentenceLength: {
			sentences: fv?.sentence_word_count_series_available ?? 0,
			byWords: toScaling(fv?.sentence_word_count),
		},
		influence: { byBetweennessRank: toScaling(fv?.node_betweenness_rank) } as FractalVariability["influence"],
		amplitude: {
			graphRadius: amp?.graph_radius_rms ?? null,
			words: amp
				? {
						n: amp.steps,
						meanStep: amp.mean_step_relative_to_graph_radius ?? null,
						cvStep: amp.step_cv ?? null,
						lag1Autocorrelation: amp.step_lag1_autocorrelation ?? null,
						crossClusterShare: amp.cross_cluster_step_share ?? null,
						crossClusterRunCV: amp.cluster_dwell_cv ?? null,
						meanRadial: amp.mean_radial_distance_relative_to_graph_radius ?? null,
						cvRadial: amp.radial_distance_cv ?? null,
					}
				: null,
		},
		sentenceRhythm: rhythm
			? {
					sentences: rhythm.prose_sentences ?? 0,
					skippedFragments: rhythm.skipped_fragments_under_12_words ?? 0,
					meanLength: rhythm.mean_words_per_sentence ?? null,
					cvLength: rhythm.words_per_sentence_cv ?? null,
					lag1Autocorrelation: rhythm.words_per_sentence_lag1_autocorrelation ?? null,
					shortShare: rhythm.share_under_8_words ?? null,
					longShare: rhythm.share_over_30_words ?? null,
					statements: rhythm.prose_statements ?? 0,
				}
			: undefined,
	};
}

// Readers key their sentences by internal names; the output keys them like network_dynamics.
const rekey = (
	readings: Record<string, string | null> | null | undefined,
	names: Record<string, string>,
): Record<string, string | null> | null => {
	if (!readings) return null;
	const out: Record<string, string | null> = {};
	for (const [key, value] of Object.entries(readings)) out[names[key] ?? key] = value;
	return out;
};

const AMPLITUDE_NAMES: Record<string, string> = {
	meanStep: "mean_step_relative_to_graph_radius",
	cvStep: "step_cv",
	lag1Autocorrelation: "step_lag1_autocorrelation",
	crossClusterShare: "cross_cluster_step_share",
	crossClusterRunCV: "cluster_dwell_cv",
	cvRadial: "radial_distance_cv",
};

const RHYTHM_NAMES: Record<string, string> = {
	cvLength: "words_per_sentence_cv",
	shortShare: "share_under_8_words",
	lag1Autocorrelation: "words_per_sentence_lag1_autocorrelation",
};

// ---------------------------------------------------------------------------
// Interpretation of network_dynamics, field by field
// ---------------------------------------------------------------------------

export type Reading = Record<string, string | null>;

export interface NetworkDynamicsReadings {
	about: string;
	fractal_variability: {
		ngram4_graph_radial_distance: Reading | null;
		/** present only when the backend returned the step series */
		ngram4_graph_step_length?: Reading | null;
		sentence_word_count: Reading | null;
		node_betweenness_rank: Reading | null;
	};
	node_graph_path_amplitude: Reading | null;
	sentence_rhythm: Reading;
}

/*
  Where a value sits is judged against the lower and upper third of a
  reference corpus: 115 texts (100 pages and posts by one author, 15
  AI-written texts) graphed at 150 nodes in November 2026. The cut points are
  a starting calibration from that corpus, not population norms, and each
  readings state only the value and what it means: the comparison set is an
  internal calibration and is not mentioned to the reader.

  The notes carry what the same study found about each measure: which ones
  change with text length alone, which are stable within a text, and that none
  of them is a detector. Evidence and figures:
  infranodus-backend/docs/fractal-fields-table.md.
*/
const THIRDS: Record<string, [number, number]> = {
	"ngram4.dfa_alpha_global": [0.785, 0.875],
	"ngram4.dfa_alpha2": [0.63, 0.75],
	// step series of the 4-gram path: thirds of the 40-text retest (same cut
	// points as the graph panel, infranodus-graph networkDynamicsReadings.js)
	"ngram4_step.dfa_alpha_global": [0.6, 0.635],
	"ngram4_step.dfa_alpha1": [0.67, 0.715],
	"ngram4_step.dfa_alpha2": [0.56, 0.62],
	"sentence.dfa_alpha_global": [0.63, 0.745],
	"sentence.dfa_alpha1": [0.61, 0.73],
	"betweenness.dfa_alpha1": [0.565, 0.6],
	mean_step: [0.72, 0.85],
	cross_cluster: [0.35, 0.45],
	dwell_cv: [0.88, 1.0],
	mean_radial: [0.89, 0.915],
	radial_cv: [0.24, 0.275],
	mean_words: [17.5, 21],
	short_share: [0.05, 0.14],
	long_share: [0.085, 0.16],
};

const third = (key: string, value: number | null | undefined): "low" | "mid" | "high" | null => {
	if (value == null || !Number.isFinite(value)) return null;
	const [lo, hi] = THIRDS[key];
	return value < lo ? "low" : value > hi ? "high" : "mid";
};

const say = (
	key: string,
	value: number | null | undefined,
	shown: string,
	texts: { low: string; mid: string; high: string },
): string | null => {
	const band = third(key, value);
	return band ? `${shown}: ${texts[band]}` : null;
};

const RELIABILITY: Record<Confidence, string> = {
	none: "Under 64 points: the exponents are not meaningful.",
	indicative: "64 to 127 points: a rough indication only.",
	usable: "128 to 255 points: usable, with noticeable noise.",
	reliable: "256 points or more: as reliable as this measure gets for a single text.",
};

const pct = (value: number) => `${Math.round(value * 100)}%`;

const MEAN_STEP_TEXTS = {
	low: "consecutive nodes sit close together for a text of this length, so the text stays in one neighbourhood of the graph.",
	mid: "the text moves a typical distance between consecutive nodes for a text of this length.",
	high: "the text jumps far across the graph between consecutive nodes for a text of this length.",
};

function readMeanStep(meanStep: number | null | undefined, steps: number | null | undefined): string | null {
	if (meanStep == null || !Number.isFinite(meanStep)) return null;
	const { movement } = movementBand(meanStep, steps);
	const band = movement === "close" ? "low" : movement === "leaping" ? "high" : movement === "steady" ? "mid" : third("mean_step", meanStep);
	return band ? `Mean step ${meanStep} graph radii: ${MEAN_STEP_TEXTS[band]}` : null;
}

export function interpretNetworkDynamics(dynamics: NetworkDynamics | null | undefined): NetworkDynamicsReadings | null {
	if (!dynamics) return null;
	const fv = dynamics.fractal_variability;
	const amp = dynamics.node_graph_path_amplitude;
	const rhythm = dynamics.sentence_rhythm;

	const radial = fv?.ngram4_graph_radial_distance;
	const step = fv?.ngram4_graph_step_length;
	const sentence = fv?.sentence_word_count;
	const rank = fv?.node_betweenness_rank;

	return {
		about:
			"One sentence per measure, saying what the value means for this text. The measures describe how a text is built. They are not an AI detector and should not be reported as one.",
		fractal_variability: {
			ngram4_graph_radial_distance: radial
				? {
						reliability: RELIABILITY[confidenceFor(radial.series_length)],
						dfa_alpha_global: say("ngram4.dfa_alpha_global", radial.dfa_alpha_global, `dfa_alpha_global ${radial.dfa_alpha_global}`, {
							low: "the text's distance from its central theme changes with little memory, so it makes few sustained excursions.",
							mid: "the text moves away from its central theme and back with moderate persistence.",
							high: "the text makes long excursions away from its central theme and returns, and that pattern repeats across scales.",
						}),
						dfa_alpha2: say("ngram4.dfa_alpha2", radial.dfa_alpha2, `dfa_alpha2 ${radial.dfa_alpha2}`, {
							low: "over long stretches the distance from the core is close to random: the text circles at much the same distance instead of moving in phases.",
							mid: "the text moves in phases of moderate length, some near its core concepts and some out in the periphery.",
							high: "the text moves in long phases: it stays near its core concepts for a while, then out in the periphery for a while, before it returns.",
						}),
						note: "dfa_alpha_global falls as texts get longer, so compare it only with texts of similar length. dfa_alpha2 does not depend on length, but it can differ between the first and second half of the same text.",
					}
				: null,
			// only when the backend returned the step series, so the keys are
			// unchanged against an older backend
			...(step
				? {
						ngram4_graph_step_length: {
							reliability: RELIABILITY[confidenceFor(step.series_length)],
							dfa_alpha_global: say("ngram4_step.dfa_alpha_global", step.dfa_alpha_global, `dfa_alpha_global ${step.dfa_alpha_global}`, {
								low: "small and large steps are mixed with little pattern.",
								mid: "small and large steps come in runs of moderate length.",
								high: "the text alternates settled stretches of small steps with restless stretches of large ones.",
							}),
							dfa_alpha1: say("ngram4_step.dfa_alpha1", step.dfa_alpha1, `dfa_alpha1 ${step.dfa_alpha1}`, {
								low: "from one step to the next few, step size is close to unpatterned.",
								mid: "neighbouring steps are moderately alike in size.",
								high: "neighbouring steps tend to be alike in size.",
							}),
							dfa_alpha2: say("ngram4_step.dfa_alpha2", step.dfa_alpha2, `dfa_alpha2 ${step.dfa_alpha2}`, {
								low: "over long stretches step size is close to random: the text has no settled or restless phases.",
								mid: "the text has settled and restless phases of moderate length.",
								high: "the text has long settled phases and long restless ones.",
							}),
							note: "The step series is the distance from each window of 4 consecutive nodes to the next. Its exponents describe the pattern of the movement, not its amount: a text can switch topic often and still read high. They do not tell human-written from AI-written text apart, so report them as a description only. dfa_alpha1 is one of the six measures the text type is read from; dfa_alpha_global and dfa_alpha2 are not.",
						},
					}
				: {}),
			sentence_word_count: sentence
				? {
						reliability: RELIABILITY[confidenceFor(sentence.series_length)],
						dfa_alpha_global: say("sentence.dfa_alpha_global", sentence.dfa_alpha_global, `dfa_alpha_global ${sentence.dfa_alpha_global}`, {
							low: "sentence length resets often: long and short sentences do not come in runs, and one length says little about the next.",
							mid: "sentence length is moderately persistent: long and short sentences come in runs of moderate length.",
							high: "sentence length is persistent: runs of long sentences and runs of short ones, with shorter runs nested inside longer ones.",
						}),
						dfa_alpha1: say("sentence.dfa_alpha1", sentence.dfa_alpha1, `dfa_alpha1 ${sentence.dfa_alpha1}`, {
							low: "from one sentence to the next few, length is close to unpatterned.",
							mid: "neighbouring sentences are moderately alike in length.",
							high: "neighbouring sentences tend to be alike in length.",
						}),
						note: "Human-written texts tend to read higher (around 0.73) than AI-written ones (around 0.62). It needs at least 64 sentences, and for a single text the value is noisy, so treat it as a tendency.",
					}
				: fv
					? {
							reliability: `The text has ${fv.sentence_word_count_series_available} sentence(s), under the 64 needed, so no exponent was fitted.`,
						}
					: null,
			node_betweenness_rank: rank
				? {
						reliability: RELIABILITY[confidenceFor(rank.series_length)],
						dfa_alpha1: say("betweenness.dfa_alpha1", rank.dfa_alpha1, `dfa_alpha1 ${rank.dfa_alpha1}`, {
							low: "core and peripheral concepts follow each other with little pattern: the core comes back at a steady rate.",
							mid: "core concepts come back in weak bursts.",
							high: "core concepts come back in bursts: stretches on the hub concepts alternate with stretches away from them.",
						}),
						note: "A weak signal: it can differ between the first and second half of the same text, so treat it as a hint, not a firm description.",
					}
				: null,
		},
		node_graph_path_amplitude: amp
			? {
					// Judged against a path of the same length, exactly as the
					// signature's movement is, so the two never disagree. The
					// fixed cut points are the fallback for a path under 50 steps.
					mean_step_relative_to_graph_radius: readMeanStep(amp.mean_step_relative_to_graph_radius, amp.steps),
					cross_cluster_step_share:
						amp.cross_cluster_step_share == null
							? null
							: say("cross_cluster", amp.cross_cluster_step_share, `${pct(amp.cross_cluster_step_share)} of steps cross into another topic cluster`, {
									low: "the text settles inside a topic before moving on.",
									mid: "the text changes topic at a moderate rate.",
									high: "the text switches topic often.",
								}),
					// only when the backend returned it, so the keys are unchanged
					// against an older backend
					...(amp.cluster_dwell_cv == null
						? {}
						: {
								cluster_dwell_cv: say("dwell_cv", amp.cluster_dwell_cv, `Variation of the stays inside a topic ${amp.cluster_dwell_cv}`, {
									low: "the text spends about the same time in every topic it visits.",
									mid: "some topics get longer stays than others.",
									high: "the text stays long in some topics and only passes through others.",
								}),
							}),
					mean_radial_distance_relative_to_graph_radius: say(
						"mean_radial",
						amp.mean_radial_distance_relative_to_graph_radius,
						`Mean distance from the centre ${amp.mean_radial_distance_relative_to_graph_radius} graph radii`,
						{
							low: "the text is anchored: it keeps coming back to its central concepts.",
							mid: "the text sits at a typical distance from its central concepts.",
							high: "the text lives in the periphery of the graph, touching many topics without dwelling on its core.",
						},
					),
					radial_distance_cv: say("radial_cv", amp.radial_distance_cv, `Distance variation ${amp.radial_distance_cv}`, {
						low: "the text keeps a steady distance from its centre, without going deep into the core or far out.",
						mid: "the text travels between its core and its edges to a moderate degree.",
						high: "the text travels far out to its edges and comes back to its core.",
					}),
					note: "Mean step is read against what a text of this length usually shows. Cross-cluster share is not adjusted and rises with text length alone, so compare it with texts of similar length.",
				}
			: null,
		sentence_rhythm: {
			mean_words_per_sentence: say("mean_words", rhythm?.mean_words_per_sentence, `${rhythm?.mean_words_per_sentence} words per sentence on average`, {
				low: "short sentences.",
				mid: "sentences of typical length.",
				high: "long sentences.",
			}),
			share_under_8_words:
				rhythm?.share_under_8_words == null
					? null
					: say("short_share", rhythm.share_under_8_words, `${pct(rhythm.share_under_8_words)} of sentences are under 8 words`, {
							low: "almost no short sentences.",
							mid: "some short sentences.",
							high: "many short, declarative sentences.",
						}),
			share_over_30_words:
				rhythm?.share_over_30_words == null
					? null
					: say("long_share", rhythm.share_over_30_words, `${pct(rhythm.share_over_30_words)} of sentences are over 30 words`, {
							low: "few long sentences.",
							mid: "some long sentences.",
							high: "many sentences are allowed to run long.",
						}),
			coverage: rhythm
				? `${rhythm.prose_sentences} sentences were measured; ${rhythm.skipped_fragments_under_12_words} statements under 12 words (headings, list items, captions) were left out.`
				: null,
			note: "Sentence measures are stable within a text and separate kinds of text, so they describe a prose style. They reflect the habits of a source, and on their own they are not evidence of AI authorship.",
		},
	};
}

// Fields that only arrive with fractalExperimental keep the sentences the
// older readers wrote for them, added without overwriting the ones above.
function withExperimentalReadings(
	readings: NetworkDynamicsReadings | null,
	extra: {
		radialScales: string | null;
		radialSpectrum: string | null;
		sentenceScales: string | null;
		sentenceSpectrum: string | null;
		rankScales: string | null;
		rankSpectrum: string | null;
		amplitude: Reading | null;
		rhythm: Reading | null;
	},
): NetworkDynamicsReadings | null {
	if (!readings) return null;
	const add = (target: Reading | null, values: Reading) => {
		if (!target) return;
		for (const [key, value] of Object.entries(values)) if (value != null && target[key] == null) target[key] = value;
	};
	const fv = readings.fractal_variability;
	add(fv.ngram4_graph_radial_distance, { short_versus_long_scales: extra.radialScales, multifractal: extra.radialSpectrum });
	add(fv.sentence_word_count, { short_versus_long_scales: extra.sentenceScales, multifractal: extra.sentenceSpectrum });
	add(fv.node_betweenness_rank, { short_versus_long_scales: extra.rankScales, multifractal: extra.rankSpectrum });
	const only = (values: Reading | null, keys: string[]): Reading =>
		Object.fromEntries(keys.map((key) => [key, values?.[key] ?? null]));
	add(readings.node_graph_path_amplitude, only(extra.amplitude, ["step_cv", "step_lag1_autocorrelation", "cluster_dwell_cv"]));
	add(readings.sentence_rhythm, only(extra.rhythm, ["words_per_sentence_cv", "words_per_sentence_lag1_autocorrelation"]));
	return readings;
}

// The default set of network_dynamics fields, mirroring the backend's default
// response (infranodus-backend/src/graph/fractalVariability.js). The tool
// always fetches the full object, because ai_likeness needs the experimental
// measures to have enough evidence, and shows only this set unless asked.
const pickFields = <T extends object>(object: T | null | undefined, keys: string[]): T | null =>
	object ? (Object.fromEntries(keys.filter((k) => k in object).map((k) => [k, (object as any)[k]])) as T) : null;

// A series' default fields, plus its multifractal spectrum when one was
// computed: the spectrum is asked for with its own parameter, so it is shown
// whenever it is there, in the default view too.
const pickSeries = (block: DfaSeriesBlock | null | undefined, keys: string[]): DfaSeriesBlock | null => {
	const picked = pickFields(block, keys);
	if (picked && block?.multifractal) (picked as any).multifractal = block.multifractal;
	return picked;
};

export function toDefaultFields(dynamics: NetworkDynamics | null): NetworkDynamics | null {
	if (!dynamics) return null;
	const fv = dynamics.fractal_variability;
	return {
		fractal_variability: {
			ngram4_graph_radial_distance: pickSeries(fv?.ngram4_graph_radial_distance, ["series_length", "dfa_alpha_global", "dfa_alpha2"]),
			// a descriptor with all three exponents; left out against an older backend
			...(fv?.ngram4_graph_step_length
				? { ngram4_graph_step_length: pickSeries(fv.ngram4_graph_step_length, ["series_length", "dfa_alpha_global", "dfa_alpha1", "dfa_alpha2"]) }
				: {}),
			sentence_word_count: pickSeries(fv?.sentence_word_count, ["series_length", "dfa_alpha_global", "dfa_alpha1"]),
			sentence_word_count_series_available: fv?.sentence_word_count_series_available ?? 0,
			node_betweenness_rank: pickSeries(fv?.node_betweenness_rank, ["series_length", "dfa_alpha1"]),
		},
		node_graph_path_amplitude: pickFields(dynamics.node_graph_path_amplitude, [
			"steps",
			"mean_step_relative_to_graph_radius",
			"cross_cluster_step_share",
			// part of the text type's memory score; absent on older backends
			...(dynamics.node_graph_path_amplitude?.cluster_dwell_cv == null ? [] : ["cluster_dwell_cv"]),
			"mean_radial_distance_relative_to_graph_radius",
			"radial_distance_cv",
		]),
		sentence_rhythm: pickFields(dynamics.sentence_rhythm, [
			"prose_sentences",
			"skipped_fragments_under_12_words",
			"mean_words_per_sentence",
			"share_under_8_words",
			"share_over_30_words",
		]) as NetworkDynamics["sentence_rhythm"],
	};
}

export function buildTextSignature(input: {
	modularity: number | null | undefined;
	diversity: DiversityStats | null | undefined;
	networkDynamics: NetworkDynamics | null | undefined;
	degreeDistribution?: DegreeDistribution | null;
	/** show the experimental fields and their readings too; ai_likeness uses them either way */
	includeExperimental?: boolean;
}): TextSignatureOutput {
	const everything = input.networkDynamics ?? null;
	// ai_likeness and the signature are computed from everything the API sent
	const full = toReadingShape(everything);
	// what is shown, and read out, is the default set unless asked otherwise
	const networkDynamics = input.includeExperimental ? everything : toDefaultFields(everything);
	const fractal = toReadingShape(networkDynamics);
	const diversity = input.diversity ?? null;
	const degreeDistribution = input.degreeDistribution ? trimDegreeDistribution(input.degreeDistribution) : null;
	const emptyRhythm: SentenceRhythm = {
		sentences: 0,
		skippedFragments: 0,
		meanLength: null,
		cvLength: null,
		lag1Autocorrelation: null,
		shortShare: null,
		longShare: null,
		statements: 0,
	};
	const amplitude: Amplitude = fractal?.amplitude ?? { graphRadius: null, words: null };
	const sentenceRhythm: SentenceRhythm = fractal?.sentenceRhythm ?? {
		sentences: 0,
		skippedFragments: 0,
		meanLength: null,
		cvLength: null,
		lag1Autocorrelation: null,
		shortShare: null,
		longShare: null,
		statements: 0,
	};
	const radial = fractal?.ngrams?.byRadialDistance ?? null;
	const sentence = summariseSentenceScaling(fractal);
	const influence = readInfluence(fractal);
	return {
		signature: composeSignature(everything?.text_type),
		structure: {
			modularity: input.modularity ?? null,
			diversity_stats: diversity,
			degree_distribution: degreeDistribution,
			readings: readStructure(diversity),
			degreeReadings: readDegreeDistribution(degreeDistribution),
		},
		network_dynamics: networkDynamics,
		readings: withExperimentalReadings(interpretNetworkDynamics(networkDynamics), {
			radialScales: radial ? readScales(radial) : null,
			radialSpectrum: radial ? readMultifractal(radial) : null,
			sentenceScales: sentence?.readings.scales ?? null,
			sentenceSpectrum: sentence?.readings.multifractal ?? null,
			rankScales: influence?.scales ?? null,
			rankSpectrum: influence?.multifractal ?? null,
			amplitude: rekey(readAmplitude(amplitude.words), AMPLITUDE_NAMES),
			rhythm: rekey(readSentenceRhythm(sentenceRhythm), RHYTHM_NAMES),
		}),
		ai_likeness: estimateAiLikeness({
			sentenceRhythm: full?.sentenceRhythm ?? emptyRhythm,
			amplitude: full?.amplitude ?? { graphRadius: null, words: null },
			fractal: full,
		}),
		notes: NOTES,
	};
}
