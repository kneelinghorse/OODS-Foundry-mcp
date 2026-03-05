import { loadComponentRegistry, validateSchema, validateComponents } from './repl.utils.js';
import { emit as emitHtml } from '../codegen/html-emitter.js';
import { emit as emitReact } from '../codegen/react-emitter.js';
import { emit as emitVue } from '../codegen/vue-emitter.js';
import type { UiSchema } from '../schemas/generated.js';
import type { CodeGenerateInput, CodeGenerateOutput } from './types.js';
import type { Emitter, CodegenOptions, CodegenIssue } from '../codegen/types.js';
import { resolveSchemaRef } from './schema-ref.js';

const emitters: Record<string, Emitter> = {
  html: emitHtml,
  react: emitReact,
  vue: emitVue,
};

function countNodes(screens: UiSchema['screens']): number {
  let count = 0;
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    count += 1;
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return count;
}

function collectComponents(screens: UiSchema['screens']): Set<string> {
  const components = new Set<string>();
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    components.add(node.component);
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return components;
}

export async function handle(input: CodeGenerateInput): Promise<CodeGenerateOutput> {
  const { framework } = input;
  const warnings: CodegenIssue[] = [];
  let schema: UiSchema | undefined = input.schema;

  if (!schema && input.schemaRef) {
    const resolved = resolveSchemaRef(input.schemaRef);
    if (resolved.ok) {
      schema = resolved.schema;
    } else {
      return {
        status: 'error',
        framework,
        code: '',
        fileExtension: '',
        imports: [],
        warnings,
        errors: [
          {
            code: resolved.reason === 'expired' ? 'OODS-N004' : 'OODS-N003',
            message:
              `schemaRef '${input.schemaRef}' is ${resolved.reason}. ` +
              'Run design.compose again to obtain a fresh schemaRef, or pass schema inline via the schema field.',
          },
        ],
      };
    }
  }

  if (!schema) {
    return {
      status: 'error',
      framework,
      code: '',
      fileExtension: '',
      imports: [],
      warnings,
      errors: [
        {
          code: 'OODS-V009',
          message: 'schema is required for code generation. Provide schema or schemaRef.',
        },
      ],
    };
  }

  // Validate the input schema structurally
  const schemaErrors = validateSchema(schema);
  if (schemaErrors.length > 0) {
    return {
      status: 'error',
      framework,
      code: '',
      fileExtension: '',
      imports: [],
      warnings: [],
      errors: schemaErrors.map((issue) => ({
        code: issue.code,
        message: issue.message,
        nodeId: issue.nodeId,
        component: issue.component,
      })),
    };
  }

  // Check component registry for unknown components
  const registry = loadComponentRegistry();
  const componentErrors = validateComponents(schema, registry);
  const unknownComponents = componentErrors
    .filter((e) => e.code === 'OODS-V006')
    .map((e) => e.component)
    .filter((c): c is string => c !== undefined);

  if (unknownComponents.length > 0) {
    warnings.push({
      code: 'OODS-V119',
      message: `${unknownComponents.length} component(s) not found in registry: ${unknownComponents.join(', ')}`,
    });
  }

  // Resolve emitter
  const emitter = emitters[framework];
  if (!emitter) {
    return {
      status: 'error',
      framework,
      code: '',
      fileExtension: '',
      imports: [],
      warnings,
      errors: [{ code: 'OODS-V005', message: `No emitter registered for framework '${framework}'` }],
    };
  }

  // Build codegen options
  const options: CodegenOptions = {
    typescript: input.options?.typescript ?? true,
    styling: input.options?.styling ?? 'tokens',
  };

  // Dispatch to framework emitter
  const result = emitter(schema, options);

  // Merge warnings
  const allWarnings = [...warnings, ...result.warnings];

  // Build meta
  const allComponents = collectComponents(schema.screens);
  const meta: CodeGenerateOutput['meta'] = {
    nodeCount: countNodes(schema.screens),
    componentCount: allComponents.size,
    ...(unknownComponents.length > 0 ? { unknownComponents } : {}),
  };

  return {
    status: result.status,
    framework: result.framework,
    code: result.code,
    fileExtension: result.fileExtension,
    imports: result.imports,
    warnings: allWarnings,
    ...(result.errors?.length ? { errors: result.errors } : {}),
    meta,
  };
}
