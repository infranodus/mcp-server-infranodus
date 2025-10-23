# Discovery Call Analysis Workflow

## Transform discovery call transcripts into strategic insights

### Objective
Reveal hidden pain points, content gaps, and positioning opportunities from discovery calls using InfraNodus knowledge graph analysis.

---

## When to Use

- ✅ After every discovery call
- ✅ Before writing follow-up emails
- ✅ When preparing proposals
- ✅ During competitive situations
- ✅ Building discovery call library

---

## Required Tools

- `generate_knowledge_graph`
- `generate_topical_clusters`
- `generate_content_gaps`
- `generate_research_questions`
- `create_knowledge_graph` (for saving)

---

## Step-by-Step Process

### Step 1: Prepare Your Transcript

**Input Format:**
```
Discovery Call with [Company Name]
Date: [YYYY-MM-DD]
Attendees: [Names and roles]

[Full transcript or detailed notes]

Key topics discussed:
- Pain point 1
- Pain point 2
- Current solution
- Goals/objectives
- Concerns/objections
```

**Best Practices:**
- Include all major discussion points
- Capture exact language used by prospect
- Note emotional language or emphasis
- Separate statements with newlines (not sentences)

### Step 2: Generate Knowledge Graph

**Prompt Template:**
```
Use InfraNodus to generate a knowledge graph from this discovery call:

[Paste full transcript]

Show me:
1. Main topical clusters
2. Content gaps
3. Conceptual gateways (missing concepts)
```

**Tool Used:** `generate_knowledge_graph`

**Parameters:**
```json
{
  "text": "[full transcript]",
  "includeStatements": false,
  "includeGraph": false,
  "addNodesAndEdges": false,
  "modifyAnalyzedText": "none"
}
```

**Expected Output:**
```json
{
  "statistics": {
    "modularity": 0.45,
    "nodeCount": 34,
    "edgeCount": 52,
    "clusterCount": 4
  },
  "mainTopicalClusters": [
    "1. Cost Control (expedited costs, margins, budget)",
    "2. Service Levels (2-day SLA, delivery speed)",
    "3. Carrier Relationships (negotiations, partnerships)",
    "4. Operations (volume, daily shipping, logistics)"
  ],
  "contentGaps": [
    "Gap: 'cost control' and 'service quality' disconnected",
    "Gap: 'carrier negotiations' without 'data analytics'",
    "Gap: 'volume' discussed but not 'optimization strategies'"
  ],
  "conceptualGateways": [
    "data analytics",
    "zone optimization",
    "strategic planning"
  ]
}
```

### Step 3: Identify Content Gaps

**Prompt Template:**
```
Use InfraNodus to identify content gaps in this discovery call:

[Same transcript]
```

**Tool Used:** `generate_content_gaps`

**What to Look For:**
- ✅ Topics mentioned but not connected
- ✅ Missing bridge concepts
- ✅ Unexplored relationships
- ✅ Strategic blind spots

**Analysis Questions:**
- What are they talking about that isn't connected?
- What concepts are missing from their mental model?
- Where are the strategic opportunities?

### Step 4: Generate Strategic Questions

**Prompt Template:**
```
Use InfraNodus to generate research questions from this discovery call:

[Same transcript]

Use these parameters:
- useSeveralGaps: true
- gapDepth: 1
- modelToUse: claude-sonnet-4
```

**Tool Used:** `generate_research_questions`

**Expected Output:**
```json
{
  "questions": [
    "How might you optimize Zone 8 costs without compromising 2-day SLAs?",
    "What if carrier relationships could be maintained while reducing costs through data-driven optimization?",
    "Have you analyzed which expedited shipments could be converted to optimized ground service?",
    "How does your current volume distribution across zones inform your carrier negotiations?"
  ]
}
```

### Step 5: Save Graph for Future Reference

**Prompt Template:**
```
Create a knowledge graph called "discovery-[company]-[YYYY-MM-DD]" from this discovery call:

[Same transcript]
```

**Tool Used:** `create_knowledge_graph`

**Naming Convention:**
```
discovery-[company-name]-[YYYY-MM-DD]

Examples:
- discovery-acme-corp-2025-01-15
- discovery-walmart-ecommerce-2025-01-18
- discovery-techcorp-logistics-2025-01-22
```

**Why Save?**
- Access from any platform (Desktop, Mobile, VS Code)
- Reference when writing proposal
- Build discovery call library
- Pattern analysis across multiple calls

---

## Output & Action

### What You Discovered

**From Topical Clusters:**
- What are their main priorities?
- How do they organize their thinking?
- What's their current mental model?

**From Content Gaps:**
- What aren't they connecting?
- Where are the strategic blind spots?
- What haven't they considered?

**From Conceptual Gateways:**
- What concepts are missing entirely?
- Where's the biggest opportunity?
- What would transform their thinking?

### How to Respond

**Follow-up Email Template:**
```
Subject: Strategic Questions from Our [Company Name] Discovery Call

[Name],

Thank you for the conversation about [Company]'s [main priority].

Analyzing our discussion, I noticed you're balancing [X priorities from clusters]:
1. [Priority 1 from cluster]
2. [Priority 2 from cluster]
3. [Priority 3 from cluster]

Three strategic questions emerged that might change how you think about [main topic]:

1. [Strategic question from InfraNodus]
   → This addresses the gap between [concept A] and [concept B]

2. [Strategic question from InfraNodus]
   → Most companies miss this connection

3. [Strategic question from InfraNodus]
   → This is where FirstMile's approach is fundamentally different

Most providers force you to choose between these priorities. FirstMile's
three-tier system connects all three—that's why clients typically see
[X%] savings without degrading [service metric].

Want to explore how?

Best,
[Your Name]
```

**Proposal Enhancement:**
```
Section: "What We Heard"

Based on our [date] discovery call, your shipping operation has [X]
distinct priorities:

[Cluster 1]: [Description]
[Cluster 2]: [Description]
[Cluster 3]: [Description]

Currently, these exist as separate strategies in your thinking.

The gap? [Missing connection from content gaps analysis]

This forces false trade-offs between [A] and [B].

FirstMile bridges this gap by [solution that connects the clusters].

Result: [Outcome] WITHOUT [feared consequence].
```

---

## Success Metrics

### Quantitative
- **Discovery Quality**: 40% more strategic questions per call
- **Conversion Rate**: 15-20% lift from discovery → proposal
- **Follow-up Engagement**: 50% higher response rate to strategic questions

### Qualitative
- **Positioning Shift**: From "vendor" to "strategic partner"
- **Conversation Depth**: From tactical to strategic
- **Differentiation**: Clear separation from commodity competitors

---

## Real Example

### Original Transcript (Summary)
```
Prospect: "We ship 500-750 packages daily. Zone 8 expedited costs are
$45K/month. We need 2-day delivery but costs are killing us. We tried
negotiating but our volume isn't high enough."
```

### InfraNodus Analysis
```
Clusters:
1. Cost Control (expedited, margins, spending)
2. Service Levels (2-day, delivery, SLAs)
3. Carrier Relations (negotiations, volume)

Gaps:
- Cost and service discussed separately (not connected)
- Negotiations focus on volume, not data/optimization
- Zone 8 mentioned but not optimization strategies
```

### Strategic Questions Generated
```
1. "Have you analyzed which expedited shipments could be converted to
   optimized ground while maintaining 2-day SLAs?"

2. "What if there was a way to reduce Zone 8 costs AND maintain service
   levels simultaneously?"

3. "How might data-driven carrier selection complement (not replace)
   your existing relationships?"
```

### Follow-up Email (Sent)
```
Subject: Strategic Questions from Our Acme Discovery Call

Sarah,

Thank you for the conversation about Acme's shipping operations.

Analyzing our discussion, I noticed you're balancing three priorities:
cost control, service levels, and carrier relationships.

Three questions emerged that might change your thinking:

1. **Have you analyzed which expedited shipments could be converted
   to optimized ground while maintaining 2-day SLAs?**

   Most companies treat this as binary (expedited or ground). Our data
   shows 30-40% of "expedited" shipments can hit 2-day on optimized ground.

2. **What if there was a way to reduce Zone 8 costs AND maintain
   service levels simultaneously?**

   The gap in our call: cost and speed were discussed separately.
   FirstMile's three-tier system optimizes the relationship between them.

3. **How might data-driven carrier selection complement your existing
   relationships?**

   You mentioned volume negotiations. What if data showed you *which*
   shipments to negotiate hardest on?

Most providers force trade-offs. FirstMile connects these priorities—
that's the 35% savings without SLA degradation.

Want to explore how this works for Acme specifically?

Best,
Brett
```

### Result
- Response within 2 hours (vs typical 2 days)
- Proposal meeting scheduled
- Prospect forwarded email to CEO
- Positioned as strategic vs tactical

---

## Advanced Techniques

### Pattern Recognition Across Calls

After 5+ discovery calls:

**Prompt:**
```
Use InfraNodus to find overlapping themes across these discovery calls:

[Call 1 transcript]
---
[Call 2 transcript]
---
[Call 3 transcript]
---
[Call 4 transcript]
---
[Call 5 transcript]
```

**Tool:** `overlap_between_texts`

**Output:** Common pain points across all prospects

**Use Case:** Build discovery playbook based on patterns

### Competitive Situation Analysis

When competing against specific vendor:

**Prompt:**
```
Use InfraNodus to find the difference between this discovery call and
[Competitor]'s typical messaging:

Discovery call:
[Transcript]

Competitor messaging:
[Competitor website/pitch deck content]
```

**Tool:** `difference_between_texts`

**Output:** Gaps in competitor's approach

**Use Case:** Position FirstMile in the gaps

---

## Common Pitfalls

### ❌ Don't Do This

**Generic Analysis:**
```
"Analyze this discovery call"
```
- Too vague
- Misses strategic insights
- No actionable output

**Incomplete Transcript:**
```
"They want to save money on shipping"
```
- Not enough data for analysis
- Misses nuance and gaps

**Not Saving Graphs:**
```
Using generate_knowledge_graph with doNotSave=true
```
- Can't reference later
- Can't build library
- Can't do pattern analysis

### ✅ Do This Instead

**Specific Analysis:**
```
"Use InfraNodus to generate a knowledge graph, identify content gaps,
and generate strategic questions from this discovery call with [Company]"
```

**Complete Transcript:**
```
Include all major topics, concerns, goals, current state, and exact
language used by prospect
```

**Save for Reference:**
```
create_knowledge_graph({
  graphName: "discovery-acme-corp-2025-01-15",
  text: "[full transcript]"
})
```

---

## Integration with CRM

### HubSpot Workflow

**Step 1:** Record discovery call (Gong, Zoom, manual notes)
**Step 2:** Transcribe (Otter.ai, Rev, manual)
**Step 3:** Analyze with InfraNodus (this workflow)
**Step 4:** Save graph with naming convention
**Step 5:** Log insights in HubSpot deal notes:

```
HubSpot Note Format:

Discovery Call Analysis - [Date]
================================

Main Topics (from InfraNodus):
- [Cluster 1]
- [Cluster 2]
- [Cluster 3]

Strategic Gaps Identified:
- [Gap 1]
- [Gap 2]

Follow-up Questions to Ask:
- [Question 1]
- [Question 2]

InfraNodus Graph: [Graph URL]

Next Steps:
- Send strategic questions via email
- Position FirstMile as bridge for gaps
- Reference in proposal
```

---

## Next Steps

1. ✅ Complete first discovery call analysis
2. 📧 Send strategic follow-up email
3. 📊 Track response and engagement
4. 🔁 Repeat for next 5 discovery calls
5. 📈 Analyze patterns across all calls
6. 📚 Build discovery playbook

---

## Templates & Resources

**Available Templates:**
- Follow-up email template (above)
- Proposal "What We Heard" section (above)
- HubSpot note template (above)

**Related Workflows:**
- [Proposal Enhancement](./proposal-enhancement.md)
- [Pipeline Pattern Recognition](./pipeline-pattern-recognition.md)
- [Competitive Intelligence](./competitive-intelligence.md)

**Documentation:**
- [API Reference - generate_knowledge_graph](../docs/API_REFERENCE.md#1-generate_knowledge_graph)
- [API Reference - generate_research_questions](../docs/API_REFERENCE.md#7-generate_research_questions)
- [Workflows](../docs/WORKFLOWS.md#workflow-1-discovery-call-intelligence)

---

## Success Story

**Before InfraNodus:**
- Generic discovery questions
- "Tell me about your shipping challenges"
- Commodity positioning
- 25% discovery → proposal conversion

**After InfraNodus:**
- Strategic, gap-based questions
- "You mentioned X and Y, but not the connection—have you explored Z?"
- Strategic partner positioning
- 40% discovery → proposal conversion
- 15% larger deal sizes

**The Difference:**
You're not just hearing what they say—you're seeing what they *didn't connect*.
