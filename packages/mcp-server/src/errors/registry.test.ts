import { describe, it, expect } from 'vitest';
import {
  createError,
  isRetryable,
  getDefinition,
  allCodes,
  LEGACY_CODE_MAP,
  type StructuredError,
  type ErrorDefinition,
} from './registry.js';

describe('Error Registry', () => {
  // ── Registry integrity ─────────────────────────────────────────────────
  it('contains at least 40 registered error codes', () => {
    expect(allCodes().length).toBeGreaterThanOrEqual(40);
  });

  it('every definition has code, category, message, retryable', () => {
    for (const def of allCodes()) {
      expect(def.code).toMatch(/^OODS-[VNCSRR]\d{3}$/);
      expect(['validation', 'not_found', 'conflict', 'server_error', 'rate_limit']).toContain(def.category);
      expect(typeof def.message).toBe('string');
      expect(def.message.length).toBeGreaterThan(0);
      expect(typeof def.retryable).toBe('boolean');
    }
  });

  it('code prefixes match categories', () => {
    const prefixMap: Record<string, string[]> = {
      V: ['validation'],
      N: ['not_found'],
      C: ['conflict'],
      S: ['server_error'],
      R: ['rate_limit'],
    };
    for (const def of allCodes()) {
      const prefix = def.code.charAt(5); // OODS-X
      const expected = prefixMap[prefix];
      expect(expected).toBeDefined();
      expect(expected).toContain(def.category);
    }
  });

  it('no duplicate codes', () => {
    const codes = allCodes().map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  // ── getDefinition ──────────────────────────────────────────────────────
  it('returns definition for known code', () => {
    const def = getDefinition('OODS-V001');
    expect(def).toBeDefined();
    expect(def!.category).toBe('validation');
    expect(def!.message).toBe('Input validation failed');
  });

  it('returns undefined for unknown code', () => {
    expect(getDefinition('OODS-Z999')).toBeUndefined();
  });

  // ── isRetryable ────────────────────────────────────────────────────────
  it('returns true for retryable codes', () => {
    expect(isRetryable('OODS-R001')).toBe(true);   // rate limit
    expect(isRetryable('OODS-R002')).toBe(true);   // concurrency
    expect(isRetryable('OODS-S002')).toBe(true);   // timeout
    expect(isRetryable('OODS-N003')).toBe(true);   // schemaRef not found
    expect(isRetryable('OODS-N004')).toBe(true);   // schemaRef expired
  });

  it('returns false for non-retryable codes', () => {
    expect(isRetryable('OODS-S001')).toBe(false);  // policy denied
    expect(isRetryable('OODS-N001')).toBe(false);  // unknown tool
    expect(isRetryable('OODS-V101')).toBe(false);  // unsafe path
  });

  it('returns false for unknown codes', () => {
    expect(isRetryable('OODS-Z999')).toBe(false);
  });

  // ── createError ────────────────────────────────────────────────────────
  it('creates structured error from registered code', () => {
    const err = createError('OODS-V001', { details: { field: 'name' } });
    expect(err.code).toBe('OODS-V001');
    expect(err.category).toBe('validation');
    expect(err.message).toBe('Input validation failed');
    expect(err.retryable).toBe(true);
    expect(err.details).toEqual({ field: 'name' });
    expect(err.incidentId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('allows message override', () => {
    const err = createError('OODS-V001', { message: 'Custom message' });
    expect(err.message).toBe('Custom message');
    expect(err.code).toBe('OODS-V001');
  });

  it('creates fallback error for unknown code', () => {
    const err = createError('OODS-Z999');
    expect(err.code).toBe('OODS-Z999');
    expect(err.category).toBe('server_error');
    expect(err.retryable).toBe(false);
    expect(err.message).toContain('Unknown error code');
  });

  it('every error has unique incidentId', () => {
    const a = createError('OODS-V001');
    const b = createError('OODS-V001');
    expect(a.incidentId).not.toBe(b.incidentId);
  });

  // ── Legacy bridge ──────────────────────────────────────────────────────
  it('maps all legacy ERROR_CODES to OODS codes', () => {
    const expected = ['SCHEMA_INPUT', 'SCHEMA_OUTPUT', 'UNKNOWN_TOOL', 'POLICY_DENIED', 'TIMEOUT', 'BAD_REQUEST', 'RATE_LIMIT', 'CONCURRENCY'];
    for (const key of expected) {
      expect(LEGACY_CODE_MAP[key]).toBeDefined();
      expect(LEGACY_CODE_MAP[key]).toMatch(/^OODS-/);
      expect(getDefinition(LEGACY_CODE_MAP[key])).toBeDefined();
    }
  });

  // ── Category coverage ──────────────────────────────────────────────────
  it('has codes in every category', () => {
    const categories = new Set(allCodes().map((d) => d.category));
    expect(categories).toContain('validation');
    expect(categories).toContain('not_found');
    expect(categories).toContain('conflict');
    expect(categories).toContain('server_error');
    expect(categories).toContain('rate_limit');
  });
});
