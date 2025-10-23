# Configuration Templates

This directory contains pre-configured templates for different platforms and setups.

## Quick Setup Guide

### 1. Choose Your Installation Method

**Smithery** (Recommended - Easiest):
- Auto-updates
- Cross-platform compatibility
- No local maintenance

**Local** (Advanced - More Control):
- Full control
- Offline access
- Custom modifications

### 2. Choose Your Platform

**Claude Desktop**:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**VS Code**:
- Settings → Search "claude-code.mcpServers"
- Or edit settings.json directly

## Available Templates

### Claude Desktop (Smithery)
**File**: `claude_desktop_config_smithery.json`

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

**Setup Steps**:
1. Get Smithery key from [smithery.ai/server/@infranodus/mcp-server-infranodus](https://smithery.ai/server/@infranodus/mcp-server-infranodus)
2. Replace `YOUR_SMITHERY_KEY` and `YOUR_SMITHERY_PROFILE`
3. Copy to Claude Desktop config location
4. Restart Claude Desktop

### Claude Desktop (Local)
**File**: `claude_desktop_config_local.json`

```json
{
  "mcpServers": {
    "infranodus": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-infranodus/dist/index.js"],
      "env": {
        "INFRANODUS_API_KEY": "your-infranodus-api-key-here"
      }
    }
  }
}
```

**Setup Steps**:
1. Clone this repo and build: `npm install && npm run build:inspect`
2. Get InfraNodus API key from [infranodus.com/api-access](https://infranodus.com/api-access)
3. Replace `/absolute/path/to/` with actual path
4. Replace `your-infranodus-api-key-here`
5. Copy to Claude Desktop config location
6. Restart Claude Desktop

### VS Code (Smithery)
**File**: `vscode_settings_smithery.json`

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

**Setup Steps**:
1. Get Smithery URL from [smithery.ai](https://smithery.ai)
2. Replace `YOUR_SMITHERY_KEY` and `YOUR_SMITHERY_PROFILE`
3. Add to VS Code settings.json
4. Reload VS Code window

### VS Code (Local)
**File**: `vscode_settings_local.json`

```json
{
  "claude-code.mcpServers": {
    "infranodus": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-infranodus/dist/index.js"],
      "env": {
        "INFRANODUS_API_KEY": "your-infranodus-api-key-here"
      }
    }
  }
}
```

**Setup Steps**:
1. Build the server: `npm install && npm run build:inspect`
2. Get InfraNodus API key
3. Update path and API key
4. Add to VS Code settings.json
5. Reload VS Code window

## Merging with Existing Config

If you already have other MCP servers configured:

**DON'T** replace your entire config file.
**DO** add the `"infranodus": { ... }` block inside your existing `"mcpServers"` section.

### Example: Merging Configs

**Your existing config**:
```json
{
  "mcpServers": {
    "hubspot": {
      "command": "...",
      "args": ["..."]
    },
    "google-drive": {
      "command": "...",
      "args": ["..."]
    }
  }
}
```

**After adding InfraNodus**:
```json
{
  "mcpServers": {
    "hubspot": {
      "command": "...",
      "args": ["..."]
    },
    "google-drive": {
      "command": "...",
      "args": ["..."]
    },
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

**Important**: Don't forget the comma after the previous server!

## Validation

Test your JSON syntax:
- Online: [JSONLint.com](https://jsonlint.com)
- VS Code: Built-in JSON validation
- Command line: `cat config.json | jq .`

## Environment Variables

Create a `.env` file in the repository root for local installations:

```bash
INFRANODUS_API_KEY=your-api-key-here
INFRANODUS_API_BASE=https://infranodus.com/api/v1
```

This file is already in `.gitignore` to prevent accidentally committing your API key.

## Troubleshooting

### Config file not found
- **macOS**: Make sure `~/Library/Application Support/Claude/` directory exists
- **Windows**: Make sure `%APPDATA%\Claude\` directory exists

### JSON syntax error
- Use [JSONLint](https://jsonlint.com) to validate
- Common issues:
  - Missing comma between objects
  - Extra comma after last item
  - Unmatched brackets
  - Incorrect quotes (use `"` not `'`)

### Paths with spaces (Windows)
Use double quotes around paths:
```json
"args": ["C:\\Program Files\\nodejs\\node.exe", "..."]
```

### Server doesn't load
1. Check that Node.js is installed: `node --version`
2. For Smithery: Test `npx @smithery/cli@latest --version`
3. For local: Test `node /path/to/dist/index.js` directly
4. Check Claude Desktop logs (see TROUBLESHOOTING.md)

## Platform-Specific Notes

### macOS
- Use forward slashes in paths: `/Users/name/path/to/file`
- Use `open` command to edit config: `open ~/Library/Application\ Support/Claude/claude_desktop_config.json`

### Windows
- Use double backslashes in paths: `C:\\Users\\name\\path\\to\\file`
- OR use forward slashes: `C:/Users/name/path/to/file`
- Open config via File Explorer: `%APPDATA%\Claude\claude_desktop_config.json`

### Linux
- Config location: `~/.config/Claude/claude_desktop_config.json`
- Use forward slashes in paths

## Next Steps

1. Choose template based on your platform and installation method
2. Copy and customize the template
3. Verify installation: See [QUICKSTART.md](../docs/QUICKSTART.md)
4. Configure InfraNodus API key if not done already
5. Test with first analysis

## Need Help?

- Full installation guide: [../docs/INSTALLATION.md](../docs/INSTALLATION.md)
- Quick start: [../docs/QUICKSTART.md](../docs/QUICKSTART.md)
- Troubleshooting: [../docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)
