#!/usr/bin/env node
/**
 * Keep the plugin manifests' "version" in sync with package.json.
 * Runs automatically from the `version` npm lifecycle hook (npm version patch|minor|major),
 * so the Cursor / Grok / Agent Plugins manifests never drift from the npm version.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const { version } = JSON.parse(
	readFileSync(fileURLToPath(new URL("package.json", root)), "utf8"),
);

const manifests = [
	"plugin.json",
	".cursor-plugin/plugin.json",
	".grok-plugin/plugin.json",
];

for (const rel of manifests) {
	const path = fileURLToPath(new URL(rel, root));
	const manifest = JSON.parse(readFileSync(path, "utf8"));
	manifest.version = version;
	writeFileSync(path, JSON.stringify(manifest, null, "\t") + "\n");
	console.log(`${rel} -> ${version}`);
}
