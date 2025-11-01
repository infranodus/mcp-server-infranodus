import { z } from "zod";

export const GenerateGraphSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to analyze. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Use [[wikilinks]] to mark entities (if required for social / knowledge graphs, ontology, or entity detection)."
		),
	includeStatements: z
		.boolean()
		.default(false)
		.describe(
			"Include processed statements in response (true only if explicitly needed or requested)"
		),
	includeGraph: z
		.boolean()
		.default(false)
		.describe(
			"Include full graph structure in response (true only if explicitly needed or requested)"
		),
	addNodesAndEdges: z
		.boolean()
		.default(false)
		.describe(
			"Include nodes and edges in response (true only if explicitly needed, not recommended for longer texts)"
		),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Text processing setting to use: none (for text, gap, and topical analysis), detectEntities (mix entities and words), extractEntitiesOnly (detect entities only - use for ontology and knowledge graph generation and entity extraction)"
		),
});

export const CreateGraphSchema = z.object({
	graphName: z
		.string()
		.min(1, "Graph name is required")
		.describe("Name of the graph to create in InfraNodus"),
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to analyze. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
		),
	includeStatements: z
		.boolean()
		.default(false)
		.describe(
			"Include processed statements in response (add only if explicitly needed)"
		),
	includeGraph: z
		.boolean()
		.default(false)
		.describe(
			"Include full graph structure in response (add only if explicitly needed)"
		),
	addNodesAndEdges: z
		.boolean()
		.default(false)
		.describe(
			"Include nodes and edges in response (add only if explicitly needed, not recommended for longer texts)"
		),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal), detectEntities (mix entities and words), extractEntitiesOnly (detect entities only - use for ontology and knowledge graph creation and entity extraction)"
		),
});

export const AddMemorySchema = z.object({
	graphName: z
		.string()
		.min(1, "Graph name is required")
		.max(28, "Graph name must be less than 28 characters")
		.describe(
			"Name of the graph to add the memory to in InfraNodus - lowercase, dashes for spaces, no special characters. Auto-generate from the context of the conversation (if previously available) or use the nanme of the LLM client or project, or use the name the user explicitly provided or requested."
		),
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to analyze. Use new lines to separate separate statements, relations, and paragraphs in each text (but not the sentences). Detect the entities in every statement and use [[wikilinks]] syntax to mark them, unless the user explicitly requests automatic entity detection. Every statement should have at least two entities marked."
		),
	includeStatements: z
		.boolean()
		.default(false)
		.describe(
			"Include processed statements in response (add only if needed for further analysis)"
		),
	includeGraph: z
		.boolean()
		.default(false)
		.describe(
			"Include full graph structure in response (add only if needed for further analysis)"
		),
	addNodesAndEdges: z
		.boolean()
		.default(false)
		.describe(
			"Include nodes and edges in response (add only if needed for further analysis, not recommended for longer texts)"
		),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal, by default), extractEntitiesOnly (automatic entity extraction - use if explicitly requested by the user)"
		),
});

export const AnalyzeExistingGraphSchema = z.object({
	graphName: z
		.string()
		.min(1, "Graph name is required")
		.describe(
			"Name of the existing InfraNodus graph in your account to retrieve"
		),
	includeStatements: z
		.boolean()
		.default(true)
		.describe(
			"Include processed statements in response (add only if explicitly needed)"
		),
	includeGraph: z
		.boolean()
		.default(false)
		.describe(
			"Include full graph structure in response (add only if explicitly needed)"
		),
	addNodesAndEdges: z
		.boolean()
		.default(false)
		.describe(
			"Include nodes and edges in response (add only if explicitly needed, not recommended for longer texts)"
		),
	includeGraphSummary: z
		.boolean()
		.default(false)
		.describe("Include AI-generated graph summary for RAG prompt augmentation"),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal), detectEntities (mix entities and words), extractEntitiesOnly (detect entities only - use for ontology and knowledge graph creation and entity extraction)"
		),
});

export const SearchExistingGraphsSchema = z.object({
	query: z
		.string()
		.min(1, "Search query is required")
		.describe("Query to search for in existing InfraNodus graphs"),
	contextNames: z
		.array(z.string())
		.default([])
		.describe(
			"Names of the existing InfraNodus graphs to search in (comma-separated list, empty for all)"
		),
});

export const getMemorySchema = z.object({
	entityName: z
		.string()
		.default("")
		.describe(
			"Name of the entity to get relations for from the InfraNodus memory, use [[wikilinks]] syntax to mark the entity, replace spaces with underscores. Leave if contextMemoryName is provided."
		),
	memoryContextName: z
		.string()
		.default("")
		.describe(
			"Name of the existing InfraNodus memory graph to search in if requested or needed from the context (can be left empty to search in all memory graphs)"
		),
});

export const SearchExistingGraphsFetchSchema = z.object({
	id: z
		.string()
		.min(1, "ID of the Search Result is required")
		.describe(
			"ID of the search result to retrieve (username:graph_name:search_query"
		),
});

export const GenerateContentGapsSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to retrieve content gaps from. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
		),
});

export const generateContextualHintSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to get an overview of. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
		),
});

export const GenerateTopicalClustersSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to retrieve topics and topical clusters from. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
		),
});

export const GenerateResearchQuestionsSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to generate research questions from. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
		),
	useSeveralGaps: z
		.boolean()
		.default(false)
		.describe("Generate questions for several content gaps found in text"),
	gapDepth: z
		.number()
		.default(0)
		.describe("Depth of content gaps to generate questions for"),
	modelToUse: z
		.enum([
			"claude-opus-4.1",
			"claude-sonnet-4",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"gpt-4o",
			"gpt-4o-mini",
			"gpt-5",
			"gpt-5-mini",
		])
		.default("gpt-4o")
		.describe(
			"AI model to use for generating research questions: claude-opus-4.1, claude-sonnet-4, gemini-2.5-flash, gemini-2.5-flash-lite, gpt-4o, gpt-4o-mini, gpt-5, gpt-5-mini"
		),
});

export const GenerateResearchIdeasSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to generate research ideas from. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
		),
	useSeveralGaps: z
		.boolean()
		.default(false)
		.describe("Generate ideas for several content gaps found in text"),
	gapDepth: z
		.number()
		.default(0)
		.describe("Depth of content gaps to generate ideas for"),
	modelToUse: z
		.enum([
			"claude-opus-4.1",
			"claude-sonnet-4",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"gpt-4o",
			"gpt-4o-mini",
			"gpt-5",
			"gpt-5-mini",
		])
		.default("gpt-4o")
		.describe(
			"AI model to use for generating research questions: claude-opus-4.1, claude-sonnet-4, gemini-2.5-flash, gemini-2.5-flash-lite, gpt-4o, gpt-4o-mini, gpt-5, gpt-5-mini"
		),
});

export const DevelopLatentConceptsSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to develop based on the latent concepts that connect this text to a broader discourse. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
		),
	modelToUse: z
		.enum([
			"claude-opus-4.1",
			"claude-sonnet-4",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"gpt-4o",
			"gpt-4o-mini",
			"gpt-5",
			"gpt-5-mini",
		])
		.default("gpt-4o")
		.describe(
			"AI model to use for generating research questions: claude-opus-4.1, claude-sonnet-4, gemini-2.5-flash, gemini-2.5-flash-lite, gpt-4o, gpt-4o-mini, gpt-5, gpt-5-mini"
		),
});

export const GenerateResearchQuestionsFromGraphSchema = z.object({
	graphName: z
		.string()
		.min(1, "Graph name is required")
		.describe(
			"Name of the existing InfraNodus graph in your account to retrieve"
		),
	useSeveralGaps: z
		.boolean()
		.default(false)
		.describe("Generate questions for several content gaps found in text"),
	gapDepth: z
		.number()
		.default(0)
		.describe("Depth of content gaps to generate questions for"),
	modelToUse: z
		.enum([
			"claude-opus-4.1",
			"claude-sonnet-4",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"gpt-4o",
			"gpt-4o-mini",
			"gpt-5",
			"gpt-5-mini",
		])
		.default("gpt-4o")
		.describe(
			"AI model to use for generating research questions: claude-opus-4.1, claude-sonnet-4, gemini-2.5-flash, gemini-2.5-flash-lite, gpt-4o, gpt-4o-mini, gpt-5, gpt-5-mini"
		),
});

export const GenerateResponsesFromGraphSchema = z.object({
	graphName: z
		.string()
		.min(1, "Graph name is required")
		.describe(
			"Name of the existing InfraNodus graph in your account to retrieve"
		),
	prompt: z
		.string()
		.min(1, "Prompt is required")
		.describe("Prompt to generate responses to from the graph"),
	modelToUse: z
		.enum([
			"claude-opus-4.1",
			"claude-sonnet-4",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"gpt-4o",
			"gpt-4o-mini",
			"gpt-5",
			"gpt-5-mini",
		])
		.default("gpt-4o")
		.describe(
			"AI model to use for generating research questions: claude-opus-4.1, claude-sonnet-4, gemini-2.5-flash, gemini-2.5-flash-lite, gpt-4o, gpt-4o-mini, gpt-5, gpt-5-mini"
		),
});

// This is used for adding options later to each tool
export const GenerateGeneralGraphSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to analyze. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
		),
	doNotSave: z
		.boolean()
		.default(true)
		.describe("Don't save the text to the InfraNodus graph"),
	addStats: z.boolean().default(true).describe("Include network statistics"),
	includeStatements: z
		.boolean()
		.default(true)
		.describe(
			"Include processed statements in response (add only if explicitly needed)"
		),
	includeGraph: z
		.boolean()
		.default(false)
		.describe(
			"Include full graph structure in response (add only if explicitly needed)"
		),
	addNodesAndEdges: z
		.boolean()
		.default(false)
		.describe(
			"Include nodes and edges in response (add only if explicitly needed, not recommended for longer texts)"
		),
	includeGraphSummary: z
		.boolean()
		.default(true)
		.describe("Include AI-generated graph summary for RAG prompt augmentation"),
	extendedGraphSummary: z
		.boolean()
		.default(true)
		.describe("Include extended graph summary"),
	aiTopics: z
		.boolean()
		.default(true)
		.describe("Generate AI names for topics (uses OpenAI)"),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal), detectEntities (mix entities and words), extractEntitiesOnly (detect entities only - use for ontology and knowledge graph creation and entity extraction)"
		),
});

export const GenerateOverlapGraphFromTextsSchema = z.object({
	contexts: z
		.array(
			z.object({
				text: z
					.string()
					.min(1, "Text is required for analysis")
					.describe(
						"Text that you'd like to analyze. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
					),
				modifyAnalyzedText: z
					.enum(["none", "detectEntities", "extractEntitiesOnly"])
					.default("none")
					.describe(
						"Entity detection: none (normal), detectEntities (mix entities and words), extractEntitiesOnly (detect entities only - use for ontology and knowledge graph creation and entity extraction)"
					),
			})
		)
		.min(2, "At least two contexts are required")
		.describe(
			"Array of the texts to analyze and find overlaps for. Example: [text1, text2, ...]"
		),
	includeStatements: z
		.boolean()
		.default(false)
		.describe(
			"Include processed statements in response (add only if explicitly needed)"
		),
	includeGraph: z
		.boolean()
		.default(false)
		.describe(
			"Include full graph structure in response (add only if explicitly needed)"
		),
	addNodesAndEdges: z
		.boolean()
		.default(false)
		.describe(
			"Include nodes and edges in response (add only if explicitly needed, not recommended for longer texts)"
		),
});

export const GenerateDifferenceGraphFromTextsSchema = z.object({
	contexts: z
		.array(
			z.object({
				text: z
					.string()
					.min(1, "Text is required for analysis")
					.describe(
						"Text content - First element is the target text to analyze for missing parts, subsequent elements are reference texts to identify what's missing. Use new lines to separate separate statements in each text (but not the sentences)."
					),
				modifyAnalyzedText: z
					.enum(["none", "detectEntities", "extractEntitiesOnly"])
					.default("none")
					.describe(
						"Entity detection: none (normal), detectEntities (mix entities and words), extractEntitiesOnly (detect entities only - use for ontology and knowledge graph creation and entity extraction)"
					),
			})
		)
		.min(
			2,
			"At least two contexts are required - one target text and one reference text"
		)
		.describe(
			"Array of texts where the FIRST text is analyzed for missing parts compared to the REMAINING reference texts. Example: [targetText, referenceText1, referenceText2, ...]"
		),
	includeStatements: z
		.boolean()
		.default(false)
		.describe(
			"Include processed statements in response (add only if explicitly needed)"
		),
	includeGraph: z
		.boolean()
		.default(false)
		.describe(
			"Include full graph structure in response (add only if explicitly needed)"
		),
	addNodesAndEdges: z
		.boolean()
		.default(false)
		.describe(
			"Include nodes and edges in response (add only if explicitly needed, not recommended for longer texts)"
		),
});

export const GenerateGoogleSearchResultsGraphSchema = z.object({
	queries: z
		.array(z.string())
		.min(1, "Queries are required for analysis")
		.describe(
			"Queries that you'd like to get Google search results for, can be comma-separated for multiple queries"
		),
	includeSearchResultsOnly: z
		.boolean()
		.default(false)
		.describe(
			"Only include search results in the response (do not include the knowledge graph and keywords)"
		),
	showGraphOnly: z
		.boolean()
		.default(true)
		.describe(
			"Only include the graph structure and keywords in the response (do not include the search results)"
		),
	showExtendedGraphInfo: z
		.boolean()
		.default(false)
		.describe(
			"Include extended graph information in the response (add only if explicitly needed)"
		),
	importLanguage: z
		.enum(["EN", "DE", "FR", "ES", "IT", "PT", "RU", "CN", "JP", "NL", "TW"])
		.default("EN")
		.describe(
			"Language of the search queries, default is English (EN), use the language of the conversation or requested by user."
		),
	importCountry: z
		.enum([
			"AR",
			"AU",
			"BR",
			"CA",
			"CH",
			"CN",
			"DE",
			"ES",
			"FR",
			"GB",
			"HK",
			"IN",
			"IT",
			"JP",
			"MX",
			"NL",
			"NO",
			"NZ",
			"PT",
			"RU",
			"SV",
			"TW",
			"US",
		])
		.default("US")
		.describe(
			"Country of the search queries, default is United States (US).Use the country most suitable for the language selected."
		),
});

export const GenerateGoogleSearchQueriesGraphSchema = z.object({
	queries: z
		.array(z.string())
		.min(1, "Queries are required for analysis")
		.describe(
			"Queries that you'd like to get Google related queries for, can be comma-separated for multiple queries"
		),
	includeSearchQueriesOnly: z
		.boolean()
		.default(false)
		.describe(
			"Only include search queries in the response (do not include the knowledge graph and keywords)"
		),
	keywordsSource: z
		.enum(["related", "adwords"])
		.default("related")
		.describe(
			"Source of keywords to use for the graph: related (Google suggestions) or adwords (Google Ads suggestions - broader range)"
		),
	showGraphOnly: z
		.boolean()
		.default(true)
		.describe(
			"Only include the graph structure and keywords in the response (do not include the search queries)"
		),
	showExtendedGraphInfo: z
		.boolean()
		.default(false)
		.describe(
			"Include extended graph information in the response (add only if explicitly needed)"
		),
	importLanguage: z
		.enum(["EN", "DE", "FR", "ES", "IT", "PT", "RU", "CN", "JP", "NL", "TW"])
		.default("EN")
		.describe(
			"Language of the search queries, default is English (EN), use the language of the conversation or requested by user."
		),
	importCountry: z
		.enum([
			"AR",
			"AU",
			"BR",
			"CA",
			"CH",
			"CN",
			"DE",
			"ES",
			"FR",
			"GB",
			"HK",
			"IN",
			"IT",
			"JP",
			"MX",
			"NL",
			"NO",
			"NZ",
			"PT",
			"RU",
			"SV",
			"TW",
			"US",
		])
		.default("US")
		.describe(
			"Country of the search queries, default is United States (US). Use the country most suitable for the language selected."
		),
});

export const GenerateGoogleResultsVsQueriesGraphSchema = z.object({
	queries: z
		.array(z.string())
		.min(1, "Queries are required for analysis")
		.describe(
			"Queries for which you'd like to find the difference between what people find and what people are looking for"
		),
	showGraphOnly: z
		.boolean()
		.default(true)
		.describe(
			"Only include the graph structure and keywords in the response (do not include the search results)"
		),
	showExtendedGraphInfo: z
		.boolean()
		.default(false)
		.describe(
			"Include extended graph information in the response (add only if explicitly needed)"
		),
	importLanguage: z
		.enum(["EN", "DE", "FR", "ES", "IT", "PT", "RU", "CN", "JP", "NL", "TW"])
		.default("EN")
		.describe(
			"Language of the search queries, default is English (EN), use the language of the conversation or requested by user."
		),
	importCountry: z
		.enum([
			"AR",
			"AU",
			"BR",
			"CA",
			"CH",
			"CN",
			"DE",
			"ES",
			"FR",
			"GB",
			"HK",
			"IN",
			"IT",
			"JP",
			"MX",
			"NL",
			"NO",
			"NZ",
			"PT",
			"RU",
			"SV",
			"TW",
			"US",
		])
		.default("US")
		.describe(
			"Country of the search queries, default is United States (US). Use the country most suitable for the language selected."
		),
});

export const GenerateSEOGraphSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for SEO analysis")
		.describe(
			"Content that you'd like to optimize for SEO. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
		),
	importLanguage: z
		.enum(["EN", "DE", "FR", "ES", "IT", "PT", "RU", "CN", "JP", "NL", "TW"])
		.default("EN")
		.describe(
			"Language of the content and search queries, default is English (EN), use the language of the conversation or requested by user."
		),
	importCountry: z
		.enum([
			"AR",
			"AU",
			"BR",
			"CA",
			"CH",
			"CN",
			"DE",
			"ES",
			"FR",
			"GB",
			"HK",
			"IN",
			"IT",
			"JP",
			"MX",
			"NL",
			"NO",
			"NZ",
			"PT",
			"RU",
			"SV",
			"TW",
			"US",
		])
		.default("US")
		.describe(
			"Country for the search analysis, default is United States (US). Use the country most suitable for the language selected."
		),
});

export const DevelopTextToolSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to think about and analyze. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
		),
	useSeveralGaps: z
		.boolean()
		.default(false)
		.describe("Generate questions for several content gaps found in text"),
	gapDepth: z
		.number()
		.default(0)
		.describe("Depth of content gaps to generate questions for"),
	extendedIdeationMode: z
		.boolean()
		.default(false)
		.describe(
			"Use extended ideation mode to generate ideas instead of questions. Only run if explicitly requested or if the previous run with of this tool did not provide sufficient results"
		),
	modelToUse: z
		.enum([
			"claude-opus-4.1",
			"claude-sonnet-4",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"gpt-4o",
			"gpt-4o-mini",
			"gpt-5",
			"gpt-5-mini",
		])
		.default("gpt-4o")
		.describe(
			"AI model to use for generating insights: claude-opus-4.1, claude-sonnet-4, gemini-2.5-flash, gemini-2.5-flash-lite, gpt-4o, gpt-4o-mini, gpt-5, gpt-5-mini"
		),
});
