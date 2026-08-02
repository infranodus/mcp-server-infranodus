import { z } from "zod";
import {
	DevelopTextToolSchema,
	DevelopTextToolSchemaBase,
} from "../schemas/index.js";
import { makeInfraNodusRequest } from "../api/client.js";
import { resolveGraphInput } from "../utils/graphInput.js";
import type { WikilinksPayload } from "../utils/wikilinksMode.js";
import {
	generateResearchQuestions,
	extractLatentTopicsIdeas,
	generateGaps,
	extractLatentConceptsIdeas,
} from "../utils/transformers.js";

function errorContent(message: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify({ error: message }) },
		],
		isError: true,
	};
}

export const developTextTool = {
	name: "develop_text_tool",
	definition: {
		title: "Develop a Text Based on Content Gaps and Latent Topics",
		description:
			"Analyze text or an existing graph to extract research questions, develop latent topics, and identify content gaps in a single workflow with progress tracking. Provide either text, url, or graphName.",
		inputSchema: DevelopTextToolSchemaBase.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof DevelopTextToolSchema>,
		context?: {
			progressToken?: string;
			sendNotification?: (notification: any) => void;
		}
	) => {
		try {
			const useGraph = params.graphName?.trim();
			let contentPayload: Partial<WikilinksPayload> = {};
			if (!useGraph) {
				const input = await resolveGraphInput(params);
				if (!input.ok) return errorContent(input.error);
				contentPayload = input.payload;
			}

			// Create progress helper
			const progress = {
				report: async (percentage: number, message: string) => {
					if (context?.progressToken && context?.sendNotification) {
						await context.sendNotification({
							method: "notifications/progress",
							params: {
								progressToken: context.progressToken,
								progress: percentage,
								total: 100,
								message,
							},
						});
					}
				},
			};

			// Step 1: Generate Research Questions
			await progress.report(
				10,
				"🔍 Generating research questions and topical gaps from text based on its structure..."
			);

			const queryParamsResearch = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				optimize: "optimize",
				includeStatements: "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: "false",
				aiTopics: "true",
				extendedAdvice: params.useSeveralGaps ? "true" : "false",
				gapDepth: params.gapDepth ? params.gapDepth.toString() : "0",
			});

			const endpointResearch = `/graphAndAdvice?${queryParamsResearch.toString()}`;

			const requestBodyResearch: any = useGraph
				? {
						name: params.graphName,
						aiTopics: "true",
						requestMode: params.transcendDiscourse ? "transcend" : "question",
						modelToUse: params.modelToUse ?? "gpt-4o",
				  }
				: {
						...contentPayload,
						aiTopics: "true",
						requestMode: params.transcendDiscourse ? "transcend" : "question",
						modelToUse: params.modelToUse ?? "gpt-4o",
				  };

			const researchResponse = await makeInfraNodusRequest(
				endpointResearch,
				requestBodyResearch
			);

			// Extract content gaps and AI advice from research questions response
			const researchQuestions = generateResearchQuestions(researchResponse);

			const contentGaps = generateGaps(researchResponse);

			await progress.report(
				40,
				`✅ Generated ${
					researchQuestions.questions?.length || 0
				} research questions`
			);

			// Step 2: Develop Latent Topics
			await progress.report(40, "🎯 Analyzing text for latent topics...");

			const queryParamsLatent = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				optimize: "latent",
				includeStatements: "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: "false",
				aiTopics: "true",
			});

			const endpointLatent = `/graphAndAdvice?${queryParamsLatent.toString()}`;

			const requestBodyLatent: any = useGraph
				? {
						name: params.graphName,
						aiTopics: "true",
						requestMode: params.transcendDiscourse ? "transcend" : "question",
						modelToUse: params.modelToUse ?? "gpt-4o",
				  }
				: {
						...contentPayload,
						aiTopics: "true",
						requestMode: params.transcendDiscourse ? "transcend" : "question",
						modelToUse: params.modelToUse ?? "gpt-4o",
				  };

			const latentResponse = await makeInfraNodusRequest(
				endpointLatent,
				requestBodyLatent
			);

			const latentTopics = extractLatentTopicsIdeas(latentResponse);

			await progress.report(
				60,
				`✅ Identified ${
					latentTopics.latentTopicsToDevelop?.length || 0
				} latent topics to develop`
			);

			// Step 3: Generate Content Gaps
			await progress.report(
				70,
				"🔎 Identifying conceptual bridges in the text..."
			);

			const queryParamsBridges = new URLSearchParams({
				doNotSave: "true",
				addStats: "true",
				optimize: "imagine",
				includeStatements: "false",
				includeGraphSummary: "false",
				extendedGraphSummary: "true",
				includeGraph: "false",
				aiTopics: "true",
			});

			const endpointBridges = `/graphAndAdvice?${queryParamsBridges.toString()}`;

			const requestBodyBridges: any = useGraph
				? {
						name: params.graphName,
						aiTopics: "true",
						requestMode: params.transcendDiscourse ? "transcend" : "question",
						modelToUse: params.modelToUse ?? "gpt-4o",
				  }
				: {
						...contentPayload,
						aiTopics: "true",
						requestMode: params.transcendDiscourse ? "transcend" : "question",
						modelToUse: params.modelToUse ?? "gpt-4o",
				  };

			const conceptualBridgesResponse = await makeInfraNodusRequest(
				endpointBridges,
				requestBodyBridges
			);

			const conceptualBridges = extractLatentConceptsIdeas(
				conceptualBridgesResponse
			);

			await progress.report(
				90,
				`✅ Identified ${
					conceptualBridges.latentConceptsToDevelop?.length || 0
				} conceptual bridges to develop`
			);

			// Compile final results
			const results = {
				contentGapIdeas: researchQuestions.questions || [],
				latentTopicsIdeas: latentTopics.ideas || [],
				conceptualBridgesIdeas: conceptualBridges.ideas || [],
				contentGaps: contentGaps.contentGaps || [],
				conceptualBridges: conceptualBridges.latentConceptsToDevelop || [],
				latentTopics: latentTopics.latentTopicsToDevelop || [],
				mainTopics: latentTopics.mainTopics || [],
			};

			await progress.report(100, "🎉 Analysis complete!");

			// Handle errors from any of the responses
			if (
				researchResponse.error ||
				latentResponse.error ||
				conceptualBridgesResponse.error
			) {
				const errors = [
					researchResponse.error &&
						`Research Questions: ${researchResponse.error}`,
					latentResponse.error && `Latent Topics: ${latentResponse.error}`,
					conceptualBridgesResponse.error &&
						`Conceptual Gaps: ${conceptualBridgesResponse.error}`,
				]
					.filter(Boolean)
					.join("\n");

				return {
					content: [
						{
							type: "text" as const,
							text: `Errors encountered:\n${errors}`,
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(results, null, 2),
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
