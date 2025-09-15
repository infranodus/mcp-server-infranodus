import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface ProgressNotification {
	method: string;
	params: {
		progressToken: string | number;
		progress: {
			kind?: "begin" | "report" | "end";
			title?: string;
			message?: string;
			percentage?: number;
			cancellable?: boolean;
		};
	};
}

export class ProgressNotifier {
	private server: McpServer;
	private activeNotifications: Map<string | number, boolean> = new Map();

	constructor(server: McpServer) {
		this.server = server;
	}

	async begin(
		progressToken: string | number,
		title: string,
		message?: string,
		cancellable: boolean = false
	): Promise<void> {
		this.activeNotifications.set(progressToken, true);

		await this.server.sendNotification({
			method: "notifications/progress",
			params: {
				progressToken,
				progress: {
					kind: "begin",
					title,
					message,
					cancellable,
				},
			},
		});
	}

	async report(
		progressToken: string | number,
		message: string,
		percentage?: number
	): Promise<void> {
		if (!this.activeNotifications.has(progressToken)) {
			return;
		}

		await this.server.sendNotification({
			method: "notifications/progress",
			params: {
				progressToken,
				progress: {
					kind: "report",
					message,
					percentage,
				},
			},
		});
	}

	async end(progressToken: string | number, message?: string): Promise<void> {
		if (!this.activeNotifications.has(progressToken)) {
			return;
		}

		await this.server.sendNotification({
			method: "notifications/progress",
			params: {
				progressToken,
				progress: {
					kind: "end",
					message,
				},
			},
		});

		this.activeNotifications.delete(progressToken);
	}

	isActive(progressToken: string | number): boolean {
		return this.activeNotifications.has(progressToken);
	}

	cancel(progressToken: string | number): void {
		this.activeNotifications.delete(progressToken);
	}
}

export function createProgressHandler(server: McpServer) {
	const notifier = new ProgressNotifier(server);

	return {
		notifier,
		withProgress: async <T>(
			progressToken: string | number,
			title: string,
			task: (reporter: typeof notifier) => Promise<T>
		): Promise<T> => {
			try {
				await notifier.begin(progressToken, title);
				const result = await task(notifier);
				await notifier.end(progressToken, "Complete");
				return result;
			} catch (error) {
				await notifier.end(
					progressToken,
					`Error: ${error instanceof Error ? error.message : "Unknown error"}`
				);
				throw error;
			}
		},
	};
}