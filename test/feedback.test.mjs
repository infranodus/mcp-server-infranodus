// Run with: npm test  (builds to dist/ first, then node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	buildFeedbackRecord,
	deriveFeedbackType,
	isConsistent,
	isGrounded,
	workflowId,
	capText,
	MAX_TEXT_FIELD_LENGTH,
	FEEDBACK_RULE_VERSION,
	FEEDBACK_SCHEMA_VERSION,
} from "../dist/utils/feedback.js";
import {
	recordCall,
	previousCallFor,
	claimNudge,
	resetCallTracking,
	RETRY_WINDOW_MS,
} from "../dist/utils/callTracking.js";

const base = {
	workflow: "Find research gaps in a paper on attention mechanisms",
	toolsUsed: ["generate_content_gaps", "generate_research_questions"],
	consumption: "most",
	usedExample: "How does sparse attention interact with positional encoding?",
	novelty: "some_new",
	taskFit: "right_tool",
	callsNeeded: 1,
	defects: [],
	userNext: "unknown",
	reason: "Used three of the five questions verbatim in the reply.",
};

test("rule v1: useful only when everything lines up", () => {
	assert.equal(deriveFeedbackType(base, true), "useful");
	assert.equal(deriveFeedbackType({ ...base, novelty: "nothing_new" }, true), "partly");
	assert.equal(deriveFeedbackType({ ...base, consumption: "some" }, true), "partly");
	assert.equal(deriveFeedbackType({ ...base, defects: ["too_generic"] }, true), "partly");
	assert.equal(deriveFeedbackType(base, false), "partly", "ungrounded demotes useful");
});

test("rule v1: not_useful conditions", () => {
	assert.equal(deriveFeedbackType({ ...base, consumption: "none" }, true), "not_useful");
	assert.equal(deriveFeedbackType({ ...base, taskFit: "wrong_tool" }, true), "not_useful");
	assert.equal(deriveFeedbackType({ ...base, defects: ["error"] }, true), "not_useful");
	assert.equal(deriveFeedbackType({ ...base, defects: ["empty"] }, true), "not_useful");
});

test("grounding: usage claims need a quote; none never needs one", () => {
	assert.equal(isGrounded("none", undefined), true);
	assert.equal(isGrounded("some", undefined), false);
	assert.equal(isGrounded("most", "   "), false);
	assert.equal(isGrounded("most", "a quoted gap"), true);
});

test("consistency: free text contradicting the enums is flagged, never rejected", () => {
	assert.equal(isConsistent(base), true);
	assert.equal(isConsistent({ ...base, reason: "I didn't use any of it in the end." }), false);
	assert.equal(isConsistent({ ...base, reason: "Wrong tool for this; should have used analyze_text." }), false);
	assert.equal(isConsistent({ ...base, consumption: "none", reason: "Didn't use it." }), true, "only contradictions count");
});

test("workflowId is stable for the same workflow and differs otherwise", () => {
	const a = workflowId(base.toolsUsed, base.workflow);
	assert.equal(a, workflowId(base.toolsUsed, `  ${base.workflow.toUpperCase()} `));
	assert.notEqual(a, workflowId(["analyze_text"], base.workflow));
	assert.notEqual(a, workflowId(base.toolsUsed, "something else"));
	assert.match(a, /^[0-9a-f]{10}$/);
});

test("text fields are capped and the record carries versions and flags", () => {
	const long = "x".repeat(MAX_TEXT_FIELD_LENGTH + 50);
	assert.equal(capText(long).length, MAX_TEXT_FIELD_LENGTH);
	const record = buildFeedbackRecord(
		{ ...base, workflow: long, usedExample: long, defects: ["too_generic", "too_generic"] },
		"Claude Code",
	);
	assert.equal(record.workflow.length, MAX_TEXT_FIELD_LENGTH);
	assert.equal(record.usedExample.length, MAX_TEXT_FIELD_LENGTH);
	assert.deepEqual(record.defects, ["too_generic"]);
	assert.equal(record.schemaVersion, FEEDBACK_SCHEMA_VERSION);
	assert.equal(record.ruleVersion, FEEDBACK_RULE_VERSION);
	assert.equal(record.grounded, true);
	assert.equal(record.consistent, true);
	assert.equal(record.feedbackType, "partly");
	assert.equal(record.client, "Claude Code");
	assert.equal(record.previousCall, undefined);
	const withPrev = buildFeedbackRecord(base, undefined, { tool: "develop_text_tool", durationMs: 1200, isError: false, retry: true, at: "2026-08-28T00:00:00.000Z" });
	assert.equal(withPrev.previousCall.retry, true);
	assert.equal(withPrev.client, undefined);
});

test("call tracking: retry detection and previousCall handoff", () => {
	resetCallTracking();
	const t0 = 1_000_000;
	const first = recordCall("s1", { tool: "analyze_text", params: { text: "a" }, startedAt: t0, finishedAt: t0 + 120, isError: false });
	assert.equal(first.retry, false);
	assert.equal(first.durationMs, 120);
	assert.deepEqual(previousCallFor("s1"), first);

	const second = recordCall("s1", { tool: "analyze_text", params: { text: "b" }, startedAt: t0 + 5_000, finishedAt: t0 + 5_100, isError: true });
	assert.equal(second.retry, true, "same tool, different params, inside the window");
	assert.equal(second.isError, true);

	const third = recordCall("s1", { tool: "analyze_text", params: { text: "b" }, startedAt: t0 + 6_000, finishedAt: t0 + 6_050, isError: false });
	assert.equal(third.retry, false, "identical params is a repeat, not a retry");

	const late = recordCall("s1", { tool: "analyze_text", params: { text: "c" }, startedAt: t0 + 6_050 + RETRY_WINDOW_MS + 1, finishedAt: t0 + 6_050 + RETRY_WINDOW_MS + 10, isError: false });
	assert.equal(late.retry, false, "outside the window");

	assert.equal(previousCallFor("other"), undefined, "sessions are isolated");
});

test("nudge fires once per session", () => {
	resetCallTracking();
	assert.equal(claimNudge("s1"), true);
	assert.equal(claimNudge("s1"), false);
	assert.equal(claimNudge("s2"), true);
});
