import { makeInfraNodusRequest } from "../api/client.js";
import { ToolHandlerContext } from "../types/index.js";
import { chunkByLines } from "./chunkByLines.js";
import { ProgressReporter } from "./progress.js";
import { extractLineSeparatedStatements } from "./transformers.js";
import { prepareStatementsPayload, type WikilinksPayload } from "./wikilinksMode.js";
import { DEFAULT_GRAPH_MODEL } from "../config/models.js";

const DEFAULT_CHUNK_SIZE = 12000;
const WIKILINK = /\[\[[^[\]]+\]\]/g;

/** The app's 'entity graph' prompt promises at least two [[entities]] per
 * statement; anything else (a stray heading, a code fence) is not a relation. */
export function connectsTwoEntities(statement: string): boolean {
	return (statement.match(WIKILINK)?.length ?? 0) >= 2;
}

export type EntityStatementsResult =
	| { ok: true; statements: string[]; chunks: number }
	| { ok: false; error: string };

/**
 * modifyAnalyzedText 'aiKnowledgeGraph': an AI model writes [[entity]]
 * statements about the input — a topic or a text — with the app's
 * 'entity graph' prompt, one /aiAdvice call per chunk. Nothing is saved here.
 */
export async function generateEntityStatements(
	{
		source,
		modelToUse,
		instructions,
		chunkSize = DEFAULT_CHUNK_SIZE,
	}: {
		source: string;
		modelToUse?: string;
		instructions?: string;
		chunkSize?: number;
	},
	context?: ToolHandlerContext,
): Promise<EntityStatementsResult> {
	const chunks = chunkByLines(source.trim(), chunkSize);
	if (chunks.length === 0) {
		return { ok: false, error: "Provide a topic or a text to build the knowledge graph from." };
	}

	const progress = new ProgressReporter(context ?? {}, chunks.length);
	const statements: string[] = [];
	for (const [index, chunk] of chunks.entries()) {
		await progress.report(
			index,
			`Writing entity statements: part ${index + 1} of ${chunks.length}`,
		);
		const response = await makeInfraNodusRequest("/aiAdvice", {
			saveToGraphAndRedirect: false,
			aiQueryType: "entity graph",
			mode: "gptchat",
			modelToUse: modelToUse ?? DEFAULT_GRAPH_MODEL,
			prompt: [{ role: "user", content: chunk }],
			modifyAnalyzedText: "none",
			replaceEntities: false,
			...(instructions?.trim() ? { systemPrompt: instructions.trim() } : {}),
		});
		// /aiAdvice returns error envelopes with HTTP 200.
		if (response.error) {
			const message =
				typeof response.error === "object"
					? JSON.stringify(response.error)
					: String(response.error);
			return {
				ok: false,
				error:
					chunks.length > 1
						? `Part ${index + 1} of ${chunks.length} failed: ${message}`
						: message,
			};
		}
		statements.push(
			...extractLineSeparatedStatements(response).filter(connectsTwoEntities),
		);
	}
	await progress.report(chunks.length, "Entity statements written");

	if (statements.length === 0) {
		return {
			ok: false,
			error:
				"The AI model returned no statements with two [[entities]]. Try again, give more context, or choose another model.",
		};
	}
	return { ok: true, statements, chunks: chunks.length };
}

/**
 * Turn the resolved input of generate/create_knowledge_graph into the
 * statements payload of an AI knowledge graph: entity statements written by
 * the AI, built with wikilinksOnly so only those [[entities]] become nodes.
 * Categories and timestamps of the input do not carry over to AI statements.
 */
export async function aiKnowledgeGraphPayload(
	input: WikilinksPayload & { text: string },
	options: { modelToUse?: string; instructions?: string },
	context?: ToolHandlerContext,
): Promise<{ ok: true; payload: WikilinksPayload & { text: string } } | { ok: false; error: string }> {
	const source = input.statements?.length ? input.statements.join("\n") : input.text;
	const generated = await generateEntityStatements({ source, ...options }, context);
	if (!generated.ok) return generated;
	return {
		ok: true,
		payload: prepareStatementsPayload(
			generated.statements,
			undefined,
			"wikilinksOnly",
		) as WikilinksPayload & { text: string },
	};
}
