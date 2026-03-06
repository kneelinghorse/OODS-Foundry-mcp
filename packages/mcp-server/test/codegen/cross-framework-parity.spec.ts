/**
 * Cross-framework parity tests (s79-m02).
 *
 * Verifies that React, Vue, and HTML emitters all handle the same
 * component/slot patterns: nested children, sidebar layout, section layout,
 * field content injection, event bindings, objectSchema props, and token overrides.
 */
import { describe, it, expect } from 'vitest';
import { emit as reactEmit } from '../../src/codegen/react-emitter.js';
import { emit as vueEmit } from '../../src/codegen/vue-emitter.js';
import { emit as htmlEmit } from '../../src/codegen/html-emitter.js';
import type { UiSchema, FieldSchemaEntry } from '../../src/schemas/generated.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

const defaultOpts: CodegenOptions = { typescript: true, styling: 'tokens' };

/* ------------------------------------------------------------------ */
/*  Shared test schemas                                                */
/* ------------------------------------------------------------------ */

const nestedSchema: UiSchema = {
  version: '2026.03',
  screens: [
    {
      id: 'outer',
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'md' },
      children: [
        {
          id: 'card-1',
          component: 'Card',
          style: { radiusToken: 'sm' },
          children: [
            { id: 'text-1', component: 'Text', props: { content: 'Hello' } },
            {
              id: 'inner-stack',
              component: 'Stack',
              layout: { type: 'inline', align: 'center' },
              children: [
                { id: 'btn-1', component: 'Button', props: { label: 'Save' } },
                { id: 'btn-2', component: 'Button', props: { label: 'Cancel' } },
              ],
            },
          ],
        },
        { id: 'badge-1', component: 'Badge', props: { label: 'Active' } },
      ],
    },
  ],
};

const sidebarSchema: UiSchema = {
  version: '2026.03',
  screens: [
    {
      id: 'layout-root',
      component: 'Stack',
      layout: { type: 'sidebar' },
      children: [
        { id: 'main-content', component: 'Card', children: [
          { id: 'main-text', component: 'Text', props: { content: 'Main' } },
        ]},
        { id: 'aside-1', component: 'Badge', props: { label: 'Side' } },
        { id: 'aside-2', component: 'Button', props: { label: 'Action' } },
      ],
    },
  ],
};

const sectionSchema: UiSchema = {
  version: '2026.03',
  screens: [
    {
      id: 'section-root',
      component: 'Card',
      layout: { type: 'section' },
      style: { spacingToken: 'lg' },
      bindings: { onEdit: 'handleEdit' },
      children: [
        { id: 'sec-text', component: 'Text', props: { content: 'Section' } },
      ],
    },
  ],
};

const fieldBindingSchema: UiSchema = {
  version: '2026.03',
  objectSchema: {
    name: { type: 'string', required: true, description: 'Product name' },
    price: { type: 'number', required: true },
    status: { type: 'string', required: true, enum: ['active', 'inactive'] },
    email: { type: 'email', required: false, description: 'Contact email' },
  },
  screens: [
    {
      id: 'form-root',
      component: 'Stack',
      layout: { type: 'stack' },
      bindings: { onSubmit: 'handleSubmit' },
      children: [
        { id: 'name-text', component: 'Text', props: { field: 'name' } },
        { id: 'status-badge', component: 'StatusBadge', props: { field: 'status' } },
        { id: 'email-input', component: 'Input', props: { field: 'email' } },
        { id: 'price-text', component: 'Text', props: { field: 'price' } },
        { id: 'category-select', component: 'Select', props: { field: 'status' } },
      ],
    },
  ],
};

const tokenOverrideSchema: UiSchema = {
  version: '2026.03',
  tokenOverrides: {
    'color.primary': '#ff0000',
    'spacing.base': '8px',
  },
  screens: [
    {
      id: 'root',
      component: 'Card',
      style: { colorToken: 'primary' },
      children: [
        { id: 'text', component: 'Text', props: { content: 'Branded' } },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Parity tests                                                       */
/* ------------------------------------------------------------------ */

describe('cross-framework parity', () => {
  describe('nested children (3+ levels)', () => {
    const react = reactEmit(nestedSchema, defaultOpts);
    const vue = vueEmit(nestedSchema, defaultOpts);
    const html = htmlEmit(nestedSchema, defaultOpts);

    it('all frameworks emit ok', () => {
      expect(react.status).toBe('ok');
      expect(vue.status).toBe('ok');
      expect(html.status).toBe('ok');
    });

    it('all frameworks contain all component names', () => {
      for (const result of [react, vue, html]) {
        expect(result.code).toContain('Stack');
        expect(result.code).toContain('Card');
        expect(result.code).toContain('Text');
        expect(result.code).toContain('Button');
        expect(result.code).toContain('Badge');
      }
    });

    it('all frameworks contain all node ids', () => {
      const ids = ['outer', 'card-1', 'text-1', 'inner-stack', 'btn-1', 'btn-2', 'badge-1'];
      for (const result of [react, vue, html]) {
        for (const id of ids) {
          expect(result.code).toContain(id);
        }
      }
    });
  });

  describe('sidebar layout', () => {
    const react = reactEmit(sidebarSchema, defaultOpts);
    const vue = vueEmit(sidebarSchema, defaultOpts);
    const html = htmlEmit(sidebarSchema, defaultOpts);

    it('all frameworks emit ok', () => {
      expect(react.status).toBe('ok');
      expect(vue.status).toBe('ok');
      expect(html.status).toBe('ok');
    });

    it('React and Vue emit sidebar wrapper elements', () => {
      expect(react.code).toContain('data-sidebar-main');
      expect(react.code).toContain('data-sidebar-aside');
      expect(vue.code).toContain('data-sidebar-main');
      expect(vue.code).toContain('data-sidebar-aside');
    });

    it('all frameworks contain all component ids', () => {
      const ids = ['layout-root', 'main-content', 'aside-1', 'aside-2'];
      for (const result of [react, vue, html]) {
        for (const id of ids) {
          expect(result.code).toContain(id);
        }
      }
    });
  });

  describe('section layout with bindings', () => {
    const react = reactEmit(sectionSchema, defaultOpts);
    const vue = vueEmit(sectionSchema, defaultOpts);

    it('both frameworks wrap in section element', () => {
      expect(react.code).toContain('<section data-layout="section"');
      expect(vue.code).toContain('<section data-layout="section"');
    });

    it('both frameworks include binding on inner component (not section wrapper)', () => {
      // React: onEdit={handleEdit} on inner component
      expect(react.code).toMatch(/Card[^>]*onEdit=\{handleEdit\}/);
      // Vue: @edit="handleEdit" on inner component
      expect(vue.code).toMatch(/Card[^>]*@edit="handleEdit"/);
    });

    it('both frameworks generate handler stubs', () => {
      expect(react.code).toContain('const handleEdit');
      expect(vue.code).toContain('const handleEdit');
    });
  });

  describe('field content injection', () => {
    const react = reactEmit(fieldBindingSchema, defaultOpts);
    const vue = vueEmit(fieldBindingSchema, defaultOpts);
    const html = htmlEmit(fieldBindingSchema, defaultOpts);

    it('all frameworks emit ok', () => {
      expect(react.status).toBe('ok');
      expect(vue.status).toBe('ok');
      expect(html.status).toBe('ok');
    });

    it('React injects field values via JSX expressions', () => {
      expect(react.code).toContain('{name}');       // children strategy
      expect(react.code).toContain('status={status}'); // status-prop strategy
      expect(react.code).toContain('value={email}');   // value-prop strategy
    });

    it('Vue injects field values via template syntax', () => {
      expect(vue.code).toContain('{{ name }}');        // children strategy
      expect(vue.code).toContain(':status="status"');  // status-prop strategy
      expect(vue.code).toContain(':value="email"');    // value-prop strategy
    });

    it('HTML injects placeholder text with data-bind', () => {
      expect(html.code).toContain('data-bind="name"');
      expect(html.code).toContain('[name]');
    });

    it('React generates typed props interface', () => {
      expect(react.code).toContain('export interface PageProps');
    });

    it('Vue generates ref() bindings for form schemas (Input/Select present)', () => {
      expect(vue.code).toContain("import { ref } from 'vue'");
      expect(vue.code).toContain('ref<');
    });

    it('React destructures field names from props', () => {
      expect(react.code).toMatch(/\{\s*email.*name.*price.*status\s*\}/);
    });
  });

  describe('event binding parity', () => {
    const react = reactEmit(fieldBindingSchema, defaultOpts);
    const vue = vueEmit(fieldBindingSchema, defaultOpts);

    it('React emits onSubmit={handleSubmit}', () => {
      expect(react.code).toContain('onSubmit={handleSubmit}');
    });

    it('Vue emits @submit="handleSubmit"', () => {
      expect(vue.code).toContain('@submit="handleSubmit"');
    });

    it('both generate handler stubs', () => {
      expect(react.code).toContain('const handleSubmit');
      expect(vue.code).toContain('const handleSubmit');
    });
  });

  describe('prop enrichment parity', () => {
    const react = reactEmit(fieldBindingSchema, defaultOpts);
    const vue = vueEmit(fieldBindingSchema, defaultOpts);

    it('both frameworks emit placeholder for form inputs', () => {
      expect(react.code).toContain('placeholder="Contact email"');
      expect(vue.code).toContain('placeholder="Contact email"');
    });

    it('both frameworks emit type from semantic field type', () => {
      expect(react.code).toContain('type="email"');
      expect(vue.code).toContain('type="email"');
    });

    it('both frameworks emit enum options for Select', () => {
      expect(react.code).toContain('options=');
      expect(vue.code).toContain(':options=');
    });
  });

  describe('token overrides', () => {
    const react = reactEmit(tokenOverrideSchema, defaultOpts);
    const vue = vueEmit(tokenOverrideSchema, defaultOpts);

    it('React emits token overrides as CSS variable comment', () => {
      expect(react.code).toContain('--token-color-primary');
      expect(react.code).toContain('--token-spacing-base');
    });

    it('Vue emits token overrides as style block', () => {
      expect(vue.code).toContain('--token-color-primary');
      expect(vue.code).toContain('--token-spacing-base');
    });
  });

  describe('framework metadata', () => {
    const react = reactEmit(nestedSchema, defaultOpts);
    const vue = vueEmit(nestedSchema, defaultOpts);
    const html = htmlEmit(nestedSchema, defaultOpts);

    it('React returns .tsx extension and react framework', () => {
      expect(react.framework).toBe('react');
      expect(react.fileExtension).toBe('.tsx');
    });

    it('Vue returns .vue extension and vue framework', () => {
      expect(vue.framework).toBe('vue');
      expect(vue.fileExtension).toBe('.vue');
    });

    it('HTML returns .html extension and html framework', () => {
      expect(html.framework).toBe('html');
      expect(html.fileExtension).toBe('.html');
    });

    it('React and Vue include @oods/components in imports', () => {
      expect(react.imports).toContain('@oods/components');
      expect(vue.imports).toContain('@oods/components');
    });

    it('HTML has no imports', () => {
      expect(html.imports).toEqual([]);
    });
  });
});
