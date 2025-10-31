# Publishing and Using infranodus-mcp-server with npx

## Publishing to npm

1. **Ensure you're logged in to npm:**
   ```bash
   npm login
   ```

2. **Build the project:**
   ```bash
   npm run build:inspect
   ```

3. **Publish to npm:**
   ```bash
   npm publish
   ```

   Or for a test run first:
   ```bash
   npm publish --dry-run
   ```

## Using with npx

Once published, users can run your MCP server using npx in their Claude Desktop or other MCP client configurations:

### Claude Desktop Configuration

Users can add this to their Claude Desktop config file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "infranodus": {
      "command": "npx",
      "args": [
        "-y",
        "infranodus-mcp-server"
      ],
      "env": {
        "INFRANODUS_API_KEY": "your-api-key-here",
        "INFRANODUS_API_BASE": "https://infranodus.com/api/v1"
      }
    }
  }
}
```

### Direct Testing with npx

After publishing, test your package:

```bash
# Run directly (will exit immediately as it expects MCP protocol)
npx -y infranodus-mcp-server

# Set environment variables if needed
INFRANODUS_API_KEY=your-key npx -y infranodus-mcp-server
```

## Version Updates

When you make changes:

1. Update the version in `package.json`:
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```

2. Build and publish:
   ```bash
   npm run build:inspect
   npm publish
   ```

## Local Testing Before Publishing

To test the npx behavior locally before publishing:

1. Build the project first:
   ```bash
   npm run build:inspect
   ```

2. Link your package globally:
   ```bash
   npm link
   ```

3. Test the command with a simple initialize message:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | infranodus-mcp-server
   ```

   You should see a JSON response with server capabilities.

4. Unlink when done:
   ```bash
   npm unlink -g infranodus-mcp-server
   ```

## Troubleshooting

If the server disconnects unexpectedly:
1. Check that environment variables are set correctly
2. Ensure the build is up to date (`npm run build:inspect`)
3. Check stderr output by adding debugging statements with `console.error()`

## Package Structure

The published package includes:
- `dist/` - Compiled JavaScript files
- `bin/` - Executable entry point with shebang
- `README.md` - Documentation
- `LICENSE` - MIT License
- `package.json` - Package metadata

Files excluded (via `.npmignore`):
- Source TypeScript files (`src/`)
- Development configuration files
- Environment files (`.env`)
- Development dependencies