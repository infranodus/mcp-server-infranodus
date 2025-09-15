import { z } from "zod";

export const GenerateGraphSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe("Text that you'd like to analyze"),
	includeStatements: z
		.boolean()
		.default(false)
		.describe("Include processed statements in response"),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal), detectEntities (detect entities and keywords), extractEntitiesOnly (only entities)"
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
		.describe("Include processed statements in response"),
	includeGraphSummary: z
		.boolean()
		.default(false)
		.describe("Include AI-generated graph summary for RAG prompt augmentation"),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal), detectEntities (detect entities and keywords), extractEntitiesOnly (only entities)"
		),
});

export const GenerateContentGapsSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe("Text that you'd like to retrieve content gaps from"),
});

export const GenerateTextOverviewSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe("Text that you'd like to get an overview of"),
});

export const GenerateTopicalClustersSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe(
			"Text that you'd like to retrieve topics and topical clusters from"
		),
});

export const GenerateResearchQuestionsSchema = z.object({
	text: z
		.string()
		.min(1, "Text is required for analysis")
		.describe("Text that you'd like to generate research questions from"),
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
		.describe("Text that you'd like to analyze"),
	doNotSave: z
		.boolean()
		.default(true)
		.describe("Don't save the text to the InfraNodus graph"),
	addStats: z.boolean().default(true).describe("Include network statistics"),
	includeStatements: z
		.boolean()
		.default(true)
		.describe("Include processed statements in response"),
	includeGraphSummary: z
		.boolean()
		.default(true)
		.describe("Include AI-generated graph summary for RAG prompt augmentation"),
	extendedGraphSummary: z
		.boolean()
		.default(true)
		.describe("Include extended graph summary"),
	includeGraph: z
		.boolean()
		.default(true)
		.describe("Include full graph structure"),
	aiTopics: z
		.boolean()
		.default(true)
		.describe("Generate AI names for topics (uses OpenAI)"),
	modifyAnalyzedText: z
		.enum(["none", "detectEntities", "extractEntitiesOnly"])
		.default("none")
		.describe(
			"Entity detection: none (normal), detectEntities (detect entities and keywords), extractEntitiesOnly (only entities)"
		),
});
