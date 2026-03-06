import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAjv } from '../../lib/ajv.js';
import type { UiSchema } from '../../schemas/generated.js';
import inputSchema from '../../schemas/health.input.json' assert { type: 'json' };
import outputSchema from '../../schemas/health.output.json' assert { type: 'json' };
import { SchemaStore } from '../../schema-store/index.js';
import { handle } from '../health.js';

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

function sampleSchema(): UiSchema {
  return {
    version: '2026.02',
    screens: [
      {
        id: 'health-schema-screen',
        component: 'Stack',
      },
    ],
  };
}

describe('health tool', () => {
  let tempRoot = '';
  let tempStructuredDir = '';

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-health-schema-store-'));
    tempStructuredDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oods-health-structured-'));
    process.env.MCP_SCHEMA_STORE_ROOT = tempRoot;
  });

  afterEach(async () => {
    delete process.env.MCP_SCHEMA_STORE_ROOT;
    delete process.env.MCP_SCHEMA_STORE_DIR;
    delete process.env.MCP_STRUCTURED_DATA_DIR;
    await fs.rm(tempRoot, { recursive: true, force: true });
    await fs.rm(tempStructuredDir, { recursive: true, force: true });
  });

  it('input schema validation is strict', () => {
    expect(validateInput({})).toBe(true);
    expect(validateInput({ extra: true })).toBe(false);
  });

  it('returns valid readiness shape and handles empty schema store', async () => {
    const output = await handle();
    expect(validateOutput(output)).toBe(true);
    expect(output.schemas.savedCount).toBe(0);
    expect(output.server.uptime).toBeGreaterThanOrEqual(0);
    expect(output.latency).toBeLessThan(100);
    expect(output.status === 'ok' || output.status === 'degraded').toBe(true);
  });

  it('reports saved schema count from schema store', async () => {
    const store = new SchemaStore({ projectRoot: tempRoot });
    await store.save({
      name: 'health_sample',
      schema: sampleSchema(),
      tags: ['health'],
    });

    const output = await handle();
    expect(validateOutput(output)).toBe(true);
    expect(output.schemas.savedCount).toBe(1);
  });

  it('returns degraded status with warnings when structured data is unavailable', async () => {
    process.env.MCP_STRUCTURED_DATA_DIR = tempStructuredDir;
    const output = await handle();

    expect(validateOutput(output)).toBe(true);
    expect(output.status).toBe('degraded');
    expect(output.warnings?.length).toBeGreaterThan(0);
    expect(output.tokens.built).toBe(false);
  });
});
