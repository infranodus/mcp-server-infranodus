import { z } from "zod";
import { GenerateOntologyGraphSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { getConfig } from "../api/config-store.js";
import { extractOntologyStatements } from "../utils/transformers.js";
import { OntologyGraphOutput } from "../types/index.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

// Derive the InfraNodus app base URL (e.g. https://infranodus.com) from the
// API base URL (e.g. https://infranodus.com/api/v1) so we can build graph links.
function appBaseUrl(): string {
	const apiBase = getConfig().apiBase || "https://infranodus.com/api/v1";
	return apiBase.replace(/\/api\/v1\/?$/, "");
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 30);
}

function defaultOntologyName(prompt: string): string {
	const timestamp = new Date()
		.toISOString()
		.slice(2, 16)
		.replace(/[-:T]/g, "");
	const slug = slugify(prompt.split(" ").slice(0, 3).join(" "));
	return slug ? `ai_onto_${slug}_${timestamp}` : `ai_onto_${timestamp}`;
}

export const generateOntologyGraphTool = {
	name: "generate_ontology_graph",
	definition: {
		title: "Generate an AI Ontology Graph from a Topic or Prompt",
		description:
			"Use AI to generate a reasoning ontology knowledge graph (entities and the relations between them) for a topic, prompt, or text, and optionally save it as an InfraNodus graph. By default the graph is saved and a link is returned. Set saveGraph to false if the user asks not to save, or when you only need a one-off AI ontology overview of a topic for the current context that won't be reused later.",
		inputSchema: GenerateOntologyGraphSchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: false,
		},
	},
	handler: async (params: z.infer<typeof GenerateOntologyGraphSchema>) => {
		try {
			const saveGraph = params.saveGraph !== false;
			const graphName =
				params.graphName?.trim() || defaultOntologyName(params.prompt);

			const requestBody: any = {
				saveToGraphAndRedirect: saveGraph,
				contextName: graphName,
				aiQueryType: "ontology graph",
				mode: "gptchat",
				modelToUse: params.modelToUse ?? "gpt-5.4",
				prompt: [{ role: "user", content: params.prompt }],
				numberOfResults: String(params.numberOfResults ?? 10),
				modifyAnalyzedText: "extractEntitiesOnly",
				contextType: "ONTOLOGY",
				replaceEntities: false,
				hideSearchTerms: true,
			};

			const response = await makeInfraNodusRequest("/aiAdvice", requestBody);

			// The /aiAdvice endpoint returns error envelopes with HTTP 200, so the
			// request does not throw — we must check response.error explicitly.
			if (response.error) {
				return errorContent(
					typeof response.error === "object"
						? JSON.stringify(response.error)
						: String(response.error),
				);
			}

			let output: OntologyGraphOutput;

			if (saveGraph) {
				const redirectUrl = response.redirectUrl;
				if (!redirectUrl) {
					return errorContent(
						"The ontology was generated but no graph link was returned, so it may not have been saved. Check that your InfraNodus API key is valid (an anonymous/demo key does not persist graphs).",
					);
				}

				const base = appBaseUrl();
				// redirectUrl looks like /<userName>/<contextName>/edit
				const viewUrl = redirectUrl.replace(/\/edit\/?$/, "");

				output = {
					saved: true,
					graphName,
					graphUrl: `${base}${viewUrl}`,
					editUrl: `${base}${redirectUrl}`,
					message: `Ontology graph "${graphName}" generated and saved.`,
				};
			} else {
				const ontologyStatements = extractOntologyStatements(response);
				output = {
					saved: false,
					ontologyStatements,
					message:
						ontologyStatements.length > 0
							? "Ontology generated (not saved). Use saveGraph: true to persist it as an InfraNodus graph."
							: "The AI did not return any ontology statements. Try a more specific prompt or a more capable model.",
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(output, null, 2),
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
