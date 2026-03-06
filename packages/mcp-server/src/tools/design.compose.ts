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
import type { FieldDefinition, SemanticMapping } from '../objects/types.js';
import { resolveIntentObject, fuzzyMatchObject } from '../compose/intent-object-resolver.js';
import { populateObjectSchema, populateBindings, fillSlotsWithObject, wireFieldProps, applySelectionsToSchema } from '../compose/object-slot-filler.js';
import { collectDashboardViewExtensions, collectViewExtensions } from '../compose/view-extension-collector.js';
import type { SlotPlan } from '../compose/view-extension-collector.js';
import { expandSlots, groupFieldsIntoSlots, type ExpansionContext } from '../compose/slot-expander.js';
import { inferSlotPosition } from '../compose/position-affinity.js';
import { selectPattern, type CompositionContext } from '../compose/slot-patterns.js';
import type { FieldHint } from '../compose/field-affinity.js';
import {
  buildDashboardSectionPlan,
  buildSlotContextOverridesFromSections,
  parseIntentSections,
  prefersDashboardLayout,
} from '../compose/intent-sections.js';

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
      intentSectionsParsed?: number;
      sectionContextUsed?: boolean;
    };
  };
}

/* ------------------------------------------------------------------ */
/*  Layout detection                                                   */
/* ------------------------------------------------------------------ */

type LayoutType = 'dashboard' | 'form' | 'detail' | 'list';
type FormFieldSlotConfig = {
  description?: string;
  intent?: string;
  required?: boolean;
};

const LAYOUT_KEYWORDS: Record<LayoutType, string[]> = {
  dashboard: ['dashboard', 'metrics', 'overview', 'analytics', 'stats', 'kpi', 'monitor'],
  form: ['form', 'registration', 'signup', 'sign-up', 'edit', 'input', 'submit', 'settings', 'configure'],
  detail: ['detail', 'profile', 'view', 'show', 'record', 'entity', 'page', 'inspect'],
  list: ['list', 'table', 'browse', 'search', 'catalog', 'directory', 'index', 'inventory'],
};

function hasLayoutKeyword(intent: string, keyword: string): boolean {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(keyword.toLowerCase())}([^a-z0-9]|$)`, 'i');
  return pattern.test(intent);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectLayout(intent: string): { layout: LayoutType; confidence: number } {
  const lower = intent.toLowerCase();
  const scores: Record<LayoutType, number> = { dashboard: 0, form: 0, detail: 0, list: 0 };

  for (const [layout, keywords] of Object.entries(LAYOUT_KEYWORDS) as [LayoutType, string[]][]) {
    for (const kw of keywords) {
      if (hasLayoutKeyword(lower, kw)) {
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
  dashboardSectionPlan?: ReturnType<typeof buildDashboardSectionPlan>,
  formFieldSlots?: FormFieldSlotConfig[],
): TemplateResult {
  resetIdCounter();

  switch (layout) {
    case 'dashboard':
      return dashboardTemplate({
        metricColumns: preferences?.metricColumns,
        sectionPlan: dashboardSectionPlan,
        theme: preferences?.theme,
      });
    case 'form':
      return formTemplate({
        fieldGroups: preferences?.fieldGroups,
        fieldSlots: formFieldSlots,
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
  slotContextOverrides?: Map<string, string[]>,
  strictFieldControlSlots?: Set<string>,
): SlotSelectionEntry[] {
  const keywordPriorityIntents = new Set([
    'boolean-input',
    'data-display',
    'data-table',
    'date-input',
    'email-input',
    'enum-input',
    'form-input',
    'long-text-input',
    'metadata-display',
    'metrics-display',
    'search-input',
    'status-indicator',
    'tab-panel',
  ]);
  const formControlIntents = new Set([
    'boolean-input',
    'date-input',
    'email-input',
    'enum-input',
    'form-input',
    'long-text-input',
  ]);

  const contextForSlot = (slot: Slot): string[] => {
    const overrideContext = slotContextOverrides?.get(slot.name);
    const suppressFormControlBias = strictFieldControlSlots?.has(slot.name) && formControlIntents.has(slot.intent);
    if (suppressFormControlBias) {
      return (overrideContext && overrideContext.length > 0
        ? overrideContext
        : [intentContext]).filter(Boolean);
    }

    const context: string[] = overrideContext && overrideContext.length > 0
      ? [...overrideContext, slot.description]
      : [intentContext, slot.description];
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
    const suppressFormControlBias = strictFieldControlSlots?.has(slot.name) && formControlIntents.has(slot.intent);
    const slotFieldHint = !suppressFormControlBias ? fieldHints?.get(slot.name) : undefined;
    const useKeywordMatches = !suppressFormControlBias && keywordPriorityIntents.has(slot.intent);
    const result: SelectionResult = selectComponent(slot.intent, catalog, {
      topN,
      intentContext: contextForSlot(slot),
      preferKeywordMatches: useKeywordMatches,
      ...(slotFieldHint ? { fieldHint: slotFieldHint } : {}),
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
/*  Field group → intent inference                                     */
/* ------------------------------------------------------------------ */

/**
 * Infer a differentiated slot intent from the dominant field types/semantics
 * in a field group. Produces intents like 'status-indicator', 'metrics-display',
 * 'metadata-display', 'form-input' instead of the generic 'data-display'.
 */
function inferSlotIntentFromFields(
  fieldNames: string[],
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): string | undefined {
  if (fieldNames.length === 0) return undefined;

  // Count semantic/type categories
  const categories: Record<string, number> = {};

  for (const name of fieldNames) {
    const field = schema[name];
    if (!field) continue;

    const lowerName = name.toLowerCase();
    const sem = semantics?.[name]?.semantic_type?.toLowerCase();
    const isStatusLike = Boolean(
      sem && /(^|\.)(status|lifecycle)(\.|$)/.test(sem),
    ) || lowerName === 'status' || lowerName.endsWith('_status') || lowerName.endsWith('_state');
    const isMetricLike = Boolean(
      sem && /(currency|price|percentage|count|metric)/.test(sem),
    ) || field.type === 'number' || field.type === 'integer';
    const isTemporalLike = Boolean(
      sem && /(timestamp|date|time|audit)/.test(sem),
    ) || field.type === 'datetime' || field.type === 'date' || lowerName.endsWith('_at');
    const isMetadataLike = field.type === 'boolean'
      || Boolean(field.validation?.enum && field.validation.enum.length > 0)
      || field.type === 'object[]'
      || field.type.endsWith('[]');

    if (isStatusLike) {
      categories['status'] = (categories['status'] ?? 0) + 1;
    } else if (isMetricLike) {
      categories['metrics'] = (categories['metrics'] ?? 0) + 1;
    } else if (isTemporalLike) {
      categories['temporal'] = (categories['temporal'] ?? 0) + 1;
    } else if (isMetadataLike) {
      categories['metadata'] = (categories['metadata'] ?? 0) + 1;
    }
  }

  // Find dominant category
  let dominant: string | undefined;
  let maxCount = 0;
  for (const [cat, count] of Object.entries(categories)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = cat;
    }
  }

  // Map category to intent
  switch (dominant) {
    case 'status': return 'status-indicator';
    case 'metrics': return 'metrics-display';
    case 'temporal': return 'metadata-display';
    case 'metadata': return 'metadata-display';
    default: return undefined; // Keep 'data-display' default
  }
}

const FORM_INTENT_PRIORITY = [
  'long-text-input',
  'enum-input',
  'boolean-input',
  'date-input',
  'email-input',
  'form-input',
] as const;

function buildSemanticTypeMap(
  semantics?: Record<string, SemanticMapping>,
): Record<string, string> {
  const semanticTypes: Record<string, string> = {};
  if (!semantics) return semanticTypes;

  for (const [name, sem] of Object.entries(semantics)) {
    if (sem.semantic_type) {
      semanticTypes[name] = sem.semantic_type;
    }
  }

  return semanticTypes;
}

function humanizeFieldName(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isLongTextField(
  fieldName: string,
  field: FieldDefinition,
  semantics?: Record<string, SemanticMapping>,
): boolean {
  if (field.type !== 'string') return false;

  const uiHints = semantics?.[fieldName]?.ui_hints;
  const hintMaxLength = typeof uiHints?.maxLength === 'number'
    ? uiHints.maxLength
    : undefined;
  const validationMaxLength = typeof field.validation?.maxLength === 'number'
    ? field.validation.maxLength
    : undefined;
  const normalizedName = fieldName.replace(/[_-]+/g, ' ');
  const lowerText = `${normalizedName} ${field.description}`.toLowerCase();

  return Boolean(
    uiHints?.multiline === true
    || (hintMaxLength && hintMaxLength >= 120)
    || (validationMaxLength && validationMaxLength >= 120)
    || /\b(description|summary|notes?|message|comment|reason|details?|body|content|bio|explanation|free form)\b/.test(lowerText),
  );
}

function inferFormSlotIntentFromFields(
  fieldNames: string[],
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): string {
  if (fieldNames.length === 0) return 'form-input';

  const counts: Record<string, number> = {};

  for (const fieldName of fieldNames) {
    const field = schema[fieldName];
    if (!field) continue;

    const semanticType = semantics?.[fieldName]?.semantic_type?.toLowerCase() ?? '';
    let intent = 'form-input';

    if (isLongTextField(fieldName, field, semantics)) {
      intent = 'long-text-input';
    } else if (field.validation?.enum && field.validation.enum.length > 0) {
      intent = 'enum-input';
    } else if (field.type === 'boolean') {
      intent = 'boolean-input';
    } else if (
      field.type === 'date'
      || field.type === 'datetime'
      || /(timestamp|date|time|calendar)/.test(semanticType)
    ) {
      intent = 'date-input';
    } else if (field.type === 'email' || semanticType.includes('email')) {
      intent = 'email-input';
    }

    counts[intent] = (counts[intent] ?? 0) + 1;
  }

  let bestIntent: typeof FORM_INTENT_PRIORITY[number] = 'form-input';
  let bestCount = 0;

  for (const intent of FORM_INTENT_PRIORITY) {
    const count = counts[intent] ?? 0;
    if (count > bestCount) {
      bestIntent = intent;
      bestCount = count;
    }
  }

  return bestIntent;
}

function buildFormSlotDescription(slotName: string, fieldNames: string[]): string {
  const slotIndex = Number.parseInt(slotName.replace('field-', ''), 10);
  if (fieldNames.length === 0) {
    return `Form field group ${Number.isNaN(slotIndex) ? 1 : slotIndex + 1}`;
  }

  const labels = fieldNames.slice(0, 3).map(humanizeFieldName);
  const suffix = fieldNames.length > 3 ? ', ...' : '';
  return `Form fields: ${labels.join(', ')}${suffix}`;
}

function buildFormSlotMetadata(
  slotName: string,
  fieldNames: string[],
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): FormFieldSlotConfig {
  return {
    description: buildFormSlotDescription(slotName, fieldNames),
    intent: inferFormSlotIntentFromFields(fieldNames, schema, semantics),
    required: slotName === 'field-0',
  };
}

function buildFormFieldSlots(
  fieldGroups: number,
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
  semanticTypes?: Record<string, string>,
): FormFieldSlotConfig[] {
  const slotNames = Array.from({ length: fieldGroups }, (_, idx) => `field-${idx}`);
  const groupedFields = groupFieldsIntoSlots(schema, slotNames, semanticTypes);

  return slotNames.map((slotName, idx) => {
    const fieldNames = groupedFields[slotName] ?? [];
    if (fieldNames.length === 0) {
      return {
        description: `Form field group ${idx + 1}`,
        intent: 'form-input',
        required: idx === 0,
      };
    }

    return buildFormSlotMetadata(slotName, fieldNames, schema, semantics);
  });
}

function applyFormSlotMetadata(
  slots: Slot[],
  fieldGroups: Record<string, string[]>,
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): void {
  for (const slot of slots) {
    if (!slot.name.startsWith('field-')) continue;
    const fieldNames = fieldGroups[slot.name];
    if (!fieldNames || fieldNames.length === 0) continue;

    const metadata = buildFormSlotMetadata(slot.name, fieldNames, schema, semantics);
    slot.intent = metadata.intent ?? slot.intent;
    slot.description = metadata.description ?? slot.description;
  }
}

function resolvePrimaryFieldForFormSlot(
  slotIntent: string,
  fieldNames: string[],
  schema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): string | undefined {
  const matchingField = fieldNames.find((fieldName) => (
    inferFormSlotIntentFromFields([fieldName], schema, semantics) === slotIntent
  ));

  return matchingField ?? fieldNames[0];
}

function getSlotName(node: UiElement): string | undefined {
  if (node.meta?.label) return node.meta.label;
  if (node.meta?.intent?.startsWith('slot:')) {
    return node.meta.intent.slice('slot:'.length);
  }
  return undefined;
}

function applyFormFieldBindingsFromGroups(
  schema: UiSchema,
  slots: Slot[],
  fieldGroups: Record<string, string[]>,
  objectSchema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): void {
  const fieldBySlot = new Map<string, string>();

  for (const slot of slots) {
    if (!slot.name.startsWith('field-')) continue;
    const fieldNames = fieldGroups[slot.name] ?? [];
    const primaryField = resolvePrimaryFieldForFormSlot(slot.intent, fieldNames, objectSchema, semantics);
    if (primaryField) {
      fieldBySlot.set(slot.name, primaryField);
    }
  }

  const walk = (node: UiElement): void => {
    const slotName = getSlotName(node);
    const fieldName = slotName ? fieldBySlot.get(slotName) : undefined;
    if (fieldName && typeof node.props?.field !== 'string') {
      node.props = {
        ...(node.props ?? {}),
        field: fieldName,
      };
    }
    node.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
}

/**
 * Enrich form field nodes with label/placeholder/type props derived from
 * intent-parsed field descriptions. Called in the no-object form path
 * after slot filling and selection application.
 */
function enrichFormFieldPropsFromIntent(
  schema: UiSchema,
  slotContextOverrides: Map<string, string[]>,
  fieldHints: Map<string, FieldHint>,
): void {
  const FORM_CONTROL_COMPONENTS = new Set([
    'Input', 'Select', 'Textarea', 'DatePicker', 'Toggle', 'Checkbox', 'Switch',
    'TagInput', 'SearchInput', 'PreferenceEditor',
  ]);

  const walk = (node: UiElement): void => {
    const slotName = getSlotName(node);
    if (slotName && slotName.startsWith('field-') && FORM_CONTROL_COMPONENTS.has(node.component)) {
      const contexts = slotContextOverrides.get(slotName);
      const hint = fieldHints.get(slotName);
      if (contexts && contexts.length > 0) {
        const label = contexts[0]
          .replace(/\b(toggle|switch|checkbox|dropdown|select|selector|input)\b/gi, '')
          .trim();
        if (label) {
          node.props = {
            ...(node.props ?? {}),
            label,
            placeholder: `Enter ${label.toLowerCase()}`,
          };
        }
      }
      if (hint && node.component === 'Input') {
        if (hint.type === 'email') {
          node.props = { ...(node.props ?? {}), type: 'email' };
        } else if (hint.type === 'number' || hint.type === 'integer') {
          node.props = { ...(node.props ?? {}), type: 'number' };
        } else if (hint.type === 'url') {
          node.props = { ...(node.props ?? {}), type: 'url' };
        }
      }
      if (hint?.enum && hint.enum.length > 0 && node.component === 'Select') {
        node.props = {
          ...(node.props ?? {}),
          options: hint.enum,
        };
      }
    }
    node.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
}

function inferIntentFieldHint(phrase: string): FieldHint {
  const lower = phrase.toLowerCase();

  if (/(toggle|switch|checkbox|boolean|enable|disable|opt[\s-]?in|opt[\s-]?out)/.test(lower)) {
    return { type: 'boolean' };
  }

  if (/(dropdown|select|selector|radio|enum|choice|options?)/.test(lower)) {
    return { type: 'string', enum: ['option-a', 'option-b'] };
  }

  if (/(timestamp|time|scheduled at|scheduled for)/.test(lower)) {
    return { type: 'datetime', semanticType: 'timestamp' };
  }

  if (/(date|calendar|deadline|due)/.test(lower)) {
    return { type: 'date', semanticType: 'timestamp' };
  }

  if (/\bemail\b/.test(lower)) {
    return { type: 'email' };
  }

  if (/\b(url|link|website)\b/.test(lower)) {
    return { type: 'url' };
  }

  if (/\b(amount|price|total|count|quantity|qty|revenue|score|number)\b/.test(lower)) {
    return { type: 'number' };
  }

  return { type: 'string' };
}

function fieldHintToSlotIntent(hint: FieldHint): string | undefined {
  if (hint.enum && hint.enum.length > 0) return 'enum-input';
  if (hint.type === 'boolean') return 'boolean-input';
  if (hint.type === 'date' || hint.type === 'datetime') return 'date-input';
  if (hint.type === 'email') return 'email-input';
  return undefined;
}

function inferFormFieldDescriptorsFromIntent(
  intent: string,
  slots: Slot[],
): Map<string, { hint: FieldHint; context: string[] }> {
  const fieldSlots = slots
    .filter((slot) => /^field-\d+$/.test(slot.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (fieldSlots.length === 0) {
    return new Map();
  }

  const listSource = intent.includes(':')
    ? intent.slice(intent.indexOf(':') + 1)
    : intent;
  const phrases = listSource
    .split(/,|;|\n|\band\b/gi)
    .map((part) => part.trim())
    .filter(Boolean);

  if (phrases.length < 2) {
    return new Map();
  }

  const lowerIntent = intent.toLowerCase();
  const preferenceContext = /(settings|preference|notification)/.test(lowerIntent)
    ? 'settings preferences notification'
    : undefined;
  const descriptors = new Map<string, { hint: FieldHint; context: string[] }>();
  for (let i = 0; i < fieldSlots.length && i < phrases.length; i++) {
    const hint = inferIntentFieldHint(phrases[i]);
    if (hint.type === 'boolean' && preferenceContext) {
      hint.semanticType = 'preferences.toggle';
    }

    descriptors.set(fieldSlots[i].name, {
      hint,
      context: hint.semanticType === 'preferences.toggle' && preferenceContext
        ? [phrases[i], preferenceContext]
        : [phrases[i]],
    });
  }

  return descriptors;
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

function resolveCatalogFallback(
  entry: SlotPlan,
  layout: LayoutType,
): string | undefined {
  switch (entry.component) {
    case 'BillingSummaryBadge':
      return layout === 'dashboard' ? 'PriceSummary' : 'PriceBadge';
    case 'BillingCardMeta':
      return 'PriceCardMeta';
    default:
      return undefined;
  }
}

function normalizeObjectPlanForCatalog(
  plan: SlotPlan[],
  catalog: ComponentCatalogSummary[],
  layout: LayoutType,
): SlotPlan[] {
  const allowedComponents = new Set(catalog.map((component) => component.name));
  const deduped = new Set<string>();
  const normalized: SlotPlan[] = [];

  for (const entry of plan) {
    const component = allowedComponents.has(entry.component)
      ? entry.component
      : resolveCatalogFallback(entry, layout);
    if (!component || !allowedComponents.has(component)) {
      continue;
    }

    const nextEntry = component === entry.component
      ? entry
      : { ...entry, component };
    const signature = `${nextEntry.targetSlot ?? ''}:${nextEntry.component}:${JSON.stringify(nextEntry.props)}`;
    if (deduped.has(signature)) {
      continue;
    }

    deduped.add(signature);
    normalized.push(nextEntry);
  }

  return normalized;
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

  const semanticTypes = buildSemanticTypeMap(composed?.semantics);

  // 1. Parse intent and detect layout
  const intentStr = resolved.intent;
  const parsedIntentSections = parseIntentSections(intentStr);
  const dashboardSectionPlan = buildDashboardSectionPlan(parsedIntentSections);
  let layoutType: LayoutType;
  let layoutDetected: string;

  if (input.layout && input.layout !== 'auto') {
    layoutType = input.layout;
    layoutDetected = `explicit: ${input.layout}`;
  } else if (composed && effectiveContext) {
    const inferredLayout = inferLayoutFromContext(effectiveContext);
    if (resolved.contextSource === 'auto-detected' && prefersDashboardLayout(parsedIntentSections) && inferredLayout !== 'dashboard') {
      layoutType = 'dashboard';
      layoutDetected = `auto: dashboard (section-signaled, base ${inferredLayout}, confidence 0.75)`;
    } else {
      // Object-aware: infer layout from explicit or aligned context hints.
      layoutType = inferredLayout;
      layoutDetected = `context-inferred: ${layoutType} (from context="${effectiveContext}")`;
    }
  } else {
    const detection = detectLayout(intentStr);
    if (prefersDashboardLayout(parsedIntentSections) && detection.layout !== 'dashboard') {
      layoutType = 'dashboard';
      layoutDetected = `auto: dashboard (section-signaled, base ${detection.layout}, confidence ${Math.max(detection.confidence, 0.75).toFixed(2)})`;
    } else {
      layoutType = detection.layout;
      layoutDetected = `auto: ${detection.layout} (confidence ${detection.confidence.toFixed(2)})`;
    }

    if (detection.confidence < 0.5) {
      warnings.push({
        code: 'OODS-V116',
        message: `Layout auto-detection confidence is low (${detection.confidence.toFixed(2)}). Consider specifying layout explicitly.`,
        hint: `Set layout to one of: dashboard, form, detail, list`,
      });
    }
  }

  // 2. Select layout template
  let template = selectTemplate(
    layoutType,
    input.preferences,
    layoutType === 'dashboard' ? dashboardSectionPlan : undefined,
    layoutType === 'form' && composed
      ? buildFormFieldSlots(
        input.preferences?.fieldGroups ?? 3,
        composed.schema,
        composed.semantics,
        semanticTypes,
      )
      : undefined,
  );
  let { schema, slots } = template;

  // 2b. Expand slots if object has more fields than template provides
  let expansionResult: ReturnType<typeof expandSlots> | undefined;
  let formFieldGroups: Record<string, string[]> | undefined;
  if (composed) {
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
    // Differentiate tab slot intents based on field group semantics.
    // This ensures each tab selects a different component instead of
    // all tabs getting the same 'data-display' → Card result.
    const fieldGroups = expansionResult?.fieldGroups;
    formFieldGroups = layoutType === 'form' ? fieldGroups : undefined;
    if (fieldGroups && composed) {
      for (const slot of slots) {
        if (!slot.name.startsWith('tab-')) continue;
        const groupFields = fieldGroups[slot.name];
        if (!groupFields || groupFields.length === 0) continue;

        const dominantIntent = inferSlotIntentFromFields(
          groupFields,
          composed.schema,
          composed.semantics,
        );
        if (dominantIntent) {
          slot.intent = dominantIntent;
          slot.description = `${slot.description} (${dominantIntent})`;
        }
      }
    }

    if (layoutType === 'form' && fieldGroups) {
      applyFormSlotMetadata(slots, fieldGroups, composed.schema, composed.semantics);
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
  const slotContextOverrides = new Map<string, string[]>();
  const strictFieldControlSlots = composed && layoutType === 'form'
    ? new Set(slots.filter((slot) => slot.name.startsWith('field-')).map((slot) => slot.name))
    : undefined;
  let sectionContextUsed = false;

  if (layoutType === 'dashboard') {
    slotContextOverrides.set('header', [parsedIntentSections.summary]);
    for (const section of dashboardSectionPlan.slots) {
      slotContextOverrides.set(section.slotName, section.context);
    }
    sectionContextUsed = dashboardSectionPlan.slots.length > 0;
  }

  // 3a. Object-aware slot filling: use view_extensions when object is present
  let selections: SlotSelectionEntry[];
  const contextForExtensions = input.context
    ?? (
      resolved.contextSource === 'auto-detected'
      && effectiveContext
      && inferLayoutFromContext(effectiveContext) !== layoutType
        ? layoutType
        : effectiveContext ?? layoutType
    );
  let patternsApplied = 0;

  // Build per-slot field hints for intelligence-aware selection.
  // When field groups are available from expansion, each slot gets a hint
  // derived from the dominant field in its group — enabling differentiated
  // component selection across expanded tabs.
  const fieldHints = new Map<string, FieldHint>();
  if (composed) {
    // Build field-level hints first
    const perFieldHints = new Map<string, FieldHint>();
    for (const [fieldName, fieldDef] of Object.entries(composed.schema)) {
      const hint: FieldHint = { type: fieldDef.type };
      if (fieldDef.validation?.enum && fieldDef.validation.enum.length > 0) {
        hint.enum = fieldDef.validation.enum;
      }
      if (composed.semantics?.[fieldName]?.semantic_type) {
        hint.semanticType = composed.semantics[fieldName].semantic_type;
      }
      perFieldHints.set(fieldName, hint);
    }

    // If field groups are available, create per-slot hints from them
    const fieldGroups = expansionResult?.fieldGroups;
    if (fieldGroups) {
      for (const [slotName, fieldNames] of Object.entries(fieldGroups)) {
        if (fieldNames.length === 0) continue;
        // Pick the most descriptive field hint (prefer semantic types)
        let bestHint: FieldHint | undefined;
        for (const fn of fieldNames) {
          const h = perFieldHints.get(fn);
          if (!h) continue;
          if (!bestHint || (h.semanticType && !bestHint.semanticType)) {
            bestHint = h;
          }
        }
        if (bestHint) {
          fieldHints.set(slotName, bestHint);
        }
      }
    }

    // Also include field-level hints for non-slot lookups
    for (const [fieldName, hint] of perFieldHints) {
      if (!fieldHints.has(fieldName)) {
        fieldHints.set(fieldName, hint);
      }
    }
  } else if (layoutType === 'form') {
    const inferredFormDescriptors = inferFormFieldDescriptorsFromIntent(intentStr, slots);
    for (const [slotName, descriptor] of inferredFormDescriptors) {
      fieldHints.set(slotName, descriptor.hint);
      slotContextOverrides.set(slotName, descriptor.context);
      // Update slot intent to match the inferred field type
      const slot = slots.find((s) => s.name === slotName);
      if (slot && slot.intent === 'form-input') {
        const intentForHint = fieldHintToSlotIntent(descriptor.hint);
        if (intentForHint) {
          slot.intent = intentForHint;
        }
      }
    }
  } else if (layoutType === 'list') {
    slotContextOverrides.set('search', ['search input']);
    slotContextOverrides.set('filters', ['filter controls']);
    slotContextOverrides.set('toolbar-actions', ['toolbar actions']);
  }

  if (parsedIntentSections.isLongForm) {
    const sectionOverrides = buildSlotContextOverridesFromSections(slots, parsedIntentSections);
    for (const [slotName, contexts] of sectionOverrides) {
      if (!slotContextOverrides.has(slotName)) {
        slotContextOverrides.set(slotName, contexts);
      }
    }
    sectionContextUsed = sectionContextUsed || sectionOverrides.size > 0;
  }

  if (composed) {
    const collected = layoutType === 'dashboard'
      ? collectDashboardViewExtensions(composed)
      : collectViewExtensions(composed, contextForExtensions);
    for (const w of collected.warnings) {
      warnings.push({ code: 'OODS-V119', message: w });
    }

    const slotPlan = normalizeObjectPlanForCatalog(collected.plan, catalog, layoutType);

    if (slotPlan.length > 0) {
      // Use view_extension-driven slot filling
      const fillResult = fillSlotsWithObject(
        { schema, slots },
        slotPlan,
        catalog,
        input.preferences?.componentOverrides,
        intentStr,
        fieldHints.size > 0 ? fieldHints : undefined,
      );
      for (const w of fillResult.warnings) {
        warnings.push({ code: 'OODS-V120', message: w });
      }

      // Use the filled schema (fillSlotsWithObject clones internally)
      schema = fillResult.schema;

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
          slotContextOverrides.size > 0 ? slotContextOverrides : undefined,
          strictFieldControlSlots,
        );
        selections.push(...fallbackSelections);

        // Apply selection rankings to the schema tree (bridge the gap)
        applySelectionsToSchema(schema, fallbackSelections);
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
        slotContextOverrides.size > 0 ? slotContextOverrides : undefined,
        strictFieldControlSlots,
      );

      // Apply selection rankings to the schema tree
      applySelectionsToSchema(schema, selections);
    }

    // Apply composite slot patterns for form/dashboard contexts
    if (composed && (layoutType === 'form' || layoutType === 'dashboard')) {
      const compCtx = layoutType as CompositionContext;
      const semanticMap = semanticTypes;

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
      fieldHints.size > 0 ? fieldHints : undefined,
      slotContextOverrides.size > 0 ? slotContextOverrides : undefined,
      strictFieldControlSlots,
    );

    // Apply selection rankings to the schema tree
    applySelectionsToSchema(schema, selections);

    // Enrich form field props from intent-parsed descriptions (no-object path)
    if (layoutType === 'form' && slotContextOverrides.size > 0) {
      enrichFormFieldPropsFromIntent(schema, slotContextOverrides, fieldHints);
    }
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
    if (layoutType === 'form' && formFieldGroups) {
      applyFormFieldBindingsFromGroups(
        schema,
        slots,
        formFieldGroups,
        composed.schema,
        composed.semantics,
      );
    }
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
  const intelligenceMeta = {
    ...(composed ? {
      fieldsExpanded: expansionResult?.expanded ?? false,
      ...(expansionResult?.expanded ? {
        slotsExpanded: expansionResult.slotsAdded,
        expansionReason: expansionResult.reason,
      } : {}),
      patternsApplied: patternsApplied > 0 ? patternsApplied : undefined,
    } : {}),
    positionAffinityUsed: true,
    fieldAffinityUsed: fieldHints.size > 0,
    intentSectionsParsed: parsedIntentSections.sections.length > 0 ? parsedIntentSections.sections.length : undefined,
    sectionContextUsed: sectionContextUsed || undefined,
  };

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
      ...((Object.values(intelligenceMeta).some((value) => value !== undefined)) ? {
        intelligence: {
          ...intelligenceMeta,
        },
      } : {}),
    },
  };
}
