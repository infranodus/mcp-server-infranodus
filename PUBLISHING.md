# Publishing and Using the MCP server with npx

## Two brands, one codebase

This single codebase ships as **two** npm packages from the same source:

- `keywordgraph-mcp-server` (brand: `keywordgraph`)
- `infranodus-mcp-server` (brand: `infranodus`)

`package.json` can only hold one npm identity at a time, and it is committed with
the **keywordgraph** identity. So a bare `npm publish` always ships the
keywordgraph package. To publish each brand correctly, use the dedicated npm
scripts, which delegate to `scripts/publish-brand.mjs`. That script temporarily
rewrites `name`/`description`/`bin`/`repository`/`keywords` from the brand
definition in `src/config/brand.ts` (the single source of truth), runs
`npm publish`, then restores `package.json` verbatim.

## Publishing to npm

1. **Ensure you're logged in to npm:**
   ```bash
   npm login
   ```

2. **Publish each brand** (each command builds first via `build:inspect`, so no
   separate build step is needed):

   ```bash
   # Publish keywordgraph-mcp-server
   npm run publish:kg

   # Publish infranodus-mcp-server
   npm run publish:in
   ```

   Both packages share the single `version` in `package.json`, so bump the
   version once (see [Version Updates](#version-updates)) and then publish both.

   For a test run first, pass `--dry-run` through to `npm publish`:
   ```bash
   npm run publish:kg -- --dry-run
   npm run publish:in -- --dry-run
   ```

   > A bare `npm publish` still works but only ever ships the keywordgraph
   > package (the committed identity). Prefer the scripts above so the brand is
   > always explicit.

## Using with npx

Once published, users can run your MCP server using npx in their Claude Desktop or other MCP client configurations:

### Claude Desktop Configuration

Users can add this to their Claude Desktop config file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "keywordgraph": {
      "command": "npx",
      "args": [
        "-y",
        "keywordgraph-mcp-server"
      ],
      "env": {
        "KEYWORDGRAPH_API_KEY": "your-api-key-here",
        "KEYWORDGRAPH_API_BASE": "https://keywordgraph.com/api/v1"
      }
    }
  }
}
```

### Direct Testing with npx

After publishing, test your package:

```bash
# Run directly (will exit immediately as it expects MCP protocol)
npx -y keywordgraph-mcp-server

# Set environment variables if needed
KEYWORDGRAPH_API_KEY=your-key npx -y keywordgraph-mcp-server
```

## Version Updates

When you make changes:

1. Update the version **once** in `package.json` (both packages share the same
   version):
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```

   > `npm version` creates a git commit and tag, so run it a single time before
   > publishing both brands — not between the two publish commands.

2. Publish both brands (each script builds first):
   ```bash
   npm run publish:kg
   npm run publish:in
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
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | keywordgraph-mcp-server
   ```

   You should see a JSON response with server capabilities.

4. Unlink when done:
   ```bash
   npm unlink -g keywordgraph-mcp-server
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

---

## Deploying to Fly.io (HTTP Server)

The MCP server can be deployed as an HTTP server with OAuth2 authentication at a public URL (e.g., `mcp.keywordgraph.com`).

### Prerequisites

1. Install the Fly.io CLI:
   ```bash
   brew install flyctl
   # or
   curl -L https://fly.io/install.sh | sh
   ```

2. Login to Fly.io:
   ```bash
   fly auth login
   ```

### Initial Deployment

1. **Create the app** (first time only):
   ```bash
   fly launch --no-deploy
   ```
   This creates the app based on `fly.toml` configuration.

2. **Set secrets**:
   ```bash
   fly secrets set JWT_SECRET="your-secure-random-secret"
   ```
   
   Generate a secure secret:
   ```bash
   openssl rand -base64 32
   ```

3. **Deploy**:
   ```bash
   fly deploy
   ```

### Subsequent Deployments

After the initial setup, deploy updates with:

```bash
npm run build:inspect
fly deploy
```

### Custom Domain Setup

To use a custom domain like `mcp.keywordgraph.com`:

1. **Add the domain**:
   ```bash
   fly certs add mcp.keywordgraph.com
   ```

2. **Configure DNS** - Add the records shown by Fly.io to your domain's DNS settings (typically a CNAME to `keywordgraph-mcp-server.fly.dev`).

3. **Verify**:
   ```bash
   fly certs show mcp.keywordgraph.com
   ```

### Configuration

The `fly.toml` configures:
- **Region**: Frankfurt (`fra`)
- **Resources**: 1GB RAM, 1 shared CPU
- **Always-on**: Minimum 1 machine running
- **Health checks**: Every 30s on `/health`

Environment variables set in `fly.toml`:
```toml
[env]
  CORS_ORIGIN = '*'
  KEYWORDGRAPH_API_BASE = 'https://keywordgraph.com/api/v1'
  NODE_ENV = 'production'
```

### Monitoring

```bash
# View logs
fly logs

# Check app status
fly status

# Open the app
fly open

# SSH into the container
fly ssh console
```

### Scaling

```bash
# Scale to multiple regions
fly scale count 2 --region fra,ams

# Adjust VM size
fly scale vm shared-cpu-1x --memory 1024
```

### Alternative: Render.com

A `render.yaml` is also provided for deploying to Render.com:

1. Connect your GitHub repo to Render
2. Render will auto-detect the `render.yaml` blueprint
3. Set the `JWT_SECRET` environment variable in the Render dashboard