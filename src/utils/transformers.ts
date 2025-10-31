import {
	GraphResponse,
	SearchResponse,
	KnowledgeGraphOutput,
	GapsOutput,
	GraphOverview,
	TopicsOutput,
	InsightsOutput,
	ResearchQuestionsOutput,
	ResearchIdeasOutput,
	ResponsesOutput,
	SearchOutput,
	FetchOutput,
	StatementsSearchOutput,
	KeywordsOutput,
	TopicNamesOutput,
	SummaryOutput,
	StatementStringsOutput,
	LatentConceptsOutput,
	LatentTopicsOutput,
} from "../types/index.js";

export function transformToStructuredOutput(
	data: GraphResponse,
	includeGraph: boolean = false,
	includeNodesAndEdges: boolean = false,
	buildingEntitiesGraph: boolean = false
): KnowledgeGraphOutput {
	const output: KnowledgeGraphOutput = {
		statistics: {
			modularity: 0,
			nodeCount: 0,
			edgeCount: 0,
			clusterCount: 0,
		},
	};

	if (data.graphSummary) {
		output.graphSummary = data.graphSummary;
	}

	if (data.extendedGraphSummary) {
		output.contentGaps = data.extendedGraphSummary.contentGaps;
		output.mainTopicalClusters = data.extendedGraphSummary.mainTopics;
		output.mainConcepts = data.extendedGraphSummary.mainConcepts;
		output.conceptualGateways = data.extendedGraphSummary.conceptualGateways;
		output.topRelations = data.extendedGraphSummary.topRelations;
		output.topBigrams = data.extendedGraphSummary.topBigrams;
	}

	if (data.graph?.graphologyGraph) {
		const graph = data.graph.graphologyGraph;

		// Statistics
		output.statistics = {
			modularity: graph.attributes?.modularity || 0,
			nodeCount: graph.nodes?.length || 0,
			edgeCount: graph.edges?.length || 0,
			clusterCount: graph.attributes?.top_clusters?.length || 0,
		};

		if (graph.attributes?.dotGraphByCluster) {
			output.knowledgeGraphByCluster = graph.attributes.dotGraphByCluster;
			delete graph.attributes.dotGraphByCluster;
		}

		if (graph.attributes?.top_clusters) {
			if (!buildingEntitiesGraph) {
				output.topClusters = graph.attributes.top_clusters;
			}
			delete graph.attributes.top_clusters;
		}

		// Include raw graph if requested
		if (includeGraph) {
			output.knowledgeGraph = graph;
		}

		// Include nodes and edges if requested
		if (includeGraph && !includeNodesAndEdges) {
			delete output.knowledgeGraph.nodes;
			delete output.knowledgeGraph.edges;
		}
	}

	// Statements
	if (data.statements) {
		output.statements = data.statements;
	}

	if (data.userName) {
		output.userName = data.userName;
	}

	if (data.graphName) {
		output.graphName = data.graphName;
	}

	if (data.graphUrl) {
		output.graphUrl = data.graphUrl;
	}

	return output;
}

export function generateGaps(data: GraphResponse): GapsOutput {
	const gaps: GapsOutput = {};

	if (data.extendedGraphSummary?.contentGaps) {
		gaps.contentGaps = data.extendedGraphSummary.contentGaps;
	}

	return gaps;
}

export function generateTextOverview(data: GraphResponse): GraphOverview {
	const graphOverview: GraphOverview = {};

	if (data.graphSummary) {
		graphOverview.textOverview = data.graphSummary;
	}

	return graphOverview;
}

export function generateTopics(data: GraphResponse): TopicsOutput {
	const topicalClusters: TopicsOutput = {};

	if (data.extendedGraphSummary?.mainTopics) {
		topicalClusters.topicalClusters = data.extendedGraphSummary.mainTopics;
	}

	return topicalClusters;
}

export function generateSummaryFromTopicsAndGaps(
	data: GraphResponse
): SummaryOutput {
	const summary: SummaryOutput = {};

	if (
		data.extendedGraphSummary?.mainTopics &&
		data.extendedGraphSummary?.contentGaps
	) {
		summary.summary =
			data.extendedGraphSummary.mainTopics.join("\n") +
			"\n\n" +
			data.extendedGraphSummary.contentGaps.join("\n");
	}

	return summary;
}

export function extractInsightsFromExtendedGraphSummary(
	data: GraphResponse
): InsightsOutput {
	const mainTopics = data.extendedGraphSummary?.mainTopics || [];
	const contentGaps = data.extendedGraphSummary?.contentGaps || [];
	const mainConcepts = data.extendedGraphSummary?.mainConcepts || [];
	const topKeywordCombinations = data.extendedGraphSummary?.topBigrams || [];
	const conceptsToDevelop = data.extendedGraphSummary?.conceptualGateways || [];

	return {
		mainTopics,
		contentGaps,
		mainConcepts,
		topKeywordCombinations,
		conceptsToDevelop,
	};
}

export function extractStatementStrings(
	data: GraphResponse
): StatementStringsOutput {
	const statements: StatementStringsOutput = {};

	if (data.statements) {
		statements.statements = data.statements.map((statement) => {
			const statementContent = statement.content;
			const statementCategories =
				statement.categories?.map((category) => category) || [];
			return `${statementContent} ${statementCategories.join(", ")}`;
		});
	}

	return statements;
}

export function generateKeywordsFromBigrams(
	data: GraphResponse
): KeywordsOutput {
	const keywords: KeywordsOutput = {};

	if (data.extendedGraphSummary?.topBigrams) {
		keywords.keywords = data.extendedGraphSummary.topBigrams;
	}

	return keywords;
}

export function generateTopicNames(data: GraphResponse): TopicNamesOutput {
	const topicNames: TopicNamesOutput = {};

	if (
		data.extendedGraphSummary?.mainTopicNames &&
		Array.isArray(data.extendedGraphSummary.mainTopicNames)
	) {
		const mainTopicNames = data.extendedGraphSummary.mainTopicNames.map(
			(topic) => {
				const topicName = topic.split(". ") ? topic.split(". ")[1] : topic;
				return topicName;
			}
		);
		topicNames.topicNames = mainTopicNames;
	}

	return topicNames;
}

export function generateResearchQuestions(
	data: GraphResponse
): ResearchQuestionsOutput {
	const researchQuestions: ResearchQuestionsOutput = { questions: [] };

	if (data.aiAdvice) {
		researchQuestions.questions = data.aiAdvice.map((advice) => advice.text);
	}

	return researchQuestions;
}

export function generateResearchIdeas(
	data: GraphResponse
): ResearchIdeasOutput {
	const researchIdeas: ResearchIdeasOutput = { ideas: [] };

	if (data.aiAdvice) {
		researchIdeas.ideas = data.aiAdvice.map((advice) => advice.text);
	}

	return researchIdeas;
}

export function generateResponses(data: GraphResponse): ResponsesOutput {
	const responses: ResponsesOutput = { responses: [] };

	if (data.aiAdvice) {
		responses.responses = data.aiAdvice.map((advice) => advice.text);
	}

	return responses;
}

export function extractLatentConceptsIdeas(
	data: GraphResponse
): LatentConceptsOutput {
	const latentConcepts: LatentConceptsOutput = { ideas: [] };

	if (data.aiAdvice) {
		latentConcepts.ideas = data.aiAdvice.map((advice) => advice.text);
	}

	if (data.extendedGraphSummary?.conceptualGateways) {
		latentConcepts.latentConceptsToDevelop =
			data.extendedGraphSummary.conceptualGateways;
	}

	if (data.extendedGraphSummary?.conceptualGatewaysGraph) {
		latentConcepts.latentConceptsRelations =
			data.extendedGraphSummary.conceptualGatewaysGraph;
	}

	return latentConcepts;
}

export function extractLatentTopicsIdeas(
	data: GraphResponse
): LatentTopicsOutput {
	const latentConcepts: LatentTopicsOutput = {};

	if (data.aiAdvice) {
		latentConcepts.ideas = data.aiAdvice.map((advice) => advice.text);
	}

	if (data.extendedGraphSummary?.mainTopics) {
		latentConcepts.mainTopics = data.extendedGraphSummary.mainTopics;
	}

	if (data.extendedGraphSummary?.topicsToDevelop) {
		latentConcepts.latentTopicsToDevelop =
			data.extendedGraphSummary.topicsToDevelop;
	}

	return latentConcepts;
}

export function generateSearchResult(
	data: SearchResponse,
	query: string
): SearchOutput {
	const results: SearchOutput = { results: [] };

	const userName = data.userName || "";

	const searchQuery = query || "";

	const searchResultsExist =
		data.graphUrls &&
		data.graphNames &&
		data.graphUrls.length > 0 &&
		data.graphNames.length > 0;

	if (searchResultsExist) {
		const graphNames = data.graphNames || [];
		results.results = data.graphUrls?.map((url, index) => ({
			id: `${userName}:${graphNames[index]}:${searchQuery}`,
			title: graphNames[index],
			url: url,
		}));
	}

	return results;
}

export function generateFetchResult(
	data: SearchResponse,
	query: string
): FetchOutput {
	const fetchResults: FetchOutput = { id: "", title: "", text: "", url: "" };

	const userName = data.userName || "";

	const searchQuery = query || "";

	const searchResultsExist =
		data.graphUrls &&
		data.graphNames &&
		data.graphUrls.length > 0 &&
		data.graphNames.length > 0;

	const searchResultsTextArray = data.entriesAdded?.texts;

	if (searchResultsExist) {
		const graphNames = data.graphNames || [];
		const graphUrls = data.graphUrls || [];
		fetchResults.id = `${userName}:${graphNames[0]}:${searchQuery}`;
		fetchResults.title = graphNames[0];
		fetchResults.text = searchResultsTextArray?.join("\n") || "";
		fetchResults.url = graphUrls[0];
	}

	return fetchResults;
}

export function extractStatementsFromGraphResponse(
	data: GraphResponse,
	memoryContextName: string
): StatementsSearchOutput {
	const results: StatementsSearchOutput = {
		statements: [],
		userName: "",
		graphNames: [],
		graphUrls: [],
	};

	if (data.statements) {
		results.statements = data.statements
			.map((statement) => statement.content)
			.filter((content): content is string => content !== undefined);
	}
	if (data.userName) {
		results.userName = data.userName;
	}
	if (data.graphName) {
		results.graphNames = [memoryContextName];
	}

	return results;
}

export function extractStatementsFromSearchResponse(
	data: SearchResponse
): StatementsSearchOutput {
	const results: StatementsSearchOutput = {
		statements: [],
		userName: "",
		graphNames: [],
		graphUrls: [],
	};

	const searchResultsExist =
		data.entriesAdded?.texts && data.entriesAdded?.texts.length > 0;

	if (data.userName) {
		results.userName = data.userName;
	}

	if (data.graphNames) {
		results.graphNames = data.graphNames;
	}

	if (data.graphUrls) {
		results.graphUrls = data.graphUrls;
	}

	if (data.error) {
		results.error = data.error;
	}

	const searchResultsTextArray = data.entriesAdded?.texts;

	if (searchResultsExist && searchResultsTextArray) {
		results.statements = searchResultsTextArray;
	}

	return results;
}

export function generateInsights(
	data: GraphResponse,
	insightType: string
): InsightsOutput {
	const insights: InsightsOutput = {};

	if (insightType === "all" || insightType === "summary") {
		insights.summary = data.graphSummary;
	}

	if (
		(insightType === "all" || insightType === "topics") &&
		data.graph?.graphologyGraph.attributes.top_clusters
	) {
		insights.topics = data.graph.graphologyGraph.attributes.top_clusters
			.slice(0, 7)
			.map((cluster) => ({
				name: cluster.aiName || `Topic ${cluster.community}`,
				concepts: cluster.nodes.slice(0, 10).map((n) => n.nodeName),
			}));
	}

	if (
		(insightType === "all" || insightType === "gaps") &&
		data.graph?.graphologyGraph.attributes.gaps
	) {
		insights.gaps = data.graph.graphologyGraph.attributes.gaps
			.slice(0, 7)
			.map((gap) => ({
				description: `Potential connection between "${gap.source}" and "${gap.target}"`,
				concepts: [gap.source, gap.target],
				bridges: gap.concepts,
			}));
	}

	if (insightType === "all" || insightType === "questions") {
		insights.questions = [];

		if (data.graph?.graphologyGraph.attributes.gaps) {
			data.graph.graphologyGraph.attributes.gaps.slice(0, 5).forEach((gap) => {
				insights.questions!.push(
					`How might "${gap.source}" relate to or influence "${gap.target}"?`
				);
			});
		}

		if (data.graph?.graphologyGraph.attributes.top_nodes) {
			const topNodes = data.graph.graphologyGraph.attributes.top_nodes.slice(
				0,
				3
			);
			topNodes.forEach((node) => {
				insights.questions!.push(
					`What role does "${node}" play in connecting different aspects of this topic?`
				);
			});
		}
	}

	// Generate key insights
	if (insightType === "all") {
		insights.keyInsights = [];

		if (data.graph?.graphologyGraph.attributes) {
			const attrs = data.graph.graphologyGraph.attributes;

			if (attrs.modularity > 0.4) {
				insights.keyInsights.push(
					"The text has well-defined, distinct topic clusters"
				);
			} else if (attrs.modularity < 0.2) {
				insights.keyInsights.push(
					"The text is highly interconnected with overlapping themes"
				);
			}

			if (attrs.gaps && attrs.gaps.length > 5) {
				insights.keyInsights.push(
					`Found ${attrs.gaps.length} potential connections between disparate topics`
				);
			}

			if (attrs.top_clusters && attrs.top_clusters.length > 0) {
				const dominantCluster = attrs.top_clusters[0];
				const statementCount =
					dominantCluster.statementIds?.length ||
					dominantCluster.statements?.length ||
					0;
				const dominanceRatio = statementCount / (data.statements?.length || 1);
				if (dominanceRatio > 0.5) {
					insights.keyInsights.push(
						`The text is strongly focused on "${
							dominantCluster.aiName || "one main topic"
						}"`
					);
				}
			}
		}
	}

	return insights;
}
