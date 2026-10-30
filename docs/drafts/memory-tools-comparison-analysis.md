# Analysis: the InfraNodus memory plugin against other LLM memory tools

> Status: **analysis, 2026-10-30.** Input to
> [`infranodus-memory-system.md`](infranodus-memory-system.md). Sources: the
> comparison page at https://infranodus.com/docs/llm-memory-tools-comparison
> (data as of 2026-10-24) and that draft. When fetched, the page's last
> section ("What Nobody Measures") came back only as a summary, so nothing
> here relies on it.

## The short version

The comparison page sorts the tools by how they store memory: flat files,
vector store, temporal graph, and graph with structure analysis. On its own
table, InfraNodus is the only tool marked "shows what is missing". Every
competitor is marked "no". That points to two jobs for the plugin:

1. **As a memory system:** take the one quality each tool does best, using
   what InfraNodus already has (graph, timestamps, categories, gap analysis).
   Don't try to copy them as products.
2. **As an analytical layer:** read the other stores (read-only), mirror them
   into graphs, and report what they hold, what they lack, and where they
   disagree. None of them can do that for themselves.

A typical power-user setup shows why job 2 matters. A single Claude Code
session can pull in context from claude-mem (SessionStart), Mem0
(UserPromptSubmit) and native auto-memory (`MEMORY.md`), with Basic Memory and
Notion memory also connected. That is four or five stores, unaudited, and
some of them already hold near-duplicates.

## Popularity (measured 2026-10-30)

GitHub numbers come from `gh api repos/<repo>`. Downloads cover the 30 days to
2026-10-29, from pypistats.org and api.npmjs.org. Funding comes from press
coverage (sources below).

| Tool | Repo | Stars | Forks | Created | PyPI / month | npm / month | Funding |
|---|---|---:|---:|---|---|---|---|
| **claude-mem** | thedotmack/claude-mem | 105,794 | 9,322 | 2025-08 | – | 78,676 (`claude-mem`) | none found |
| **MCP memory server** | modelcontextprotocol/servers (monorepo) | 91,695* | 11,891* | 2024-11 | – | 732,786 (`@modelcontextprotocol/server-memory`) | n/a (reference server) |
| **Mem0** | mem0ai/mem0 | 68,108 | 8,073 | 2023-06 | 2,020,516 (`mem0ai`) | 684,946 (`mem0ai`) | $24M seed + Series A (Oct 2025; Basis Set, Kindred, Peak XV, YC) |
| **codebase-memory-mcp** | DeusData/codebase-memory-mcp | 47,846 | 3,935 | 2026-02 | – | – | none found |
| **Cognee** | topoteretes/cognee | 32,927 | 3,438 | 2023-08 | 86,048 (`cognee`) | – | €1.5M (2024) + $7.5M seed (Feb 2026, Pebblebed) |
| **Graphiti (Zep)** | getzep/graphiti | 32,369 | 3,321 | 2024-08 | 619,128 (`graphiti-core`) + 292,185 (`zep-cloud`) | 627,789 (`@getzep/zep-cloud`) | not found in search |
| **Supermemory** | supermemoryai/supermemory | 31,469 | 2,761 | 2024-02 | 141,658 (`supermemory`) | 497,320 (`supermemory`) | $2.6–3M seed (Oct 2025; Susa Ventures) |
| **Letta** | letta-ai/letta (+ letta-code) | 25,292 (+3,741) | 2,662 | 2023-10 | 15,031 (`letta`) + 161,915 (`letta-client`) | 482,821 (`@letta-ai/letta-code`) + 400,099 (`@letta-ai/letta-client`) | $10M seed (Sep 2024; Felicis) |
| **Zep (server)** | getzep/zep | 4,984 | 659 | 2023-04 | (see above) | (see above) | – |
| **Basic Memory** | basicmachines-co/basic-memory | 4,416 | 343 | 2024-12 | 27,770 (`basic-memory`) | – | – |
| **LangMem** | langchain-ai/langmem | 1,736 | 202 | 2025-01 | 773,504 (`langmem`) | – | (LangChain) |
| **InfraNodus MCP** | infranodus/mcp-server-infranodus | 104 | 28 | 2025-09 | – | 1,284 (`infranodus-mcp-server`) | – |
| Native Claude / ChatGPT memory | – | – | – | – | – | – | no public usage numbers; largest by reach (built into the apps) |

\* The stars and forks of the whole `modelcontextprotocol/servers` monorepo,
not the memory server alone. Its npm downloads are the better measure.

**How to read these numbers**

- Stars measure attention, not use, and can be inflated. claude-mem
  (105k stars in 14 months) and codebase-memory-mcp (48k in 8 months) grew
  very fast, which looks like social-media virality more than steady adoption.
- Downloads include CI runs and transitive installs. LangMem (774k/month on
  PyPI, 1.7k stars) is almost certainly pulled in as a dependency of the
  LangChain/LangGraph stack. Mem0 (2M PyPI + 685k npm) and Graphiti/Zep
  (~1.5M across packages) have the strongest measured use.
- Hosted use isn't counted. Zep Cloud, Supermemory's API, the native app
  memories and InfraNodus's hosted MCP (`mcp.infranodus.com`, which is how
  most InfraNodus users connect) don't show up in package downloads, so the
  `infranodus-mcp-server` figure understates InfraNodus use.

**What it means for the plugin**

1. **InfraNodus is two to three orders of magnitude smaller** than the
   leaders by every public measure. Competing as "another memory store" means
   competing with $24M-funded Mem0 and 100k-star claude-mem. Being the
   analytical layer over them doesn't. Their user base becomes the market
   for the analysis.
2. **Coding-agent memory plugins are the fastest-growing category**
   (claude-mem, codebase-memory-mcp, letta-code at 483k npm/month). The
   `infranodus-memory` plugin targets exactly this category, so its
   differentiator (gaps, readable graph) has to be visible in the first
   session, not after weeks of capture.
3. **Mirror priority by popularity:** claude-mem and the MCP memory server
   (huge installed base, simple local formats: SQLite / `memory.jsonl`),
   then Mem0 (largest measured use, has an export API), then Graphiti/Zep,
   then Supermemory. Claude auto-memory folders and `CLAUDE.md` come
   alongside the first group, since every Claude Code user has them.
4. **Funding shows where the category is heading:** Mem0, Letta and Cognee
   all pitch "memory infrastructure for agents" to developers. None of them
   pitches analysis of memory. That position is open.

**Sources**

- GitHub API (`gh api repos/...`), pypistats.org `/api/packages/<pkg>/recent`,
  api.npmjs.org `/downloads/point/last-month/<pkg>`, all queried 2026-10-30.
- Mem0: [Built In](https://builtin.com/articles/mem0-raises-24m-AI-memory-infrastructure-20251103),
  [Inc42](https://inc42.com/buzz/mem0-raises-24-mn-to-scale-its-ai-memory-infrastructure),
  [CB Insights](https://www.cbinsights.com/company/mem0/financials)
- Supermemory: [TechCrunch](https://techcrunch.com/2025/10/06/a-19-year-old-nabs-backing-from-google-execs-for-his-ai-memory-startup-supermemory/),
  [Supermemory blog](https://supermemory.ai/blog/supermemory-raises-3-million-and-building-the-best-memory-engine-for-llms)
- Letta: [PR Newswire](https://prnewswire.com/news-releases/berkeley-ai-research-lab-spinout-letta-raises-10m-seed-financing-led-by-felicis-to-build-ai-with-memory-302257004.html)
- Cognee: [Cognee](https://www.cognee.ai/cognee-raises-seven-million-five-hundred-thousand-dollars-seed),
  [Dealroom](https://dealroom.co/news/125999-cognee-raises-7-5m-to-build-memory-layer-for-ai-agents/)

## Part 1: Each tool's best quality and how the plugin could serve it

| Tool | Best quality (per the page) | In the draft today | Proposed addition |
|---|---|---|---|
| **Mem0** | Scoped memory (user / session / agent); easy to drop into an SDK | Has learnings / memory / personal scopes, `session-<id>` tags, and `client` on every call | Treat `client` (plus agent id) as a real filterable scope. Don't compete on scale; the page already says so |
| **Zep / Graphiti** | Two timelines per fact ("what was true on date X"); old facts invalidated, not deleted | Supersession keeps the old statement with its timestamp and a `superseded` category | Add `asOf` to `/memory/get` and `/learnings/get` so the agent can ask "what did we believe in March". The data is already there |
| **Letta** | Memory blocks always in context, which the agent edits itself | Recall returns up to 5 items matched to the prompt, so it changes every session | Add a small **core block** per project: top concepts, the main gap, and 2–3 pinned conventions, injected every time. Matching items come on top. The agent edits it with `update_statements` |
| **Cognee** | `remember / recall / improve / forget`; turns documents into graphs | Has remember, recall and forget (`/memory/forget`). The repo/vault digest covers documents | Add an **`improve`** pass that runs periodically or on demand: `optimize_knowledge_base` over `learn-<slug>`, merges near-duplicates, and proposes bridge statements for gaps. It writes to the inbox in review mode. Cognee's version only consolidates; this one would also show the memory's structure |
| **Supermemory** | Different lifetimes: facts persist, preferences strengthen with repetition, episodes decay | Jaccard dedup drops repeats, which throws away the reinforcement signal | When dedup finds a match, add a timestamp or bump a count instead of dropping it. Recall ranking then uses frequency (and graph degree) for preferences and recency decay for episodes. The graph already shows which concepts become central through repetition |
| **MCP memory server** | One plain file of entities, relations and observations you can open | `memory_add_relations` already uses `[[entity]]` statements | An importer for `memory.jsonl`. It's trivial and gets those users onto the analysis |
| **Native Claude / ChatGPT** | Fully automatic, nothing to set up | The plugin is on from install, which matches | The page names their weakness: "they stop at the app". Phase 5 (multi-client hooks plus the rules-file fallback) is exactly the answer, so it's worth stating in positioning |
| **CLAUDE.md / auto-memory** | Readable, versioned files | Open question 5 says "never sync" | Keep never writing to them, but allow reading them (see Part 2). Those are two different decisions |

## Part 2: The analytical layer

Adapters that mirror other stores into graphs, read-only, without becoming the
store of record:

- **Sources:** Mem0 (`search_memories` / export), Graphiti (Cypher dump),
  Cognee (its DBs), `memory.jsonl`, Claude auto-memory folders, `CLAUDE.md`,
  claude-mem observations, Basic Memory / Obsidian notes.
- **Shape:** `mirror-<source>-<project>` graphs. Each statement carries a
  `source:<tool>` category and the original timestamp. They are never written
  back.
- **What it reports** (with existing tools):
  - **Gaps per store:** `generate_content_gaps` / `optimize_knowledge_base`.
    For example, "Mem0 holds 40 preferences but no decisions" or "auto-memory
    covers testing but nothing about deploy".
  - **Differences between stores:** `difference_between_texts` /
    `overlap_between_texts`. What Mem0 knows that `learn-<slug>` doesn't, and
    vice versa.
  - **Duplicates and contradictions:** the same entity pair with conflicting
    relations across sources, or a note in one store that another has already
    marked stale.
  - **Change over time:** timestamps give a changing graph. Which topics are
    growing, and which went stale.
- **Where it shows up:** in the recall gap line ("Gap: Mem0 and learnings
  disagree on the test runner"), and in an occasional `/memory audit` report.
  The audit, not every-turn recall, is where the analysis pays off.

This matches how the page positions InfraNodus: "for a person to read and for
an agent to query by structure", not for high-volume retrieval. It also turns
competitors into inputs. A Mem0 user doesn't have to switch to get gap
analysis.

## Proposed edits to the memory-system draft

1. Add a section called **"Analytical layer over other memory stores"**:
   read-only mirrors, `source:` categories, `/memory audit`. Reword open
   question 5 to "never write to them; reading them for analysis is opt-in per
   source".
2. In **Recall output**, add a stable **core block** in Letta's style, ahead
   of the items matched to the prompt.
3. In the **Supersession rule**, add an `asOf` query parameter so Zep-style
   "what was true then" questions work.
4. Change **dedup** so that reinforcing adds a timestamp instead of dropping,
   and say how recall ranking uses frequency and decay.
5. Add **`/memory improve`** (consolidate + gaps → inbox) to phase 3 or 4.
6. Phases: add **"6. Importers / mirrors"**, in the order set by popularity:
   claude-mem, `memory.jsonl` and the Claude auto-memory folder first, then
   Mem0, then Graphiti/Zep and Supermemory.

## Two things to be careful about

- **Consent.** Mirroring someone's Mem0 or claude-mem store means uploading it
  to InfraNodus. It needs its own per-source opt-in, separate from the plugin
  being on from install, and redaction has to apply to it too.
- **Scope.** Keep the mirrors one-way. Writing back into other stores would
  turn the plugin into a sync engine, which works against keeping the design
  simple.
