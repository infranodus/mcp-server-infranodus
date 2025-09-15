import {
	GraphResponse,
	KnowledgeGraphOutput,
	GapsOutput,
	GraphOverview,
	TopicsOutput,
	InsightsOutput,
	ResearchQuestionsOutput,
	ResponsesOutput,
} from "../types/index.js";

export function transformToStructuredOutput(
	data: GraphResponse,
	includeGraph: boolean = false,
	includeNodesAndEdges: boolean = false
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
			output.topClusters = graph.attributes.top_clusters;
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

export function generateResearchQuestions(
	data: GraphResponse
): ResearchQuestionsOutput {
	const researchQuestions: ResearchQuestionsOutput = {};

	if (data.aiAdvice) {
		researchQuestions.questions = data.aiAdvice;
	}

	return researchQuestions;
}

export function generateResponses(data: GraphResponse): ResponsesOutput {
	const responses: ResponsesOutput = {};

	if (data.aiAdvice) {
		responses.responses = data.aiAdvice;
	}

	return responses;
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
