import { z } from "zod";

/**
 * LLM-facing presets for how [[wikilinks]] in the submitted text are turned
 * into graph nodes. Each preset maps to a consistent combination of the
 * engine's textProcessingSettings, so callers never have to compose the raw
 * vocabulary (doubleSquarebracketsProcessing / mentionsProcessing /
 * partOfSpeechToProcess) themselves.
 *
 * The settings are applied by the backend only when the graph context is
 * created: always for doNotSave generation (ephemeral context), and on the
 * FIRST upload for saved graphs. An existing saved graph keeps the settings
 * it was created with.
 */
export const WikilinksModeEnum = z.enum([
	"default",
	"wikilinksOnly",
	"obsidianStyle",
	"plainText",
]);

export type WikilinksMode = z.infer<typeof WikilinksModeEnum>;

export const wikilinksModeDescription =
	"How [[wikilinks]] in the text become graph nodes. " +
	"'default': wikilinks become [[entity]] nodes; statements that contain wikilinks use only those, statements without any are processed word-by-word. " +
	"'wikilinksOnly': ONLY [[wikilinks]] become nodes, all other words are ignored; nearby wikilinks connect via a sliding co-occurrence window (order and distance matter) — use for entity/ontology statements like '[[alice]] works with [[bob]] in [[berlin]]'. " +
	"'obsidianStyle': like Obsidian's graph view — every wikilink in a statement connects to every other one with equal weight, all other words are ignored, and node names come out clean without brackets or @ signs (page_a, not [[page_a]]) — use for page-link/hub statements like '[[Page A]] links to [[Page B]]'. NOTE: because of the clean names, obsidianStyle graphs do not share node names with graphs built in other modes; prefer 'wikilinksOnly' when the graph must be compared or merged with default-mode graphs. " +
	"'plainText': brackets are stripped and everything is processed as ordinary words. " +
	"Takes effect when the graph is generated or first created; an existing saved graph keeps its original setting.";

/**
 * Translate a preset into the backend contextSettings payload
 * (merged into the context's textProcessingSettings on creation).
 * Returns null for 'default' so callers can omit the field entirely.
 *
 * obsidianStyle notes (verified against the engine): CONNECT_AND_REMOVE_THE_SIGN
 * prevents the '@' prefix on mention-typed nodes and HASHTAGS_ONLY drops the
 * connector words, so page-to-page edges come from the engine's
 * mention-to-mention linking alone. The mention path also strips the [[ ]]
 * from node names (page_a), unlike the hashtag path which keeps them
 * ([[page_a]]) — which is why obsidianStyle graphs don't name-merge with
 * graphs built in the other modes.
 */
export function wikilinksModeToContextSettings(
	mode: WikilinksMode | undefined,
): Record<string, string> | null {
	switch (mode) {
		case "wikilinksOnly":
			return {
				doubleSquarebracketsProcessing: "PROCESS_AS_HASHTAGS_IGNORE_THE_REST",
				partOfSpeechToProcess: "HASHTAGS_ONLY",
			};
		case "obsidianStyle":
			return {
				doubleSquarebracketsProcessing: "PROCESS_AS_MENTIONS",
				mentionsProcessing: "CONNECT_AND_REMOVE_THE_SIGN",
				partOfSpeechToProcess: "HASHTAGS_ONLY",
			};
		case "plainText":
			return {
				doubleSquarebracketsProcessing: "IGNORE_BRACKETS",
			};
		default:
			return null;
	}
}
