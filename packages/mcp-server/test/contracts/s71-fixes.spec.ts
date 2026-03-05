import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import catalogOutputSchema from '../../src/schemas/catalog.list.output.json' assert { type: 'json' };
import pipelineOutputSchema from '../../src/schemas/pipeline.output.json' assert { type: 'json' };
import { handle as catalogHandle } from '../../src/tools/catalog.list.js';
import type { CatalogListOutput } from '../../src/tools/types.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ajv = getAjv();
const validateCatalogOutput = ajv.compile(catalogOutputSchema);
const validatePipelineOutput = ajv.compile(pipelineOutputSchema);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../');
const codeConnectPath = path.join(repoRoot, 'artifacts', 'structured-data', 'code-connect.json');

describe('Sprint 71 fixes', () => {
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

  // ── catalog.list availableCategories ────────────────────────────────

  describe('catalog.list availableCategories', () => {
    it('returns availableCategories as a sorted string array', async () => {
      const result = await catalogHandle({});
      expect(result.availableCategories).toBeDefined();
      expect(Array.isArray(result.availableCategories)).toBe(true);
      expect(result.availableCategories.length).toBeGreaterThan(0);

      // Verify sorted
      const sorted = [...result.availableCategories].sort();
      expect(result.availableCategories).toEqual(sorted);
    });

    it('includes known categories', async () => {
      const result = await catalogHandle({});
      expect(result.availableCategories).toContain('core');
      expect(result.availableCategories).toContain('behavioral');
    });

    it('returns same availableCategories regardless of filter', async () => {
      const unfiltered = await catalogHandle({});
      const filtered = await catalogHandle({ category: 'core' });
      expect(filtered.availableCategories).toEqual(unfiltered.availableCategories);
    });

    it('passes output schema validation with availableCategories', async () => {
      const result = await catalogHandle({});
      const valid = validateCatalogOutput(result);
      expect(valid).toBe(true);
      if (!valid) {
        console.error('Schema validation errors:', validateCatalogOutput.errors);
      }
    });
  });

  // ── pipeline output schema includes TTL fields ─────────────────────

  describe('pipeline output schema TTL fields', () => {
    it('pipeline output schema allows schemaRefCreatedAt', () => {
      const sample = {
        compose: { layout: 'auto', componentCount: 1 },
        pipeline: { steps: ['compose'], duration: 100 },
        schemaRef: 'ref:test',
        schemaRefCreatedAt: '2026-03-05T00:00:00.000Z',
        schemaRefExpiresAt: '2026-03-05T00:30:00.000Z',
      };
      expect(validatePipelineOutput(sample)).toBe(true);
    });

    it('pipeline output schema still valid without TTL fields', () => {
      const sample = {
        compose: { layout: 'auto', componentCount: 1 },
        pipeline: { steps: ['compose'], duration: 100 },
        schemaRef: 'ref:test',
      };
      expect(validatePipelineOutput(sample)).toBe(true);
    });
  });

  // ── tool-descriptions.json ─────────────────────────────────────────

  describe('tool-descriptions.json documentation', () => {
    let descriptions: Record<string, string>;

    beforeAll(() => {
      const descPath = path.join(repoRoot, 'packages', 'mcp-adapter', 'tool-descriptions.json');
      descriptions = JSON.parse(fs.readFileSync(descPath, 'utf8'));
    });

    it('documents apply defaults for tools that use apply param', () => {
      const toolsWithApply = ['tokens.build', 'brand.apply', 'map.create', 'repl.render'];
      for (const tool of toolsWithApply) {
        expect(descriptions[tool]).toBeDefined();
        expect(descriptions[tool].toLowerCase()).toMatch(/apply/);
      }
    });

    it('documents schemaRef TTL for compose tools', () => {
      expect(descriptions['design.compose']).toMatch(/TTL|expires|30/i);
      expect(descriptions['pipeline']).toMatch(/TTL|expires|30/i);
      expect(descriptions['viz.compose']).toMatch(/TTL|expires|30/i);
    });

    it('documents schema.save as persistence path', () => {
      expect(descriptions['schema.save']).toMatch(/persist|TTL/i);
    });

    it('documents availableCategories for catalog.list', () => {
      expect(descriptions['catalog.list']).toMatch(/availableCategories|categories/i);
    });
  });
});
