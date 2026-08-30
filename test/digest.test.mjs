import { test } from "node:test";
import assert from "node:assert/strict";
import {
	GenerateOntologyGraphSchema,
	OptimizeKnowledgeBaseSchema,
} from "../dist/schemas/index.js";

test("generate_ontology_graph accepts the procedural (digest) mode", () => {
	const parsed = GenerateOntologyGraphSchema.parse({
		sourceGraphName: "repo-x-docs",
		ontologyMode: "procedural",
		graphName: "repo-x-digest",
	});
	assert.equal(parsed.ontologyMode, "procedural");
	assert.equal(GenerateOntologyGraphSchema.parse({ prompt: "x" }).ontologyMode, "general");
	assert.throws(() => GenerateOntologyGraphSchema.parse({ prompt: "x", ontologyMode: "digest" }));
});

test("optimize_knowledge_base accepts a written digest with saveAs", () => {
	const parsed = OptimizeKnowledgeBaseSchema.parse({
		text: "## [[Tools]]\nEvery tool lives in [[src/tools]].",
		saveAs: "repo-x-digest",
		focus: "codebase",
		compareWith: ["repo-x-structure"],
	});
	assert.equal(parsed.saveAs, "repo-x-digest");
	assert.equal(parsed.focus, "codebase");
	assert.equal(OptimizeKnowledgeBaseSchema.parse({ graphName: "g" }).saveAs, undefined);
});
