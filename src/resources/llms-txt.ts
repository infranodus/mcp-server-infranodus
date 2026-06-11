import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { brand } from "../config/brand.js";

// Resolve a static doc to the active brand's variant, e.g.
// "llms.txt" -> "llms.infranodus.txt" / "llms.keywordgraph.txt", falling back
// to the generic filename if no brand-specific variant exists.
function readStaticFile(filename: string): string {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const root = path.resolve(__dirname, "../../");
	const dot = filename.indexOf(".");
	const branded =
		dot === -1
			? `${filename}.${brand.id}`
			: `${filename.slice(0, dot)}.${brand.id}${filename.slice(dot)}`;
	for (const candidate of [branded, filename]) {
		try {
			return fs.readFileSync(path.resolve(root, candidate), "utf-8");
		} catch {
			// try next candidate
		}
	}
	return `File ${filename} not found.`;
}

export const llmsTxtResource = {
	name: "llms-txt",
	uri: "info://llms.txt",
	definition: {
		name: `llms.txt — ${brand.name} MCP Server`,
		description: `Concise index of ${brand.name} MCP server documentation, tools, and links following the llms.txt standard for LLM-accessible documentation.`,
		mimeType: "text/markdown",
	},
	handler: async () => {
		return {
			contents: [
				{
					uri: "info://llms.txt",
					mimeType: "text/markdown",
					text: readStaticFile("llms.txt"),
				},
			],
		};
	},
};

export const llmsFullTxtResource = {
	name: "llms-full-txt",
	uri: "info://llms-full.txt",
	definition: {
		name: `llms-full.txt — ${brand.name} MCP Server`,
		description: `Comprehensive documentation of all ${brand.name} MCP tools with parameters, return values, workflow patterns, and key concepts. Optimized for LLM consumption.`,
		mimeType: "text/markdown",
	},
	handler: async () => {
		return {
			contents: [
				{
					uri: "info://llms-full.txt",
					mimeType: "text/markdown",
					text: readStaticFile("llms-full.txt"),
				},
			],
		};
	},
};
