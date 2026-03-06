import { describe, expect, it } from 'vitest';
import type { UiSchema, FieldSchemaEntry } from '../../src/schemas/generated.js';
import { emit as reactEmit } from '../../src/codegen/react-emitter.js';
import { emit as vueEmit } from '../../src/codegen/vue-emitter.js';
import { emit as htmlEmit } from '../../src/codegen/html-emitter.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

const objectSchema: Record<string, FieldSchemaEntry> = {
  name: { type: 'string', required: true, description: 'Product name' },
  price: { type: 'number', required: true },
  sku: { type: 'string', required: false },
  status: { type: 'string', required: true, enum: ['active', 'inactive', 'draft'] },
};

const schema: UiSchema = {
  version: '2026.02',
  objectSchema,
  screens: [
    {
      id: 'detail-screen',
      component: 'Stack',
      layout: { type: 'stack' },
      children: [
        { id: 'name-text', component: 'Text', props: { field: 'name' } },
        { id: 'price-text', component: 'Text', props: { field: 'price' } },
        { id: 'status-badge', component: 'StatusBadge', props: { field: 'status' } },
        { id: 'sku-input', component: 'Input', props: { field: 'sku' } },
        { id: 'no-field', component: 'Button', props: { label: 'Save' } },
      ],
    },
  ],
};

const defaultOptions: CodegenOptions = {
  typescript: true,
  styling: 'tokens',
};

describe('codegen prop binding', () => {
  describe('React emitter', () => {
    it('injects field names as JSX children for children-strategy components', () => {
      const result = reactEmit(schema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain('{name}');
      expect(result.code).toContain('{price}');
    });

    it('injects field names as status prop for status-strategy components', () => {
      const result = reactEmit(schema, defaultOptions);
      expect(result.code).toContain('status={status}');
    });

    it('injects field names as value prop for value-strategy components', () => {
      const result = reactEmit(schema, defaultOptions);
      expect(result.code).toContain('value={sku}');
    });

    it('keeps self-closing for components without field binding', () => {
      const result = reactEmit(schema, defaultOptions);
      // Button has label="Save" but no field binding → remains self-closing
      expect(result.code).toMatch(/<Button[^>]*\/>/);
    });
  });

  describe('Vue emitter', () => {
    it('injects field names as template interpolation for children-strategy', () => {
      const result = vueEmit(schema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain('{{ name }}');
      expect(result.code).toContain('{{ price }}');
    });

    it('injects field names as :status binding for status-strategy', () => {
      const result = vueEmit(schema, defaultOptions);
      expect(result.code).toContain(':status="status"');
    });

    it('injects field names as :value binding for value-strategy', () => {
      const result = vueEmit(schema, defaultOptions);
      expect(result.code).toContain(':value="sku"');
    });
  });

  describe('HTML emitter', () => {
    it('injects data-bind attributes and placeholder text for field-bound components', () => {
      const result = htmlEmit(schema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain('data-bind="name"');
      expect(result.code).toContain('[name]');
    });
  });

  describe('enriched prop binding from objectSchema metadata', () => {
    // Schema with enriched props (as produced by compose with wireFieldProps)
    const enrichedSchema: UiSchema = {
      version: '2026.02',
      objectSchema: {
        email: { type: 'email', required: true, description: 'User email address' },
        role: { type: 'string', required: false, enum: ['admin', 'user', 'guest'] },
        bio: { type: 'string', required: false, description: 'User biography' },
      },
      screens: [
        {
          id: 'form-screen',
          component: 'Stack',
          layout: { type: 'stack' },
          children: [
            { id: 'email-input', component: 'Input', props: { field: 'email', label: 'User email address', placeholder: 'Enter email', type: 'email' } },
            { id: 'role-select', component: 'Select', props: { field: 'role', label: 'User role', placeholder: 'Enter role', options: ['admin', 'user', 'guest'] } },
            { id: 'bio-text', component: 'Textarea', props: { field: 'bio', label: 'User biography', placeholder: 'Enter bio' } },
          ],
        },
      ],
    };

    it('React emitter emits label from field description', () => {
      const result = reactEmit(enrichedSchema, defaultOptions);
      expect(result.code).toContain('label="User email address"');
    });

    it('React emitter emits placeholder for input-like components', () => {
      const result = reactEmit(enrichedSchema, defaultOptions);
      expect(result.code).toContain('placeholder="Enter email"');
    });

    it('React emitter emits type for email fields on Input', () => {
      const result = reactEmit(enrichedSchema, defaultOptions);
      expect(result.code).toContain('type="email"');
    });

    it('React emitter emits select options as prop', () => {
      const result = reactEmit(enrichedSchema, defaultOptions);
      expect(result.code).toContain('options=');
    });

    it('Vue emitter emits label and placeholder for form fields', () => {
      const result = vueEmit(enrichedSchema, defaultOptions);
      expect(result.code).toContain('label="User email address"');
      expect(result.code).toContain('placeholder="Enter email"');
    });

    it('HTML emitter emits data-bind for field-bound components', () => {
      const result = htmlEmit(enrichedSchema, defaultOptions);
      expect(result.code).toContain('data-bind="value:email"');
    });
  });

  describe('no regression for schemas without objectSchema', () => {
    const plainSchema: UiSchema = {
      version: '2026.02',
      screens: [{
        id: 'screen',
        component: 'Stack',
        children: [
          { id: 'btn', component: 'Button', props: { label: 'Click' } },
          { id: 'txt', component: 'Text', props: { text: 'Hello' } },
        ],
      }],
    };

    it('React emitter works without objectSchema', () => {
      const result = reactEmit(plainSchema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain('Button');
      expect(result.code).not.toContain('{undefined}');
    });

    it('Vue emitter works without objectSchema', () => {
      const result = vueEmit(plainSchema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain('Button');
    });

    it('HTML emitter works without objectSchema', () => {
      const result = htmlEmit(plainSchema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain('<!DOCTYPE html>');
    });
  });
});
