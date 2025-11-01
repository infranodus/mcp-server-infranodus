import { z } from "zod";
import { DevelopLatentConceptsSchema } from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { extractLatentTopicsIdeas } from "../utils/transformers.js";

export const developLatentTopicsTool = {
	name: "develop_latent_topics",
	definition: {
		title: "Develop Latent Topics in Text",
		description:
			"Analyze text, extract underdeveloped topics and get an idea on how to develop them",
		inputSchema: DevelopLatentConceptsSchema.shape,
		annotations: {
		   "readOnlyHint": true,
		   "idempotentHint": true,
		   "destructiveHint": false
		},
	},
	handler: async (params: z.infer<typeof DevelopLatentConceptsSchema>) => {
		try {
			// Build query parameters
			const queryParams = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				optimize: "latent",
				includeStatements: "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: "false",
				aiTopics: "true",
			});

			const endpoint = `/graphAndAdvice?${queryParams.toString()}`;

			const requestBody: any = {
				text: params.text,
				aiTopics: "true",
				requestMode: "question",
				modelToUse: params.modelToUse ? params.modelToUse : "gpt-4o",
			};

			const response = await makeInfraNodusRequest(endpoint, requestBody);

			const latentConceptsIdeas = extractLatentTopicsIdeas(response);

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

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(latentConceptsIdeas, null, 2),
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
