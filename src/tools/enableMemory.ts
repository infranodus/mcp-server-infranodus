import { z } from "zod";
import { brand } from "../config/brand.js";
import { EnableMemorySchema } from "../schemas/index.js";
import { callMemoryEndpoint } from "../api/client.js";
import { memoryResult } from "../utils/memoryResult.js";
import type { ToolExtra } from "../types/index.js";

export const enableMemoryTool = {
	name: "enable_memory",
	definition: {
		title: `Enable Memory in ${brand.name}`,
		description:
			`Create the user's kept memory graph in ${brand.name} so memory_add_relations / memory_get_relations can use it with \`scope\`: 'topic' (memory-<topic>, facts about an outside subject, client or case) or 'personal' (personal-<user>, the user's own preferences and setup). ` +
			`Call this ONLY when the user has explicitly asked to keep memory of this kind — never on your own initiative. Before calling, tell the user in one sentence what will be stored and that it is a private graph in their account they can delete at any time. ` +
			`Idempotent: calling it again just returns the graph.`,
		inputSchema: EnableMemorySchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: true,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof EnableMemorySchema>,
		extra?: ToolExtra,
	) => {
		try {
			const response = await callMemoryEndpoint("/memory/enable", {
				scope: params.scope,
				...(params.language ? { language: params.language } : {}),
				...(params.topic ? { topic: params.topic } : {}),
				...(extra?.clientName ? { client: extra.clientName } : {}),
			});
			return memoryResult(response);
		} catch (error) {
			return memoryResult(error);
		}
	},
};
