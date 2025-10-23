# InfraNodus MCP Server - API Reference

## Complete Guide to All 21 Tools

This document provides detailed reference for every tool available in the InfraNodus MCP server.

---

## Table of Contents

### Core Graph Operations
1. [generate_knowledge_graph](#1-generate_knowledge_graph)
2. [create_knowledge_graph](#2-create_knowledge_graph)
3. [analyze_existing_graph_by_name](#3-analyze_existing_graph_by_name)

### Content Analysis
4. [generate_content_gaps](#4-generate_content_gaps)
5. [generate_topical_clusters](#5-generate_topical_clusters)
6. [generate_text_overview](#6-generate_text_overview)

### AI-Powered Insights
7. [generate_research_questions](#7-generate_research_questions)
8. [generate_research_ideas](#8-generate_research_ideas)
9. [research_questions_from_graph](#9-research_questions_from_graph)
10. [generate_responses_from_graph](#10-generate_responses_from_graph)
11. [develop_conceptual_bridges](#11-develop_conceptual_bridges)
12. [develop_latent_topics](#12-develop_latent_topics)
13. [develop_text_tool](#13-develop_text_tool)

### Comparative Analysis
14. [overlap_between_texts](#14-overlap_between_texts)
15. [difference_between_texts](#15-difference_between_texts)

### SEO & Search Analysis
16. [analyze_google_search_results](#16-analyze_google_search_results)
17. [analyze_related_search_queries](#17-analyze_related_search_queries)
18. [search_queries_vs_search_results](#18-search_queries_vs_search_results)
19. [generate_seo_report](#19-generate_seo_report)

### Graph Search
20. [search](#20-search)
21. [fetch](#21-fetch)

---

## Core Graph Operations

### 1. generate_knowledge_graph

**Purpose**: Convert text into a knowledge graph with topics, concepts, relationships, and structural gaps.

**When to Use**:
- Initial analysis of any text
- Discovery call transcripts
- Competitive content analysis
- Document structure analysis

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | string | ✅ Yes | - | Text to analyze (use newlines to separate statements/paragraphs, not sentences) |
| `includeStatements` | boolean | No | `false` | Include processed statements in response |
| `includeGraph` | boolean | No | `false` | Include full graph structure |
| `addNodesAndEdges` | boolean | No | `false` | Include nodes and edges (not recommended for long texts) |
| `modifyAnalyzedText` | enum | No | `"none"` | Entity detection: `"none"`, `"detectEntities"`, `"extractEntitiesOnly"` |

**Returns**:

```json
{
  "statistics": {
    "modularity": 0.45,
    "nodeCount": 42,
    "edgeCount": 87,
    "clusterCount": 5
  },
  "graphSummary": "AI-generated summary of the text structure",
  "contentGaps": [
    "Gap 1: Connection between 'cost control' and 'service levels'",
    "Gap 2: Missing bridge between 'carrier relationships' and 'data analytics'"
  ],
  "mainTopicalClusters": [
    "1. Cost Optimization (expedited costs, zone 8, margins)",
    "2. Service Levels (SLA, delivery speed, reliability)",
    "3. Carrier Management (partnerships, negotiations, relationships)"
  ],
  "mainConcepts": [
    "shipping costs",
    "delivery speed",
    "zone optimization",
    "carrier selection"
  ],
  "conceptualGateways": [
    "data analytics",
    "optimization",
    "strategy"
  ],
  "topRelations": [
    "shipping → costs",
    "delivery → speed",
    "zone → optimization"
  ],
  "topBigrams": [
    "shipping costs",
    "zone optimization",
    "carrier selection"
  ]
}
```

**Example Usage**:

```
Command: "Use InfraNodus to generate a knowledge graph from this discovery call transcript"

Input text:
"We ship 500-750 packages daily, mostly to Zone 8. Expedited costs are killing
our margins but customers expect 2-day delivery. We've tried negotiating with
carriers but our volume isn't high enough for better rates."

Output shows:
- 3 main clusters (cost, speed, carrier relationships)
- Gap: No connection between "cost" and "speed optimization"
- Gateway concept: "data analytics" (missing from discourse)
```

**Best Practices**:
- Separate statements with newlines (not sentences)
- Use `includeGraph: false` for most analyses (saves tokens)
- Only use `includeStatements: true` when you need original text
- For entity extraction (names, places, orgs), use `modifyAnalyzedText: "extractEntitiesOnly"`

---

### 2. create_knowledge_graph

**Purpose**: Create and save a knowledge graph to your InfraNodus account with a specific name.

**When to Use**:
- Saving important analyses for future reference
- Building a library of graphs across platforms
- Creating reusable knowledge bases
- Persistent memory for AI assistants

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `graphName` | string | ✅ Yes | - | Name of the graph (use consistent naming convention) |
| `text` | string | ✅ Yes | - | Text to analyze and save |
| `includeStatements` | boolean | No | `false` | Include processed statements |
| `includeGraph` | boolean | No | `false` | Include full graph structure |
| `addNodesAndEdges` | boolean | No | `false` | Include nodes and edges |
| `modifyAnalyzedText` | enum | No | `"none"` | Entity detection mode |

**Returns**:

Same as `generate_knowledge_graph` PLUS:

```json
{
  "userName": "brett",
  "graphName": "discovery-acme-corp-2025-01-15",
  "graphUrl": "https://infranodus.com/brett/discovery-acme-corp-2025-01-15",
  "isPublic": false
}
```

**Example Usage**:

```
Command: "Create a knowledge graph called 'discovery-acme-corp-2025-01-15' from this transcript"

Result:
- Graph saved to InfraNodus cloud
- Accessible from any platform (Desktop, Mobile, VS Code, Web)
- URL provided for visualization
- Searchable via the 'search' tool
```

**Naming Conventions**:

```
Recommended format: [type]-[company/topic]-[date]

Examples:
- discovery-acme-corp-2025-01-15
- competitor-fedex-analysis-2025-01
- seo-shipping-optimization-q1-2025
- pipeline-patterns-december-2024
- proposal-walmart-final-2025-01-20
```

**Best Practices**:
- Use consistent naming for easy retrieval
- Include dates for temporal tracking
- Use descriptive prefixes (discovery, competitor, seo, pipeline)
- Keep names URL-friendly (lowercase, hyphens, no spaces)

---

### 3. analyze_existing_graph_by_name

**Purpose**: Retrieve and analyze a previously saved graph from your InfraNodus account.

**When to Use**:
- Accessing saved discovery calls for proposals
- Reviewing competitive analyses
- Building on previous research
- Cross-platform graph access

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `graphName` | string | ✅ Yes | - | Exact name of the saved graph |
| `includeStatements` | boolean | No | `true` | Include original statements |
| `includeGraph` | boolean | No | `false` | Include full graph structure |
| `addNodesAndEdges` | boolean | No | `false` | Include nodes and edges |
| `includeGraphSummary` | boolean | No | `false` | Include AI summary (for RAG augmentation) |
| `modifyAnalyzedText` | enum | No | `"none"` | Re-analyze with entity detection |

**Example Usage**:

```
Command: "Retrieve the graph 'discovery-acme-corp-2025-01-15' and show me the content gaps"

Use case: You're writing a proposal and need to reference what was discussed
in the discovery call, specifically what gaps you identified.

Result:
- Full graph analysis returned
- Content gaps highlighted
- Ready to incorporate into proposal
```

**Best Practices**:
- Use exact graph names (case-sensitive)
- Set `includeGraphSummary: true` for RAG/prompt augmentation
- Set `includeStatements: true` when you need original text
- Combine with other tools for deeper analysis

---

## Content Analysis

### 4. generate_content_gaps

**Purpose**: Identify missing connections and underexplored topics in text.

**When to Use**:
- Finding positioning opportunities
- Content strategy planning
- Identifying what prospects didn't mention
- Discovering blind spots in discourse

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | string | ✅ Yes | - | Text to analyze for gaps |

**Returns**:

```json
{
  "contentGaps": [
    "Gap: 'cost reduction' and 'service quality' are discussed separately but not connected",
    "Gap: 'carrier relationships' mentioned but 'data-driven selection' not discussed",
    "Gap: 'shipping volume' and 'zone optimization' could be connected but aren't"
  ]
}
```

**Example Usage**:

```
Command: "What content gaps exist in this discovery call?"

Input: Discovery call transcript discussing costs and speed

Output reveals:
- They talk about cost AND speed but never the relationship
- Carrier selection mentioned but no data/analytics discussion
- Zone distribution discussed but not optimization strategies

Action: Use gaps to create strategic follow-up questions
```

**FirstMile Use Case**:

```markdown
**Discovery Call Gap Analysis:**

Prospect mentioned:
- High Zone 8 costs ✓
- Need for 2-day delivery ✓
- Carrier relationships ✓

Gaps (not mentioned/connected):
- Zone optimization strategies
- Data-driven carrier selection
- Cost/speed relationship optimization

**Follow-up Strategy:**
"In our call, you mentioned Zone 8 costs and 2-day SLAs. I'm curious—
have you analyzed the relationship between these two? There's often
a 15-20% optimization opportunity in that connection that most
companies miss."
```

---

### 5. generate_topical_clusters

**Purpose**: Extract main topics and clusters of related concepts from text.

**When to Use**:
- Understanding discussion themes
- Organizing content by topic
- Identifying focus areas
- Structuring proposals

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | string | ✅ Yes | - | Text to analyze for topics |

**Returns**:

```json
{
  "topicalClusters": [
    "1. Cost Optimization (expedited shipping, zone 8, margins, cost reduction, budget)",
    "2. Service Levels (2-day delivery, SLA, delivery speed, customer expectations)",
    "3. Carrier Relationships (carrier negotiations, partnerships, volume discounts)",
    "4. Operations (package volume, daily shipping, logistics, fulfillment)",
    "5. Strategy (optimization, efficiency, improvement, long-term planning)"
  ]
}
```

**Example Usage**:

```
Command: "Generate topical clusters from this competitive analysis"

Input: Competitor website content

Output shows:
- 5 main topics they focus on
- Keywords associated with each topic
- AI-generated names for each cluster

Action: Find topics they DON'T cover (your positioning opportunity)
```

**FirstMile Use Case**:

```markdown
**Competitor Cluster Analysis:**

Competitor A focuses on:
1. Multi-carrier access (30% of content)
2. Volume discounts (25% of content)
3. Carrier partnerships (20% of content)
4. Cost savings (15% of content)
5. Service coverage (10% of content)

FirstMile differentiation clusters:
1. Data-driven optimization (missing from competitors)
2. Zone-based strategies (underrepresented)
3. Intelligence + access (unique combination)

Positioning: "While others offer access, we provide intelligent optimization"
```

---

### 6. generate_text_overview

**Purpose**: Generate a high-level topical summary for RAG prompt augmentation.

**When to Use**:
- Quick text summaries
- Augmenting LLM prompts with context
- Overview before deep analysis
- Executive summaries

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | string | ✅ Yes | - | Text to summarize |

**Returns**:

```json
{
  "textOverview": "The text discusses shipping cost optimization strategies,
  focusing on Zone 8 delivery challenges, carrier relationship management,
  and the balance between cost reduction and service level maintenance.
  Key themes include expedited shipping costs, volume-based negotiations,
  and data-driven decision making."
}
```

**Example Usage**:

```
Command: "Generate an overview of this discovery call for my proposal context"

Use case: Need a quick summary to include in proposal introduction
```

---

## AI-Powered Insights

### 7. generate_research_questions

**Purpose**: Generate strategic questions based on content gaps in text.

**When to Use**:
- Follow-up questions after discovery calls
- Research agenda creation
- Strategic planning
- Proposal questioning

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | string | ✅ Yes | - | Text to generate questions from |
| `useSeveralGaps` | boolean | No | `false` | Generate questions for multiple gaps |
| `gapDepth` | number | No | `0` | Depth of gap analysis (0-2) |
| `modelToUse` | enum | No | `"gpt-4o"` | AI model: `"claude-opus-4.1"`, `"claude-sonnet-4"`, `"gemini-2.5-flash"`, `"gpt-4o"`, `"gpt-4o-mini"`, `"gpt-5"`, `"gpt-5-mini"` |

**Returns**:

```json
{
  "questions": [
    "How might you optimize Zone 8 shipping costs without compromising 2-day delivery SLAs?",
    "What if there was a data-driven approach to connect cost reduction with service level maintenance?",
    "Have you analyzed which expedited shipments could be converted to optimized ground service?",
    "How do your current carrier relationships inform (or limit) your optimization strategies?"
  ]
}
```

**Example Usage**:

```
Command: "Generate research questions from this discovery call transcript"

Input: Call discussing costs, speed, and carrier relationships

Output: 4-6 strategic questions that bridge the gaps in their thinking

Action: Use in follow-up email to position FirstMile strategically
```

**FirstMile Follow-up Email Template**:

```markdown
Subject: Strategic Questions from Our Discovery Call

[Name],

Thank you for the conversation about [Company]'s shipping operations.
Analyzing our discussion, I noticed you're balancing three priorities:
cost control, delivery speed, and carrier relationships.

Three questions emerged that might change how you think about optimization:

1. [Strategic question from tool]
2. [Strategic question from tool]
3. [Strategic question from tool]

Most providers force you to choose between these priorities. FirstMile's
approach is different—we connect them. That's why clients typically see
30-40% savings without degrading SLAs.

Interested in exploring how?

Best,
Brett
```

---

### 8. generate_research_ideas

**Purpose**: Generate innovative ideas based on content gaps (action-oriented vs questions).

**When to Use**:
- Content development
- Strategic initiatives
- Innovation workshops
- Product development

**Parameters**:

Same as `generate_research_questions`

**Returns**:

```json
{
  "ideas": [
    "Develop a Zone 8 cost optimization model that maintains 2-day SLAs through intelligent routing",
    "Create a data analytics layer that connects carrier performance with service level requirements",
    "Build a three-tier shipping system: true expedited, optimized ground, zone consolidation",
    "Implement predictive modeling to identify expedited shipments that can be converted to ground"
  ]
}
```

**Difference from Research Questions**:
- **Questions**: "How might we...?" (exploratory)
- **Ideas**: "Develop a..." (actionable)

---

### 9. research_questions_from_graph

**Purpose**: Generate research questions from a saved graph (not new text).

**When to Use**:
- Revisiting saved analyses
- Building on previous research
- Proposal development from discovery graphs

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `graphName` | string | ✅ Yes | - | Name of saved graph |
| `useSeveralGaps` | boolean | No | `false` | Multiple gap analysis |
| `gapDepth` | number | No | `0` | Gap depth (0-2) |
| `modelToUse` | enum | No | `"gpt-4o"` | AI model selection |

**Example Usage**:

```
Command: "Generate research questions from the 'discovery-acme-corp-2025-01-15' graph"

Use case: Two weeks after discovery call, preparing for proposal meeting,
need to recall strategic questions from original analysis
```

---

### 10. generate_responses_from_graph

**Purpose**: Generate custom responses to any prompt based on a saved graph.

**When to Use**:
- Custom analysis of saved graphs
- Proposal generation
- Report creation
- Strategic planning

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `graphName` | string | ✅ Yes | - | Name of saved graph |
| `prompt` | string | ✅ Yes | - | Custom prompt for analysis |
| `modelToUse` | enum | No | `"gpt-4o"` | AI model selection |

**Example Usage**:

```
Command: "Use the 'discovery-acme-corp-2025-01-15' graph to generate a
proposal executive summary that addresses their main pain points"

Custom prompt: "Based on this discovery call, write an executive summary
that bridges their stated goals (cost reduction) with their unstated needs
(service level maintenance). Frame FirstMile as the strategic solution."

Result: AI-generated executive summary using graph context
```

---

### 11. develop_conceptual_bridges

**Purpose**: Discover hidden themes that link your text to broader discourse.

**When to Use**:
- Finding positioning language
- Connecting tactical to strategic
- Thought leadership development
- Market positioning

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | string | ✅ Yes | - | Text to analyze |
| `modelToUse` | enum | No | `"gpt-4o"` | AI model selection |

**Returns**:

```json
{
  "ideas": [
    "Bridge concept: 'Strategic Partnership' - Connects tactical shipping decisions to long-term business strategy",
    "Bridge concept: 'Data Intelligence' - Links carrier access to optimization outcomes",
    "Bridge concept: 'Integrated Optimization' - Connects cost, speed, and reliability into unified system"
  ],
  "latentConceptsToDevelop": [
    "strategic partnership",
    "data intelligence",
    "integrated optimization"
  ],
  "latentConceptsRelations": [
    "tactical decisions → strategic partnership → business outcomes",
    "carrier access → data intelligence → optimization",
    "cost + speed + reliability → integrated optimization → competitive advantage"
  ]
}
```

**FirstMile Use Case**:

```markdown
**Positioning Language Development:**

Current (tactical): "We provide access to multiple carriers for cost savings"

Bridge concepts discovered:
- Strategic Partnership (tactical → strategic)
- Data Intelligence (access → optimization)
- Integrated System (separate goals → unified solution)

New (strategic): "FirstMile partners with you strategically, using data
intelligence to integrate cost, speed, and reliability into a unified
optimization system. That's the difference between carrier access and
competitive advantage."
```

---

### 12. develop_latent_topics

**Purpose**: Extract underdeveloped topics that need more attention.

**When to Use**:
- Content expansion planning
- Identifying overlooked areas
- Discovery call follow-up
- Proposal enhancement

**Parameters**:

Same as `develop_conceptual_bridges`

**Returns**:

```json
{
  "ideas": [
    "Develop the relationship between carrier selection and zone-based optimization",
    "Elaborate on how data analytics informs service level decisions",
    "Expand the discussion of long-term strategic value vs short-term cost savings"
  ],
  "mainTopics": [
    "Cost Control",
    "Service Levels",
    "Carrier Management"
  ],
  "latentTopicsToDevelop": [
    "Zone Optimization Strategies",
    "Data-Driven Decision Making",
    "Strategic vs Tactical Value"
  ]
}
```

**Example Usage**:

```
Command: "What topics are underdeveloped in this discovery call?"

Input: Call discussing costs and carriers

Output shows:
- Main topics: cost, carriers (well developed)
- Latent topics: zone optimization, data analytics (mentioned but not developed)

Action: Follow-up call focused on latent topics = deeper engagement
```

---

### 13. develop_text_tool

**Purpose**: Comprehensive multi-stage analysis combining gaps, latent topics, and bridges.

**When to Use**:
- Complete discovery call analysis
- Major document analysis
- Strategic planning sessions
- Comprehensive competitive analysis

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | string | ✅ Yes | - | Text to analyze |
| `useSeveralGaps` | boolean | No | `false` | Multiple gap analysis |
| `gapDepth` | number | No | `0` | Gap depth (0-2) |
| `extendedIdeationMode` | boolean | No | `false` | Generate ideas instead of questions |
| `modelToUse` | enum | No | `"gpt-4o"` | AI model selection |

**Progress Tracking**:
```
10% - Generating research questions...
40% - Identified X research questions
40% - Analyzing latent topics...
60% - Identified X latent topics
70% - Identifying conceptual bridges...
90% - Identified X conceptual bridges
100% - Analysis complete!
```

**Returns**:

```json
{
  "contentGapIdeas": ["Question/idea 1", "Question/idea 2"],
  "latentTopicsIdeas": ["Topic development 1", "Topic development 2"],
  "conceptualBridgesIdeas": ["Bridge concept 1", "Bridge concept 2"],
  "contentGaps": ["Gap description 1", "Gap description 2"],
  "conceptualBridges": ["Bridge concept", "Bridge concept"],
  "latentTopics": ["Underdeveloped topic 1", "Underdeveloped topic 2"],
  "mainTopics": ["Main topic 1", "Main topic 2"]
}
```

**Example Usage**:

```
Command: "Use develop_text_tool to completely analyze this discovery call"

Result: Comprehensive analysis in one shot
- All content gaps
- All latent topics
- All conceptual bridges
- Strategic questions
- Development ideas

Use case: Complete discovery call intelligence in single operation
```

---

## Comparative Analysis

### 14. overlap_between_texts

**Purpose**: Find common themes and similarities across multiple texts.

**When to Use**:
- Competitive commonalities
- Pattern recognition across deals
- Theme consistency checking
- Industry standards identification

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `contexts` | array | ✅ Yes | - | Array of text objects (minimum 2) |
| `contexts[].text` | string | ✅ Yes | - | Text content |
| `contexts[].modifyAnalyzedText` | enum | No | `"none"` | Entity detection mode |
| `includeStatements` | boolean | No | `false` | Include statements |
| `includeGraph` | boolean | No | `false` | Include graph structure |
| `addNodesAndEdges` | boolean | No | `false` | Include nodes/edges |

**Example Usage**:

```
Command: "Find overlapping themes across these 3 competitor websites"

contexts: [
  { text: "[Competitor A content]" },
  { text: "[Competitor B content]" },
  { text: "[Competitor C content]" }
]

Output shows common themes:
- "Multi-carrier access" (all 3 competitors)
- "Volume discounts" (all 3 competitors)
- "Cost savings" (all 3 competitors)

Insight: This is the COMMODITY space (avoid competing here)
```

**FirstMile Use Case**:

```markdown
**Competitive Overlap Analysis:**

Common themes across all competitors:
1. Multi-carrier access
2. Volume-based discounts
3. Cost reduction messaging
4. Carrier partnerships

Strategic insight: Everyone is competing in the same space
FirstMile opportunity: Position in the gaps, not the overlaps
```

---

### 15. difference_between_texts

**Purpose**: Identify what's present in reference texts but NOT in target text.

**When to Use**:
- Competitive differentiation
- Content gap analysis
- Success pattern identification
- Proposal enhancement

**Parameters**:

Same structure as `overlap_between_texts`, but:
- **First context** = target text (what to analyze)
- **Remaining contexts** = reference texts (what to compare against)

**Example Usage**:

```
Command: "What's in Google search results that's NOT in my website content?"

contexts: [
  { text: "[Your website content]" },        // Target
  { text: "[Top search result 1]" },         // Reference
  { text: "[Top search result 2]" },         // Reference
  { text: "[Top search result 3]" }          // Reference
]

Output shows what you're missing:
- "Zone-based optimization" (in results, not in your site)
- "Predictive modeling" (in results, not in your site)
- "Data analytics" (in results, not in your site)

Action: Add these topics to your content
```

**FirstMile Use Case - Closed-Won vs Closed-Lost**:

```markdown
**Win/Loss Pattern Analysis:**

contexts: [
  { text: "[All closed-lost deals combined]" },
  { text: "[All closed-won deals combined]" }
]

What's in WON deals but NOT in LOST:
- "Strategic partnership" language
- "Data-driven" terminology
- "Long-term value" framing
- "Zone optimization" discussion

Insight: Successful deals use strategic language, not cost language
Action: Train sales team to use winning discourse patterns
```

---

## SEO & Search Analysis

### 16. analyze_google_search_results

**Purpose**: Generate knowledge graph from Google search results for queries.

**When to Use**:
- Understanding current information supply
- SEO competitive analysis
- Content strategy planning
- Market understanding

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queries` | array | ✅ Yes | - | Search queries (comma-separated) |
| `includeSearchResultsOnly` | boolean | No | `false` | Only return raw results (no graph) |
| `showGraphOnly` | boolean | No | `true` | Only graph/keywords (no raw results) |
| `showExtendedGraphInfo` | boolean | No | `false` | Extended graph information |
| `importLanguage` | enum | No | `"EN"` | Language code |
| `importCountry` | enum | No | `"US"` | Country code |

**Returns**:

```json
{
  "statistics": {
    "modularity": 0.52,
    "nodeCount": 67,
    "edgeCount": 143,
    "clusterCount": 8
  },
  "mainTopicalClusters": [
    "1. Shipping Cost Reduction (cost calculator, rate comparison, savings)",
    "2. Carrier Selection (UPS, FedEx, USPS, carrier comparison)",
    "3. Ecommerce Integration (Shopify, WooCommerce, plugins)",
    "4. International Shipping (customs, duties, zones)"
  ],
  "mainConcepts": [
    "shipping calculator",
    "rate comparison",
    "carrier selection",
    "cost reduction"
  ],
  "topBigrams": [
    "shipping calculator",
    "rate comparison",
    "carrier selection"
  ]
}
```

**Example Usage**:

```
Command: "Analyze Google search results for 'shipping optimization'"

Output shows what currently ranks:
- Generic cost calculators
- Carrier comparison tools
- Basic "how to reduce costs" articles

Insight: No one is talking about zone optimization or data intelligence
Opportunity: Create content in this gap
```

---

### 17. analyze_related_search_queries

**Purpose**: Generate graph from Google search query suggestions.

**When to Use**:
- Understanding information demand
- Keyword research
- Content ideation
- Market need identification

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queries` | array | ✅ Yes | - | Base queries |
| `includeSearchQueriesOnly` | boolean | No | `false` | Only return queries (no graph) |
| `keywordsSource` | enum | No | `"related"` | `"related"` or `"adwords"` |
| `showGraphOnly` | boolean | No | `true` | Only graph/keywords |
| `showExtendedGraphInfo` | boolean | No | `false` | Extended info |
| `importLanguage` | enum | No | `"EN"` | Language |
| `importCountry` | enum | No | `"US"` | Country |

**Returns**:

```json
{
  "mainTopicalClusters": [
    "1. Zone-Based Queries (zone 8 shipping, zone optimization, zone costs)",
    "2. Speed vs Cost (expedited vs ground, 2-day shipping costs)",
    "3. Data Analytics (shipping analytics, cost analysis, optimization software)"
  ],
  "mainConcepts": [
    "zone optimization",
    "expedited shipping",
    "cost analysis",
    "shipping data"
  ]
}
```

**Example Usage**:

```
Command: "What are people searching for related to 'shipping optimization'?"

Related queries discovered:
- "zone-based shipping optimization"
- "expedited shipping cost reduction"
- "data-driven carrier selection"
- "shipping cost vs delivery speed"

Insight: High search volume for these specific topics
Action: Create targeted content for each query
```

---

### 18. search_queries_vs_search_results

**Purpose**: Find the gap between what people search for vs what they find.

**When to Use**:
- Ultimate SEO opportunity identification
- Content strategy goldmine
- Market need discovery
- Blue ocean content creation

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queries` | array | ✅ Yes | - | Search queries |
| `showGraphOnly` | boolean | No | `true` | Only graph/keywords |
| `showExtendedGraphInfo` | boolean | No | `false` | Extended info |
| `importLanguage` | enum | No | `"EN"` | Language |
| `importCountry` | enum | No | `"US"` | Country |

**Returns**:

```json
{
  "mainTopicalClusters": [
    "1. Zone Optimization Strategies (searched but not found)",
    "2. Cost-Speed Relationship (searched but not found)",
    "3. Data-Driven Carrier Selection (searched but not found)"
  ],
  "contentGaps": [
    "People search for 'zone-based shipping optimization' but find only generic cost tips",
    "High demand for 'expedited vs ground decision framework' but no quality results",
    "Search for 'shipping data analytics' but results focus on carrier comparison"
  ]
}
```

**Example Usage**:

```
Command: "Find the gap between search queries and results for 'shipping optimization'"

THE GOLDMINE:

People search for:
- "zone optimization strategies"
- "data-driven shipping decisions"
- "cost vs speed optimization"

What they actually find:
- Generic cost reduction tips
- Carrier comparison lists
- Basic shipping calculators

THE OPPORTUNITY = Create content that fills this exact gap
```

**FirstMile Content Strategy**:

```markdown
**SEO Content Opportunities (Search Demand Gaps):**

1. Blog: "Zone-Based Shipping Optimization: The Strategy Guide"
   - Demand: High (1,200 monthly searches)
   - Supply: Low (generic content)
   - Opportunity: Rank #1 within 60 days

2. Tool: "Cost vs Speed Optimizer Calculator"
   - Demand: Very High (2,400 monthly searches)
   - Supply: None (no one offers this)
   - Opportunity: Own this category

3. Guide: "Data-Driven Carrier Selection Framework"
   - Demand: Medium (800 monthly searches)
   - Supply: Low quality (outdated content)
   - Opportunity: Thought leadership position
```

---

### 19. generate_seo_report

**Purpose**: Comprehensive SEO analysis comparing content with search results AND queries.

**When to Use**:
- Complete SEO audit
- Content strategy planning
- Competitive analysis
- Website optimization

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | string | ✅ Yes | - | Your content to analyze |
| `importLanguage` | enum | No | `"EN"` | Language |
| `importCountry` | enum | No | `"US"` | Country |

**Progress Tracking**:
```
5% - Analyzing your text...
15% - Identified X key search queries
25% - Fetching Google search results...
40% - Analyzing search queries...
55% - Comparing content with results...
70% - Comparing content with queries...
85% - Finding unmet search demand...
95% - Preparing report...
100% - Complete!
```

**Returns**:

```json
{
  "inSearchResultsNotInText": {
    "contentGaps": [
      "Search results discuss 'warehouse location optimization' - not in your text",
      "Top results cover 'dimensional weight pricing' - missing from your content"
    ],
    "mainConcepts": ["warehouse optimization", "dimensional weight"],
    "topKeywordCombinations": ["fulfillment center location", "weight-based pricing"]
  },
  "inSearchQueriesNotInText": {
    "contentGaps": [
      "People search for 'zone-based pricing' - not covered in your text",
      "High demand for 'expedited ground alternatives' - missing from content"
    ],
    "mainConcepts": ["zone pricing", "expedited alternatives"]
  },
  "inSearchQueriesNotInResults": {
    "contentGaps": [
      "People search for 'cost vs speed optimization' but don't find good results - YOUR OPPORTUNITY",
      "High search for 'data-driven carrier selection' with low quality results - YOUR OPPORTUNITY"
    ],
    "mainConcepts": ["cost speed optimization", "data carrier selection"]
  },
  "topMissingQueries": [
    "zone-based shipping strategies",
    "optimize expedited vs ground",
    "shipping data analytics tools"
  ]
}
```

**Example Usage**:

```
Command: "Generate SEO report for my website content"

Input: Your current FirstMile website copy

6-Stage Analysis:
1. Extracts your main keywords
2. Fetches Google results for those keywords
3. Fetches related search queries
4. Compares your content vs results (what you're missing)
5. Compares your content vs queries (demand gaps)
6. Finds unmet search demand (blue ocean opportunities)

Result: Complete SEO strategy roadmap
```

**Action Plan from Report**:

```markdown
**SEO Optimization Roadmap:**

**Phase 1: Add Missing Topics** (in results, not in your content)
- Warehouse optimization strategies
- Dimensional weight pricing guide
- Fulfillment center location analysis

**Phase 2: Fill Demand Gaps** (people search, you don't cover)
- Zone-based pricing calculator
- Expedited vs ground decision framework
- Shipping data analytics dashboard

**Phase 3: Own Blue Ocean** (high demand, low supply)
- Cost vs speed optimization system
- Data-driven carrier selection tool
- Three-tier intelligent routing guide

**Expected Impact:**
- Phase 1: 30% traffic increase (3 months)
- Phase 2: 50% traffic increase (6 months)
- Phase 3: Market leadership position (12 months)
```

---

## Graph Search

### 20. search

**Purpose**: Search through your existing InfraNodus graphs.

**When to Use**:
- Finding past analyses
- Cross-platform graph access
- Research retrieval
- Memory search for AI assistants

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ Yes | - | Search query |
| `contextNames` | array | No | `[]` | Specific graph names (empty = search all) |

**Returns**:

```json
{
  "results": [
    {
      "id": "brett:discovery-acme-corp-2025-01-15:shipping costs",
      "title": "discovery-acme-corp-2025-01-15",
      "url": "https://infranodus.com/brett/discovery-acme-corp-2025-01-15"
    },
    {
      "id": "brett:competitor-analysis-q4-2024:shipping costs",
      "title": "competitor-analysis-q4-2024",
      "url": "https://infranodus.com/brett/competitor-analysis-q4-2024"
    }
  ]
}
```

**Example Usage**:

```
Command: "Search my graphs for 'zone optimization'"

Returns all saved graphs containing those concepts

Use case: You're in a call and need to recall past analysis about
zone optimization - search returns all relevant graphs
```

**Cross-Platform Example**:

```
Scenario: Discovery call on Desktop, proposal writing on Mobile

Desktop: create_knowledge_graph({
  graphName: "discovery-acme-2025-01-15",
  text: "[transcript]"
})

Mobile (2 weeks later): search({ query: "acme zone optimization" })
→ Retrieves the graph
→ Use analyze_existing_graph_by_name to get full context
→ Write proposal with complete context
```

---

### 21. fetch

**Purpose**: Retrieve a specific search result by ID.

**When to Use**:
- After using `search` tool
- Deep Research mode (ChatGPT)
- Specific graph retrieval

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | ✅ Yes | - | Search result ID (format: `username:graphName:searchQuery`) |

**Returns**:

```json
{
  "id": "brett:discovery-acme-corp-2025-01-15:shipping costs",
  "title": "discovery-acme-corp-2025-01-15",
  "text": "Full text content from the graph including all statements...",
  "url": "https://infranodus.com/brett/discovery-acme-corp-2025-01-15"
}
```

**Example Usage**:

```
Step 1: search({ query: "zone optimization" })
Returns: [{ id: "brett:discovery-acme-2025-01-15:zone optimization", ... }]

Step 2: fetch({ id: "brett:discovery-acme-2025-01-15:zone optimization" })
Returns: Full text content and metadata

Use case: ChatGPT Deep Research mode for comprehensive analysis
```

---

## Tool Selection Guide

### Quick Reference

**For discovery calls:**
1. `generate_knowledge_graph` → understand structure
2. `generate_content_gaps` → find opportunities
3. `generate_research_questions` → create follow-up

**For competitive analysis:**
1. `generate_knowledge_graph` (for each competitor)
2. `overlap_between_texts` → find commodity space
3. `difference_between_texts` → find white space
4. `develop_conceptual_bridges` → create positioning

**For SEO strategy:**
1. `generate_seo_report` → complete analysis
2. OR step-by-step:
   - `analyze_google_search_results`
   - `analyze_related_search_queries`
   - `search_queries_vs_search_results`

**For proposals:**
1. `analyze_existing_graph_by_name` → retrieve discovery
2. `generate_content_gaps` → remind yourself of opportunities
3. `develop_conceptual_bridges` → create positioning language

**For pipeline analysis:**
1. `generate_knowledge_graph` (all won deals)
2. `generate_knowledge_graph` (all lost deals)
3. `difference_between_texts` → find success patterns

---

## Rate Limits & Best Practices

### API Limits
- **Free tier**: 70 calls without API key
- **Paid tier**: Based on plan (check infranodus.com/api-access)

### Optimization Tips
1. Use `includeGraph: false` (saves tokens)
2. Use `doNotSave: true` for temporary analyses
3. Batch process when possible
4. Cache results locally for reuse
5. Use `showGraphOnly: true` for SEO tools (faster)

### Error Handling
- Always check for `error` field in response
- Handle rate limits gracefully
- Retry with exponential backoff
- Log failures for debugging

---

## Next Steps

- 📖 Review [WORKFLOWS.md](./WORKFLOWS.md) for business use cases
- 🔧 Check [CROSS_PLATFORM.md](./CROSS_PLATFORM.md) for sync strategies
- 🚀 Try [QUICKSTART.md](./QUICKSTART.md) for first analysis
- ❓ See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
