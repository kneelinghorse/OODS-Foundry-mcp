/**
 * ORCA v2.1.0 prop compatibility tests.
 *
 * Validates that all ORCA prop type definitions map to valid OODS coercion types
 * and that v2.1.0 payloads (with source + confidence) remain backward-compatible.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveCoercion,
  orcaPropsToMappings,
  auditCompatibility,
  type OrcaPropDef,
  type OrcaInferredPropDef,
} from './orca-prop-compat.js';
import { coerce, normalizeCoercion } from './coercion.js';

// ---------------------------------------------------------------------------
// V2.0.0 prop definitions (baseline)
// ---------------------------------------------------------------------------

const V2_PROPS: Record<string, OrcaPropDef> = {
  title: { type: 'string', required: true },
  value: { type: 'number', required: true },
  trend: { type: 'string', values: ['up', 'down', 'flat'] },
  disabled: { type: 'boolean' },
  tags: { type: 'array' },
  createdAt: { type: 'date' },
};

// ---------------------------------------------------------------------------
// V2.1.0 inferred prop definitions (adds source + confidence)
// ---------------------------------------------------------------------------

const V21_PROPS: Record<string, OrcaInferredPropDef> = {
  title: { type: 'string', required: true, source: 'static_analysis', confidence: 0.95 },
  value: { type: 'number', required: true, source: 'runtime_trace', confidence: 0.88 },
  trend: { type: 'string', values: ['up', 'down', 'flat'], source: 'storybook', confidence: 0.92 },
  disabled: { type: 'boolean', source: 'static_analysis', confidence: 0.99 },
  tags: { type: 'array', source: 'inferred', confidence: 0.65 },
  createdAt: { type: 'date', source: 'inferred', confidence: 0.72 },
};

// ---------------------------------------------------------------------------
// deriveCoercion
// ---------------------------------------------------------------------------

describe('deriveCoercion', () => {
  it('string without values → null (identity)', () => {
    expect(deriveCoercion({ type: 'string' })).toBeNull();
  });

  it('string with values[] → enum coercion', () => {
    const result = deriveCoercion({ type: 'string', values: ['up', 'down', 'flat'] });
    expect(result).toEqual({
      type: 'enum',
      mapping: { up: 'up', down: 'down', flat: 'flat' },
    });
  });

  it('number → null (identity)', () => {
    expect(deriveCoercion({ type: 'number' })).toBeNull();
  });

  it('boolean → boolean_to_string', () => {
    const result = deriveCoercion({ type: 'boolean' });
    expect(result).toEqual({
      type: 'boolean_to_string',
      trueValue: 'true',
      falseValue: 'false',
    });
  });

  it('array → null (identity)', () => {
    expect(deriveCoercion({ type: 'array' })).toBeNull();
  });

  it('date → null (identity)', () => {
    expect(deriveCoercion({ type: 'date' })).toBeNull();
  });

  it('v2.1.0 inferred prop: source and confidence do not affect coercion', () => {
    const v21: OrcaInferredPropDef = {
      type: 'string',
      values: ['a', 'b'],
      source: 'storybook',
      confidence: 0.92,
    };
    const result = deriveCoercion(v21);
    expect(result).toEqual({
      type: 'enum',
      mapping: { a: 'a', b: 'b' },
    });
  });
});

// ---------------------------------------------------------------------------
// orcaPropsToMappings
// ---------------------------------------------------------------------------

describe('orcaPropsToMappings', () => {
  it('converts v2.0.0 props to OODS propMappings', () => {
    const mappings = orcaPropsToMappings(V2_PROPS);
    expect(mappings).toHaveLength(6);

    const titleMapping = mappings.find((m) => m.externalProp === 'title');
    expect(titleMapping?.oodsProp).toBe('title');
    expect(titleMapping?.coercion).toBeUndefined(); // identity → no coercion field

    const trendMapping = mappings.find((m) => m.externalProp === 'trend');
    expect(trendMapping?.coercion?.type).toBe('enum');

    const disabledMapping = mappings.find((m) => m.externalProp === 'disabled');
    expect(disabledMapping?.coercion?.type).toBe('boolean_to_string');
  });

  it('converts v2.1.0 inferred props identically (backward compat)', () => {
    const v2Mappings = orcaPropsToMappings(V2_PROPS);
    const v21Mappings = orcaPropsToMappings(V21_PROPS);

    // Same number of mappings
    expect(v21Mappings).toHaveLength(v2Mappings.length);

    // Same coercion types for each prop
    for (const v2m of v2Mappings) {
      const v21m = v21Mappings.find((m) => m.externalProp === v2m.externalProp);
      expect(v21m).toBeDefined();
      expect(v21m?.coercion?.type).toBe(v2m.coercion?.type);
    }
  });
});

// ---------------------------------------------------------------------------
// auditCompatibility
// ---------------------------------------------------------------------------

describe('auditCompatibility', () => {
  it('all v2.0.0 types are compatible', () => {
    const result = auditCompatibility(V2_PROPS);
    expect(result.compatible).toBe(true);
    expect(result.unsupportedTypes).toEqual([]);
  });

  it('all v2.1.0 types are compatible', () => {
    const result = auditCompatibility(V21_PROPS);
    expect(result.compatible).toBe(true);
    expect(result.unsupportedTypes).toEqual([]);
  });

  it('flags unknown type', () => {
    const withUnknown = {
      ...V21_PROPS,
      mystery: { type: 'regex', source: 'inferred' as const, confidence: 0.3 },
    };
    const result = auditCompatibility(withUnknown);
    expect(result.compatible).toBe(false);
    expect(result.unsupportedTypes).toEqual(['mystery: regex']);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: derived coercion can execute via coerce()
// ---------------------------------------------------------------------------

describe('derived coercion executes correctly', () => {
  it('enum coercion from ORCA values[] works', () => {
    const coercionDef = deriveCoercion({ type: 'string', values: ['up', 'down', 'flat'] })!;
    expect(coerce('up', coercionDef)).toBe('up');
    expect(coerce('down', coercionDef)).toBe('down');
  });

  it('boolean_to_string coercion from ORCA boolean works', () => {
    const coercionDef = deriveCoercion({ type: 'boolean' })!;
    expect(coerce(true, coercionDef)).toBe('true');
    expect(coerce(false, coercionDef)).toBe('false');
  });

  it('identity coercion from null/undefined works', () => {
    const coercionDef = normalizeCoercion(deriveCoercion({ type: 'string' }));
    expect(coerce('hello', coercionDef)).toBe('hello');
    expect(coerce(42, coercionDef)).toBe(42);
  });
});
