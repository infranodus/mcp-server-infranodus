import { z } from "zod";
import { brand } from "../config/brand.js";
import {
	AnalyzeTextSignatureSchema,
	AnalyzeTextSignatureSchemaBase,
} from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { resolveGraphInput } from "../utils/graphInput.js";
import { buildTextSignature } from "../utils/textSignature.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

export const analyzeTextSignatureTool = {
	name: "analyze_text_signature",
	definition: {
		title: "Text Signature: structure, rhythm, and AI-likeness of a text",
		description:
			`Structural and rhythmic signature of a text, URL, or YouTube transcript: how the discourse moves through its ${brand.name} concept network (burstiness, fractal scaling, multifractality, topic crossings), how its topics are distributed (modularity, diversity, entropy), and the sentence-length rhythm of the source. Every number comes with a plain-language reading, the profile gets a name (essay, digest, anthology, notes...), and a final layer weighs the rhythm evidence into a hedged AI-likeness estimate. Use to compare writing styles, characterise an author or genre, and flag flat, uniformly paced text typical of generated content. Not a detector on its own.`,
		inputSchema: AnalyzeTextSignatureSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
			openWorldHint: true,
		},
	},
	handler: async (params: z.infer<typeof AnalyzeTextSignatureSchema>) => {
		try {
			// Everything this tool reports now arrives inside
			// fractal_variability, which the compact graph carries, so both
			// compaction flags are on. They used to be off only because the
			// amplitude and sentence measures were computed here from the raw
			// node positions, communities and statement contents; the backend
			// computes them now. Statements are still requested because the
			// backend derives the trajectory from them. No AI topics, no
			// summary: the tool is numeric.
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				...(params.multifractal ? { multifractal: "true" } : {}),
				includeStatements: "true",
				includeGraph: "true",
				compactGraph: "true",
				compactStatements: "true",
				includeGraphSummary: "false",
			});
			if (params.maxNodes && params.maxNodes > 0) {
				queryParams.set("maxnodes", String(params.maxNodes));
			}

			const endpoint = `/graphAndStatements?${queryParams.toString()}`;

			const input = await resolveGraphInput(params);
			if (!input.ok) return errorContent(input.error);

			const response = await makeInfraNodusRequest(endpoint, {
				...input.payload,
				modifyAnalyzedText: params.modifyAnalyzedText ?? "none",
			});
			if (response.error) return errorContent(response.error);

			const graph = (response as any).graph?.graphologyGraph;
			const attributes = graph?.attributes ?? {};
			if (!attributes.fractal_variability && !attributes.diversity_stats) {
				return errorContent(
					"The API returned no network statistics for this text (too short, or a backend without fractal_variability).",
				);
			}

			const output = buildTextSignature({
				modularity: attributes.modularity,
				diversity: attributes.diversity_stats,
				fractal: attributes.fractal_variability,
				degreeDistribution: attributes.degree_distribution ?? null,
			});

			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(output, null, 2) },
				],
			};
		} catch (error) {
			return errorContent(
				error instanceof Error ? error.message : String(error),
			);
		}
	},
};
