export interface StatementFilter {
	categories?: string[];
	categoryMatch?: "any" | "all";
	from?: string;
	to?: string;
	slice?: { from?: number; to?: number };
}

/**
 * Body field for a request that reads a saved graph by name. Empty when the
 * filter narrows nothing, so an unfiltered call stays byte-identical.
 */
export function statementFilterBody(
	filter: StatementFilter | undefined,
): { statementFilter?: StatementFilter } {
	if (!filter) return {};
	const narrows =
		(filter.categories?.length ?? 0) > 0 ||
		Boolean(filter.from) ||
		Boolean(filter.to) ||
		Boolean(filter.slice);
	return narrows ? { statementFilter: filter } : {};
}
