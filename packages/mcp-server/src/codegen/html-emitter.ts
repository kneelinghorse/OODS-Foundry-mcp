import { renderTree } from '../render/tree-renderer.js';
import { renderDocument } from '../render/document.js';
import type { UiSchema } from '../schemas/generated.js';
import type { CodegenOptions, CodegenResult } from './types.js';

/**
 * HTML emitter — delegates to the existing repl.render document pipeline.
 * Produces a self-contained HTML document from the UiSchema.
 */
export function emit(schema: UiSchema, _options: CodegenOptions): CodegenResult {
  const warnings: CodegenResult['warnings'] = [];

  try {
    const screenHtml = renderTree(schema);
    const html = renderDocument({ screenHtml, schema });

    return {
      status: 'ok',
      framework: 'html',
      code: html,
      fileExtension: '.html',
      imports: [],
      warnings,
    };
  } catch (error) {
    return {
      status: 'error',
      framework: 'html',
      code: '',
      fileExtension: '.html',
      imports: [],
      warnings,
      errors: [
        {
          code: 'OODS-S006',
          message: `HTML rendering failed: ${(error as Error).message}`,
        },
      ],
    };
  }
}
