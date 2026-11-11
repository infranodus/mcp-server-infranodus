// Drive the learnings and memory tools through their real handlers and an
// intercepted fetch (no network), against the app's /learnings/* and
// /memory/* contracts (infranodus-app routes/memory.js). The rules (consent,
// redaction, duplicates, naming) live in the app and are tested there; here
// we check what the tools send, what they hand back, and the approval flow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConfig } from "../dist/api/config-store.js";
import { getProjectLearningsTool } from "../dist/tools/getProjectLearnings.js";
import { addProjectLearningsTool } from "../dist/tools/addProjectLearnings.js";
import { enableProjectLearningsTool } from "../dist/tools/enableProjectLearnings.js";
import { addMemoryTool } from "../dist/tools/addMemory.js";
import { getMemoryTool } from "../dist/tools/getMemory.js";
import { enableMemoryTool } from "../dist/tools/enableMemory.js";
import {
	AddMemorySchema,
	AddProjectLearningsSchema,
	getMemorySchema,
} from "../dist/schemas/index.js";

function fakeResponse(json, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => json,
		text: async () => JSON.stringify(json),
	};
}

/** routes: { "/learnings/add": (body) => [json, status?] } */
function withRoutes(routes, fn) {
	return async () => {
		const originalFetch = globalThis.fetch;
		const calls = [];
		globalThis.fetch = async (url, init) => {
			const path = String(url).replace("https://api.test", "").split("?")[0];
			const body = JSON.parse(init.body);
			calls.push({ path, body });
			const route = routes[path];
			if (!route) throw new Error(`unexpected request: ${path}`);
			const [json, status] = route(body);
			return fakeResponse(json, status ?? 200);
		};
		try {
			await fn(calls);
		} finally {
			globalThis.fetch = originalFetch;
		}
	};
}

const run = (tool, params, extra) =>
	runWithConfig({ apiBase: "https://api.test", apiKey: "k" }, () =>
		tool.handler(params, extra),
	);

const payload = (result) => JSON.parse(result.content[0].text);

const PLAN = {
	enabled: true,
	written: 0,
	dryRun: true,
	graphName: "learn-demo",
	wouldWrite: [
		{ statement: "[[a.ts]] calls [[b.ts]].", type: "location", status: "new" },
	],
	nextStep: "Show these to the user ...",
};
const WRITTEN = {
	enabled: true,
	written: 1,
	new: 1,
	reinforced: 0,
	graphName: "learn-demo",
	url: "https://infranodus.com/u/learn-demo/edit",
};
const addLearnings = (body) => [body.confirm ? WRITTEN : PLAN];

const learningsParams = (overrides = {}) =>
	AddProjectLearningsSchema.parse({
		project: "demo",
		statements: ["[[a.ts]] calls [[b.ts]]."],
		types: ["location"],
		...overrides,
	});

function elicitingExtra(answer) {
	const asked = [];
	return {
		asked,
		extra: {
			clientCapabilities: { elicitation: {} },
			clientName: "test-client",
			elicit: async (request) => {
				asked.push(request);
				return answer;
			},
		},
	};
}

// --- get_project_learnings ------------------------------------------------

test(
	"get_project_learnings sends its inputs to /learnings/get and returns the answer as is",
	withRoutes(
		{
			"/learnings/get": () => [
				{ enabled: true, project: "demo", graphName: "learn-demo", learnings: [{ content: "x" }] },
			],
		},
		async (calls) => {
			const result = await run(getProjectLearningsTool, {
				project: "demo",
				prompt: "fix the build",
				type: "trap",
				limit: 5,
			});
			assert.ok(!result.isError);
			assert.equal(calls.length, 1, "one HTTP call per tool call");
			assert.deepEqual(
				{ ...calls[0].body, modal: undefined, source: undefined },
				{ project: "demo", prompt: "fix the build", type: "trap", limit: 5, modal: undefined, source: undefined },
			);
			assert.equal(payload(result).learnings[0].content, "x");
		},
	),
);

test(
	"get_project_learnings passes order and uncheckedFor only when given",
	withRoutes(
		{ "/learnings/get": () => [{ enabled: true, project: "demo", unchecked: 3, learnings: [] }] },
		async (calls) => {
			const result = await run(getProjectLearningsTool, {
				project: "demo",
				limit: 50,
				order: "oldest",
				uncheckedFor: 30,
			});
			assert.ok(!result.isError);
			assert.equal(calls[0].body.order, "oldest");
			assert.equal(calls[0].body.uncheckedFor, 30);
			assert.equal(payload(result).unchecked, 3);

			await run(getProjectLearningsTool, { project: "demo", limit: 15 });
			assert.ok(!("order" in calls[1].body));
			assert.ok(!("uncheckedFor" in calls[1].body));
		},
	),
);

test(
	"get_project_learnings: a project without learnings is not an error",
	withRoutes(
		{ "/learnings/get": () => [{ enabled: false, project: "nope", graphName: "learn-nope", learnings: [] }] },
		async () => {
			const result = await run(getProjectLearningsTool, { project: "nope", limit: 15 });
			assert.ok(!result.isError);
			assert.equal(payload(result).enabled, false);
		},
	),
);

// --- enable_project_learnings ---------------------------------------------

test(
	"enable_project_learnings passes the client name (for the graph description)",
	withRoutes(
		{ "/learnings/enable": (body) => [{ enabled: true, project: body.project, graphName: "learn-demo" }] },
		async (calls) => {
			const result = await run(enableProjectLearningsTool, { project: "demo" }, { clientName: "claude-code" });
			assert.ok(!result.isError);
			assert.equal(calls[0].body.client, "claude-code");
			assert.equal(payload(result).enabled, true);
		},
	),
);

// --- add_project_learnings ------------------------------------------------

test(
	"add_project_learnings without confirm or elicitation is one dry-run call and writes nothing",
	withRoutes({ "/learnings/add": addLearnings }, async (calls) => {
		const result = await run(addProjectLearningsTool, learningsParams());
		assert.ok(!result.isError);
		assert.equal(calls.length, 1);
		assert.equal(calls[0].body.confirm, false);
		const report = payload(result);
		assert.equal(report.dryRun, true);
		assert.equal(report.written, 0);
		assert.equal(report.elicitation, "client does not support elicitation");
		assert.equal(report.wouldWrite.length, 1);
	}),
);

test(
	"add_project_learnings with confirm: true writes in one call",
	withRoutes({ "/learnings/add": addLearnings }, async (calls) => {
		const result = await run(addProjectLearningsTool, learningsParams({ confirm: true }));
		assert.equal(calls.length, 1);
		assert.equal(calls[0].body.confirm, true);
		assert.deepEqual(calls[0].body.types, ["location"]);
		assert.equal(payload(result).written, 1);
	}),
);

test(
	"add_project_learnings: approval through elicitation writes in the same tool call",
	withRoutes({ "/learnings/add": addLearnings }, async (calls) => {
		const { extra, asked } = elicitingExtra({ action: "accept", content: { save: true } });
		const result = await run(addProjectLearningsTool, learningsParams(), extra);
		assert.deepEqual(calls.map((c) => c.body.confirm), [false, true]);
		assert.equal(asked.length, 1);
		assert.match(asked[0].message, /Save these 1 project learning\(s\) to learn-demo/);
		assert.match(asked[0].message, /1\. \[location\] \[\[a\.ts\]\] calls/);
		assert.equal(payload(result).written, 1);
	}),
);

test(
	"add_project_learnings: a declined or 'save: false' answer writes nothing",
	withRoutes({ "/learnings/add": addLearnings }, async (calls) => {
		for (const answer of [
			{ action: "decline" },
			{ action: "accept", content: { save: false, note: "shorter please" } },
		]) {
			calls.length = 0;
			const { extra } = elicitingExtra(answer);
			const report = payload(await run(addProjectLearningsTool, learningsParams(), extra));
			assert.deepEqual(calls.map((c) => c.body.confirm), [false]);
			assert.equal(report.declined, true);
			assert.equal(report.written, 0);
		}
	}),
);

test(
	"add_project_learnings: a dismissed dialog falls back to the dry-run plan",
	withRoutes({ "/learnings/add": addLearnings }, async (calls) => {
		const { extra } = elicitingExtra({ action: "cancel" });
		const report = payload(await run(addProjectLearningsTool, learningsParams(), extra));
		assert.equal(calls.length, 1);
		assert.equal(report.dryRun, true);
		assert.match(report.elicitation, /dismissed/);
	}),
);

test(
	"add_project_learnings still refuses when the project isn't enabled (the app decides, the tool passes it on)",
	withRoutes(
		{
			"/learnings/add": () => [
				{ enabled: false, written: 0, project: "demo", graphName: "learn-demo", message: 'Learnings are not enabled for "demo".' },
			],
		},
		async (calls) => {
			const { extra, asked } = elicitingExtra({ action: "accept", content: { save: true } });
			const result = await run(addProjectLearningsTool, learningsParams(), extra);
			assert.ok(!result.isError);
			assert.equal(calls.length, 1);
			assert.equal(asked.length, 0, "nothing to ask about");
			assert.equal(payload(result).enabled, false);
		},
	),
);

test(
	"add_project_learnings: a redaction refusal (422) comes back as an error with indices only",
	withRoutes(
		{
			"/learnings/add": () => [
				{ enabled: true, written: 0, rejected: [{ index: 0, reason: "secret-like" }], message: "Batch rejected." },
				422,
			],
		},
		async () => {
			const result = await run(addProjectLearningsTool, learningsParams());
			assert.equal(result.isError, true);
			assert.deepEqual(payload(result).rejected, [{ index: 0, reason: "secret-like" }]);
		},
	),
);

test(
	"a 5xx answer becomes { error } instead of throwing",
	withRoutes({ "/learnings/get": () => [{ error: "boom" }, 500] }, async () => {
		const result = await run(getProjectLearningsTool, { project: "demo", limit: 15 });
		assert.equal(result.isError, true);
		assert.match(payload(result).error, /500.*boom/);
	}),
);

// --- memory_add_relations / memory_get_relations ---------------------------

test(
	"memory_add_relations with only graphName writes to that graph as before",
	withRoutes(
		{
			"/graphAndStatements": (body) => [
				{ graphName: body.name, statements: [], graph: { graphologyGraph: { attributes: {}, nodes: [], edges: [] } } },
			],
		},
		async (calls) => {
			const params = AddMemorySchema.parse({
				graphName: "my-notes",
				text: "[[Alice]] works with [[Bob]].",
			});
			const result = await run(addMemoryTool, params);
			assert.ok(!result.isError, JSON.stringify(result));
			assert.equal(calls.length, 1);
			assert.equal(calls[0].path, "/graphAndStatements");
			assert.equal(calls[0].body.name, "my-notes");
			assert.equal(calls[0].body.contextType, "memory");
		},
	),
);

test(
	"memory_add_relations with scope goes to /memory/add as a dry run, one statement per line of text",
	withRoutes(
		{
			"/memory/add": (body) => [
				{
					enabled: true,
					written: 0,
					dryRun: true,
					scope: body.scope,
					graphName: "memory-acme",
					wouldWrite: body.statements.map((statement) => ({ statement, status: "new" })),
				},
			],
		},
		async (calls) => {
			const params = AddMemorySchema.parse({
				scope: "topic",
				topic: "Acme",
				text: "[[Acme]] uses [[Stripe]].\n\n[[Acme]] is based in [[Berlin]].",
			});
			const result = await run(addMemoryTool, params);
			assert.ok(!result.isError, JSON.stringify(result));
			assert.equal(calls.length, 1);
			assert.equal(calls[0].path, "/memory/add");
			assert.equal(calls[0].body.topic, "Acme");
			assert.equal(calls[0].body.confirm, false);
			assert.deepEqual(calls[0].body.statements, [
				"[[Acme]] uses [[Stripe]].",
				"[[Acme]] is based in [[Berlin]].",
			]);
			assert.equal(payload(result).dryRun, true);
		},
	),
);

test(
	"memory_add_relations with scope passes categories and timestamps, and writes with confirm",
	withRoutes(
		{ "/memory/add": () => [{ enabled: true, written: 1, scope: "personal", graphName: "personal-me" }] },
		async (calls) => {
			const params = AddMemorySchema.parse({
				scope: "personal",
				statements: ["[[I]] prefer [[pnpm]] over [[npm]]."],
				categories: [["tooling"]],
				timestamps: ["2026-11-01"],
				confirm: true,
			});
			const result = await run(addMemoryTool, params);
			assert.ok(!result.isError);
			assert.deepEqual(calls[0].body.categories, [["tooling"]]);
			assert.deepEqual(calls[0].body.timestamps, ["2026-11-01"]);
			assert.equal(calls[0].body.confirm, true);
		},
	),
);

test(
	"memory_add_relations without graphName or scope is refused before any call",
	withRoutes({}, async (calls) => {
		const result = await run(addMemoryTool, AddMemorySchema.parse({ text: "[[a]] and [[b]]" }));
		assert.equal(result.isError, true);
		assert.equal(calls.length, 0);
	}),
);

test(
	"memory_get_relations with scope reads /memory/get; without scope it keeps the /search path",
	withRoutes(
		{
			"/memory/get": () => [{ enabled: true, scope: "topic", graphName: "memory-acme", statements: [{ content: "s" }] }],
			"/search": () => [{ entriesAdded: { texts: ["[[Acme]] uses [[Stripe]]."] } }],
		},
		async (calls) => {
			const scoped = await run(
				getMemoryTool,
				getMemorySchema.parse({ scope: "topic", topic: "Acme", entityName: "[[Stripe]]" }),
			);
			assert.ok(!scoped.isError);
			assert.equal(calls[0].path, "/memory/get");
			assert.equal(calls[0].body.entity, "[[Stripe]]");
			assert.equal(calls[0].body.limit, 15);

			await run(getMemoryTool, getMemorySchema.parse({ entityName: "[[Stripe]]" }));
			assert.equal(calls[1].path, "/search");
		},
	),
);

test(
	"enable_memory sends scope, topic and client",
	withRoutes(
		{ "/memory/enable": (body) => [{ enabled: true, scope: body.scope, graphName: "memory-acme" }] },
		async (calls) => {
			const result = await run(enableMemoryTool, { scope: "topic", topic: "Acme" }, { clientName: "cursor" });
			assert.ok(!result.isError);
			assert.deepEqual(
				{ scope: calls[0].body.scope, topic: calls[0].body.topic, client: calls[0].body.client },
				{ scope: "topic", topic: "Acme", client: "cursor" },
			);
		},
	),
);

test(
	"language is passed on to every memory endpoint when given",
	withRoutes(
		{
			"/learnings/enable": () => [{ enabled: true }],
			"/learnings/get": () => [{ enabled: true, learnings: [] }],
			"/learnings/add": addLearnings,
			"/memory/enable": () => [{ enabled: true }],
			"/memory/add": () => [{ enabled: true, written: 1 }],
			"/memory/get": () => [{ enabled: true, statements: [] }],
		},
		async (calls) => {
			await run(enableProjectLearningsTool, { project: "demo", language: "DE" });
			await run(getProjectLearningsTool, { project: "demo", limit: 15, language: "DE" });
			await run(addProjectLearningsTool, learningsParams({ language: "DE", confirm: true }));
			await run(enableMemoryTool, { scope: "personal", language: "DE" });
			await run(addMemoryTool, AddMemorySchema.parse({ scope: "personal", statements: ["[[a]] and [[b]]"], confirm: true, language: "DE" }));
			await run(getMemoryTool, getMemorySchema.parse({ scope: "personal", language: "DE" }));
			assert.equal(calls.length, 6);
			for (const call of calls) assert.equal(call.body.language, "DE", call.path);

			calls.length = 0;
			await run(getProjectLearningsTool, { project: "demo", limit: 15 });
			assert.ok(!("language" in calls[0].body), "omitted when not given");
		},
	),
);
