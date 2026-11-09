// The models the app offers (infranodus-app MODEL_GROUPS, resolved in
// lib/ai.js), without the legacy gpt-4 and gpt-3.5-turbo.
export const AI_MODELS = [
	"claude-opus-5-5",
	"claude-sonnet-5-5",
	"claude-fable-5-1",
	"gpt-6.1-terra",
	"gpt-6.1-sol",
	"gpt-5.6-terra",
	"gpt-5.6-sol",
	"gpt-5.4",
	"gpt-5.4-mini",
	"gpt-4o",
	"gpt-4o-mini",
	"gemini-4-argon",
	"gemini-3.8-flash",
	"gemini-3.5-flash-lite",
	"grok-4.7",
	"grok-4.20-0309-non-reasoning",
] as const;

/** Default for the tools that write text: questions, ideas, suggestions. */
export const DEFAULT_AI_MODEL = "gpt-6.1-terra";

/** Default for the tools that generate graph statements (ontology, AI
 * knowledge graph) or probe a model's view (analyze_llm_results). */
export const DEFAULT_GRAPH_MODEL = "claude-opus-5-5";
