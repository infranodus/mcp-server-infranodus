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
			};
			nodes: GraphNode[];
			edges: GraphEdge[];
		};
		statementHasthags: any[];
	};
	graphSummary?: string;
	extendedGraphSummary?: {
		contentGaps?: string[];
		mainTopics?: string[];
		mainTopicNames?: string[];
		mainConcepts?: string[];
		topRelations?: string[];
		topBigrams?: string[];
		topicsToDevelop?: string[];
		conceptualGateways?: string[];
		conceptualGatewaysGraph?: string[];
	};
	userName?: string;
	graphName?: string;
	graphUrl?: string;
	isPublic?: boolean;
	aiAdvice?: {
		text: string;
		finish_reason?: string;
	}[];
	error?: string;
}

export interface SummaryOutput {
	summary?: string;
}

export interface InsightsOutput {
	contentGaps?: string[];
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
		nodeCount: number;
		edgeCount: number;
		clusterCount: number;
	};
	graphSummary?: string;
	contentGaps?: string[];
	mainTopicalClusters?: string[];
	mainConcepts?: string[];
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
}

export interface TopicsOutput {
	topicalClusters?: string[];
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
	questions?: string[];
}

export interface ResearchIdeasOutput {
	ideas?: string[];
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
	responses?: string[];
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
