import { describe, it, expect } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/structuredData.fetch.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/structuredData.fetch.output.json' assert { type: 'json' };
import { handle, computeStructuredDataEtag } from '../../src/tools/structuredData.fetch.js';

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

describe('structuredData.fetch schemas', () => {
  it('accepts valid input payloads', () => {
    expect(validateInput({ dataset: 'components' })).toBe(true);
    expect(validateInput.errors).toBeNull();
  });

  it('rejects unknown datasets', () => {
    expect(validateInput({ dataset: 'other' })).toBe(false);
    expect(validateInput.errors).not.toBeNull();
  });

  it('accepts rollup kind+runPath inputs', () => {
    expect(
      validateInput({ kind: 'identity_graph', runPath: '/tmp/run/artifacts' }),
    ).toBe(true);
    expect(
      validateInput({ kind: 'capability_rollup', runPath: '/tmp/run/artifacts' }),
    ).toBe(true);
    expect(
      validateInput({ kind: 'object_rollup', runPath: '/tmp/run/artifacts' }),
    ).toBe(true);
  });

  it('rejects unknown rollup kinds', () => {
    expect(
      validateInput({ kind: 'mystery_rollup', runPath: '/tmp/run' }),
    ).toBe(false);
  });

  it('rejects kind without runPath', () => {
    expect(validateInput({ kind: 'identity_graph' })).toBe(false);
  });

  it('rejects mixing dataset with kind', () => {
    expect(
      validateInput({ dataset: 'components', kind: 'identity_graph', runPath: '/tmp' }),
    ).toBe(false);
  });

  it('rejects empty input (requires one of dataset or kind+runPath)', () => {
    expect(validateInput({})).toBe(false);
  });
});

describe('structuredData.fetch handler', () => {
  it('returns components payload with validated schema and stable etag', async () => {
    const result = await handle({ dataset: 'components' });
    const repeat = await handle({ dataset: 'components' });

    expect(validateOutput(result)).toBe(true);
    expect(result.schemaValidated).toBe(true);
    expect(result.payloadIncluded).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.meta?.componentCount).toBeGreaterThan(0);
    // ETag may come from manifest metadata or computed payload hash;
    // contract requires stability and ifNoneMatch compatibility.
    expect(result.etag).toBe(repeat.etag);
    expect(computeStructuredDataEtag(result.payload).length).toBe(64);
  });

  it('omits payload when ETag matches ifNoneMatch', async () => {
    const first = await handle({ dataset: 'tokens' });
    const second = await handle({ dataset: 'tokens', ifNoneMatch: first.etag });

    expect(second.matched).toBe(true);
    expect(second.payloadIncluded).toBe(false);
    expect(second.payload).toBeUndefined();
    expect(validateOutput(second)).toBe(true);
  });
});
