import { describe, it, expect } from 'vitest';
import { emit } from '../../src/codegen/react-emitter.js';
import type { UiSchema, UiElement, FieldSchemaEntry } from '../../src/schemas/generated.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

const defaultOpts: CodegenOptions = { typescript: true, styling: 'tokens' };

function makeSchema(...screens: UiElement[]): UiSchema {
  return { version: '1.0', screens };
}

function makeSchemaWithObjectSchema(
  objectSchema: Record<string, FieldSchemaEntry>,
  ...screens: UiElement[]
): UiSchema {
  return { version: '1.0', screens, objectSchema };
}

describe('react-emitter', () => {
  describe('style output — no triple braces', () => {
    it('emits correct double-brace style={{ ... }} for layout styles', () => {
      const schema = makeSchema({
        id: 'card-1',
        component: 'Card',
        layout: { type: 'stack', gapToken: 'md' },
        children: [],
      });
      const result = emit(schema, defaultOpts);
      expect(result.status).toBe('ok');
      // Must have style={{ ... }} (double brace), NOT style={{{ ... }}} (triple)
      expect(result.code).toContain("style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ref-spacing-md)' }}");
      expect(result.code).not.toMatch(/style=\{\{\{/);
    });

    it('emits correct double-brace style for token styles', () => {
      const schema = makeSchema({
        id: 'box-1',
        component: 'Box',
        style: { spacingToken: 'lg', radiusToken: 'sm' },
        children: [],
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain("style={{ padding: 'var(--ref-spacing-lg)', borderRadius: 'var(--ref-radius-sm)' }}");
      expect(result.code).not.toMatch(/style=\{\{\{/);
    });

    it('emits correct double-brace style for merged layout + token styles', () => {
      const schema = makeSchema({
        id: 'panel-1',
        component: 'Panel',
        layout: { type: 'inline', align: 'center' },
        style: { colorToken: 'primary' },
        children: [],
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain("style={{");
      expect(result.code).not.toMatch(/style=\{\{\{/);
    });

    it('emits correct double-brace style for section layout', () => {
      const schema = makeSchema({
        id: 'sec-1',
        component: 'Heading',
        layout: { type: 'section' },
        style: { spacingToken: 'xl' },
        children: [],
      });
      const result = emit(schema, defaultOpts);
      // Section layout also wraps with style={}
      expect(result.code).not.toMatch(/style=\{\{\{/);
      // Should have valid double-brace patterns
      const styleMatches = result.code.match(/style=\{\{/g);
      if (styleMatches) {
        // Every style={{ must be followed eventually by }} (double close)
        expect(result.code).not.toMatch(/style=\{\{\{/);
      }
    });
  });

  describe('self-closing nodes', () => {
    it('renders self-closing tag for childless components', () => {
      const schema = makeSchema({
        id: 'btn-1',
        component: 'Button',
        props: { label: 'Click me' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('<Button');
      expect(result.code).toContain('id="btn-1"');
      expect(result.code).toContain('label="Click me"');
      expect(result.code).toContain('/>');
    });
  });

  describe('nested trees', () => {
    it('emits correct nested JSX with styles at multiple levels', () => {
      const schema = makeSchema({
        id: 'outer',
        component: 'Stack',
        layout: { type: 'stack', gapToken: 'sm' },
        children: [
          {
            id: 'inner-1',
            component: 'Card',
            style: { radiusToken: 'md', shadowToken: 'sm' },
            children: [
              {
                id: 'text-1',
                component: 'Text',
                props: { content: 'Hello' },
              },
            ],
          },
          {
            id: 'inner-2',
            component: 'Badge',
            style: { colorToken: 'success' },
            children: [],
          },
        ],
      });
      const result = emit(schema, defaultOpts);
      expect(result.status).toBe('ok');
      // No triple braces anywhere in the output
      expect(result.code).not.toMatch(/\{\{\{/);
      // Should have nested structure
      expect(result.code).toContain('<Stack');
      expect(result.code).toContain('<Card');
      expect(result.code).toContain('<Text');
      expect(result.code).toContain('<Badge');
    });
  });

  describe('general correctness', () => {
    it('includes import block', () => {
      const schema = makeSchema({
        id: 'a',
        component: 'Button',
        children: [],
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain("import React from 'react';");
      expect(result.code).toContain("import { Button } from '@oods/components';");
    });

    it('generates TypeScript annotations when typescript=true', () => {
      const schema = makeSchema({
        id: 'a',
        component: 'Card',
        children: [],
      });
      const result = emit(schema, { typescript: true, styling: 'tokens' });
      expect(result.code).toContain('React.FC');
      expect(result.fileExtension).toBe('.tsx');
    });

    it('omits TypeScript annotations when typescript=false', () => {
      const schema = makeSchema({
        id: 'a',
        component: 'Card',
        children: [],
      });
      const result = emit(schema, { typescript: false, styling: 'tokens' });
      expect(result.code).not.toContain(': React.FC');
      expect(result.fileExtension).toBe('.jsx');
    });

    it('returns no warnings for valid schema', () => {
      const schema = makeSchema({
        id: 'a',
        component: 'Button',
        children: [],
      });
      const result = emit(schema, defaultOpts);
      expect(result.warnings).toEqual([]);
    });

    it('sets framework to react', () => {
      const schema = makeSchema({
        id: 'a',
        component: 'Button',
      });
      const result = emit(schema, defaultOpts);
      expect(result.framework).toBe('react');
    });
  });

  describe('typed props from objectSchema (s63-m02)', () => {
    it('generates PageProps interface when objectSchema is present', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          name: { type: 'string', required: true, description: 'User name' },
          age: { type: 'integer', required: false, description: 'User age' },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('export interface PageProps');
      expect(result.code).toContain('name: string;');
      expect(result.code).toContain('age?: number;');
    });

    it('maps field types to TypeScript types correctly', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          id: { type: 'string', required: true },
          count: { type: 'integer', required: true },
          price: { type: 'number', required: true },
          active: { type: 'boolean', required: true },
          created_at: { type: 'datetime', required: true },
          email: { type: 'email', required: false },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('id: string;');
      expect(result.code).toContain('count: number;');
      expect(result.code).toContain('price: number;');
      expect(result.code).toContain('active: boolean;');
      expect(result.code).toContain('createdAt: string;');
      expect(result.code).toContain('email?: string;');
    });

    it('generates union literal type for enum fields', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          status: {
            type: 'string',
            required: true,
            enum: ['active', 'paused', 'terminated'],
          },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain("status: 'active' | 'paused' | 'terminated';");
    });

    it('marks required fields as non-optional and optional fields with ?', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          required_field: { type: 'string', required: true },
          optional_field: { type: 'string', required: false },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('requiredField: string;');
      expect(result.code).toContain('optionalField?: string;');
    });

    it('includes JSDoc comments for fields with descriptions', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          name: { type: 'string', required: true, description: 'User display name' },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('/** User display name */');
    });

    it('uses React.FC<PageProps> as return type when objectSchema present', () => {
      const schema = makeSchemaWithObjectSchema(
        { name: { type: 'string', required: true } },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('React.FC<PageProps>');
    });

    it('without objectSchema, emitter behaves exactly as before', () => {
      const schema = makeSchema({ id: 'root', component: 'Box' });
      const result = emit(schema, defaultOpts);
      expect(result.code).not.toContain('interface PageProps');
      expect(result.code).toContain(': React.FC');
      expect(result.code).not.toContain('React.FC<');
    });

    it('does not generate PageProps when typescript=false', () => {
      const schema = makeSchemaWithObjectSchema(
        { name: { type: 'string', required: true } },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, { typescript: false, styling: 'tokens' });
      expect(result.code).not.toContain('PageProps');
      expect(result.code).not.toContain('interface');
    });

    it('converts snake_case field names to camelCase', () => {
      const schema = makeSchemaWithObjectSchema(
        {
          first_name: { type: 'string', required: true },
          last_login_at: { type: 'datetime', required: false },
        },
        { id: 'root', component: 'Page' },
      );
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('firstName: string;');
      expect(result.code).toContain('lastLoginAt?: string;');
    });
  });

  describe('propSchema default value wiring (s63-m02)', () => {
    it('emits const declarations for prop defaults from element props matching objectSchema fields', () => {
      const schema: UiSchema = {
        version: '1.0',
        screens: [
          {
            id: 'root',
            component: 'StatusBadge',
            props: { status: 'active', priority: 3 },
          },
        ],
        objectSchema: {
          status: { type: 'string', required: true, enum: ['active', 'paused', 'terminated'] },
          priority: { type: 'integer', required: false },
        },
      };
      const result = emit(schema, defaultOpts);
      // String prop emitted as quoted literal
      expect(result.code).toContain("const status = 'active';");
      // Number prop emitted as bare numeric
      expect(result.code).toContain('const priority = 3;');
    });

    it('emits boolean prop defaults as bare values', () => {
      const schema: UiSchema = {
        version: '1.0',
        screens: [
          {
            id: 'root',
            component: 'Toggle',
            props: { active: true },
          },
        ],
        objectSchema: {
          active: { type: 'boolean', required: true },
        },
      };
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('const active = true;');
    });

    it('prop defaults appear inside the component function before return', () => {
      const schema: UiSchema = {
        version: '1.0',
        screens: [
          {
            id: 'root',
            component: 'Card',
            props: { name: 'Default' },
          },
        ],
        objectSchema: {
          name: { type: 'string', required: true },
        },
      };
      const result = emit(schema, defaultOpts);
      const exportIdx = result.code.indexOf('export const GeneratedUI');
      const defaultIdx = result.code.indexOf("const name = 'Default';");
      const returnIdx = result.code.indexOf('return (');
      expect(defaultIdx).toBeGreaterThan(exportIdx);
      expect(defaultIdx).toBeLessThan(returnIdx);
    });

    it('does not emit prop defaults without objectSchema', () => {
      const schema = makeSchema({
        id: 'root',
        component: 'Card',
        props: { name: 'Default' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).not.toContain("const name = 'Default';");
    });

    it('collects prop defaults from nested children', () => {
      const schema: UiSchema = {
        version: '1.0',
        screens: [
          {
            id: 'root',
            component: 'Page',
            children: [
              {
                id: 'badge',
                component: 'StatusBadge',
                props: { status: 'paused' },
              },
            ],
          },
        ],
        objectSchema: {
          status: { type: 'string', required: true, enum: ['active', 'paused'] },
        },
      };
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain("const status = 'paused';");
    });

    it('ignores element props that do not match objectSchema fields', () => {
      const schema: UiSchema = {
        version: '1.0',
        screens: [
          {
            id: 'root',
            component: 'Card',
            props: { label: 'Hello', status: 'active' },
          },
        ],
        objectSchema: {
          status: { type: 'string', required: true },
        },
      };
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain("const status = 'active';");
      // 'label' is not in objectSchema, should not get a default declaration
      expect(result.code).not.toContain("const label = 'Hello';");
    });
  });

  describe('event handler stubs (s63-m04)', () => {
    it('generates handler stubs from bindings', () => {
      const schema = makeSchema({
        id: 'form-root',
        component: 'Form',
        bindings: { onSubmit: 'handleSubmit', onChange: 'handleChange' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('const handleSubmit = (e: React.FormEvent) => { /* TODO: implement handleSubmit */ };');
      expect(result.code).toContain('const handleChange = (value: unknown) => { /* TODO: implement handleChange */ };');
    });

    it('emits binding attributes in JSX', () => {
      const schema = makeSchema({
        id: 'form-root',
        component: 'Form',
        bindings: { onSubmit: 'handleSubmit' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('onSubmit={handleSubmit}');
    });

    it('generates stubs for detail context bindings', () => {
      const schema = makeSchema({
        id: 'detail-root',
        component: 'DetailView',
        bindings: { onEdit: 'handleEdit', onDelete: 'handleDelete' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('const handleEdit = () => { /* TODO: implement handleEdit */ };');
      expect(result.code).toContain('const handleDelete = () => { /* TODO: implement handleDelete */ };');
    });

    it('generates stubs for list context bindings', () => {
      const schema = makeSchema({
        id: 'list-root',
        component: 'ListView',
        bindings: { onRowClick: 'handleRowClick', onSort: 'handleSort', onFilter: 'handleFilter' },
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('const handleRowClick = (row: Record<string, unknown>) => { /* TODO');
      expect(result.code).toContain('const handleSort = (column: string) => { /* TODO');
      expect(result.code).toContain('const handleFilter = (criteria: Record<string, unknown>) => { /* TODO');
    });

    it('handler stubs are inside the component function', () => {
      const schema = makeSchema({
        id: 'root',
        component: 'Form',
        bindings: { onSubmit: 'handleSubmit' },
      });
      const result = emit(schema, defaultOpts);
      const exportIdx = result.code.indexOf('export const GeneratedUI');
      const stubIdx = result.code.indexOf('const handleSubmit');
      const returnIdx = result.code.indexOf('return (');
      expect(stubIdx).toBeGreaterThan(exportIdx);
      expect(stubIdx).toBeLessThan(returnIdx);
    });

    it('collects bindings from nested children', () => {
      const schema = makeSchema({
        id: 'root',
        component: 'Page',
        children: [
          {
            id: 'form',
            component: 'Form',
            bindings: { onSubmit: 'handleSubmit' },
            children: [
              {
                id: 'field',
                component: 'Input',
                bindings: { onChange: 'handleFieldChange' },
              },
            ],
          },
        ],
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).toContain('const handleSubmit');
      expect(result.code).toContain('const handleFieldChange');
    });

    it('no handler stubs when no bindings present', () => {
      const schema = makeSchema({
        id: 'root',
        component: 'Box',
      });
      const result = emit(schema, defaultOpts);
      expect(result.code).not.toContain('const handle');
    });

    it('omits typed params when typescript=false', () => {
      const schema = makeSchema({
        id: 'root',
        component: 'Form',
        bindings: { onSubmit: 'handleSubmit' },
      });
      const result = emit(schema, { typescript: false, styling: 'tokens' });
      expect(result.code).toContain('const handleSubmit = (e) => {');
      expect(result.code).not.toContain('React.FormEvent');
    });
  });
});
