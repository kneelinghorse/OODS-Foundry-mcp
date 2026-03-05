import type { ReplIssue, UiSchema } from '../schemas/generated.js';
import type { CodegenFramework, CodegenIssue, CodegenStyling } from './types.js';
import { handle as composeHandle } from './design.compose.js';
import { handle as validateHandle } from './repl.validate.js';
import { handle as renderHandle } from './repl.render.js';
import { handle as codeGenerateHandle } from './code.generate.js';
import { handle as schemaSaveHandle } from './schema/save.js';

type PipelineStep = 'compose' | 'validate' | 'render' | 'codegen' | 'save';

export type PipelineInput = {
  object?: string;
  intent?: string;
  context?: 'detail' | 'list' | 'form' | 'timeline' | 'card' | 'inline';
  layout?: 'dashboard' | 'form' | 'detail' | 'list' | 'auto';
  framework?: CodegenFramework;
  styling?: CodegenStyling;
  save?: string;
  options?: {
    skipValidation?: boolean;
    skipRender?: boolean;
    checkA11y?: boolean;
    renderApply?: boolean;
  };
};

export type PipelineOutput = {
  schemaRef?: string;
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
  pipeline: {
    steps: string[];
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

function firstIssueMessage(issues: ReplIssue[] | CodegenIssue[] | undefined): { code: string; message: string } {
  const issue = issues?.[0];
  if (!issue) {
    return {
      code: 'PIPELINE_STEP_FAILED',
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
  const framework = input.framework ?? 'react';
  const styling = input.styling ?? 'tokens';
  const skipValidation = input.options?.skipValidation === true;
  const skipRender = input.options?.skipRender === true;
  const checkA11y = input.options?.checkA11y === true;
  const renderApply = input.options?.renderApply ?? true;

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

  const finish = (): PipelineOutput => {
    output.pipeline.steps = [...steps];
    output.pipeline.duration = Math.max(1, Date.now() - startedAt);
    return output;
  };

  const fail = (step: PipelineStep, code: string, message: string): PipelineOutput => {
    output.error = { step, code, message };
    return finish();
  };

  steps.push('compose');

  let composeResult: Awaited<ReturnType<typeof composeHandle>>;
  try {
    composeResult = await composeHandle({
      object: input.object,
      intent: input.intent,
      context: input.context,
      layout: input.layout,
      options: {
        validate: false,
      },
    });
  } catch (error) {
    return fail('compose', 'COMPOSE_STEP_EXCEPTION', `compose step threw: ${errorMessage(error)}`);
  }

  output.compose = {
    ...(composeResult.objectUsed?.name ? { object: composeResult.objectUsed.name } : output.compose.object ? { object: output.compose.object } : {}),
    ...(input.context ? { context: input.context } : {}),
    layout: composeResult.layout,
    componentCount: countComponents(composeResult.schema),
  };

  if (composeResult.schemaRef) {
    output.schemaRef = composeResult.schemaRef;
  }

  if (composeResult.status !== 'ok') {
    const issue = firstIssueMessage(composeResult.errors);
    return fail('compose', issue.code, issue.message);
  }

  if (!composeResult.schemaRef) {
    return fail('compose', 'SCHEMA_REF_MISSING', 'compose did not return schemaRef.');
  }

  if (!skipValidation) {
    steps.push('validate');

    let validationResult: Awaited<ReturnType<typeof validateHandle>>;
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
    } catch (error) {
      return fail('validate', 'VALIDATE_STEP_EXCEPTION', `validate step threw: ${errorMessage(error)}`);
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
    try {
      renderResult = await renderHandle({
        mode: 'full',
        schemaRef: composeResult.schemaRef,
        apply: renderApply,
        options: {
          includeTree: false,
        },
      });
    } catch (error) {
      return fail('render', 'RENDER_STEP_EXCEPTION', `render step threw: ${errorMessage(error)}`);
    }

    output.render = {
      ...(renderApply && renderResult.html ? { html: renderResult.html } : {}),
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
  try {
    codegenResult = await codeGenerateHandle({
      schemaRef: composeResult.schemaRef,
      framework,
      options: {
        styling,
      },
    });
  } catch (error) {
    return fail('codegen', 'CODEGEN_STEP_EXCEPTION', `codegen step threw: ${errorMessage(error)}`);
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

  const saveName = input.save?.trim();
  if (saveName) {
    steps.push('save');

    try {
      const saved = await schemaSaveHandle({
        name: saveName,
        schemaRef: composeResult.schemaRef,
      });
      output.saved = {
        name: saved.name,
        version: saved.version,
      };
    } catch (error) {
      return fail('save', 'SAVE_STEP_EXCEPTION', `save step threw: ${errorMessage(error)}`);
    }
  }

  return finish();
}
