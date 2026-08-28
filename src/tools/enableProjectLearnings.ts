import { z } from "zod";
import { brand } from "../config/brand.js";
import { EnableProjectLearningsSchema } from "../schemas/index.js";
import {
	checkEnabled,
	createLearningsGraph,
	learningsGraphName,
	slugify,
} from "../utils/learnings.js";
import type { ToolExtra } from "../types/index.js";

function textResult(payload: unknown, isError = false) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify(payload, null, 2) },
		],
		...(isError ? { isError: true } : {}),
	};
}

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
			const graphName = learningsGraphName(params.project);
			const slug = slugify(params.project) || "project";
			const state = await checkEnabled(graphName);

			if (state.enabled) {
				return textResult({
					enabled: true,
					alreadyEnabled: true,
					project: params.project,
					graphName,
					...(state.info.url ? { url: state.info.url } : {}),
					...(state.info.createdAt ? { since: state.info.createdAt } : {}),
				});
			}

			if (state.reason === "not-a-learnings-graph") {
				return textResult(
					{
						enabled: false,
						graphName,
						message: `A graph named ${graphName} already exists but was not created by enable_project_learnings, so it will not be modified. Ask the user for a different project name.`,
					},
					false,
				);
			}

			const created = await createLearningsGraph({
				graphName,
				slug,
				clientName: extra?.clientName,
			});

			return textResult({
				enabled: true,
				project: params.project,
				graphName: created.graphName ?? graphName,
				...(created.graphUrl ? { url: created.graphUrl } : {}),
				next: "Learnings for this project can now be proposed with add_project_learnings (dry run first, then confirm: true once the user agrees).",
			});
		} catch (error) {
			return textResult(
				{ error: error instanceof Error ? error.message : String(error) },
				true,
			);
		}
	},
};
