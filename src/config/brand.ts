/**
 * Brand configuration.
 *
 * One codebase ships as multiple branded MCP servers. The active brand is
 * selected at runtime by the BRAND environment variable (set per deploy target,
 * e.g. in each Fly app's [env] block). This keeps a single source tree and a
 * single built image — only BRAND (and the per-app secrets) differ between
 * deployments.
 *
 * Defaults to "infranodus" (the full product, all tools exposed) when BRAND is
 * unset, so a missing BRAND never silently hides tools.
 */

export type BrandId = "infranodus" | "keywordgraph";

export interface BrandDef {
	id: BrandId;
	/** Human-facing product name shown in titles, resources, and auth pages. */
	name: string;
	/** Bare domain, e.g. for links and copy. */
	domain: string;
	/** Default API base when the brand's *_API_BASE env var is unset. */
	apiBase: string;
	/** Prefix for this brand's env vars: `${envPrefix}_API_KEY`, `${envPrefix}_API_BASE`. */
	envPrefix: string;
	/** MCP server identifier reported to clients. */
	serverName: string;
	/**
	 * Tool `name` values NOT registered for this brand. Every tool file is always
	 * compiled in; this list is the single source of truth for which ones a brand
	 * exposes. New upstream tools appear in every brand automatically unless added
	 * here.
	 */
	excludedTools: string[];
}

const BRANDS: Record<BrandId, BrandDef> = {
	infranodus: {
		id: "infranodus",
		name: "InfraNodus",
		domain: "infranodus.com",
		apiBase: "https://infranodus.com/api/v1",
		envPrefix: "INFRANODUS",
		serverName: "infranodus-mcp-server",
		excludedTools: [],
	},
	keywordgraph: {
		id: "keywordgraph",
		name: "KeywordGraph",
		domain: "keywordgraph.com",
		apiBase: "https://keywordgraph.com/api/v1",
		envPrefix: "KEYWORDGRAPH",
		serverName: "keywordgraph-mcp-server",
		// KeywordGraph is the keyword/SEO-focused subset: graph-building,
		// memory, research-ideation, and discourse-development tools are hidden.
		excludedTools: [
			"generate_knowledge_graph",
			"generate_ontology_graph",
			"memory_add_relations",
			"memory_get_relations",
			"generate_research_questions",
			"generate_research_ideas",
			"generate_responses_from_graph",
			"develop_conceptual_bridges",
			"develop_latent_topics",
			"generate_contextual_hint",
			"retrieve_from_knowledge_base",
		],
	},
};

function resolveBrand(): BrandDef {
	const id = process.env.BRAND as BrandId | undefined;
	return id && BRANDS[id] ? BRANDS[id] : BRANDS.infranodus;
}

export const brand: BrandDef = resolveBrand();

/**
 * API key for the active brand. Prefers the brand-specific var
 * (`${envPrefix}_API_KEY`) and falls back to the other brand's var so a single
 * key works in mixed local setups.
 */
export function brandApiKey(): string {
	return (
		process.env[`${brand.envPrefix}_API_KEY`] ||
		process.env.INFRANODUS_API_KEY ||
		process.env.KEYWORDGRAPH_API_KEY ||
		""
	);
}

/** API base for the active brand: brand-specific env var, else the brand default. */
export function brandApiBase(): string {
	return process.env[`${brand.envPrefix}_API_BASE`] || brand.apiBase;
}

/** Whether a tool (by its MCP `name`) is exposed for the active brand. */
export function isToolEnabled(name: string): boolean {
	return !brand.excludedTools.includes(name);
}
