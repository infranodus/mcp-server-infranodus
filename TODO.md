# MCP Server Compatibility Plan

## Problem Summary

The KeywordGraph MCP server at commit `a49c85df` works correctly with both n8n and Claude. However, attempted modifications to add session-based auth fallback broke n8n compatibility.

| Client | Transport | Auth Behavior | Status |
|--------|-----------|---------------|--------|
| **n8n** | Streamable HTTP (SSE responses) | Sends Bearer token on every request | **WORKS** |
| **Claude** (Anthropic) | Streamable HTTP | Sends Bearer token on every request | **WORKS** |
| **Claude Desktop** | stdio (local) or Streamable HTTP | Similar to Claude | Needs testing |

## Current Architecture (Working Version - commit a49c85df)

```
src/http-server.ts
├── OAuth2 endpoints (/oauth/*)
├── MCP endpoints (/, /mcp)
│   └── Uses StreamableHTTPServerTransport
│       └── Default SSE response mode
│       └── Sessions keyed by OAuth sessionId
└── Auth: Bearer token required on EVERY request
```

## Root Cause Analysis

### Why Current Version Works for Both
- Both n8n and Claude send `Authorization: Bearer <token>` header on every MCP request
- The server validates the token each time and creates/reuses transport
- SSE response format is correctly parsed by both clients

### What Broke When Changes Were Applied

The following changes were made that broke n8n:

1. **Session-based auth fallback** - Added `sessionAuthInfo` Map and fallback logic in `authMiddleware`
2. **CORS changes** - Added `exposedHeaders: ["mcp-session-id"]` and `allowedHeaders`
3. **Additional logging** - Added `mcp-session-id` to HTTP request logging

**Hypothesis**: One of these changes (likely CORS or the auth middleware modification) caused n8n to fail during the MCP protocol handshake. The exact cause needs investigation.

### Investigation Needed
- [ ] Test with ONLY session-based auth (no CORS changes)
- [ ] Test with ONLY CORS changes (no auth changes)
- [ ] Check if n8n is sensitive to response header changes
- [ ] Check if auth middleware order/timing matters

---

## Implementation Plan

### Phase 1: Identify Breaking Change (Priority: High)

Current version (commit `a49c85df`) works for both clients. Need to identify which change broke n8n.

- [x] **Task 1.1**: Baseline established - current version works for both n8n and Claude

- [ ] **Task 1.2**: Test with ONLY CORS changes
  ```typescript
  app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true,
    exposedHeaders: ["mcp-session-id"],
    allowedHeaders: ["Content-Type", "Authorization", "mcp-session-id", "Accept"],
  }));
  ```
  - If breaks: CORS is the culprit
  - If works: Move to 1.3

- [ ] **Task 1.3**: Test with ONLY session auth changes (no CORS)
  - Add `sessionAuthInfo` Map
  - Add fallback logic in authMiddleware
  - If breaks: Auth changes are the culprit
  - If works: Interaction between both changes

- [ ] **Task 1.4**: If both work individually, test combined
  - The combination might cause the issue

### Phase 2: Compatible Implementation (Priority: High)

Based on Phase 1 findings, implement one of these approaches:

#### Option A: Session-Based Auth Fallback (Preferred)
```typescript
// Store auth info when session is created
const sessionAuthInfo = new Map<string, AuthenticatedRequest>();

function authMiddleware(req, res, next) {
  // 1. Try Bearer token first (for n8n compatibility)
  if (authHeader?.startsWith("Bearer ")) {
    const authInfo = verifyAccessToken(token);
    if (authInfo) {
      req[AUTH_KEY] = authInfo;
      return next();
    }
  }

  // 2. Fallback to session-based auth (for Claude compatibility)
  const mcpSessionId = req.headers["mcp-session-id"];
  if (mcpSessionId) {
    const storedAuth = sessionAuthInfo.get(mcpSessionId);
    if (storedAuth) {
      req[AUTH_KEY] = storedAuth;
      return next();
    }
  }

  // 3. Reject if neither works
  res.status(401).json({ error: "unauthorized" });
}
```

#### Option B: Client Detection
```typescript
// Detect client from User-Agent or clientInfo and handle differently
function handleMcpRequest(req, res) {
  const clientName = req.body?.params?.clientInfo?.name;

  if (clientName?.includes("n8n")) {
    // n8n-specific handling
  } else if (clientName?.includes("Anthropic") || clientName?.includes("Claude")) {
    // Claude-specific handling
  }
}
```

#### Option C: Dual Transport Support
- Keep Streamable HTTP for modern clients
- Add legacy SSE transport (`/sse` + `/message`) for problematic clients
- Let clients choose based on their capabilities

### Phase 3: CORS Configuration (Priority: Medium)

- [ ] **Task 3.1**: Research if CORS changes affect n8n
  - Test with `exposedHeaders: ["mcp-session-id"]`
  - Test with `allowedHeaders` additions

- [ ] **Task 3.2**: Implement minimal CORS changes if needed
  ```typescript
  app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true,
    exposedHeaders: ["mcp-session-id"], // Only if needed
  }));
  ```

### Phase 4: Testing & Validation (Priority: High)

- [ ] **Task 4.1**: Create test matrix
  | Test Case | n8n | Claude | Claude Desktop |
  |-----------|-----|--------|----------------|
  | OAuth flow | | | |
  | Initialize | | | |
  | List tools | | | |
  | Call tool | | | |
  | Session persistence | | | |

- [ ] **Task 4.2**: Automated testing
  - Create curl-based test scripts
  - Test each client scenario

- [ ] **Task 4.3**: Document supported clients and their requirements

---

## Technical Notes

### MCP Transport Types

1. **stdio** - For local servers (Claude Desktop local mode)
2. **SSE (deprecated)** - Separate `/sse` and `/message` endpoints
3. **Streamable HTTP** - Single endpoint, SSE or JSON responses
   - `enableJsonResponse: false` (default) - SSE responses
   - `enableJsonResponse: true` - JSON responses

### n8n MCP Client Behavior
- Client name: `@n8n/n8n-nodes-langchain.mcpClientTool`
- Protocol version: `2025-06-18`
- Sends Bearer token on every request
- Known issues with SSE parsing (GitHub #17428)
- May retry `initialize` multiple times

### Claude/Anthropic MCP Client Behavior
- Client name: `Anthropic`
- Protocol version: `2025-11-25`
- Sends Bearer token only on first request
- Expects `mcp-session-id` header for session continuity
- Properly handles SSE responses

### Key Headers
- `Authorization: Bearer <token>` - OAuth access token
- `mcp-session-id` - MCP session identifier (set by server)
- `Accept: application/json, text/event-stream` - Content negotiation
- `Content-Type: application/json` - Request body type

---

## References

- [MCP Specification - Transports](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [n8n MCP Client Issues](https://github.com/n8n-io/n8n/issues/17428)
- [n8n Streamable HTTP PR](https://github.com/n8n-io/n8n/pull/15454)
- [MCP SDK - StreamableHTTPServerTransport](https://github.com/modelcontextprotocol/typescript-sdk)

---

## Success Criteria

1. n8n can connect, list tools, and call tools successfully
2. Claude can connect, list tools, and call tools successfully
3. No breaking changes to existing OAuth flow
4. Session management works correctly for both clients
5. Server remains stateless-friendly (can run multiple instances)
