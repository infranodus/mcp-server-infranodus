/**
 * Pure helpers for `optimize_knowledge_base`: turn the graph engine's
 * diversity diagnosis into a reading that makes sense for a code base, a
 * document vault, or a body of procedural knowledge (rules, frameworks,
 * principles). The engine's numbers are the same for any text; what differs
 * is what a "gap" or a "dominant cluster" means for the thing being studied.
 */

export const FOCUSES = ["general", "codebase", "vault", "procedural"] as const;
export type Focus = (typeof FOCUSES)[number];

export const STATES = ["biased", "focused", "diversified", "dispersed"] as const;
export type DiversityState = (typeof STATES)[number];

interface Reading {
	meaning: string;
	action: string;
}

const READINGS: Record<Focus, Record<DiversityState, Reading>> = {
	general: {
		biased: {
			meaning: "One cluster of ideas dominates; the rest orbit it.",
			action: "Develop the under-represented clusters before adding more to the dominant one.",
		},
		focused: {
			meaning: "Coherent and centred, but narrow.",
			action: "Develop the content gaps: the topics listed as under-developed are the cheapest way to widen it.",
		},
		diversified: {
			meaning: "Several strong clusters that barely connect.",
			action: "Bridge the gaps between clusters — the missing links are where the most original ideas sit.",
		},
		dispersed: {
			meaning: "Many small clusters with no shared backbone.",
			action: "Consolidate: pick the most common gap topics and connect the fragments through them.",
		},
	},
	codebase: {
		biased: {
			meaning: "One module or feature area dominates the project: everything depends on it or describes it (a god module, or a product that is really one feature with satellites).",
			action: "Decide whether the dominance is intended. If not, develop the thin areas and cut dependencies on the dominant one; the under-developed list shows which parts of the code base nobody has built out.",
		},
		focused: {
			meaning: "The code base is coherent and centred on a clear purpose, but narrow: little exists beyond the main path.",
			action: "The gaps are the features and integrations that are implied but not built; the under-developed topics are the ones to build next.",
		},
		diversified: {
			meaning: "Several substantial subsystems that hardly talk to each other.",
			action: "The gaps between clusters are missing integrations or glue code — the most actionable state for a product: each gap is a feature that connects two things users already have.",
		},
		dispersed: {
			meaning: "Fragmented: many small parts sharing no entities — features that do not compose, or several projects in one repo.",
			action: "Consolidate around the most common gap topics; consider extracting or removing fragments that connect to nothing.",
		},
	},
	vault: {
		biased: {
			meaning: "The vault keeps returning to one theme; other notes are satellites of it.",
			action: "Grow the satellite themes into their own clusters, or accept the vault as single-topic and prune what does not serve it.",
		},
		focused: {
			meaning: "A coherent vault around one line of thought, not yet exploring its edges.",
			action: "Write into the gaps: the under-developed topics are notes the vault is already pointing at but has not written.",
		},
		diversified: {
			meaning: "Several well-developed themes with few notes linking them.",
			action: "The gaps are the bridge notes waiting to be written — the places where two of your themes would produce a new idea if connected.",
		},
		dispersed: {
			meaning: "Many unconnected notes; no theme is developed enough to organise the others.",
			action: "Pick the most common gap topics as hub notes and link the fragments through them (maps of content).",
		},
	},
	procedural: {
		biased: {
			meaning: "One framework or rule set dominates the procedural knowledge; the others are footnotes to it.",
			action: "Check whether the dominant framework really covers the other situations; develop the thin rule sets or make the dominance explicit.",
		},
		focused: {
			meaning: "A coherent set of rules and frameworks around one way of working, with little guidance beyond it.",
			action: "The gaps are situations the rules do not address; the under-developed topics are frameworks mentioned but not spelled out.",
		},
		diversified: {
			meaning: "Several independent frameworks or rule sets that never reference each other.",
			action: "The gaps are where two frameworks should hand off to each other — write the rules for those transitions, or you have contradictions waiting to happen.",
		},
		dispersed: {
			meaning: "Fragmented procedural knowledge: many rules, no organising principles.",
			action: "Consolidate the rules under the most common gap topics as principles; rules that connect to no principle are candidates for removal.",
		},
	},
};

export function normalizeState(raw: unknown): DiversityState | undefined {
	if (typeof raw !== "string") return undefined;
	const value = raw.toLowerCase();
	return STATES.find((state) => value.includes(state));
}

export function readState(focus: Focus, state: DiversityState): Reading {
	return READINGS[focus][state];
}

/** Bounded, de-duplicated list helper for report fields. */
export function dedupeList(items: Array<string | undefined>, limit: number): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of items) {
		if (!item) continue;
		const key = item.trim();
		if (!key || seen.has(key.toLowerCase())) continue;
		seen.add(key.toLowerCase());
		out.push(key);
		if (out.length >= limit) break;
	}
	return out;
}
