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
});

describe('structuredData.fetch handler', () => {
  it('returns components payload with validated schema and stable etag', async () => {
    const result = await handle({ dataset: 'components' });

    expect(validateOutput(result)).toBe(true);
    expect(result.schemaValidated).toBe(true);
    expect(result.payloadIncluded).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.meta?.componentCount).toBeGreaterThan(0);
    expect(result.etag).toBe(computeStructuredDataEtag(result.payload));
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
