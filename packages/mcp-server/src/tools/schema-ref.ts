import crypto from 'node:crypto';
import type { UiSchema } from '../schemas/generated.js';

type SchemaRefRecord = {
  ref: string;
  schema: UiSchema;
  source: string;
  createdAt: string;
  expiresAt: string;
  createdAtMs: number;
  expiresAtMs: number;
};

const CACHE = new Map<string, SchemaRefRecord>();

function ttlMs(): number {
  const raw = process.env.MCP_SCHEMA_REF_TTL_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30 * 60 * 1000;
  }
  return parsed;
}

function maxEntries(): number {
  const raw = process.env.MCP_SCHEMA_REF_MAX;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 250;
  }
  return parsed;
}

function nowMs(): number {
  return Date.now();
}

function iso(ts: number): string {
  return new Date(ts).toISOString();
}

function pruneExpired(now = nowMs()): void {
  for (const [ref, record] of CACHE.entries()) {
    if (record.expiresAtMs <= now) {
      CACHE.delete(ref);
    }
  }
}

function pruneOverflow(): void {
  const limit = maxEntries();
  if (CACHE.size <= limit) return;
  const records = Array.from(CACHE.values()).sort((a, b) => a.createdAtMs - b.createdAtMs);
  const overflow = records.length - limit;
  for (let i = 0; i < overflow; i += 1) {
    CACHE.delete(records[i].ref);
  }
}

function buildRef(source: string): string {
  const suffix = crypto.randomUUID().split('-')[0];
  return `${source}-${suffix}`;
}

export function createSchemaRef(schema: UiSchema, source = 'compose'): SchemaRefRecord {
  const createdAtMs = nowMs();
  const expiresAtMs = createdAtMs + ttlMs();
  const record: SchemaRefRecord = {
    ref: buildRef(source),
    schema: structuredClone(schema),
    source,
    createdAt: iso(createdAtMs),
    expiresAt: iso(expiresAtMs),
    createdAtMs,
    expiresAtMs,
  };
  pruneExpired(createdAtMs);
  CACHE.set(record.ref, record);
  pruneOverflow();
  return record;
}

export function resolveSchemaRef(ref: string): { ok: true; record: SchemaRefRecord; schema: UiSchema } | { ok: false; reason: 'missing' | 'expired' } {
  const now = nowMs();
  pruneExpired(now);
  const record = CACHE.get(ref);
  if (!record) {
    return { ok: false, reason: 'missing' };
  }
  if (record.expiresAtMs <= now) {
    CACHE.delete(ref);
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, record, schema: structuredClone(record.schema) };
}

export function describeSchemaRef(record: SchemaRefRecord): Pick<SchemaRefRecord, 'ref' | 'source' | 'createdAt' | 'expiresAt'> {
  return {
    ref: record.ref,
    source: record.source,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}
