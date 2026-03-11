import type { ReplIssue, UiSchema } from '../schemas/generated.js';
import type { CodegenFramework, CodegenIssue, CodegenStyling } from './types.js';
import { handle as composeHandle, type DesignComposeInput } from './design.compose.js';
import { handle as validateHandle } from './repl.validate.js';
import { handle as renderHandle } from './repl.render.js';
import { handle as codeGenerateHandle } from './code.generate.js';
import { handle as schemaSaveHandle } from './schema/save.js';
import { loadOodsrc } from '../lib/oodsrc.js';

type PipelineStep = 'compose' | 'validate' | 'render' | 'codegen' | 'save';

export type PipelineInput = {
  dslVersion?: string;
  object?: string;
  intent?: string;
  context?: 'detail' | 'list' | 'form' | 'timeline' | 'card' | 'inline';
  layout?: 'dashboard' | 'form' | 'detail' | 'list' | 'auto';
  preferences?: DesignComposeInput['preferences'];
  framework?: CodegenFramework;
  styling?: CodegenStyling;
  save?: string | { name: string; tags?: string[] };
  options?: {
    skipValidation?: boolean;
    skipRender?: boolean;
    checkA11y?: boolean;
    renderApply?: boolean;
    compact?: boolean;
    /** Alias: accepted in options for agent ergonomics. */
    typescript?: boolean;
    /** Alias: accepted in options for agent ergonomics. */
    styling?: CodegenStyling;
    /** Alias: accepted in options for agent ergonomics. */
    framework?: CodegenFramework;
    /** Emit data-oods-confidence attributes on rendered components. Default false. */
    showConfidence?: boolean;
    /** Confidence threshold for low-confidence CSS class. Default 0.5. */
    confidenceThreshold?: number;
  };
};

export type PipelineOutput = {
  schemaRef?: string;
  schemaRefCreatedAt?: string;
  schemaRefExpiresAt?: string;
  compose: {
    object?: string;
    context?: string;
    layout: string;
    componentCount: number;
  };
  validation?: {
    status: 'ok' | 'invalid' | 'skipped';
    errors: ReplIssue[];
    warnings: ReplIssue[];
  };
  render?: {
    html?: string;
    tokenCssRef?: string;
    meta: Record<string, unknown>;
  };
  code?: {
    framework: CodegenFramework;
    styling: CodegenStyling;
    output: string;
  };
  saved?: {
    name: string;
    version: number;
  };
  summary?: string;
  metrics?: {
    totalNodes: number;
    componentsUsed: number;
    fieldsBound: number;
    responseBytes: number;
  };
  pipeline: {
    steps: string[];
    stepLatency?: Record<string, number>;
    duration: number;
  };
  error?: {
    step: PipelineStep;
    code: string;
    message: string;
  };
};

function countComponents(schema: UiSchema | undefined): number {
  if (!schema) return 0;
  const names = new Set<string>();
  const stack = [...schema.screens];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    names.add(node.component);
    if (Array.isArray(node.children) && node.children.length > 0) {
      stack.push(...node.children);
    }
  }

  return names.size;
}

function countNodes(schema: UiSchema | undefined): number {
  if (!schema) return 0;
  let count = 0;
  const stack = [...schema.screens];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    count++;
    if (Array.isArray(node.children) && node.children.length > 0) {
      stack.push(...node.children);
    }
  }
  return count;
}

function countFieldsBound(schema: UiSchema | undefined): number {
  if (!schema?.objectSchema) return 0;
  let count = 0;
  const stack = [...schema.screens];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (typeof node.props?.field === 'string' && schema.objectSchema[node.props.field]) {
      count++;
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      stack.push(...node.children);
    }
  }
  return count;
}

function buildSummary(input: PipelineInput, componentCount: number, fieldsBound: number, framework: string, styling: string): string {
  const parts: string[] = [];
  if (input.object) parts.push(`${input.object}`);
  if (input.context) parts.push(`${input.context} view`);
  else parts.push('view');
  if (fieldsBound > 0) parts.push(`with ${fieldsBound} fields`);
  parts.push(`${framework}/${styling}`);
  return `${parts.join(', ')}, ${componentCount} components`;
}

function firstIssueMessage(issues: ReplIssue[] | CodegenIssue[] | undefined): { code: string; message: string } {
  const issue = issues?.[0];
  if (!issue) {
    return {
      code: 'OODS-S009',
      message: 'Step failed without a structured issue payload.',
    };
  }

  return {
    code: issue.code,
    message: issue.message,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function handle(input: PipelineInput): Promise<PipelineOutput> {
  const startedAt = Date.now();
  const steps: PipelineStep[] = [];
  const rc = loadOodsrc();
  const framework = input.framework ?? input.options?.framework ?? rc.framework ?? 'react';
  const styling = input.styling ?? input.options?.styling ?? rc.styling ?? 'tokens';
  const skipValidation = input.options?.skipValidation === true;
  const skipRender = input.options?.skipRender === true;
  const checkA11y = input.options?.checkA11y ?? rc.pipeline?.checkA11y ?? false;
  const renderApply = input.options?.renderApply ?? true;
  const renderCompact = input.options?.compact ?? rc.pipeline?.compact ?? true;

  const output: PipelineOutput = {
    compose: {
      ...(input.object ? { object: input.object } : {}),
      ...(input.context ? { context: input.context } : {}),
      layout: input.layout ?? 'auto',
      componentCount: 0,
    },
    pipeline: {
      steps: [],
      duration: 0,
    },
  };

  const stepLatency: Record<string, number> = {};

  let composedSchema: UiSchema | undefined;

  const finish = (): PipelineOutput => {
    output.pipeline.steps = [...steps];
    output.pipeline.stepLatency = stepLatency;
    output.pipeline.duration = Math.max(1, Date.now() - startedAt);

    // Compute metrics and summary if compose succeeded
    if (composedSchema && !output.error) {
      const totalNodes = countNodes(composedSchema);
      const componentsUsed = countComponents(composedSchema);
      const fieldsBound = countFieldsBound(composedSchema);
      output.summary = buildSummary(input, componentsUsed, fieldsBound, framework, styling);

      const responseJson = JSON.stringify(output);
      output.metrics = {
        totalNodes,
        componentsUsed,
        fieldsBound,
        responseBytes: Buffer.byteLength(responseJson, 'utf8'),
      };
    }

    return output;
  };

  const fail = (step: PipelineStep, code: string, message: string): PipelineOutput => {
    output.error = { step, code, message };
    return finish();
  };

  steps.push('compose');

  let composeResult: Awaited<ReturnType<typeof composeHandle>>;
  let stepStart = Date.now();
  try {
    composeResult = await composeHandle({
      object: input.object,
      intent: input.intent,
      context: input.context,
      layout: input.layout,
      preferences: input.preferences,
      options: {
        validate: false,
      },
    });
    stepLatency.compose = Date.now() - stepStart;
  } catch (error) {
    stepLatency.compose = Date.now() - stepStart;
    return fail('compose', 'OODS-S010', `compose step threw: ${errorMessage(error)}`);
  }

  composedSchema = composeResult.schema;

  output.compose = {
    ...(composeResult.objectUsed?.name ? { object: composeResult.objectUsed.name } : output.compose.object ? { object: output.compose.object } : {}),
    ...(input.context ? { context: input.context } : {}),
    layout: composeResult.layout,
    componentCount: countComponents(composeResult.schema),
  };

  if (composeResult.schemaRef) {
    output.schemaRef = composeResult.schemaRef;
    if (composeResult.schemaRefCreatedAt) {
      output.schemaRefCreatedAt = composeResult.schemaRefCreatedAt;
    }
    if (composeResult.schemaRefExpiresAt) {
      output.schemaRefExpiresAt = composeResult.schemaRefExpiresAt;
    }
  }

  if (composeResult.status !== 'ok') {
    const issue = firstIssueMessage(composeResult.errors);
    return fail('compose', issue.code, issue.message);
  }

  if (!composeResult.schemaRef) {
    return fail('compose', 'OODS-C001', 'compose did not return schemaRef.');
  }

  if (!skipValidation) {
    steps.push('validate');

    let validationResult: Awaited<ReturnType<typeof validateHandle>>;
    stepStart = Date.now();
    try {
      validationResult = await validateHandle({
        mode: 'full',
        schemaRef: composeResult.schemaRef,
        options: {
          checkComponents: true,
          checkA11y,
          includeNormalized: false,
        },
      });
      stepLatency.validate = Date.now() - stepStart;
    } catch (error) {
      stepLatency.validate = Date.now() - stepStart;
      return fail('validate', 'OODS-S011', `validate step threw: ${errorMessage(error)}`);
    }

    output.validation = {
      status: validationResult.status,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
    };

    if (validationResult.status !== 'ok') {
      const issue = firstIssueMessage(validationResult.errors);
      return fail('validate', issue.code, issue.message);
    }
  }

  if (!skipRender) {
    steps.push('render');

    let renderResult: Awaited<ReturnType<typeof renderHandle>>;
    stepStart = Date.now();
    try {
      renderResult = await renderHandle({
        mode: 'full',
        schemaRef: composeResult.schemaRef,
        apply: renderApply,
        options: {
          includeTree: false,
        },
        output: {
          compact: renderCompact,
          ...(input.options?.showConfidence ? { showConfidence: true } : {}),
          ...(input.options?.confidenceThreshold !== undefined ? { confidenceThreshold: input.options.confidenceThreshold } : {}),
        },
      });
      stepLatency.render = Date.now() - stepStart;
    } catch (error) {
      stepLatency.render = Date.now() - stepStart;
      return fail('render', 'OODS-S012', `render step threw: ${errorMessage(error)}`);
    }

    output.render = {
      ...(renderApply && renderResult.html ? { html: renderResult.html } : {}),
      ...(renderResult.tokenCssRef ? { tokenCssRef: renderResult.tokenCssRef } : {}),
      meta: {
        status: renderResult.status,
        warnings: renderResult.warnings.length,
        errors: renderResult.errors.length,
        ...(renderResult.output ? {
          format: renderResult.output.format,
          strict: renderResult.output.strict,
        } : {}),
        ...(renderResult.meta ? { validationMeta: renderResult.meta } : {}),
      },
    };

    if (renderResult.status !== 'ok') {
      const issue = firstIssueMessage(renderResult.errors);
      return fail('render', issue.code, issue.message);
    }
  }

  steps.push('codegen');

  let codegenResult: Awaited<ReturnType<typeof codeGenerateHandle>>;
  stepStart = Date.now();
  try {
    const typescript = input.options?.typescript;
    codegenResult = await codeGenerateHandle({
      schemaRef: composeResult.schemaRef,
      framework,
      options: {
        styling,
        ...(typescript !== undefined ? { typescript } : {}),
      },
    });
    stepLatency.codegen = Date.now() - stepStart;
  } catch (error) {
    stepLatency.codegen = Date.now() - stepStart;
    return fail('codegen', 'OODS-S013', `codegen step threw: ${errorMessage(error)}`);
  }

  output.code = {
    framework,
    styling,
    output: codegenResult.code,
  };

  if (codegenResult.status !== 'ok') {
    const issue = firstIssueMessage(codegenResult.errors);
    return fail('codegen', issue.code, issue.message);
  }

  const saveConfig = typeof input.save === 'string'
    ? { name: input.save.trim(), tags: undefined }
    : input.save
      ? { name: input.save.name.trim(), tags: input.save.tags }
      : undefined;

  if (saveConfig?.name) {
    steps.push('save');

    stepStart = Date.now();
    try {
      const saved = await schemaSaveHandle({
        name: saveConfig.name,
        schemaRef: composeResult.schemaRef,
        ...(saveConfig.tags ? { tags: saveConfig.tags } : {}),
        ...(composeResult.objectUsed?.name ? { object: composeResult.objectUsed.name } : {}),
      });
      stepLatency.save = Date.now() - stepStart;
      output.saved = {
        name: saved.name,
        version: saved.version,
      };
    } catch (error) {
      stepLatency.save = Date.now() - stepStart;
      return fail('save', 'OODS-S014', `save step threw: ${errorMessage(error)}`);
    }
  }

  return finish();
}
