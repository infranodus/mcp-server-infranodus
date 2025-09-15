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
	id: number;
	content: string;
	contextId: number;
	categories: string[];
	createdAt: string;
	sortId: number;
	statementHashtags: string[];
	statementCommunities: string[];
	topStatementCommunity: string;
	topStatementOfCommunity: string;
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
		mainConcepts?: string[];
		conceptualGateways?: string[];
		topRelations?: string[];
		topBigrams?: string[];
	};
	userName?: string;
	isPublic?: boolean;
	aiAdvice?: string[];
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
	isPublic?: boolean;
}

export interface GapsOutput {
	contentGaps?: string[];
}

export interface TopicsOutput {
	topicalClusters?: string[];
}

export interface ResearchQuestionsOutput {
	questions?: string[];
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
