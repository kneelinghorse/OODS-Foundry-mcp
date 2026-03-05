import { describe, expect, it } from 'vitest';
import { getAjv } from '../../lib/ajv.js';
import type { UiSchema } from '../../schemas/generated.js';
import inputSchema from '../../schemas/code.generate.input.json' assert { type: 'json' };
import { handle } from '../code.generate.js';

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);

const schemaFixture: UiSchema = {
  version: '2026.03',
  screens: [
    {
      id: 'screen-root',
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'stack-compact' },
      children: [
        {
          id: 'primary-button',
          component: 'Button',
          props: {
            label: 'Save',
            intent: 'primary',
            size: 'sm',
          },
        },
        {
          id: 'secondary-button',
          component: 'Button',
          props: {
            label: 'Cancel',
            intent: 'secondary',
            size: 'lg',
          },
        },
      ],
    },
  ],
};

describe('code.generate tool', () => {
  it('accepts tailwind styling in input schema', () => {
    const valid = validateInput({
      framework: 'react',
      schema: schemaFixture,
      options: {
        styling: 'tailwind',
      },
    });

    expect(valid).toBe(true);
  });

  it('emits Tailwind classes for React and Vue when styling=tailwind', async () => {
    const reactResult = await handle({
      framework: 'react',
      schema: schemaFixture,
      options: {
        styling: 'tailwind',
      },
    });
    const vueResult = await handle({
      framework: 'vue',
      schema: schemaFixture,
      options: {
        styling: 'tailwind',
      },
    });

    expect(reactResult.status).toBe('ok');
    expect(reactResult.code).toContain('className=');
    expect(reactResult.code).not.toContain('style={{');

    expect(vueResult.status).toBe('ok');
    expect(vueResult.code).toContain(':class=');
    expect(vueResult.code).not.toContain('style="display:');
  });

  it('defaults to tokens styling when options are omitted', async () => {
    const result = await handle({
      framework: 'react',
      schema: schemaFixture,
    });

    expect(result.status).toBe('ok');
    expect(result.code).toContain('style={{');
  });
});
