import { z } from "zod";
import { brand } from "../config/brand.js";
import { EnableProjectLearningsSchema } from "../schemas/index.js";
import { callMemoryEndpoint } from "../api/client.js";
import { memoryResult } from "../utils/memoryResult.js";
import type { ToolExtra } from "../types/index.js";

export const enableProjectLearningsTool = {
	name: "enable_project_learnings",
	definition: {
		title: `Enable Project Learnings in ${brand.name}`,
		description:
			`Create the per-project learnings graph (learn-<slug>) in the user's ${brand.name} account so that add_project_learnings can save what you learn about operating in this project. ` +
			`Call this ONLY when the user has explicitly asked to start saving learnings for a project — never on your own initiative. ` +
			`Before calling, tell the user in one or two sentences: what will be stored (knowledge about the project — where things live, traps, conventions, decisions, workflows — never anything about them personally, never secrets), where (a private, append-only graph in their ${brand.name} account that they can delete at any time), and that each batch of learnings will be shown to them before it is saved unless they say otherwise. ` +
			`Idempotent: calling it again for an already enabled project just returns the graph.`,
		inputSchema: EnableProjectLearningsSchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: true,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof EnableProjectLearningsSchema>,
		extra?: ToolExtra,
	) => {
		try {
			const response = await callMemoryEndpoint("/learnings/enable", {
				project: params.project,
				...(params.language ? { language: params.language } : {}),
				...(extra?.clientName ? { client: extra.clientName } : {}),
			});
			return memoryResult(response);
		} catch (error) {
			return memoryResult(error);
		}
	},
};
