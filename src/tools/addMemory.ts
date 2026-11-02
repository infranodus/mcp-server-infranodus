import { z } from "zod";
import { brand } from "../config/brand.js";
import { AddMemorySchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { resolveGraphInput } from "../utils/graphInput.js";
import { transformToStructuredOutput } from "../utils/transformers.js";
import { callMemoryEndpoint } from "../api/client.js";
import { validateStatementsInput } from "../utils/graphInput.js";
import { dryRunAskWrite } from "../utils/elicitApproval.js";
import { memoryResult } from "../utils/memoryResult.js";
import type { ToolExtra } from "../types/index.js";

/**
 * Scope mode: the kept topic / personal memory, through the app's
 * /memory/add (consent marker, redaction, duplicates, two-entity rule).
 */
async function addToScope(
	params: z.infer<typeof AddMemorySchema>,
	extra?: ToolExtra,
) {
	const statements =
		params.statements && params.statements.length > 0
			? params.statements
			: (params.text ?? "")
					.split(/\n+/)
					.map((line) => line.trim())
					.filter(Boolean);
	if (statements.length === 0) {
		return errorContent("Provide the memory as statements (or text, one statement per line).");
	}
	const usesMetadata = params.statements && params.statements.length > 0;
	const categories = usesMetadata && params.categories?.length ? params.categories : undefined;
	const timestamps = usesMetadata && params.timestamps?.length ? params.timestamps : undefined;
	const invalid = validateStatementsInput(statements, categories, timestamps);
	if (invalid) return errorContent(invalid);

	const response = await dryRunAskWrite(
		(confirm) =>
			callMemoryEndpoint("/memory/add", {
				scope: params.scope,
				...(params.topic ? { topic: params.topic } : {}),
				statements,
				...(categories ? { categories } : {}),
				...(timestamps ? { timestamps } : {}),
				confirm,
			}),
		{
			confirm: params.confirm,
			extra,
			question: (graphName, count) =>
				`Save these ${count} statement(s) to ${graphName} in ${brand.name}?`,
			saveTitle: "Save to memory",
			noun: "statement",
		},
	);
	return memoryResult(response);
}

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

export const addMemoryTool = {
	name: "memory_add_relations",
	definition: {
		title: `Save to ${brand.name} Memory`,
		description:
			`Save statements to a named persistent memory graph in the user's ${brand.name} account and return its name and URL. Use whenever the user says "remember this", "save this to memory", "add to ${brand.name} memory", or wants ideas, plans, or decisions from the conversation kept. Mark entities with [[wikilinks]] (at least two per statement), pass categories and timestamps for later filtering. ` +
			`Two ways: with graphName it writes immediately to that graph (no opt-in, no dry run; reuse graphName to append). With scope it writes to the user's kept memory instead of a graph you name — 'topic' + topic for an outside subject, client or case, 'personal' for the user's own preferences and setup — which must be enabled with enable_memory and is a dry run until confirm: true, like add_project_learnings. ` +
			`Distinct from add_project_learnings, which is gated operational knowledge about a codebase; personal facts never go there.`,
		inputSchema: AddMemorySchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof AddMemorySchema>,
		extra?: ToolExtra,
	) => {
		try {
			if (params.scope) return await addToScope(params, extra);
			if (!params.graphName) {
				return errorContent(
					"Provide graphName (a named graph, written immediately) or scope ('topic' with topic, or 'personal').",
				);
			}
			const includeNodesAndEdges = params.addNodesAndEdges;
			const includeGraph = params.includeGraph;
			const buildingEntitiesGraph =
				params.modifyAnalyzedText == "extractEntitiesOnly" ? true : false;
			// Build query parameters
			const queryParams = new URLSearchParams({
				doNotSave: "false",
				addStats: "true",
				...(params.multifractal ? { multifractal: "true" } : {}),
				includeStatements: params.includeStatements ? "true" : "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: includeGraph || buildingEntitiesGraph ? "true" : "false",
				compactGraph: includeGraph || buildingEntitiesGraph ? "true" : "false",
				compactStatements: params.includeStatements ? "true" : "false",
				aiTopics: "true",
				optimize: "develop",
			});

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			// graphName here is where the memory is saved, not a content source,
			// so the content still comes from text or statements.
			const input = await resolveGraphInput(params);
			if (!input.ok) return errorContent(input.error);

			const requestBody: any = {
				name: params.graphName,
				aiTopics: "true",
				contextType: "memory",
				...input.payload,
			};

			if (params.modifyAnalyzedText && params.modifyAnalyzedText !== "none") {
				requestBody.modifyAnalyzedText = params.modifyAnalyzedText;
			}

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			if (response.error) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: ${response.error}`,
						},
					],
					isError: true,
				};
			}

			const structuredOutput = transformToStructuredOutput(
				response,
				includeGraph,
				includeNodesAndEdges,
				buildingEntitiesGraph,
			);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(structuredOutput, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							error: error instanceof Error ? error.message : String(error),
						}),
					},
				],
				isError: true,
			};
		}
	},
};
