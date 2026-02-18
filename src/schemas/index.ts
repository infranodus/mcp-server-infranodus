import { z } from "zod";

export const GenerateGraphSchema = z.object({
	text: z
		.string()
		.optional()
		.describe(
			"Text that you'd like to analyze. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Use [[wikilinks]] to mark entities (if required for social / knowledge graphs, ontology, or entity detection). Provide either this or url."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from or YouTube video URL to fetch transcript. Provide either this or text, not both."
		),
	includeStatements: z
		.boolean()
		.default(false)
		.describe(
			"Include processed statements in response (true only if explicitly needed or requested)"
		),
	includeGraph: z
		.boolean()
		.default(true)
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
		.optional()
		.describe(
			"Text that you'd like to analyze. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Provide either this or url."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from or YouTube video URL to fetch transcript. Provide either this or text, not both."
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
		.default("extractEntitiesOnly")
		.describe(
			"Entity detection: none (normal, graph is build from the words,), extractEntitiesOnly (automatic entity extraction — default setting), detectEntities (mix entities and words - use if explicitly requested by the user or needed for further analysis)"
		),
});

export const AnalyzeTextSchemaBase = z.object({
	text: z
		.string()
		.optional()
		.describe(
			"Text that you'd like to analyze. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Provide either this or url."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from (e.g. webpage or YouTube video transcript). Provide either this or text."
		),
	includeStatements: z
		.boolean()
		.default(false)
		.describe(
			"Include processed statements in response (add only if explicitly needed or if user requested the text of the URL / YouTube transcript)"
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
export const AnalyzeTextSchema = AnalyzeTextSchemaBase.refine(
	(data) =>
		(data.text !== undefined && data.text.trim().length > 0) ||
		(data.url !== undefined && data.url.length > 0),
	{ message: "Provide either text or url for analysis." }
);

export const AnalyzeExistingGraphSchemaBase = z.object({
	graphName: z
		.string()
		.min(1, "Graph name is required")
		.describe(
			"Name of an existing InfraNodus graph in your account to retrieve"
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
export const AnalyzeExistingGraphSchema = AnalyzeExistingGraphSchemaBase;

export const SearchExistingGraphsSchema = z.object({
	query: z
		.string()
		.min(1, "Search query is required")
		.describe("Query to search for in existing InfraNodus graphs"),
	contextNames: z
		.array(z.string())
		.default([])
		.describe(
			"Names of the existing InfraNodus graphs to search in (array of strings, empty for all)"
		),
	contextTypes: z
		.array(z.string())
		.default([])
		.describe(
			"Types of the existing InfraNodus graphs to search in (array of strings, empty for all)"
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

export const GenerateContentGapsSchemaBase = z.object({
	text: z
		.string()
		.optional()
		.describe(
			"Text that you'd like to retrieve content gaps from using knowledge graph analysis. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Provide one of: text, url, or graphName."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from or YouTube video URL to fetch transcript. Provide one of: text, url, or graphName."
		),
	graphName: z
		.string()
		.min(1, "Graph name must be non-empty when provided")
		.optional()
		.describe(
			"Name of an existing InfraNodus graph to use. Provide one of: text, url, or graphName."
		),
});
export const GenerateContentGapsSchema = GenerateContentGapsSchemaBase.refine(
	(data) =>
		(data.text !== undefined && data.text.trim().length > 0) ||
		(data.url !== undefined && data.url.length > 0) ||
		(data.graphName !== undefined && data.graphName.trim().length > 0),
	{ message: "Provide either text, url, or graphName for analysis." }
);

export const generateContextualHintSchemaBase = z.object({
	text: z
		.string()
		.optional()
		.describe(
			"Text that you'd like to get an overview of to augment RAG retrieval and text analysis. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Provide one of: text, url, or graphName."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from or YouTube video URL to fetch transcript. Provide one of: text, url, or graphName."
		),
	graphName: z
		.string()
		.min(1, "Graph name must be non-empty when provided")
		.optional()
		.describe(
			"Name of an existing InfraNodus graph to use. Provide one of: text, url, or graphName."
		),
});
export const generateContextualHintSchema =
	generateContextualHintSchemaBase.refine(
		(data) =>
			(data.text !== undefined && data.text.trim().length > 0) ||
			(data.url !== undefined && data.url.length > 0) ||
			(data.graphName !== undefined && data.graphName.trim().length > 0),
		{ message: "Provide either text, url, or graphName for analysis." }
	);

export const GenerateTopicalClustersSchemaBase = z.object({
	text: z
		.string()
		.optional()
		.describe(
			"Text that you'd like to retrieve topics and topical clusters from using knowledge graph analysis. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Provide one of: text, url, or graphName."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from or YouTube video URL to fetch transcript. Provide one of: text, url, or graphName."
		),
	graphName: z
		.string()
		.min(1, "Graph name must be non-empty when provided")
		.optional()
		.describe(
			"Name of an existing InfraNodus graph to use. Provide one of: text, url, or graphName."
		),
});
export const GenerateTopicalClustersSchema =
	GenerateTopicalClustersSchemaBase.refine(
		(data) =>
			(data.text !== undefined && data.text.trim().length > 0) ||
			(data.url !== undefined && data.url.length > 0) ||
			(data.graphName !== undefined && data.graphName.trim().length > 0),
		{ message: "Provide either text, url, or graphName for analysis." }
	);

export const GenerateResearchQuestionsSchemaBase = z.object({
	text: z
		.string()
		.optional()
		.describe(
			"Text that you'd like to generate research questions from. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Provide one of: text, url, or graphName."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from or YouTube video URL to fetch transcript. Provide one of: text, url, or graphName."
		),
	graphName: z
		.string()
		.min(1, "Graph name must be non-empty when provided")
		.optional()
		.describe(
			"Name of an existing InfraNodus graph in your account to generate research questions from. Provide one of: text, url, or graphName."
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
			"claude-opus-4.5",
			"claude-sonnet-4",
			"claude-sonnet-4.5",
			"gemini-2.5-pro",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"grok-4.1-fast-non-reasoning",
			"grok-4.1-fast-reasoning",
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

export const GenerateResearchQuestionsSchema =
	GenerateResearchQuestionsSchemaBase.refine(
		(data) =>
			(data.text !== undefined && data.text.trim().length > 0) ||
			(data.url !== undefined && data.url.length > 0) ||
			(data.graphName !== undefined && data.graphName.trim().length > 0),
		{ message: "Provide either text, url, or graphName for analysis." }
	);

export const GenerateResearchIdeasSchemaBase = z.object({
	text: z
		.string()
		.optional()
		.describe(
			"Text that you'd like to generate research ideas from based on the content gaps identified between the topical clusters inside the text. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Provide one of: text, url, or graphName."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from or YouTube video URL to fetch transcript. Provide one of: text, url, or graphName."
		),
	graphName: z
		.string()
		.min(1, "Graph name must be non-empty when provided")
		.optional()
		.describe(
			"Name of an existing InfraNodus graph to use. Provide one of: text, url, or graphName."
		),
	useSeveralGaps: z
		.boolean()
		.default(false)
		.describe("Generate ideas for several content gaps found in text"),
	gapDepth: z
		.number()
		.default(0)
		.describe("Depth of content gaps to generate ideas for"),
	shouldTranscend: z
		.boolean()
		.default(false)
		.describe(
			"Generate ideas that transcend and go beyond the content of the text and relate to a broader discourse. Only run if explicitly requested by the user to go beyond the text and relate to a broader discourse"
		),
	responseType: z
		.enum(["response", "idea"])
		.default("response")
		.describe(
			"Type of response to generate: 'response' — generates a response based on the gaps identified; 'idea' — generate an business idea that bridges the gap."
		),
	modelToUse: z
		.enum([
			"claude-opus-4.1",
			"claude-opus-4.5",
			"claude-sonnet-4",
			"claude-sonnet-4.5",
			"gemini-2.5-pro",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"grok-4.1-fast-non-reasoning",
			"grok-4.1-fast-reasoning",
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
export const GenerateResearchIdeasSchema =
	GenerateResearchIdeasSchemaBase.refine(
		(data) =>
			(data.text !== undefined && data.text.trim().length > 0) ||
			(data.url !== undefined && data.url.length > 0) ||
			(data.graphName !== undefined && data.graphName.trim().length > 0),
		{ message: "Provide either text, url, or graphName for analysis." }
	);

export const DevelopLatentConceptsSchemaBase = z.object({
	text: z
		.string()
		.optional()
		.describe(
			"Text that you'd like to develop based on the latent concepts that connect this text to a broader discourse. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Provide one of: text, url, or graphName."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from or YouTube video URL to fetch transcript. Provide one of: text, url, or graphName."
		),
	graphName: z
		.string()
		.min(1, "Graph name must be non-empty when provided")
		.optional()
		.describe(
			"Name of an existing InfraNodus graph to use. Provide one of: text, url, or graphName."
		),
	requestMode: z
		.enum(["question", "transcend"])
		.default("transcend")
		.describe(
			"Request mode: 'question' — generate questions that focus on this context; 'transcend' — generate responses that transcend and go beyond the content of the text and relate to a broader discourse."
		),
	modelToUse: z
		.enum([
			"claude-opus-4.1",
			"claude-opus-4.5",
			"claude-sonnet-4",
			"claude-sonnet-4.5",
			"gemini-2.5-pro",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"grok-4.1-fast-non-reasoning",
			"grok-4.1-fast-reasoning",
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
export const DevelopLatentConceptsSchema =
	DevelopLatentConceptsSchemaBase.refine(
		(data) =>
			(data.text !== undefined && data.text.trim().length > 0) ||
			(data.url !== undefined && data.url.length > 0) ||
			(data.graphName !== undefined && data.graphName.trim().length > 0),
		{ message: "Provide either text, url, or graphName for analysis." }
	);

export const RetrieveContextForPromptFromGraphSchema = z.object({
	graphName: z
		.string()
		.min(1, "Graph name is required")
		.describe(
			"Name of the existing InfraNodus graph in your account to retrieve"
		),
	prompt: z
		.string()
		.min(1, "Prompt is required")
		.describe("Prompt to retrieve context for from the graph"),
	compactStatements: z
		.boolean()
		.default(false)
		.describe(
			"Make statements compact by removing categories and other metadata"
		),
	includeGraphSummary: z
		.boolean()
		.default(true)
		.describe(
			"Include graph summary string in the response to provide additional context"
		),
	extendedGraphSummary: z
		.boolean()
		.default(false)
		.describe(
			"Include extended graph summary object in the response for additional detailed context"
		),
	includeGraph: z
		.boolean()
		.default(false)
		.describe(
			"Include graph in the response to provide underlying knowledge graph structure"
		),
});

export const GenerateResponsesFromGraphSchemaBase = z.object({
	graphName: z
		.string()
		.min(1, "Graph name must be non-empty when provided")
		.optional()
		.describe(
			"Name of an existing InfraNodus graph in your account to retrieve. Provide one of: text, url, or graphName."
		),
	text: z
		.string()
		.optional()
		.describe(
			"Text that you'd like to generate responses from. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Provide one of: text, url, or graphName."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from or YouTube video URL to fetch transcript. Provide one of: text, url, or graphName."
		),
	prompt: z
		.string()
		.min(1, "Prompt is required")
		.describe("Prompt to generate responses to from the graph"),
	modelToUse: z
		.enum([
			"claude-opus-4.1",
			"claude-opus-4.5",
			"claude-sonnet-4",
			"claude-sonnet-4.5",
			"gemini-2.5-pro",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"grok-4.1-fast-non-reasoning",
			"grok-4.1-fast-reasoning",
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
export const GenerateResponsesFromGraphSchema =
	GenerateResponsesFromGraphSchemaBase.refine(
		(data) =>
			(data.text !== undefined && data.text.trim().length > 0) ||
			(data.url !== undefined && data.url.length > 0) ||
			(data.graphName !== undefined && data.graphName.trim().length > 0),
		{ message: "Provide either text, url, or graphName for analysis." }
	);

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

/** Shared context item: one of { text }, { url }, or { graphName }. Used by overlap and difference tools. */
const contextItemTextUrlOrGraphSchema = z.union([
	z
		.object({
			text: z
				.string()
				.min(1, "Text is required for analysis")
				.describe(
					"Text content - use new lines to separate statements (but not sentences)."
				),
		})
		.describe("Context from plain text."),
	z
		.object({
			url: z
				.string()
				.min(1, "URL is required")
				.url("Must be a valid URL")
				.describe("URL to fetch content from (or YouTube transcript)."),
		})
		.describe("Context from a URL."),
	z
		.object({
			graphName: z
				.string()
				.min(1, "Graph name is required when provided")
				.describe(
					"Name of an existing InfraNodus graph; its statements are retrieved and used as text."
				),
		})
		.describe("Context from an existing InfraNodus graph by name."),
]);

const GenerateOverlapGraphFromTextsSchemaBase = z.object({
	contexts: z
		.array(contextItemTextUrlOrGraphSchema)
		.min(2, "At least two contexts are required for overlap")
		.describe(
			"Array of sources to analyze and find content overlaps for. Each item is an object with exactly one of: { text: string }, { url: string }, or { graphName: string }. Example: [{ text: '...' }, { url: 'https://...' }, { graphName: 'my-graph' }]."
		),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal), detectEntities (mix entities and words), extractEntitiesOnly (detect entities only - use for ontology and knowledge graph creation and entity extraction)"
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

export { GenerateOverlapGraphFromTextsSchemaBase };
export const GenerateOverlapGraphFromTextsSchema =
	GenerateOverlapGraphFromTextsSchemaBase;

const GenerateDifferenceGraphFromTextsSchemaBase = z.object({
	contexts: z
		.array(contextItemTextUrlOrGraphSchema)
		.min(2, "At least two contexts (target + one reference) are required")
		.describe(
			"Array where the FIRST item is the target to analyze for missing parts; REMAINING items are reference sources. Each item is an object with exactly one of: { text: string }, { url: string }, or { graphName: string }. Example: [{ text: '...' }, { url: 'https://...' }, { graphName: 'my-graph' }]."
		),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal), detectEntities (mix entities and words), extractEntitiesOnly (detect entities only - use for ontology and knowledge graph creation and entity extraction)"
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

export { GenerateDifferenceGraphFromTextsSchemaBase };
export const GenerateDifferenceGraphFromTextsSchema =
	GenerateDifferenceGraphFromTextsSchemaBase;

export const GenerateGoogleSearchResultsGraphSchema = z.object({
	queries: z
		.array(z.string())
		.min(1, "Queries are required for analysis")
		.describe(
			"Queries that you'd like to get Google search results for, can be multiple queries"
		),
	includeSearchResults: z
		.boolean()
		.default(false)
		.describe("Include search results in the response"),
	includeGraph: z
		.boolean()
		.default(false)
		.describe(
			"Include the graph structure and keywords in the response (add only if explicitly needed"
		),
	showExtendedGraphInfo: z
		.boolean()
		.default(false)
		.describe(
			"Include extended graph information in the response (additional information about the content gaps and main topics)"
		),
	includeSearchResultsOnly: z
		.boolean()
		.default(false)
		.describe(
			"Only include search results in the response (do not include the knowledge graph, analysis, and keywords)"
		),
	includeNodesAndEdges: z
		.boolean()
		.default(false)
		.describe(
			"Include nodes and edges in the response (true only if explicitly required)"
		),
	importLanguage: z
		.enum([
			"EN",
			"DE",
			"FR",
			"ES",
			"IT",
			"PT",
			"RU",
			"CN",
			"JP",
			"NL",
			"TW",
			"KO",
			"AR",
			"HE",
		])
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
			"SG",
			"SA",
			"AE",
			"EG",
			"IR",
			"IL",
			"KR",
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
	includeSearchQueries: z
		.boolean()
		.default(false)
		.describe("Include search queries in the response"),
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
	includeGraph: z
		.boolean()
		.default(false)
		.describe(
			"Include the graph structure and keywords in the response (add only if explicitly needed)"
		),
	showExtendedGraphInfo: z
		.boolean()
		.default(false)
		.describe(
			"Include extended graph information in the response (additional information about the content gaps, main topics, and keywords)"
		),
	includeNodesAndEdges: z
		.boolean()
		.default(false)
		.describe(
			"Include nodes and edges in the response (true only if explicitly required)"
		),
	importLanguage: z
		.enum([
			"EN",
			"DE",
			"FR",
			"ES",
			"IT",
			"PT",
			"RU",
			"CN",
			"JP",
			"NL",
			"TW",
			"KO",
			"AR",
			"HE",
		])
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
			"SG",
			"SA",
			"AE",
			"EG",
			"IR",
			"IL",
			"KR",
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
	includeGraph: z
		.boolean()
		.default(false)
		.describe("Include the graph structure and keywords in the response"),
	showExtendedGraphInfo: z
		.boolean()
		.default(false)
		.describe(
			"Include extended graph information in the response (add only if explicitly needed)"
		),
	includeSearchQueries: z
		.boolean()
		.default(false)
		.describe("Include search queries in the response"),
	includeSearchQueriesOnly: z
		.boolean()
		.default(false)
		.describe(
			"Only include search queries in the response (do not include the knowledge graph, analysis, and keywords)"
		),
	importLanguage: z
		.enum([
			"EN",
			"DE",
			"FR",
			"ES",
			"IT",
			"PT",
			"RU",
			"CN",
			"JP",
			"NL",
			"TW",
			"KO",
			"AR",
			"HE",
		])
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
			"SG",
			"SA",
			"AE",
			"EG",
			"IR",
			"IL",
			"KR",
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
		.optional()
		.describe(
			"Content that you'd like to optimize for SEO. Use new lines to separate separate statements or paragrams in each text (but not the sentences)."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from for SEO analysis. Provide either this or text, not both."
		),
	contentToExtract: z
		.enum(["all", "header tags", "link tags"])
		.default("all")
		.describe(
			"What to extract from URL: 'all' (default), 'header tags', or 'link tags'."
		),
	numberOfKeywordsToExtract: z
		.number()
		.max(4)
		.default(2)
		.describe(
			"Number of the top keyword groups extracted from text to use for the SEO analysis, default is 2, maximum is 4. Use more if you want to get deeper insights but longer processing. In case the tool fails, reduce to 2 or less."
		),
	numberOfTopicsToExtract: z
		.number()
		.max(4)
		.default(2)
		.describe(
			"Number of the top topical cluster names extracted from text to use for the SEO analysis, default is 2, maximum is 4. Use more if you want to get deeper insights but longer processing. In case the tool fails, reduce to 2 or less."
		),
	importLanguage: z
		.enum([
			"EN",
			"DE",
			"FR",
			"ES",
			"IT",
			"PT",
			"RU",
			"CN",
			"JP",
			"NL",
			"TW",
			"KO",
			"AR",
			"HE",
		])
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
			"SG",
			"SA",
			"AE",
			"EG",
			"IR",
			"IL",
			"KR",
		])
		.default("US")
		.describe(
			"Country for the search analysis, default is United States (US). Use the country most suitable for the language selected."
		),
	useProxy: z
		.boolean()
		.default(false)
		.describe(
			"Use proxy to fetch content from URL (true only if the first request fails, returns javascript only,or is requested by user)"
		),
});

export const DevelopTextToolSchemaBase = z.object({
	text: z
		.string()
		.optional()
		.describe(
			"Text that you'd like to think about and analyze. Use new lines to separate separate statements or paragrams in each text (but not the sentences). Provide one of: text, url, or graphName."
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"URL to fetch content from or YouTube video URL to fetch transcript. Provide one of: text, url, or graphName."
		),
	graphName: z
		.string()
		.min(1, "Graph name must be non-empty when provided")
		.optional()
		.describe(
			"Name of an existing InfraNodus graph to use. Provide one of: text, url, or graphName."
		),
	useSeveralGaps: z
		.boolean()
		.default(false)
		.describe("Generate questions for several content gaps found in text"),
	gapDepth: z
		.number()
		.default(0)
		.describe("Depth of content gaps to generate questions for"),
	transcendDiscourse: z
		.boolean()
		.default(false)
		.describe(
			"Shall we transcend and go beyond this text to relate to a broader discourse? If false, the focus is on this text only."
		),
	modelToUse: z
		.enum([
			"claude-opus-4.1",
			"claude-opus-4.5",
			"claude-sonnet-4",
			"claude-sonnet-4.5",
			"gemini-2.5-pro",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
			"grok-4.1-fast-non-reasoning",
			"grok-4.1-fast-reasoning",
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
export const DevelopTextToolSchema = DevelopTextToolSchemaBase.refine(
	(data) =>
		(data.text !== undefined && data.text.trim().length > 0) ||
		(data.url !== undefined && data.url.length > 0) ||
		(data.graphName !== undefined && data.graphName.trim().length > 0),
	{ message: "Provide either text, url, or graphName for analysis." }
);

export const ListGraphsSchema = z.object({
	nameContains: z
		.string()
		.optional()
		.describe(
			"Values that should be matched to in the graph name. Use comma-separated values for OR logic (e.g., 'youtube,google,evernote'). Leave empty to list all graphs."
		),
	type: z
		.string()
		.optional()
		.describe(
			"Filter by graph type. Available types: STANDARD, MINDMAP, WORDCLOUD, GEXF, SCIENCE, TWITTER, GOOGLE, NICHE, SEO, EVERNOTE, RSS, WIKILINKS, TXT, PDF, CSV, MD, MEMORY, ONTOLOGY, JSON, KWRDS. Use comma-separated values for OR logic (e.g., 'CSV,GOOGLE,STANDARD'). When user asks for a memory use, MEMORY in the type, when user asks for ontology, use ONTOLOGY,WIKILINKS. If nothing found or unsure what to use,leave empty."
		),
	fromDate: z
		.string()
		.optional()
		.describe(
			"Filter graphs created on or after this date (ISO format, e.g., '2026-01-01T00:00:00.000Z')"
		),
	toDate: z
		.string()
		.optional()
		.describe(
			"Filter graphs created on or before this date (ISO format, e.g., '2026-01-31T23:59:59.999Z')"
		),
	language: z
		.string()
		.optional()
		.describe(
			"Filter by language code (e.g., 'EN', 'AUTO', 'DE', 'FR', 'ES', etc.)"
		),
	favorite: z.boolean().optional().describe("Filter by favorite status"),
});
