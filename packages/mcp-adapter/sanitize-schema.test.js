import { describe, it, expect } from 'vitest';
import { sanitizeSchema } from './sanitize-schema.js';

describe('sanitizeSchema', () => {
  // ── $ref replacement (preserved from stripRefs) ───────────────────

  it('replaces $ref with object stub', () => {
    const schema = {
      type: 'object',
      properties: {
        schema: { $ref: './repl.ui.schema.json' },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result.properties.schema).toEqual({
      type: 'object',
      description: '(complex schema — see server docs)',
    });
  });

  it('replaces deeply nested $ref', () => {
    const schema = {
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          properties: {
            deep: { $ref: './something.json' },
          },
        },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result.properties.nested.properties.deep).toEqual({
      type: 'object',
      description: '(complex schema — see server docs)',
    });
  });

  // ── Top-level meta-keyword stripping ──────────────────────────────

  it('strips top-level $schema, $id, and title', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://designlab.local/schemas/test.json',
      title: 'Test Schema',
      type: 'object',
      properties: { name: { type: 'string' } },
    };
    const result = sanitizeSchema(schema);
    expect(result).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } },
    });
    expect(result).not.toHaveProperty('$schema');
    expect(result).not.toHaveProperty('$id');
    expect(result).not.toHaveProperty('title');
  });

  it('preserves title in nested properties', () => {
    const schema = {
      title: 'Root Title',
      type: 'object',
      properties: {
        field: { type: 'string', title: 'Field Title' },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result).not.toHaveProperty('title');
    expect(result.properties.field.title).toBe('Field Title');
  });

  // ── Top-level allOf stripping ─────────────────────────────────────

  it('strips top-level allOf (repl.render pattern)', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://designlab.local/schemas/repl.render.input.json',
      title: 'Agentic REPL render input',
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['full', 'patch'], default: 'full' },
        schema: { $ref: './repl.ui.schema.json' },
      },
      required: ['mode'],
      allOf: [
        {
          if: { properties: { mode: { const: 'full' } } },
          then: { required: ['schema'] },
        },
        {
          if: { properties: { mode: { const: 'patch' } } },
          then: { required: ['patch'] },
        },
      ],
      additionalProperties: false,
    };
    const result = sanitizeSchema(schema);
    expect(result).not.toHaveProperty('allOf');
    expect(result).not.toHaveProperty('$schema');
    expect(result).not.toHaveProperty('$id');
    expect(result).not.toHaveProperty('title');
    expect(result.type).toBe('object');
    expect(result.required).toEqual(['mode']);
    expect(result.properties.mode).toEqual({
      type: 'string',
      enum: ['full', 'patch'],
      default: 'full',
    });
    // $ref should be replaced
    expect(result.properties.schema).toEqual({
      type: 'object',
      description: '(complex schema — see server docs)',
    });
  });

  it('strips top-level allOf (repl.validate pattern)', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://designlab.local/schemas/repl.validate.input.json',
      title: 'Agentic REPL validate input',
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['full', 'patch'] },
      },
      required: ['mode'],
      allOf: [
        { if: { properties: { mode: { const: 'full' } } }, then: { required: ['schema'] } },
        { if: { properties: { mode: { const: 'patch' } } }, then: { required: ['patch'] } },
      ],
      additionalProperties: false,
    };
    const result = sanitizeSchema(schema);
    expect(result).not.toHaveProperty('allOf');
    expect(result.required).toEqual(['mode']);
  });

  it('strips top-level oneOf', () => {
    const schema = {
      type: 'object',
      oneOf: [
        { properties: { a: { type: 'string' } } },
        { properties: { b: { type: 'number' } } },
      ],
    };
    const result = sanitizeSchema(schema);
    expect(result).not.toHaveProperty('oneOf');
    expect(result.type).toBe('object');
  });

  it('strips top-level anyOf', () => {
    const schema = {
      type: 'object',
      anyOf: [
        { properties: { x: { type: 'string' } } },
        { properties: { y: { type: 'number' } } },
      ],
    };
    const result = sanitizeSchema(schema);
    expect(result).not.toHaveProperty('anyOf');
  });

  // ── Nested oneOf/anyOf flattening ─────────────────────────────────

  it('flattens nested oneOf to first variant (brand.apply delta pattern)', () => {
    const schema = {
      type: 'object',
      properties: {
        delta: {
          description: 'Alias changes or RFC 6902 patch array.',
          oneOf: [
            { type: 'object' },
            {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  op: { type: 'string' },
                  path: { type: 'string' },
                },
              },
            },
          ],
        },
      },
    };
    const result = sanitizeSchema(schema);
    // oneOf should be flattened — first variant merged into parent
    expect(result.properties.delta).toEqual({
      description: 'Alias changes or RFC 6902 patch array.',
      type: 'object',
    });
    expect(result.properties.delta).not.toHaveProperty('oneOf');
  });

  it('flattens nested oneOf to first variant (map.create coercion pattern)', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        propMappings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              coercion: {
                oneOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    required: ['type'],
                    properties: {
                      type: { type: 'string', enum: ['enum-map', 'boolean-invert'] },
                    },
                  },
                ],
                default: null,
              },
            },
          },
        },
      },
    };
    const result = sanitizeSchema(schema);
    const coercion = result.properties.propMappings.items.properties.coercion;
    expect(coercion).not.toHaveProperty('oneOf');
    expect(coercion.type).toBe('null');
    expect(coercion.default).toBeNull();
  });

  it('flattens nested anyOf to first variant', () => {
    const schema = {
      type: 'object',
      properties: {
        value: {
          description: 'Mixed type value.',
          anyOf: [
            { type: 'string' },
            { type: 'number' },
          ],
        },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result.properties.value).toEqual({
      description: 'Mixed type value.',
      type: 'string',
    });
  });

  // ── Passthrough / identity cases ──────────────────────────────────

  it('passes through primitives unchanged', () => {
    expect(sanitizeSchema(null)).toBeNull();
    expect(sanitizeSchema(42)).toBe(42);
    expect(sanitizeSchema('hello')).toBe('hello');
    expect(sanitizeSchema(true)).toBe(true);
  });

  it('handles arrays', () => {
    const result = sanitizeSchema([{ type: 'string' }, { type: 'number' }]);
    expect(result).toEqual([{ type: 'string' }, { type: 'number' }]);
  });

  it('preserves a clean schema unchanged', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        count: { type: 'number' },
      },
      required: ['name'],
      additionalProperties: false,
    };
    const result = sanitizeSchema(schema);
    expect(result).toEqual(schema);
  });

  it('preserves description, default, enum, and other standard keywords', () => {
    const schema = {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['a', 'b'],
          default: 'a',
          description: 'The mode.',
        },
      },
    };
    const result = sanitizeSchema(schema);
    expect(result.properties.mode).toEqual({
      type: 'string',
      enum: ['a', 'b'],
      default: 'a',
      description: 'The mode.',
    });
  });

  // ── Full schema integration tests ─────────────────────────────────

  it('fully sanitizes a repl.render-like schema', () => {
    // Simulates the real repl.render.input.json
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://designlab.local/schemas/repl.render.input.json',
      title: 'Agentic REPL render input',
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['full', 'patch'], default: 'full' },
        schema: { $ref: './repl.ui.schema.json' },
        patch: { $ref: './repl.patch.json' },
        apply: { type: 'boolean' },
      },
      required: ['mode'],
      allOf: [
        { if: { properties: { mode: { const: 'full' } } }, then: { required: ['schema'] } },
        { if: { properties: { mode: { const: 'patch' } } }, then: { required: ['patch'] } },
      ],
      additionalProperties: false,
    };
    const result = sanitizeSchema(schema);

    // No forbidden constructs
    expect(result).not.toHaveProperty('$schema');
    expect(result).not.toHaveProperty('$id');
    expect(result).not.toHaveProperty('title');
    expect(result).not.toHaveProperty('allOf');

    // Structure preserved
    expect(result.type).toBe('object');
    expect(result.required).toEqual(['mode']);
    expect(result.additionalProperties).toBe(false);

    // $refs replaced
    expect(result.properties.schema.type).toBe('object');
    expect(result.properties.patch.type).toBe('object');

    // Simple properties preserved
    expect(result.properties.apply).toEqual({ type: 'boolean' });
  });

  it('fully sanitizes a brand.apply-like schema', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        brand: { type: 'string', enum: ['A'], default: 'A' },
        delta: {
          description: 'Alias changes or patch array.',
          oneOf: [
            { type: 'object' },
            { type: 'array', items: { type: 'object' } },
          ],
        },
        strategy: { type: 'string', enum: ['alias', 'patch'], default: 'alias' },
        apply: { type: 'boolean', default: false },
      },
      required: ['delta'],
      additionalProperties: false,
    };
    const result = sanitizeSchema(schema);

    expect(result).not.toHaveProperty('$schema');
    expect(result.properties.delta).toEqual({
      description: 'Alias changes or patch array.',
      type: 'object',
    });
    expect(result.properties.strategy).toEqual({
      type: 'string',
      enum: ['alias', 'patch'],
      default: 'alias',
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('handles empty oneOf array gracefully', () => {
    const schema = {
      type: 'object',
      properties: {
        val: { oneOf: [] },
      },
    };
    const result = sanitizeSchema(schema);
    // Empty oneOf — nothing to flatten, keep as-is
    expect(result.properties.val).toEqual({ oneOf: [] });
  });

  it('handles nested allOf (not at root) — preserves it', () => {
    // Only top-level allOf is stripped; nested allOf in properties is kept
    // (nested oneOf/anyOf are flattened, but allOf at non-root is kept)
    const schema = {
      type: 'object',
      properties: {
        nested: {
          allOf: [
            { type: 'object', properties: { a: { type: 'string' } } },
          ],
        },
      },
    };
    const result = sanitizeSchema(schema);
    // allOf at non-root level is kept as-is (only oneOf/anyOf are flattened)
    expect(result.properties.nested).toHaveProperty('allOf');
  });

  it('handles deeply nested $ref inside oneOf variant', () => {
    const schema = {
      type: 'object',
      properties: {
        data: {
          oneOf: [
            {
              type: 'object',
              properties: { inner: { $ref: './inner.json' } },
            },
            { type: 'string' },
          ],
        },
      },
    };
    const result = sanitizeSchema(schema);
    // First variant is used, with its $ref replaced
    expect(result.properties.data.type).toBe('object');
    expect(result.properties.data.properties.inner).toEqual({
      type: 'object',
      description: '(complex schema — see server docs)',
    });
  });
});
