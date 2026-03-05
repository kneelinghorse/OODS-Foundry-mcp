import type { UiSchema } from '../../schemas/generated.js';
import type { SchemaRecord } from '../../schema-store/types.js';
import { SchemaStore } from '../../schema-store/index.js';
import { resolveSchemaRef } from '../schema-ref.js';

export type SchemaSaveInput = {
  name: string;
  schemaRef: string;
  tags?: string[];
  author?: string;
};

export type SchemaSaveOutput = {
  name: string;
  version: number;
  object?: string;
  context?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
};

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const CONTEXT_KEYWORDS = ['detail', 'list', 'form', 'timeline', 'card', 'inline'] as const;

function titleCase(value: string): string {
  if (!value) return value;
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function detectContextFromText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  return CONTEXT_KEYWORDS.find((context) => lower.includes(context));
}

function inferContext(schema: UiSchema): string | undefined {
  for (const screen of schema.screens) {
    const routeContext = detectContextFromText(screen.route);
    if (routeContext) return routeContext;
    const intentContext = detectContextFromText(screen.meta?.intent);
    if (intentContext) return intentContext;
  }
  return undefined;
}

function inferObject(schema: UiSchema): string | undefined {
  const candidates: string[] = [];

  if (schema.objectSchema) {
    for (const field of Object.values(schema.objectSchema)) {
      const semanticType = field.semanticType;
      if (!semanticType) continue;
      const parts = semanticType.split('.').filter(Boolean);
      if (parts.length >= 2) {
        candidates.push(titleCase(parts[1]));
      }
    }
  }

  if (schema.tokenOverrides) {
    for (const key of Object.keys(schema.tokenOverrides)) {
      const parts = key.split('.').filter(Boolean);
      if (parts.length >= 2) {
        candidates.push(titleCase(parts[1]));
      }
    }
  }

  if (!candidates.length) return undefined;

  const counts = new Map<string, number>();
  for (const value of candidates) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

function toOutput(record: SchemaRecord): SchemaSaveOutput {
  return {
    name: record.name,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    tags: record.tags,
    ...(record.object ? { object: record.object } : {}),
    ...(record.context ? { context: record.context } : {}),
    ...(record.author ? { author: record.author } : {}),
  };
}

function getStore(): SchemaStore {
  const projectRoot = process.env.MCP_SCHEMA_STORE_ROOT;
  const storeDir = process.env.MCP_SCHEMA_STORE_DIR;
  return new SchemaStore({
    ...(projectRoot ? { projectRoot } : {}),
    ...(storeDir ? { storeDir } : {}),
  });
}

export async function handle(input: SchemaSaveInput): Promise<SchemaSaveOutput> {
  if (!input.name?.trim()) {
    throw new Error('name is required.');
  }
  if (!NAME_PATTERN.test(input.name)) {
    throw new Error('name must use slug format: letters, numbers, hyphens, and underscores only.');
  }
  if (!input.schemaRef?.trim()) {
    throw new Error('schemaRef is required.');
  }

  const resolved = resolveSchemaRef(input.schemaRef);
  if (!resolved.ok) {
    throw new Error(
      `schemaRef '${input.schemaRef}' is ${resolved.reason}. Run design.compose again to obtain a fresh schemaRef.`,
    );
  }

  const store = getStore();
  const record = await store.save({
    name: input.name,
    schemaRef: input.schemaRef,
    tags: input.tags,
    author: input.author,
    object: inferObject(resolved.schema),
    context: inferContext(resolved.schema),
  });

  return toOutput(record);
}
