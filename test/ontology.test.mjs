import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkByLines } from "../dist/tools/generateOntologyGraph.js";

test("chunkByLines splits on line boundaries and never cuts a statement", () => {
	const lines = Array.from({ length: 50 }, (_, i) => `[[a${i}]] relates to [[b${i}]]`);
	const text = lines.join("\n");
	const chunks = chunkByLines(text, 200);
	assert.ok(chunks.length > 1);
	for (const chunk of chunks) {
		assert.ok(chunk.length <= 200 + 40, "a chunk may exceed only by the last line it kept");
		for (const line of chunk.split("\n")) assert.ok(lines.includes(line), `cut line: ${line}`);
	}
	assert.equal(chunks.join("\n"), text, "concatenation reproduces the input");
});

test("chunkByLines keeps an oversized single line and drops blank-only chunks", () => {
	const long = "x".repeat(500);
	assert.deepEqual(chunkByLines(long, 100), [long]);
	assert.deepEqual(chunkByLines("\n\n  \n", 100), []);
	assert.deepEqual(chunkByLines("a\nb", 100), ["a\nb"]);
});
