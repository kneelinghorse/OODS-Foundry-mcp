Hooked the OODS MCP server into the hub via a spec-compliant adapter and verified all hub servers are connected.

Changes made

Added new adapter package packages/mcp-adapter/ that wraps the native @oods/mcp-server stdio protocol with MCP JSON-RPC using the official SDK and zod. The adapter proxies all OODS tools and preserves the designer role by default.
Files: packages/mcp-adapter/package.json, packages/mcp-adapter/index.js, packages/mcp-adapter/package-lock.json (local npm install of @modelcontextprotocol/sdk@1.22.0 + deps).
Updated hub config to launch the adapter instead of the raw stdio server and watch the right files: /Users/systemsystems/portfolio/mcp-hub/mcp-servers.json now points oods-foundry to packages/mcp-adapter/index.js with dev watch on the adapter and built server artifacts.
Service state

Restarted pm2-managed hub (pm2 restart mcp-hub); after startup all servers are online: mission-protocol, sequential-thinking, repomix, and oods-foundry (curl -s http://localhost:37373/api/servers shows status connected for all).
Notes / next steps

If you change OODS MCP server code, rebuild it (pnpm --filter @oods/mcp-server run build); the adapter watches the dist outputs.
If you change the adapter, pm2 restart mcp-hub will reload it.
Designer role is enforced via MCP_ROLE=designer in the hub config; switch to maintainer there if you want elevated tools.