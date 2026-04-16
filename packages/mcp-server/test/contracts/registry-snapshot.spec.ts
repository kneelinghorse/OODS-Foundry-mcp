import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/registry.snapshot.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/registry.snapshot.output.json' assert { type: 'json' };
import { handle as snapshotHandle } from '../../src/tools/registry.snapshot.js';
import type { RegistrySnapshotOutput } from '../../src/tools/types.js';
import type { ComponentMapping } from '../../src/tools/map.shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const MAPPINGS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'component-mappings.json');

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

let originalMappings: string | null = null;

beforeAll(() => {
  originalMappings = fs.existsSync(MAPPINGS_PATH) ? fs.readFileSync(MAPPINGS_PATH, 'utf8') : null;
});

afterAll(() => {
  if (originalMappings === null) {
    fs.rmSync(MAPPINGS_PATH, { force: true });
    return;
  }
  fs.writeFileSync(MAPPINGS_PATH, originalMappings);
});

function buildMappings(count: number): ComponentMapping[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `bench-system-component-${index + 1}`,
    externalSystem: 'bench-system',
    externalComponent: `Component ${index + 1}`,
    oodsTraits: ['Stateful', 'Labelled'],
    confidence: 'manual' as const,
    metadata: {
      createdAt: '2026-04-16T00:00:00.000Z',
      notes: `Benchmark mapping ${index + 1}`,
    },
  }));
}

function writeMappings(mappings: ComponentMapping[]): void {
  fs.writeFileSync(
    MAPPINGS_PATH,
    JSON.stringify(
      {
        $schema: '../../packages/mcp-server/src/schemas/component-mapping.schema.json',
        generatedAt: '2026-04-16T00:00:00.000Z',
        version: '2026-04-16',
        stats: {
          mappingCount: mappings.length,
          systemCount: new Set(mappings.map((mapping) => mapping.externalSystem)).size,
        },
        mappings,
      },
      null,
      2,
    ) + '\n',
  );
}

beforeEach(() => {
  writeMappings(buildMappings(3));
});

describe('registry.snapshot schema validation', () => {
  it('accepts empty input', () => {
    expect(validateInput({})).toBe(true);
  });

  it('accepts the bulk-read output shape', () => {
    const sample: RegistrySnapshotOutput = {
      maps: [
        {
          id: 'bench-system-component-1',
          externalSystem: 'bench-system',
          externalComponent: 'Component 1',
          oodsTraits: ['Stateful', 'Labelled'],
          confidence: 'manual',
        },
      ],
      traits: {
        Addressable: {
          name: 'Addressable',
          version: '1.0.0',
          description: 'Canonical multi-role address trait.',
          category: 'core',
          tags: ['address'],
          contexts: ['detail', 'form'],
          objects: ['User'],
          source: 'traits/core/Addressable.trait.yaml',
        },
      },
      objects: {
        User: {
          name: 'User',
          version: '1.0.0',
          domain: 'core.identity',
          description: 'Canonical user object.',
          tags: ['identity'],
          traits: [
            {
              reference: 'core/Identifiable',
              alias: 'UserIdentity',
              parameters: {},
            },
          ],
          fields: ['user_id'],
          source: 'objects/core/User.object.yaml',
        },
      },
      generatedAt: '2026-04-16T00:00:00.000Z',
      etag: '6d6224a2293e24fcefff2060dc60d8b3cf516af14f8d8f7344e3d5d726b7d0d6',
    };

    expect(validateOutput(sample)).toBe(true);
  });
});

describe('registry.snapshot handler', () => {
  it('returns maps, traits, objects, etag, and generatedAt in one call', async () => {
    const result = await snapshotHandle({});

    expect(validateOutput(result)).toBe(true);
    expect(result.maps).toHaveLength(3);
    expect(Object.keys(result.traits).length).toBeGreaterThan(0);
    expect(Object.keys(result.objects).length).toBeGreaterThan(0);
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.etag).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps the etag stable across unchanged registry state', async () => {
    const first = await snapshotHandle({});
    const second = await snapshotHandle({});

    expect(second.etag).toBe(first.etag);
    expect(second.maps).toEqual(first.maps);
    expect(second.traits).toEqual(first.traits);
    expect(second.objects).toEqual(first.objects);
  });

  it('benchmarks under 200ms p99 at 100, 500, and 1000 mappings', async () => {
    for (const mappingCount of [100, 500, 1000]) {
      writeMappings(buildMappings(mappingCount));

      const durations: number[] = [];
      for (let iteration = 0; iteration < 12; iteration += 1) {
        const started = performance.now();
        const result = await snapshotHandle({});
        durations.push(performance.now() - started);
        expect(result.maps).toHaveLength(mappingCount);
      }

      const sorted = [...durations].sort((left, right) => left - right);
      const p99 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.99) - 1)];
      expect(p99).toBeLessThan(200);
    }
  });
});
