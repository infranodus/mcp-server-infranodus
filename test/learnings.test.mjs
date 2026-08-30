// Pure helpers of the project-learnings tools (no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	learningsGraphName,
	slugify,
	redactionIssues,
	dedupeAgainstExisting,
	errorText,
	MAX_GRAPH_NAME_LENGTH,
} from "../dist/utils/learnings.js";

test("graph names are slugged, prefixed, and never longer than the API limit", () => {
	assert.equal(learningsGraphName("mcp-server-infranodus"), "learn-mcp-server-infranodus");
	assert.equal(learningsGraphName("My Project / Alpha!!"), "learn-my-project-alpha");
	assert.equal(learningsGraphName("///"), "learn-project");
	const long = learningsGraphName("a-very-long-project-name-that-goes-on-forever");
	assert.ok(long.length <= MAX_GRAPH_NAME_LENGTH);
	assert.ok(!long.endsWith("-"));
	assert.equal(slugify("  Foo  Bar  "), "foo-bar");
});

test("redaction lint reports indices and reasons, never content", () => {
	const issues = redactionIssues([
		"Fine statement about [[src/index.ts]] and [[wrapHandler]].",
		"Set api_key = abcdefgh12345 in the config",
		"Use https://user:pass@host.example/path",
		"x".repeat(401),
		"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
		"   ",
	]);
	assert.deepEqual(
		issues.map((issue) => [issue.index, issue.reason]),
		[[1, "secret-like"], [2, "secret-like"], [3, "too-long"], [4, "secret-like"], [5, "empty"]],
	);
	for (const issue of issues) assert.equal(Object.keys(issue).length, 2);
});

test("dedupe marks near-duplicates as reinforced and collapses in-batch repeats", () => {
	const existing = [
		"The list of available AI model names is duplicated in 9 places: [[src/schemas/index.ts]], [[src/instructions.ts]], [[src/resources/about.ts]], [[README.md]].",
	];
	const plan = dedupeAgainstExisting(
		[
			"Available AI model names are duplicated across 9 places: [[src/schemas/index.ts]], [[src/instructions.ts]], [[src/resources/about.ts]], [[README.md]] and the tool defaults.",
			"[[wrapHandler]] in [[src/index.ts]] is the single place to add per-call context such as elicitation.",
			"[[wrapHandler]] in [[src/index.ts]] is the one place to add per-call context like elicitation.",
		],
		existing,
	);
	assert.equal(plan[0].status, "reinforced");
	assert.ok(plan[0].statement.startsWith("Confirmed again: The list of available"));
	assert.equal(plan[1].status, "new");
	assert.equal(plan[2].status, "reinforced");
});

test("errorText normalises the API's error shapes", () => {
	assert.equal(errorText("plain"), "plain");
	assert.equal(errorText({ statusCode: 400, message: ["a", "b"] }), "a; b");
	assert.equal(errorText({ message: "single" }), "single");
	assert.equal(errorText({ weird: true }), '{"weird":true}');
});
