import {
  applyPatch,
  buildPreview,
  loadComponentRegistry,
  summarizeMeta,
  validateComponents,
  validateSchema,
} from './repl.utils.js';
import { getCssForComponents } from '../render/css-extractor.js';
import { renderDocument } from '../render/document.js';
import { renderFragmentsWithErrors, renderTree } from '../render/tree-renderer.js';
import type {
  ReplIssue,
  ReplJsonPatchOperation,
  ReplRenderFormat,
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

function normalizeOutputFormat(input: ReplRenderInput): ReplRenderFormat {
  return input.output?.format === 'fragments' ? 'fragments' : 'document';
}

function normalizeStrict(input: ReplRenderInput): boolean {
  return input.output?.strict ?? false;
}

function normalizeIncludeCss(input: ReplRenderInput): boolean {
  return input.output?.includeCss ?? true;
}

function toComponentCssRef(componentName: string): string {
  return `cmp.${componentName.trim().toLowerCase()}.base`;
}

function toFragmentRenderIssue(nodeId: string, component: string, message: string): ReplIssue {
  return {
    code: 'FRAGMENT_RENDER_FAILED',
    message: `Fragment render failed for node '${nodeId}': ${message}`,
    path: `/fragments/${nodeId}`,
    component,
  };
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

  const format = normalizeOutputFormat(input);
  const strict = normalizeStrict(input);

  // In non-strict fragment mode, UNKNOWN_COMPONENT errors should not block the
  // entire render. They are deferred and reported as per-node errors after
  // rendering, so known components still produce fragments.
  let deferredUnknownErrors: ReplIssue[] = [];
  if (input.apply === true && format === 'fragments' && !strict) {
    deferredUnknownErrors = errors.filter((e) => e.code === 'UNKNOWN_COMPONENT');
    if (deferredUnknownErrors.length > 0) {
      const remaining = errors.filter((e) => e.code !== 'UNKNOWN_COMPONENT');
      errors.length = 0;
      errors.push(...remaining);
    }
  }

  let status: ReplRenderOutput['status'] = errors.length ? 'error' : 'ok';
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
    if (format === 'fragments') {
      const includeCss = normalizeIncludeCss(input);
      const { fragments: fragmentMap, errors: fragmentErrors } = renderFragmentsWithErrors(workingTree);

      // Per-node isolation: remove fallback fragments for unknown top-level
      // components and report them as per-node UNKNOWN_COMPONENT errors.
      if (deferredUnknownErrors.length > 0) {
        for (const screen of workingTree.screens) {
          const children = Array.isArray(screen.children) ? screen.children : [];
          for (const node of children) {
            if (registry.names.size > 0 && !registry.names.has(node.component)) {
              fragmentMap.delete(node.id);
              output.errors.push({
                code: 'UNKNOWN_COMPONENT',
                message: `Component '${node.component}' is not in the OODS registry`,
                path: `/fragments/${node.id}`,
                component: node.component,
                nodeId: node.id,
              });
            }
          }
        }
      }

      if (fragmentErrors.length > 0) {
        const mapped = fragmentErrors.map((entry) => toFragmentRenderIssue(entry.nodeId, entry.component, entry.message));
        output.errors.push(...mapped);
      }

      const hasFragmentFailures = fragmentErrors.length > 0 || deferredUnknownErrors.length > 0;
      if (strict && hasFragmentFailures) {
        status = 'error';
      }

      if (!strict || !hasFragmentFailures) {
        const components = Array.from(fragmentMap.values()).map((entry) => entry.component);
        const cssPayload = getCssForComponents(components, includeCss);
        const includesTokensCss = cssPayload.cssRefs.includes('css.tokens');
        const fragments: NonNullable<ReplRenderOutput['fragments']> = {};

        for (const [nodeId, fragment] of fragmentMap.entries()) {
          const cssRefs = ['css.base'];
          if (includesTokensCss) {
            cssRefs.push('css.tokens');
          }
          const componentRef = toComponentCssRef(fragment.component);
          if (cssPayload.css[componentRef]) {
            cssRefs.push(componentRef);
          }

          fragments[nodeId] = {
            nodeId: fragment.nodeId,
            component: fragment.component,
            html: fragment.html,
            cssRefs,
          };
        }

        if (Object.keys(fragments).length > 0) {
          output.fragments = fragments;
          output.css = cssPayload.css;
        }
      }

      if (!strict && hasFragmentFailures && fragmentMap.size > 0) {
        status = 'ok';
      } else if (hasFragmentFailures && fragmentMap.size === 0) {
        status = 'error';
      }
    } else {
      const screenHtml = renderTree(workingTree);
      output.html = renderDocument({
        screenHtml,
        schema: workingTree,
      });
    }

    output.output = { format, strict };
  }

  output.status = status;

  return output;
}
