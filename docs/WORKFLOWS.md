# InfraNodus Workflows for FirstMile

## Strategic Knowledge Graph Workflows for Shipping Optimization Business

This document outlines how to leverage InfraNodus knowledge graphs to enhance FirstMile's sales, positioning, and competitive intelligence.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Workflows](#core-workflows)
   - [Discovery Call Intelligence](#workflow-1-discovery-call-intelligence)
   - [Competitive Positioning](#workflow-2-competitive-positioning)
   - [SEO Content Strategy](#workflow-3-seo-content-strategy)
   - [Proposal Enhancement](#workflow-4-proposal-enhancement)
   - [Pipeline Pattern Recognition](#workflow-5-pipeline-pattern-recognition)
3. [Integration with Existing Skills](#integration-with-existing-skills)
4. [Best Practices](#best-practices)
5. [Success Metrics](#success-metrics)

---

## Overview

### The Cognitive Upgrade

**Traditional Approach**:
- Analyze shipping data → Show savings → Generic proposal → Close deal

**Knowledge Graph Approach**:
- Analyze discourse structure → Reveal cognitive gaps → Position FirstMile as bridge → Premium close

### Key Principle

**Most sales reps see text as linear information.**
**You'll see text as a network of relationships.**

When you understand the *structure* of discourse, you respond to what prospects **didn't connect yet**, not just what they said.

---

## Core Workflows

### Workflow 1: Discovery Call Intelligence

**Objective**: Transform discovery call transcripts into strategic insights that reveal hidden pain points and positioning opportunities.

#### When to Use
- After every discovery call
- Before follow-up meetings
- When preparing proposals
- During competitive situations

#### Tools Required
- `generate_knowledge_graph`
- `generate_topical_clusters`
- `generate_content_gaps`
- `generate_research_questions`

#### Step-by-Step Process

**Step 1: Capture the Call**
```
Discovery call with [Prospect Company]
Topics discussed:
- Current shipping volumes (500-750 packages/day)
- Pain points: Expedited costs too high, Zone 8 killing margins
- Goals: 30% cost reduction, maintain 2-day SLAs
- Concerns: Switching costs, carrier relationships
```

**Step 2: Generate Knowledge Graph**
```
Command: "Use InfraNodus to generate a knowledge graph from this discovery call transcript"

Tool: generate_knowledge_graph
Parameters:
{
  text: "[full transcript]",
  includeStatements: false,
  includeGraph: false,
  addNodesAndEdges: false,
  modifyAnalyzedText: "none"
}
```

**Step 3: Identify Topical Clusters**
```
Command: "Generate topical clusters from this call"

Tool: generate_topical_clusters
Result shows:
- Cluster 1: "Cost Control" (expedited, zone 8, margins)
- Cluster 2: "Service Levels" (2-day SLA, delivery speed)
- Cluster 3: "Carrier Relationships" (switching, negotiations)
```

**Step 4: Find Content Gaps**
```
Command: "What content gaps exist in this conversation?"

Tool: generate_content_gaps
Reveals:
- Gap: "Cost Control" ↔ "Service Levels" (not connected)
- Gap: "Carrier Relationships" ↔ "Zone Optimization" (missing bridge)
- Gap: No discussion of "Data Analytics" or "Predictive Modeling"
```

**Step 5: Generate Strategic Questions**
```
Tool: generate_research_questions
Parameters: {
  text: "[transcript]",
  useSeveralGaps: true,
  gapDepth: 1,
  modelToUse: "gpt-4o"
}

Generated Questions:
- "How might you optimize Zone 8 costs without sacrificing 2-day SLAs?"
- "What if there was a way to maintain carrier relationships while reducing costs?"
- "Have you analyzed which expedited shipments could be converted to ground?"
```

#### Output & Action

**What You Discovered**:
- Prospect sees "cost" vs "speed" as trade-off (gap in thinking)
- No awareness of zone optimization strategies
- Carrier relationships are emotional, not data-driven

**How to Respond**:
```
Follow-up email structure:

"[Name], analyzing our conversation, I noticed you're balancing three priorities:
cost control, service levels, and carrier relationships. Most companies see
these as trade-offs.

Our analysis shows these three questions could change your thinking:
1. [Strategic question from gaps]
2. [Strategic question from gaps]
3. [Strategic question from gaps]

FirstMile's three-tier system connects all three priorities—that's why clients
typically see 30-40% savings WITHOUT degrading SLAs.

Want to explore how?"
```

#### Expected Results
- **Discovery Quality**: 40% more strategic questions per call
- **Conversion Rate**: 15-20% lift from better positioning
- **Deal Size**: Premium pricing through strategic positioning

---

### Workflow 2: Competitive Positioning

**Objective**: Analyze competitors' discourse to find positioning white space and differentiation opportunities.

#### When to Use
- Quarterly competitive analysis
- Before competitive deals
- When updating marketing materials
- During strategic planning

#### Tools Required
- `generate_knowledge_graph`
- `overlap_between_texts`
- `difference_between_texts`
- `develop_conceptual_bridges`

#### Step-by-Step Process

**Step 1: Gather Competitor Content**
```
Sources:
- Competitor websites (About, Services pages)
- Marketing materials
- Case studies
- Sales collateral
```

**Step 2: Analyze Each Competitor**
```
Command: "Generate knowledge graph for each competitor"

For each of 3 competitors:
Tool: generate_knowledge_graph
Parameters: {
  text: "[competitor content]",
  includeGraph: true
}

Results in 3 separate graphs showing their discourse structure
```

**Step 3: Find Common Ground**
```
Command: "What do all competitors talk about?"

Tool: overlap_between_texts
Parameters: {
  contexts: [
    { text: "[competitor 1 content]" },
    { text: "[competitor 2 content]" },
    { text: "[competitor 3 content]" }
  ]
}

Shows overlapping concepts:
- "Shipping savings"
- "Carrier partnerships"
- "Volume discounts"
- "Multi-carrier access"

This is the COMMODITY space (avoid competing here)
```

**Step 4: Identify Differentiation Gaps**
```
Command: "What's in competitors' content that's NOT connected?"

Tool: generate_content_gaps
For each competitor's graph

Common gaps across competitors:
- "Savings" ↔ "Data Analytics" (no connection)
- "Carrier Access" ↔ "Zone Optimization" (gap)
- "Volume" ↔ "Predictive Modeling" (missing)

These gaps are YOUR positioning opportunities
```

**Step 5: Position FirstMile in the Gaps**
```
Tool: develop_conceptual_bridges
Parameters: {
  text: "[combined competitor content + FirstMile capabilities]",
  modelToUse: "claude-sonnet-4"
}

Generates positioning language:
"While others offer carrier access, FirstMile bridges access with
intelligent zone optimization—that's the 15% additional savings
others can't deliver."
```

#### Output & Action

**Positioning Map**:
```
Commodity Space (Everyone):
- Multi-carrier access
- Volume discounts
- Basic savings analysis

FirstMile White Space:
- Data-driven zone optimization
- Predictive service level modeling
- Cost/speed/reliability integration
- Three-tier intelligent routing
```

**Updated Messaging**:
```
Before: "We provide access to multiple carriers for better shipping rates"
After: "We bridge the gap between carrier access and intelligent optimization—
       delivering 15% more savings than access alone"
```

#### Expected Results
- **Win Rate**: 25%+ increase in competitive deals
- **Pricing Power**: Premium positioning vs commodity competitors
- **Deal Velocity**: Faster decisions through clear differentiation

---

### Workflow 3: SEO Content Strategy

**Objective**: Dominate search results by finding and filling content gaps between what people search for and what they find.

#### When to Use
- Quarterly content planning
- Blog post ideation
- Website optimization
- Thought leadership strategy

#### Tools Required
- `analyze_google_search_results`
- `analyze_related_search_queries`
- `search_queries_vs_search_results`
- `generate_seo_report`

#### Step-by-Step Process

**Step 1: Identify Target Topics**
```
Core FirstMile topics:
- "shipping optimization"
- "ecommerce logistics"
- "parcel shipping costs"
- "multi-carrier shipping"
- "zone-based shipping"
```

**Step 2: Analyze Search Results**
```
Command: "Analyze Google search results for 'shipping optimization'"

Tool: analyze_google_search_results
Parameters: {
  queries: ["shipping optimization"],
  includeSearchResultsOnly: false,
  showGraphOnly: false,
  showExtendedGraphInfo: true
}

Shows what currently ranks:
- Generic "how to reduce shipping costs" articles
- Carrier comparison tools
- Basic shipping calculators
```

**Step 3: Analyze Search Intent**
```
Command: "What are people searching for around shipping optimization?"

Tool: analyze_related_search_queries
Parameters: {
  queries: ["shipping optimization"],
  keywordsSource: "related"
}

Related searches:
- "shipping cost calculator by zone"
- "how to optimize expedited shipping"
- "reduce zone 8 shipping costs"
- "shipping cost vs delivery speed"
```

**Step 4: Find the Gap**
```
Command: "What are people searching for that they DON'T find?"

Tool: search_queries_vs_search_results
Parameters: {
  queries: ["shipping optimization"]
}

THE OPPORTUNITY:
People search for: "zone-based shipping optimization strategies"
Current results show: Generic cost reduction tips

Content Gap = Your ranking opportunity
```

**Step 5: Generate SEO Report**
```
Tool: generate_seo_report
Parameters: {
  text: "[your current website content]",
  importLanguage: "EN",
  importCountry: "US"
}

Report shows:
{
  "inSearchResultsNotInText": {
    "contentGaps": ["Topics in results you're missing"],
    "mainConcepts": ["warehouse optimization", "fulfillment center location"]
  },
  "inSearchQueriesNotInText": {
    "contentGaps": ["zone-based pricing", "dimensional weight optimization"]
  },
  "inSearchQueriesNotInResults": {
    "contentGaps": ["THIS IS YOUR OPPORTUNITY"]
  }
}
```

#### Output & Action

**Content Calendar**:

**Q1 Blog Posts** (based on gaps):
1. **"Zone-Based Shipping Optimization: The 15% Savings Nobody Talks About"**
   - Targets: "zone 8 shipping costs" + "zone optimization strategies"
   - Gap: High search volume, low quality results

2. **"Cost vs Speed: How to Optimize Both (Not Choose Between)"**
   - Targets: "expedited shipping costs" + "maintain delivery SLAs"
   - Gap: Everyone frames as trade-off, you show the bridge

3. **"Data-Driven Carrier Selection: Beyond Volume Discounts"**
   - Targets: "multi-carrier shipping" + "carrier optimization"
   - Gap: Everyone talks access, you talk intelligence

**Website Updates**:
- Add "Zone Optimization Calculator" (high search, no results)
- Create "Service Level Cost Matrix" tool (gap in market)
- Build "Shipping Strategy Analyzer" (unique positioning)

#### Expected Results
- **Organic Traffic**: 50-100% increase within 3 months
- **Rankings**: #1-3 for gap keywords within 2 months
- **Inbound Leads**: 30% of new pipeline from organic search

---

### Workflow 4: Proposal Enhancement

**Objective**: Transform data-driven proposals into strategically positioned narratives that align with prospect discourse.

#### When to Use
- Before sending any proposal
- When customizing proposal templates
- During pricing negotiations
- For high-value opportunities

#### Tools Required
- `generate_knowledge_graph` (from discovery calls)
- `generate_content_gaps` (from prospect discourse)
- `develop_conceptual_bridges` (for positioning language)

#### Step-by-Step Process

**Step 1: Analyze Discovery Discourse**
```
Input: All discovery call notes + email exchanges

Tool: generate_knowledge_graph
Result: Map of prospect's mental model about shipping
```

**Step 2: Identify Their Cognitive Gaps**
```
Tool: generate_content_gaps

Typical gaps found:
- "Cost reduction" ↔ "Service quality" (see as trade-off)
- "Carrier relationships" ↔ "Data analytics" (not connected)
- "Current state" ↔ "Future optimization" (missing bridge)
```

**Step 3: Generate Bridge Language**
```
Tool: develop_conceptual_bridges
Parameters: {
  text: "[prospect discourse + FirstMile capabilities]",
  modelToUse: "claude-sonnet-4"
}

Generates language that bridges their gaps:
"Your team values carrier relationships (Cluster 1) and cost control
(Cluster 2), but hasn't connected them through data optimization
(missing bridge). FirstMile's analytics layer maintains relationships
while revealing optimization opportunities."
```

**Step 4: Structure Proposal Around Gaps**
```
Traditional Proposal Structure:
1. Executive Summary
2. Current State Analysis
3. Savings Projections
4. Implementation Plan
5. Pricing

Knowledge Graph-Enhanced Structure:
1. "What We Heard" (their discourse clusters)
2. "What's Not Connected Yet" (their gaps)
3. "How FirstMile Bridges the Gap" (positioning)
4. "Expected Outcomes" (gap closure = value)
5. "Investment in Strategic Partnership" (premium pricing justified)
```

**Step 5: Customize Language to Their Concepts**
```
Instead of generic: "FirstMile saves you money"

Use their exact concepts:
"Your analysis shows Zone 8 Expedited costs are 40% of spend with 12%
of volume. You're optimizing for speed but missing the cost/speed
intersection. FirstMile's three-tier system creates that connection:

- Tier 1: True Expedited (when you need it)
- Tier 2: Optimized Ground (when you think you need Expedited)
- Tier 3: Zone Consolidation (when geography matters more)

This isn't choosing between cost and speed—it's optimizing the
relationship between them."
```

#### Output & Action

**Before InfraNodus**:
> "Based on your data, FirstMile can save you $127,450 annually by
> optimizing carrier selection and reducing Expedited service usage."

**After InfraNodus**:
> "Your shipping operation has three distinct priorities: cost control,
> service reliability, and carrier relationships. Currently, these exist
> as separate strategies (Graph Cluster 1, 2, 3).
>
> The gap? No connection between cost optimization and service levels—
> forcing false trade-offs.
>
> FirstMile bridges this gap:
> [Visual knowledge graph showing their current state vs future state]
>
> Result: $127,450 in savings WITHOUT the service degradation you're
> concerned about. That's because we optimize the relationship, not
> just the cost."

#### Expected Results
- **Close Rate**: 20-30% improvement through strategic positioning
- **Deal Size**: 15% larger deals through premium pricing
- **Sales Cycle**: 25% faster with better alignment

---

### Workflow 5: Pipeline Pattern Recognition

**Objective**: Analyze patterns across deals to identify success factors, risk signals, and stage-specific best practices.

#### When to Use
- Monthly pipeline reviews
- Quarterly strategic planning
- When optimizing sales process
- Training new sales reps

#### Tools Required
- `generate_knowledge_graph` (across multiple deals)
- `generate_topical_clusters` (pattern identification)
- `overlap_between_texts` (success pattern similarity)
- `difference_between_texts` (closed-won vs closed-lost)

#### Step-by-Step Process

**Step 1: Aggregate Deal Data**
```
From HubSpot (use hubspot MCP):
- All [02] Discovery call notes
- All [04] Proposal sent notes
- All [06] Closed-won notes
- All [07] Closed-lost notes
```

**Step 2: Analyze Closed-Won Patterns**
```
Command: "Generate knowledge graph across all closed-won deals"

Tool: generate_knowledge_graph
Input: Combined text from all won deals

Result shows common themes:
- Cluster 1: "Zone optimization" (appears in 85% of wins)
- Cluster 2: "Data analytics mention" (72% of wins)
- Cluster 3: "Strategic partnership language" (68% of wins)
```

**Step 3: Analyze Closed-Lost Patterns**
```
Command: "Generate knowledge graph across all closed-lost deals"

Tool: generate_knowledge_graph
Input: Combined text from all lost deals

Result shows common themes:
- Cluster 1: "Price comparison" (appears in 78% of losses)
- Cluster 2: "Commodity language" (71% of losses)
- Cluster 3: "Quick decision timeline" (65% of losses)
```

**Step 4: Find Success Differentiators**
```
Command: "What's in closed-won discourse that's NOT in closed-lost?"

Tool: difference_between_texts
Parameters: {
  contexts: [
    { text: "[all closed-won notes]" },
    { text: "[all closed-lost notes]" }
  ]
}

Success Differentiators:
- "Strategic partnership" language (won) vs "vendor" (lost)
- "Data-driven optimization" (won) vs "cost savings" (lost)
- "Long-term value" (won) vs "quick ROI" (lost)
- Zone/analytics discussion (won) vs generic shipping (lost)
```

**Step 5: Create Stage-Specific Playbooks**
```
For each pipeline stage, analyze:

[02] Discovery Stage:
Tool: generate_research_questions
From successful discovery calls

Best practices discovered:
- Ask about zone distribution early (appears in 90% of wins)
- Discuss data analytics before pricing (80% of wins)
- Use "optimization" not "savings" language (75% of wins)

[04] Proposal Stage:
Tool: generate_topical_clusters
From successful proposals

Winning proposal patterns:
- Lead with strategic positioning (not savings)
- Include visual knowledge graphs
- Frame as partnership investment (not cost)
```

#### Output & Action

**Success Pattern Playbook**:

```markdown
# FirstMile Sales Playbook (Data-Driven)

## Discovery Stage Best Practices
Based on 50+ closed-won deals:

### Must-Ask Questions (from graph analysis):
1. "Walk me through your zone distribution" (92% win correlation)
2. "How do you currently decide between Expedited and Ground?" (87%)
3. "What role does data play in your shipping decisions?" (83%)

### Red Flags (from closed-lost analysis):
- Prospect focuses only on "cheapest price" (-40% win rate)
- No interest in data/analytics discussion (-35% win rate)
- Wants decision "within 2 weeks" (-50% win rate)

## Proposal Stage Patterns

### Winning Proposal Structure:
1. Strategic positioning (not savings) - 78% of wins lead with this
2. Knowledge graph visualization - 65% of wins include
3. Partnership language - 88% of wins use this framing

### Pricing Discussion:
- Frame as "investment in optimization" (72% success)
- NOT "cost of service" (45% success)
```

**Training Materials**:
- Create "Pattern Library" from graph analysis
- Build "Risk Signal Dashboard" from lost deal clusters
- Develop "Language Templates" from winning discourse

#### Expected Results
- **New Rep Ramp Time**: 50% faster with data-driven playbook
- **Win Rate**: 15-20% improvement from pattern replication
- **Deal Quality**: Better qualification from risk signal detection

---

## Integration with Existing Skills

### Enhanced fm-shipping-data-analysis Skill

**Add to existing workflow**:

```markdown
## Phase 4: Discourse Analysis (NEW)
After generating savings report, use InfraNodus to:

1. Generate knowledge graph of customer's original requirements
   Tool: generate_knowledge_graph
   Input: Discovery call transcript

2. Find gaps between what they asked for vs what analysis shows
   Tool: generate_content_gaps

3. Create bridging language for proposal
   Tool: develop_conceptual_bridges

This ensures proposals speak to their mental model, not just data.
```

### Enhanced dig-framework-data-analysis Skill

**Add to Introspection phase**:

```markdown
## Introspection Phase Enhancement
Use InfraNodus to reveal hidden patterns in data:

1. Generate knowledge graph from Description phase
   Tool: generate_knowledge_graph

2. Identify topical clusters in the discourse
   Tool: generate_topical_clusters

3. Find blind spots in current thinking
   Tool: generate_content_gaps

4. Feed gaps into Goal-setting phase for strategic priorities
```

---

## Best Practices

### 1. Graph Naming Conventions

Use consistent naming for cross-platform access:

```
Format: [type]-[company/topic]-[date]

Examples:
- discovery-acme-corp-2025-01-15
- competitor-analysis-q1-2025
- seo-research-shipping-optimization-2025-01
- pipeline-patterns-december-2024
```

### 2. When to Save vs Analyze Only

**Save to InfraNodus Cloud** (for reuse):
- Discovery call analyses (reference in proposals)
- Competitive intelligence (quarterly updates)
- Pipeline patterns (training materials)
- SEO research (content planning)

**Analyze Only** (`doNotSave=true`):
- Quick content gap checks
- One-off analyses
- Testing/experimentation
- Rate limit conservation

### 3. Prompt Optimization

**Generic Prompt**:
"Analyze this text"

**Optimized Prompt**:
"Use InfraNodus to generate a knowledge graph from this discovery call,
then identify content gaps between their stated priorities and current
implementation. Focus on finding strategic positioning opportunities."

### 4. Multi-Stage Analysis

For complex analyses, chain tools:

```
1. generate_knowledge_graph → understand structure
2. generate_topical_clusters → identify themes
3. generate_content_gaps → find opportunities
4. generate_research_questions → create next steps
```

### 5. Cross-Platform Workflow

**Desktop**: Deep analysis, graph creation
**Mobile**: Quick searches, graph retrieval
**VS Code**: Batch processing, automation
**Web**: Visualization, sharing

---

## Success Metrics

### Quantitative Metrics

**Discovery Quality**:
- Before: 8-10 questions per call
- After: 15-20 strategic questions per call
- Impact: 40% more insights

**Conversion Rate**:
- Before: 25% discovery → proposal
- After: 35-40% discovery → proposal
- Impact: 40-60% improvement

**Win Rate**:
- Before: 30% proposal → closed-won
- After: 40-45% proposal → closed-won
- Impact: 33-50% improvement

**Deal Size**:
- Before: Average $85K ARR
- After: Average $98K ARR
- Impact: 15% larger deals through premium positioning

**Sales Cycle**:
- Before: 45-60 days average
- After: 35-45 days average
- Impact: 25% faster closes

### Qualitative Metrics

**Positioning**:
- Before: "Shipping cost savings provider" (commodity)
- After: "Strategic optimization partner" (premium)

**Competitive Differentiation**:
- Before: "We have more carriers than competitors"
- After: "We connect cost, speed, and reliability—competitors can't"

**Prospect Feedback**:
- Before: "Tell me your rates"
- After: "Help us understand our optimization opportunities"

---

## Next Steps

1. ✅ Complete installation ([INSTALLATION.md](./INSTALLATION.md))
2. 🎯 Run first workflow (choose one above)
3. 📊 Measure results (use metrics above)
4. 🔄 Iterate and optimize
5. 📚 Build knowledge graph library
6. 🚀 Scale across team

---

## Workflow Templates

Pre-built workflow templates available in `/workflows` directory:
- `discovery-call-analysis.md`
- `competitive-intelligence.md`
- `seo-content-strategy.md`
- `proposal-enhancement.md`
- `pipeline-pattern-recognition.md`

Each includes:
- Step-by-step instructions
- Example prompts
- Expected outputs
- Success criteria
