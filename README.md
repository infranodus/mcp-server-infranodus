# InfraNodus MCP Server

A Model Context Protocol (MCP) server that integrates InfraNodus knowledge graph and text network analysis capabilities into LLM workflows and AI assistants like Claude Desktop.

## Overview

InfraNodus MCP Server enables LLM workflows and AI assistants to analyze text using advanced network science algorithms, generate knowledge graphs, detect content gaps, and identify key topics and concepts. It transforms unstructured text into structured insights using graph theory and network analysis.

![InfraNodus MCP Server](https://infranodus.com/images/front/infranodus-overview.jpg)

## Features

### You Can Use It To

- Connect your existing InfraNodus knowledge graphs to your LLM workflows and AI chats
- Identify the main topical clusters in discourse without missing the important nuances (works better than standard LLM workflows)
- Identify the content gaps in any discourse (helpful for content creation and research)
- Generate new knowledge graphs from any text and use them to augment your LLM responses
- Save and retrieve entities and relations from memory using the knowledge graphs

### Available Tools

1. **generate_knowledge_graph**

   - Convert any text into a visual knowledge graph
   - Extract topics, concepts, and their relationships
   - Identify structural patterns and clusters
   - Apply AI-powered topic naming
   - Perform entity detection for cleaner graphs

2. **analyze_existing_graph_by_name**

   - Retrieve and analyze existing graphs from your InfraNodus account
   - Access previously saved analyses
   - Export graph data with full statistics

3. **generate_content_gaps**

   - Detect missing connections in discourse
   - Identify underexplored topics
   - Generate research questions
   - Suggest content development opportunities

4. **generate_topical_clusters**

   - Generate topics and clusters of keywords from text using knowledge graph analysis
   - Make sure to beyond genetic insights and detect smaller topics
   - Use the topical clusters to establish topical authority for SEO

5. **generate_contextual_hint**

   - Generate a topical overview of a text and provide insights for LLMs to generate better responses
   - Use it to get a high-level understanding of a text
   - Use it to augment prompts in your LLM workflows and AI assistants

6. **generate_research_questions**

   - Generate research questions that bridge content gaps
   - Use them as prompts in your LLM models and AI workflows
   - Use any AI model (included in InfraNodus API)
   - Content gaps are identified based on topical clustering

7. **generate_research_ideas**

   - Generate innovative research ideas based on content gaps identified in the text
   - Get actionable ideas to improve the text and develop the discourse
   - Use any AI model (included in InfraNodus API)
   - Ideas are generated from gaps between topical clusters

8. **research_questions_from_graph**

   - Generate research questions based on an existing InfraNodus graph
   - Use them as prompts in your LLM models
   - Use any AI model (included in InfraNodus API)
   - Content gaps are identified based on topical clustering

9. **generate_responses_from_graph**

   - Generate responses based on an existing InfraNodus graph
   - Integrate them into your LLM workflows and AI assistants
   - Use any AI model (included in InfraNodus API)
   - Use any prompt

10. **develop_conceptual_bridges**

    - Analyze text and develop latent ideas based on concepts that connect this text to a broader discourse
    - Discover hidden themes and patterns that link your text to wider contexts
    - Use any AI model (included in InfraNodus API)
    - Generate insights that help develop the discourse

11. **develop_latent_topics**

    - Analyze text and extract underdeveloped topics with ideas on how to develop them
    - Identify topics that need more attention and elaboration
    - Use any AI model (included in InfraNodus API)
    - Get actionable suggestions for content expansion

12. **develop_text_tool**

    - Comprehensive text analysis combining content gap ideas, latent topics, and conceptual bridges
    - Executes multiple analyses in sequence with progress tracking
    - Generates research ideas based on content gaps
    - Identifies latent topics and conceptual bridges to develop
    - Finds content gaps for deeper exploration

13. **create_knowledge_graph**

    - Create a knowledge graph in InfraNodus from text and provide a link to it
    - Use it to create a knowledge graph in InfraNodus from text

14. **overlap_between_texts**

    - Create knowledge graphs from two or more texts and find the overlap (similarities) between them
    - Use it to find similar topics and keywords across different texts

15. **difference_between_texts**

    - Compare knowledge graphs from two or more texts and find what's not present in the first graph that's present in the others
    - Use it to find how one text can be enriched with the others

16. **analyze_google_search_results**

    - Generate a graph with keywords and topics for Google search results for a certain query
    - Use it to understand the current informational supply (what people find)

17. **analyze_related_search_queries**

    - Generate a graph from the search queries suggested by Google for a certain query
    - Use it to understand the current informational demand (what people are looking for)

18. **search_queries_vs_search_results**

    - Generate a graph of keyword combinations and topics people tend to search for that do not readily appear in the search results for the same queries
    - Use it to understand what people search for but don't yet find

19. **generate_seo_report**

    - Analyze content for SEO optimization by comparing it with Google search results and search queries
    - Identify content gaps and opportunities for better search visibility
    - Get comprehensive analysis of what's in search results but not in your text
    - Discover what people search for but don't find in current results

20. **memory_add_relations**

    - Add relations to the InfraNodus memory from text
    - Automatically detect entities or use [[wikilinks]] syntax to mark them
    - Save memory to a specified graph name for future retrieval
    - Support automatic entity extraction or manual entity marking
    - Provide links to created memory graphs for easy access

21. **memory_get_relations**

    - Retrieve relations from InfraNodus memory for specific entities
    - Search for entity relations using [[wikilinks]] syntax
    - Query specific memory contexts or search across all memory graphs
    - Extract statements and relationships from stored knowledge graphs
    - Support both entity-specific searches and full context retrieval

22. **search**

    - Search through existing InfraNodus graphs
    - Also use it to search through the public graphs of a specific user
    - Compatible with ChatGPT Deep Research mode via Developer Mode > Connectors

23. **fetch**

    - Fetch a specific search result for a graph
    - Can be used in ChatGPT Deep Research mode via Developer Mode > Connectors

_More capabilites coming soon!_

### Key Capabilities

- **Topic Modeling**: Automatic clustering and categorization of concepts
- **Content Gap Detection**: Find missing links between concept clusters
- **Entity Recognition**: Clean extraction of names, places, and organizations
- **AI Enhancement**: Optional AI-powered topic naming and analysis
- **Structural Analysis**: Identify influential nodes and community structures
- **Network Structure Statistics**: Modularity, centrality, betweenness, and other graph metrics
- **Knowledge Graph Memory**: Save and retrieve knowledge graph memories and analyze them to retrieve key nodes, clusters, and connectors

## Knowledge Graph Memory Use Advice

InfraNodus represents any text as a network graph in order to identify the main clusters of ideas and gaps between them. This helps generate advanced insights based on the text's structure. The network is effectively a knowledge graph that can also be used to retrieve complex ontological relations between different entities and concepts. This process is automated in InfraNodus using the `search` and `fetch` tools along with the other tools that analyze the underlying network.

However, you can also easily use InfraNodus as a more traditional memory server to save and retrieve relations. We use [[wikilinks]] to highlight entities in your text to make your content and graphs compatible with markup syntax and PKM tools such as Obsidian. By default, InfraNodus will generate the name of the memory graph for you based on the context of the conversation. However, you can modify this default behavior by adding a **system prompt** or **project instruction** into your LLM client.

Specifically you can specify to always use a speciic knowlege graph for memories to store everything in one place:

```
Save all memories in the `my-memories` graph in InfraNodus.
```

Or you can ask InfraNodus to only save certain entities, e.g. for building social networks:

```
When generating entities, only extract people, companies, and organizations. Ignore everything else.
```

## Installation

The easiest and the fastest way to launch the InfraNodus MCP server is to use the external provider, Smithery, and simply copy and paste the settings to the tool of your choice (e.g. Claude, Cursor, or ChatGPT).

You can also install the server locally, so you have more control over it. In this case, you can also edit the source files and even create your tools based on the [InfraNodus API](https://infranodus.com/api).

Below we describe the two different ways to set up your InfraNodus MCP server.

### 1. Easiest Setup: Smithery InfraNodus MCP Server (via HTTP/SSE)

0. **Prerequisites**

- Create an account on [Smithery.Ai](https://smithery.ai/) (it's free and you can use your Google or GitHub login)
- Create an account on [InfraNodus](https://infranodus.com) if you don't have it already and get your [InfraNodus API Key](https://infranodus.com/api-access). We offer 14-day free trials.
- Then go to the [Smithery InfraNodus Server](https://smithery.ai/server/@infranodus/mcp-server-infranodus), click "Configure" at the top right, and add your InfraNodus API key there.

1. **Get the URL of the InfraNodus Server from Smithery**

- Go to [Smithery InfraNodus Server](https://smithery.ai/server/@infranodus/mcp-server-infranodus) and get the URL link from Smithery [https://server.smithery.ai/@infranodus/mcp-server-infranodus/mcp](https://server.smithery.ai/@infranodus/mcp-server-infranodus/mcp) for the server or use one of their automatic setup tools for Claude or Cursor.

2. **Add to to the Client Tool Where You Want to Use InfraNodus**

- Once you add the URL above to your tool, it will automatically prompt you to authenticate using Smithery (via Oauth) in order to be able to access the InfraNodus MCP hosted on it.

- If your client does not support Oauth, you can click the link \*Get the URL with keys instead\*\* which you can use to authenticate without Oauth.

- In the end, if you use the URL with the keys, either Smithery or you yourself will add something like this in your MCP configuration file:

#### For Cursor:

```json
// e.g. Cursor will access directly the server via Smithery
"mcpServers": {
    "mcp-server-infranodus": {
      "type": "http",
      "url": "https://server.smithery.ai/@infranodus/mcp-server-infranodus/mcp?api_key=YOUR_SMITHERY_KEY&profile=YOUR_SMITHERY_PROFILE",
      "headers": {}
    }
  }
```

### For Claude:

```json
// Claude uses a slightly different implementation
// Fot this, it launches the MCP server on your local machine
"mcpServers": {
   "mcp-server-infranodus": {
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
```

**Note**, in both cases, you'll automatically get the `YOUR_SMITHERY_KEY` and `YOUR_SMITHERY_PROFILE` values from Smithery when you copy the URL with credentials. These are not your InfraNodus API keys. You can use the InfraNodus API server without the API for the first 70 calls. Then you can add it to your Smithery profile and it will automatically connect to your account using the link above.

4. **Using InfraNodus Tools in Your Calls**

- To use InfraNodus, see the tools available and simply call them through the chat interface (e.g. "show me the graphs where I talk about this topic" or "get the content gaps from the document I uploaded")

- If your client is not using InfraNodus for some actions, add the instruction to use InfraNodus explicitly.

### 2. Manual Setup: via NPX

You can deploy the InfraNodus server manually via `npx` — a package that allows to execute local and remote Node.Js packages on your computer.

The InfraNodus MCP server is also available as an npm package at [https://www.npmjs.com/package/infranodus-mcp-server](https://www.npmjs.com/package/infranodus-mcp-server) from where you can launch it remotely on your local computer with npx. It will expose its tools to the MCP client that will be using this command to launch the server

#### For Claude Desktop:

Just add this in your Claude's configuration file (Settings > Developer > Edit Config), inside the `"mcpServers"` object where the different servers are listed:

```json
   "infranodus": {
			"command": "npx",
			"args": ["-y", "infranodus-mcp-server"],
			"env": {
				"INFRANODUS_API_KEY": "YOUR_INFRANODUS_API_KEY"
			}
   },
```

### 3. Manual Setup: Launching MCP as a Local Server (for inspection & development)

0. **Prerequisites**

- Node.js 18+ installed
- InfraNodus API key (get yours at [https://infranodus.com/api-access](https://infranodus.com/api-access))

1. **Clone and build the server:**

   ```bash
   git clone https://github.com/yourusername/mcp-server-infranodus.git
   cd mcp-server-infranodus
   npm install
   npm run build:inspect
   ```

Note that `build:inspect` will generate the `dist/index.js` file which you will then use in your server setup. The standard `npm run build` command will only build a Smithery file.

2. **Set up your API key:**

   Create a `.env` file in the project root:

   ```
   INFRANODUS_API_KEY=your-api-key-here
   ```

3. **Inspect the MCP:**

   ```bash
   npm run inspect
   ```

### Claude Desktop Configuration (macOS)

1. Open your Claude Desktop configuration file:

   ```bash
   open ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. Add the InfraNodus server configuration:

a. remote launch via `npx`:

```json
 "infranodus": {
			"command": "npx",
			"args": ["-y", "infranodus-mcp-server"],
			"env": {
				"INFRANODUS_API_KEY": "YOUR_INFRANODUS_API_KEY"
			}
   },
```

b. launch this repo with `node`:

```json
{
	"mcpServers": {
		"infranodus": {
			"command": "node",
			"args": ["/absolute/path/to/mcp-server-infranodus/dist/index.js"],
			"env": {
				"INFRANODUS_API_KEY": "your-api-key-here"
			}
		}
	}
}
```

**Note:** you can leave the `INFRANODUS_API_KEY` empty in which case you can make 70 free requests after which you will hit quota and will need to add your API key.

3. Restart Claude Desktop to load the new server.

### Claude Desktop Configuration (Windows)

1. Open your Claude Desktop configuration file:

   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```

2. Add the InfraNodus server configuration:

a. remote launch via `npx`:

```json
 "infranodus": {
			"command": "npx",
			"args": ["-y", "infranodus-mcp-server"],
			"env": {
				"INFRANODUS_API_KEY": "YOUR_INFRANODUS_API_KEY"
			}
   },
```

b. launch this repo with `node`:

```json
{
	"mcpServers": {
		"infranodus": {
			"command": "node",
			"args": ["C:\\path\\to\\mcp-server-infranodus\\dist\\index.js"],
			"env": {
				"INFRANODUS_API_KEY": "your-api-key-here"
			}
		}
	}
}
```

3. Restart Claude Desktop.

### Cursor Configuration

### Other MCP-Compatible Applications

For other applications supporting MCP, use the following command to start the server via npx:

```bash
INFRANODUS_API_KEY=your-api-key npx -y infranodus-mcp-server
```

or locally

```bash
INFRANODUS_API_KEY=your-api-key node /path/to/mcp-server-infranodus/dist/index.js
```

The server communicates via stdio, so configure your application to run this command and communicate through standard input/output.

## Usage Examples

Once installed, you can ask Claude to:

- "Use InfraNodus to analyze this text and show me the main topics"
- "Generate a knowledge graph from this document"
- "Find content gaps in this article"
- "Retrieve my existing graph called 'Research Notes' from InfraNodus"
- "What are the structural gaps in this text?"
- "Identify the most influential concepts in this content"

## Development

### Running in Development Mode

```bash
npm run dev
```

### Using the MCP Inspector

Test the server with the MCP Inspector:

```bash

npm run build:inspect
npm run inspect
```

### Building from Source

```bash
npm run build
```

### Watching for Changes

```bash
npm run watch
```

## API Documentation

### generate_knowledge_graph

Analyzes text and generates a knowledge graph.

**Parameters:**

- `text` (string, required): The text to analyze
- `includeStatements` (boolean): Include original statements in response
- `modifyAnalyzedText` (string): Text modification options ("none", "entities", "lemmatize")

### analyze_existing_graph_by_name

Retrieves and analyzes an existing graph from your InfraNodus account.

**Parameters:**

- `graphName` (string, required): Name of the existing graph
- `includeStatements` (boolean): Include statements in response
- `includeGraphSummary` (boolean): Include graph summary

### generate_content_gaps

Identifies content gaps and missing connections in text.

**Parameters:**

- `text` (string, required): The text to analyze for gaps

## Progress Notifications

For long-running operations (like SEO analysis), the MCP server supports **real-time progress notifications** that provide intermediary feedback to AI agents. This allows agents to:

- Track the progress of multi-step operations
- Display status messages to users
- Understand what's happening during lengthy analyses

### Implementation

The server implements MCP progress notifications using:

1. **ToolHandlerContext**: All tool handlers can receive an optional context parameter containing the server instance and progress token
2. **ProgressReporter**: A utility class that simplifies sending progress updates with percentages and messages
3. **Wrapped Handlers**: Tool registration automatically injects the server context into handlers

### Example Usage in Tools

```typescript
import { ProgressReporter } from "../utils/progress.js";
import { ToolHandlerContext } from "../types/index.js";

handler: async (params: ParamType, context: ToolHandlerContext = {}) => {
	const progress = new ProgressReporter(context);

	await progress.report(25, "Fetching data from API...");
	// Do work

	await progress.report(75, "Analyzing results...");
	// More work

	await progress.report(100, "Complete!");
	return results;
};
```

The `generate_seo_report` tool demonstrates this pattern with 6 major progress checkpoints that provide detailed status updates throughout the multi-step analysis process.

## Troubleshooting

### Server doesn't appear in Claude

1. Verify the configuration file path is correct
2. Check that the API key is valid
3. Ensure Node.js is in your system PATH
4. Restart Claude Desktop completely

### API Key Issues

- Get your API key at: [https://infranodus.com/api-access](https://infranodus.com/api-access)
- Ensure the key is correctly set in the configuration
- Check that the key has not expired

### Build Errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Resources

- [InfraNodus Website](https://infranodus.com)
- [InfraNodus MCP](https://infranodus.com/mcp)
- [InfraNodus API Documentation](https://infranodus.com/api-access)
- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [Graph Theory Concepts](https://noduslabs.com/research/)

## License

MIT

## Support

For issues related to:

- This MCP server: Open an issue in this repository
- InfraNodus API: Contact support@infranodus.com
- MCP Protocol: Visit the [MCP community](https://modelcontextprotocol.io)
