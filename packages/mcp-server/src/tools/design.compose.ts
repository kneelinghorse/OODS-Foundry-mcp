/**
 * design.compose MCP tool handler.
 *
 * Takes an intent description and produces a valid UiSchema
 * using layout templates (s51-m01) and the component selection
 * engine (s51-m02).
 *
 * Processing:
 *   1. Parse intent to detect layout hint
 *   2. Select layout template
 *   3. Fill slots using component selector
 *   4. Auto-validate via repl.validate
 *   5. Return schema + selections + validation
 */
import type { UiElement, UiSchema } from '../schemas/generated.js';
import {
  dashboardTemplate,
  formTemplate,
  detailTemplate,
  listTemplate,
  resetIdCounter,
  isSlotElement,
  type TemplateResult,
  type Slot,
} from '../compose/templates/index.js';
import {
  selectComponent,
  loadCatalog,
  type SelectionResult,
} from '../compose/component-selector.js';
import { handle as validateHandle } from './repl.validate.js';
import type { ComponentCatalogSummary } from './types.js';
import { createSchemaRef, describeSchemaRef } from './schema-ref.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DesignComposeInput {
  intent: string;
  layout?: 'dashboard' | 'form' | 'detail' | 'list' | 'auto';
  preferences?: {
    theme?: string;
    metricColumns?: number;
    fieldGroups?: number;
    tabCount?: number;
    tabLabels?: string[];
    componentOverrides?: Record<string, string>;
  };
  options?: {
    validate?: boolean;
    topN?: number;
  };
}

export interface ComposeIssue {
  code: string;
  message: string;
  path?: string;
  hint?: string;
}

export interface SlotSelectionEntry {
  slotName: string;
  intent: string;
  selectedComponent?: string;
  candidates: Array<{
    name: string;
    confidence: number;
    reason: string;
  }>;
}

export interface DesignComposeOutput {
  status: 'ok' | 'error';
  layout: string;
  schema: UiSchema;
  schemaRef?: string;
  schemaRefCreatedAt?: string;
  schemaRefExpiresAt?: string;
  selections: SlotSelectionEntry[];
  validation?: {
    status: 'ok' | 'invalid' | 'skipped';
    errors?: ComposeIssue[];
    warnings?: ComposeIssue[];
  };
  warnings: ComposeIssue[];
  errors?: ComposeIssue[];
  meta?: {
    intentParsed: string;
    layoutDetected: string;
    slotCount: number;
    nodeCount: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Layout detection                                                   */
/* ------------------------------------------------------------------ */

type LayoutType = 'dashboard' | 'form' | 'detail' | 'list';

const LAYOUT_KEYWORDS: Record<LayoutType, string[]> = {
  dashboard: ['dashboard', 'metrics', 'overview', 'analytics', 'stats', 'kpi', 'monitor'],
  form: ['form', 'registration', 'signup', 'sign-up', 'create', 'edit', 'input', 'submit', 'settings', 'configure'],
  detail: ['detail', 'profile', 'view', 'show', 'record', 'entity', 'page', 'inspect'],
  list: ['list', 'table', 'browse', 'search', 'catalog', 'directory', 'index', 'inventory'],
};

function detectLayout(intent: string): { layout: LayoutType; confidence: number } {
  const lower = intent.toLowerCase();
  const scores: Record<LayoutType, number> = { dashboard: 0, form: 0, detail: 0, list: 0 };

  for (const [layout, keywords] of Object.entries(LAYOUT_KEYWORDS) as [LayoutType, string[]][]) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        scores[layout] += 1;
      }
    }
  }

  const entries = Object.entries(scores) as [LayoutType, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const [bestLayout, bestScore] = entries[0];
  if (bestScore === 0) {
    // Default to dashboard if no keywords match
    return { layout: 'dashboard', confidence: 0.2 };
  }

  const totalScore = entries.reduce((sum, [, s]) => sum + s, 0);
  return { layout: bestLayout, confidence: bestScore / totalScore };
}

/* ------------------------------------------------------------------ */
/*  Template selection                                                 */
/* ------------------------------------------------------------------ */

function selectTemplate(
  layout: LayoutType,
  preferences: DesignComposeInput['preferences'],
): TemplateResult {
  resetIdCounter();

  switch (layout) {
    case 'dashboard':
      return dashboardTemplate({
        metricColumns: preferences?.metricColumns,
        theme: preferences?.theme,
      });
    case 'form':
      return formTemplate({
        fieldGroups: preferences?.fieldGroups,
        theme: preferences?.theme,
      });
    case 'detail':
      return detailTemplate({
        tabCount: preferences?.tabCount,
        tabLabels: preferences?.tabLabels,
        theme: preferences?.theme,
      });
    case 'list':
      return listTemplate({
        theme: preferences?.theme,
      });
  }
}

/* ------------------------------------------------------------------ */
/*  Slot filling                                                       */
/* ------------------------------------------------------------------ */

function fillSlots(
  slots: Slot[],
  catalog: ComponentCatalogSummary[],
  overrides: Record<string, string> | undefined,
  topN: number,
  intentContext: string,
  tabLabels: string[] | undefined,
): SlotSelectionEntry[] {
  const keywordPriorityIntents = new Set([
    'data-display',
    'data-list',
    'data-table',
    'form-input',
    'metadata-display',
    'metrics-display',
    'status-indicator',
    'tab-panel',
  ]);

  const contextForSlot = (slot: Slot): string[] => {
    const context: string[] = [intentContext, slot.description];
    const match = /^tab-(\d+)$/.exec(slot.name);
    if (match && tabLabels?.[Number(match[1])]) {
      context.push(tabLabels[Number(match[1])]);
    }
    return context.filter(Boolean);
  };

  return slots.map(slot => {
    // Check for explicit override
    const override = overrides?.[slot.name];
    if (override) {
      return {
        slotName: slot.name,
        intent: slot.intent,
        selectedComponent: override,
        candidates: [{
          name: override,
          confidence: 1,
          reason: `user override for slot "${slot.name}"`,
        }],
      };
    }

    // Use the component selector
    const result: SelectionResult = selectComponent(slot.intent, catalog, {
      topN,
      intentContext: contextForSlot(slot),
      preferKeywordMatches: keywordPriorityIntents.has(slot.intent),
    });

    return {
      slotName: slot.name,
      intent: slot.intent,
      selectedComponent: result.candidates[0]?.name,
      candidates: result.candidates,
    };
  });
}

function applyOverridesToSchema(
  schema: UiSchema,
  overrides: Record<string, string> | undefined,
  catalog: ComponentCatalogSummary[],
  warnings: ComposeIssue[],
): void {
  if (!overrides || Object.keys(overrides).length === 0) return;

  const knownComponents = new Set(catalog.map(component => component.name));
  const warned = new Set<string>();

  for (const [slotName, overrideName] of Object.entries(overrides)) {
    if (!knownComponents.has(overrideName) && !warned.has(`${slotName}:${overrideName}`)) {
      warnings.push({
        code: 'UNKNOWN_OVERRIDE_COMPONENT',
        message: `Override component "${overrideName}" for slot "${slotName}" was not found in the catalog.`,
        hint: 'Check the component name or refresh structured data.',
      });
      warned.add(`${slotName}:${overrideName}`);
    }
  }

  const resolveSlotName = (el: UiElement): string | undefined => {
    if (el.meta?.label) return el.meta.label;
    if (el.meta?.intent?.startsWith('slot:')) {
      return el.meta.intent.slice('slot:'.length);
    }
    return undefined;
  };

  const walk = (el: UiElement): void => {
    if (isSlotElement(el)) {
      const slotName = resolveSlotName(el);
      if (slotName && overrides[slotName]) {
        el.component = overrides[slotName];
      }
    }
    el.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
}

/* ------------------------------------------------------------------ */
/*  Node counting                                                      */
/* ------------------------------------------------------------------ */

function countNodes(schema: UiSchema): number {
  let count = 0;
  function walk(el: UiElement) {
    count++;
    el.children?.forEach(walk);
  }
  schema.screens.forEach(walk);
  return count;
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

export async function handle(input: DesignComposeInput): Promise<DesignComposeOutput> {
  const warnings: ComposeIssue[] = [];

  // 1. Parse intent and detect layout
  const intentStr = input.intent.trim();
  let layoutType: LayoutType;
  let layoutDetected: string;

  if (input.layout && input.layout !== 'auto') {
    layoutType = input.layout;
    layoutDetected = `explicit: ${input.layout}`;
  } else {
    const detection = detectLayout(intentStr);
    layoutType = detection.layout;
    layoutDetected = `auto: ${detection.layout} (confidence ${detection.confidence.toFixed(2)})`;

    if (detection.confidence < 0.5) {
      warnings.push({
        code: 'LOW_LAYOUT_CONFIDENCE',
        message: `Layout auto-detection confidence is low (${detection.confidence.toFixed(2)}). Consider specifying layout explicitly.`,
        hint: `Set layout to one of: dashboard, form, detail, list`,
      });
    }
  }

  // 2. Select layout template
  const { schema, slots } = selectTemplate(layoutType, input.preferences);

  // 3. Load catalog and fill slots
  let catalog: ComponentCatalogSummary[];
  try {
    catalog = await loadCatalog();
  } catch (e) {
    return {
      status: 'error',
      layout: layoutType,
      schema,
      selections: [],
      warnings,
      errors: [{
        code: 'CATALOG_LOAD_FAILED',
        message: `Failed to load component catalog: ${(e as Error).message}`,
      }],
    };
  }

  const topN = input.options?.topN ?? 3;
  const selections = fillSlots(
    slots,
    catalog,
    input.preferences?.componentOverrides,
    topN,
    intentStr,
    input.preferences?.tabLabels,
  );
  applyOverridesToSchema(
    schema,
    input.preferences?.componentOverrides,
    catalog,
    warnings,
  );

  // 4. Auto-validate
  let validation: DesignComposeOutput['validation'];
  const shouldValidate = input.options?.validate !== false;

  if (shouldValidate) {
    try {
      const validationResult = await validateHandle({
        mode: 'full',
        schema,
        options: { checkComponents: true },
      });

      validation = {
        status: validationResult.status,
        errors: validationResult.errors.map(e => ({
          code: e.code,
          message: e.message,
          path: e.path,
          hint: e.hint,
        })),
        warnings: validationResult.warnings.map(w => ({
          code: w.code,
          message: w.message,
          path: w.path,
          hint: w.hint,
        })),
      };
    } catch (e) {
      validation = {
        status: 'skipped',
        errors: [{
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${(e as Error).message}`,
        }],
      };
    }
  } else {
    validation = { status: 'skipped' };
  }

  // 5. Return result
  const schemaRefRecord = createSchemaRef(schema, 'compose');
  const schemaRefMeta = describeSchemaRef(schemaRefRecord);

  return {
    status: 'ok',
    layout: layoutType,
    schema,
    schemaRef: schemaRefMeta.ref,
    schemaRefCreatedAt: schemaRefMeta.createdAt,
    schemaRefExpiresAt: schemaRefMeta.expiresAt,
    selections,
    validation,
    warnings,
    meta: {
      intentParsed: intentStr,
      layoutDetected,
      slotCount: slots.length,
      nodeCount: countNodes(schema),
    },
  };
}
