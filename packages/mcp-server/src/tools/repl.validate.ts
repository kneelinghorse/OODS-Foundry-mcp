import {
  applyPatch,
  loadComponentRegistry,
  summarizeMeta,
  validateComponents,
  validateSchema,
} from './repl.utils.js';
import type {
  ReplIssue,
  ReplJsonPatchOperation,
  ReplValidateInput,
  ReplValidateOutput,
  ReplValidationMeta,
  UiSchema,
} from '../schemas/generated.js';

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
    workingTree = cloneTree(input.schema);
    if (!workingTree) {
      errors.push({ code: 'MISSING_SCHEMA', message: 'schema is required when mode=full' });
    }
  } else {
    workingTree = cloneTree(input.baseTree);
    if (!workingTree) {
      errors.push({ code: 'MISSING_BASE_TREE', message: 'baseTree is required when mode=patch' });
    }
    if (workingTree && input.patch) {
      const patchResult = applyPatch(workingTree, input.patch);
      workingTree = patchResult.tree;
      if (patchResult.normalized.length) {
        normalizedPatch = patchResult.normalized;
      }
      errors.push(...patchResult.issues);
      appliedPatch = true;
    }
  }

  if (workingTree) {
    errors.push(...validateSchema(workingTree));
    if (input.options?.checkComponents !== false) {
      errors.push(...validateComponents(workingTree, registry));
    }
    meta = summarizeMeta(workingTree, registry);
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
    output.normalizedPatch = normalizedPatch;
  }
  if (appliedPatch) {
    output.appliedPatch = true;
  }
  if (meta) {
    output.meta = meta;
  }

  return output;
}
