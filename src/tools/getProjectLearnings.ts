import { z } from "zod";
import { brand } from "../config/brand.js";
import { GetProjectLearningsSchema } from "../schemas/index.js";
import { callMemoryEndpoint } from "../api/client.js";
import { memoryResult } from "../utils/memoryResult.js";

export const getProjectLearningsTool = {
	name: "get_project_learnings",
	definition: {
		title: `Get Project Learnings from ${brand.name}`,
		description:
			`Retrieve what previous sessions learned about operating in a project (saved with add_project_learnings). ` +
			`Call it at the start of a substantive task with the task as \`prompt\` to get the most relevant learnings plus an overview of what is known; with \`entity\` (a file path, module, or concept) before working on an unfamiliar area; with neither for a structural overview; or with no \`project\` to list the projects that have learnings in this account. ` +
			`Returns enabled: false with an empty list when the project has no learnings graph — that is not an error, just carry on; do not suggest enabling unless the user asks about memory.`,
		inputSchema: GetProjectLearningsSchema.shape,
		annotations: {
			readOnlyHint: true,
			idempotentHint: true,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (params: z.infer<typeof GetProjectLearningsSchema>) => {
		try {
			const response = await callMemoryEndpoint("/learnings/get", {
				...(params.project ? { project: params.project } : {}),
				...(params.prompt ? { prompt: params.prompt } : {}),
				...(params.entity ? { entity: params.entity } : {}),
				...(params.type ? { type: params.type } : {}),
				limit: params.limit,
				...(params.language ? { language: params.language } : {}),
			});
			return memoryResult(response);
		} catch (error) {
			return memoryResult(error);
		}
	},
};
