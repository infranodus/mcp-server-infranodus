#!/usr/bin/env node
// Brand-specific entry for the published `keywordgraph-mcp-server` package.
// Bakes in BRAND so `npx keywordgraph-mcp-server` runs as KeywordGraph without
// the caller needing to set any env var. An explicit BRAND still wins.
// NOTE: must use dynamic import — a static import would be hoisted and run
// before this assignment, so brand.js would read BRAND too early.
process.env.BRAND ||= "keywordgraph";
await import("./mcp-server.js");
