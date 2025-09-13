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