export interface GraphNode {
	id: string;
	label: string;
	degree: number;
	bc: number; // betweenness centrality
	community: number;
	x: number;
	y: number;
	weighedDegree: number;
}

export interface GraphEdge {
	source: string;
	target: string;
	id: string;
	weight: number;
}

export interface TopCluster {
	community: string;
	nodes: Array<{
		nodeName: string;
		degree: number;
		bc: number;
	}>;
	statements?: number[];
	statementIds?: number[];
	topStatementId: number;
	aiName?: string;
}

export interface GraphGap {
	source: string;
	target: string;
	weight: number;
	concepts: string[];
}

export interface Statement {
	id?: number;
	content?: string;
	contextId?: number;
	categories?: string[];
	createdAt?: string;
	sortId?: number;
	statementHashtags?: string[];
	statementCommunities?: string[];
	topStatementCommunity?: string;
	topStatementOfCommunity?: string;
	similarityScore?: number;
}

export interface StatementsOutput {
	statements?: Statement[];
}

export interface StatementsSearchOutput {
	statements?: string[];
	dotGraphByCluster?: any;
	userName?: string;
	graphNames?: string[];
	graphUrls?: string[];
	error?: string;
}

export interface StatementStringsOutput {
	statements?: string[];
}

/**
 * Fractal variability of the discourse, computed by the backend together with
 * diversity_stats (same addstats gate) and attached to the graph attributes.
 * Three path levels x two measures (byStepLength, byRadialDistance), each a
 * DFA scaling exponent (alpha) with a label and optional multifractal spectrum:
 *   statements — one point per statement, at its graph coordinates
 *   words      — one point per word occurrence, at its node position
 *   ngrams     — one point per window of 4 consecutive words (step 1), at their
 *                mean position: the word path smoothed by a moving average
 * Each measure is null when its path has fewer than 64 steps. A fourth level
 * is not a path and has a single measure, byWords, with no byStepLength /
 * byRadialDistance:
 *   sentenceLength — the word count of every sentence, in order (the classic
 *                    sentence-length series of fractal linguistics); byWords
 *                    is null under 64 sentences
 * Older backends omit the ngrams and sentenceLength levels entirely.
 */
export interface FractalScaling {
	n: number;
	alphaBounded: number;
	alphaLabel: string;
	alpha1: number;
	alpha1Label: string;
	alpha2: number;
	alpha2Label: string;
	multifractal: {
		label: string;
		source?: string;
		significant?: boolean;
		z?: number;
		p?: number;
		width: number;
		q: number[];
		hq: number[];
		hCurveSlope: number;
		hCurveCurvature: number;
		hCurveNonlinearity: number;
		hMinLocation: number;
	} | null;
}

/**
 * One DFA-fitted series inside network_dynamics.fractal_variability. By default
 * the API returns series_length plus the exponents listed for that series;
 * with fractalExperimental=true it returns all eight fields.
 * dfa_alpha_global is fitted over scales 4 to N/4, dfa_alpha1 over 4 to 16,
 * dfa_alpha2 over 16 to N/4.
 */
export interface DfaSeriesBlock {
	series_length: number;
	dfa_alpha_global?: number | null;
	dfa_alpha_global_label?: string | null;
	dfa_alpha1?: number | null;
	dfa_alpha1_label?: string | null;
	dfa_alpha2?: number | null;
	dfa_alpha2_label?: string | null;
	multifractal?: FractalScaling["multifractal"];
}

/**
 * graph.attributes.network_dynamics: how a text moves through its concept graph
 * and how its sentences are paced. Present when the graph is built with
 * statistics. Three kinds of measure, kept apart by name:
 *
 *   fractal_variability         DFA scaling exponents, one block per series
 *   node_graph_path_amplitude   plain statistics of the node path through the
 *                               graph layout, distances divided by the graph
 *                               radius (RMS node distance from the centroid)
 *   sentence_rhythm             plain statistics of sentence length in the
 *                               source text; no graph involved
 *
 * Fields marked optional are returned only with fractalExperimental=true.
 */
/**
 * The backend's diagnosis of how a text moves through its graph: one of four
 * names from two questions, whether the text has a core (structure) and
 * whether it stays where it goes (memory, from the DFA exponents). Computed by
 * the backend so every client shows the same name; never recomputed here.
 */
export interface TextType {
	label: "deep dive" | "refrain" | "chapters" | "sweep" | null;
	description: string | null;
	has_core: boolean | null;
	structure: "biased" | "focused" | "diversified" | "dispersed" | null;
	stays_where_it_goes: boolean | null;
	/** "memory": judged from the DFA exponents; "movement": too short for them, judged from step size */
	basis: "memory" | "movement" | null;
	/** mean distance of the exponents from their corpus medians, in standard deviations; above 0 = stays */
	memory_score: number | null;
	confidence: "clear" | "borderline" | null;
}

export interface NetworkDynamics {
	/** absent from a backend that does not compute it yet */
	text_type?: TextType | null;
	fractal_variability: {
		/** distance from the path centroid, on 4-node windows of the node path */
		ngram4_graph_radial_distance: DfaSeriesBlock | null;
		/** words per sentence, in reading order; null under 64 sentences */
		sentence_word_count: DfaSeriesBlock | null;
		/** sentences found, reported even when sentence_word_count is null */
		sentence_word_count_series_available: number;
		/** rank-normalised betweenness of each node, in reading order */
		node_betweenness_rank: DfaSeriesBlock | null;
	};
	node_graph_path_amplitude: {
		graph_radius_rms?: number | null;
		steps: number;
		mean_step_relative_to_graph_radius: number | null;
		step_cv?: number | null;
		step_lag1_autocorrelation?: number | null;
		/** share of steps whose two ends sit in different topic clusters */
		cross_cluster_step_share: number | null;
		cluster_dwell_cv?: number | null;
		mean_radial_distance_relative_to_graph_radius: number | null;
		radial_distance_cv: number | null;
	} | null;
	sentence_rhythm: {
		/** sentences counted from prose-like statements only (12+ words) */
		prose_sentences: number;
		prose_statements?: number;
		skipped_fragments_under_12_words: number;
		mean_words_per_sentence: number | null;
		words_per_sentence_cv?: number | null;
		words_per_sentence_lag1_autocorrelation?: number | null;
		share_under_8_words: number | null;
		share_over_30_words: number | null;
	};
}

export interface FractalSeries {
	/** No longer returned by the backend for any level; optional so older responses parse. */
	byStepLength?: FractalScaling | null;
	byRadialDistance: FractalScaling | null;
}

/**
 * How far and how unevenly a path moves through the graph, as opposed to the
 * shape of the sequence the exponents describe. Every distance is in units of
 * graphRadius, so graphs of different sizes compare. Computed by the backend
 * (src/graph/fractalVariability.js); this server only reads it.
 */
export interface AmplitudeStats {
	/** steps in the path */
	n: number;
	/** mean step length in graph radii */
	meanStep: number | null;
	/** coefficient of variation of the step length: burstiness of the movement */
	cvStep: number | null;
	/** lag-1 autocorrelation of the step length: do big moves follow big moves? */
	lag1Autocorrelation: number | null;
	/** share of steps landing in a different cluster; null when too few steps have a community at both ends */
	crossClusterShare: number | null;
	/** coefficient of variation of the gaps between crossings: ~1 random, <0.7 regular, >1.3 bursty */
	crossClusterRunCV: number | null;
	/** mean distance from the path centroid, in graph radii */
	meanRadial: number | null;
	cvRadial: number | null;
}

export interface Amplitude {
	/** RMS node distance from the node centroid: the unit the fields above are in */
	graphRadius: number | null;
	/**
	 * Word level only. medianStep, p95Step, rmssdStep and the whole
	 * statement-level block were measured against a 115-text corpus and
	 * removed: the first three duplicate meanStep and cvStep (r >= 0.87) and
	 * the statement block lost a head-to-head with this one on every
	 * comparable field.
	 */
	words: AmplitudeStats | null;
	statements?: AmplitudeStats | null;
}

/**
 * Burstiness of the source text itself, no graph involved. Statements under
 * the backend's PROSE_MIN_WORDS are skipped as fragments (headings, menu
 * items, captions) and counted in skippedFragments.
 */
export interface SentenceRhythm {
	sentences: number;
	skippedFragments: number;
	meanLength: number | null;
	/** coefficient of variation of sentence length in words: the classic burstiness */
	cvLength: number | null;
	lag1Autocorrelation: number | null;
	/** share of sentences under 8 words */
	shortShare: number | null;
	/** share of sentences over 30 words */
	longShare: number | null;
	/** how many prose-like statements the sentences were taken from */
	statements: number;
}

/**
 * Internal reading shape. The API returns NetworkDynamics (above); the signature
 * readers in utils/textSignature.ts convert it to this shape so that their
 * band logic did not have to be rewritten when the public names changed.
 */
export interface FractalVariability {
	/**
	 * The backend now fits only ngrams.byRadialDistance. The word level and
	 * the n-gram step series were removed: with text length controlled for,
	 * their exponents fall to chance or flip direction between AI groups.
	 */
	words?: FractalSeries;
	ngrams?: FractalSeries;
	/**
	 * The statement level was analysed and is gone: it needed 64 statements and
	 * had them for 14 of 78 human texts, its step exponent flipped direction
	 * between AI groups, and the n-gram level beat it on the same texts.
	 * Optional so an older backend's response still parses.
	 */
	statements?: FractalSeries;
	/**
	 * Amplitude and sentence rhythm, computed by the backend alongside the
	 * exponents. This server used to rebuild the paths and compute these
	 * itself, which forced it to request uncompacted graphs and statements.
	 */
	amplitude?: Amplitude;
	sentenceRhythm?: SentenceRhythm;
	/**
	 * DFA over the sequence of sentence lengths. `sentences` is the series
	 * length and is always present; `byWords` is null under 64 sentences,
	 * which is about half of normal prose. Read the exponent against texts of
	 * similar length: the measure survives a length control but its
	 * availability does not.
	 */
	sentenceLength?: { sentences: number; byWords: FractalScaling | null };
	/**
	 * Influence of the current word, one value per word occurrence of the word
	 * path: node betweenness, rank-normalised to [0, 1]. Rank rather than raw,
	 * because raw betweenness is spikes at the hub concepts and a fit over it
	 * reads the spikes rather than the ordering. The multifractal spectrum,
	 * when requested, runs on this series. Null under 64 word occurrences;
	 * omitted by older backends.
	 *
	 * byBetweenness and byDegree were here and are gone: neither separated
	 * authored from generated text in a direction that held across both AI
	 * groups, and together they were two thirds of this block's payload. They
	 * stay optional in this type so a response from an older backend still
	 * parses.
	 */
	influence?: {
		byBetweennessRank: FractalScaling | null;
		byBetweenness?: FractalScaling | null;
		byDegree?: FractalScaling | null;
	};
}

/**
 * Degree distribution of the WHOLE co-occurrence network before the node cap
 * (graph.attributes.degree_distribution, on every graph, stats or not): how
 * concentrated connectivity is. gini: 0 every node has the same degree, 1 one
 * hub holds all connections. tail: maximum-likelihood power-law exponent over
 * the top nodes, null under 50 nodes. A descriptor of how heavy the tail is,
 * never a scale-free test: word networks are heavy-tailed for any text.
 */
export interface DegreeDistribution {
	nodes: number;
	edges: number;
	histogram: Array<[number, number]>;
	gini: number;
	tail: { alpha: number; xmin: number; n: number; total: number } | null;
	/** set by this server when the histogram was trimmed for the response */
	histogramTruncated?: boolean;
}

export interface GraphResponse {
	statements?: Statement[];
	graph?: {
		graphologyGraph: {
			attributes: {
				modularity: number;
				top_nodes: string[];
				top_clusters?: TopCluster[];
				gaps: GraphGap[];
				dotGraphByCluster?: any;
				diversity_stats?: any;
				network_dynamics?: NetworkDynamics;
				degree_distribution?: DegreeDistribution;
				top_influential_nodes?: Array<{
					node: string;
					degree: number;
					bc: number;
				}>;
			};
			nodes: GraphNode[];
			edges: GraphEdge[];
		};
		statementHasthags: any[];
	};
	graphSummary?: string;
	extendedGraphSummary?: {
		contentGaps?: string[];
		insightClusters?: string[];
		mainTopics?: string[];
		mainTopicNames?: string[];
		mainConcepts?: string[];
		topRelations?: string[];
		topBigrams?: string[];
		topInfluentialNodes?: Array<{
			node: string;
			degree: number;
			bc: number;
		}>;
		topicsToDevelop?: string[];
		conceptualGateways?: string[];
		conceptualGatewaysGraph?: string[];
		diversityStatistics?: {
			modularity: string;
			diversity_score: string;
			modularity_score: string;
			too_focused_on_top_nodes: boolean;
			too_focused_on_top_clusters: boolean;
			ratio_of_top_nodes_influence_by_betweenness: number;
			top_nodes_entropy: number;
			ratio_of_top_cluster_influence_by_betweenness: number;
			total_clusters: number;
			fair_influence_by_cluster: number;
		};
	};
	userName?: string;
	graphName?: string;
	graphUrl?: string;
	isPublic?: boolean;
	aiAdvice?: {
		text: string;
		finish_reason?: string;
	}[];
	// Returned by the /aiAdvice endpoint when saveToGraphAndRedirect is true
	redirectUrl?: string;
	// Returned by the /aiAdvice endpoint when saveToGraphAndRedirect is false
	// (raw AI output; each choice's `text` is set to message.content server-side)
	choices?: {
		message?: { content?: string };
		text?: string;
	}[];
	error?: string;
}

export interface SummaryOutput {
	summary?: string;
}

export interface InsightsOutput {
	contentGaps?: string[];
	insightClusters?: string[];
	mainTopics?: string[];
	mainConcepts?: string[];
	conceptsToDevelop?: string[];
	topKeywordCombinations?: string[];
}

export interface SearchResponse {
	entriesAdded?: { ids: string[]; texts: string[] };
	graph?: {
		graphologyGraph: {
			attributes: {
				modularity: number;
				top_nodes: string[];
				top_clusters?: TopCluster[];
				gaps: GraphGap[];
				dotGraphByCluster?: any;
				diversity_stats?: any;
				network_dynamics?: NetworkDynamics;
				degree_distribution?: DegreeDistribution;
				top_influential_nodes?: Array<{
					node: string;
					degree: number;
					bc: number;
				}>;
			};
			nodes: GraphNode[];
			edges: GraphEdge[];
		};
		statementHasthags: any[];
	};
	userName?: string;
	graphUrls?: string[];
	graphNames?: string[];
	error?: string;
}

export interface KnowledgeGraphOutput {
	statistics: {
		modularity: number;
		diversity_stats?: any;
		network_dynamics?: NetworkDynamics;
		degree_distribution?: DegreeDistribution;
		nodeCount?: number;
		edgeCount?: number;
		clusterCount?: number;
	};
	graphSummary?: string;
	contentGaps?: string[];
	insightClusters?: string[];
	mainTopicalClusters?: string[];
	mainConcepts?: string[];
	topInfluentialNodes?: Array<{
		node: string;
		degree: number;
		bc: number;
	}>;
	conceptualGateways?: string[];
	topRelations?: string[];
	topBigrams?: string[];
	statements?: Array<Statement>;
	knowledgeGraph?: any;
	knowledgeGraphByCluster?: any;
	topClusters?: any;
	userName?: string;
	graphName?: string;
	graphUrl?: string;
	isPublic?: boolean;
}

export interface GapsOutput {
	contentGaps?: string[];
	insightClusters?: string[];
}

export interface TopicsOutput {
	topicalClusters?: string[];
	topicalClusterSummaries?: string[];
}

export interface OntologyGraphOutput {
	/** 'prompt' | 'text' | 'graph' — where the ontology was generated from. */
	source?: string;
	chunksTotal?: number;
	chunksProcessed?: number;
	// Core
	saved?: boolean;
	message?: string;
	graphName?: string;
	graphUrl?: string; // the owner's /edit link (same as editUrl)
	editUrl?: string;
	viewUrl?: string; // read-only page, for sharing
	// When not saved (preview): the generated ontology statements
	ontologyStatements?: string[];
	// The raw LLM completions, one per item (for analyze_llm_results); returned when includeStatements is true, whether or not the graph is saved
	llmStatements?: string[];
	// Optional graph + analytics (from a follow-up /graphAndStatements call)
	statistics?: {
		modularity: number;
		diversity_stats?: any;
		network_dynamics?: NetworkDynamics;
		degree_distribution?: DegreeDistribution;
		nodeCount?: number;
		edgeCount?: number;
		clusterCount?: number;
	};
	graphSummary?: string;
	contentGaps?: string[];
	insightClusters?: string[];
	mainTopicalClusters?: string[];
	mainConcepts?: string[];
	topInfluentialNodes?: Array<{
		node: string;
		degree: number;
		bc: number;
	}>;
	conceptualGateways?: string[];
	topRelations?: string[];
	topBigrams?: string[];
	topClusters?: any;
	knowledgeGraph?: any;
	knowledgeGraphByCluster?: any;
}

export interface KeywordsOutput {
	keywords?: string[];
}

export interface TopicNamesOutput {
	topicNames?: string[];
}

export interface GraphOverview {
	textOverview?: string;
}

export interface ResearchQuestionsOutput {
	/** The clusters the AI bridged, per gap depth (see the tool's `optimize` input). */
	insightClusters?: string[];
	questions?: string[];
	graphSummary?: string;
	extendedGraphSummary?: {
		contentGaps?: string[];
		insightClusters?: string[];
		mainTopics?: string[];
		mainConcepts?: string[];
		conceptualGateways?: string[];
		topRelations?: string[];
		topBigrams?: string[];
	};
}

export interface GraphRagOutput {
	retrievedStatements?: Array<{
		content: string;
		categories?: string[];
		topStatementCommunity?: string;
		topStatementOfCommunity?: string;
		similarityScore?: number;
	}>;
	graphSummary?: string;
	contentGaps?: string[];
	insightClusters?: string[];
	mainTopicalClusters?: string[];
	mainTopicNames?: string[];
	mainConcepts?: string[];
	topRelations?: string[];
	topInfluentialNodes?: Array<{
		node: string;
		degree: number;
		bc: number;
	}>;
	topBigrams?: string[];
	topicsToDevelop?: string[];
	conceptualGateways?: string[];
	conceptualGatewaysGraph?: string[];
	graph?: any;
	userName?: string;
	graphName?: string;
	graphUrl?: string;
	isPublic?: boolean;
}

export interface ResearchIdeasOutput {
	/** The clusters the AI bridged, per gap depth (see the tool's `optimize` input). */
	insightClusters?: string[];
	ideas?: string[];
	graphSummary?: string;
	extendedGraphSummary?: {
		contentGaps?: string[];
		insightClusters?: string[];
		mainTopics?: string[];
		mainConcepts?: string[];
		conceptualGateways?: string[];
		topRelations?: string[];
		topBigrams?: string[];
	};
}

export interface LatentConceptsOutput {
	ideas?: string[];
	latentConceptsToDevelop?: string[];
	latentConceptsRelations?: string[];
}

export interface LatentTopicsOutput {
	ideas?: string[];
	mainTopics?: string[];
	latentTopicsToDevelop?: string[];
}

export interface ResponsesOutput {
	/** The clusters the AI bridged, per gap depth (see the tool's `optimize` input). */
	insightClusters?: string[];
	responses?: string[];
	graphSummary?: string;
	extendedGraphSummary?: {
		contentGaps?: string[];
		insightClusters?: string[];
		mainTopics?: string[];
		mainConcepts?: string[];
		conceptualGateways?: string[];
		topRelations?: string[];
		topBigrams?: string[];
	};
}

export interface OptimizeTextOutput {
	suggestions?: string[];
	mainTopicalClusters?: string[];
	contentGaps?: string[];
	insightClusters?: string[];
	mainConcepts?: string[];
	topicsToDevelop?: string[];
	conceptualGateways?: string[];
	topRelations?: string[];
	topKeywordCombinations?: string[];
	diversity_stats?: any;
	network_dynamics?: NetworkDynamics;
	degree_distribution?: DegreeDistribution;
	diversityStatistics?: {
		modularity: string;
		diversity_score: string;
		modularity_score: string;
		too_focused_on_top_nodes: boolean;
		too_focused_on_top_clusters: boolean;
		ratio_of_top_nodes_influence_by_betweenness: number;
		top_nodes_entropy: number;
		ratio_of_top_cluster_influence_by_betweenness: number;
		total_clusters: number;
		fair_influence_by_cluster: number;
	};
}

export interface InsightsOutput {
	summary?: string;
	topics?: Array<{
		name: string;
		concepts: string[];
	}>;
	gaps?: Array<{
		description: string;
		concepts: [string, string];
		bridges?: string[];
	}>;
	questions?: string[];
	keyInsights?: string[];
}

export interface SearchOutput {
	results?: Array<{ id: string; title: string; url: string }>;
}

export interface FetchOutput {
	id: string;
	title: string;
	text: string;
	url: string;
}

export interface ToolHandlerContext {
	progressToken?: string | number;
	sendNotification?: (notification: any) => Promise<void>;
	_meta?: {
		progressTotal?: number;
	};
}

// ---------------------------------------------------------------------------
// Per-invocation context handed to tool handlers by wrapHandler (src/index.ts)
// ---------------------------------------------------------------------------

export interface ElicitRequestParams {
	message: string;
	requestedSchema: {
		type: "object";
		properties: Record<string, Record<string, unknown>>;
		required?: string[];
	};
}

export interface ElicitResultLike {
	action: "accept" | "decline" | "cancel";
	content?: Record<string, unknown>;
}

export interface ToolExtra {
	progressToken?: string | number;
	sendNotification?: (notification: any) => Promise<void>;
	/** Server-initiated user prompt (MCP elicitation); undefined when unavailable. */
	elicit?: (params: ElicitRequestParams) => Promise<ElicitResultLike>;
	/** Capabilities the connected client declared at initialize. */
	clientCapabilities?: { elicitation?: object; [key: string]: unknown };
	/** Client name from initialize (e.g. "claude-ai", "cursor"). */
	clientName?: string;
}
