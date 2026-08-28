import { AsyncLocalStorage } from "node:async_hooks";
import { Config } from "../config/index.js";
import { brandApiBase } from "../config/brand.js";

const configStorage = new AsyncLocalStorage<Config>();
const toolStorage = new AsyncLocalStorage<string>();

/**
 * Per-invocation context that the API client attaches to request bodies:
 * the previous call's metrics in this session (see utils/callTracking.ts).
 */
export interface CallContext {
	sessionId: string;
	previousCall?: Record<string, unknown>;
}
const callContextStorage = new AsyncLocalStorage<CallContext>();

export function runWithCallContext<T>(context: CallContext, fn: () => T): T {
	return callContextStorage.run(context, fn);
}

export function getCallContext(): CallContext | undefined {
	return callContextStorage.getStore();
}

export function runWithConfig<T>(config: Config, fn: () => T): T {
	return configStorage.run(config, fn);
}

export function runWithTool<T>(toolName: string, fn: () => T): T {
	return toolStorage.run(toolName, fn);
}

export function getCurrentTool(): string | undefined {
	return toolStorage.getStore();
}

export function getConfig(): Config {
	return (
		configStorage.getStore() ??
		(global as any).brandConfig ??
		{ apiKey: "", apiBase: brandApiBase() }
	);
}
