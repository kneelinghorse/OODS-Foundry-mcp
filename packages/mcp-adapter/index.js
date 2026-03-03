import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Runtime Node version check — warn early if below minimum
const [nodeMajor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 20) {
  console.warn(
    `[oods-mcp-adapter] WARNING: Node ${process.versions.node} detected. ` +
    `This adapter requires Node >= 20. Unexpected failures may occur.`
  );
}
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const NATIVE_SERVER_DIR = path.join(PROJECT_ROOT, 'packages', 'mcp-server');
const NATIVE_DIST = path.join(NATIVE_SERVER_DIR, 'dist');
const SCHEMAS_DIR = path.join(NATIVE_DIST, 'schemas');

const DEFAULT_ROLE = process.env.MCP_ROLE || 'designer';
const REGISTRY_PATH = path.join(NATIVE_DIST, 'tools', 'registry.json');
const POLICY_PATH = path.join(NATIVE_DIST, 'security', 'policy.json');
const ADAPTER_VERSION = '0.2.0';

// ── Dynamic tool registry ────────────────────────────────────────────
// Reads registry.json from the server dist instead of hardcoding tool names.
// MCP tool names use underscores (Claude Desktop requires ^[a-zA-Z0-9_-]{1,64}$).
// Internal names use dots for native server communication.

function loadRegistry() {
  const raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  return { auto: raw.auto || [], onDemand: raw.onDemand || [] };
}

function resolveEnabledTools(registry) {
  const toolset = (process.env.MCP_TOOLSET || 'default').toLowerCase();
  if (toolset === 'all') {
    return [...registry.auto, ...registry.onDemand];
  }
  const extras = (process.env.MCP_EXTRA_TOOLS || '')
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return [...registry.auto, ...extras.filter(t => registry.onDemand.includes(t))];
}

function dotToUnderscore(name) {
  return name.replace(/\./g, '_');
}

const DESCRIPTIONS_PATH = path.join(__dirname, 'tool-descriptions.json');

function loadDescriptions() {
  return JSON.parse(fs.readFileSync(DESCRIPTIONS_PATH, 'utf8'));
}

function loadInputSchema(toolName) {
  // Try tool-specific schema first, fall back to generic
  for (const candidate of [`${toolName}.input.json`, 'generic.input.json']) {
    const full = path.join(SCHEMAS_DIR, candidate);
    try {
      const schema = JSON.parse(fs.readFileSync(full, 'utf8'));
      // Strip $ref properties — they reference local files that MCP clients can't resolve.
      // Replace with { type: "object" } to keep the parameter slot visible.
      return stripRefs(schema);
    } catch {
      continue;
    }
  }
  return { type: 'object', additionalProperties: true };
}

function stripRefs(schema) {
  if (schema === null || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(stripRefs);
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === '$ref') {
      // Replace $ref with a generic object stub
      return { type: 'object', description: '(complex schema — see server docs)' };
    }
    out[key] = stripRefs(value);
  }
  return out;
}

// ── MCP annotations derived from server policy ──────────────────────
// Reads policy.json to determine readOnlyHint / destructiveHint per tool.

function loadPolicy() {
  try {
    return JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
  } catch {
    return { rules: [] };
  }
}

function deriveAnnotations(toolName, policy) {
  const rule = policy.rules?.find(r => r.tool === toolName);
  if (!rule) {
    return { openWorldHint: false };
  }
  if (rule.readOnly) {
    return { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  }
  // Tools with 'writes' paths can modify state
  return { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
}

class NativeOodsClient {
  constructor({ cwd, role }) {
    this.cwd = cwd;
    this.role = role;
    this.child = null;
    this.seq = 0;
    this.pending = new Map();
    this.buffer = '';
  }

  ensure() {
    if (this.child && !this.child.killed) return;
    const entry = path.join(NATIVE_DIST, 'index.js');
    if (!fs.existsSync(entry)) {
      throw new Error(`Native MCP server not built at ${entry}. Run pnpm --filter @oods/mcp-server run build.`);
    }
    const nodeBin = process.env.OODS_NODE_PATH || process.execPath;
    this.child = spawn(nodeBin, [entry], {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env },
    });

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this.handleStdout(chunk));
    this.child.on('exit', () => {
      for (const [, promise] of this.pending) {
        promise.reject(new Error('Native MCP server exited'));
      }
      this.pending.clear();
      this.child = null;
    });
  }

  handleStdout(chunk) {
    this.buffer += chunk;
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const { id, result, error } = parsed;
      if (id == null) continue;
      const pending = this.pending.get(id);
      if (!pending) continue;
      this.pending.delete(id);
      if (error) pending.reject(new Error(typeof error === 'string' ? error : error.message || 'Native error'));
      else pending.resolve(result);
    }
  }

  async run(tool, input) {
    this.ensure();
    const id = ++this.seq;
    const payload = JSON.stringify({ id, tool, input, role: this.role }) + '\n';
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(payload, 'utf8');
    });
  }

  close() {
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    this.child = null;
  }
}

async function main() {
  const registry = loadRegistry();
  const enabled = resolveEnabledTools(registry);
  const descriptions = loadDescriptions();
  const policy = loadPolicy();

  // Build the tool manifest: MCP name, internal name, description, input schema, annotations
  const toolManifest = enabled.map(internalName => ({
    internalName,
    mcpName: dotToUnderscore(internalName),
    description: descriptions[internalName] || `OODS tool: ${internalName}`,
    inputSchema: loadInputSchema(internalName),
    annotations: deriveAnnotations(internalName, policy),
  }));

  const client = new NativeOodsClient({ cwd: NATIVE_SERVER_DIR, role: DEFAULT_ROLE });
  const server = new Server(
    { name: 'oods-foundry-adapter', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  // Map MCP name → internal name for dispatch
  const nameMap = new Map(toolManifest.map(t => [t.mcpName, t.internalName]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolManifest.map(t => ({
      name: t.mcpName,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: t.annotations,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const internalName = nameMap.get(name);
    if (!internalName) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      };
    }
    try {
      const result = await client.run(internalName, args ?? {});
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Structured error with actionable guidance for server spawn failures
      const isSpawnError = message.includes('not built') || message.includes('server exited') || message.includes('ENOENT');
      const guidance = isSpawnError
        ? `\n\nTo fix: run "pnpm --filter @oods/mcp-server run build" then retry.`
        : '';
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool ${name} failed: ${message}${guidance}` }],
      };
    }
  });

  console.error(`[oods-mcp-adapter] v${ADAPTER_VERSION} | ${enabled.length} tools (${registry.auto.length} auto, ${registry.onDemand.length} on-demand) | server: ${NATIVE_DIST}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = () => {
    client.close();
    transport.close?.();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[oods-mcp-adapter] failed to start:', err);
  process.exit(1);
});
