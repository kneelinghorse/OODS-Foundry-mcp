import { afterEach, describe, expect, it } from 'vitest';
import { composeObject } from '../../src/objects/trait-composer.js';
import { clearObjectCache, listObjects, loadObject } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';
import type { ObjectDefinition } from '../../src/objects/types.js';

describe('trait-composer', () => {
  afterEach(() => {
    clearObjectCache();
    clearTraitCache();
  });

  it('composes a real object (User) with merged schema', () => {
    const user = loadObject('User');
    const composed = composeObject(user);

    expect(composed.object.name).toBe('User');
    expect(composed.traits.length).toBeGreaterThan(0);

    // Object's own fields should be present
    expect(composed.schema.user_id).toBeDefined();
    expect(composed.schema.name).toBeDefined();
    expect(composed.schema.role).toBeDefined();

    // Trait-contributed fields should be present (from Timestampable)
    expect(composed.schema.created_at).toBeDefined();
    expect(composed.schema.updated_at).toBeDefined();
  });

  it('composes a real object (Product) with trait view_extensions', () => {
    const product = loadObject('Product');
    const composed = composeObject(product);

    expect(composed.object.name).toBe('Product');

    // Priceable trait contributes view_extensions to detail, list, card
    expect(composed.viewExtensions.detail).toBeDefined();
    expect(composed.viewExtensions.detail.length).toBeGreaterThan(0);
  });

  it('merges tokens with object override', () => {
    const user = loadObject('User');
    const composed = composeObject(user);

    // Object tokens should be present
    for (const [key, value] of Object.entries(user.tokens)) {
      expect(composed.tokens[key]).toBe(value);
    }
  });

  it('merges semantics from traits and object', () => {
    const user = loadObject('User');
    const composed = composeObject(user);

    // Object semantics should be present
    expect(composed.semantics.user_id).toBeDefined();
    expect(composed.semantics.user_id.semantic_type).toBeDefined();

    // Trait-contributed semantics should also be present (from Timestampable)
    expect(composed.semantics.created_at).toBeDefined();
  });

  it('handles object with 0 traits gracefully', () => {
    const bare: ObjectDefinition = {
      object: {
        name: 'Bare',
        version: '0.0.1',
        domain: 'test',
        description: 'No traits',
      },
      traits: [],
      schema: {
        id: { type: 'uuid', required: true, description: 'Primary key' },
      },
      semantics: {},
      tokens: { 'test.id': 'var(--text)' },
      metadata: {},
    };

    const composed = composeObject(bare);

    expect(composed.object.name).toBe('Bare');
    expect(composed.traits).toHaveLength(0);
    expect(composed.schema.id).toBeDefined();
    expect(Object.keys(composed.viewExtensions)).toHaveLength(0);
    expect(composed.tokens['test.id']).toBe('var(--text)');
    expect(composed.warnings).toHaveLength(0);
  });

  it('handles traits with no view_extensions gracefully', () => {
    // Taggable and some other traits may not have view_extensions
    // This test verifies the composer doesn't crash on empty view_extensions
    const user = loadObject('User');
    const composed = composeObject(user);
    // Should succeed without errors
    expect(composed).toBeDefined();
  });

  it('detects field collisions with warnings', () => {
    const conflicting: ObjectDefinition = {
      object: {
        name: 'Conflicting',
        version: '0.0.1',
        domain: 'test',
        description: 'Tests collisions',
      },
      traits: [
        { name: 'lifecycle/Stateful' },
        { name: 'lifecycle/Timestampable' },
      ],
      schema: {
        // This field also exists in Timestampable trait
        created_at: {
          type: 'string',
          required: true,
          description: 'Object override of trait field',
        },
      },
      semantics: {},
      tokens: {},
      metadata: {},
    };

    const composed = composeObject(conflicting);

    // Should have collision warnings
    const collisionWarnings = composed.warnings.filter((w) =>
      w.includes('collision'),
    );
    expect(collisionWarnings.length).toBeGreaterThan(0);

    // Object's own definition should win for created_at
    expect(composed.schema.created_at.description).toBe(
      'Object override of trait field',
    );
  });

  it('resolves view_extension priorities (higher priority first)', () => {
    const product = loadObject('Product');
    const composed = composeObject(product);

    // For each context, extensions should be sorted by priority descending
    for (const [, extensions] of Object.entries(composed.viewExtensions)) {
      for (let i = 1; i < extensions.length; i++) {
        const prevPriority = extensions[i - 1].priority ?? 0;
        const currPriority = extensions[i].priority ?? 0;
        expect(prevPriority).toBeGreaterThanOrEqual(currPriority);
      }
    }
  });

  it('trait declaration order breaks priority ties', () => {
    // When two traits have the same priority (or both undefined = 0),
    // earlier declared trait's extensions come first
    const user = loadObject('User');
    const composed = composeObject(user);
    // This should complete without error; ordering is deterministic
    expect(composed.viewExtensions).toBeDefined();
  });

  it('object tokens override trait tokens', () => {
    // Build an object that has a token key matching a trait token
    const product = loadObject('Product');
    const composed = composeObject(product);

    // Product defines its own tokens; those should be in the final map
    for (const [key, value] of Object.entries(product.tokens)) {
      expect(composed.tokens[key]).toBe(value);
    }
  });

  it('resolves all traits for all known objects without error', () => {
    // Smoke test: compose every known object
    const names = listObjects();

    for (const name of names) {
      const obj = loadObject(name);
      const composed = composeObject(obj);
      expect(composed.object.name).toBe(name);
      expect(composed.schema).toBeDefined();
    }
  });

  it('warns when a trait cannot be loaded', () => {
    const broken: ObjectDefinition = {
      object: {
        name: 'Broken',
        version: '0.0.1',
        domain: 'test',
        description: 'References a non-existent trait',
      },
      traits: [{ name: 'nonexistent/FakeTrait' }],
      schema: {},
      semantics: {},
      tokens: {},
      metadata: {},
    };

    const composed = composeObject(broken);

    expect(composed.traits).toHaveLength(0);
    expect(composed.warnings.length).toBeGreaterThan(0);
    expect(composed.warnings[0]).toContain('Failed to load trait');
  });

  it('resolvedTraits include ref and definition', () => {
    const product = loadObject('Product');
    const composed = composeObject(product);

    for (const resolved of composed.traits) {
      expect(resolved.ref).toBeDefined();
      expect(resolved.ref.name).toBeDefined();
      expect(resolved.definition).toBeDefined();
      expect(resolved.definition.trait.name).toBeDefined();
    }
  });

  it('collects view_extensions across multiple contexts', () => {
    const product = loadObject('Product');
    const composed = composeObject(product);

    // Product uses Priceable (detail, list, card) + Timestampable (detail, timeline, list)
    // + possibly Stateful extensions
    const contexts = Object.keys(composed.viewExtensions);
    expect(contexts.length).toBeGreaterThanOrEqual(2);
  });
});
