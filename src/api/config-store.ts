import { AsyncLocalStorage } from "node:async_hooks";
import { Config } from "../config/index.js";

const configStorage = new AsyncLocalStorage<Config>();

export function runWithConfig<T>(config: Config, fn: () => T): T {
	return configStorage.run(config, fn);
}

export function getConfig(): Config {
	return (
		configStorage.getStore() ??
		(global as any).infranodusConfig ??
		{ apiKey: "", apiBase: "https://keywordgraph.com/api/v1" }
	);
}
