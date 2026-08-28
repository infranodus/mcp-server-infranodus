/**
 * Pure helpers for `submit_workflow_feedback` (see
 * docs/drafts/workflow-feedback-tool.md). Everything here is deterministic
 * and unit-tested; nothing touches the network.
 *
 * The model reports observations, never a score. The rating is derived here
 * so the rule is inspectable and versioned; the raw observations are stored
 * alongside it so the rating can be recomputed in SQL when the rule changes.
 */
import { createHash } from "node:crypto";

export const FEEDBACK_SCHEMA_VERSION = 1;
export const FEEDBACK_RULE_VERSION = 1;
export const MAX_TEXT_FIELD_LENGTH = 200;

export const CONSUMPTION = ["none", "some", "most"] as const;
export const NOVELTY = ["nothing_new", "some_new", "mostly_new"] as const;
export const TASK_FIT = ["right_tool", "needed_another", "wrong_tool"] as const;
export const DEFECTS = [
	"too_generic",
	"off_topic",
	"wrong_language",
	"truncated",
	"duplicates",
	"too_long_to_read",
	"error",
	"empty",
] as const;
export const USER_NEXT = [
	"built_on_it",
	"asked_followup",
	"ignored",
	"redirected",
	"unknown",
] as const;

export type Consumption = (typeof CONSUMPTION)[number];
export type Novelty = (typeof NOVELTY)[number];
export type TaskFit = (typeof TASK_FIT)[number];
export type Defect = (typeof DEFECTS)[number];
export type UserNext = (typeof USER_NEXT)[number];
export type FeedbackType = "useful" | "partly" | "not_useful";

export interface FeedbackObservations {
	workflow: string;
	toolsUsed: string[];
	consumption: Consumption;
	usedExample?: string;
	novelty: Novelty;
	taskFit: TaskFit;
	callsNeeded: number;
	defects: Defect[];
	userNext: UserNext;
	reason: string;
}

export interface PreviousCallMetrics {
	tool: string;
	durationMs: number;
	isError: boolean;
	retry: boolean;
	at: string;
}

export interface FeedbackRecord extends FeedbackObservations {
	workflowId: string;
	grounded: boolean;
	consistent: boolean;
	feedbackType: FeedbackType;
	schemaVersion: number;
	ruleVersion: number;
	client?: string;
	/** Objective metrics of the call that produced the rated output (utils/callTracking.ts). */
	previousCall?: PreviousCallMetrics;
}

/**
 * Stable id for "this workflow": the same tools in the same order for the
 * same goal. A second report (e.g. next turn, to fill in `userNext`) gets the
 * same id and is treated as an update by the analysis, not a new data point.
 */
export function workflowId(toolsUsed: string[], workflow: string): string {
	const key = `${toolsUsed.join(">")}|${workflow.trim().toLowerCase()}`;
	return createHash("sha1").update(key).digest("hex").slice(0, 10);
}

export function capText(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	return trimmed.length > MAX_TEXT_FIELD_LENGTH
		? `${trimmed.slice(0, MAX_TEXT_FIELD_LENGTH - 1)}…`
		: trimmed;
}

/** A report that claims usage must quote what it used. */
export function isGrounded(
	consumption: Consumption,
	usedExample: string | undefined,
): boolean {
	if (consumption === "none") return true;
	return Boolean(usedExample && usedExample.trim().length > 0);
}

const NOT_USED_RE = /\b(didn'?t|did not|never|not)\s+(use|used|using|need|needed|incorporate)\b|\bignored\b|\bdiscarded\b|\bunused\b/i;
const WRONG_TOOL_RE = /\bwrong tool\b|\bshould have (used|called)\b|\bbetter tool\b|\bnot the right tool\b/i;

/**
 * Cheap check that the free-text justification does not contradict the
 * enums. Report-quality signal, not output-quality: it never changes what the
 * model said, only flags it.
 */
export function isConsistent(observations: FeedbackObservations): boolean {
	const reason = observations.reason;
	if (observations.consumption === "most" && NOT_USED_RE.test(reason)) {
		return false;
	}
	if (observations.taskFit === "right_tool" && WRONG_TOOL_RE.test(reason)) {
		return false;
	}
	return true;
}

/** Rule v1 — keep in sync with FEEDBACK_RULE_VERSION and the draft §1.6. */
export function deriveFeedbackType(
	observations: FeedbackObservations,
	grounded: boolean,
): FeedbackType {
	const { consumption, novelty, taskFit, defects } = observations;
	if (
		consumption === "none" ||
		taskFit === "wrong_tool" ||
		defects.includes("error") ||
		defects.includes("empty")
	) {
		return "not_useful";
	}
	if (
		consumption === "most" &&
		novelty !== "nothing_new" &&
		taskFit === "right_tool" &&
		defects.length === 0 &&
		grounded
	) {
		return "useful";
	}
	return "partly";
}

export function buildFeedbackRecord(
	observations: FeedbackObservations,
	client?: string,
	previousCall?: PreviousCallMetrics,
): FeedbackRecord {
	const workflow = capText(observations.workflow) ?? "";
	const usedExample = capText(observations.usedExample);
	const grounded = isGrounded(observations.consumption, usedExample);
	const normalized: FeedbackObservations = {
		...observations,
		workflow,
		usedExample,
		reason: capText(observations.reason) ?? "",
		defects: [...new Set(observations.defects)],
	};
	return {
		...normalized,
		workflowId: workflowId(observations.toolsUsed, workflow),
		grounded,
		consistent: isConsistent(normalized),
		feedbackType: deriveFeedbackType(normalized, grounded),
		schemaVersion: FEEDBACK_SCHEMA_VERSION,
		ruleVersion: FEEDBACK_RULE_VERSION,
		...(client ? { client } : {}),
		...(previousCall ? { previousCall } : {}),
	};
}
