# InfraNodus MCP Server Installation Guide

## Cross-Platform Setup for Claude Ecosystem

This guide covers installing InfraNodus MCP server across all Claude platforms to ensure your knowledge graphs persist and sync seamlessly.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Option 1: Smithery (Recommended - 5 Minutes)](#option-1-smithery-recommended)
3. [Option 2: Local Installation (Advanced)](#option-2-local-installation)
4. [Platform-Specific Configuration](#platform-specific-configuration)
   - [Claude Desktop](#claude-desktop)
   - [VS Code (Claude Code)](#vs-code-claude-code)
   - [Claude Mobile](#claude-mobile)
   - [Claude Web](#claude-web)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required
- **InfraNodus API Key** - Get yours at [infranodus.com/api-access](https://infranodus.com/api-access)
  - 14-day free trial available
  - First 70 API calls are free without a key
  - Plans start at $19/month

### Optional (for local install)
- Node.js 18+ installed
- Git installed
- Command line access

---

## Option 1: Smithery (Recommended)

**Best for**: Quick setup, automatic updates, cross-platform consistency

### Step 1: Create Smithery Account
1. Go to [smithery.ai](https://smithery.ai)
2. Sign up (free) using Google or GitHub
3. Verify your email

### Step 2: Get InfraNodus API Key
1. Sign up at [infranodus.com](https://infranodus.com) (14-day free trial)
2. Navigate to [API Access](https://infranodus.com/api-access)
3. Copy your API key

### Step 3: Configure InfraNodus on Smithery
1. Visit [Smithery InfraNodus Server](https://smithery.ai/server/@infranodus/mcp-server-infranodus)
2. Click **Configure** (top right)
3. Add your InfraNodus API key
4. Save configuration

### Step 4: Get Configuration for Your Platform

#### For Claude Desktop:
1. On the Smithery page, click **"Install for Claude Desktop"**
2. Smithery will generate configuration JSON
3. Copy the configuration snippet

#### For VS Code (Claude Code):
1. On the Smithery page, click **"Get HTTP URL"**
2. Copy the URL (format: `https://server.smithery.ai/@infranodus/mcp-server-infranodus/mcp?api_key=...`)
3. Use in VS Code settings (see Platform-Specific Configuration below)

**Server URL Format:**
```
https://server.smithery.ai/@infranodus/mcp-server-infranodus/mcp?api_key=YOUR_SMITHERY_KEY&profile=YOUR_SMITHERY_PROFILE
```

### Step 5: Platform Configuration
See [Platform-Specific Configuration](#platform-specific-configuration) section below.

---

## Option 2: Local Installation

**Best for**: Full control, offline access, custom modifications

### Step 1: Clone Repository
```bash
git clone https://github.com/WalkerVVV/mcp-server-infranodus.git
cd mcp-server-infranodus
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Build Server
```bash
# For local development with inspection capabilities
npm run build:inspect

# This generates dist/index.js which you'll use in configuration
```

### Step 4: Configure Environment
Create `.env` file in project root:
```bash
INFRANODUS_API_KEY=your-api-key-here
INFRANODUS_API_BASE=https://infranodus.com/api/v1
```

### Step 5: Test Installation
```bash
# Inspect the MCP server
npm run inspect

# Start the server (for testing)
npm run start
```

---

## Platform-Specific Configuration

### Claude Desktop

#### macOS
1. Open configuration file:
   ```bash
   open ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. **For Smithery Setup**, add:
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

3. **For Local Installation**, add:
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

4. Restart Claude Desktop

#### Windows
1. Open configuration file:
   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```

2. **For Smithery Setup**, add:
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

3. **For Local Installation**, add:
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

4. Restart Claude Desktop

---

### VS Code (Claude Code)

1. Open VS Code Settings (JSON)
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
   - Type "Preferences: Open User Settings (JSON)"

2. Add MCP server configuration:

   **For Smithery (HTTP/SSE):**
   ```json
   {
     "claude-code.mcpServers": {
       "infranodus": {
         "type": "http",
         "url": "https://server.smithery.ai/@infranodus/mcp-server-infranodus/mcp?api_key=YOUR_SMITHERY_KEY&profile=YOUR_SMITHERY_PROFILE",
         "headers": {}
       }
     }
   }
   ```

   **For Local Installation:**
   ```json
   {
     "claude-code.mcpServers": {
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

3. Reload VS Code window
   - Press `Ctrl+Shift+P` / `Cmd+Shift+P`
   - Type "Developer: Reload Window"

---

### Claude Mobile

**Note**: Claude Mobile connects through your **InfraNodus cloud account**, not local installations.

1. Ensure your graphs are saved to your InfraNodus account (not local-only)
2. Use the `create_knowledge_graph` tool to save graphs:
   ```
   create_knowledge_graph({
     graphName: "my-analysis-2025-01-15",
     text: "your text here"
   })
   ```
3. Access via `search` or `analyze_existing_graph_by_name` tools
4. Mobile automatically connects when you use InfraNodus tools

**Cross-Platform Access**:
- Graphs created on Desktop → accessible on Mobile
- Graphs created on Mobile → accessible on Desktop/VS Code
- Search works across all saved graphs

---

### Claude Web

**Note**: Claude Web (claude.ai) currently has limited MCP support.

**Current Options**:
1. **Use Smithery URL** - Some features may work via HTTP/SSE
2. **Access InfraNodus directly** - Log into infranodus.com to view graphs
3. **Wait for official MCP support** - Coming in future updates

**Recommended Workflow**:
- Create/analyze graphs on Desktop or VS Code
- View visualizations at infranodus.com
- Share graph URLs in web conversations

---

## Verification

### Test Installation

1. **Claude Desktop/VS Code**:
   ```
   Test command: "List available InfraNodus tools"

   Expected: Claude shows 21 available tools including:
   - generate_knowledge_graph
   - analyze_existing_graph_by_name
   - generate_content_gaps
   - etc.
   ```

2. **Run First Analysis**:
   ```
   Command: "Use InfraNodus to analyze this text: 'Shipping optimization
   requires balancing cost control, delivery speed, and carrier reliability.
   Many companies struggle to optimize all three simultaneously.'"

   Expected: Returns knowledge graph with:
   - Main concepts identified
   - Topical clusters
   - Content gaps
   - Network statistics
   ```

3. **Test Cross-Platform Sync**:
   ```
   On Desktop:
   "Create a knowledge graph called 'test-sync-2025' from this text:
   'Testing cross-platform synchronization of InfraNodus graphs.'"

   On Mobile/VS Code:
   "Search for graphs containing 'test-sync'"

   Expected: Graph appears in search results
   ```

---

## Troubleshooting

### Common Issues

#### 1. "Server doesn't appear in Claude"
**Solutions**:
- Verify configuration file path is correct
- Check JSON syntax (use JSONLint.com)
- Ensure Node.js is in system PATH (for local install)
- Restart Claude Desktop completely (not just window)
- Check for errors in Claude logs

**macOS Logs**:
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Windows Logs**:
```
%APPDATA%\Claude\logs\mcp*.log
```

#### 2. "API Key Issues"
**Solutions**:
- Verify key at [infranodus.com/api-access](https://infranodus.com/api-access)
- Check key hasn't expired
- Ensure no extra spaces in key
- For Smithery: Verify Smithery profile has InfraNodus key configured

#### 3. "Build Errors" (Local Install)
**Solutions**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build:inspect
```

#### 4. "Cross-Platform Graphs Not Syncing"
**Solutions**:
- Ensure using same InfraNodus account across platforms
- Verify graphs were saved (not just analyzed with `doNotSave=true`)
- Use exact graph names when retrieving
- Check graph visibility settings (public vs private)

#### 5. "Rate Limit Exceeded"
**Solutions**:
- Add valid API key (first 70 calls are free)
- Upgrade InfraNodus plan
- Use `doNotSave=true` parameter to avoid saving test graphs
- Batch process multiple analyses

---

## Next Steps

1. ✅ Installation complete
2. 📖 Read [WORKFLOWS.md](./WORKFLOWS.md) - FirstMile-specific use cases
3. 📚 Review [API_REFERENCE.md](./API_REFERENCE.md) - All 21 tools documented
4. 🔄 Check [CROSS_PLATFORM.md](./CROSS_PLATFORM.md) - Sync strategies
5. 🚀 Try [QUICKSTART.md](./QUICKSTART.md) - First analysis in 5 minutes

---

## Support Resources

- **InfraNodus MCP Issues**: [GitHub Repository](https://github.com/WalkerVVV/mcp-server-infranodus/issues)
- **InfraNodus API Support**: support@infranodus.com
- **MCP Protocol Docs**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **InfraNodus Platform**: [infranodus.com/mcp](https://infranodus.com/mcp)

---

## Configuration Templates

Pre-configured templates are available in `/config` directory:
- `claude_desktop_config.json` - Desktop setup
- `vscode_settings.json` - VS Code setup
- `smithery_config.json` - Smithery setup
- `.env.template` - Environment variables

Copy and customize these for your installation.
