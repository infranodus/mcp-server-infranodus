# Graph Management TODO

## Make graphs public / private via MCP

Currently a graph's visibility can only be changed in the InfraNodus web UI. The MCP server exposes `isPublic` read-only through `list_graphs`, and public graphs of other users can be read with `userName` (e.g. `analyze_existing_graph_by_name`), but there is no way to toggle visibility from an MCP client.

- [ ] Add a tool (e.g. `set_graph_visibility` or a `isPublic` parameter on an existing graph-management tool) that sets a graph in the user's own account to public or private
- [ ] Reuse the confirmation pattern from `delete_graph` (dry run by default, `confirm: true` to apply) since making a graph public exposes its content
- [ ] Return the updated `isPublic` flag and the graph URL in the response
- [ ] Only the caller's own graphs can be targeted (no `userName` parameter), mirroring `delete_graph`
- [ ] Verify the backend API endpoint exists and what it expects; add one if needed
- [ ] Document the tool in README and the tool descriptions
