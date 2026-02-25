import {
  applyPatch,
  buildPreview,
  loadComponentRegistry,
  summarizeMeta,
  validateComponents,
  validateSchema,
} from './repl.utils.js';
import { renderDocument } from '../render/document.js';
import { renderTree } from '../render/tree-renderer.js';
import type {
  ReplIssue,
  ReplJsonPatchOperation,
  ReplRenderInput,
  ReplRenderOutput,
  ReplValidationMeta,
  UiSchema,
} from '../schemas/generated.js';

function asWarnings(issues: ReplIssue[]): ReplIssue[] {
  return issues.map((entry) => ({ ...entry, severity: entry.severity ?? 'warning' }));
}

function cloneTree(tree: UiSchema | undefined): UiSchema | undefined {
  return tree ? structuredClone(tree) : undefined;
}

export async function handle(input: ReplRenderInput): Promise<ReplRenderOutput> {
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
      normalizedPatch = patchResult.normalized.length ? patchResult.normalized : undefined;
      errors.push(...patchResult.issues);
      appliedPatch = true;
    }
  }

  if (workingTree) {
    errors.push(...validateSchema(workingTree));
    errors.push(...validateComponents(workingTree, registry));
    meta = summarizeMeta(workingTree, registry);
  }

  const status: ReplRenderOutput['status'] = errors.length ? 'error' : 'ok';
  const dslVersion = workingTree?.version ?? input.schema?.version ?? '0.0.0';

  const preview = workingTree ? buildPreview(workingTree, input.researchContext) : undefined;
  if (preview && warnings.length) {
    const warningNotes = warnings.map((entry) => entry.message);
    preview.notes = preview.notes ? [...preview.notes, ...warningNotes] : warningNotes;
  }

  const output: ReplRenderOutput = {
    status,
    mode,
    dslVersion,
    registryVersion: registry.version,
    errors,
    warnings,
    preview,
  };

  const includeTree = input.options?.includeTree ?? true;
  if (workingTree && includeTree) {
    output.renderedTree = workingTree;
  }
  if (normalizedPatch) {
    output.normalizedPatch = normalizedPatch;
  }
  if (appliedPatch) {
    output.appliedPatch = true;
  }
  if (meta) {
    output.meta = meta;
  }
  if (input.apply === true && status === 'ok' && workingTree) {
    const screenHtml = renderTree(workingTree);
    output.html = renderDocument({
      screenHtml,
      schema: workingTree,
    });
  }

  return output;
}
