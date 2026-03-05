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
import { loadObject } from '../objects/object-loader.js';
import { composeObject, type ComposedObject } from '../objects/trait-composer.js';
import { resolveIntentObject, fuzzyMatchObject } from '../compose/intent-object-resolver.js';
import { populateObjectSchema, populateBindings, fillSlotsWithObject, wireFieldProps } from '../compose/object-slot-filler.js';
import { collectViewExtensions } from '../compose/view-extension-collector.js';
import { expandSlots, type ExpansionContext } from '../compose/slot-expander.js';
import { inferSlotPosition } from '../compose/position-affinity.js';
import { selectPattern, type CompositionContext } from '../compose/slot-patterns.js';
import type { FieldHint } from '../compose/field-affinity.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DesignComposeInput {
  dslVersion?: string;
  intent?: string;
  object?: string;
  context?: 'detail' | 'list' | 'form' | 'timeline' | 'card' | 'inline';
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

export interface ObjectUsedInfo {
  name: string;
  version: string;
  traits: string[];
  fieldsComposed: number;
  viewExtensionsApplied: Record<string, number>;
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
  objectUsed?: ObjectUsedInfo;
  meta?: {
    intentParsed: string;
    layoutDetected: string;
    slotCount: number;
    nodeCount: number;
    objectAutoDetected?: string;
    contextAutoDetected?: string;
    intentSynthetic?: boolean;
    warnings?: string[];
    /** Intelligence indicators from Sprint 73 compositor features */
    intelligence?: {
      fieldsExpanded?: boolean;
      slotsExpanded?: number;
      expansionReason?: string;
      patternsApplied?: number;
      positionAffinityUsed?: boolean;
      fieldAffinityUsed?: boolean;
    };
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
  fieldHints?: Map<string, FieldHint>,
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

    // Use the component selector with intelligence signals
    const slotPosition = inferSlotPosition(slot.name);
    const result: SelectionResult = selectComponent(slot.intent, catalog, {
      topN,
      intentContext: contextForSlot(slot),
      preferKeywordMatches: keywordPriorityIntents.has(slot.intent),
      ...(fieldHints?.has(slot.name) ? { fieldHint: fieldHints.get(slot.name) } : {}),
      ...(slotPosition ? { slotPosition } : {}),
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
        code: 'OODS-V006',
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
/*  Context → layout inference                                         */
/* ------------------------------------------------------------------ */

const CONTEXT_TO_LAYOUT: Record<string, LayoutType> = {
  detail: 'detail',
  list: 'list',
  form: 'form',
  timeline: 'detail',
  card: 'detail',
  inline: 'list',
};

function inferLayoutFromContext(context: string | undefined): LayoutType {
  if (context && context in CONTEXT_TO_LAYOUT) {
    return CONTEXT_TO_LAYOUT[context];
  }
  return 'detail'; // default when context is unknown or missing
}

/* ------------------------------------------------------------------ */
/*  Object → objectUsed metadata                                       */
/* ------------------------------------------------------------------ */

function buildObjectUsedInfo(composed: ComposedObject): ObjectUsedInfo {
  const viewExtensionsApplied: Record<string, number> = {};
  for (const [ctx, exts] of Object.entries(composed.viewExtensions)) {
    viewExtensionsApplied[ctx] = exts.length;
  }

  return {
    name: composed.object.name,
    version: composed.object.version,
    traits: composed.traits.map((t) => t.ref.name),
    fieldsComposed: Object.keys(composed.schema).length,
    viewExtensionsApplied,
  };
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

  // Reject empty or whitespace-only intent when no object is provided
  if (input.intent !== undefined && !input.intent.trim() && !input.object) {
    return {
      status: 'error',
      layout: '',
      schema: { version: '2026.02', screens: [{ id: 'err-0', component: 'Box' }] },
      selections: [],
      warnings: [],
      errors: [{
        code: 'OODS-V003',
        message: 'intent must not be empty or whitespace-only when no object is provided.',
        hint: 'Provide a descriptive intent (e.g., "A detail view for a Product") or specify an object.',
      }],
    };
  }

  // Resolve intent/object/context via hybrid resolver
  const resolved = resolveIntentObject(input.intent, input.object, input.context);

  // Surface resolution warnings
  for (const w of resolved.warnings) {
    warnings.push({ code: 'OODS-V118', message: w });
  }

  // Use resolved values (may include auto-detected object/context)
  const effectiveObject = resolved.object;
  const effectiveContext = resolved.context ?? input.context;

  // Object-aware composition: load and compose when object is present
  let composed: ComposedObject | undefined;
  let objectUsed: ObjectUsedInfo | undefined;

  if (effectiveObject) {
    try {
      const objectDef = loadObject(effectiveObject);
      composed = composeObject(objectDef);
      objectUsed = buildObjectUsedInfo(composed);

      // Surface maturity warning for non-stable objects
      const maturity = objectDef.metadata?.maturity;
      if (maturity && maturity !== 'stable') {
        warnings.push({
          code: 'OODS-V121',
          message: `Object '${effectiveObject}' has maturity '${maturity}' — composed output may change.`,
          hint: 'Consider using stable objects for production compositions.',
        });
      }

      // Surface composition warnings
      for (const w of composed.warnings) {
        warnings.push({
          code: 'OODS-V117',
          message: w,
        });
      }
    } catch (e) {
      // Fuzzy-match suggestion for unknown objects
      const fuzzy = fuzzyMatchObject(effectiveObject);
      const hint = fuzzy && fuzzy.similarity >= 0.4
        ? `Did you mean "${fuzzy.match}"? (similarity: ${(fuzzy.similarity * 100).toFixed(0)}%)`
        : 'Check the object name or verify objects/ directory.';

      return {
        status: 'error',
        layout: '',
        schema: { version: '2026.02', screens: [{ id: 'err-0', component: 'Box' }] },
        selections: [],
        warnings,
        errors: [{
          code: 'OODS-S004',
          message: `Failed to load object "${effectiveObject}": ${(e as Error).message}`,
          hint,
        }],
      };
    }
  }

  // 1. Parse intent and detect layout
  const intentStr = resolved.intent;
  let layoutType: LayoutType;
  let layoutDetected: string;

  if (input.layout && input.layout !== 'auto') {
    layoutType = input.layout;
    layoutDetected = `explicit: ${input.layout}`;
  } else if (composed && effectiveContext) {
    // Object-aware: infer layout from context param
    layoutType = inferLayoutFromContext(effectiveContext);
    layoutDetected = `context-inferred: ${layoutType} (from context="${effectiveContext}")`;
  } else {
    const detection = detectLayout(intentStr);
    layoutType = detection.layout;
    layoutDetected = `auto: ${detection.layout} (confidence ${detection.confidence.toFixed(2)})`;

    if (detection.confidence < 0.5) {
      warnings.push({
        code: 'OODS-V116',
        message: `Layout auto-detection confidence is low (${detection.confidence.toFixed(2)}). Consider specifying layout explicitly.`,
        hint: `Set layout to one of: dashboard, form, detail, list`,
      });
    }
  }

  // 2. Select layout template
  let template = selectTemplate(layoutType, input.preferences);
  let { schema, slots } = template;

  // 2b. Expand slots if object has more fields than template provides
  let expansionResult: ReturnType<typeof expandSlots> | undefined;
  if (composed) {
    const semanticTypes: Record<string, string> = {};
    if (composed.semantics) {
      for (const [name, sem] of Object.entries(composed.semantics)) {
        if (sem.semantic_type) semanticTypes[name] = sem.semantic_type;
      }
    }

    const expCtx: ExpansionContext = {
      layout: layoutType,
      fields: composed.schema,
      semanticTypes,
    };
    expansionResult = expandSlots(template, expCtx);
    if (expansionResult.expanded) {
      template = expansionResult.template;
      schema = template.schema;
      slots = template.slots;
    }
  }

  // 3. Load catalog and fill slots
  let catalog: ComponentCatalogSummary[];
  try {
    const fullCatalog = await loadCatalog();
    catalog = fullCatalog.filter((c) => c.status !== 'planned');
  } catch (e) {
    return {
      status: 'error',
      layout: layoutType,
      schema,
      selections: [],
      warnings,
      errors: [{
        code: 'OODS-S005',
        message: `Failed to load component catalog: ${(e as Error).message}`,
      }],
    };
  }

  const topN = input.options?.topN ?? 3;

  // 3a. Object-aware slot filling: use view_extensions when object is present
  let selections: SlotSelectionEntry[];
  const contextForExtensions = effectiveContext ?? layoutType;
  let patternsApplied = 0;

  // Build field hints for intelligence-aware selection
  const fieldHints = new Map<string, FieldHint>();
  if (composed) {
    for (const [fieldName, fieldDef] of Object.entries(composed.schema)) {
      const hint: FieldHint = { type: fieldDef.type };
      if (fieldDef.validation?.enum && fieldDef.validation.enum.length > 0) {
        hint.enum = fieldDef.validation.enum;
      }
      if (composed.semantics?.[fieldName]?.semantic_type) {
        hint.semanticType = composed.semantics[fieldName].semantic_type;
      }
      fieldHints.set(fieldName, hint);
    }
  }

  if (composed) {
    const collected = collectViewExtensions(composed, contextForExtensions);
    for (const w of collected.warnings) {
      warnings.push({ code: 'OODS-V119', message: w });
    }

    if (collected.plan.length > 0) {
      // Use view_extension-driven slot filling
      const fillResult = fillSlotsWithObject(
        { schema, slots },
        collected.plan,
        catalog,
        input.preferences?.componentOverrides,
        intentStr,
      );
      for (const w of fillResult.warnings) {
        warnings.push({ code: 'OODS-V120', message: w });
      }

      // Convert placements to selections format
      selections = fillResult.placements.map((p) => ({
        slotName: p.slotName,
        intent: slots.find((s) => s.name === p.slotName)?.intent ?? '',
        selectedComponent: p.components[0],
        candidates: p.components.map((name) => ({
          name,
          confidence: p.source === 'view_extension' ? 0.95 : p.source === 'override' ? 1 : 0.5,
          reason: `${p.source} placement`,
        })),
      }));

      // Also fill any remaining slots not covered by view_extensions
      const filledSlotNames = new Set(fillResult.placements.map((p) => p.slotName));
      const unfilledSlots = slots.filter((s) => !filledSlotNames.has(s.name));
      if (unfilledSlots.length > 0) {
        const fallbackSelections = fillSlots(
          unfilledSlots,
          catalog,
          input.preferences?.componentOverrides,
          topN,
          intentStr,
          input.preferences?.tabLabels,
          fieldHints.size > 0 ? fieldHints : undefined,
        );
        selections.push(...fallbackSelections);
      }
    } else {
      // No view_extensions for this context — fall back to generic slot filling
      selections = fillSlots(
        slots,
        catalog,
        input.preferences?.componentOverrides,
        topN,
        intentStr,
        input.preferences?.tabLabels,
        fieldHints.size > 0 ? fieldHints : undefined,
      );
    }

    // Apply composite slot patterns for form/dashboard contexts
    if (composed && (layoutType === 'form' || layoutType === 'dashboard')) {
      const compCtx = layoutType as CompositionContext;
      const semanticMap: Record<string, string> = {};
      if (composed.semantics) {
        for (const [name, sem] of Object.entries(composed.semantics)) {
          if (sem.semantic_type) semanticMap[name] = sem.semantic_type;
        }
      }

      // Apply patterns to unassigned fields
      const assignedFields = new Set<string>();
      const walk = (el: UiElement): void => {
        if (el.props?.field && typeof el.props.field === 'string') {
          assignedFields.add(el.props.field as string);
        }
        el.children?.forEach(walk);
      };
      schema.screens.forEach(walk);

      for (const [fieldName, fieldDef] of Object.entries(composed.schema)) {
        if (assignedFields.has(fieldName)) continue;
        const pattern = selectPattern(fieldName, fieldDef, compCtx, semanticMap[fieldName]);
        if (pattern) {
          patternsApplied++;
        }
      }
    }
  } else {
    // No object — use generic slot filling (backward compatible)
    selections = fillSlots(
      slots,
      catalog,
      input.preferences?.componentOverrides,
      topN,
      intentStr,
      input.preferences?.tabLabels,
    );
  }

  applyOverridesToSchema(
    schema,
    input.preferences?.componentOverrides,
    catalog,
    warnings,
  );

  // 3b. Populate object schema, field→component wiring, and bindings for codegen
  if (composed) {
    populateObjectSchema(schema, composed.schema, composed.semantics);
    wireFieldProps(schema);

    if (effectiveContext) {
      populateBindings(
        schema,
        effectiveContext,
        Object.keys(composed.schema),
      );
    }
  }

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
          code: 'OODS-V007',
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
    ...(objectUsed ? { objectUsed } : {}),
    meta: {
      intentParsed: intentStr,
      layoutDetected,
      slotCount: slots.length,
      nodeCount: countNodes(schema),
      ...(resolved.objectSource === 'auto-detected' ? { objectAutoDetected: resolved.object } : {}),
      ...(resolved.contextSource === 'auto-detected' ? { contextAutoDetected: resolved.context } : {}),
      ...(resolved.intentSource === 'synthetic' ? { intentSynthetic: true } : {}),
      ...(warnings.length > 0 ? { warnings: warnings.map((w) => w.message) } : {}),
      ...(composed ? {
        intelligence: {
          fieldsExpanded: expansionResult?.expanded ?? false,
          ...(expansionResult?.expanded ? {
            slotsExpanded: expansionResult.slotsAdded,
            expansionReason: expansionResult.reason,
          } : {}),
          patternsApplied: patternsApplied > 0 ? patternsApplied : undefined,
          positionAffinityUsed: true,
          fieldAffinityUsed: fieldHints.size > 0,
        },
      } : {}),
    },
  };
}
