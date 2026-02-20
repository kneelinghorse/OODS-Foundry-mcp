import { describe, it, expect } from 'vitest';
import { handle } from '../../src/tools/catalog.list.js';
import type { CatalogListInput, CatalogListOutput } from '../../src/tools/types.js';

describe('catalog.list', () => {
  it('should return component catalog', async () => {
    const input: CatalogListInput = {};
    const output: CatalogListOutput = await handle(input);

    expect(output).toBeDefined();
    expect(output.components).toBeDefined();
    expect(Array.isArray(output.components)).toBe(true);
    expect(output.totalCount).toBeGreaterThan(0);
    expect(output.generatedAt).toBeDefined();
    expect(output.stats).toBeDefined();
    expect(output.stats.componentCount).toBeGreaterThan(0);
  });

  it('should include component properties', async () => {
    const input: CatalogListInput = {};
    const output: CatalogListOutput = await handle(input);

    expect(output.components.length).toBeGreaterThan(0);

    const firstComponent = output.components[0];
    expect(firstComponent.name).toBeDefined();
    expect(firstComponent.displayName).toBeDefined();
    expect(Array.isArray(firstComponent.categories)).toBe(true);
    expect(Array.isArray(firstComponent.tags)).toBe(true);
    expect(Array.isArray(firstComponent.contexts)).toBe(true);
    expect(Array.isArray(firstComponent.regions)).toBe(true);
    expect(Array.isArray(firstComponent.traits)).toBe(true);
    expect(typeof firstComponent.propSchema).toBe('object');
    expect(typeof firstComponent.slots).toBe('object');
  });

  it('should filter by category', async () => {
    const input: CatalogListInput = { category: 'core' };
    const output: CatalogListOutput = await handle(input);

    expect(output.components.length).toBeGreaterThan(0);
    expect(output.components.every((c) => c.categories.includes('core'))).toBe(true);
  });

  it('should filter by trait', async () => {
    const allComponents = await handle({});

    // Find a trait that exists
    const availableTraits = new Set<string>();
    allComponents.components.forEach((c) => {
      c.traits.forEach((t) => availableTraits.add(t));
    });

    if (availableTraits.size > 0) {
      const testTrait = Array.from(availableTraits)[0];
      const input: CatalogListInput = { trait: testTrait };
      const output: CatalogListOutput = await handle(input);

      expect(output.components.length).toBeGreaterThan(0);
      expect(output.components.every((c) => c.traits.includes(testTrait))).toBe(true);
    }
  });

  it('should filter by context', async () => {
    const allComponents = await handle({});

    // Find a context that exists
    const availableContexts = new Set<string>();
    allComponents.components.forEach((c) => {
      c.contexts.forEach((ctx) => availableContexts.add(ctx));
    });

    if (availableContexts.size > 0) {
      const testContext = Array.from(availableContexts)[0];
      const input: CatalogListInput = { context: testContext };
      const output: CatalogListOutput = await handle(input);

      expect(output.components.length).toBeGreaterThan(0);
      expect(output.components.every((c) => c.contexts.includes(testContext))).toBe(true);
    }
  });

  it('should return totalCount matching filtered results', async () => {
    const input: CatalogListInput = { category: 'core' };
    const output: CatalogListOutput = await handle(input);

    expect(output.totalCount).toBe(output.components.length);
  });

  it('should include propSchema for components with traits', async () => {
    const output: CatalogListOutput = await handle({});

    const componentsWithTraits = output.components.filter((c) => c.traits.length > 0);
    expect(componentsWithTraits.length).toBeGreaterThan(0);

    // Components with traits might have prop schemas derived from those traits
    const componentsWithProps = componentsWithTraits.filter(
      (c) => Object.keys(c.propSchema).length > 0
    );

    // Note: Not all components with traits will have props, but some should
    expect(componentsWithProps.length).toBeGreaterThan(0);
  });

  it('should have valid structure for propSchema entries', async () => {
    const output: CatalogListOutput = await handle({});

    const componentWithProps = output.components.find(
      (c) => Object.keys(c.propSchema).length > 0
    );

    if (componentWithProps) {
      const propKeys = Object.keys(componentWithProps.propSchema);
      expect(propKeys.length).toBeGreaterThan(0);

      // Each prop should have metadata
      propKeys.forEach((key) => {
        const propMeta = componentWithProps.propSchema[key] as any;
        expect(propMeta).toBeDefined();
        expect(typeof propMeta).toBe('object');
      });
    }
  });

  it('should have valid structure for slots', async () => {
    const output: CatalogListOutput = await handle({});

    const componentWithSlots = output.components.find(
      (c) => Object.keys(c.slots).length > 0
    );

    if (componentWithSlots) {
      const slotKeys = Object.keys(componentWithSlots.slots);
      expect(slotKeys.length).toBeGreaterThan(0);

      slotKeys.forEach((slotName) => {
        const slot = componentWithSlots.slots[slotName];
        expect(slot).toBeDefined();

        if (slot.accept) {
          expect(Array.isArray(slot.accept)).toBe(true);
        }

        if (slot.role) {
          expect(typeof slot.role).toBe('string');
        }
      });
    }
  });
});
