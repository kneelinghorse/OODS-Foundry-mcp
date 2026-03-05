import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/catalog.list.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/catalog.list.output.json' assert { type: 'json' };
import { handle } from '../../src/tools/catalog.list.js';
import type { CatalogListInput, CatalogListOutput } from '../../src/tools/types.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../');
const codeConnectPath = path.join(repoRoot, 'artifacts', 'structured-data', 'code-connect.json');

describe('catalog.list', () => {
  let preservedCodeConnect: string | null = null;

  beforeAll(() => {
    preservedCodeConnect = fs.existsSync(codeConnectPath) ? fs.readFileSync(codeConnectPath, 'utf8') : null;
    fs.rmSync(codeConnectPath, { force: true });
  });

  afterAll(() => {
    if (preservedCodeConnect === null) {
      fs.rmSync(codeConnectPath, { force: true });
      return;
    }

    fs.writeFileSync(codeConnectPath, preservedCodeConnect);
  });

  it('validates schema contracts', async () => {
    expect(validateInput({})).toBe(true);
    expect(validateInput({ category: 'core' })).toBe(true);
    expect(validateInput({ detail: 'summary' })).toBe(true);
    expect(validateInput({ page: 1, pageSize: 10 })).toBe(true);
    expect(validateInput({ unknown: true })).toBe(false);
    expect(validateInput({ detail: 'expanded' })).toBe(false);
    expect(validateInput({ page: 0 })).toBe(false);

    const output = await handle({});
    expect(validateOutput(output)).toBe(true);
    expect(validateOutput.errors).toBeNull();
  });

  it('should return component catalog', async () => {
    const input: CatalogListInput = {};
    const output: CatalogListOutput = await handle(input);

    expect(output).toBeDefined();
    expect(output.components).toBeDefined();
    expect(Array.isArray(output.components)).toBe(true);
    expect(output.totalCount).toBeGreaterThan(0);
    expect(output.returnedCount).toBe(output.components.length);
    expect(output.page).toBeGreaterThan(0);
    expect(output.pageSize).toBeGreaterThanOrEqual(0);
    expect(typeof output.hasMore).toBe('boolean');
    expect(output.detail).toBeDefined();
    expect(output.generatedAt).toBeDefined();
    expect(output.stats).toBeDefined();
    expect(output.stats.componentCount).toBeGreaterThan(0);
  });

  it('should default to summary mode with pagination for unfiltered calls', async () => {
    const output: CatalogListOutput = await handle({});

    expect(output.detail).toBe('summary');
    expect(output.returnedCount).toBe(output.components.length);
    expect(output.totalCount).toBeGreaterThanOrEqual(output.returnedCount);
    if (output.pageSize > 0) {
      expect(output.components.length).toBeLessThanOrEqual(output.pageSize);
    }

    const firstComponent = output.components[0] as any;
    if (firstComponent) {
      expect(firstComponent.propSchema).toBeUndefined();
      expect(firstComponent.slots).toBeUndefined();
      expect(firstComponent.codeReferences).toBeUndefined();
      expect(firstComponent.codeSnippet).toBeUndefined();
    }
  });

  it('should allow explicit full detail without default pagination', async () => {
    const output: CatalogListOutput = await handle({ detail: 'full' });

    expect(output.detail).toBe('full');
    expect(output.hasMore).toBe(false);
    expect(output.totalCount).toBe(output.components.length);
  });

  it('should paginate when page/pageSize are provided', async () => {
    const firstPage: CatalogListOutput = await handle({ detail: 'summary', page: 1, pageSize: 1 });

    expect(firstPage.page).toBe(1);
    expect(firstPage.pageSize).toBe(1);
    expect(firstPage.returnedCount).toBe(firstPage.components.length);
    expect(firstPage.returnedCount).toBeLessThanOrEqual(1);

    if (firstPage.totalCount > 1) {
      const secondPage: CatalogListOutput = await handle({ detail: 'summary', page: 2, pageSize: 1 });
      expect(secondPage.page).toBe(2);
      expect(secondPage.pageSize).toBe(1);
      expect(secondPage.returnedCount).toBeLessThanOrEqual(1);
      if (firstPage.components[0] && secondPage.components[0]) {
        expect(firstPage.components[0].name).not.toBe(secondPage.components[0].name);
      }
    }
  });

  it('should include component properties', async () => {
    const input: CatalogListInput = { detail: 'full' };
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

  it('includes filteredCount in stats when filters are active', async () => {
    const output: CatalogListOutput = await handle({ category: 'financial' });

    expect(output.stats.filteredCount).toBeDefined();
    expect(output.stats.filteredCount).toBe(output.totalCount);
    expect(output.stats.filteredCount).toBe(output.returnedCount);
    expect(output.stats.componentCount).toBeGreaterThanOrEqual(output.stats.filteredCount ?? 0);
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

  it('suggests traits when a trait filter returns zero results', async () => {
    const allComponents = await handle({});
    const availableTraits = new Set<string>();
    allComponents.components.forEach((c) => {
      c.traits.forEach((t) => availableTraits.add(t));
    });

    if (availableTraits.size > 0) {
      const knownTrait = Array.from(availableTraits)[0];
      let query = knownTrait.toLowerCase();
      if (query === knownTrait) {
        query = `${knownTrait}x`;
      }
      const output: CatalogListOutput = await handle({ trait: query });

      expect(output.components.length).toBe(0);
      expect(output.suggestions?.traits).toContain(knownTrait);
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
    expect(output.returnedCount).toBe(output.components.length);
  });

  it('deduplicates trait names per component', async () => {
    const output: CatalogListOutput = await handle({ detail: 'full' });
    const statusBadge = output.components.find((c) => c.name === 'StatusBadge');

    expect(statusBadge).toBeDefined();
    if (statusBadge) {
      const unique = new Set(statusBadge.traits);
      expect(statusBadge.traits.length).toBe(unique.size);
      expect(statusBadge.traits).toEqual(['Stateful', 'Statusable']);
    }
  });

  it('should include propSchema for components with traits', async () => {
    const output: CatalogListOutput = await handle({ detail: 'full' });

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
    const output: CatalogListOutput = await handle({ detail: 'full' });

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
    const output: CatalogListOutput = await handle({ detail: 'full' });

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

  it('should enrich entries with storybook code references when available', async () => {
    const output: CatalogListOutput = await handle({ detail: 'full' });
    const byName = new Map(output.components.map((component) => [component.name, component]));

    const tagInput = byName.get('TagInput');
    expect(tagInput).toBeDefined();
    expect(tagInput?.codeReferences?.length).toBeGreaterThan(0);
    expect(tagInput?.codeReferences?.every((ref) => ref.kind === 'storybook')).toBe(true);
    expect(tagInput?.codeReferences?.some((ref) => ref.path.endsWith('stories/components/classification/TagInput.stories.tsx'))).toBe(true);
    expect(tagInput?.codeSnippet).toContain('import');

    const tagManager = byName.get('TagManager');
    expect(tagManager).toBeDefined();
    expect(tagManager?.codeReferences?.length).toBeGreaterThan(0);
    expect(tagManager?.codeSnippet).toContain('component: TagManager');

    const templatePicker = byName.get('TemplatePicker');
    expect(templatePicker).toBeDefined();
    expect(templatePicker?.codeReferences?.length).toBeGreaterThan(0);
    expect(templatePicker?.codeSnippet).toContain('component: TemplatePicker');
  });

  it('should prefer code-connect snippets when available', async () => {
    const previous = fs.existsSync(codeConnectPath) ? fs.readFileSync(codeConnectPath, 'utf8') : null;

    try {
      const payload = {
        generatedAt: new Date().toISOString(),
        components: {
          TagInput: [
            {
              path: 'upstream/stories/components/classification/TagInput.stories.tsx',
              snippet: '// code-connect: TagInput usage example',
            },
          ],
        },
      };

      fs.writeFileSync(codeConnectPath, JSON.stringify(payload, null, 2));

      const output: CatalogListOutput = await handle({ detail: 'full' });
      const byName = new Map(output.components.map((component) => [component.name, component]));
      const tagInput = byName.get('TagInput');

      expect(tagInput).toBeDefined();
      expect(tagInput?.codeReferences?.some((ref) => ref.kind === 'code-connect')).toBe(true);
      expect(tagInput?.codeSnippet).toBe('// code-connect: TagInput usage example');
    } finally {
      if (previous === null) {
        fs.rmSync(codeConnectPath, { force: true });
      } else {
        fs.writeFileSync(codeConnectPath, previous);
      }
    }
  });

  // ── Status filter tests ──

  it('every component has a non-empty status field', async () => {
    const output: CatalogListOutput = await handle({});
    for (const component of output.components) {
      expect(component.status).toBeDefined();
      expect(['stable', 'beta', 'planned']).toContain(component.status);
    }
  });

  it('filters by status=stable', async () => {
    const output: CatalogListOutput = await handle({ status: 'stable' });
    expect(output.totalCount).toBeGreaterThan(0);
    for (const component of output.components) {
      expect(component.status).toBe('stable');
    }
  });

  it('all 4 Communicable components have stable status', async () => {
    const output: CatalogListOutput = await handle({ trait: 'Communicable', detail: 'summary' });
    const communicableNames = output.components.map((c) => c.name);
    expect(communicableNames).toContain('CommunicationDetailPanel');
    expect(communicableNames).toContain('MessageEventTimeline');
    expect(communicableNames).toContain('MessageStatusBadge');
    expect(communicableNames).toContain('TemplatePicker');

    for (const component of output.components) {
      if (['CommunicationDetailPanel', 'MessageEventTimeline', 'MessageStatusBadge', 'TemplatePicker'].includes(component.name)) {
        expect(component.status).toBe('stable');
      }
    }
  });

  it('status filter validates in input schema', () => {
    expect(validateInput({ status: 'stable' })).toBe(true);
    expect(validateInput({ status: 'planned' })).toBe(true);
    expect(validateInput({ status: 'beta' })).toBe(true);
    expect(validateInput({ status: 'invalid' })).toBe(false);
  });
});
