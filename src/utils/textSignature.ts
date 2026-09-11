/**
 * Text signature: the structural and rhythmic profile of a text, built from
 * the graph statistics the backend already returns (diversity_stats,
 * fractal_variability) plus what this module derives from the raw graph —
 * the amplitude of the text's movement through its own concept network
 * (mean step, burstiness, cluster crossings) and the classic sentence-length
 * rhythm of the source text.
 *
 * Every number gets a one-sentence plain-language reading, the readings are
 * combined into a named signature (structure x rhythm), and a final layer
 * weighs the rhythm evidence into a hedged AI-likeness estimate. The
 * thresholds are provisional: they come from the DFA literature and from the
 * backend's own reading table (infranodus-backend/docs/fractal-variability.md),
 * not from a labelled corpus. Everything is pure so it can be unit-tested.
 */
import type { FractalScaling, FractalSeries, FractalVariability } from "../types/index.js";

// ---------------------------------------------------------------------------
// Input shapes: the raw (non-compacted) graph response
// ---------------------------------------------------------------------------

export interface RawNode {
	key: string;
	attributes?: { x?: number; y?: number; z?: number; community?: number | string };
}

export interface RawStatement {
	content?: string;
	sortId?: number;
	statementHashtags?: string[];
	topStatementCommunity?: string | number;
	graphCoordinates?: { x?: number; y?: number; z?: number } | null;
}

interface Point {
	x: number;
	y: number;
	z: number;
}

// ---------------------------------------------------------------------------
// Basic statistics
// ---------------------------------------------------------------------------

const round = (value: number | null, digits = 3): number | null =>
	value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));

const mean = (values: number[]): number =>
	values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;

const std = (values: number[]): number => {
	if (values.length < 2) return NaN;
	const m = mean(values);
	return Math.sqrt(mean(values.map((v) => (v - m) * (v - m))));
};

const quantile = (values: number[], q: number): number => {
	if (!values.length) return NaN;
	const sorted = [...values].sort((a, b) => a - b);
	const pos = (sorted.length - 1) * q;
	const lo = Math.floor(pos);
	const hi = Math.ceil(pos);
	return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

/** Lag-1 autocorrelation; null when the series is constant or too short. */
const lag1Autocorrelation = (values: number[]): number | null => {
	if (values.length < 8) return null;
	const m = mean(values);
	let num = 0;
	let den = 0;
	for (let i = 0; i < values.length; i++) {
		den += (values[i] - m) ** 2;
		if (i + 1 < values.length) num += (values[i] - m) * (values[i + 1] - m);
	}
	return den > 0 ? num / den : null;
};

const isFinitePoint = (p: unknown): p is { x: number; y: number; z?: number } =>
	p != null &&
	typeof p === "object" &&
	Number.isFinite((p as { x?: unknown }).x) &&
	Number.isFinite((p as { y?: unknown }).y);

const toPoint = (p: { x: number; y: number; z?: number }): Point => ({
	x: p.x,
	y: p.y,
	z: Number.isFinite(p.z) ? (p.z as number) : 0,
});

const distance = (a: Point, b: Point): number =>
	Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);

const centroid = (points: Point[]): Point => ({
	x: mean(points.map((p) => p.x)),
	y: mean(points.map((p) => p.y)),
	z: mean(points.map((p) => p.z)),
});

// Hashtags occasionally arrive with a leading "#"; node keys never do.
const stripHash = (key: string): string => (key.startsWith("#") ? key.slice(1) : key);

// ---------------------------------------------------------------------------
// Amplitude: how far and how unevenly the text moves through its graph
// ---------------------------------------------------------------------------

export interface AmplitudeStats {
	/** number of steps in the path */
	n: number;
	/** mean step length in units of the graph radius (RMS node distance from the node centroid) */
	meanStep: number | null;
	medianStep: number | null;
	p95Step: number | null;
	/** coefficient of variation of the step length: the burstiness of the movement */
	cvStep: number | null;
	/** lag-1 autocorrelation of the step length: do big moves follow big moves? */
	lag1Autocorrelation: number | null;
	/** share of steps that land in a different topical cluster */
	crossClusterShare: number | null;
	/** coefficient of variation of the gaps between cluster crossings: ~1 random, <0.7 regular, >1.3 bursty */
	crossClusterRunCV: number | null;
	/** mean distance from the path centroid, in graph-radius units */
	meanRadial: number | null;
	cvRadial: number | null;
}

interface PathPoint {
	point: Point;
	community: string | null;
}

/** Root-mean-square distance of the nodes from their centroid: the scale unit. */
export function graphRadius(nodes: RawNode[]): number | null {
	const points = nodes
		.map((n) => n.attributes)
		.filter(isFinitePoint)
		.map(toPoint);
	if (points.length < 2) return null;
	const c = centroid(points);
	const radius = Math.sqrt(mean(points.map((p) => distance(p, c) ** 2)));
	return radius > 0 ? radius : null;
}

function amplitudeOfPath(path: PathPoint[], radius: number | null): AmplitudeStats | null {
	if (path.length < 2 || !radius) return null;
	const points = path.map((p) => p.point);
	const steps: number[] = [];
	for (let i = 0; i + 1 < points.length; i++) steps.push(distance(points[i], points[i + 1]) / radius);
	const c = centroid(points);
	const radial = points.map((p) => distance(p, c) / radius);

	// Cluster crossings: a step whose endpoints belong to different clusters.
	let crossings: number[] | null = [];
	let known = 0;
	for (let i = 0; i + 1 < path.length; i++) {
		const a = path[i].community;
		const b = path[i + 1].community;
		if (a == null || b == null) continue;
		known++;
		if (a !== b) crossings.push(i);
	}
	if (known < steps.length / 2) crossings = null;
	const gaps: number[] = [];
	if (crossings) for (let i = 1; i < crossings.length; i++) gaps.push(crossings[i] - crossings[i - 1]);

	const stepMean = mean(steps);
	const radialMean = mean(radial);
	return {
		n: steps.length,
		meanStep: round(stepMean),
		medianStep: round(quantile(steps, 0.5)),
		p95Step: round(quantile(steps, 0.95)),
		cvStep: stepMean > 0 ? round(std(steps) / stepMean) : null,
		lag1Autocorrelation: round(lag1Autocorrelation(steps)),
		crossClusterShare: crossings ? round(crossings.length / known) : null,
		crossClusterRunCV: gaps.length >= 5 && mean(gaps) > 0 ? round(std(gaps) / mean(gaps)) : null,
		meanRadial: round(radialMean),
		cvRadial: radialMean > 0 ? round(std(radial) / radialMean) : null,
	};
}

export interface Amplitude {
	graphRadius: number | null;
	statements: AmplitudeStats | null;
	words: AmplitudeStats | null;
}

/**
 * Rebuild the statement and word paths the backend ran DFA on (statements at
 * graphCoordinates, words at their node positions in statementHashtags order)
 * and measure their amplitude.
 */
export function computeAmplitude(nodes: RawNode[], statements: RawStatement[]): Amplitude {
	const radius = graphRadius(nodes);
	const nodeByKey = new Map<string, RawNode>();
	for (const node of nodes) nodeByKey.set(node.key, node);

	const ordered = [...statements].sort((a, b) => (a.sortId ?? 0) - (b.sortId ?? 0));

	const statementPath: PathPoint[] = [];
	const wordPath: PathPoint[] = [];
	for (const statement of ordered) {
		if (isFinitePoint(statement.graphCoordinates)) {
			statementPath.push({
				point: toPoint(statement.graphCoordinates),
				community: statement.topStatementCommunity != null ? String(statement.topStatementCommunity) : null,
			});
		}
		for (const tag of statement.statementHashtags ?? []) {
			const attributes = nodeByKey.get(stripHash(tag))?.attributes;
			const community = attributes?.community;
			if (!attributes || !isFinitePoint(attributes)) continue;
			wordPath.push({
				point: toPoint(attributes),
				community: community != null ? String(community) : null,
			});
		}
	}

	return {
		graphRadius: round(radius),
		statements: amplitudeOfPath(statementPath, radius),
		words: amplitudeOfPath(wordPath, radius),
	};
}

// ---------------------------------------------------------------------------
// Sentence rhythm: the classic burstiness of the source text
// ---------------------------------------------------------------------------

export interface SentenceRhythm {
	/** sentences counted, from prose-like statements only */
	sentences: number;
	/** statements skipped as fragments (headings, menu items, captions): under PROSE_MIN_WORDS words */
	skippedFragments: number;
	meanLength: number | null;
	/** coefficient of variation of sentence length in words: the classic burstiness */
	cvLength: number | null;
	lag1Autocorrelation: number | null;
	/** share of sentences under 8 words */
	shortShare: number | null;
	/** share of sentences over 30 words */
	longShare: number | null;
	statements: { n: number; meanLength: number | null; cvLength: number | null };
}

const SENTENCE_SPLIT = /(?<=[.!?…])\s+(?=[^\s])/;
const ABBREVIATIONS = /\b(?:e\.g|i\.e|etc|vs|dr|mr|mrs|ms|prof|st|no|fig|cf)\.$/i;

/** Split one statement into sentences; joins fragments cut at a known abbreviation. */
export function splitSentences(text: string): string[] {
	const pieces = text.split(SENTENCE_SPLIT);
	const out: string[] = [];
	for (const piece of pieces) {
		const trimmed = piece.trim();
		if (!trimmed) continue;
		if (out.length && ABBREVIATIONS.test(out[out.length - 1])) out[out.length - 1] += " " + trimmed;
		else out.push(trimmed);
	}
	return out;
}

const wordCount = (text: string): number => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

// Statements shorter than this are treated as fragments (headings, menu
// items, list bullets, captions) and left out of the sentence rhythm: on a
// fetched web page they outnumber the prose and flatten every text to the
// same profile.
export const PROSE_MIN_WORDS = 12;

export function computeSentenceRhythm(statements: RawStatement[]): SentenceRhythm {
	const ordered = [...statements].sort((a, b) => (a.sortId ?? 0) - (b.sortId ?? 0));
	const lengths: number[] = [];
	const statementLengths: number[] = [];
	let skipped = 0;
	for (const statement of ordered) {
		const content = statement.content?.trim();
		if (!content) continue;
		const total = wordCount(content);
		if (total < PROSE_MIN_WORDS) {
			skipped++;
			continue;
		}
		statementLengths.push(total);
		for (const sentence of splitSentences(content)) {
			const n = wordCount(sentence);
			if (n > 0) lengths.push(n);
		}
	}
	const m = mean(lengths);
	const sm = mean(statementLengths);
	return {
		sentences: lengths.length,
		skippedFragments: skipped,
		meanLength: round(m, 1),
		cvLength: lengths.length >= 2 && m > 0 ? round(std(lengths) / m) : null,
		lag1Autocorrelation: round(lag1Autocorrelation(lengths)),
		shortShare: lengths.length ? round(lengths.filter((n) => n < 8).length / lengths.length) : null,
		longShare: lengths.length ? round(lengths.filter((n) => n > 30).length / lengths.length) : null,
		statements: {
			n: statementLengths.length,
			meanLength: round(sm, 1),
			cvLength: statementLengths.length >= 2 && sm > 0 ? round(std(statementLengths) / sm) : null,
		},
	};
}

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
// Composite signature: structure x rhythm
// ---------------------------------------------------------------------------

type Structure = "biased" | "focused" | "diversified" | "dispersed";
type GridRhythm = "alternating" | "random" | "fractal" | "blocks";

const SIGNATURE_GRID: Record<Structure, Record<GridRhythm, string>> = {
	biased: { alternating: "back-and-forth", random: "boilerplate", fractal: "deep dive", blocks: "monologue" },
	focused: { alternating: "comparison", random: "report", fractal: "essay", blocks: "treatise" },
	diversified: { alternating: "dialogue", random: "digest", fractal: "narrative", blocks: "anthology" },
	dispersed: { alternating: "ping-pong", random: "notes", fractal: "stream of consciousness", blocks: "drift" },
};

const SIGNATURE_SUMMARIES: Record<string, string> = {
	"back-and-forth": "one topic, argued from alternating sides",
	boilerplate: "one topic, listed rather than developed",
	"deep dive": "one theme, developed in layers that keep returning to it",
	monologue: "one theme, pursued in a straight line without return",
	comparison: "a main topic examined by alternating between its facets",
	report: "a main topic with its points listed one after another",
	essay: "an argument that circles its core and returns to it at every scale",
	treatise: "a main topic worked through in sections, each closed before the next",
	dialogue: "several topics taken in turns, as in a conversation",
	digest: "several topics with no path between them: a thread or a compilation",
	narrative: "several topics woven together and revisited at every scale",
	anthology: "several topics treated one after another in separate blocks",
	"ping-pong": "scattered fragments that alternate without settling",
	notes: "scattered fragments with no thread: a scratchpad",
	"stream of consciousness": "scattered fragments that nonetheless return to each other",
	drift: "scattered fragments that wander off and do not come back",
};

export interface Signature {
	label: string | null;
	structure: Structure | null;
	rhythm: GridRhythm | null;
	/** which fractal level the rhythm was read from */
	rhythmSource: "statements" | "words" | null;
	summary: string | null;
}

/** The headline series: statements when long enough, else words (never ngrams). */
export function headlineSeries(fractal: FractalVariability | null | undefined): {
	level: "statements" | "words" | null;
	series: FractalScaling | null;
} {
	if (fractal?.statements?.byStepLength && confidenceFor(fractal.statements.byStepLength.n) !== "indicative")
		return { level: "statements", series: fractal.statements.byStepLength };
	if (fractal?.words?.byStepLength) return { level: "words", series: fractal.words.byStepLength };
	if (fractal?.statements?.byStepLength) return { level: "statements", series: fractal.statements.byStepLength };
	return { level: null, series: null };
}

export function composeSignature(
	diversity: DiversityStats | null | undefined,
	fractal: FractalVariability | null | undefined,
): Signature {
	const score = diversity?.diversity_score?.toLowerCase();
	const structure = (score && score in SIGNATURE_GRID ? score : null) as Structure | null;
	const { level, series } = headlineSeries(fractal);
	const band = rhythmBand(series?.alphaBounded);
	const rhythm: GridRhythm | null = band === "persistent" ? "fractal" : band;
	const label = structure && rhythm ? SIGNATURE_GRID[structure][rhythm] : null;
	return {
		label,
		structure,
		rhythm,
		rhythmSource: level,
		summary: label ? SIGNATURE_SUMMARIES[label] : null,
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
	verdict: "leans generated" | "leans human" | "inconclusive";
	/** -1 (human-like) to +1 (generated-like) */
	score: number | null;
	confidence: "low" | "medium";
	evidence: Evidence[];
	caveats: string[];
}

const CAVEATS = [
	"This is a stylistic tendency read from rhythm and structure, not a detection result; never treat it as proof of authorship.",
	"The thresholds are heuristics from the DFA and stylometry literature. On a 50-page check against a commercial detector they caught only uniformly paced template text; AI-drafted pages that were edited or humanized read as human here.",
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

	// Classic burstiness: the strongest cheap signal.
	if (sentenceRhythm.cvLength != null && sentenceRhythm.sentences >= 10) {
		const cv = sentenceRhythm.cvLength;
		const direction = cv < 0.35 ? 1 : cv < 0.5 ? 0.3 : cv < 0.7 ? -0.5 : -1;
		evidence.push({
			signal: "sentence length variability (CV)",
			value: cv,
			direction,
			weight: 2,
			reading:
				direction > 0
					? "Uniform sentence lengths, the flat rhythm typical of generated text."
					: "Uneven sentence lengths, the bursty rhythm typical of human prose.",
		});
	}
	if (sentenceRhythm.shortShare != null && sentenceRhythm.sentences >= 20) {
		const share = sentenceRhythm.shortShare;
		const direction = share < 0.05 ? 0.5 : share > 0.15 ? -0.5 : 0;
		if (direction !== 0)
			evidence.push({
				signal: "share of short sentences",
				value: share,
				direction,
				weight: 0.5,
				reading: direction > 0 ? "Almost no short sentences." : "Short sentences are used freely.",
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
	const enough = evidence.length >= 3 && sentenceRhythm.sentences >= 30;
	const verdict: AiLikeness["verdict"] =
		score == null || !enough ? "inconclusive" : score >= 0.25 ? "leans generated" : score <= -0.25 ? "leans human" : "inconclusive";
	// Medium confidence only for a clear-cut profile with several agreeing
	// signals; anything near the middle stays low.
	const clearCut = score != null && Math.abs(score) >= 0.5;
	return {
		verdict,
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
		readings: Record<string, string | null> | null;
	};
	rhythm: {
		fractal_variability: FractalVariability | null;
		readings: {
			statements: LevelReadings | null;
			words: LevelReadings | null;
			ngrams: LevelReadings | null;
		};
	};
	amplitude: Amplitude & {
		readings: { statements: Record<string, string | null> | null; words: Record<string, string | null> | null };
	};
	sentence_rhythm: SentenceRhythm & { readings: Record<string, string | null> };
	ai_likeness: AiLikeness;
	notes: string[];
}

const NOTES = [
	"Fractal levels are not comparable with each other: the word level reads lowest and the n-gram level higher by construction. Compare a level only with the same level of another text.",
	"The n-gram level's alpha1 is inflated by its moving average; read its alphaBounded and alpha2 only.",
	"Amplitude is in units of the graph radius (RMS distance of the nodes from their centroid), so it is comparable across texts of different size.",
];

export function buildTextSignature(input: {
	modularity: number | null | undefined;
	diversity: DiversityStats | null | undefined;
	fractal: FractalVariability | null | undefined;
	nodes: RawNode[];
	statements: RawStatement[];
}): TextSignatureOutput {
	const fractal = input.fractal ?? null;
	const diversity = input.diversity ?? null;
	const amplitude = computeAmplitude(input.nodes, input.statements);
	const sentenceRhythm = computeSentenceRhythm(input.statements);
	return {
		signature: composeSignature(diversity, fractal),
		structure: {
			modularity: input.modularity ?? null,
			diversity_stats: diversity,
			readings: readStructure(diversity),
		},
		rhythm: {
			fractal_variability: fractal,
			readings: {
				statements: readLevel(fractal?.statements),
				words: readLevel(fractal?.words),
				ngrams: readLevel(fractal?.ngrams),
			},
		},
		amplitude: {
			...amplitude,
			readings: { statements: readAmplitude(amplitude.statements), words: readAmplitude(amplitude.words) },
		},
		sentence_rhythm: { ...sentenceRhythm, readings: readSentenceRhythm(sentenceRhythm) },
		ai_likeness: estimateAiLikeness({ sentenceRhythm, amplitude, fractal }),
		notes: NOTES,
	};
}
