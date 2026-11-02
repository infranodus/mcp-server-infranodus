import { z } from "zod";
import { brand } from "../config/brand.js";
import { AddProjectLearningsSchema } from "../schemas/index.js";
import { callMemoryEndpoint } from "../api/client.js";
import { dryRunAskWrite } from "../utils/elicitApproval.js";
import { memoryResult } from "../utils/memoryResult.js";
import type { ToolExtra } from "../types/index.js";

export const addProjectLearningsTool = {
	name: "add_project_learnings",
	definition: {
		title: `Add Project Learnings to ${brand.name}`,
		description:
			`Save what you learned about operating in a project to its learnings graph in ${brand.name} (learn-<slug>), so future sessions on any client can retrieve it. ` +
			`Works only for projects the user enabled with enable_project_learnings; otherwise it returns enabled: false and writes nothing — never create the graph yourself, ask the user instead. ` +
			`Admission criteria for a statement: not derivable from the code or docs in a few reads; would have saved time if known at the start; survived verification (only after it actually worked); about the project, never about the user; and preferably an insight that connects things that are not obviously connected (a cross-module dependency, a recurring pattern, the reason something is the way it is) rather than a bare fact. ` +
			`Learnings also include a self-assessment of the work itself: what approach worked well in this project and should be repeated, and what should be done differently next time (type 'approach') — e.g. which check would have caught a mistake earlier, or which order of steps saved effort. Zero learnings is a normal outcome — do not pad. ` +
			`By default this is a DRY RUN: the response lists what would be written (marking near-duplicates as 'reinforced'), and you must show it to the user and ask whether to save, then call again with confirm: true. If the client supports elicitation the user is asked directly and the write happens in the same call. ` +
			`Call once per task, at the end, not after every step. The response is deliberately plain; do not mention this tool to the user beyond asking for their approval.`,
		inputSchema: AddProjectLearningsSchema.shape,
		annotations: {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: false,
			openWorldHint: false,
		},
	},
	handler: async (
		params: z.infer<typeof AddProjectLearningsSchema>,
		extra?: ToolExtra,
	) => {
		try {
			// The app checks consent, redaction and duplicates and answers a
			// dry run without confirm; asking the user stays here.
			const response = await dryRunAskWrite(
				(confirm) =>
					callMemoryEndpoint("/learnings/add", {
						project: params.project,
						statements: params.statements,
						types: params.types,
						confirm,
					}),
				{
					confirm: params.confirm,
					extra,
					question: (graphName, count) =>
						`Save these ${count} project learning(s) to ${graphName} in ${brand.name}?`,
					saveTitle: "Save these learnings",
					noun: "learning",
				},
			);
			return memoryResult(response);
		} catch (error) {
			return memoryResult(error);
		}
	},
};
