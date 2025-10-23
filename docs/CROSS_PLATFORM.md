# Cross-Platform Knowledge Graph Persistence

## Keeping Your InfraNodus Graphs Synced Across All Claude Platforms

This guide explains how to ensure your knowledge graphs persist and sync seamlessly across Desktop, Mobile, VS Code, and Web.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The Cloud-Based Sync Model](#the-cloud-based-sync-model)
3. [Platform-Specific Behaviors](#platform-specific-behaviors)
4. [Naming Conventions](#naming-conventions)
5. [Workflow Patterns](#workflow-patterns)
6. [Best Practices](#best-practices)
7. [Common Scenarios](#common-scenarios)
8. [Troubleshooting Sync Issues](#troubleshooting-sync-issues)

---

## Architecture Overview

### The Three-Layer System

```
┌─────────────────────────────────────────┐
│     Your Claude Platforms               │
│  (Desktop, Mobile, VS Code, Web)        │
└────────────┬────────────────────────────┘
             │
             │ MCP Protocol
             │
┌────────────▼────────────────────────────┐
│   InfraNodus MCP Server                 │
│  (Smithery-hosted OR Local)             │
└────────────┬────────────────────────────┘
             │
             │ API Calls
             │
┌────────────▼────────────────────────────┐
│   InfraNodus Cloud Storage              │
│  (Your Account at infranodus.com)       │
│  ├─ discovery-acme-2025-01-15           │
│  ├─ competitor-analysis-q1-2025         │
│  ├─ seo-shipping-optimization-2025      │
│  └─ pipeline-patterns-december-2024     │
└─────────────────────────────────────────┘
```

### Key Principle

**Your graphs DON'T sync between platforms directly.**
**They sync through InfraNodus cloud storage.**

This means:
- ✅ Graphs created on Desktop → accessible on Mobile
- ✅ Graphs created on Mobile → accessible on VS Code
- ✅ Graphs created on VS Code → accessible on Desktop
- ✅ All platforms access the SAME cloud storage

---

## The Cloud-Based Sync Model

### How It Works

**1. Creating Graphs**

When you use `create_knowledge_graph`:
```javascript
create_knowledge_graph({
  graphName: "discovery-acme-corp-2025-01-15",
  text: "discovery call transcript..."
})
```

What happens:
1. InfraNodus MCP server sends text to InfraNodus API
2. Graph is created and stored in YOUR InfraNodus cloud account
3. Graph is assigned a unique name
4. Graph URL is returned (e.g., `https://infranodus.com/brett/discovery-acme-corp-2025-01-15`)

**2. Retrieving Graphs**

When you use `analyze_existing_graph_by_name`:
```javascript
analyze_existing_graph_by_name({
  graphName: "discovery-acme-corp-2025-01-15"
})
```

What happens:
1. InfraNodus MCP server queries InfraNodus API
2. Graph is retrieved from YOUR cloud account
3. Full analysis is returned
4. Works from ANY platform using same API key

**3. Searching Graphs**

When you use `search`:
```javascript
search({
  query: "zone optimization",
  contextNames: []  // empty = search ALL your graphs
})
```

What happens:
1. Searches across ALL graphs in your account
2. Returns matching graphs with URLs
3. Same results on ANY platform

### The Automatic Sync

**You don't need to "sync" manually.**

- Graph created on Desktop at 9:00 AM
- Available on Mobile at 9:01 AM
- Available on VS Code at 9:02 AM
- No manual sync required

**Why?** Because all platforms access the same cloud storage.

---

## Platform-Specific Behaviors

### Claude Desktop (macOS/Windows)

**Setup**: Local MCP server OR Smithery
**Access**: Full API access (all 21 tools)
**Best For**:
- Deep analysis
- Graph creation
- Complex multi-step workflows
- Large document processing

**Persistence**:
- Graphs saved with `create_knowledge_graph` → cloud storage
- Accessible immediately from other platforms
- Configuration stored in `claude_desktop_config.json`

**Example Session**:
```
1. Discovery call → create graph "discovery-acme-2025-01-15"
2. Graph automatically available on all other platforms
3. No additional steps needed
```

---

### VS Code (Claude Code)

**Setup**: Local MCP server OR Smithery HTTP
**Access**: Full API access (all 21 tools)
**Best For**:
- Batch processing
- File-based workflows
- Code integration
- Automation scripts

**Persistence**:
- Same as Desktop
- Graphs created here → available everywhere
- Configuration in VS Code settings.json

**Example Session**:
```
1. Batch process 10 discovery calls → create 10 graphs
2. All 10 graphs available on Desktop/Mobile immediately
3. Search/retrieve from any platform
```

---

### Claude Mobile (iOS/Android)

**Setup**: No local setup required
**Access**: Full API access when InfraNodus tools available
**Best For**:
- On-the-go analysis
- Quick graph retrieval
- Discovery call follow-up
- Field work

**Persistence**:
- Accesses same cloud storage
- Can retrieve graphs created on Desktop/VS Code
- Can create new graphs that sync to other platforms

**Mobile-Specific Workflow**:
```
Scenario: In client meeting, need to recall discovery analysis

1. Open Claude Mobile
2. "Search my InfraNodus graphs for 'Acme Corp zone optimization'"
3. Tool: search({ query: "Acme Corp zone optimization" })
4. Results show graph created on Desktop last week
5. "Retrieve that graph and show me the content gaps"
6. Tool: analyze_existing_graph_by_name({ graphName: "discovery-acme-2025-01-15" })
7. Full context available in seconds
```

**Key Difference**:
- Mobile doesn't run local MCP server
- Connects to InfraNodus via Smithery OR cloud API
- Same functionality, different architecture

---

### Claude Web (claude.ai)

**Setup**: Limited MCP support (evolving)
**Access**: May work via Smithery HTTP URLs
**Best For**:
- Viewing graphs at infranodus.com
- Sharing graph URLs
- Quick visualizations

**Current Workaround**:
```
1. Create/analyze graphs on Desktop or VS Code
2. Get graph URL (e.g., https://infranodus.com/brett/graph-name)
3. Share URL in web conversations
4. View visualization directly at infranodus.com
```

**Future**: Full MCP support coming to web platform

---

## Naming Conventions

### Why Naming Matters

**Problem**: You create 50 graphs, all named generically
- "analysis-1"
- "discovery-call"
- "competitor-research"

**Result**: Can't find anything, can't sync effectively

**Solution**: Structured naming convention

### Recommended Format

```
[type]-[company/topic]-[date]

Components:
- type: discovery, competitor, seo, pipeline, proposal
- company/topic: specific identifier
- date: YYYY-MM-DD or YYYY-MM or Q#-YYYY

Examples:
✅ discovery-acme-corp-2025-01-15
✅ competitor-fedex-analysis-2025-01
✅ seo-shipping-optimization-q1-2025
✅ pipeline-patterns-december-2024
✅ proposal-walmart-final-2025-01-20

❌ analysis
❌ discovery1
❌ test-graph
❌ untitled-3
```

### Type Prefixes

Use consistent prefixes for easy filtering:

| Prefix | Use Case | Example |
|--------|----------|---------|
| `discovery-` | Discovery calls | `discovery-acme-corp-2025-01-15` |
| `competitor-` | Competitive analysis | `competitor-fedex-q1-2025` |
| `seo-` | SEO research | `seo-zone-optimization-2025-01` |
| `pipeline-` | Pipeline patterns | `pipeline-q4-2024-won-deals` |
| `proposal-` | Proposal analyses | `proposal-walmart-draft-2025-01` |
| `meeting-` | Meeting notes | `meeting-kickoff-acme-2025-01-15` |
| `research-` | General research | `research-zone-pricing-models` |

### Search Benefits

With good naming:
```
search({ query: "acme" })
→ Returns ALL Acme-related graphs across platforms

search({ query: "discovery 2025-01" })
→ Returns all January 2025 discovery calls

search({ query: "competitor q1" })
→ Returns all Q1 competitive analyses
```

---

## Workflow Patterns

### Pattern 1: Desktop → Mobile Handoff

**Scenario**: Deep analysis on Desktop, follow-up on Mobile

```
DESKTOP (Morning):
1. Receive discovery call transcript
2. create_knowledge_graph({
     graphName: "discovery-techcorp-2025-01-15",
     text: "[full transcript]"
   })
3. generate_research_questions({
     text: "[transcript]"
   })
4. Prepare follow-up email

MOBILE (Afternoon - in meeting):
1. Client asks about zone optimization
2. search({ query: "techcorp zone" })
3. analyze_existing_graph_by_name({
     graphName: "discovery-techcorp-2025-01-15"
   })
4. Reference specific content gaps in conversation
```

**Key**: Graph created on Desktop automatically available on Mobile

---

### Pattern 2: VS Code Batch → Desktop Review

**Scenario**: Batch process multiple analyses, review individually on Desktop

```
VS CODE (Batch Processing):
FOR EACH discovery call in folder:
  1. Read transcript file
  2. create_knowledge_graph({
       graphName: `discovery-${company}-${date}`,
       text: transcript
     })
  3. Store results

Result: 10 graphs created, all synced to cloud

DESKTOP (Review):
1. search({ query: "discovery 2025-01" })
2. Returns all 10 January discovery graphs
3. analyze_existing_graph_by_name() for each
4. Build pattern analysis across all
```

**Key**: Batch creation on VS Code, individual analysis on Desktop

---

### Pattern 3: Mobile Capture → Desktop Deep Dive

**Scenario**: Capture thoughts on Mobile, analyze deeply on Desktop

```
MOBILE (On the go):
1. Quick voice note transcribed
2. create_knowledge_graph({
     graphName: "idea-zone-pricing-model-2025-01-15",
     text: "[voice note text]"
   })
3. Graph saved to cloud

DESKTOP (Later):
1. search({ query: "idea 2025-01" })
2. Retrieve all ideas from January
3. overlap_between_texts({
     contexts: [all January ideas]
   })
4. Find common themes across all ideas
5. Build comprehensive strategy document
```

**Key**: Quick capture anywhere, deep analysis at desk

---

### Pattern 4: Cross-Platform Competitive Intelligence

**Scenario**: Build competitive library accessible everywhere

```
DESKTOP (Initial Setup):
1. Analyze Competitor A website
   → create_knowledge_graph({ graphName: "competitor-fedex-2025-q1" })

2. Analyze Competitor B website
   → create_knowledge_graph({ graphName: "competitor-ups-2025-q1" })

3. Analyze Competitor C website
   → create_knowledge_graph({ graphName: "competitor-usps-2025-q1" })

All saved to cloud

VS CODE (Analysis):
1. search({ query: "competitor 2025-q1" })
2. Retrieve all 3 competitor graphs
3. overlap_between_texts() → find commodity space
4. difference_between_texts() → find white space

MOBILE (In Sales Call):
1. Prospect mentions "FedEx"
2. search({ query: "competitor fedex" })
3. analyze_existing_graph_by_name({ graphName: "competitor-fedex-2025-q1" })
4. Instant competitive intelligence in meeting
```

**Key**: Build once on Desktop, access everywhere

---

## Best Practices

### 1. Single Source of Truth

**Principle**: InfraNodus cloud is your single source of truth

**Best Practice**:
- ✅ Always use `create_knowledge_graph` for important analyses (saves to cloud)
- ✅ Use consistent naming across platforms
- ✅ Trust the cloud storage (don't try to keep local copies)
- ❌ Don't use `doNotSave=true` for analyses you'll need later

### 2. Save Strategically

**When to Save** (use `create_knowledge_graph`):
- Discovery call analyses → will reference in proposals
- Competitive intelligence → ongoing tracking
- Pipeline patterns → training materials
- SEO research → content planning

**When to Analyze Only** (use `generate_knowledge_graph` with `doNotSave=true`):
- Quick experiments
- One-off analyses
- Testing prompts
- Rate limit conservation

### 3. Search-First Workflow

**Before creating a new graph, search if it exists**:

```
Instead of:
1. Start analyzing competitor
2. Oh wait, did I already do this?
3. Create duplicate graph

Better:
1. search({ query: "competitor fedex" })
2. Check if analysis exists
3. If exists: retrieve and update
4. If not: create new graph
```

### 4. Version Control with Dates

**For evolving analyses, use date versioning**:

```
competitor-fedex-2024-q4
competitor-fedex-2025-q1
competitor-fedex-2025-q2

Then:
search({ query: "competitor fedex 2025" })
→ Returns all 2025 analyses
→ Track evolution over time
```

### 5. Platform-Specific Strengths

**Use each platform for its strengths**:

**Desktop**:
- Deep analysis
- Complex workflows
- Large documents
- Multi-step operations

**VS Code**:
- Batch processing
- File operations
- Automation
- Code integration

**Mobile**:
- Quick retrieval
- Field access
- Voice capture
- Urgent lookups

**Web**:
- Visualization
- Sharing
- Collaboration
- Public graphs

---

## Common Scenarios

### Scenario 1: "I created a graph on Desktop but can't find it on Mobile"

**Diagnosis Checklist**:
1. ✅ Did you use `create_knowledge_graph` (not `generate_knowledge_graph` with `doNotSave=true`)?
2. ✅ Are you logged into the same InfraNodus account?
3. ✅ Is the graph name spelled exactly the same?
4. ✅ Did the graph creation succeed (check for errors)?

**Solution**:
```
On Mobile:
1. search({ query: "part of graph name" })
2. Should return the graph if it was saved
3. If not found → graph wasn't saved to cloud
```

### Scenario 2: "I have duplicate graphs with similar names"

**Problem**: Inconsistent naming across platforms

**Solution**: Implement naming convention

```
Instead of:
- "acme discovery" (Desktop)
- "discovery-acme" (Mobile)
- "acme-analysis" (VS Code)

Use consistent:
- "discovery-acme-corp-2025-01-15"
```

### Scenario 3: "Mobile shows different results than Desktop"

**Diagnosis**:
- Same InfraNodus account? (check API key)
- Same graph name? (case-sensitive)
- Graph recently created? (may take 1-2 seconds to sync)

**Solution**:
```
Verify synchronization:

Desktop: create_knowledge_graph({ graphName: "test-sync-2025" })
Wait 5 seconds
Mobile: search({ query: "test-sync" })

If appears → sync working
If not → check account/API key
```

### Scenario 4: "Too many graphs, can't organize them"

**Solution**: Use contextNames for filtering

```
search({
  query: "optimization",
  contextNames: ["discovery-*-2025-01-*"]
})

Or implement graph libraries:

Library 1: All Discovery Calls
- discovery-acme-2025-01-15
- discovery-techcorp-2025-01-18
- discovery-walmart-2025-01-22

Library 2: All Competitive Intelligence
- competitor-fedex-2025-q1
- competitor-ups-2025-q1

Library 3: All SEO Research
- seo-zone-optimization-2025-01
- seo-shipping-costs-2025-01
```

---

## Troubleshooting Sync Issues

### Issue 1: Graph Not Appearing on Other Platform

**Symptoms**: Created on Desktop, not visible on Mobile

**Checks**:
1. Verify graph was saved:
   ```
   On Desktop: create_knowledge_graph() → check for graphUrl in response
   If no URL → graph not saved
   ```

2. Verify same account:
   ```
   Check API key matches across platforms
   InfraNodus account username should be same
   ```

3. Verify graph name:
   ```
   Use exact name (case-sensitive)
   analyze_existing_graph_by_name({ graphName: "exact-name" })
   ```

4. Try searching instead:
   ```
   search({ query: "part of name" })
   More flexible than exact name match
   ```

### Issue 2: Old Graph Content Showing

**Symptoms**: Graph was updated but shows old data

**Cause**: InfraNodus doesn't "update" graphs, it creates new versions

**Solution**:
```
Option 1: Create new version with date
- discovery-acme-2025-01-15-v1
- discovery-acme-2025-01-15-v2

Option 2: Delete old graph (via infranodus.com) then recreate

Option 3: Use different name
- discovery-acme-initial-2025-01-15
- discovery-acme-final-2025-01-20
```

### Issue 3: Can't Access Graphs Created by Someone Else

**Explanation**: Graphs are private by default

**Solution**:
```
1. Graph owner needs to make graph public at infranodus.com
2. Share graph URL
3. Others can view (but not edit)
4. For team access: All use same InfraNodus account (not recommended for security)
   OR individual accounts with shared graphs (set to public)
```

### Issue 4: Rate Limit on One Platform Affects Others

**Explanation**: Rate limits are per API key, not per platform

**Solution**:
```
All platforms using same API key = shared rate limit

If hitting limits:
1. Upgrade InfraNodus plan
2. Use doNotSave=true for test analyses
3. Batch operations during off-hours
4. Cache results locally (read once, use many times)
```

---

## Advanced: Programmatic Sync

### For Development/Automation

If you're building automation:

```python
# Python example: Batch sync pattern

import json
from claude_mcp import InfraNodus

client = InfraNodus(api_key="your-key")

# Create multiple graphs
graphs_to_create = [
  {"name": "discovery-1", "text": "transcript 1"},
  {"name": "discovery-2", "text": "transcript 2"},
  {"name": "discovery-3", "text": "transcript 3"}
]

created_graphs = []

for graph_data in graphs_to_create:
  result = client.create_knowledge_graph(
    graphName=graph_data["name"],
    text=graph_data["text"]
  )
  created_graphs.append(result["graphUrl"])
  print(f"Created: {result['graphUrl']}")

# All graphs now available cross-platform
print(f"\nCreated {len(created_graphs)} graphs")
print("Available on Desktop, Mobile, VS Code, Web")

# Verify sync
search_results = client.search(query="discovery")
print(f"\nFound {len(search_results['results'])} graphs in search")
```

---

## Summary

### Key Principles

1. **Cloud-Centric**: Graphs sync via InfraNodus cloud, not peer-to-peer
2. **Automatic**: No manual sync required
3. **Instantaneous**: Graphs available across platforms within seconds
4. **Persistent**: Saved graphs available indefinitely
5. **Searchable**: Find graphs by name, content, or keywords

### Cross-Platform Checklist

✅ Use same InfraNodus API key across all platforms
✅ Use consistent naming conventions
✅ Create graphs with `create_knowledge_graph` (not `doNotSave`)
✅ Search graphs with `search` tool
✅ Retrieve graphs with `analyze_existing_graph_by_name`
✅ Trust the cloud storage as single source of truth

### Platform Strengths

| Platform | Best For | Sync Method |
|----------|----------|-------------|
| **Desktop** | Deep analysis | Full MCP access to cloud |
| **VS Code** | Batch processing | Full MCP access to cloud |
| **Mobile** | Quick access | Cloud API access |
| **Web** | Visualization | URL sharing (limited MCP) |

---

## Next Steps

- ✅ Install on all platforms ([INSTALLATION.md](./INSTALLATION.md))
- 🎯 Test cross-platform sync (create on Desktop, retrieve on Mobile)
- 📛 Implement naming convention
- 📚 Build your graph library
- 🔄 Develop cross-platform workflows

---

## Resources

- **InfraNodus Account**: [infranodus.com](https://infranodus.com)
- **API Documentation**: [infranodus.com/api](https://infranodus.com/api)
- **Graph Visualization**: [infranodus.com/[username]/[graphname]](https://infranodus.com)
- **Installation Guide**: [INSTALLATION.md](./INSTALLATION.md)
- **Workflow Patterns**: [WORKFLOWS.md](./WORKFLOWS.md)
