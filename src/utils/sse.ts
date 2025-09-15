import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface SSEMessage {
	event?: string;
	data: any;
	id?: string;
}

export class SSEHandler {
	private server: McpServer;
	private activeStreams: Map<string, boolean> = new Map();

	constructor(server: McpServer) {
		this.server = server;
	}

	async *createStream(
		streamId: string,
		generator: AsyncGenerator<any>
	): AsyncGenerator<SSEMessage> {
		this.activeStreams.set(streamId, true);

		try {
			for await (const data of generator) {
				if (!this.activeStreams.get(streamId)) {
					break;
				}

				yield {
					event: "message",
					data: data,
					id: `${streamId}-${Date.now()}`,
				};
			}

			yield {
				event: "complete",
				data: { streamId },
				id: `${streamId}-complete`,
			};
		} catch (error) {
			yield {
				event: "error",
				data: { error: error instanceof Error ? error.message : "Unknown error" },
				id: `${streamId}-error`,
			};
		} finally {
			this.activeStreams.delete(streamId);
		}
	}

	cancelStream(streamId: string): void {
		this.activeStreams.set(streamId, false);
	}

	isStreamActive(streamId: string): boolean {
		return this.activeStreams.get(streamId) || false;
	}
}

export function formatSSEMessage(message: SSEMessage): string {
	let formatted = "";

	if (message.id) {
		formatted += `id: ${message.id}\n`;
	}

	if (message.event) {
		formatted += `event: ${message.event}\n`;
	}

	const dataString =
		typeof message.data === "string"
			? message.data
			: JSON.stringify(message.data);

	formatted += `data: ${dataString}\n\n`;

	return formatted;
}