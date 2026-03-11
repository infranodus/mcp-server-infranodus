import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

function readStaticFile(filename: string): string {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const filePath = path.resolve(__dirname, "../../", filename);
	try {
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return `File ${filename} not found.`;
	}
}

export const llmsTxtResource = {
	name: "llms-txt",
	uri: "info://llms.txt",
	definition: {
		name: "llms.txt — InfraNodus MCP Server",
		description:
			"Concise index of InfraNodus MCP server documentation, tools, and links following the llms.txt standard for LLM-accessible documentation.",
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
		name: "llms-full.txt — InfraNodus MCP Server",
		description:
			"Comprehensive documentation of all InfraNodus MCP tools with parameters, return values, workflow patterns, and key concepts. Optimized for LLM consumption.",
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
