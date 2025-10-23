# InfraNodus MCP Server - Quick Start Guide

## Get Up and Running in 5 Minutes

This guide gets you from zero to your first knowledge graph analysis in 5 minutes using Smithery (the easiest method).

---

## Prerequisites

- [ ] Claude Desktop OR VS Code with Claude Code installed
- [ ] 5 minutes of time
- [ ] Credit card (for InfraNodus free trial - no charge for 14 days)

---

## Step 1: Create Smithery Account (60 seconds)

1. Go to [smithery.ai](https://smithery.ai)
2. Click **Sign Up**
3. Use Google or GitHub login (instant)
4. Verify email if prompted

✅ **Checkpoint**: You're logged into Smithery

---

## Step 2: Get InfraNodus API Key (90 seconds)

1. Go to [infranodus.com](https://infranodus.com)
2. Click **Sign Up** (use Google/GitHub for speed)
3. Start **14-day free trial** (no charge)
4. Navigate to [API Access](https://infranodus.com/api-access)
5. Copy your API key (looks like: `inf_abc123...`)

✅ **Checkpoint**: You have an InfraNodus API key

**Note**: First 70 API calls are free even without trial, but getting the key now ensures no interruptions.

---

## Step 3: Configure InfraNodus on Smithery (30 seconds)

1. Visit [Smithery InfraNodus Server](https://smithery.ai/server/@infranodus/mcp-server-infranodus)
2. Click **Configure** (top right)
3. Paste your InfraNodus API key
4. Click **Save**

✅ **Checkpoint**: InfraNodus configured on Smithery

---

## Step 4: Install in Claude Desktop (90 seconds)

### For macOS:

1. On the Smithery page, click **"Install for Claude Desktop"**
2. Copy the configuration JSON that appears
3. Open Terminal and run:
   ```bash
   open ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```
4. If file is empty, paste:
   ```json
   {
     "mcpServers": {
       "infranodus": {
         "command": "npx",
         "args": [
           "-y",
           "@smithery/cli@latest",
           "run",
           "@infranodus/mcp-server-infranodus",
           "--key",
           "YOUR_SMITHERY_KEY",
           "--profile",
           "YOUR_SMITHERY_PROFILE"
         ]
       }
     }
   }
   ```
   (Smithery provides the exact config with your keys filled in)

5. If file has existing servers, add the `"infranodus": { ... }` block inside `"mcpServers"`

6. **Save file**
7. **Quit Claude Desktop completely** (Cmd+Q, not just close window)
8. **Reopen Claude Desktop**

### For Windows:

1. On the Smithery page, click **"Install for Claude Desktop"**
2. Copy the configuration JSON
3. Open File Explorer and navigate to:
   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```
4. Open in Notepad or VS Code
5. Paste/merge the configuration (same structure as macOS above)
6. Save file
7. **Completely close Claude Desktop**
8. **Reopen Claude Desktop**

✅ **Checkpoint**: Claude Desktop restarted

---

## Step 5: Verify Installation (30 seconds)

1. Open Claude Desktop
2. Start a new conversation
3. Type:
   ```
   List all available InfraNodus tools
   ```

**Expected Result**:
Claude should show you available tools including:
- `generate_knowledge_graph`
- `analyze_existing_graph_by_name`
- `generate_content_gaps`
- `search`
- ...and 17 more tools

✅ **Checkpoint**: Tools are available

**If tools don't appear**:
- Check that you completely quit and reopened Claude Desktop
- Check config file syntax (use [JSONLint](https://jsonlint.com))
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Step 6: Run Your First Analysis (60 seconds)

### Test Case: Discovery Call Analysis

Copy and paste this prompt into Claude Desktop:

```
Use InfraNodus to generate a knowledge graph from this discovery call:

"We're an ecommerce company shipping 500-750 packages daily, mostly to Zone 8.
Our Expedited shipping costs are eating into margins - we're spending $45,000/month
just on Expedited service. Customers expect 2-day delivery but we're not sure if
all shipments truly need Expedited. We've tried negotiating with our carrier but
our volume isn't high enough for better rates. We're also concerned about maintaining
our service levels if we make changes. Do you think you can help?"

Show me:
1. The main topical clusters
2. Content gaps in the conversation
3. Strategic questions I should ask in follow-up
```

### Expected Output:

Claude will use InfraNodus tools and return something like:

```json
{
  "statistics": {
    "modularity": 0.48,
    "nodeCount": 34,
    "edgeCount": 52,
    "clusterCount": 4
  },
  "mainTopicalClusters": [
    "1. Cost Control (expedited costs, margins, spending, rates)",
    "2. Service Levels (2-day delivery, customer expectations, SLAs)",
    "3. Carrier Relationships (negotiations, volume discounts, carrier selection)",
    "4. Operations (package volume, daily shipping, ecommerce)"
  ],
  "contentGaps": [
    "Gap: 'cost control' and 'service quality' are discussed separately but not connected",
    "Gap: 'carrier negotiations' mentioned but 'data-driven selection' not discussed",
    "Gap: 'volume' discussed but 'zone optimization strategies' not explored"
  ],
  "conceptualGateways": [
    "data analytics",
    "zone optimization",
    "strategic planning"
  ]
}
```

Plus strategic questions like:
```
1. "Have you analyzed which expedited shipments could actually be converted to optimized ground service without breaking SLAs?"
2. "What if there was a way to reduce costs AND maintain service levels simultaneously?"
3. "How might zone-based optimization reveal savings your current carrier can't access?"
```

✅ **Success!** You've completed your first knowledge graph analysis

---

## What Just Happened?

1. **Text Analysis**: InfraNodus analyzed the discovery call structure
2. **Topic Clustering**: Identified 4 main discussion themes
3. **Gap Detection**: Found what wasn't connected in the conversation
4. **Strategic Insight**: Generated questions that bridge those gaps

### The Strategic Difference

**Before InfraNodus**:
> "They want to save money on shipping. I'll send rates."

**After InfraNodus**:
> "They have three disconnected priorities: cost, speed, and carrier relationships.
> The gaps show they haven't considered zone optimization or data-driven decision making.
> I'll position FirstMile as bridging these gaps, not just offering cheaper rates."

---

## Next Steps

### Immediate (Next 10 Minutes)

**1. Save Your First Graph**

```
Command: "Create a knowledge graph called 'test-first-analysis-2025-01-15' from that same discovery call text"

Tool: create_knowledge_graph
```

This saves the graph to your InfraNodus cloud account, making it accessible from Mobile, VS Code, and Web.

**2. Test Cross-Platform Access**

If you have Claude on mobile:
```
Command: "Search my InfraNodus graphs for 'test-first'"

Tool: search
```

Should return the graph you just created!

### Today (Next 30 Minutes)

**3. Try a Real Discovery Call**

- Paste a real discovery call transcript (or prospect email)
- Run the same analysis
- See what strategic insights emerge
- Use the generated questions in your follow-up

**4. Explore Different Tools**

Try these:

**Competitive Analysis**:
```
"Use InfraNodus to generate a knowledge graph from [competitor website content].
What topics do they focus on? What gaps exist in their positioning?"
```

**SEO Research**:
```
"Use InfraNodus to analyze Google search results for 'shipping optimization'.
What do people find vs what are they searching for?"
```

**Pattern Recognition**:
```
"Compare these three discovery calls using InfraNodus and find common patterns:
[Call 1 text]
[Call 2 text]
[Call 3 text]"
```

### This Week

**5. Build Your Graph Library**

Start creating persistent graphs:
- `discovery-[company]-[date]` for every discovery call
- `competitor-[name]-[quarter]` for competitive intelligence
- `seo-[topic]-[month]` for content research
- `pipeline-patterns-[month]` for success analysis

**6. Develop Your Workflows**

Read these docs:
- [WORKFLOWS.md](./WORKFLOWS.md) - FirstMile-specific use cases
- [API_REFERENCE.md](./API_REFERENCE.md) - All 21 tools documented
- [CROSS_PLATFORM.md](./CROSS_PLATFORM.md) - Sync strategies

**7. Install on Other Platforms**

- **VS Code**: [INSTALLATION.md - VS Code section](./INSTALLATION.md#vs-code-claude-code)
- **Mobile**: Automatic (uses same cloud storage)
- **Test sync**: Create graph on Desktop, retrieve on Mobile

---

## Quick Reference Card

### Most Common Commands

**1. Analyze Any Text**
```
"Use InfraNodus to generate a knowledge graph from: [text]"
```

**2. Find Content Gaps**
```
"Use InfraNodus to identify content gaps in: [text]"
```

**3. Generate Strategic Questions**
```
"Use InfraNodus to generate research questions from: [text]"
```

**4. Save for Later**
```
"Create a knowledge graph called '[name]' from: [text]"
```

**5. Retrieve Saved Graph**
```
"Analyze the InfraNodus graph called '[name]'"
```

**6. Search All Graphs**
```
"Search my InfraNodus graphs for '[query]'"
```

**7. Competitive Analysis**
```
"Use InfraNodus to find overlapping themes between:
[Text 1] and [Text 2] and [Text 3]"
```

**8. SEO Research**
```
"Use InfraNodus to generate an SEO report for: [your content]"
```

### Tool Quick Reference

| Use Case | Tool |
|----------|------|
| Analyze text | `generate_knowledge_graph` |
| Save analysis | `create_knowledge_graph` |
| Find gaps | `generate_content_gaps` |
| Get topics | `generate_topical_clusters` |
| Generate questions | `generate_research_questions` |
| Compare texts | `overlap_between_texts` |
| Find differences | `difference_between_texts` |
| SEO analysis | `generate_seo_report` |
| Search graphs | `search` |
| Retrieve graph | `analyze_existing_graph_by_name` |

---

## Common First-Time Questions

### Q: Do I need to install anything on Mobile?

**A**: No. Mobile automatically connects to your InfraNodus cloud account. Graphs created on Desktop appear on Mobile instantly.

### Q: How much does this cost?

**A**:
- **Smithery**: Free
- **InfraNodus**: 14-day free trial, then $19-48/month
- **First 70 API calls**: Free without trial

### Q: Can I use this offline?

**A**: No, InfraNodus requires internet connection (cloud-based). Consider local installation for offline access (see [INSTALLATION.md](./INSTALLATION.md)).

### Q: What if I make a mistake in the config file?

**A**: Validate JSON at [JSONLint.com](https://jsonlint.com). Common mistakes:
- Missing comma between objects
- Extra comma after last item
- Unmatched brackets `{}`

### Q: The tools aren't showing up. What do I do?

**A**:
1. Did you completely quit Claude Desktop (not just close window)?
2. Check config file syntax
3. Look at logs (see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md))
4. Try running `npx @smithery/cli@latest` in terminal to verify Smithery CLI works

### Q: Can my team share graphs?

**A**: Yes, two ways:
1. **Same account**: All use same InfraNodus API key (not recommended - no per-user tracking)
2. **Individual accounts**: Each person has their own account, can share graph URLs publicly

---

## Success Metrics

After your first week, you should see:

- ✅ 10+ graphs saved to your account
- ✅ Discovery calls analyzed before follow-up
- ✅ At least one competitive analysis completed
- ✅ Content gaps identified in your own marketing
- ✅ Strategic questions replacing generic questions
- ✅ Cross-platform access working (Desktop → Mobile)

---

## Getting Help

### Documentation
- **Full Installation**: [INSTALLATION.md](./INSTALLATION.md)
- **Business Workflows**: [WORKFLOWS.md](./WORKFLOWS.md)
- **API Reference**: [API_REFERENCE.md](./API_REFERENCE.md)
- **Cross-Platform Sync**: [CROSS_PLATFORM.md](./CROSS_PLATFORM.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Support
- **InfraNodus MCP Issues**: [GitHub Issues](https://github.com/WalkerVVV/mcp-server-infranodus/issues)
- **InfraNodus API**: support@infranodus.com
- **MCP Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)

---

## The Cognitive Shift

### Before InfraNodus:
```
Prospect: "We need to reduce shipping costs"
You: "Here are our rates"
Result: Commodity sale
```

### After InfraNodus:
```
Prospect: "We need to reduce shipping costs"
You (after analysis): "Your discourse shows three priorities: cost,
speed, and carrier relationships. The gaps reveal you haven't
connected these through zone optimization. Let me show you how
FirstMile bridges that gap..."
Result: Strategic sale at premium pricing
```

---

## You're Ready!

You've successfully:
- ✅ Installed InfraNodus MCP server
- ✅ Run your first analysis
- ✅ Understood the core concepts
- ✅ Know how to use the main tools

**Next**: Start analyzing your real discovery calls, competitive content, and SEO opportunities.

**Remember**: You're not just analyzing text anymore. You're analyzing the *structure of discourse* to find strategic opportunities others miss.

Welcome to network-aware intelligence.

---

## One More Thing: The First Week Challenge

**Goal**: Use InfraNodus every day for one week

**Day 1** (Today): Discovery call analysis
**Day 2**: Competitive content analysis (one competitor)
**Day 3**: SEO research (one target keyword)
**Day 4**: Pipeline pattern analysis (3+ closed deals)
**Day 5**: Proposal enhancement (use gaps from discovery)
**Day 6**: Content strategy (find gaps in your marketing)
**Day 7**: Review and optimize (search all graphs, find patterns)

**Reward**: By day 7, you'll see text differently than you did on day 0.

---

Ready to start?

👉 **Scroll back up and begin Step 1**

Or jump straight to business workflows: [WORKFLOWS.md](./WORKFLOWS.md)
