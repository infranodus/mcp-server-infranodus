#!/usr/bin/env node
/**
 * Publish the package under a specific brand's npm identity.
 *
 *   node scripts/publish-brand.mjs <infranodus|keywordgraph> [extra npm publish args]
 *
 * One codebase ships as two npm packages. package.json can only hold one
 * identity, so this script temporarily rewrites name/description/bin/repository/
 * keywords from the brand definition (the single source of truth in
 * src/config/brand.ts), runs `npm publish`, then restores package.json exactly.
 *
 * The brand is also baked into the published `bin` command via the per-brand
 * launcher in bin/, so `npx <pkg>` runs as the right brand with no env var.
 *
 * Requires a prior build (dist/) — the npm scripts handle that.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const brandId = process.argv[2];
const extraArgs = process.argv.slice(3);

const VALID = ["infranodus", "keywordgraph"];
if (!VALID.includes(brandId)) {
	console.error(
		`Usage: node scripts/publish-brand.mjs <${VALID.join("|")}> [npm publish args]`,
	);
	process.exit(1);
}

// Load the brand definition from the compiled output (single source of truth).
process.env.BRAND = brandId;
const distBrandUrl = new URL("../dist/config/brand.js", import.meta.url);
let brand;
try {
	({ brand } = await import(distBrandUrl.href));
} catch (err) {
	console.error(
		"Could not load dist/config/brand.js — build first (npm run build:inspect).",
	);
	console.error(err.message);
	process.exit(1);
}

const npm = brand.npm;
const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const original = readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(original);

pkg.name = npm.packageName;
pkg.description = npm.description;
pkg.bin = { [npm.binName]: `bin/${npm.binName}.js` };
pkg.repository = { type: "git", url: npm.repository };
pkg.keywords = npm.keywords;

// Preserve the original file's trailing newline / tab indentation style.
const serialized = JSON.stringify(pkg, null, "\t") + "\n";

console.log(`Publishing as "${npm.packageName}" (brand: ${brandId})…`);
writeFileSync(pkgPath, serialized);
try {
	execFileSync("npm", ["publish", ...extraArgs], {
		stdio: "inherit",
		cwd: fileURLToPath(new URL("..", import.meta.url)),
	});
} finally {
	// Always restore the committed package.json verbatim.
	writeFileSync(pkgPath, original);
	console.log("Restored package.json.");
}
