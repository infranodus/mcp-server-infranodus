# Deploying to Fly.io

This MCP server is brand-neutral: one codebase, one Docker image, deployed as
separate Fly apps per brand. The active brand is selected by the `BRAND`
environment variable, which is baked into each brand's Fly config:

| Brand        | Fly config              | App name (default)        | Deploy command       |
| ------------ | ----------------------- | ------------------------- | -------------------- |
| InfraNodus   | `fly.infranodus.toml`   | `infranodus-mcp-server`   | `npm run deploy:in`  |
| KeywordGraph | `fly.keywordgraph.toml` | `keywordgraph-mcp-server` | `npm run deploy:kg`  |

Each `npm run deploy:*` script is just `fly deploy -c <brand config>`.

## You do NOT need to connect a GitHub repo

`fly deploy` builds from your **local** directory using the `Dockerfile` and
pushes the resulting image. The "attach a GitHub repo" prompt is Fly's optional
CI integration (auto-deploy on push) — ignore it.

Avoid `fly launch`; it tries to auto-scaffold and will overwrite the committed
`fly.*.toml`. Use `fly apps create` + `fly deploy` instead, as below.

## First-time setup

```bash
# 1. Authenticate (interactive — opens a browser). One time per machine.
fly auth login

# 2. Create the app — empty, no machines, no repo, no cost until you deploy.
fly apps create infranodus-mcp-server

# 3. Set a stable JWT secret (see "Secrets" below for why).
fly secrets set JWT_SECRET=$(openssl rand -hex 32) -a infranodus-mcp-server

# 4. Deploy from local source.
npm run deploy:in
```

For the KeywordGraph app, repeat with `keywordgraph-mcp-server` and `npm run deploy:kg`.

> **App names are globally unique on Fly.** If `infranodus-mcp-server` is
> taken, `fly apps create` errors — pick another name and update the `app =`
> line in `fly.infranodus.toml` to match.

## Secrets

### `JWT_SECRET` — set this

The HTTP server signs user session tokens with `JWT_SECRET`. If it is unset, the
server generates a **random secret on every startup**, which means:

- Every deploy/restart invalidates all existing user tokens (everyone must
  re-authenticate).
- With more than one machine, a token signed by one machine won't verify on
  another, so auth breaks intermittently.

Set it once:

```bash
fly secrets set JWT_SECRET=$(openssl rand -hex 32) -a infranodus-mcp-server
```

You can set it **before or after** deploy — setting it on a running app triggers
a rolling restart so machines pick up the new value. Just set it before sharing
the URL, so no user gets a token that the restart will invalidate.

### API key — do NOT set one

This is a multi-user hosted server: each user supplies their **own** API key
through the OAuth/authorize flow, and every request runs with that user's key.
The server-level `INFRANODUS_API_KEY` / `KEYWORDGRAPH_API_KEY` env var is only
used in local stdio (single-user CLI) mode. Leave it unset on Fly.

### Inspecting secrets

```bash
fly secrets list -a infranodus-mcp-server   # shows names + digests, not values
```

## What's already configured

Each `fly.*.toml` sets:

- `BRAND` — selects the brand (tool set, name, API base, env-var prefix).
- `<BRAND>_API_BASE` — the brand's API endpoint.
- `CORS_ORIGIN = '*'`, `NODE_ENV = 'production'`.
- HTTP service on internal port `3000`, forced HTTPS, health check at `/health`,
  one always-on machine.

## Routine deploys

After the first setup, deploying an update is just:

```bash
npm run deploy:in     # InfraNodus
npm run deploy:kg     # KeywordGraph
```

## Other Fly commands

```bash
fly status   -a infranodus-mcp-server   # machines, health
fly logs     -a infranodus-mcp-server   # live logs
fly apps open -a infranodus-mcp-server  # open the URL in a browser
```
