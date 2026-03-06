/**
 * Viz object auto-binding tests (s74-m06).
 *
 * Verifies that viz.compose with an object auto-binds schema fields
 * to chart data encodings based on field types and semantics.
 */
import { describe, it, expect } from 'vitest';
import { handle } from '../../src/tools/viz.compose.js';
import { inferDataBindings } from '../../src/compose/viz-trait-resolver.js';
import type { FieldDefinition } from '../../src/objects/types.js';

/* ------------------------------------------------------------------ */
/*  inferDataBindings unit tests                                       */
/* ------------------------------------------------------------------ */

describe('inferDataBindings', () => {
  it('maps temporal field to x, numeric to y, enum to color', () => {
    const fields: Record<string, FieldDefinition> = {
      occurred_at: { type: 'datetime', required: true, description: 'When' },
      amount: { type: 'number', required: true, description: 'Amount' },
      status: {
        type: 'string',
        required: true,
        description: 'Status',
        validation: { enum: ['pending', 'settled', 'failed'] },
      },
    };
    const result = inferDataBindings(fields);
    expect(result.dataBindings.x).toBe('occurred_at');
    expect(result.dataBindings.y).toBe('amount');
    expect(result.dataBindings.color).toBe('status');
    expect(result.fieldsMapped).toContain('occurred_at');
    expect(result.fieldsMapped).toContain('amount');
    expect(result.fieldsMapped).toContain('status');
    expect(result.encodings.length).toBeGreaterThanOrEqual(3);
  });

  it('respects existing user bindings', () => {
    const fields: Record<string, FieldDefinition> = {
      occurred_at: { type: 'datetime', required: true, description: 'When' },
      amount: { type: 'number', required: true, description: 'Amount' },
    };
    const result = inferDataBindings(fields, undefined, { x: 'custom_x' });
    expect(result.dataBindings.x).toBe('custom_x');
    expect(result.dataBindings.y).toBe('amount');
  });

  it('binds second numeric field to size', () => {
    const fields: Record<string, FieldDefinition> = {
      date: { type: 'datetime', required: true, description: 'Date' },
      revenue: { type: 'number', required: true, description: 'Revenue' },
      count: { type: 'number', required: true, description: 'Count' },
    };
    const result = inferDataBindings(fields);
    expect(result.dataBindings.y).toBe('revenue');
    expect(result.dataBindings.size).toBe('count');
  });

  it('uses semantic type hints for classification', () => {
    const fields: Record<string, FieldDefinition> = {
      price: { type: 'number', required: true, description: 'Price' },
      name: { type: 'string', required: true, description: 'Name' },
    };
    const semantics = {
      price: { semantic_type: 'currency' },
      name: { semantic_type: 'identifier' },
    };
    const result = inferDataBindings(fields, semantics);
    expect(result.dataBindings.y).toBe('price');
  });

  it('returns empty when no fields match', () => {
    const fields: Record<string, FieldDefinition> = {
      id: { type: 'uuid', required: true, description: 'ID' },
      name: { type: 'string', required: true, description: 'Name' },
    };
    const result = inferDataBindings(fields);
    expect(result.fieldsMapped).toHaveLength(0);
    expect(result.dataBindings.x).toBeUndefined();
    expect(result.dataBindings.y).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  viz.compose integration — object auto-binding                      */
/* ------------------------------------------------------------------ */

describe('viz.compose — object auto-binding', () => {
  it('Transaction line chart: temporal x, numeric y', async () => {
    const result = await handle({
      object: 'Transaction',
      chartType: 'line',
    });
    expect(result.status).toBe('ok');
    expect(result.meta?.traitsResolved.length).toBeGreaterThan(0);
    expect(result.meta?.encodingsApplied.length).toBeGreaterThan(0);

    // Should have auto-bound temporal field to x-axis
    const chartSlot = result.slots.find(s => s.slotName === 'chart-area');
    expect(chartSlot?.props.xField).toBeDefined();
    expect(chartSlot?.props.yField).toBeDefined();
  });

  it('Product bar chart: auto-binds numeric and categorical fields', async () => {
    const result = await handle({
      object: 'Product',
      chartType: 'bar',
    });
    expect(result.status).toBe('ok');
    expect(result.meta?.traitsResolved.length).toBeGreaterThan(0);
    expect(result.meta?.encodingsApplied.length).toBeGreaterThan(0);

    const chartSlot = result.slots.find(s => s.slotName === 'chart-area');
    expect(chartSlot?.props.xField).toBeDefined();
    expect(chartSlot?.props.yField).toBeDefined();
  });

  it('Organization bar chart: auto-binds employee_count to y-axis', async () => {
    const result = await handle({
      object: 'Organization',
      chartType: 'bar',
    });
    expect(result.status).toBe('ok');
    expect(result.meta?.traitsResolved.length).toBeGreaterThan(0);

    const chartSlot = result.slots.find(s => s.slotName === 'chart-area');
    expect(chartSlot?.props.yField).toBeDefined();
  });

  it('explicit dataBindings override auto-binding', async () => {
    const result = await handle({
      object: 'Transaction',
      chartType: 'line',
      dataBindings: { x: 'custom_date', y: 'custom_amount' },
    });
    expect(result.status).toBe('ok');
    const chartSlot = result.slots.find(s => s.slotName === 'chart-area');
    expect(chartSlot?.props.xField).toBe('custom_date');
    expect(chartSlot?.props.yField).toBe('custom_amount');
  });

  it('without object, no auto-binding occurs', async () => {
    const result = await handle({
      chartType: 'bar',
    });
    expect(result.status).toBe('ok');
    const chartSlot = result.slots.find(s => s.slotName === 'chart-area');
    expect(chartSlot?.props.xField).toBeUndefined();
    expect(chartSlot?.props.yField).toBeUndefined();
  });
});
