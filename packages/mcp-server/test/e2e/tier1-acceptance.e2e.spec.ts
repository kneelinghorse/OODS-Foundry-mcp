/**
 * Tier 1 Acceptance Test — Sprint 65
 *
 * Validates the full Tier 1 Production Essentials flow:
 *   1. pipeline(object, context, framework, styling=tailwind, save) → React Tailwind output + saved schema
 *   2. schema_load(name) → schemaRef from persistence
 *   3. code_generate(schemaRef, vue, tailwind) → Vue Tailwind output from loaded schema
 *   4. health() → schemas.savedCount reflects persisted schemas
 *
 * This test exercises the end-to-end path across pipeline orchestration,
 * Tailwind codegen, schema persistence, and health introspection.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handle as pipelineHandle } from '../../src/tools/pipeline.js';
import { handle as schemaLoadHandle } from '../../src/tools/schema/load.js';
import { handle as codegenHandle } from '../../src/tools/code.generate.js';
import { handle as healthHandle } from '../../src/tools/health.js';

describe('Tier 1 acceptance — pipeline + tailwind + save + load + health', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-tier1-'));
    process.env.MCP_SCHEMA_STORE_ROOT = tempRoot;
  });

  afterEach(async () => {
    delete process.env.MCP_SCHEMA_STORE_ROOT;
    delete process.env.MCP_SCHEMA_STORE_DIR;
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('full Tier 1 flow: pipeline → save → load → codegen → health', async () => {
    // ── Step 1: pipeline with Tailwind + save ─────────────────────
    const pipelineResult = await pipelineHandle({
      object: 'Subscription',
      context: 'detail',
      framework: 'react',
      styling: 'tailwind',
      save: 'sub-detail-tw',
    });

    // Pipeline ran without errors
    expect(pipelineResult.error).toBeUndefined();
    expect(pipelineResult.compose.object).toBe('Subscription');
    expect(pipelineResult.compose.componentCount).toBeGreaterThan(0);

    // Pipeline steps include save
    expect(pipelineResult.pipeline.steps).toContain('compose');
    expect(pipelineResult.pipeline.steps).toContain('codegen');
    expect(pipelineResult.pipeline.steps).toContain('save');
    expect(pipelineResult.pipeline.duration).toBeGreaterThan(0);

    // React code has Tailwind classes
    expect(pipelineResult.code).toBeDefined();
    expect(pipelineResult.code!.framework).toBe('react');
    expect(pipelineResult.code!.styling).toBe('tailwind');
    expect(pipelineResult.code!.output).toContain('className=');
    expect(pipelineResult.code!.output).not.toContain('style={{');

    // Interactive state classes present
    expect(pipelineResult.code!.output).toMatch(/focus:|disabled:|hover:/);

    // Schema was saved
    expect(pipelineResult.saved).toBeDefined();
    expect(pipelineResult.saved!.name).toBe('sub-detail-tw');
    expect(pipelineResult.saved!.version).toBeGreaterThanOrEqual(1);

    // schemaRef returned for downstream use
    expect(pipelineResult.schemaRef).toBeTruthy();

    // ── Step 2: schema_load from persistence ──────────────────────
    const loadResult = await schemaLoadHandle({ name: 'sub-detail-tw' });

    expect(loadResult.name).toBe('sub-detail-tw');
    expect(loadResult.schemaRef).toBeTruthy();
    expect(loadResult.version).toBeGreaterThanOrEqual(1);

    // ── Step 3: code_generate Vue with Tailwind from loaded schema ─
    const vueResult = await codegenHandle({
      schemaRef: loadResult.schemaRef,
      framework: 'vue',
      options: { styling: 'tailwind' },
    });

    expect(vueResult.status).toBe('ok');
    expect(vueResult.fileExtension).toBe('.vue');

    // Vue code has Tailwind classes
    expect(vueResult.code).toContain('class=');
    expect(vueResult.code).not.toContain('style="display:');

    // Interactive state classes in Vue output
    expect(vueResult.code).toMatch(/focus:|disabled:|hover:/);

    // SFC structure
    expect(vueResult.code).toContain('<template>');
    expect(vueResult.code).toContain('<script setup');

    // ── Step 4: health reports saved schema ───────────────────────
    const healthResult = await healthHandle();

    expect(healthResult.status === 'ok' || healthResult.status === 'degraded').toBe(true);
    expect(healthResult.schemas.savedCount).toBeGreaterThanOrEqual(1);
  });

  it('pipeline with skipValidation and skipRender still produces Tailwind output', async () => {
    const result = await pipelineHandle({
      object: 'Subscription',
      context: 'detail',
      framework: 'react',
      styling: 'tailwind',
      options: { skipValidation: true, skipRender: true },
    });

    expect(result.error).toBeUndefined();
    expect(result.pipeline.steps).toEqual(['compose', 'codegen']);
    expect(result.code!.output).toContain('className=');
    expect(result.code!.output).toMatch(/focus:|disabled:|hover:/);
  });

  it('pipeline with Vue framework produces Tailwind-styled Vue SFC', async () => {
    const result = await pipelineHandle({
      object: 'Subscription',
      context: 'detail',
      framework: 'vue',
      styling: 'tailwind',
    });

    expect(result.error).toBeUndefined();
    expect(result.code!.framework).toBe('vue');
    expect(result.code!.styling).toBe('tailwind');
    expect(result.code!.output).toContain('class=');
    expect(result.code!.output).toContain('<template>');
    expect(result.code!.output).toContain('<script setup');
  });
});
