import { AsyncLocalStorage } from "node:async_hooks";
import { Config } from "../config/index.js";
import { brandApiBase } from "../config/brand.js";

const configStorage = new AsyncLocalStorage<Config>();
const toolStorage = new AsyncLocalStorage<string>();

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
