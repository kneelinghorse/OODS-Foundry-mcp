/**
 * Cross-framework parity tests (s78-m04).
 *
 * Validates that React, Vue, and HTML emitters produce structurally
 * equivalent output for the same input schemas across all three
 * styling modes (inline/tokens/tailwind).
 */
import { describe, expect, it } from 'vitest';
import type { UiSchema, FieldSchemaEntry } from '../../src/schemas/generated.js';
import { emit as reactEmit } from '../../src/codegen/react-emitter.js';
import { emit as vueEmit } from '../../src/codegen/vue-emitter.js';
import { emit as htmlEmit } from '../../src/codegen/html-emitter.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

/* ------------------------------------------------------------------ */
/*  Shared test schemas                                                */
/* ------------------------------------------------------------------ */

const formSchema: UiSchema = {
  version: '2026.02',
  objectSchema: {
    name: { type: 'string', required: true, description: 'Full name' },
    email: { type: 'email', required: true, description: 'Email address' },
    role: { type: 'string', required: false, enum: ['admin', 'user', 'guest'] },
  },
  screens: [
    {
      id: 'form-root',
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'cluster-default' },
      style: { spacingToken: 'inset-default' },
      children: [
        { id: 'name-input', component: 'Input', props: { field: 'name', label: 'Full name', placeholder: 'Enter name' } },
        { id: 'email-input', component: 'Input', props: { field: 'email', label: 'Email address', placeholder: 'Enter email', type: 'email' } },
        { id: 'role-select', component: 'Select', props: { field: 'role', options: ['admin', 'user', 'guest'] } },
        {
          id: 'actions',
          component: 'Stack',
          layout: { type: 'inline', align: 'end' },
          children: [
            { id: 'submit-btn', component: 'Button', props: { label: 'Submit' }, bindings: { onSubmit: 'handleSubmit' } },
          ],
        },
      ],
    },
  ],
};

const nestedSchema: UiSchema = {
  version: '2026.02',
  screens: [
    {
      id: 'page',
      component: 'Stack',
      layout: { type: 'sidebar' },
      children: [
        {
          id: 'main',
          component: 'Stack',
          layout: { type: 'stack' },
          children: [
            { id: 'header', component: 'Text', props: { as: 'h1' } },
            {
              id: 'content',
              component: 'Card',
              style: { radiusToken: 'md', shadowToken: 'sm' },
              children: [
                { id: 'body', component: 'Text', props: { text: 'Content here' } },
              ],
            },
          ],
        },
        { id: 'sidebar', component: 'Stack', layout: { type: 'stack' }, children: [
          { id: 'side-badge', component: 'Badge', props: { label: 'Status' } },
        ]},
      ],
    },
  ],
};

const dashboardSchema: UiSchema = {
  version: '2026.02',
  objectSchema: {
    status: { type: 'string', required: true, enum: ['active', 'inactive'] },
    created_at: { type: 'datetime', required: true },
  },
  screens: [
    {
      id: 'dashboard',
      component: 'Stack',
      layout: { type: 'stack' },
      children: [
        { id: 'status-badge', component: 'StatusBadge', props: { field: 'status' } },
        { id: 'timestamp', component: 'RelativeTimestamp', props: { field: 'created_at' } },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Styling mode options                                               */
/* ------------------------------------------------------------------ */

const stylingModes: Array<{ name: string; options: CodegenOptions }> = [
  { name: 'tokens', options: { typescript: true, styling: 'tokens' } },
  { name: 'inline', options: { typescript: true, styling: 'inline' } },
  { name: 'tailwind', options: { typescript: true, styling: 'tailwind' } },
];

/* ------------------------------------------------------------------ */
/*  Cross-framework parity tests                                       */
/* ------------------------------------------------------------------ */

describe('cross-framework parity', () => {
  describe('form schema', () => {
    for (const { name, options } of stylingModes) {
      describe(`styling: ${name}`, () => {
        it('all frameworks emit successfully', () => {
          const react = reactEmit(formSchema, options);
          const vue = vueEmit(formSchema, options);
          const html = htmlEmit(formSchema, options);

          expect(react.status).toBe('ok');
          expect(vue.status).toBe('ok');
          expect(html.status).toBe('ok');
        });

        it('React and Vue include component imports', () => {
          const react = reactEmit(formSchema, options);
          const vue = vueEmit(formSchema, options);

          expect(react.code).toContain('Input');
          expect(react.code).toContain('Select');
          expect(react.code).toContain('Button');
          expect(vue.code).toContain('Input');
          expect(vue.code).toContain('Select');
          expect(vue.code).toContain('Button');
        });

        it('all frameworks handle field binding', () => {
          const react = reactEmit(formSchema, options);
          const vue = vueEmit(formSchema, options);
          const html = htmlEmit(formSchema, options);

          // React uses JSX expression binding
          expect(react.code).toContain('{name}');
          // Vue uses template interpolation or v-bind
          expect(vue.code).toMatch(/\{\{\s*name\s*\}\}|:value="name"/);
          // HTML uses data-bind attributes
          expect(html.code).toContain('data-bind');
        });

        it('all frameworks handle event bindings', () => {
          const react = reactEmit(formSchema, options);
          const vue = vueEmit(formSchema, options);

          expect(react.code).toContain('onSubmit={handleSubmit}');
          expect(vue.code).toContain('@submit="handleSubmit"');
        });
      });
    }
  });

  describe('nested schema with sidebar layout', () => {
    for (const { name, options } of stylingModes) {
      it(`${name}: all frameworks handle sidebar layout`, () => {
        const react = reactEmit(nestedSchema, options);
        const vue = vueEmit(nestedSchema, options);
        const html = htmlEmit(nestedSchema, options);

        expect(react.status).toBe('ok');
        expect(vue.status).toBe('ok');
        expect(html.status).toBe('ok');

        // React and Vue both emit sidebar wrapper elements
        expect(react.code).toContain('data-sidebar-main');
        expect(react.code).toContain('data-sidebar-aside');
        expect(vue.code).toContain('data-sidebar-main');
        expect(vue.code).toContain('data-sidebar-aside');
      });
    }
  });

  describe('dashboard schema with field bindings', () => {
    for (const { name, options } of stylingModes) {
      it(`${name}: all frameworks handle status-prop and children-strategy bindings`, () => {
        const react = reactEmit(dashboardSchema, options);
        const vue = vueEmit(dashboardSchema, options);
        const html = htmlEmit(dashboardSchema, options);

        expect(react.status).toBe('ok');
        expect(vue.status).toBe('ok');
        expect(html.status).toBe('ok');

        // StatusBadge uses status-prop strategy
        expect(react.code).toContain('status={status}');
        expect(vue.code).toContain(':status="status"');

        // RelativeTimestamp uses children strategy
        expect(react.code).toContain('{createdAt}');
        expect(vue.code).toContain('{{ createdAt }}');
      });
    }
  });

  describe('TypeScript output', () => {
    it('React emits PageProps interface for objectSchema', () => {
      const result = reactEmit(formSchema, { typescript: true, styling: 'tokens' });
      expect(result.code).toContain('export interface PageProps');
      expect(result.code).toContain('name: string');
      expect(result.code).toContain('email: string');
      expect(result.fileExtension).toBe('.tsx');
    });

    it('Vue emits Props interface in script setup', () => {
      const result = vueEmit(formSchema, { typescript: true, styling: 'tokens' });
      expect(result.code).toContain('interface Props');
      expect(result.code).toContain('defineProps<Props>');
      expect(result.fileExtension).toBe('.vue');
    });
  });
});
