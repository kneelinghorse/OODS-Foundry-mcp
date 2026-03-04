import {
  applyPatch,
  loadComponentRegistry,
  patchExampleHint,
  summarizeMeta,
  validateComponents,
  validateSchema,
} from './repl.utils.js';
import { loadTokenData, validateContrast } from '../a11y/validate-contrast.js';
import type {
  ReplIssue,
  ReplJsonPatchOperation,
  ReplValidateInput,
  ReplValidateOutput,
  ReplValidationMeta,
  UiSchema,
} from '../schemas/generated.js';
import { resolveSchemaRef } from './schema-ref.js';

function asWarnings(issues: ReplIssue[]): ReplIssue[] {
  return issues.map((entry) => ({ ...entry, severity: entry.severity ?? 'warning' }));
}

function cloneTree(tree: UiSchema | undefined): UiSchema | undefined {
  return tree ? structuredClone(tree) : undefined;
}

export async function handle(input: ReplValidateInput): Promise<ReplValidateOutput> {
  const mode = input.mode ?? 'full';
  const registry = loadComponentRegistry();
  const errors: ReplIssue[] = [];
  const warnings: ReplIssue[] = asWarnings(registry.warnings);

  let workingTree: UiSchema | undefined = undefined;
  let normalizedPatch: ReplJsonPatchOperation[] | undefined;
  let appliedPatch = false;
  let meta: ReplValidationMeta | undefined;

  if (mode === 'full') {
    if (input.schema) {
      workingTree = cloneTree(input.schema);
    } else if (input.schemaRef) {
      const resolved = resolveSchemaRef(input.schemaRef);
      if (resolved.ok) {
        workingTree = resolved.schema;
      } else {
        const code = resolved.reason === 'expired' ? 'SCHEMA_REF_EXPIRED' : 'SCHEMA_REF_NOT_FOUND';
        errors.push({
          code,
          message: `schemaRef '${input.schemaRef}' is ${resolved.reason}.`,
          hint: 'Run design.compose again to obtain a fresh schemaRef, or pass schema inline via the schema field.',
        });
      }
    } else {
      errors.push({ code: 'MISSING_SCHEMA', message: 'schema is required when mode=full' });
    }
  } else {
    if (input.baseTree) {
      workingTree = cloneTree(input.baseTree);
    } else if (input.schemaRef) {
      const resolved = resolveSchemaRef(input.schemaRef);
      if (resolved.ok) {
        workingTree = resolved.schema;
      } else {
        const code = resolved.reason === 'expired' ? 'SCHEMA_REF_EXPIRED' : 'SCHEMA_REF_NOT_FOUND';
        errors.push({
          code,
          message: `schemaRef '${input.schemaRef}' is ${resolved.reason}.`,
          hint: 'Run design.compose again to obtain a fresh schemaRef, or pass baseTree inline via the baseTree field.',
        });
      }
    } else {
      errors.push({
        code: 'MISSING_BASE_TREE',
        message: 'baseTree is required when mode=patch',
        path: '/baseTree',
        hint: patchExampleHint(),
      });
    }
    if (!input.patch) {
      errors.push({
        code: 'MISSING_PATCH',
        message: 'patch is required when mode=patch',
        path: '/patch',
        hint: patchExampleHint(),
      });
    }
    if (workingTree && input.patch) {
      const patchResult = applyPatch(workingTree, input.patch);
      workingTree = patchResult.tree;
      if (patchResult.normalized.length) {
        normalizedPatch = patchResult.normalized;
      }
      errors.push(...patchResult.issues);
      appliedPatch = patchResult.normalized.length > 0 && patchResult.issues.length === 0;
    }
  }

  if (workingTree) {
    errors.push(...validateSchema(workingTree));
    if (input.options?.checkComponents !== false) {
      errors.push(...validateComponents(workingTree, registry));
    }
    meta = summarizeMeta(workingTree, registry);
  }

  // A11y contrast checks — only when explicitly requested and structural validation passed.
  if (input.options?.checkA11y && errors.length === 0) {
    const tokenData = loadTokenData();
    if (tokenData) {
      warnings.push(...validateContrast(tokenData));
    } else {
      warnings.push({
        code: 'A11Y_TOKEN_DATA_MISSING',
        message: 'Token data could not be loaded; a11y contrast checks skipped.',
        severity: 'warning',
      });
    }
  }

  const status = errors.length ? 'invalid' : 'ok';
  const dslVersion = workingTree?.version ?? input.schema?.version ?? '0.0.0';

  const output: ReplValidateOutput = {
    status,
    mode,
    dslVersion,
    registryVersion: registry.version,
    errors,
    warnings,
  };

  const includeTree = input.options?.includeNormalized ?? true;
  if (workingTree && includeTree) {
    output.normalizedTree = workingTree;
  }
  if (normalizedPatch && normalizedPatch.length) {
    output.normalizedPatch = normalizedPatch as ReplValidateOutput['normalizedPatch'];
  }
  if (mode === 'patch') {
    output.appliedPatch = appliedPatch;
  }
  if (meta) {
    output.meta = meta;
  }

  return output;
}
