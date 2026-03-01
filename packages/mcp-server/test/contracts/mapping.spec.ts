import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAjv } from '../../src/lib/ajv.js';
import createInputSchema from '../../src/schemas/map.create.input.json' assert { type: 'json' };
import createOutputSchema from '../../src/schemas/map.create.output.json' assert { type: 'json' };
import listInputSchema from '../../src/schemas/map.list.input.json' assert { type: 'json' };
import listOutputSchema from '../../src/schemas/map.list.output.json' assert { type: 'json' };
import resolveInputSchema from '../../src/schemas/map.resolve.input.json' assert { type: 'json' };
import resolveOutputSchema from '../../src/schemas/map.resolve.output.json' assert { type: 'json' };
import { handle as createHandle } from '../../src/tools/map.create.js';
import { handle as listHandle } from '../../src/tools/map.list.js';
import { handle as resolveHandle } from '../../src/tools/map.resolve.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const MAPPINGS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'component-mappings.json');

const ajv = getAjv();
const validateCreateInput = ajv.compile(createInputSchema);
const validateCreateOutput = ajv.compile(createOutputSchema);
const validateListInput = ajv.compile(listInputSchema);
const validateListOutput = ajv.compile(listOutputSchema);
const validateResolveInput = ajv.compile(resolveInputSchema);
const validateResolveOutput = ajv.compile(resolveOutputSchema);

// Preserve original file state for cleanup
let originalMappings: string | null = null;

beforeAll(() => {
  originalMappings = fs.existsSync(MAPPINGS_PATH) ? fs.readFileSync(MAPPINGS_PATH, 'utf8') : null;
});

afterAll(() => {
  if (originalMappings === null) {
    fs.rmSync(MAPPINGS_PATH, { force: true });
  } else {
    fs.writeFileSync(MAPPINGS_PATH, originalMappings);
  }
});

function resetMappingsFile(): void {
  const empty = {
    $schema: '../../packages/mcp-server/src/schemas/component-mapping.schema.json',
    generatedAt: new Date().toISOString(),
    version: new Date().toISOString().slice(0, 10),
    stats: { mappingCount: 0, systemCount: 0 },
    mappings: [],
  };
  fs.writeFileSync(MAPPINGS_PATH, JSON.stringify(empty, null, 2) + '\n');
}

// ── Schema validation ──

describe('map.create schema validation', () => {
  it('accepts valid create input', () => {
    expect(
      validateCreateInput({
        externalSystem: 'material',
        externalComponent: 'Button',
        oodsTraits: ['Stateful'],
      }),
    ).toBe(true);
  });

  it('accepts input with propMappings and metadata', () => {
    expect(
      validateCreateInput({
        externalSystem: 'material',
        externalComponent: 'Button',
        oodsTraits: ['Stateful'],
        propMappings: [
          { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum-map', values: { contained: 'primary' } } },
          { externalProp: 'disabled', oodsProp: 'disabled', coercion: null },
        ],
        confidence: 'auto',
        metadata: { author: 'test', notes: 'test mapping' },
      }),
    ).toBe(true);
  });

  it('rejects input missing required fields', () => {
    expect(validateCreateInput({ externalSystem: 'material' })).toBe(false);
  });

  it('rejects empty oodsTraits', () => {
    expect(
      validateCreateInput({
        externalSystem: 'material',
        externalComponent: 'Button',
        oodsTraits: [],
      }),
    ).toBe(false);
  });

  it('rejects invalid confidence value', () => {
    expect(
      validateCreateInput({
        externalSystem: 'material',
        externalComponent: 'Button',
        oodsTraits: ['Stateful'],
        confidence: 'maybe',
      }),
    ).toBe(false);
  });
});

describe('map.list schema validation', () => {
  it('accepts empty input', () => {
    expect(validateListInput({})).toBe(true);
  });

  it('accepts input with externalSystem filter', () => {
    expect(validateListInput({ externalSystem: 'material' })).toBe(true);
  });
});

describe('map.resolve schema validation', () => {
  it('accepts valid resolve input', () => {
    expect(
      validateResolveInput({
        externalSystem: 'material',
        externalComponent: 'Button',
      }),
    ).toBe(true);
  });

  it('rejects input missing externalComponent', () => {
    expect(validateResolveInput({ externalSystem: 'material' })).toBe(false);
  });
});

// ── Handler tests ──

describe('map.create → map.list → map.resolve round-trip', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('creates a mapping and retrieves it via list and resolve', async () => {
    // Create
    const createResult = await createHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum-map', values: { contained: 'primary' } } },
      ],
      confidence: 'manual',
    });

    expect(validateCreateOutput(createResult)).toBe(true);
    expect(createResult.status).toBe('ok');
    expect(createResult.mapping).toBeDefined();
    expect((createResult.mapping as any).id).toBe('material-button');
    expect(createResult.etag).toMatch(/^[a-f0-9]{64}$/);

    // List
    const listResult = await listHandle({});
    expect(validateListOutput(listResult)).toBe(true);
    expect(listResult.totalCount).toBe(1);
    expect(listResult.stats.mappingCount).toBe(1);
    expect(listResult.stats.systemCount).toBe(1);

    // Resolve
    const resolveResult = await resolveHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
    });
    expect(validateResolveOutput(resolveResult)).toBe(true);
    expect(resolveResult.status).toBe('ok');
    expect(resolveResult.mapping).toBeDefined();
    expect((resolveResult.mapping as any).oodsTraits).toEqual(['Stateful']);
    expect(resolveResult.propTranslations).toBeInstanceOf(Array);
    expect(resolveResult.propTranslations!.length).toBe(1);
    expect(resolveResult.propTranslations![0].externalProp).toBe('variant');
    expect(resolveResult.propTranslations![0].oodsProp).toBe('appearance');
    expect(resolveResult.propTranslations![0].coercionType).toBe('enum-map');
  });
});

describe('map.create trait validation', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('warns on unknown trait references', async () => {
    const result = await createHandle({
      externalSystem: 'material',
      externalComponent: 'Slider',
      oodsTraits: ['NonExistentTrait'],
    });

    expect(result.status).toBe('ok');
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w: string) => w.includes('NonExistentTrait'))).toBe(true);
  });

  it('does not warn on known traits', async () => {
    const result = await createHandle({
      externalSystem: 'material',
      externalComponent: 'Chip',
      oodsTraits: ['Taggable', 'Stateful'],
    });

    expect(result.status).toBe('ok');
    // No warnings about unknown traits (both are real OODS traits)
    const traitWarnings = (result.warnings ?? []).filter((w: string) => w.includes('Unknown trait'));
    expect(traitWarnings.length).toBe(0);
  });
});

describe('map.create duplicate detection', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('rejects duplicate mapping for same system + component', async () => {
    await createHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    await expect(
      createHandle({
        externalSystem: 'material',
        externalComponent: 'Button',
        oodsTraits: ['Stateful'],
      }),
    ).rejects.toThrow(/duplicate/i);
  });

  it('allows same component name from different systems', async () => {
    await createHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await createHandle({
      externalSystem: 'ant-design',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    expect(result.status).toBe('ok');
    expect((result.mapping as any).id).toBe('ant-design-button');
  });
});

describe('multi-system mappings', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('creates mappings from multiple systems and filters by system', async () => {
    await createHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });
    await createHandle({
      externalSystem: 'material',
      externalComponent: 'TextField',
      oodsTraits: ['Labelled', 'Stateful'],
    });
    await createHandle({
      externalSystem: 'chakra',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    // List all
    const allResult = await listHandle({});
    expect(allResult.totalCount).toBe(3);
    expect(allResult.stats.systemCount).toBe(2);

    // Filter by material
    const materialResult = await listHandle({ externalSystem: 'material' });
    expect(materialResult.totalCount).toBe(2);

    // Filter by chakra
    const chakraResult = await listHandle({ externalSystem: 'chakra' });
    expect(chakraResult.totalCount).toBe(1);

    // Filter by unknown system
    const unknownResult = await listHandle({ externalSystem: 'nonexistent' });
    expect(unknownResult.totalCount).toBe(0);
  });

  it('filters are case-insensitive', async () => {
    await createHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await listHandle({ externalSystem: 'MATERIAL' });
    expect(result.totalCount).toBe(1);
  });
});

describe('map.resolve not found', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('returns not_found for unmapped component', async () => {
    const result = await resolveHandle({
      externalSystem: 'material',
      externalComponent: 'NonExistent',
    });

    expect(validateResolveOutput(result)).toBe(true);
    expect(result.status).toBe('not_found');
    expect(result.message).toBeDefined();
    expect(result.mapping).toBeUndefined();
  });
});

describe('map.resolve case-insensitive lookup', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('resolves regardless of case', async () => {
    await createHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await resolveHandle({
      externalSystem: 'MATERIAL',
      externalComponent: 'button',
    });

    expect(result.status).toBe('ok');
  });
});

describe('map.create all coercion types', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('supports all four coercion strategies in prop mappings', async () => {
    const result = await createHandle({
      externalSystem: 'test-system',
      externalComponent: 'TestComponent',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum-map', values: { a: 'b' } } },
        { externalProp: 'inverted', oodsProp: 'active', coercion: { type: 'boolean-invert' } },
        { externalProp: 'width', oodsProp: 'size', coercion: { type: 'string-template', template: '{value}px' } },
        { externalProp: 'count', oodsProp: 'quantity', coercion: { type: 'type-cast', targetType: 'number' } },
        { externalProp: 'label', oodsProp: 'text', coercion: null },
      ],
    });

    expect(result.status).toBe('ok');

    const resolveResult = await resolveHandle({
      externalSystem: 'test-system',
      externalComponent: 'TestComponent',
    });

    expect(resolveResult.propTranslations!.length).toBe(5);
    expect(resolveResult.propTranslations![0].coercionType).toBe('enum-map');
    expect(resolveResult.propTranslations![1].coercionType).toBe('boolean-invert');
    expect(resolveResult.propTranslations![2].coercionType).toBe('string-template');
    expect(resolveResult.propTranslations![3].coercionType).toBe('type-cast');
    expect(resolveResult.propTranslations![4].coercionType).toBeNull();
  });
});

describe('map.create auto-generated metadata', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('sets createdAt timestamp automatically', async () => {
    const before = new Date().toISOString();
    const result = await createHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });
    const after = new Date().toISOString();

    const mapping = result.mapping as any;
    expect(mapping.metadata.createdAt).toBeDefined();
    expect(mapping.metadata.createdAt >= before).toBe(true);
    expect(mapping.metadata.createdAt <= after).toBe(true);
  });

  it('preserves user-provided author and notes', async () => {
    const result = await createHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      metadata: { author: 'testuser', notes: 'Test mapping for CI' },
    });

    const mapping = result.mapping as any;
    expect(mapping.metadata.author).toBe('testuser');
    expect(mapping.metadata.notes).toBe('Test mapping for CI');
  });
});

describe('map.create defaults', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('defaults confidence to manual when omitted', async () => {
    const result = await createHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    expect((result.mapping as any).confidence).toBe('manual');
  });
});
