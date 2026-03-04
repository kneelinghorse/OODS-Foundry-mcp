import { describe, expect, it } from 'vitest';
import { renderTree } from '../../src/render/tree-renderer.js';
import { emit as emitReact } from '../../src/codegen/react-emitter.js';
import { emit as emitVue } from '../../src/codegen/vue-emitter.js';
import { emit as emitHtml } from '../../src/codegen/html-emitter.js';
import type { UiSchema, UiElement } from '../../src/schemas/generated.js';
import type { CodegenOptions } from '../../src/codegen/types.js';

const ALIGN_CASES = [
  { align: 'start', css: 'flex-start' },
  { align: 'center', css: 'center' },
  { align: 'end', css: 'flex-end' },
  { align: 'space-between', css: 'space-between' },
] as const;

const codegenOpts: CodegenOptions = { typescript: true, styling: 'tokens' };

function makeSchema(layout: UiElement['layout']): UiSchema {
  return {
    version: '1.0',
    screens: [
      {
        id: 'root',
        component: 'Stack',
        layout,
        children: [],
      },
    ],
  };
}

describe('layout alignment mapping', () => {
  for (const { align, css } of ALIGN_CASES) {
    it(`inline layout uses justify-content for align=${align}`, () => {
      const schema = makeSchema({ type: 'inline', align });

      const html = renderTree(schema);
      expect(html).toContain(`justify-content:${css}`);
      expect(html).not.toContain(`align-items:${css}`);

      const htmlCodegen = emitHtml(schema, codegenOpts);
      expect(htmlCodegen.status).toBe('ok');
      expect(htmlCodegen.code).toContain(`justify-content:${css}`);
      expect(htmlCodegen.code).not.toContain(`align-items:${css}`);

      const react = emitReact(schema, codegenOpts);
      expect(react.status).toBe('ok');
      expect(react.code).toContain(`justifyContent: '${css}'`);
      expect(react.code).not.toContain(`alignItems: '${css}'`);

      const vue = emitVue(schema, codegenOpts);
      expect(vue.status).toBe('ok');
      expect(vue.code).toContain(`justify-content: ${css}`);
      expect(vue.code).not.toContain(`align-items: ${css}`);
    });

    it(`stack layout uses align-items for align=${align}`, () => {
      const schema = makeSchema({ type: 'stack', align });

      const html = renderTree(schema);
      expect(html).toContain(`align-items:${css}`);

      const htmlCodegen = emitHtml(schema, codegenOpts);
      expect(htmlCodegen.status).toBe('ok');
      expect(htmlCodegen.code).toContain(`align-items:${css}`);

      const react = emitReact(schema, codegenOpts);
      expect(react.status).toBe('ok');
      expect(react.code).toContain(`alignItems: '${css}'`);

      const vue = emitVue(schema, codegenOpts);
      expect(vue.status).toBe('ok');
      expect(vue.code).toContain(`align-items: ${css}`);
    });
  }
});
