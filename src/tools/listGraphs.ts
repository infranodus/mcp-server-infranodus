import { z } from "zod";
import { ListGraphsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";

interface GraphListItem {
	userId: number;
	id: number;
	contextName: string;
	description: string | null;
	contextType: string;
	isFavorite: boolean;
	isPublic: boolean;
	isLive: boolean;
	defaultRevisionUrl: string | null;
	createdAt: string;
	textProcessingSettings?: {
		id: number;
		language: string;
		squareBracketsProcessing: string;
		doubleSquarebracketsProcessing: string;
		partOfSpeechToProcess: string;
		mentionsProcessing: string;
		categoriesAsMentions: boolean;
		lemmatizeHashtags: boolean;
		stopwords: string[];
		synonyms: string | null;
		contextId: number;
	};
	contextSettingsGoogle?: any;
	contextSettingsRss?: any;
	contextSettingsTwitter?: any;
	revisions?: any[];
}

function generateListGraphsResult(graphs: GraphListItem[], filters: z.infer<typeof ListGraphsSchema>) {
	const filterDescription = [];
	if (filters.query) filterDescription.push(`query: "${filters.query}"`);
	if (filters.type) filterDescription.push(`type: ${filters.type}`);
	if (filters.fromDate) filterDescription.push(`from: ${filters.fromDate}`);
	if (filters.toDate) filterDescription.push(`to: ${filters.toDate}`);
	if (filters.language) filterDescription.push(`language: ${filters.language}`);
	if (filters.favorite !== undefined) filterDescription.push(`favorite: ${filters.favorite}`);

	const simplifiedGraphs = graphs.map((graph) => ({
		id: graph.id,
		name: graph.contextName,
		description: graph.description,
		type: graph.contextType,
		isFavorite: graph.isFavorite,
		isPublic: graph.isPublic,
		createdAt: graph.createdAt,
		language: graph.textProcessingSettings?.language || "unknown",
	}));

	return {
		totalGraphs: graphs.length,
		filters: filterDescription.length > 0 ? filterDescription.join(", ") : "none (all graphs)",
		graphs: simplifiedGraphs,
	};
}

export const listGraphsTool = {
	name: "list_graphs",
	definition: {
		title: "List User's InfraNodus Graphs",
		description:
			"List all graphs (contexts) for the currently logged in user with optional filtering by name, type, date, language, or favorite status. Use this to discover available graphs before analyzing or searching them.",
		inputSchema: ListGraphsSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof ListGraphsSchema>) => {
		try {
			const endpoint = `/listGraphs`;

			const requestBody: Record<string, any> = {};

			if (params.query) {
				requestBody.query = params.query;
			}
			if (params.type) {
				requestBody.type = params.type;
			}
			if (params.fromDate) {
				requestBody.fromDate = params.fromDate;
			}
			if (params.toDate) {
				requestBody.toDate = params.toDate;
			}
			if (params.language) {
				requestBody.textProcessingSettings = {
					language: params.language,
				};
			}
			if (params.favorite !== undefined) {
				requestBody.favorite = params.favorite;
			}

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			// The API returns an array of graphs directly
			if (Array.isArray(response)) {
				const structuredOutput = generateListGraphsResult(response as unknown as GraphListItem[], params);
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(structuredOutput, null, 2),
						},
					],
				};
			}

			// Handle error response
			if ((response as any).error) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ error: (response as any).error }),
						},
					],
					isError: true,
				};
			}

			// Fallback: return raw response
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							error: error instanceof Error ? error.message : String(error),
						}),
					},
				],
				isError: true,
			};
		}
	},
};
