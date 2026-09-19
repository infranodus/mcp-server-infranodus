import { test } from "node:test";
import assert from "node:assert/strict";
import {
	prepareStatementsPayload,
	statementsContextSettings,
} from "../dist/utils/wikilinksMode.js";
import { resolveContexts } from "../dist/utils/graphInput.js";
import {
	CreateGraphSchema,
	GenerateOverlapGraphFromTextsSchema,
} from "../dist/schemas/index.js";

const statements = ["[[a]] founded [[b]]", "[[c]] funded [[b]]"];
const categories = [["founded"], ["funded"]];

test("categories stay metadata by default: no categoriesAsMentions in settings", () => {
	const payload = prepareStatementsPayload(statements, categories, "wikilinksOnly");
	assert.deepEqual(payload.categories, categories, "labels still travel with the statements");
	assert.equal(payload.contextSettings?.categoriesAsMentions, undefined);
	assert.equal(
		payload.contextSettings?.doubleSquarebracketsProcessing,
		"PROCESS_AS_HASHTAGS_IGNORE_THE_REST",
		"the mode's own bracket handling is kept",
	);
	// default mode + categories: nothing to send at all
	assert.equal(prepareStatementsPayload(statements, categories, "default").contextSettings, undefined);
});

test("categoriesAsNodes: true turns the labels into [[label]] nodes", () => {
	const settings = statementsContextSettings("wikilinksOnly", true, true);
	assert.equal(settings.categoriesAsMentions, true);
	assert.equal(settings.mentionsProcessing, "CONNECT_TO_ALL_CONCEPTS");
	assert.equal(settings.doubleSquarebracketsProcessing, "PROCESS_AS_HASHTAGS");
	const payload = prepareStatementsPayload(statements, categories, undefined, undefined, true);
	assert.equal(payload.contextSettings?.categoriesAsMentions, true);
});

test("the flag is a no-op without any real label", () => {
	assert.deepEqual(statementsContextSettings("default", false, true), {});
	assert.equal(prepareStatementsPayload(statements, [[], []], undefined, undefined, true).contextSettings, undefined);
});

test("parent modes always make the parent (category) a node", () => {
	for (const mode of ["obsidianStyle", "parentAndConcepts"]) {
		assert.equal(statementsContextSettings(mode, true, false).categoriesAsMentions, true, mode);
	}
	assert.equal(statementsContextSettings("obsidianStyle", true).mentionsProcessing, "CONNECT_TO_CONCEPTS_ONLY");
});

test("schemas default categoriesAsNodes to false and accept true", () => {
	const parsed = CreateGraphSchema.parse({ graphName: "g", statements, categories });
	assert.equal(parsed.categoriesAsNodes, false);
	assert.equal(CreateGraphSchema.parse({ graphName: "g", statements, categories, categoriesAsNodes: true }).categoriesAsNodes, true);
	const overlap = GenerateOverlapGraphFromTextsSchema.parse({
		contexts: [{ statements, categories }, { statements, categories }],
	});
	assert.equal(overlap.categoriesAsNodes, false);
});

test("comparison contexts follow the top-level flag", async () => {
	const items = [{ statements, categories }, { statements, categories }];
	const fetchGraph = async () => ({ ok: true, text: "" });
	const off = await resolveContexts(items, fetchGraph);
	assert.ok(off.ok);
	assert.equal(off.contextSettings, undefined);
	const on = await resolveContexts(items, fetchGraph, { categoriesAsNodes: true });
	assert.ok(on.ok);
	assert.equal(on.contextSettings?.categoriesAsMentions, true);
});
