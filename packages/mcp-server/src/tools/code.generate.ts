import { loadComponentRegistry, validateSchema, validateComponents } from './repl.utils.js';
import { emit as emitHtml } from '../codegen/html-emitter.js';
import { emit as emitReact } from '../codegen/react-emitter.js';
import { emit as emitVue } from '../codegen/vue-emitter.js';
import type { UiSchema } from '../schemas/generated.js';
import type { CodeGenerateInput, CodeGenerateOutput } from './types.js';
import type { Emitter, CodegenOptions, CodegenIssue } from '../codegen/types.js';

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
  const { schema, framework } = input;
  const warnings: CodegenIssue[] = [];

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
    .filter((e) => e.code === 'UNKNOWN_COMPONENT')
    .map((e) => e.component)
    .filter((c): c is string => c !== undefined);

  if (unknownComponents.length > 0) {
    warnings.push({
      code: 'UNKNOWN_COMPONENTS',
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
      errors: [{ code: 'UNKNOWN_FRAMEWORK', message: `No emitter registered for framework '${framework}'` }],
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
