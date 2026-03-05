#!/usr/bin/env tsx
/**
 * Auto-generate per-tool API reference markdown from JSON schemas
 * and tool-descriptions.json.
 *
 * Usage: pnpm run docs:api
 * Output: docs/api/<tool-name>.md + docs/api/README.md
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SCHEMAS_DIR = path.join(ROOT, 'packages/mcp-server/src/schemas');
const DESCRIPTIONS_PATH = path.join(ROOT, 'packages/mcp-adapter/tool-descriptions.json');
const REGISTRY_PATH = path.join(ROOT, 'packages/mcp-server/src/tools/registry.json');
const OUT_DIR = path.join(ROOT, 'docs/api');

type JsonSchema = {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: string;
  required?: string[];
  anyOf?: Array<{ required?: string[] }>;
  properties?: Record<string, JsonSchemaProperty>;
  additionalProperties?: boolean | object;
  items?: JsonSchemaProperty;
};

type JsonSchemaProperty = {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
  additionalProperties?: boolean | JsonSchemaProperty;
  $ref?: string;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function formatType(prop: JsonSchemaProperty): string {
  if (prop.enum) return prop.enum.map((v) => `\`${v}\``).join(' \\| ');
  if (prop.$ref) return `_ref_`;
  if (prop.type === 'array') {
    const itemType = prop.items ? formatType(prop.items) : 'unknown';
    return `${itemType}[]`;
  }
  if (prop.type === 'object') {
    if (prop.additionalProperties && typeof prop.additionalProperties === 'object') {
      return `Record<string, ${formatType(prop.additionalProperties as JsonSchemaProperty)}>`;
    }
    return 'object';
  }
  if (Array.isArray(prop.type)) return prop.type.join(' \\| ');
  return prop.type ?? 'any';
}

function formatDefault(prop: JsonSchemaProperty): string {
  if (prop.default === undefined) return '';
  return `\`${JSON.stringify(prop.default)}\``;
}

function buildParamsTable(schema: JsonSchema): string {
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return '_No parameters._\n';
  }

  const requiredSet = new Set(schema.required ?? []);
  // Also check anyOf required
  if (schema.anyOf) {
    for (const clause of schema.anyOf) {
      if (clause.required) clause.required.forEach((r) => requiredSet.add(r));
    }
  }

  const lines: string[] = [
    '| Parameter | Type | Required | Default | Description |',
    '|-----------|------|----------|---------|-------------|',
  ];

  for (const [name, prop] of Object.entries(schema.properties)) {
    const req = requiredSet.has(name) ? 'Yes' : 'No';
    const type = formatType(prop);
    const def = formatDefault(prop);
    const desc = prop.description ?? '';
    lines.push(`| \`${name}\` | ${type} | ${req} | ${def} | ${desc} |`);

    // Expand nested objects one level
    if (prop.properties) {
      for (const [subName, subProp] of Object.entries(prop.properties)) {
        const subReq = (prop as JsonSchema).required?.includes(subName) ? 'Yes' : 'No';
        const subType = formatType(subProp);
        const subDef = formatDefault(subProp);
        const subDesc = subProp.description ?? '';
        lines.push(`| \`${name}.${subName}\` | ${subType} | ${subReq} | ${subDef} | ${subDesc} |`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

function buildOutputShape(schema: JsonSchema): string {
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return '_See tool response._\n';
  }

  const requiredSet = new Set(schema.required ?? []);
  const lines: string[] = [
    '| Field | Type | Always Present | Description |',
    '|-------|------|----------------|-------------|',
  ];

  for (const [name, prop] of Object.entries(schema.properties)) {
    const always = requiredSet.has(name) ? 'Yes' : 'No';
    const type = formatType(prop);
    const desc = prop.description ?? '';
    lines.push(`| \`${name}\` | ${type} | ${always} | ${desc} |`);
  }

  return lines.join('\n') + '\n';
}

function toolSlug(toolName: string): string {
  return toolName.replace(/\./g, '-');
}

function buildErrorCodes(toolName: string): string {
  // Common error codes that apply to all tools
  const common = [
    { code: 'OODS-V001', desc: 'Input validation failed' },
    { code: 'OODS-S001', desc: 'Internal server error' },
  ];

  // Tool-specific codes
  const specific: Record<string, Array<{ code: string; desc: string }>> = {
    'design.compose': [
      { code: 'OODS-V006', desc: 'Unknown component during slot selection' },
      { code: 'OODS-N001', desc: 'Object not found in registry' },
    ],
    'repl.validate': [
      { code: 'OODS-V007', desc: 'DSL schema validation failed' },
      { code: 'OODS-V009', desc: 'Missing schema' },
      { code: 'OODS-N002', desc: 'Schema ref not found or expired' },
    ],
    'repl.render': [
      { code: 'OODS-V006', desc: 'Unknown component (no renderer)' },
      { code: 'OODS-N002', desc: 'Schema ref not found or expired' },
    ],
    'code.generate': [
      { code: 'OODS-V005', desc: 'Unknown framework' },
      { code: 'OODS-V006', desc: 'Unknown component (no emitter)' },
      { code: 'OODS-N002', desc: 'Schema ref not found or expired' },
    ],
    'schema.save': [
      { code: 'OODS-V004', desc: 'Invalid slug format for schema name' },
      { code: 'OODS-N002', desc: 'Schema ref not found or expired' },
    ],
    'schema.load': [
      { code: 'OODS-N003', desc: 'Saved schema not found' },
    ],
    'schema.delete': [
      { code: 'OODS-N003', desc: 'Saved schema not found' },
    ],
    'object.show': [
      { code: 'OODS-N001', desc: 'Object not found in registry' },
    ],
    'map.create': [
      { code: 'OODS-V001', desc: 'Invalid mapping definition' },
    ],
    'map.resolve': [
      { code: 'OODS-N004', desc: 'Mapping not found' },
    ],
    'map.update': [
      { code: 'OODS-N004', desc: 'Mapping not found' },
    ],
    'map.delete': [
      { code: 'OODS-N004', desc: 'Mapping not found' },
    ],
    'viz.compose': [
      { code: 'OODS-V006', desc: 'Unknown component during slot selection' },
      { code: 'OODS-N001', desc: 'Object not found in registry' },
    ],
  };

  const codes = [...common, ...(specific[toolName] ?? [])];

  const lines = [
    '| Code | Description |',
    '|------|-------------|',
  ];
  for (const { code, desc } of codes) {
    lines.push(`| \`${code}\` | ${desc} |`);
  }

  return lines.join('\n') + '\n';
}

function buildExampleBlock(toolName: string, inputSchema: JsonSchema): string {
  // Build a minimal example from schema properties
  const example: Record<string, unknown> = {};

  if (inputSchema.properties) {
    const requiredSet = new Set(inputSchema.required ?? []);
    // Also check anyOf required — take first clause
    if (inputSchema.anyOf?.[0]?.required) {
      inputSchema.anyOf[0].required.forEach((r) => requiredSet.add(r));
    }

    for (const [name, prop] of Object.entries(inputSchema.properties)) {
      if (!requiredSet.has(name)) continue;
      if (prop.enum) example[name] = prop.enum[0];
      else if (prop.type === 'string') example[name] = `<${name}>`;
      else if (prop.type === 'integer' || prop.type === 'number') example[name] = prop.minimum ?? 0;
      else if (prop.type === 'boolean') example[name] = true;
      else if (prop.type === 'array') example[name] = [];
      else if (prop.type === 'object') example[name] = {};
    }
  }

  return [
    '```json',
    JSON.stringify(example, null, 2),
    '```',
  ].join('\n') + '\n';
}

function generateToolDoc(
  toolName: string,
  description: string,
  inputSchema: JsonSchema,
  outputSchema: JsonSchema,
  tier: 'auto' | 'on-demand',
): string {
  const lines: string[] = [];

  lines.push(`# ${toolName}\n`);
  lines.push(`> ${description}\n`);
  lines.push(`**Registration:** ${tier}\n`);

  lines.push(`## Input Parameters\n`);
  lines.push(buildParamsTable(inputSchema));

  lines.push(`## Output Shape\n`);
  lines.push(buildOutputShape(outputSchema));

  lines.push(`## Error Codes\n`);
  lines.push(buildErrorCodes(toolName));

  lines.push(`## Example Request\n`);
  lines.push(buildExampleBlock(toolName, inputSchema));

  return lines.join('\n');
}

function generateIndex(tools: Array<{ name: string; description: string; tier: string }>): string {
  const lines: string[] = [];

  lines.push(`# OODS Foundry API Reference\n`);
  lines.push(`Auto-generated from JSON schemas and tool-descriptions.json.\n`);

  // Group by tier
  const auto = tools.filter((t) => t.tier === 'auto');
  const onDemand = tools.filter((t) => t.tier === 'on-demand');

  lines.push(`## Auto-registered Tools\n`);
  lines.push('| Tool | Description |');
  lines.push('|------|-------------|');
  for (const t of auto) {
    lines.push(`| [${t.name}](./${toolSlug(t.name)}.md) | ${t.description} |`);
  }
  lines.push('');

  if (onDemand.length > 0) {
    lines.push(`## On-demand Tools\n`);
    lines.push('| Tool | Description |');
    lines.push('|------|-------------|');
    for (const t of onDemand) {
      lines.push(`| [${t.name}](./${toolSlug(t.name)}.md) | ${t.description} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────

const descriptions = readJson<Record<string, string>>(DESCRIPTIONS_PATH);
const registry = readJson<{ auto: string[]; onDemand: string[] }>(REGISTRY_PATH);

const allTools = [
  ...registry.auto.map((name) => ({ name, tier: 'auto' as const })),
  ...registry.onDemand.map((name) => ({ name, tier: 'on-demand' as const })),
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const indexEntries: Array<{ name: string; description: string; tier: string }> = [];
let generated = 0;

for (const { name, tier } of allTools) {
  const inputPath = path.join(SCHEMAS_DIR, `${name}.input.json`);
  const outputPath = path.join(SCHEMAS_DIR, `${name}.output.json`);

  // Some tools use generic schemas
  const inputFallback = path.join(SCHEMAS_DIR, 'generic.input.json');
  const outputFallback = path.join(SCHEMAS_DIR, 'generic.output.json');

  const inputFile = fs.existsSync(inputPath) ? inputPath : (fs.existsSync(inputFallback) ? inputFallback : null);
  const outputFile = fs.existsSync(outputPath) ? outputPath : (fs.existsSync(outputFallback) ? outputFallback : null);

  if (!inputFile) {
    console.warn(`Skipping ${name}: no input schema found`);
    continue;
  }

  const inputSchema = readJson<JsonSchema>(inputFile);
  const outputSchema = outputFile ? readJson<JsonSchema>(outputFile) : { type: 'object' as const, properties: {} };
  const description = descriptions[name] ?? `MCP tool: ${name}`;

  const markdown = generateToolDoc(name, description, inputSchema, outputSchema, tier);
  const outFile = path.join(OUT_DIR, `${toolSlug(name)}.md`);
  fs.writeFileSync(outFile, markdown, 'utf-8');

  indexEntries.push({ name, description, tier });
  generated++;
}

// Write index
const indexMd = generateIndex(indexEntries);
fs.writeFileSync(path.join(OUT_DIR, 'README.md'), indexMd, 'utf-8');

console.log(`Generated ${generated} API reference docs in ${OUT_DIR}`);
console.log(`Index: ${path.join(OUT_DIR, 'README.md')}`);
