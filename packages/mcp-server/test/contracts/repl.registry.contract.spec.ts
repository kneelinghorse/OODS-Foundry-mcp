import { describe, expect, it } from 'vitest';
import { componentRenderers } from '../../src/render/component-map.js';
import { loadComponentRegistry } from '../../src/tools/repl.utils.js';

const BASIC_COMPONENTS = ['Button', 'Card', 'Grid', 'Stack', 'Text', 'Input', 'Select', 'Badge', 'Banner', 'Table', 'Tabs'];
const EXPECTED_COMPONENT_COUNT = 94;

describe('REPL registry contract', () => {
  it('includes all registry components and the basic primitives', () => {
    const registry = loadComponentRegistry();

    for (const component of BASIC_COMPONENTS) {
      expect(registry.names.has(component)).toBe(true);
    }

    expect(registry.names.size).toBe(EXPECTED_COMPONENT_COUNT);
  });

  it('includes every component that has a mapped renderer', () => {
    const registry = loadComponentRegistry();

    for (const rendererComponentName of Object.keys(componentRenderers)) {
      expect(registry.names.has(rendererComponentName)).toBe(true);
    }
  });
});
