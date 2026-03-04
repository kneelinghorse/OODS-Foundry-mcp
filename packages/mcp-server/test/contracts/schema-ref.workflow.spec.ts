import { describe, expect, it } from 'vitest';
import { handle as composeHandle } from '../../src/tools/design.compose.js';
import { handle as validateHandle } from '../../src/tools/repl.validate.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import { handle as codegenHandle } from '../../src/tools/code.generate.js';

describe('schemaRef workflow', () => {
  it('design.compose returns schemaRef and downstream tools accept it', async () => {
    const compose = await composeHandle({ intent: 'user registration form' });
    expect(compose.status).toBe('ok');
    expect(compose.schemaRef).toBeTruthy();

    const schemaRef = compose.schemaRef!;
    const validation = await validateHandle({ mode: 'full', schemaRef });
    expect(validation.status).toBe('ok');

    const render = await renderHandle({ mode: 'full', schemaRef, apply: true });
    expect(render.status).toBe('ok');
    expect(render.html).toContain('<!DOCTYPE html>');

    const codegen = await codegenHandle({ schemaRef, framework: 'react' });
    expect(codegen.status).toBe('ok');
    expect(codegen.code.length).toBeGreaterThan(0);
  });

  it('missing schemaRef returns actionable errors', async () => {
    const missingRef = 'compose-missing-ref';

    const validation = await validateHandle({ mode: 'full', schemaRef: missingRef });
    expect(validation.status).toBe('invalid');
    expect(validation.errors[0].code).toMatch(/SCHEMA_REF/);
    expect(validation.errors[0].hint).toContain('design.compose');

    const render = await renderHandle({ mode: 'full', schemaRef: missingRef });
    expect(render.status).toBe('error');
    expect(render.errors[0].code).toMatch(/SCHEMA_REF/);
    expect(render.errors[0].hint).toContain('design.compose');

    const codegen = await codegenHandle({ schemaRef: missingRef, framework: 'react' });
    expect(codegen.status).toBe('error');
    expect(codegen.errors?.[0].code).toMatch(/SCHEMA_REF/);
    expect(codegen.errors?.[0].message).toContain('design.compose');
  });
});
