import { z } from "zod";
import { SSEHandler } from "../utils/sse.js";
import { makeInfraNodusRequest } from "../api/client.js";

const StreamingResearchQuestionsSchema = z.object({
	text: z.string().describe("Text to analyze"),
	streamProgress: z.boolean().optional().describe("Enable SSE streaming of progress"),
	modelToUse: z.string().optional(),
	useSeveralGaps: z.boolean().optional(),
	gapDepth: z.number().optional(),
});

export const createStreamingTool = (sseHandler: SSEHandler) => ({
	name: "generateResearchQuestionsStreaming",
	definition: {
		title: "Generate Research Questions with Streaming",
		description:
			"Analyze text and generate research questions with optional SSE progress streaming",
		inputSchema: StreamingResearchQuestionsSchema.shape,
	},
	handler: async (params: z.infer<typeof StreamingResearchQuestionsSchema>) => {
		const streamId = `research-${Date.now()}`;

		if (params.streamProgress) {
			async function* generateProgress() {
				yield { status: "starting", message: "Initializing analysis..." };

				yield { status: "processing", message: "Analyzing text content...", progress: 25 };

				const queryParams = new URLSearchParams({
					doNotSave: "true",
					addStats: "true",
					optimize: "gap",
					includeStatements: "false",
					includeGraphSummary: "false",
					extendedGraphSummary: "false",
					includeGraph: "false",
					aiTopics: "true",
					extendedAdvice: params.useSeveralGaps ? "true" : "false",
					gapDepth: params.gapDepth ? params.gapDepth.toString() : "0",
				});

				yield { status: "processing", message: "Building knowledge graph...", progress: 50 };

				const endpoint = `/graphAndAdvice?${queryParams.toString()}`;
				const requestBody = {
					text: params.text,
					aiTopics: "true",
					requestMode: "question",
					modelToUse: params.modelToUse || "gpt-4o",
				};

				yield { status: "processing", message: "Sending request to InfraNodus...", progress: 75 };

				const response = await makeInfraNodusRequest(endpoint, requestBody);

				yield { status: "processing", message: "Generating research questions...", progress: 90 };

				yield {
					status: "complete",
					message: "Analysis complete",
					progress: 100,
					data: response,
				};
			}

			const stream = sseHandler.createStream(streamId, generateProgress());
			const results = [];

			for await (const message of stream) {
				results.push(message);
			}

			const lastMessage = results[results.length - 2];
			if (lastMessage?.data?.data) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(lastMessage.data.data, null, 2),
						},
					],
					streamId,
				};
			}
		}

		const queryParams = new URLSearchParams({
			doNotSave: "true",
			addStats: "true",
			optimize: "gap",
			includeStatements: "false",
			includeGraphSummary: "false",
			extendedGraphSummary: "false",
			includeGraph: "false",
			aiTopics: "true",
			extendedAdvice: params.useSeveralGaps ? "true" : "false",
			gapDepth: params.gapDepth ? params.gapDepth.toString() : "0",
		});

		const endpoint = `/graphAndAdvice?${queryParams.toString()}`;
		const requestBody = {
			text: params.text,
			aiTopics: "true",
			requestMode: "question",
			modelToUse: params.modelToUse || "gpt-4o",
		};

		const response = await makeInfraNodusRequest(endpoint, requestBody);

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(response, null, 2),
				},
			],
		};
	},
});