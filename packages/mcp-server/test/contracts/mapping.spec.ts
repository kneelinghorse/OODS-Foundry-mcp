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
import updateInputSchema from '../../src/schemas/map.update.input.json' assert { type: 'json' };
import updateOutputSchema from '../../src/schemas/map.update.output.json' assert { type: 'json' };
import deleteInputSchema from '../../src/schemas/map.delete.input.json' assert { type: 'json' };
import deleteOutputSchema from '../../src/schemas/map.delete.output.json' assert { type: 'json' };
import { handle as createHandle } from '../../src/tools/map.create.js';
import { handle as listHandle } from '../../src/tools/map.list.js';
import { handle as resolveHandle } from '../../src/tools/map.resolve.js';
import { handle as updateHandle } from '../../src/tools/map.update.js';
import { handle as deleteHandle } from '../../src/tools/map.delete.js';

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
const validateUpdateInput = ajv.compile(updateInputSchema);
const validateUpdateOutput = ajv.compile(updateOutputSchema);
const validateDeleteInput = ajv.compile(deleteInputSchema);
const validateDeleteOutput = ajv.compile(deleteOutputSchema);

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
          { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum', mapping: { contained: 'primary' } } },
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
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum', mapping: { contained: 'primary' } } },
      ],
      confidence: 'manual',
    });

    expect(validateCreateOutput(createResult)).toBe(true);
    expect(createResult.status).toBe('ok');
    expect(createResult.mapping).toBeDefined();
    expect((createResult.mapping as any).id).toBe('material-button');
    expect(createResult.etag).toMatch(/^[a-f0-9]{64}$/);
    expect(createResult.applied).toBe(true);

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
    expect(resolveResult.propTranslations![0].coercionType).toBe('enum');
  });

  it('resolve success uses the documented ok/not_found status model', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await resolveHandle({
      externalSystem: 'material',
      externalComponent: 'Button',
    });

    expect(validateResolveOutput(result)).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.message).toBeUndefined();
  });
});

describe('map.create trait validation', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('warns on unknown trait references', async () => {
    const result = await createHandle({
      apply: true,
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
      apply: true,
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
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const duplicate = await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    expect(validateCreateOutput(duplicate)).toBe(true);
    expect(duplicate.status).toBe('error');
    expect(duplicate.applied).toBe(false);
    expect(duplicate.errors).toBeDefined();
    expect(duplicate.errors!.details.some((d) => d.field === 'externalSystem')).toBe(true);
  });

  it('allows same component name from different systems', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await createHandle({
      apply: true,
      externalSystem: 'ant-design',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    expect(result.status).toBe('ok');
    expect((result.mapping as any).id).toBe('ant-design-button');
  });
});

describe('map.create apply flag', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('does not persist mappings when apply is false', async () => {
    const result = await createHandle({
      apply: false,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    expect(validateCreateOutput(result)).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.warnings?.some((w: string) => w.includes('Dry run'))).toBe(true);

    const listResult = await listHandle({});
    expect(listResult.totalCount).toBe(0);
  });
});

describe('multi-system mappings', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('creates mappings from multiple systems and filters by system', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'TextField',
      oodsTraits: ['Labelled', 'Stateful'],
    });
    await createHandle({
      apply: true,
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
      apply: true,
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
      apply: true,
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
      apply: true,
      externalSystem: 'test-system',
      externalComponent: 'TestComponent',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum', mapping: { a: 'b' } } },
        { externalProp: 'inverted', oodsProp: 'active', coercion: { type: 'boolean_to_string', trueValue: 'yes', falseValue: 'no' } },
        { externalProp: 'width', oodsProp: 'size', coercion: { type: 'template', pattern: '{{value}}px' } },
        { externalProp: 'passthrough', oodsProp: 'passthrough', coercion: { type: 'identity' } },
        { externalProp: 'label', oodsProp: 'text', coercion: null },
      ],
    });

    expect(result.status).toBe('ok');

    const resolveResult = await resolveHandle({
      externalSystem: 'test-system',
      externalComponent: 'TestComponent',
    });

    expect(resolveResult.propTranslations!.length).toBe(5);
    expect(resolveResult.propTranslations![0].coercionType).toBe('enum');
    expect(resolveResult.propTranslations![1].coercionType).toBe('boolean_to_string');
    expect(resolveResult.propTranslations![2].coercionType).toBe('template');
    expect(resolveResult.propTranslations![3].coercionType).toBe('identity');
    // null coercion is normalized to identity
    expect(resolveResult.propTranslations![4].coercionType).toBe('identity');
  });
});

describe('map.create auto-generated metadata', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('sets createdAt timestamp automatically', async () => {
    const before = new Date().toISOString();
    const result = await createHandle({
      apply: true,
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
      apply: true,
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
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    expect((result.mapping as any).confidence).toBe('manual');
  });
});

// ── map.update tests ──

describe('map.update schema validation', () => {
  it('accepts valid update input', () => {
    expect(
      validateUpdateInput({
        id: 'material-button',
        updates: { confidence: 'auto' },
      }),
    ).toBe(true);
  });

  it('rejects update with empty updates', () => {
    expect(
      validateUpdateInput({
        id: 'material-button',
        updates: {},
      }),
    ).toBe(false);
  });
});

describe('map.update handler', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('updates confidence from manual to auto', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      confidence: 'manual',
    });

    const result = await updateHandle({
      id: 'material-button',
      updates: { confidence: 'auto' },
    });

    expect(validateUpdateOutput(result)).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.changes).toContain('confidence');
    expect((result.mapping as any).confidence).toBe('auto');
    expect((result.mapping as any).metadata.updatedAt).toBeDefined();
  });

  it('updates oodsTraits', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await updateHandle({
      id: 'material-button',
      updates: { oodsTraits: ['Stateful', 'Taggable'] },
    });

    expect(result.status).toBe('ok');
    expect((result.mapping as any).oodsTraits).toEqual(['Stateful', 'Taggable']);
    expect(result.changes).toContain('oodsTraits');
  });

  it('updates notes in metadata', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await updateHandle({
      id: 'material-button',
      updates: { notes: 'Verified mapping' },
    });

    expect(result.status).toBe('ok');
    expect((result.mapping as any).metadata.notes).toBe('Verified mapping');
    expect(result.changes).toContain('notes');
  });

  it('updates propMappings with new coercion', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: null },
      ],
    });

    const result = await updateHandle({
      id: 'material-button',
      updates: {
        propMappings: [
          { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum', mapping: { primary: 'filled' } } },
        ],
      },
    });

    expect(result.status).toBe('ok');
    expect(result.changes).toContain('propMappings');
  });

  it('returns error for invalid ID', async () => {
    const result = await updateHandle({
      id: 'nonexistent-mapping',
      updates: { confidence: 'auto' },
    });

    expect(validateUpdateOutput(result)).toBe(true);
    expect(result.status).toBe('error');
    expect(result.message).toContain('nonexistent-mapping');
  });

  it('persists updates visible to list', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
      confidence: 'auto',
    });

    await updateHandle({
      id: 'material-button',
      updates: { confidence: 'manual' },
    });

    const listResult = await listHandle({});
    const mapping = listResult.mappings.find((m: any) => m.id === 'material-button') as any;
    expect(mapping.confidence).toBe('manual');
  });
});

// ── map.delete tests ──

describe('map.delete schema validation', () => {
  it('accepts valid delete input', () => {
    expect(validateDeleteInput({ id: 'material-button' })).toBe(true);
  });

  it('rejects delete without id', () => {
    expect(validateDeleteInput({})).toBe(false);
  });
});

describe('map.delete handler', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('deletes an existing mapping and returns the deleted summary object', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    const result = await deleteHandle({ id: 'material-button' });

    expect(validateDeleteOutput(result)).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.etag).toMatch(/^[a-f0-9]{64}$/);
    expect(result.deleted!.id).toBe('material-button');
    expect(result.deleted!.externalSystem).toBe('material');
    expect(result.deleted!.externalComponent).toBe('Button');
  });

  it('map_list reflects deletion', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    await deleteHandle({ id: 'material-button' });

    const listResult = await listHandle({});
    expect(listResult.totalCount).toBe(0);
  });

  it('returns error for double-delete', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'material',
      externalComponent: 'Button',
      oodsTraits: ['Stateful'],
    });

    await deleteHandle({ id: 'material-button' });
    const result = await deleteHandle({ id: 'material-button' });

    expect(validateDeleteOutput(result)).toBe(true);
    expect(result.status).toBe('error');
    expect(result.message).toContain('material-button');
  });

  it('returns error for nonexistent ID', async () => {
    const result = await deleteHandle({ id: 'nonexistent-mapping' });

    expect(validateDeleteOutput(result)).toBe(true);
    expect(result.status).toBe('error');
  });
});

// ── map_resolve + coercion integration ──

describe('map_resolve coercion integration', () => {
  beforeEach(() => {
    resetMappingsFile();
  });

  it('resolves enum coercion with mapping details', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'test',
      externalComponent: 'Btn',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum', mapping: { primary: 'filled', secondary: 'outlined' } } },
      ],
    });

    const result = await resolveHandle({
      externalSystem: 'test',
      externalComponent: 'Btn',
    });

    expect(result.status).toBe('ok');
    const translation = result.propTranslations![0];
    expect(translation.coercionType).toBe('enum');
    expect(translation.coercionDetail).toEqual({
      type: 'enum',
      mapping: { primary: 'filled', secondary: 'outlined' },
    });
  });

  it('normalizes null coercion to identity in resolution', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'test',
      externalComponent: 'Input',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'value', oodsProp: 'value', coercion: null },
      ],
    });

    const result = await resolveHandle({
      externalSystem: 'test',
      externalComponent: 'Input',
    });

    expect(result.propTranslations![0].coercionType).toBe('identity');
    expect(result.propTranslations![0].coercionDetail).toEqual({ type: 'identity' });
  });

  it('resolves boolean_to_string coercion details', async () => {
    await createHandle({
      apply: true,
      externalSystem: 'test',
      externalComponent: 'Toggle',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'checked', oodsProp: 'active', coercion: { type: 'boolean_to_string', trueValue: 'on', falseValue: 'off' } },
      ],
    });

    const result = await resolveHandle({
      externalSystem: 'test',
      externalComponent: 'Toggle',
    });

    expect(result.propTranslations![0].coercionType).toBe('boolean_to_string');
    expect(result.propTranslations![0].coercionDetail).toEqual({
      type: 'boolean_to_string',
      trueValue: 'on',
      falseValue: 'off',
    });
  });
});
