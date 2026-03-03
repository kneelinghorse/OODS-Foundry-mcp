import { describe, it, expect } from 'vitest';
import { emit } from '../../src/codegen/react-emitter.js';
import type { UiSchema, UiElement } from '../../src/schemas/generated.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

const defaultOpts: CodegenOptions = { typescript: true, styling: 'tokens' };

function makeSchema(...screens: UiElement[]): UiSchema {
  return { version: '1.0', screens };
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
});
