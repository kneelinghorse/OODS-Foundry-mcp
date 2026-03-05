import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { getAjv } from './lib/ajv.js';
import { ERROR_CODES, err, formatValidationErrors, type TypedError } from './security/errors.js';
import { formatSchemaInputError } from './security/schema-errors.js';
import { isAllowed, tryAcquireSlot, releaseSlot, tryConsumeToken, timeoutMsFor } from './security/policy.js';
import { resolveToolRegistry } from './tools/registry.js';
import { isToolError } from './errors/tool-error.js';
import { LEGACY_CODE_MAP } from './errors/registry.js';

type ResponseMeta = { requestId: string; latency: number; timestamp: string };
function buildMeta(requestId: string, startMs: number): ResponseMeta {
  return { requestId, latency: Math.max(0, Date.now() - startMs), timestamp: new Date().toISOString() };
}

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
  'pipeline': {
    modulePath: './tools/pipeline.js',
    inputSchema: './schemas/pipeline.input.json',
    outputSchema: './schemas/pipeline.output.json',
  },
  'health': {
    modulePath: './tools/health.js',
    inputSchema: './schemas/health.input.json',
    outputSchema: './schemas/health.output.json',
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
  'object.list': {
    modulePath: './tools/object.list.js',
    inputSchema: './schemas/object.list.input.json',
    outputSchema: './schemas/object.list.output.json',
  },
  'object.show': {
    modulePath: './tools/object.show.js',
    inputSchema: './schemas/object.show.input.json',
    outputSchema: './schemas/object.show.output.json',
  },
  'schema.save': {
    modulePath: './tools/schema/save.js',
    inputSchema: './schemas/schema.save.input.json',
    outputSchema: './schemas/schema.save.output.json',
  },
  'schema.load': {
    modulePath: './tools/schema/load.js',
    inputSchema: './schemas/schema.load.input.json',
    outputSchema: './schemas/schema.load.output.json',
  },
  'schema.list': {
    modulePath: './tools/schema/list.js',
    inputSchema: './schemas/schema.list.input.json',
    outputSchema: './schemas/schema.list.output.json',
  },
  'schema.delete': {
    modulePath: './tools/schema/delete.js',
    inputSchema: './schemas/schema.delete.input.json',
    outputSchema: './schemas/schema.delete.output.json',
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
      const requestId = randomUUID();
      const startMs = Date.now();
      try {
        const msg = JSON.parse(line);
        const { id, tool, input, role: roleRaw } = msg as { id?: string | number; tool: string; input: unknown; role?: string };
        messageId = id;
        if (!tool || !tools[tool]) {
          process.stdout.write(JSON.stringify({ id, error: { ...err(ERROR_CODES.UNKNOWN_TOOL, `Unknown tool: ${tool}`), code: LEGACY_CODE_MAP.UNKNOWN_TOOL }, meta: buildMeta(requestId, startMs) }) + '\n');
          continue;
        }
        const role = String(roleRaw || process.env.MCP_ROLE || 'designer');
        // Policy: allow/deny
        const allow = isAllowed(tool, role);
        if (!allow.allowed) {
          const e = { ...err(ERROR_CODES.POLICY_DENIED, `Role '${role}' not allowed for tool '${tool}'`, { tool, role, allow: allow?.rule?.allow ?? [] }), code: LEGACY_CODE_MAP.POLICY_DENIED };
          process.stdout.write(JSON.stringify({ id, error: e, meta: buildMeta(requestId, startMs) }) + '\n');
          continue;
        }
        // Rate limit token bucket
        if (!tryConsumeToken(tool)) {
          const e = { ...err(ERROR_CODES.RATE_LIMIT, `Rate limit exceeded for tool '${tool}'`, { tool }), code: LEGACY_CODE_MAP.RATE_LIMIT };
          process.stdout.write(JSON.stringify({ id, error: e, meta: buildMeta(requestId, startMs) }) + '\n');
          continue;
        }
        // Concurrency guard
        if (!tryAcquireSlot(tool)) {
          const e = { ...err(ERROR_CODES.CONCURRENCY, `Too many concurrent requests for tool '${tool}'`, { tool }), code: LEGACY_CODE_MAP.CONCURRENCY };
          process.stdout.write(JSON.stringify({ id, error: e, meta: buildMeta(requestId, startMs) }) + '\n');
          continue;
        }
        try {
          const reg = tools[tool];
          const validateIn = ajv.compile(reg.inputSchema);
          if (!validateIn(input)) {
            const formatted = formatSchemaInputError(tool, validateIn.errors as any);
            const details: Record<string, unknown> = { errors: formatted.details };
            if (formatted.hint) details.hint = formatted.hint;
            if (formatted.expected) details.expected = formatted.expected;
            const e = { ...err(ERROR_CODES.SCHEMA_INPUT, formatted.message, details), code: LEGACY_CODE_MAP.SCHEMA_INPUT };
            process.stdout.write(JSON.stringify({ id, error: e, meta: buildMeta(requestId, startMs) }) + '\n');
            continue;
          }
          const timeout = timeoutMsFor(tool);
          const result = await Promise.race([
            reg.handle(input),
            new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(err(ERROR_CODES.TIMEOUT, `Timeout after ${timeout}ms`, { timeoutMs: timeout }), { code: LEGACY_CODE_MAP.TIMEOUT })), timeout))
          ]);
          const validateOut = ajv.compile(reg.outputSchema);
          if (!validateOut(result)) {
            const formatted = formatValidationErrors(validateOut.errors as any, { prefix: 'Output validation failed' });
            const e = { ...err(ERROR_CODES.SCHEMA_OUTPUT, formatted.message, { errors: formatted.details }), code: LEGACY_CODE_MAP.SCHEMA_OUTPUT };
            process.stdout.write(JSON.stringify({ id, error: e, meta: buildMeta(requestId, startMs) }) + '\n');
            continue;
          }
          process.stdout.write(JSON.stringify({ id, result, meta: buildMeta(requestId, startMs) }) + '\n');
        } finally {
          releaseSlot(tool);
        }
      } catch (e: any) {
        let te: TypedError;
        if (isToolError(e)) {
          const se = e.toStructured();
          te = { code: se.code, message: se.message, details: { category: se.category, retryable: se.retryable, ...(se.details != null ? { context: se.details } : {}) }, incidentId: se.incidentId };
        } else {
          te = err(ERROR_CODES.BAD_REQUEST, String(e?.message || e));
        }
        const payload: { id?: string | number; error: TypedError; meta: ResponseMeta } = { error: te, meta: buildMeta(requestId, startMs) };
        if (messageId !== undefined) {
          payload.id = messageId;
        }
        process.stdout.write(JSON.stringify(payload) + '\n');
      }
    }
  });
}

await Promise.all([startHealthServer(), stdioLoop()]);
