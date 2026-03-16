/**
 * computeTtlWarning unit tests (s86-m03).
 */
import { describe, it, expect } from 'vitest';
import { computeTtlWarning, createSchemaRef, type SchemaRefRecord } from './schema-ref.js';

function makeRecord(expiresInMs: number): SchemaRefRecord {
  const now = Date.now();
  const schema = { version: '2026.02' as const, screens: [{ id: 'test', component: 'Box' }] };
  const record = createSchemaRef(schema, 'test');
  // Override expiry to control TTL
  record.expiresAtMs = now + expiresInMs;
  record.expiresAt = new Date(record.expiresAtMs).toISOString();
  return record;
}

describe('computeTtlWarning', () => {
  it('returns undefined when TTL is healthy (> 5 minutes)', () => {
    const record = makeRecord(10 * 60 * 1000); // 10 min
    expect(computeTtlWarning(record)).toBeUndefined();
  });

  it('returns undefined when TTL is exactly at threshold boundary (> 5 min)', () => {
    const record = makeRecord(5 * 60 * 1000 + 1); // 5 min + 1ms
    expect(computeTtlWarning(record)).toBeUndefined();
  });

  it('returns warning when TTL is under 5 minutes', () => {
    const record = makeRecord(4 * 60 * 1000); // 4 min
    const warning = computeTtlWarning(record);
    expect(warning).toBeDefined();
    expect(warning!.message).toContain(record.ref);
    expect(warning!.remainingMs).toBeLessThanOrEqual(4 * 60 * 1000);
    expect(warning!.recommendation).toContain('schema.save');
  });

  it('returns warning when TTL is exactly 5 minutes', () => {
    const record = makeRecord(5 * 60 * 1000); // exactly 5 min
    const warning = computeTtlWarning(record);
    expect(warning).toBeDefined();
  });

  it('returns warning when TTL is 1 minute', () => {
    const record = makeRecord(60 * 1000); // 1 min
    const warning = computeTtlWarning(record);
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('1 minute');
  });

  it('returns warning when TTL is 30 seconds', () => {
    const record = makeRecord(30 * 1000);
    const warning = computeTtlWarning(record);
    expect(warning).toBeDefined();
    expect(warning!.remainingMs).toBeLessThanOrEqual(30 * 1000);
  });

  it('returns expired warning when TTL is 0', () => {
    const record = makeRecord(0);
    const warning = computeTtlWarning(record);
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('expired');
    expect(warning!.remainingMs).toBe(0);
  });

  it('returns expired warning when TTL is negative (already expired)', () => {
    const record = makeRecord(-1000);
    const warning = computeTtlWarning(record);
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('expired');
    expect(warning!.remainingMs).toBe(0);
  });

  it('includes actionable recommendation', () => {
    const record = makeRecord(2 * 60 * 1000);
    const warning = computeTtlWarning(record);
    expect(warning!.recommendation).toMatch(/schema\.save|re-compose/);
  });
});
