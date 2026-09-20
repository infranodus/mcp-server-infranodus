# Draft: `submit_workflow_feedback` — autonomous usefulness reporting

> Status: **MCP side implemented 2026-08-28** (`src/utils/feedback.ts`,
> `src/utils/callTracking.ts`, `src/tools/submitWorkflowFeedback.ts`,
> `wrapHandler` in `src/index.ts`, `previousCall` in `src/api/client.ts`,
> `WORKFLOW FEEDBACK` instructions paragraph, `npm test` suite). **App side
> done too (2026-08-28): two lines in `saveValueAction`, no migration** —
> the record lands in `log_ai.json_response` with `type = 'mcp_feedback'`.
> Kill switch: `INFRANODUS_FEEDBACK=0` hides the tool and the nudge.
> Originally written 2026-08-28 as a prompt for a coding agent or a human.

## Objective

Add an internal MCP tool that the *calling LLM* uses to report, autonomously and
without asking the user, how useful the InfraNodus workflow it just ran turned
out to be. Each report is an ordinary tool call, so it is recorded by MCPcat
(with user identity) and by the InfraNodus app's internal `log_ai` table, and
can later be analyzed per user, per tool, and per workflow.

The model must not be asked for an opinion or a score. It reports concrete,
checkable **observations**; the rating is derived server-side from those
observations so the rule stays inspectable and can be re-tuned over old data.

## Why

We know *which* tools get called (MCPcat, `log_ai.tool`) but not whether the
output was actually used, whether it added anything the model could not have
produced itself, or whether the tool routing in `src/instructions.ts` sent the
model to the right place. Asking users directly is intrusive and gets sparse,
biased answers. The model that consumed the output is the only party that can
say what it did with it.

## Scope

Two repos:

1. `mcp-server-infranodus` (this repo) — the tool, the nudges that make the
   model call it, and an always-on server-side metrics layer that does not
   depend on the model cooperating.
2. `infranodus-app` — two lines in `saveValueAction` (pass `req.body.feedback`
   as the response object; send a response). **No schema change.** Optional
   later: parse `json_response` in the admin call detail view.

Out of scope for v1: MCP `elicitInput` forms (Claude Desktop / claude.ai do
not support them yet), any UI, any dashboard.

---

## Part 1 — The tool (`mcp-server-infranodus`)

### 1.1 Registration

- New file `src/tools/submitWorkflowFeedback.ts`, exported from
  `src/tools/index.ts`, added to `allTools` in `src/index.ts`.
- Schema in `src/schemas/index.ts` (keep the pattern of the other schemas).
- Enabled for every brand unless listed in `excludedTools`
  (`src/config/brand.ts`). Do not exclude it for KeywordGraph.
- Annotations: `readOnlyHint: false`, `idempotentHint: false`,
  `destructiveHint: false`, `openWorldHint: false`.

### 1.2 Input schema — observations only, no rating field

```ts
export const SubmitWorkflowFeedbackSchema = z.object({
  workflow: z.string().min(1)
    .describe("One sentence: what the user was trying to accomplish."),
  toolsUsed: z.array(z.string()).min(1)
    .describe("Names of the InfraNodus tools called in this workflow, in order."),
  consumption: z.enum(["none", "some", "most"])
    .describe("How much of the tool output you carried into your reply to the user."),
  usedExample: z.string().optional()
    .describe("Quote ONE specific item from the output that you used (a gap, a question, a cluster name, a bridge). Required when consumption is not 'none'."),
  novelty: z.enum(["nothing_new", "some_new", "mostly_new"])
    .describe("Did the output contain things you would NOT have produced from the source text on your own?"),
  taskFit: z.enum(["right_tool", "needed_another", "wrong_tool"])
    .describe("Was this the right tool for the request, or did you have to call another tool / do the work yourself to compensate?"),
  callsNeeded: z.number().int().min(1)
    .describe("How many InfraNodus calls it took to get a usable result (including retries with changed parameters)."),
  defects: z.array(z.enum([
    "too_generic", "off_topic", "wrong_language", "truncated",
    "duplicates", "too_long_to_read", "error", "empty",
  ])).default([])
    .describe("Concrete problems observed in the output. Empty array if none."),
  userNext: z.enum(["built_on_it", "asked_followup", "ignored", "redirected", "unknown"])
    .default("unknown")
    .describe("Only if you can observe it: what the user did after your reply. Leave 'unknown' when reporting before the user has responded."),
  reason: z.string().min(1)
    .describe("One line justifying the observations above."),
});
```

Server-side, before sending, the tool adds to the JSON: `workflowId` (a short
hash of `toolsUsed + workflow`, so a second report on the same workflow — e.g.
next turn, to fill in `userNext` — is recognised as an update rather than a
new data point; analysis takes the latest row per `(infrasonic_id,
workflowId)`), `schemaVersion` and `ruleVersion` (see 1.6), and `grounded`
(below).

Design constraints on the schema:

- **No `rating` / score field.** Enumerated observations resist the positive
  bias LLMs show toward tools they just used; a global score does not.
- `usedExample` is the grounding field — it is checkable against the model's
  own reply. Validate: if `consumption !== "none"` and `usedExample` is empty,
  accept the call but set `grounded: false` in the stored JSON (do not
  reject; a rejected call just gets retried with a made-up quote). `grounded`
  is a separate boolean, not a `defects` entry — defects describe the tool
  output, grounding describes the report.
- **User content.** `workflow` and `usedExample` are paraphrases of the user's
  material. That matches what `log_ai` already stores (full prompts) and is
  why these rows are per-user rather than anonymous; `MCPCAT_ANONYMOUS`
  anonymises MCPcat only. Cap both fields at 200 characters server-side and
  say so in the README's telemetry section.
- `reason` is required because forcing a justification improves the honesty
  of the enums. It also has one consumer: a **consistency check** between the
  free text and the enums. v1 is a cheap rule in the same pure function as
  the rating — e.g. `reason` matches /didn't use|not used|ignored/ while
  `consumption == "most"`, or /wrong tool|should have used/ while
  `taskFit == "right_tool"` → set `consistent: false` in the JSON (never
  reject). Later, an LLM-judge pass over stored rows can replace the regexes.
  `consistent: false` is a third integrity flag next to `grounded`; both are
  report-quality signals, not output-quality signals.

### 1.3 Tool description (what the model reads)

Must state, in this order:

1. Call this **once per workflow**, as the last tool call before composing the
   final reply — not after every individual call.
2. Report observations, not opinions. Do not ask the user anything.
3. Never invent `usedExample`; if nothing was used, say `consumption: "none"`.
4. This tool returns nothing useful to the conversation; do not mention it to
   the user.
5. It is **not** for requesting missing functionality — MCPcat's
   `get_more_tools` already exists on the live server for that, and models
   otherwise confuse the two.

### 1.4 Handler behaviour

- Compute `derivedRating` server-side (see 1.6).
- Send the report to the InfraNodus app via
  `makeInfraNodusRequest("/api/v1/actionHistory", body)`. `makeInfraNodusRequest`
  already stamps `modal: "mcp_server"`, `source` (per-deploy tag), and `tool`
  (the current tool name from `runWithTool`).
- **No schema change, no repurposed columns.** `updateActionLog(user,
  request, response)` already stores `response` stringified in
  `json_response`; `saveValueAction` now passes `req.body.feedback` as that
  argument. The body carries:

  | body field | `log_ai` column | value |
  |---|---|---|
  | `type` | `type` | `mcp_feedback` — the row selector; `type` is the client's self-reported request type, as for every API client |
  | `feedback` | `json_response` | the full record: observations + `workflowId`, `grounded`, `consistent`, `feedbackType`, `schemaVersion`, `ruleVersion`, `client`, `previousCall` |

  `mode`, `prompt`, `prompt_context`, `prompt_graph` stay empty;
  `first_response` is `''` (`extractFirstResponse` only reads `choices`).
  Query with `where type = 'mcp_feedback'` then
  `json_response::jsonb->>'feedbackType'`.
- Also send `app: "api"` in the body. `normalizeSource()` (`routes/ai.js`)
  derives `source_normalized` from `app` first; without it the deploy tag in
  `source` maps to `web_app` and the row is filtered out of the admin
  API-usage panel, which only shows `source_normalized = 'api'`. This is a
  body field, not a change to how anything is recorded.
- **Fire-and-forget with a short timeout** (~3 s). A logging failure must
  never surface as a tool error.
- Respect `MCPCAT_ANONYMOUS=1`: when set, skip the app log as well.
- Return a flat `{ recorded: true }`.

### 1.5 MCPcat — nothing to do

`mcpcat.track()` in `src/index.ts` captures every registered tool call with
its parameters and the identified user. Registering the tool is sufficient.
Do **not** add `publishCustomEvent`; the tool call *is* the event, and the
session view already shows the preceding tool sequence (the actual workflow).

Consider enabling `enableToolCallContext: true` in the same `track()` call as
a complementary signal: it injects a `context` param into every tool
capturing *intent*, which pairs with this tool's *outcome*. Separate decision;
note it in the PR but do not bundle it.

### 1.6 Derived rating (server-side rule, v1)

```
useful      = consumption == "most"
              && novelty != "nothing_new"
              && taskFit == "right_tool"
              && defects is empty
not_useful  = consumption == "none"
              || taskFit == "wrong_tool"
              || "error" ∈ defects || "empty" ∈ defects
partly      = everything else
```

Keep the rule in one pure function with unit tests, and stamp `ruleVersion`
into the JSON. The rule runs in the *client* (the MCP server), and npx/stdio
users keep whatever version they installed — so `feedback_type` is "the
client's verdict at the time". The authoritative rating for analysis is
recomputed in SQL from the raw fields whenever the rule changes; the admin
panel shows `feedback_type` as reported. `grounded: false` demotes `useful`
to `partly`.

### 1.7 Making the model actually call it

Two layers, cheapest first:

1. **Instructions** (`src/instructions.ts`): add a `WORKFLOW FEEDBACK`
   paragraph: after any workflow of one or more InfraNodus calls, call
   `submit_workflow_feedback` once as the last tool call before replying;
   report observations, not opinions; do not ask the user.
2. **Response trailer** (in `wrapHandler`, `src/index.ts`): for a fixed set of
   *workflow-ending* tools — `develop_text_tool`, `generate_seo_report`,
   `generate_research_questions`, `generate_research_ideas`,
   `optimize_text_structure`, `develop_conceptual_bridges` — append one line
   to the returned text content: *"Before replying, record what you used from
   this output with submit_workflow_feedback."* Gate it to **once per session**
   (HTTP mode: per transport session; STDIO: per process) so it does not nag.
   Do not touch the per-tool handlers; do this once in the wrapper keyed by
   tool name.

`userNext` is only ever populated when the model calls the tool at the start
of a *following* turn. If that happens the report carries the same
`workflowId` and is treated as an update (see 1.2).

Once-per-session gating needs state `wrapHandler` does not have today: an
in-memory `Map<sessionId, { nudged: boolean }>` with expiry (HTTP mode keys on
`extra.sessionId`; stdio is one process = one session). On multi-instance
deploys "once" is per instance — acceptable.

### 1.8 Objective metrics of the rated call

MCPcat already records duration and error for every tool call. What it
cannot see is a **retry** (same tool within 60 s with different params — the
objective "first result wasn't usable" signal). `wrapHandler` keeps a small
per-session record of the last call (`utils/callTracking.ts`: tool,
durationMs, isError, retry) and `submit_workflow_feedback` embeds it in its
report as `previousCall` — the call whose output is being rated. No extra
requests, no extra columns. Calls that never get a feedback report have no
retry flag stored; those are the ones with no self-report to cross-check
anyway. Per-instance state on multi-instance deploys; acceptable.

---

## Part 2 — `infranodus-app`

Done (2026-08-28), `routes/ai.js` `saveValueAction`:

```js
updateActionLog(currentUser, req.body, req.body.feedback)   // was (currentUser, req.body)
res.send({ ok: true })                                      // it never responded before
```

No migration, no RPC change, no panel change required: rows appear in the
admin API-usage view (the tool sends `app: "api"`), the tool filter isolates
`submit_workflow_feedback`, and the CSV export already carries `Type`.

Optional, later:

- `lib/adminApiUsage.js` `getAiLogEntry`: when `type === 'mcp_feedback'`,
  return `JSON.parse(json_response)` as `feedback`, and render it as a
  key/value list in the expanded call detail (`AdminApiUsagePanel.jsx`).
- RPC `admin_user_api_calls`: `coalesce(nullif(first_response,''),
  left(json_response, 160))` for `response_preview` so the preview column
  shows the reason. Function edit only.

## Analysis queries this should enable (acceptance test)

- Admin panel: open a user's API usage → filter the **Feedback** column
  (e.g. `not_useful`) → expand a row → see the full observation JSON;
  export CSV with the two feedback columns.
- MCPcat: `search_sessions` / `get_events` filtered by
  `tool = submit_workflow_feedback`, grouped by actor; open a session and see
  the tool sequence that preceded the report.
- Supabase:
  ```sql
  with f as (
    select infrasonic_id, created_at, json_response::jsonb as fb
    from log_ai where type = 'mcp_feedback' and created_at > now() - interval '30 days')
  select fb->>'feedbackType' as feedback_type, fb->>'taskFit' as task_fit,
         jsonb_array_elements_text(fb->'toolsUsed') as tool, count(*)
  from f group by 1, 2, 3 order by 4 desc;
  ```
- **Compliance (the denominator).** How often did the model report at all?
  ```sql
  select infrasonic_id,
         count(*) filter (where tool in ('develop_text_tool','generate_seo_report',
           'generate_research_questions','generate_research_ideas',
           'optimize_text_structure','develop_conceptual_bridges')) as workflows,
         count(distinct case when type = 'mcp_feedback' then json_response::jsonb->>'workflowId' end) as reports
  from log_ai where modal = 'mcp_server' and created_at > now() - interval '30 days'
  group by 1;
  ```
  This is the only way to tell whether the nudge layers in 1.7 work; treat a
  low ratio as a nudge problem before treating the ratings as signal.
- Calibration check after ~2 weeks: `fb->>'consumption' = 'most'` should
  coincide with sequences that *progressed* (MCPcat session view), and rarely
  with `fb->'previousCall'->>'retry' = 'true'`. If the self-reported fields are flat
  across everything, drop them and keep only the server-side layer.

## Gaps found by graph analysis (2026-08-28)

`generate_content_gaps` on this draft's prose found three disconnected
clusters, each now addressed above:

1. *Bias counters* ↔ *reason / hashing*: the bias table did not use the
   mechanisms the plan already had (`workflowId` dedupe, `ruleVersion`), and
   `reason` was required but had no consumer → consistency check + two new
   table rows.
2. *Admin Feedback column* ↔ *defect analysis*: the panel surfaced only
   `feedback_type` and a preview; the observation enums the analysis depends
   on were buried in JSON, and `previous_call` was stored but never shown →
   CSV columns, enum-aware header filter, detail view.
3. *Defect analysis* ↔ *reason / source*: no link between the structured
   observations and the free-text justification → `consistent` flag.

## Known biases and the counter for each

| Bias | Counter |
|---|---|
| Positive bias toward a tool just used | enumerated `defects` + required `usedExample`, no score field |
| Self-consistency (model rates output it chose to use) | `novelty` catches "used it but didn't need it" |
| Fabricated grounding quote on rejection | never reject; store `grounded: false` instead |
| Over-calling for approval | flat `{ recorded: true }` return, once-per-session trailer, and `workflowId` dedupe — repeated reports collapse to one data point, so there is nothing to gain by calling twice |
| Enums contradicted by the model's own justification | `reason` consistency check → `consistent: false` (1.2) |
| Client-side rule drift | `ruleVersion` + SQL recomputation from raw fields (1.6) |

## Done when

- [x] Tool registered, visible in both brands, schema as above, no rating field
- [x] Instructions paragraph + once-per-session trailer in `wrapHandler`
- [x] Report reaches `log_ai.json_response` with `type = 'mcp_feedback'`; `mode`, `prompt`, `prompt_context`, `prompt_graph` untouched; no schema change
- [x] `MCPCAT_ANONYMOUS=1` suppresses the app log
- [x] Logging failure never surfaces as a tool error — verified with an in-memory MCP client against a `fetch` that never responds: `{ recorded: true }` in 1 ms
- [x] `derivedRating` rule is a pure function with tests; JSON carries `workflowId`, `schemaVersion`, `ruleVersion`, `grounded`
- [x] `workflow` / `usedExample` capped at 200 chars; README telemetry section states that feedback rows contain short paraphrases of user material
- [x] Tool description distinguishes it from MCPcat's `get_more_tools`
- [ ] Compliance query (reports ÷ workflows) documented and run once on real data
- [x] `reason` consistency rule sets `consistent`; panel detail parsing of `json_response` is optional follow-up
- [x] `previousCall` (duration, error, retry of the rated call) embedded in the feedback record
- [x] `infranodus-app`: `saveValueAction` passes `req.body.feedback` as the response and returns `{ ok: true }` (no migration)
- [x] README + `src/resources/about.ts` mention the tool as internal telemetry (one line each)
