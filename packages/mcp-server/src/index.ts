import fs from 'node:fs';
import Fastify from 'fastify';
import { getAjv } from './lib/ajv.js';
import { ERROR_CODES, err, type TypedError } from './security/errors.js';
import { isAllowed, tryAcquireSlot, releaseSlot, tryConsumeToken, timeoutMsFor } from './security/policy.js';
import { resolveToolRegistry } from './tools/registry.js';

// Tool registry
const tools: Record<string, { handle: (input: any) => Promise<any>; inputSchema: object; outputSchema: object }> = {};

function register(
  name: string,
  mod: { handle: (input: any) => Promise<any> },
  inputSchema: object,
  outputSchema: object
) {
  tools[name] = { handle: mod.handle, inputSchema, outputSchema };
}

type ToolSpec = { modulePath: string; inputSchema: string; outputSchema: string };

const toolSpecs: Record<string, ToolSpec> = {
  'tokens.build': {
    modulePath: './tools/tokens.build.js',
    inputSchema: './schemas/tokens.build.input.json',
    outputSchema: './schemas/generic.output.json',
  },
  'structuredData.fetch': {
    modulePath: './tools/structuredData.fetch.js',
    inputSchema: './schemas/structuredData.fetch.input.json',
    outputSchema: './schemas/structuredData.fetch.output.json',
  },
  'repl.validate': {
    modulePath: './tools/repl.validate.js',
    inputSchema: './schemas/repl.validate.input.json',
    outputSchema: './schemas/repl.validate.output.json',
  },
  'repl.render': {
    modulePath: './tools/repl.render.js',
    inputSchema: './schemas/repl.render.input.json',
    outputSchema: './schemas/repl.render.output.json',
  },
  'brand.apply': {
    modulePath: './tools/brand.apply.js',
    inputSchema: './schemas/brand.apply.input.json',
    outputSchema: './schemas/brand.apply.output.json',
  },
  'a11y.scan': {
    modulePath: './tools/a11y.scan.js',
    inputSchema: './schemas/a11y.scan.input.json',
    outputSchema: './schemas/generic.output.json',
  },
  'purity.audit': {
    modulePath: './tools/purity.audit.js',
    inputSchema: './schemas/generic.input.json',
    outputSchema: './schemas/generic.output.json',
  },
  'vrt.run': {
    modulePath: './tools/vrt.run.js',
    inputSchema: './schemas/generic.input.json',
    outputSchema: './schemas/generic.output.json',
  },
  'reviewKit.create': {
    modulePath: './tools/reviewKit.create.js',
    inputSchema: './schemas/generic.input.json',
    outputSchema: './schemas/generic.output.json',
  },
  'diag.snapshot': {
    modulePath: './tools/diag.snapshot.js',
    inputSchema: './schemas/generic.input.json',
    outputSchema: './schemas/generic.output.json',
  },
  'release.verify': {
    modulePath: './tools/release.verify.js',
    inputSchema: './schemas/release.verify.input.json',
    outputSchema: './schemas/release.verify.output.json',
  },
  'release.tag': {
    modulePath: './tools/release.tag.js',
    inputSchema: './schemas/release.tag.input.json',
    outputSchema: './schemas/release.tag.output.json',
  },
  'billing.reviewKit': {
    modulePath: './tools/billing.reviewKit.js',
    inputSchema: './schemas/billing.reviewKit.input.json',
    outputSchema: './schemas/generic.output.json',
  },
  'billing.switchFixtures': {
    modulePath: './tools/billing.switchFixtures.js',
    inputSchema: './schemas/billing.switchFixtures.input.json',
    outputSchema: './schemas/generic.output.json',
  },
  'catalog.list': {
    modulePath: './tools/catalog.list.js',
    inputSchema: './schemas/catalog.list.input.json',
    outputSchema: './schemas/catalog.list.output.json',
  },
  'code.generate': {
    modulePath: './tools/code.generate.js',
    inputSchema: './schemas/code.generate.input.json',
    outputSchema: './schemas/code.generate.output.json',
  },
  'design.compose': {
    modulePath: './tools/design.compose.js',
    inputSchema: './schemas/design.compose.input.json',
    outputSchema: './schemas/design.compose.output.json',
  },
  'map.create': {
    modulePath: './tools/map.create.js',
    inputSchema: './schemas/map.create.input.json',
    outputSchema: './schemas/map.create.output.json',
  },
  'map.list': {
    modulePath: './tools/map.list.js',
    inputSchema: './schemas/map.list.input.json',
    outputSchema: './schemas/map.list.output.json',
  },
  'map.resolve': {
    modulePath: './tools/map.resolve.js',
    inputSchema: './schemas/map.resolve.input.json',
    outputSchema: './schemas/map.resolve.output.json',
  },
};

const schemaCache = new Map<string, object>();
function readSchema(relativePath: string): object {
  const cached = schemaCache.get(relativePath);
  if (cached) return cached;
  const schema = JSON.parse(fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as object;
  schemaCache.set(relativePath, schema);
  return schema;
}

const registry = resolveToolRegistry();
if (registry.unknownExtras.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(`[mcp] unknown MCP_EXTRA_TOOLS entries ignored: ${registry.unknownExtras.join(', ')}`);
}

for (const name of registry.enabled) {
  const spec = toolSpecs[name];
  if (!spec) {
    // eslint-disable-next-line no-console
    console.warn(`[mcp] tool '${name}' missing from toolSpecs registry`);
    continue;
  }
  register(name, await import(spec.modulePath), readSchema(spec.inputSchema), readSchema(spec.outputSchema));
}

// Validator
const ajv = getAjv();

// Health/debug server (optional)
const fastify = Fastify({ logger: false });
fastify.get('/health', async () => ({ status: 'ok', tools: Object.keys(tools) }));

async function startHealthServer() {
  const port = Number(process.env.MCP_HEALTH_PORT || 0);
  if (!port) return;
  try {
    await fastify.listen({ port, host: '127.0.0.1' });
    // eslint-disable-next-line no-console
    console.log(`[mcp] health server on :${port}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[mcp] health server failed', err);
  }
}

// Minimal stdio loop: each line is a JSON object { id, tool, input }
async function stdioLoop() {
  process.stdin.setEncoding('utf8');
  let buffer = '';
  process.stdin.on('data', async (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let messageId: string | number | undefined;
      try {
        const msg = JSON.parse(line);
        const { id, tool, input, role: roleRaw } = msg as { id?: string | number; tool: string; input: unknown; role?: string };
        messageId = id;
        if (!tool || !tools[tool]) {
          process.stdout.write(JSON.stringify({ id, error: err(ERROR_CODES.UNKNOWN_TOOL, `Unknown tool: ${tool}`) }) + '\n');
          continue;
        }
        const role = String(roleRaw || process.env.MCP_ROLE || 'designer');
        // Policy: allow/deny
        const allow = isAllowed(tool, role);
        if (!allow.allowed) {
          const e = err(ERROR_CODES.POLICY_DENIED, `Role '${role}' not allowed for tool '${tool}'`, { tool, role, allow: allow?.rule?.allow ?? [] });
          process.stdout.write(JSON.stringify({ id, error: e }) + '\n');
          continue;
        }
        // Rate limit token bucket
        if (!tryConsumeToken(tool)) {
          const e = err(ERROR_CODES.RATE_LIMIT, `Rate limit exceeded for tool '${tool}'`, { tool });
          process.stdout.write(JSON.stringify({ id, error: e }) + '\n');
          continue;
        }
        // Concurrency guard
        if (!tryAcquireSlot(tool)) {
          const e = err(ERROR_CODES.CONCURRENCY, `Too many concurrent requests for tool '${tool}'`, { tool });
          process.stdout.write(JSON.stringify({ id, error: e }) + '\n');
          continue;
        }
        try {
          const reg = tools[tool];
          const validateIn = ajv.compile(reg.inputSchema);
          if (!validateIn(input)) {
            const e: TypedError = err(ERROR_CODES.SCHEMA_INPUT, 'Input validation failed', { errors: validateIn.errors });
            process.stdout.write(JSON.stringify({ id, error: e }) + '\n');
            continue;
          }
          const timeout = timeoutMsFor(tool);
          const result = await Promise.race([
            reg.handle(input),
            new Promise<never>((_, reject) => setTimeout(() => reject(err(ERROR_CODES.TIMEOUT, `Timeout after ${timeout}ms`, { timeoutMs: timeout })), timeout))
          ]);
          const validateOut = ajv.compile(reg.outputSchema);
          if (!validateOut(result)) {
            const e: TypedError = err(ERROR_CODES.SCHEMA_OUTPUT, 'Output validation failed', { errors: validateOut.errors });
            process.stdout.write(JSON.stringify({ id, error: e }) + '\n');
            continue;
          }
          process.stdout.write(JSON.stringify({ id, result }) + '\n');
        } finally {
          releaseSlot(tool);
        }
      } catch (e: any) {
        const te: TypedError = err(ERROR_CODES.BAD_REQUEST, String(e?.message || e));
        const payload: { id?: string | number; error: TypedError } = { error: te };
        if (messageId !== undefined) {
          payload.id = messageId;
        }
        process.stdout.write(JSON.stringify(payload) + '\n');
      }
    }
  });
}

await Promise.all([startHealthServer(), stdioLoop()]);
