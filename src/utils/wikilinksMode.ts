import { z } from "zod";

/**
 * LLM-facing presets for how [[wikilinks]] in the submitted text are turned
 * into graph nodes. Each preset maps to a consistent combination of the
 * engine's textProcessingSettings (and, for the parent modes, a statements +
 * per-statement categories payload), so callers never compose the raw
 * vocabulary (doubleSquarebracketsProcessing / mentionsProcessing /
 * partOfSpeechToProcess / categoriesAsMentions) themselves.
 *
 * The settings are applied by the backend only when the graph context is
 * created: always for doNotSave generation (ephemeral context), and on the
 * FIRST upload for saved graphs. An existing saved graph keeps the settings
 * it was created with.
 *
 * Parent modes ('obsidianStyle', 'parentAndConcepts') use the same mechanism
 * as the InfraNodus Obsidian plugin: statements travel as an array with a
 * per-statement categories array, and categoriesAsMentions turns each
 * category into a mention token attached to that statement only. The engine
 * names those mentions [[category]] (bracketed) when doublebrackets are
 * processed and single squarebrackets are ignored — so parent-page nodes
 * share the exact [[name]] namespace with inline wikilinks and merge with
 * nodes from graphs built in 'default'/'wikilinksOnly' modes.
 *
 * Parent extraction contract (parent modes), in priority order per line:
 *   1. A markdown heading (# through ######) sets the CURRENT PARENT for all
 *      statements below it, until the next heading. `## [[Page A]]` sets the
 *      parent to "Page A"; a plain heading `## Introduction` sets it to
 *      "Introduction". Heading lines are not statements themselves.
 *   2. A line starting with `[[Parent Page]]: ` (colon required) overrides
 *      the section parent for that line only; the prefix is removed from the
 *      statement text.
 *   3. Any other line becomes a statement under the current section parent
 *      (or no parent before the first heading).
 * Note `#tag` without a space after the hashes is a hashtag, not a heading.
 */
export const WikilinksModeEnum = z.enum([
	"default",
	"wikilinksOnly",
	"obsidianStyle",
	"parentAndConcepts",
	"plainText",
]);

export type WikilinksMode = z.infer<typeof WikilinksModeEnum>;

export const wikilinksModeDescription =
	"How [[wikilinks]] in the text become graph nodes. " +
	"'default': wikilinks become [[entity]] nodes; statements that contain wikilinks use only those, statements without any are processed word-by-word. " +
	"'wikilinksOnly': ONLY [[wikilinks]] become nodes, all other words are ignored; nearby wikilinks connect via a sliding co-occurrence window — use for entity/ontology/link statements like '[[alice]] works with [[bob]]' or '[[Page A]] links to [[Page B]]'. " +
	"'obsidianStyle': like Obsidian's graph view — markdown headings set the parent page for the statements below them ('## [[Page A]]' or a plain '## Section Title'), and a line may override its parent with a '[[Parent Page]]: ' prefix (colon required); the parent becomes a [[page]] node connected to every concept of its statements, while concepts do NOT connect to each other (star topology around pages/sections). " +
	"'parentAndConcepts': same heading/prefix parent contract, but concepts also keep their normal co-occurrence connections — best for mixed content (notes, docs, articles) where you want both section/page provenance and a real concept graph. " +
	"'plainText': brackets are stripped and everything is processed as ordinary words. " +
	"In all modes parent and wikilink nodes share the [[name]] namespace, so graphs remain comparable/mergeable. " +
	"Takes effect when the graph is generated or first created; an existing saved graph keeps its original setting.";

const PARENT_PREFIX_RE = /^\s*\[\[([^\]]+)\]\]:\s*/;
// Heading: 1-6 hashes followed by whitespace ("#tag" without a space is a
// hashtag, not a heading). Trailing closing hashes (ATX style) are dropped.
const HEADING_RE = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/;
const HEADING_WIKILINK_RE = /^\[\[([^\]]+)\]\]$/;

export interface WikilinksPayload {
	text?: string;
	statements?: string[];
	categories?: string[][];
	contextSettings?: Record<string, unknown>;
}

/**
 * Translate the mode + content into the request-body fields to merge into
 * the /graphAndStatements payload. Returns {} for 'default' so callers can
 * spread it unconditionally over a body that already carries `text`.
 */
export function prepareWikilinksPayload(
	contentText: string,
	mode: WikilinksMode | undefined,
): WikilinksPayload {
	switch (mode) {
		case "wikilinksOnly":
			return {
				contextSettings: {
					doubleSquarebracketsProcessing:
						"PROCESS_AS_HASHTAGS_IGNORE_THE_REST",
					partOfSpeechToProcess: "HASHTAGS_ONLY",
				},
			};
		case "plainText":
			return {
				contextSettings: {
					doubleSquarebracketsProcessing: "IGNORE_BRACKETS",
				},
			};
		case "obsidianStyle":
		case "parentAndConcepts": {
			const statements: string[] = [];
			const categories: string[][] = [];
			let sectionParent: string | null = null;
			for (const rawLine of contentText.split("\n")) {
				const line = rawLine.trim();
				if (!line) continue;

				const heading = line.match(HEADING_RE);
				if (heading) {
					const title = heading[2].trim();
					const wikilink = title.match(HEADING_WIKILINK_RE);
					sectionParent = (wikilink ? wikilink[1] : title).trim() || null;
					continue; // heading lines are structure, not statements
				}

				const prefix = line.match(PARENT_PREFIX_RE);
				if (prefix && line.slice(prefix[0].length).trim()) {
					statements.push(line.slice(prefix[0].length).trim());
					categories.push([prefix[1]]);
				} else {
					statements.push(line);
					categories.push(sectionParent ? [sectionParent] : []);
				}
			}
			return {
				text: "",
				statements,
				categories,
				contextSettings: {
					categoriesAsMentions: true,
					mentionsProcessing:
						mode === "obsidianStyle"
							? "CONNECT_TO_CONCEPTS_ONLY"
							: "CONNECT_TO_ALL_CONCEPTS",
					// IGNORE_BRACKETS on single brackets + processed doublebrackets
					// is the combination that makes the engine name category
					// mentions [[category]] instead of @category — keeping parent
					// nodes in the same namespace as inline wikilinks.
					squareBracketsProcessing: "IGNORE_BRACKETS",
					doubleSquarebracketsProcessing: "PROCESS_AS_HASHTAGS",
				},
			};
		}
		default:
			return {};
	}
}
