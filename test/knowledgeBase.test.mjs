import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeState, readState, dedupeList, FOCUSES, STATES } from "../dist/utils/knowledgeBase.js";

test("normalizeState finds the state inside the engine's strings", () => {
	assert.equal(normalizeState("Biased"), "biased");
	assert.equal(normalizeState("diversified (balanced)"), "diversified");
	assert.equal(normalizeState(42), undefined);
	assert.equal(normalizeState("something else"), undefined);
});

test("every focus has a reading for every state", () => {
	for (const focus of FOCUSES) for (const state of STATES) {
		const r = readState(focus, state);
		assert.ok(r.meaning.length > 20 && r.action.length > 20, `${focus}/${state}`);
	}
	assert.notEqual(readState("codebase", "diversified").action, readState("vault", "diversified").action);
});

test("dedupeList is case-insensitive, trims, drops empties, and bounds", () => {
	assert.deepEqual(dedupeList([" A ", "a", undefined, "", "b", "c"], 2), ["A", "b"]);
});
