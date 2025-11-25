import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const NATIVE_SERVER_DIR = path.join(PROJECT_ROOT, 'packages', 'mcp-server');
const NATIVE_DIST = path.join(NATIVE_SERVER_DIR, 'dist');
const SCHEMAS_DIR = path.join(NATIVE_DIST, 'schemas');

const DEFAULT_ROLE = process.env.MCP_ROLE || 'designer';

const TOOL_SPECS = [
  { name: 'tokens.build', input: 'tokens.build.input.json', output: 'generic.output.json' },
  { name: 'structuredData.fetch', input: 'structuredData.fetch.input.json', output: 'structuredData.fetch.output.json' },
  { name: 'repl.validate', input: 'repl.validate.input.json', output: 'repl.validate.output.json' },
  { name: 'repl.render', input: 'repl.render.input.json', output: 'repl.render.output.json' },
  { name: 'brand.apply', input: 'brand.apply.input.json', output: 'brand.apply.output.json' },
  { name: 'a11y.scan', input: 'generic.input.json', output: 'generic.output.json' },
  { name: 'purity.audit', input: 'generic.input.json', output: 'generic.output.json' },
  { name: 'vrt.run', input: 'generic.input.json', output: 'generic.output.json' },
  { name: 'diag.snapshot', input: 'generic.input.json', output: 'generic.output.json' },
  { name: 'reviewKit.create', input: 'generic.input.json', output: 'generic.output.json' },
  { name: 'billing.reviewKit', input: 'billing.reviewKit.input.json', output: 'generic.output.json' },
  { name: 'billing.switchFixtures', input: 'billing.switchFixtures.input.json', output: 'generic.output.json' },
  { name: 'release.verify', input: 'release.verify.input.json', output: 'release.verify.output.json' },
  { name: 'release.tag', input: 'release.tag.input.json', output: 'release.tag.output.json' },
];

function loadSchema(filename) {
  const full = path.join(SCHEMAS_DIR, filename);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch {
    return { type: 'object', additionalProperties: true };
  }
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
    this.child = spawn(process.execPath, [entry], {
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
  const sdkRoot = path.join(__dirname, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'esm');
  const { McpServer } = await import(pathToFileURL(path.join(sdkRoot, 'server', 'mcp.js')).href);
  const { StdioServerTransport } = await import(pathToFileURL(path.join(sdkRoot, 'server', 'stdio.js')).href);
  const { z } = await import('zod');

  const client = new NativeOodsClient({ cwd: NATIVE_SERVER_DIR, role: DEFAULT_ROLE });
  const server = new McpServer({ name: 'oods-foundry-adapter', version: '0.1.0' });

  const inputSchema = z.object({}).catchall(z.any()).default({});

  for (const spec of TOOL_SPECS) {
    server.tool(
      spec.name,
      `Proxy to OODS native tool "${spec.name}"`,
      inputSchema,
      async (args) => {
        try {
          const result = await client.run(spec.name, args ?? {});
          return {
            content: [
              {
                type: 'text',
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
              },
            ],
            structuredContent: result,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Tool ${spec.name} failed: ${message}`,
              },
            ],
          };
        }
      }
    );
  }

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
